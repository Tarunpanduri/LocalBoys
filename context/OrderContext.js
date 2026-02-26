import React, { createContext, useState, useEffect, useContext } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db, auth } from '../firebase';

const OrderContext = createContext();

export const useOrders = () => useContext(OrderContext);

export const OrderProvider = ({ children }) => {
  const [activeOrders, setActiveOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    // FIX: Changed onAuthStateIdChanged to onAuthStateChanged
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const ordersRef = ref(db, `orders/${user.uid}`);
        
        onValue(ordersRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Filter active orders directly in memory
            const formatted = Object.entries(data)
              .map(([id, order]) => ({ id, ...order }))
              .filter((order) => order.status !== "completed" && order.status !== "REJECTED");
              
            setActiveOrders(formatted);
          } else {
            setActiveOrders([]);
          }
          setLoadingOrders(false);
        });
      } else {
        setActiveOrders([]);
        setLoadingOrders(false);
        // Clean up listeners if user logs out
        off(ref(db, `orders`)); 
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <OrderContext.Provider value={{ activeOrders, loadingOrders }}>
      {children}
    </OrderContext.Provider>
  );
};