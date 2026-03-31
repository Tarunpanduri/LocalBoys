import { create } from 'zustand';
// 🔥 NATIVE MODULAR IMPORTS 🔥
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter } from '@react-native-firebase/firestore';

let activeOrdersUnsubscribe = null;
let activeCustomOrdersUnsubscribe = null; 

// =========================================================================
// 🚀 DYNAMIC SCHEDULED DATE FORMATTER
// Converts "Tomorrow, 10:00 AM - 12:00 PM" into "Apr 1, 2026, 10:00 AM - 12:00 PM"
// based on the EXACT moment the order was placed (createdAt).
// =========================================================================
const formatScheduledTime = (order) => {
  if (!order.isScheduled || !order.scheduledAt || !order.createdAt) return order;

  try {
    // Handle Native Firestore Timestamp safely
    const createdDate = new Date(order.createdAt.toMillis ? order.createdAt.toMillis() : order.createdAt);
    
    // Split "Tomorrow, 12:00 PM - 02:00 PM" -> ["Tomorrow", " 12:00 PM - 02:00 PM"]
    const parts = order.scheduledAt.split(',');
    
    if (parts.length >= 2) {
      const dayWord = parts[0].trim().toLowerCase();
      const timeSlot = parts.slice(1).join(',').trim();

      // Calculate target date based on "Today" or "Tomorrow"
      const targetDate = new Date(createdDate);
      if (dayWord === "tomorrow") {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      // Format as "Mar 31, 2026"
      const dateString = targetDate.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric", 
        year: "numeric" 
      });

      // Inject the permanent, dynamic date string back into the order object
      return { 
        ...order, 
        scheduledAt: `${dateString}, ${timeSlot}` 
      };
    }
  } catch (error) {
    console.error("Failed to format scheduled date:", error);
  }

  // Fallback to original if something goes wrong
  return order;
};


