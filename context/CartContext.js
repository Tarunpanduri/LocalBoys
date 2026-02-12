import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Alert } from "react-native";
import { ref, onValue, set, remove, get } from "firebase/database";
import { auth, db } from "../firebase"; // Adjust path to your firebase config
import Toast from "react-native-root-toast";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartData, setCartData] = useState({});
  const [loading, setLoading] = useState(true);
  
  const user = auth.currentUser;

  // 1. Sync Cart with Firebase
  useEffect(() => {
    if (!user) {
      setCartData({});
      setLoading(false);
      return;
    }

    const cartRef = ref(db, `carts/${user.uid}`);
    const unsubscribe = onValue(cartRef, (snapshot) => {
      setCartData(snapshot.val() || {});
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- DERIVED STATE ---
  
  // Get the active Shop ID (since we only allow one shop at a time)
  const cartShopId = useMemo(() => {
    const keys = Object.keys(cartData).filter(k => k !== "updatedAt");
    return keys.length > 0 ? keys[0] : null;
  }, [cartData]);

  // Get the active Shop Details (name, image)
  const cartShop = useMemo(() => {
    return cartShopId ? cartData[cartShopId] : null;
  }, [cartShopId, cartData]);

  // Get Array of Products
  const cartItems = useMemo(() => {
    if (!cartShop) return [];
    return Object.keys(cartShop)
      .filter(k => !["shopname", "shopimage", "shopphone"].includes(k))
      .map(key => ({ id: key, ...cartShop[key] }));
  }, [cartShop]);

  // Calculate Totals
  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.price * item.qty), 0);
  }, [cartItems]);

  const cartItemCount = useMemo(() => {
    return cartItems.reduce((count, item) => count + item.qty, 0);
  }, [cartItems]);


  // --- ACTIONS ---

  const addToCart = async (shop, product, quantity = 1) => {
    if (!user) {
      Toast.show("Please login to add items.", { duration: Toast.durations.SHORT });
      return;
    }
    
    if (product.inStock === false) {
      Toast.show("Product is out of stock.", { duration: Toast.durations.SHORT });
      return;
    }

    const userCartRef = ref(db, `carts/${user.uid}`);
    const currentShopId = shop.id || shopId; // Ensure you pass shop.id

    // Check for Shop Conflict
    if (cartShopId && cartShopId !== currentShopId) {
      Alert.alert(
        "Start new basket?",
        `Your cart contains items from ${cartShop.shopname}. Do you want to clear it and add items from ${shop.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Yes, Start New", 
            onPress: async () => {
              // Overwrite entire cart node with new shop
              await set(userCartRef, {
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

    // Add/Update Item in current shop
    try {
      const existingItem = cartShop ? cartShop[product.id] : null;
      const newQty = existingItem ? existingItem.qty + quantity : quantity;

      const updatePayload = {
        ...cartData,
        [currentShopId]: {
          ...cartShop, // Preserve other items
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

      await set(userCartRef, updatePayload);
      Toast.show(`${product.name} added to cart.`, { duration: Toast.durations.SHORT });
    } catch (error) {
      console.error(error);
      Toast.show("Failed to update cart.", { duration: Toast.durations.SHORT });
    }
  };

  const decreaseQty = async (shopId, product) => {
    if (!user) return;
    
    const currentShopCart = cartData[shopId];
    if (!currentShopCart || !currentShopCart[product.id]) return;

    const currentQty = currentShopCart[product.id].qty;

    if (currentQty <= 1) {
      // Remove item if qty becomes 0
      await removeFromCart(shopId, product.id);
    } else {
      // Decrease Qty
      const itemRef = ref(db, `carts/${user.uid}/${shopId}/${product.id}/qty`);
      await set(itemRef, currentQty - 1);
    }
  };

  const removeFromCart = async (shopId, productId) => {
    if (!user) return;
    try {
      await remove(ref(db, `carts/${user.uid}/${shopId}/${productId}`));
      
      // Optional: If shop becomes empty, remove the shop node?
      // Firebase often leaves empty nodes, but our logic handles empty objects.
      Toast.show("Item removed.", { duration: Toast.durations.SHORT });
    } catch (error) {
      console.error(error);
      Toast.show("Failed to remove item.", { duration: Toast.durations.SHORT });
    }
  };

  // ✅ UPDATED: Silent cart clear – NO confirmation alert
  const clearCart = async () => {
    if (!user) return;
    try {
      await remove(ref(db, `carts/${user.uid}`));
      Toast.show("Cart cleared.", { duration: Toast.durations.SHORT });
    } catch (err) {
      console.error("Clear cart error:", err);
      Toast.show("Failed to clear cart.", { duration: Toast.durations.SHORT });
    }
  };

  return (
    <CartContext.Provider
      value={{
        // State
        cartData,
        cartShopId,
        cartShop,
        cartItems,
        cartTotal,
        cartItemCount,
        loading,
        
        // Actions
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