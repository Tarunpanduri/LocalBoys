import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get, query, orderByChild, startAt, endAt } from "firebase/database";
import { db } from "../firebase"; 
import * as geofire from 'geofire-common';

export const useShopStore = create(
  persist(
    (set, getStore) => ({
      shops: [],
      loading: false,

      fetchNearbyShops: async (centerLat, centerLng, radiusInKm, isPullToRefresh = false) => {
        if (!centerLat || !centerLng) return;

        // PRODUCTION PATTERN: Stale-While-Revalidate
        // If we already have cached shops, don't show the loading spinner. 
        // Let the user see old shops instantly while we fetch new ones in the background.
        if (isPullToRefresh || getStore().shops.length === 0) {
          set({ loading: true });
        }

        try {
          const center = [parseFloat(centerLat), parseFloat(centerLng)];
          const radiusInM = radiusInKm * 1000;
          const bounds = geofire.geohashQueryBounds(center, radiusInM);
          
          let tempShopsMap = {}; 

          // Fetch all bounds simultaneously using Promise.all for maximum speed
          // CHANGED: Using get() instead of onValue() to eliminate recurring bandwidth costs
          const promises = bounds.map(b => {
            const q = query(
              ref(db, 'shops'),
              orderByChild('geohash'),
              startAt(b[0]),
              endAt(b[1])
            );
            return get(q); 
          });

          const snapshots = await Promise.all(promises);

          snapshots.forEach((snapshot) => {
            const val = snapshot.val();
            if (val) {
              Object.keys(val).forEach((key) => {
                tempShopsMap[key] = { id: key, ...val[key] };
              });
            }
          });

          // Filter by strict distance radius
          const allShops = Object.values(tempShopsMap);
          const filtered = allShops.filter(shop => {
            if (!shop.location?.lat || !shop.location?.lng) return false;
            const shopLat = parseFloat(shop.location.lat);
            const shopLng = parseFloat(shop.location.lng);
            const distanceInKm = geofire.distanceBetween([shopLat, shopLng], center);
            return distanceInKm <= radiusInKm;
          });

          // Sort by closest first
          filtered.sort((a, b) => {
            const distA = geofire.distanceBetween([parseFloat(a.location.lat), parseFloat(a.location.lng)], center);
            const distB = geofire.distanceBetween([parseFloat(b.location.lat), parseFloat(b.location.lng)], center);
            return distA - distB;
          });

          // Silently update the state (Zustand auto-saves this to AsyncStorage!)
          set({ shops: filtered, loading: false });

        } catch (error) {
          console.error("Production Error - fetching nearby shops:", error);
          set({ loading: false });
        }
      },
    }),
    {
      name: 'localboys-shop-storage', // The key used in AsyncStorage
      storage: createJSONStorage(() => AsyncStorage), 
    }
  )
);