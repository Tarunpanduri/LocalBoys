import { create } from 'zustand';
import { ref, onValue, off, query, limitToLast } from 'firebase/database';
import { db, auth } from '../firebase';

export const useOrderStore = create((set) => ({
  activeOrders: [],
  loadingOrders: true,

  startListening: () => {
    const user = auth.currentUser;
    if (!user) {
      set({ activeOrders: [], loadingOrders: false });
      return;
    }

    set({ loadingOrders: true });

    // PRODUCTION FIX: limitToLast(20) ensures we only fetch recent orders.
    // This stops Firebase from downloading the user's entire lifetime history
    // every single time a driver's location updates.
    const ordersRef = query(ref(db, `orders/${user.uid}`), limitToLast(20));
    
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Filter active orders directly in memory
        const formatted = Object.entries(data)
          .map(([id, order]) => ({ id, ...order }))
          .filter((order) => order.status !== "completed" && order.status !== "REJECTED");
          
        set({ activeOrders: formatted, loadingOrders: false });
      } else {
        set({ activeOrders: [], loadingOrders: false });
      }
    });
  },

  stopListening: () => {
    const user = auth.currentUser;
    if (user) {
      // Kills the WebSocket connection to save Firebase bandwidth
      off(ref(db, `orders/${user.uid}`));
    }
  }
}));