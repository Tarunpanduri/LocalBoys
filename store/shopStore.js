import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 🔥 NATIVE MODULAR IMPORTS 🔥
import { db } from "../firebase";
import { doc, getDoc, collection } from '@react-native-firebase/firestore';
import * as geofire from 'geofire-common';

import { useProductStore } from './productStore';

let isFetching = false;

export const useShopStore = create(
  persist(
    (set, getStore) => ({
      shops: [],
      loading: false,
      lastBranchIdsStr: "", 

      fetchNearbyShops: async (userLat, userLng, branchIdsArray, branchConfigsMap, isPullToRefresh = false) => {
        if (isFetching) {
          console.log('Fetch already in progress, skipping...');
          return;
        }

        if (!userLat || !userLng || !branchIdsArray || branchIdsArray.length === 0) return;

        const state = getStore();
        const currentIdsStr = [...branchIdsArray].sort().join(',');
        const isNewBranchArea = state.lastBranchIdsStr !== currentIdsStr;
        const forceRefresh = isPullToRefresh || isNewBranchArea;

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

          for (const branchId of branchIdsArray) {
            // ✅ MODULAR: getDoc(doc(db, ...))
            const indexSnap = await getDoc(doc(db, 'branch_indexes', branchId));

            if (indexSnap.exists) {
              const branchIndexData = indexSnap.data();
              const radiusInKm = branchConfigsMap[branchId]?.shopVisibilityRadiusKm || 8; 

              Object.keys(branchIndexData).forEach(shopId => {
                const shopMeta = branchIndexData[shopId];
                if (!shopMeta.lat || !shopMeta.lng || shopMeta.isActive === false) return;

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
            
            const chunkSize = 10;
            for (let i = 0; i < idsToFetch.length; i += chunkSize) {
                const chunk = idsToFetch.slice(i, i + chunkSize);
                // ✅ MODULAR BATCHED FETCH
                const fetchPromises = chunk.map(id => getDoc(doc(db, "shops", id)));
                const snapshots = await Promise.all(fetchPromises);

                snapshots.forEach(snap => {
                  if (snap.exists) {
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

                    useProductStore.getState().clearShopMenu(snap.id);
                  }
                });
            }
          }

          updatedShopsList = updatedShopsList.filter(shop => validShopIdsInRadius.includes(shop.id));

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