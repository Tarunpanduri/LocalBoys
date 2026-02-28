import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';

export const useProductStore = create(
  persist(
    (set, getStore) => ({
      menus: {}, // Stores products: { shopId_1: { ...products }, shopId_2: { ...products } }
      loadingStates: {}, 

      fetchProducts: async (shopId) => {
        if (!shopId) return;

        const currentMenu = getStore().menus[shopId];
        
        // Only show loading spinner if we have NEVER cached this shop's menu
        if (!currentMenu) {
          set((state) => ({ loadingStates: { ...state.loadingStates, [shopId]: true } }));
        }

        try {
          const snap = await get(ref(db, `products/${shopId}`));
          const data = snap.val() || {};

          set((state) => ({
            menus: { ...state.menus, [shopId]: data },
            loadingStates: { ...state.loadingStates, [shopId]: false }
          }));
        } catch (error) {
          console.error(`Failed to fetch products for ${shopId}:`, error);
          set((state) => ({ loadingStates: { ...state.loadingStates, [shopId]: false } }));
        }
      }
    }),
    {
      name: 'localboys-menus',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);