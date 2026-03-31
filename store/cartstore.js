import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 🔥 NATIVE MODULAR AUTH 🔥
import { auth } from '../firebase';
import Toast from 'react-native-root-toast';

export const useCartStore = create(
  persist(
    (set, getStore) => ({
      cartData: {},

      addToCart: (shop, product, quantity = 1, force = false) => {
        // Safe access via exported modular instance
        const user = auth.currentUser;
        if (!user) {
          Toast.show("Please login to add items.", { duration: Toast.durations.SHORT });
          return { success: false, reason: 'auth' };
        }
        if (product.inStock === false) {
          Toast.show("Product is out of stock.", { duration: Toast.durations.SHORT });
          return { success: false, reason: 'stock' };
        }

        const currentData = getStore().cartData;
        const keys = Object.keys(currentData).filter(k => k !== "updatedAt");
        const cartShopId = keys.length > 0 ? keys[0] : null;
        const targetShopId = shop.id;

        if (cartShopId && cartShopId !== targetShopId) {
          if (!force) {
            return { conflict: true, cartShopId };
          }
        }

        let baseData = currentData;
        if (cartShopId && cartShopId !== targetShopId && force) {
          baseData = {};
        }

        const existingShop = baseData[targetShopId] || {};
        const existingItem = existingShop[product.id];
        const newQty = existingItem ? existingItem.qty + quantity : quantity;

        const updatedCart = {
          ...baseData,
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
        Toast.show(`${product.name} ${force ? 'added.' : 'added to cart.'}`, { duration: Toast.durations.SHORT });
        return { success: true };
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
        Toast.show("Item removed.", { duration: Toast.durations.SHORT });
      },

      clearCart: () => {
        set({ cartData: {} });
        Toast.show("Cart cleared.", { duration: Toast.durations.SHORT });
      },

      clearShopCart: (shopId) => {
        const currentData = getStore().cartData;
        if (currentData[shopId]) {
          const updatedCart = { ...currentData };
          delete updatedCart[shopId];
          set({ cartData: updatedCart, updatedAt: Date.now() });
        }
      },

      syncCartPrices: (shopId, freshProducts) => {
        const currentData = getStore().cartData;
        const shopCart = currentData[shopId];
        if (!shopCart || !freshProducts) return;

        let updatedShopCart = { ...shopCart };
        let hasChanges = false;

        Object.keys(shopCart).forEach(productId => {
          if (["shopname", "shopimage", "shopphone"].includes(productId)) return;

          const freshItem = freshProducts[productId];
          if (freshItem) {
            if (updatedShopCart[productId].price !== freshItem.price || updatedShopCart[productId].productname !== freshItem.name) {
              updatedShopCart[productId] = { 
                ...updatedShopCart[productId], 
                price: freshItem.price,
                productname: freshItem.name
              };
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          set({ cartData: { ...currentData, [shopId]: updatedShopCart, updatedAt: Date.now() } });
        }
      }

    }),
    {
      name: 'localboys-cart', 
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);