import { create } from 'zustand';
// 🔥 STRICT FIRESTORE IMPORTS 🔥
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db, auth } from '../firebase';

let activeOrdersUnsubscribe = null;

export const useOrderStore = create((set, getStore) => ({
  // --- ACTIVE ORDERS STATE ---
  activeOrders: [],
  selectedOrderId: null,
  loadingOrders: true,

  // --- PAST ORDERS STATE (PAGINATED) ---
  pastOrders: [],
  loadingPastOrders: false,
  loadingMorePastOrders: false,
  hasMorePastOrders: true,
  lastVisibleOrderDoc: null,

  // ==========================================
  // 1. ACTIVE ORDERS LOGIC (Real-time)
  // ==========================================
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

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('status', 'in', activeStatuses)
    );

    // Kill any existing ghost listener before starting a new one!
    if (activeOrdersUnsubscribe) {
      activeOrdersUnsubscribe();
    }

    // Open real-time connection
    activeOrdersUnsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      set((state) => {
        let newSelectedId = state.selectedOrderId;
        if (!newSelectedId || !orders.find(o => o.id === newSelectedId)) {
          newSelectedId = orders.length > 0 ? orders[0].id : null;
        }

        return { 
          activeOrders: orders, 
          selectedOrderId: newSelectedId,
          loadingOrders: false 
        };
      });
    }, (error) => {
      console.error("Order listener error:", error);
      set({ loadingOrders: false });
    });
  },

  selectOrder: (orderId) => {
    set({ selectedOrderId: orderId });
  },

  stopListening: () => {
    if (activeOrdersUnsubscribe) {
      activeOrdersUnsubscribe();
      activeOrdersUnsubscribe = null;
    }
    set({ activeOrders: [], selectedOrderId: null });
  },

  // ==========================================
  // 2. PAST ORDERS LOGIC (Paginated, One-Time Fetch)
  // ==========================================
  
  refreshPastOrders: async () => {
    const user = auth.currentUser;
    if (!user) return;

    set({ loadingPastOrders: true, hasMorePastOrders: true, lastVisibleOrderDoc: null, pastOrders: [] });

    try {
      const inactiveStatuses = ["completed", "cancelled", "rejected", "REJECTED"];
      
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        where('status', 'in', inactiveStatuses),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];

      set({ 
        pastOrders: orders, 
        lastVisibleOrderDoc: lastVisible || null,
        hasMorePastOrders: orders.length === 10,
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
    
    // Prevent fetching if already loading, no more items, or no user
    if (!user || state.loadingMorePastOrders || !state.hasMorePastOrders || !state.lastVisibleOrderDoc) return;

    set({ loadingMorePastOrders: true });

    try {
      const inactiveStatuses = ["completed", "cancelled", "rejected", "REJECTED"];
      
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        where('status', 'in', inactiveStatuses),
        orderBy('createdAt', 'desc'),
        startAfter(state.lastVisibleOrderDoc),
        limit(10)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        set({ hasMorePastOrders: false, loadingMorePastOrders: false });
        return;
      }

      const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];

      set((prevState) => ({
        pastOrders: [...prevState.pastOrders, ...newOrders],
        lastVisibleOrderDoc: lastVisible,
        hasMorePastOrders: newOrders.length === 10,
        loadingMorePastOrders: false
      }));

    } catch (error) {
      console.error("Error fetching more past orders:", error);
      set({ loadingMorePastOrders: false });
    }
  }

}));