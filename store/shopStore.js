import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { collection, query, orderBy, startAt, endAt, getDocs, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; 
import * as geofire from 'geofire-common';

let statusListeners = {}; 

export const useShopStore = create(
  persist(
    (set, getStore) => ({
      shops: [],
      loading: false,
      realtimeStatuses: {}, 

      fetchNearbyShops: async (centerLat, centerLng, radiusInKm, isPullToRefresh = false) => {
        if (!centerLat || !centerLng) return;

        if (isPullToRefresh || getStore().shops.length === 0) {
          set({ loading: true });
        }

        try {
          const center = [parseFloat(centerLat), parseFloat(centerLng)];
          const radiusInM = radiusInKm * 1000;
          const bounds = geofire.geohashQueryBounds(center, radiusInM);
          
          let tempShopsMap = {}; 

          // 🔥 FIRESTORE QUERIES 🔥
          const promises = bounds.map(b => {
            const q = query(
              collection(db, 'shops'), 
              orderBy('geohash'),      
              startAt(b[0]),
              endAt(b[1])
            );
            return getDocs(q); 
          });

          const snapshots = await Promise.all(promises);

          snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((docSnap) => {
              tempShopsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
            });
          });

          const allShops = Object.values(tempShopsMap);
          
          // 🔥 FIRESTORE GEOPOINT FILTERING 🔥
          const filtered = allShops.filter(shop => {
            if (!shop.location) return false;
            
            // Firestore uses .latitude and .longitude natively
            const shopLat = shop.location.latitude ?? shop.location.lat;
            const shopLng = shop.location.longitude ?? shop.location.lng;
            
            if (shopLat === undefined || shopLng === undefined) return false;
            
            const distanceInKm = geofire.distanceBetween([parseFloat(shopLat), parseFloat(shopLng)], center);
            return distanceInKm <= radiusInKm;
          });

          // Sort closest first
          filtered.sort((a, b) => {
            const latA = a.location?.latitude ?? a.location?.lat;
            const lngA = a.location?.longitude ?? a.location?.lng;
            const latB = b.location?.latitude ?? b.location?.lat;
            const lngB = b.location?.longitude ?? b.location?.lng;
            
            const distA = geofire.distanceBetween([parseFloat(latA), parseFloat(lngA)], center);
            const distB = geofire.distanceBetween([parseFloat(latB), parseFloat(lngB)], center);
            return distA - distB;
          });

          set({ shops: filtered, loading: false });
          getStore().setupStatusListeners();

        } catch (error) {
          console.error("Production Error - fetching nearby shops:", error);
          set({ loading: false });
        }
      },

      setupStatusListeners: () => {
        const { shops } = getStore();

        Object.keys(statusListeners).forEach(shopId => {
           statusListeners[shopId](); 
        });
        statusListeners = {};

        shops.forEach(shop => {
          // 🔥 FIRESTORE REALTIME LISTENER 🔥
          const unsub = onSnapshot(doc(db, "shops", shop.id), (docSnap) => {
            if (docSnap.exists()) {
              const isActive = docSnap.data().isActive;
              set((state) => ({
                realtimeStatuses: {
                  ...state.realtimeStatuses,
                  [shop.id]: isActive === undefined ? false : isActive
                }
              }));
            }
          });

          statusListeners[shop.id] = unsub;
        });
      }
    }),
    {
      name: 'localboys-shop-storage', 
      storage: createJSONStorage(() => AsyncStorage), 
      partialize: (state) => ({ shops: state.shops }), 
    }
  )
);