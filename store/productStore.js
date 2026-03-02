import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 🔥 STRICT FIRESTORE IMPORTS 🔥
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const useProductStore = create(
  persist(
    (set, getStore) => ({
      menus: {}, 
      loadingStates: {}, 
      lastFetchedTimestamps: {}, 

      fetchProducts: async (shopId) => {
        if (!shopId) return;

        const currentMenu = getStore().menus[shopId];
        
        if (!currentMenu) {
          set((state) => ({ loadingStates: { ...state.loadingStates, [shopId]: true } }));
        }

        try {
          const productsRef = collection(db, 'shops', shopId, 'products');
          const snap = await getDocs(productsRef);
          
          const data = {};
          snap.forEach(doc => {
            data[doc.id] = { id: doc.id, ...doc.data() };
          });

          set((state) => ({
            menus: { ...state.menus, [shopId]: data },
            loadingStates: { ...state.loadingStates, [shopId]: false },
            lastFetchedTimestamps: { ...state.lastFetchedTimestamps, [shopId]: Date.now() } 
          }));
        } catch (error) {
          console.error(`Failed to fetch products for ${shopId}:`, error);
          set((state) => ({ loadingStates: { ...state.loadingStates, [shopId]: false } }));
        }
      },

      // 🔥 NEW: Function to forcefully clear a single shop's menu from the cache
      clearShopMenu: (shopId) => {
        set((state) => {
          const newMenus = { ...state.menus };
          const newTimestamps = { ...state.lastFetchedTimestamps };
          
          delete newMenus[shopId];
          delete newTimestamps[shopId];
          
          return {
            menus: newMenus,
            lastFetchedTimestamps: newTimestamps
          };
        });
      }
    }),
    {
      name: 'localboys-menus',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);