export const useOrderStore = create((set, getStore) => ({
  activeOrders: [],
  selectedOrderId: null,
  loadingOrders: true,

  _rawStandardOrders: [], 
  _rawCustomOrders: [],  

  pastOrders: [],
  loadingPastOrders: false,
  loadingMorePastOrders: false,
  hasMorePastOrders: true,
  lastVisibleStandardDoc: null, 
  lastVisibleCustomDoc: null,

  startListening: () => {
    const user = auth.currentUser;
    if (!user) {
      set({ activeOrders: [], loadingOrders: false });
      return;
    }

    set({ loadingOrders: true });

    const activeStatuses = [
      "pending", 
      "accepted_restaurent", 
      "ready", 
      "accepted_driver", 
      "picked_up"
    ];

    // ✅ STANDARD ORDERS LISTENER
    const qStandard = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('status', 'in', activeStatuses)
    );

    // ✅ CUSTOM ORDERS LISTENER
    const qCustom = query(
      collection(db, 'custom_orders'),
      where('userId', '==', user.uid),
      where('status', 'in', activeStatuses)
    );

    const combineAndSetOrders = (standard, custom) => {
      // Sort and map through the formatting helper
      const combined = [...standard, ...custom].map(formatScheduledTime).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      });

      set((state) => {
        let newSelectedId = state.selectedOrderId;
        if (!newSelectedId || !combined.find(o => o.id === newSelectedId)) {
          newSelectedId = combined.length > 0 ? combined[0].id : null;
        }
        return { activeOrders: combined, selectedOrderId: newSelectedId, loadingOrders: false };
      });
    };

    if (activeOrdersUnsubscribe) activeOrdersUnsubscribe();
    if (activeCustomOrdersUnsubscribe) activeCustomOrdersUnsubscribe();

    activeOrdersUnsubscribe = onSnapshot(qStandard, (snapshot) => {
      const orders = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: false })) || [];
      set({ _rawStandardOrders: orders });
      combineAndSetOrders(orders, getStore()._rawCustomOrders);
    }, (err) => console.log("Standard listener error:", err));

    activeCustomOrdersUnsubscribe = onSnapshot(qCustom, (snapshot) => {
      const orders = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: true })) || [];
      set({ _rawCustomOrders: orders });
      combineAndSetOrders(getStore()._rawStandardOrders, orders);
    }, (err) => console.log("Custom listener error:", err));
  },

  selectOrder: (orderId) => {
    set({ selectedOrderId: orderId });
  },

  stopListening: () => {
    if (activeOrdersUnsubscribe) activeOrdersUnsubscribe();
    if (activeCustomOrdersUnsubscribe) activeCustomOrdersUnsubscribe();
    activeOrdersUnsubscribe = null;
    activeCustomOrdersUnsubscribe = null;
    set({ activeOrders: [], selectedOrderId: null, _rawStandardOrders: [], _rawCustomOrders: [] });
  },

  refreshPastOrders: async () => {
    const user = auth.currentUser;
    if (!user) return;

    set({ loadingPastOrders: true, hasMorePastOrders: true, lastVisibleStandardDoc: null, lastVisibleCustomDoc: null, pastOrders: [] });

    try {
      const inactiveStatuses = ["completed", "cancelled", "rejected", "REJECTED"];
      
      const qStandard = query(collection(db, 'orders'), where('userId', '==', user.uid), where('status', 'in', inactiveStatuses), orderBy('createdAt', 'desc'), limit(10));
      const qCustom = query(collection(db, 'custom_orders'), where('userId', '==', user.uid), where('status', 'in', inactiveStatuses), orderBy('createdAt', 'desc'), limit(10));

      const [snapStandard, snapCustom] = await Promise.all([getDocs(qStandard), getDocs(qCustom)]);
      
      const standardOrders = snapStandard.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: false }));
      const customOrders = snapCustom.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: true }));
      
      // Format scheduled dates and sort
      const combined = [...standardOrders, ...customOrders].map(formatScheduledTime).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      }).slice(0, 10); 

      set({ 
        pastOrders: combined, 
        lastVisibleStandardDoc: snapStandard.docs[snapStandard.docs.length - 1] || null,
        lastVisibleCustomDoc: snapCustom.docs[snapCustom.docs.length - 1] || null,
        hasMorePastOrders: standardOrders.length === 10 || customOrders.length === 10,
        loadingPastOrders: false 
      });

    } catch (error) {
      console.error("Error fetching past orders:", error);
      set({ loadingPastOrders: false });
    }
  },

  fetchMorePastOrders: async () => {
    const state = getStore();
    const user = auth.currentUser;
    if (!user || state.loadingMorePastOrders || !state.hasMorePastOrders) return;

    set({ loadingMorePastOrders: true });

    try {
      const inactiveStatuses = ["completed", "cancelled", "rejected", "REJECTED"];
      
      let standardOrders = [];
      let customOrders = [];
      let newLastStandard = state.lastVisibleStandardDoc;
      let newLastCustom = state.lastVisibleCustomDoc;

      if (state.lastVisibleStandardDoc) {
        const qStandard = query(collection(db, 'orders'), where('userId', '==', user.uid), where('status', 'in', inactiveStatuses), orderBy('createdAt', 'desc'), startAfter(state.lastVisibleStandardDoc), limit(10));
        const snapStandard = await getDocs(qStandard);
        standardOrders = snapStandard.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: false }));
        newLastStandard = snapStandard.docs[snapStandard.docs.length - 1] || null;
      }

      if (state.lastVisibleCustomDoc) {
        const qCustom = query(collection(db, 'custom_orders'), where('userId', '==', user.uid), where('status', 'in', inactiveStatuses), orderBy('createdAt', 'desc'), startAfter(state.lastVisibleCustomDoc), limit(10));
        const snapCustom = await getDocs(qCustom);
        customOrders = snapCustom.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: true }));
        newLastCustom = snapCustom.docs[snapCustom.docs.length - 1] || null;
      }

      // Format scheduled dates and sort
      const combinedNew = [...standardOrders, ...customOrders].map(formatScheduledTime).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      });

      if (combinedNew.length === 0) {
        set({ hasMorePastOrders: false, loadingMorePastOrders: false });
        return;
      }

      set((prevState) => ({
        pastOrders: [...prevState.pastOrders, ...combinedNew],
        lastVisibleStandardDoc: newLastStandard,
        lastVisibleCustomDoc: newLastCustom,
        hasMorePastOrders: standardOrders.length === 10 || customOrders.length === 10,
        loadingMorePastOrders: false
      }));

    } catch (error) {
      console.error("Error fetching more past orders:", error);
      set({ loadingMorePastOrders: false });
    }
  }
}));