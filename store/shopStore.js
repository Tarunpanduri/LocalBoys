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
      lastBranchIdsStr: "", // Store as string to compare arrays easily

      // 🔥 HYBRID: Now takes branchIdsArray and branchConfigsMap
      fetchNearbyShops: async (userLat, userLng, branchIdsArray, branchConfigsMap, isPullToRefresh = false) => {
        // Prevent concurrent executions
        if (isFetching) {
          console.log('Fetch already in progress, skipping...');
          return;
        }

        if (!userLat || !userLng || !branchIdsArray || branchIdsArray.length === 0) return;

        const state = getStore();
        const currentIdsStr = [...branchIdsArray].sort().join(',');
        const isNewBranchArea = state.lastBranchIdsStr !== currentIdsStr;
        const forceRefresh = isPullToRefresh || isNewBranchArea;

        // SAFETY LOCK 1: INSTANTLY WIPE OLD SHOPS ON BRANCH AREA CHANGE
        if (forceRefresh) {
          set({ shops: [], loading: true, lastBranchIdsStr: currentIdsStr });
        } else if (state.shops.length === 0) {
          set({ loading: true });
        }

        isFetching = true;
        try {
          const userLocation = [parseFloat(userLat), parseFloat(userLng)];
          let idsToFetch = [];
          let validShopIdsInRadius = [];

          // 🔥 HYBRID: Loop through all assigned branches and merge their indexes
          for (const branchId of branchIdsArray) {
            const indexRef = doc(db, 'branch_indexes', branchId);
            const indexSnap = await getDoc(indexRef);

            if (indexSnap.exists()) {
              const branchIndexData = indexSnap.data();
              // Apply specific branch radius, fallback to 8
              const radiusInKm = branchConfigsMap[branchId]?.shopVisibilityRadiusKm || 8; 

              Object.keys(branchIndexData).forEach(shopId => {
                const shopMeta = branchIndexData[shopId];
                if (!shopMeta.lat || !shopMeta.lng || shopMeta.isActive === false) return;

                // 🔥 THE SAFETY NET: Verify distance physically
                const distanceInKm = geofire.distanceBetween([shopMeta.lat, shopMeta.lng], userLocation);

                if (distanceInKm <= radiusInKm) {
                  if(!validShopIdsInRadius.includes(shopId)) {
                      validShopIdsInRadius.push(shopId);
                  }

                  const localShop = getStore().shops.find(s => s.id === shopId);
                  if (!localShop || shopMeta.updatedAt > (localShop.localUpdatedAt || 0)) {
                    if(!idsToFetch.includes(shopId)) {
                        idsToFetch.push(shopId);
                    }
                  }
                }
              });
            }
          }

          let updatedShopsList = [...getStore().shops];

          if (idsToFetch.length > 0) {
            console.log(`Syncing ${idsToFetch.length} shops across ${branchIdsArray.length} branches...`);
            
            // Chunking promises for safety if arrays get large
            const chunkSize = 10;
            for (let i = 0; i < idsToFetch.length; i += chunkSize) {
                const chunk = idsToFetch.slice(i, i + chunkSize);
                const fetchPromises = chunk.map(id => getDoc(doc(db, "shops", id)));
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
                    useProductStore.getState().clearShopMenu(snap.id);
                  }
                });
            }
          }

          // Clean up old or out-of-range shops
          updatedShopsList = updatedShopsList.filter(shop => validShopIdsInRadius.includes(shop.id));

          // Sort final merged list by distance closest to user
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
      partialize: (state) => ({ shops: state.shops, lastBranchIdsStr: state.lastBranchIdsStr }),
    }
  )
);