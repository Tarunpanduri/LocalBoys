import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { collection, query, orderBy, startAt, endAt, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; 
import * as geofire from 'geofire-common';

const ShopContext = createContext();

export const ShopProvider = ({ children }) => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Store active listeners to unsubscribe later
  const activeListeners = useRef([]);
  // Store the raw map of shops across all bounds so we don't lose them between renders
  const tempShopsMap = useRef({});

  const fetchNearbyShops = useCallback((centerLat, centerLng, radiusInKm) => {
    if (!centerLat || !centerLng) return;

    // 1. Clear previous listeners to avoid memory leaks or duplicate data
    activeListeners.current.forEach((unsubscribe) => unsubscribe());
    activeListeners.current = [];
    tempShopsMap.current = {}; // Reset the map

    setLoading(true);

    const center = [parseFloat(centerLat), parseFloat(centerLng)];
    const radiusInM = radiusInKm * 1000;
    
    // Generate GeoHash boundaries
    const bounds = geofire.geohashQueryBounds(center, radiusInM);

    // Helper to process updates
    const updateState = () => {
      const allShops = Object.values(tempShopsMap.current);
      
      // Filter by strict distance radius using Native Firestore GeoPoints
      const filtered = allShops.filter(shop => {
        if (!shop.location) return false;

        // 🔥 Safely handle native GeoPoints OR fallback objects 🔥
        const shopLat = shop.location.latitude ?? shop.location.lat;
        const shopLng = shop.location.longitude ?? shop.location.lng;

        if (shopLat === undefined || shopLng === undefined) return false;

        const distanceInKm = geofire.distanceBetween([parseFloat(shopLat), parseFloat(shopLng)], center);
        return distanceInKm <= radiusInKm;
      });

      // Sort closest to furthest
      filtered.sort((a, b) => {
        const latA = a.location?.latitude ?? a.location?.lat;
        const lngA = a.location?.longitude ?? a.location?.lng;
        const latB = b.location?.latitude ?? b.location?.lat;
        const lngB = b.location?.longitude ?? b.location?.lng;

        const distA = geofire.distanceBetween([parseFloat(latA), parseFloat(lngA)], center);
        const distB = geofire.distanceBetween([parseFloat(latB), parseFloat(lngB)], center);
        return distA - distB;
      });

      setShops(filtered);
      setLoading(false);
    };

    // 2. Set up Real-time Listeners for each Geohash Bound in Firestore
    bounds.forEach((b) => {
      const q = query(
        collection(db, 'shops'), // Firestore syntax
        orderBy('geohash'),      // Firestore syntax
        startAt(b[0]),
        endAt(b[1])
      );

      // Firestore Real-Time Listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Track changes efficiently
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            delete tempShopsMap.current[change.doc.id];
          } else {
            tempShopsMap.current[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
          }
        });
        
        // Update the UI state
        updateState();
      }, (error) => {
         console.error("GeoFirestore Error:", error);
         setLoading(false);
      });

      // Store the unsubscribe function
      activeListeners.current.push(unsubscribe);
    });

  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeListeners.current.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return (
    <ShopContext.Provider value={{ shops, loading, fetchNearbyShops }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShops = () => useContext(ShopContext);