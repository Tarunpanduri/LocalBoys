import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Toast from 'react-native-root-toast';
import { Alert } from 'react-native';

// Background Syncer: Prevents spamming Firestore with writes
let syncTimeout = null;
const syncToFirebase = (cartData) => {
  const user = auth.currentUser;
  if (!user) return;
  
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(async () => {
    try {
      // 🔥 FIRESTORE DOCUMENT REFERENCE 🔥
      const cartRef = doc(db, 'carts', user.uid);
      
      if (Object.keys(cartData).length === 0) {
        // If cart is empty, delete the document
        await deleteDoc(cartRef);
      } else {
        // Otherwise, overwrite/create the document with the new cart data
        await setDoc(cartRef, cartData);
      }
    } catch (e) {
      console.error("Cart sync error:", e);
    }
  }, 2000); // 2 second delay after the user stops tapping
};

export const useCartStore = create(
  persist(
    (set, getStore) => ({
      cartData: {},

      addToCart: (shop, product, quantity = 1) => {
        const user = auth.currentUser;
        if (!user) {
          Toast.show("Please login to add items.", { duration: Toast.durations.SHORT });
          return;
        }
        if (product.inStock === false) {
          Toast.show("Product is out of stock.", { duration: Toast.durations.SHORT });
          return;
        }

        const currentData = getStore().cartData;
        const keys = Object.keys(currentData).filter(k => k !== "updatedAt");
        const cartShopId = keys.length > 0 ? keys[0] : null;
        const targetShopId = shop.id;

        // Shop Conflict Alert
        if (cartShopId && cartShopId !== targetShopId) {
          Alert.alert(
            "Start new basket?",
            `Your cart contains items from another shop. Do you want to clear it and add items from ${shop.name}?`,
            [
              { text: "Cancel", style: "cancel" },
              { 
                text: "Yes, Start New", 
                onPress: () => {
                  const newCart = {
                    [targetShopId]: {
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
                  };
                  set({ cartData: newCart });
                  syncToFirebase(newCart);
                  Toast.show(`${product.name} added.`, { duration: Toast.durations.SHORT });
                }
              }
            ]
          );
          return;
        }

        // Add or Update
        const existingShop = currentData[targetShopId] || {};
        const existingItem = existingShop[product.id];
        const newQty = existingItem ? existingItem.qty + quantity : quantity;

        const updatedCart = {
          ...currentData,
          [targetShopId]: {
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

        set({ cartData: updatedCart });
        syncToFirebase(updatedCart);
        Toast.show(`${product.name} added to cart.`, { duration: Toast.durations.SHORT });
      },

      decreaseQty: (shopId, product) => {
        const user = auth.currentUser;
        if (!user) return;

        const currentData = getStore().cartData;
        const shopCart = currentData[shopId];
        if (!shopCart || !shopCart[product.id]) return;

        const currentQty = shopCart[product.id].qty;
        let updatedCart;

        if (currentQty <= 1) {
          const newShopCart = { ...shopCart };
          delete newShopCart[product.id];

          const remainingKeys = Object.keys(newShopCart).filter(k => !["shopname", "shopimage", "shopphone"].includes(k));
          if (remainingKeys.length === 0) {
            updatedCart = { ...currentData };
            delete updatedCart[shopId];
          } else {
            updatedCart = { ...currentData, [shopId]: newShopCart, updatedAt: Date.now() };
          }
        } else {
          updatedCart = {
            ...currentData,
            [shopId]: {
              ...shopCart,
              [product.id]: { ...shopCart[product.id], qty: currentQty - 1 }
            },
            updatedAt: Date.now()
          };
        }

        set({ cartData: updatedCart });
        syncToFirebase(updatedCart);
      },

      removeFromCart: (shopId, productId) => {
        const currentData = getStore().cartData;
        const shopCart = currentData[shopId];
        if (!shopCart) return;

        const newShopCart = { ...shopCart };
        delete newShopCart[productId];

        let updatedCart;
        const remainingKeys = Object.keys(newShopCart).filter(k => !["shopname", "shopimage", "shopphone"].includes(k));
        
        if (remainingKeys.length === 0) {
          updatedCart = { ...currentData };
          delete updatedCart[shopId];
        } else {
          updatedCart = { ...currentData, [shopId]: newShopCart, updatedAt: Date.now() };
        }

        set({ cartData: updatedCart });
        syncToFirebase(updatedCart);
        Toast.show("Item removed.", { duration: Toast.durations.SHORT });
      },

      clearCart: () => {
        set({ cartData: {} });
        syncToFirebase({});
        Toast.show("Cart cleared.", { duration: Toast.durations.SHORT });
      }
    }),
    {
      name: 'localboys-cart', 
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);