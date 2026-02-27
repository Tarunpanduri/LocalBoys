import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { Alert } from "react-native";
import { ref, set, remove, get } from "firebase/database";
import { auth, db } from "../firebase";
import Toast from "react-native-root-toast";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartData, setCartData] = useState({});
  const [loading, setLoading] = useState(true);
  
  const user = auth.currentUser;
  
  // Trackers for debounce and initial load
  const isInitialLoad = useRef(true);
  const syncTimeoutRef = useRef(null);

  // 1. Fetch Cart ONCE when context mounts (Replaces onValue)
  useEffect(() => {
    if (!user) {
      setCartData({});
      setLoading(false);
      return;
    }

    const fetchCart = async () => {
      try {
        const cartRef = ref(db, `carts/${user.uid}`);
        const snapshot = await get(cartRef);
        setCartData(snapshot.val() || {});
      } catch (error) {
        console.error("Failed to fetch cart:", error);
      } finally {
        setLoading(false);
        // Add a slight delay to ensure state updates before enabling sync
        setTimeout(() => { isInitialLoad.current = false; }, 500);
      }
    };

    fetchCart();
  }, [user]);

  // 2. Debounced Background Sync to Firebase
  useEffect(() => {
    // Prevent wiping the DB before initial data is loaded
    if (loading || isInitialLoad.current || !user) return;

    // Clear previous timeout if user taps again quickly
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Wait 1.5 seconds after the last cart change to write to Firebase
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const cartRef = ref(db, `carts/${user.uid}`);
        if (Object.keys(cartData).length === 0) {
          await remove(cartRef);
        } else {
          await set(cartRef, cartData);
        }
      } catch (error) {
        console.error("Firebase Cart Sync Error:", error);
      }
    }, 1500);

    return () => clearTimeout(syncTimeoutRef.current);
  }, [cartData, user, loading]);

  // --- DERIVED STATE ---
  
  const cartShopId = useMemo(() => {
    const keys = Object.keys(cartData).filter(k => k !== "updatedAt");
    return keys.length > 0 ? keys[0] : null;
  }, [cartData]);

  const cartShop = useMemo(() => {
    return cartShopId ? cartData[cartShopId] : null;
  }, [cartShopId, cartData]);

  const cartItems = useMemo(() => {
    if (!cartShop) return [];
    return Object.keys(cartShop)
      .filter(k => !["shopname", "shopimage", "shopphone"].includes(k))
      .map(key => ({ id: key, ...cartShop[key] }));
  }, [cartShop]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.price * item.qty), 0);
  }, [cartItems]);

  const cartItemCount = useMemo(() => {
    return cartItems.reduce((count, item) => count + item.qty, 0);
  }, [cartItems]);


  // --- LOCAL ACTIONS (No direct Firebase calls) ---

  const addToCart = async (shop, product, quantity = 1) => {
    if (!user) {
      Toast.show("Please login to add items.", { duration: Toast.durations.SHORT });
      return;
    }
    
    if (product.inStock === false) {
      Toast.show("Product is out of stock.", { duration: Toast.durations.SHORT });
      return;
    }

    const currentShopId = shop.id || shopId;

    // Check for Shop Conflict
    if (cartShopId && cartShopId !== currentShopId) {
      Alert.alert(
        "Start new basket?",
        `Your cart contains items from ${cartShop.shopname}. Do you want to clear it and add items from ${shop.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Yes, Start New", 
            onPress: () => {
              // Replace entire local cart
              setCartData({
                [currentShopId]: {
                  shopname: shop.name,
                  shopimage: shop.image,
                  [product.id]: {
                    productname: product.name,
                    price: product.price,
                    qty: quantity,
                    serviceType: product.serviceType || null,
                    image: product.image || null
                  }
                },
                updatedAt: Date.now()
              });
              Toast.show(`${product.name} added.`, { duration: Toast.durations.SHORT });
            }
          }
        ]
      );
      return;
    }

    // Add/Update Item in current shop locally
    setCartData(prev => {
      const existingShop = prev[currentShopId] || {};
      const existingItem = existingShop[product.id];
      const newQty = existingItem ? existingItem.qty + quantity : quantity;

      return {
        ...prev,
        [currentShopId]: {
          ...existingShop,
          shopname: shop.name,
          shopimage: shop.image,
          [product.id]: {
            productname: product.name,
            price: product.price,
            qty: newQty,
            serviceType: product.serviceType || null,
            image: product.image || null
          }
        },
        updatedAt: Date.now()
      };
    });
    Toast.show(`${product.name} added to cart.`, { duration: Toast.durations.SHORT });
  };

  const decreaseQty = (shopId, product) => {
    if (!user) return;

    setCartData(prev => {
      const shopCart = prev[shopId];
      if (!shopCart || !shopCart[product.id]) return prev;

      const currentQty = shopCart[product.id].qty;

      if (currentQty <= 1) {
        // Handle local removal
        const newShopCart = { ...shopCart };
        delete newShopCart[product.id];

        // If no products left, remove the shop node
        const remainingKeys = Object.keys(newShopCart).filter(k => !["shopname", "shopimage", "shopphone"].includes(k));
        if (remainingKeys.length === 0) {
          const newData = { ...prev };
          delete newData[shopId];
          return newData;
        }

        return { ...prev, [shopId]: newShopCart, updatedAt: Date.now() };
      }

      // Handle normal decrease
      return {
        ...prev,
        [shopId]: {
          ...shopCart,
          [product.id]: {
            ...shopCart[product.id],
            qty: currentQty - 1
          }
        },
        updatedAt: Date.now()
      };
    });
  };

  const removeFromCart = (shopId, productId) => {
    if (!user) return;

    setCartData(prev => {
      const shopCart = prev[shopId];
      if (!shopCart) return prev;

      const newShopCart = { ...shopCart };
      delete newShopCart[productId];

      // If no products left, remove the shop node
      const remainingKeys = Object.keys(newShopCart).filter(k => !["shopname", "shopimage", "shopphone"].includes(k));
      if (remainingKeys.length === 0) {
        const newData = { ...prev };
        delete newData[shopId];
        Toast.show("Item removed.", { duration: Toast.durations.SHORT });
        return newData;
      }

      Toast.show("Item removed.", { duration: Toast.durations.SHORT });
      return { ...prev, [shopId]: newShopCart, updatedAt: Date.now() };
    });
  };

  // Explicitly push clear request immediately for safety
  const clearCart = async () => {
    if (!user) return;
    try {
      setCartData({});
      await remove(ref(db, `carts/${user.uid}`));
      Toast.show("Cart cleared.", { duration: Toast.durations.SHORT });
    } catch (err) {
      console.error("Clear cart error:", err);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartData,
        cartShopId,
        cartShop,
        cartItems,
        cartTotal,
        cartItemCount,
        loading,
        addToCart,
        decreaseQty,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};