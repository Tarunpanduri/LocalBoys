import { create } from 'zustand';
// 🔥 STRICT FIRESTORE IMPORTS 🔥
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

let activeOrdersUnsubscribe = null;

export const useOrderStore = create((set, getStore) => ({
  activeOrders: [],
  selectedOrderId: null,
  loadingOrders: true,

  // 1. One efficient listener for ALL currently active orders
  startListening: () => {
    const user = auth.currentUser;
    if (!user) {
      set({ activeOrders: [], loadingOrders: false });
      return;
    }

    set({ loadingOrders: true });

    // 🔥 Query ONLY active statuses to prevent downloading years of order history
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

    // Open real-time connection for just these 1 or 2 documents
    activeOrdersUnsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort newest first
      orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      set((state) => {
        // Auto-select the first order if none is selected, 
        // OR if the currently selected order was just completed/removed
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

  // 2. Just update local state, the listener handles the data!
  selectOrder: (orderId) => {
    set({ selectedOrderId: orderId });
  },

  // 3. Clean up when leaving screen
  stopListening: () => {
    if (activeOrdersUnsubscribe) {
      activeOrdersUnsubscribe();
      activeOrdersUnsubscribe = null;
    }
    set({ activeOrders: [], selectedOrderId: null });
  }
}));