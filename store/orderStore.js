import { create } from 'zustand';
// 🔥 STRICT FIRESTORE IMPORTS 🔥
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

let activeOrderListener = null;

export const useOrderStore = create((set, getStore) => ({
  activeOrders: [],
  selectedOrder: null,
  loadingOrders: true,

  // 1. Master Query: Fetch basic info for the top carousel
  fetchActiveOrders: async () => {
    const user = auth.currentUser;
    if (!user) {
      set({ activeOrders: [], loadingOrders: false });
      return;
    }

    try {
      set({ loadingOrders: true });
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      
      const formatted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(order => order.status !== "completed" && order.status !== "REJECTED");
        
      // Sort newest first
      formatted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      set({ activeOrders: formatted, loadingOrders: false });

      // Automatically select and listen to the newest order if it exists
      if (formatted.length > 0) {
        getStore().selectAndListenToOrder(formatted[0].id);
      }

    } catch (error) {
      console.error("Order fetch error:", error);
      set({ loadingOrders: false });
    }
  },

  // 2. Detail Tunnel: Open a cheap, high-speed tunnel to ONE specific order
  selectAndListenToOrder: (orderId) => {
    // Clean up previous listener if user clicks a different order card
    if (activeOrderListener) {
      activeOrderListener();
    }

    // Set a temporary selected order from our local cache so the UI doesn't blink
    const currentOrders = getStore().activeOrders;
    const cachedOrder = currentOrders.find(o => o.id === orderId);
    if (cachedOrder) {
      set({ selectedOrder: cachedOrder });
    }

    // Open the live Firestore tunnel
    activeOrderListener = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
      if (docSnap.exists()) {
        const updatedOrder = { id: docSnap.id, ...docSnap.data() };
        
        // Update the selected order details
        set({ selectedOrder: updatedOrder });

        // Also update the specific card in the top carousel so the status text changes
        set((state) => ({
          activeOrders: state.activeOrders.map(o => o.id === orderId ? updatedOrder : o)
        }));
      }
    }, (error) => {
       console.error("Single order listener error:", error);
    });
  },

  // Safely close the tunnel when the user leaves the tracking screen
  stopListening: () => {
    if (activeOrderListener) {
      activeOrderListener();
      activeOrderListener = null;
    }
    set({ selectedOrder: null });
  }
}));