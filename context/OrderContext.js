import React, { createContext, useState, useEffect, useContext } from 'react';
// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const OrderContext = createContext();

export const useOrders = () => useContext(OrderContext);

export const OrderProvider = ({ children }) => {
  const [activeOrders, setActiveOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let unsubscribeOrders = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 🔥 FIRESTORE QUERY: Find orders where userId matches the current user
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', user.uid)
        );
        
        // Listen to changes in real-time
        unsubscribeOrders = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const formatted = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter((order) => order.status !== "completed" && order.status !== "REJECTED");
              
            setActiveOrders(formatted);
          } else {
            setActiveOrders([]);
          }
          setLoadingOrders(false);
        }, (error) => {
          console.error("Order fetch error:", error);
          setLoadingOrders(false);
        });

      } else {
        setActiveOrders([]);
        setLoadingOrders(false);
        if (unsubscribeOrders) {
          unsubscribeOrders(); // Clean up listeners if user logs out
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, []);

  return (
    <OrderContext.Provider value={{ activeOrders, loadingOrders }}>
      {children}
    </OrderContext.Provider>
  );
};