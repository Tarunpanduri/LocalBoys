import { create } from 'zustand';
// 🔥 STRICT FIRESTORE IMPORTS 🔥
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

let activeOrdersUnsubscribe = null;

export const useOrderStore = create((set, getStore) => ({
  activeOrders: [],
  selectedOrderId: null,
  loadingOrders: true,

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

    // 🔥 FINAL FIX: Kill any existing ghost listener before starting a new one!
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
  }
}));