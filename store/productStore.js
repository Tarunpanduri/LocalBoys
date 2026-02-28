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

      fetchProducts: async (shopId) => {
        if (!shopId) return;

        const currentMenu = getStore().menus[shopId];
        
        if (!currentMenu) {
          set((state) => ({ loadingStates: { ...state.loadingStates, [shopId]: true } }));
        }

        try {
          // 🔥 CRITICAL FIX: Products are now a subcollection inside the shop! 🔥
          const productsRef = collection(db, 'shops', shopId, 'products');
          const snap = await getDocs(productsRef);
          
          const data = {};
          snap.forEach(doc => {
            data[doc.id] = { id: doc.id, ...doc.data() };
          });

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