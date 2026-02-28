import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, orderBy, startAt, endAt, getDocs } from "firebase/firestore";
import { db } from "../firebase"; 
import * as geofire from 'geofire-common';

export const useShopStore = create(
  persist(
    (set, getStore) => ({
      shops: [],
      loading: false,

      fetchNearbyShops: async (centerLat, centerLng, radiusInKm, isPullToRefresh = false) => {
        if (!centerLat || !centerLng) return;

        // Offline-first: Only show loading if we have zero offline shops or user pulled to refresh
        if (isPullToRefresh || getStore().shops.length === 0) {
          set({ loading: true });
        }

        try {
          const center = [parseFloat(centerLat), parseFloat(centerLng)];
          const radiusInM = radiusInKm * 1000;
          const bounds = geofire.geohashQueryBounds(center, radiusInM);
          
          let tempShopsMap = {}; 

          // 1. One-time fetch of the bounding boxes
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
          
          // 2. Client-side math to filter exact radius
          const filtered = allShops.filter(shop => {
            if (!shop.location) return false;
            
            const shopLat = shop.location.latitude ?? shop.location.lat;
            const shopLng = shop.location.longitude ?? shop.location.lng;
            
            if (shopLat === undefined || shopLng === undefined) return false;
            
            const distanceInKm = geofire.distanceBetween([parseFloat(shopLat), parseFloat(shopLng)], center);
            return distanceInKm <= radiusInKm;
          });

          // 3. Sort closest first
          filtered.sort((a, b) => {
            const latA = a.location?.latitude ?? a.location?.lat;
            const lngA = a.location?.longitude ?? a.location?.lng;
            const latB = b.location?.latitude ?? b.location?.lat;
            const lngB = b.location?.longitude ?? b.location?.lng;
            
            const distA = geofire.distanceBetween([parseFloat(latA), parseFloat(lngA)], center);
            const distB = geofire.distanceBetween([parseFloat(latB), parseFloat(lngB)], center);
            return distA - distB;
          });

          // Update store with fresh data (including their current isActive status)
          set({ shops: filtered, loading: false });

        } catch (error) {
          console.error("Error fetching nearby shops:", error);
          set({ loading: false });
        }
      }
    }),
    {
      name: 'localboys-shop-storage', 
      storage: createJSONStorage(() => AsyncStorage), 
      partialize: (state) => ({ shops: state.shops }), 
    }
  )
);