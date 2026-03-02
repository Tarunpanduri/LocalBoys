import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as geofire from 'geofire-common';

// 🔥 IMPORT PRODUCT STORE TO TRIGGER CACHE INVALIDATION
import { useProductStore } from './productStore';

// Simple flag to prevent concurrent fetches (module-level, because store is a singleton)
let isFetching = false;

export const useShopStore = create(
  persist(
    (set, getStore) => ({
      shops: [],
      loading: false,
      lastBranchId: null,

      fetchNearbyShops: async (userLat, userLng, radiusInKm, branchId, isPullToRefresh = false) => {
        // Prevent concurrent executions
        if (isFetching) {
          console.log('Fetch already in progress, skipping...');
          return;
        }

        if (!userLat || !userLng || !branchId) return;

        const state = getStore();
        const isNewBranch = state.lastBranchId !== branchId;
        const forceRefresh = isPullToRefresh || isNewBranch;

        // SAFETY LOCK 1: INSTANTLY WIPE OLD SHOPS ON BRANCH CHANGE
        if (forceRefresh) {
          set({ shops: [], loading: true, lastBranchId: branchId });
        } else if (state.shops.length === 0) {
          set({ loading: true });
        }

        isFetching = true;
        try {
          const userLocation = [parseFloat(userLat), parseFloat(userLng)];

          const indexRef = doc(db, 'branch_indexes', branchId);
          const indexSnap = await getDoc(indexRef);

          if (!indexSnap.exists()) {
            set({ shops: [], loading: false });
            return;
          }

          const branchIndexData = indexSnap.data();
          let idsToFetch = [];
          let validShopIdsInRadius = [];

          Object.keys(branchIndexData).forEach(shopId => {
            const shopMeta = branchIndexData[shopId];

            if (!shopMeta.lat || !shopMeta.lng || shopMeta.isActive === false) return;

            const distanceInKm = geofire.distanceBetween([shopMeta.lat, shopMeta.lng], userLocation);

            if (distanceInKm <= radiusInKm) {
              validShopIdsInRadius.push(shopId);

              const localShop = getStore().shops.find(s => s.id === shopId);

              if (!localShop || shopMeta.updatedAt > (localShop.localUpdatedAt || 0)) {
                idsToFetch.push(shopId);
              }
            }
          });

          let updatedShopsList = [...getStore().shops];

          if (idsToFetch.length > 0) {
            console.log(`Syncing ${idsToFetch.length} shops for branch ${branchId}...`);
            const fetchPromises = idsToFetch.map(id => getDoc(doc(db, "shops", id)));
            const snapshots = await Promise.all(fetchPromises);

            snapshots.forEach(snap => {
              if (snap.exists()) {
                const freshShop = {
                  id: snap.id,
                  ...snap.data(),
                  localUpdatedAt: Date.now()
                };

                const existingIndex = updatedShopsList.findIndex(s => s.id === snap.id);
                if (existingIndex !== -1) {
                  updatedShopsList[existingIndex] = freshShop;
                } else {
                  updatedShopsList.push(freshShop);
                }

                // 🔥 THE MAGIC SAUCE: Automatically wipe the product cache for this updated shop!
                // Next time the user opens this shop, it will be forced to download the fresh menu.
                useProductStore.getState().clearShopMenu(snap.id);
              }
            });
          }

          // Clean up old or out-of-range shops
          updatedShopsList = updatedShopsList.filter(shop => validShopIdsInRadius.includes(shop.id));

          // Sort by distance
          updatedShopsList.sort((a, b) => {
            const latA = a.location?.latitude ?? a.location?.lat;
            const lngA = a.location?.longitude ?? a.location?.lng;
            const latB = b.location?.latitude ?? b.location?.lat;
            const lngB = b.location?.longitude ?? b.location?.lng;

            return geofire.distanceBetween([parseFloat(latA), parseFloat(lngA)], userLocation) -
                   geofire.distanceBetween([parseFloat(latB), parseFloat(lngB)], userLocation);
          });

          set({ shops: updatedShopsList, loading: false });

        } catch (error) {
          console.error("Smart sync failed:", error);
          set({ loading: false });
        } finally {
          isFetching = false;
        }
      }
    }),
    {
      name: 'localboys-shop-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ shops: state.shops, lastBranchId: state.lastBranchId }),
    }
  )
);