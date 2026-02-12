import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { ref, query, orderByChild, startAt, endAt, onValue, off } from "firebase/database";
import { db } from "../firebase"; 
import * as geofire from 'geofire-common';

const ShopContext = createContext();

export const ShopProvider = ({ children }) => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Store active listeners to unsubscribe later
  const activeListeners = useRef([]);

  const fetchNearbyShops = useCallback((centerLat, centerLng, radiusInKm) => {
    if (!centerLat || !centerLng) return;

    // 1. Clear previous listeners to avoid memory leaks or duplicate data
    activeListeners.current.forEach((unsubscribe) => unsubscribe());
    activeListeners.current = [];

    setLoading(true);

    const center = [parseFloat(centerLat), parseFloat(centerLng)];
    const radiusInM = radiusInKm * 1000;
    const bounds = geofire.geohashQueryBounds(center, radiusInM);
    
    // Temporary storage for data from different bounds
    let tempShopsMap = {}; 

    // Helper to process updates
    const updateState = () => {
      const allShops = Object.values(tempShopsMap);
      
      // Filter by strict distance radius
      const filtered = allShops.filter(shop => {
        const shopLat = parseFloat(shop.location.lat);
        const shopLng = parseFloat(shop.location.lng);
        const distanceInKm = geofire.distanceBetween([shopLat, shopLng], center);
        return distanceInKm <= radiusInKm;
      });

      // Sort by distance
      filtered.sort((a, b) => {
        const distA = geofire.distanceBetween([a.location.lat, a.location.lng], center);
        const distB = geofire.distanceBetween([b.location.lat, b.location.lng], center);
        return distA - distB;
      });

      setShops(filtered);
      setLoading(false);
    };

    // 2. Set up Real-time Listeners for each Geohash Bound
    bounds.forEach((b) => {
      const q = query(
        ref(db, 'shops'),
        orderByChild('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );

      // USE onValue INSTEAD OF get
      const unsubscribe = onValue(q, (snapshot) => {
        const val = snapshot.val();
        
        if (val) {
          // Add/Update shops in our map
          Object.keys(val).forEach((key) => {
            tempShopsMap[key] = { id: key, ...val[key] };
          });
        } else {
          // Handle case where data might be removed in a specific bound range
          // (This part is tricky in geofire, usually we just update with what exists)
        }
        
        // Update the UI state
        updateState();
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