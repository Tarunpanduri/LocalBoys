import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants'; 

const AdminContext = createContext();
export const useAdmin = () => useContext(AdminContext);

// Points to your GLOBAL INDEX file on Firebase Hosting
const GLOBAL_CONFIG_URL = Constants.expoConfig?.extra?.configUrl; 

// =========================================================================
// HOSTED JSON MANAGEMENT (NATIVE OS ETAG CACHE)
// =========================================================================
const fetchWithNativeCache = async (url, cacheKey, onDataRetrieved) => {
  let cachedDataStr = null;

  // 1. INSTANT UI RENDER: Load from AsyncStorage
  try {
    cachedDataStr = await AsyncStorage.getItem(cacheKey);
    if (cachedDataStr) {
      onDataRetrieved(JSON.parse(cachedDataStr));
    }
  } catch (e) {
    console.warn(`Failed to load local config cache for ${cacheKey}`, e);
  }

  // 2. THE NATIVE OS CACHE PING
  try {
    // By using { cache: 'no-cache' }, we force iOS/Android to automatically 
    // send the 'If-None-Match' ETag for us behind the scenes!
    const response = await fetch(url, { cache: 'no-cache' });

    if (response.ok) {
      const freshData = await response.json();
      const freshDataStr = JSON.stringify(freshData);
      
      // THE NATIVE ILLUSION: If Firebase returns 304 Not Modified (0 bytes transferred),
      // the OS intercepts it and hands JS a 200 OK with the local disk cache.
      // We use this exact string check to realize nothing actually changed.
      if (cachedDataStr === freshDataStr) {
         console.log(`[Cache Hit] Verified with Server ETag for ${cacheKey}. Zero bytes downloaded.`);
         return; 
      }

      // Only runs if the server actually sent brand new data
      await AsyncStorage.setItem(cacheKey, freshDataStr);
      onDataRetrieved(freshData);
      console.log(`[Cache Miss] Server pushed new config data for ${cacheKey}. UI Updated.`);
    }
  } catch (err) {
    console.error(`Error fetching hosted config for ${cacheKey}:`, err);
  }
};

export const AdminProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);
  const [categoryMeta, setCategoryMeta] = useState({});
  const [eventUrl, setEventUrl] = useState("");
  const [headerAnimationUrl, setHeaderAnimationUrl] = useState(null);
  const [appVersion, setAppVersion] = useState(null);

  // 🔥 HYBRID UPDATES: Branch Specific State Arrays and Maps
  const [activeBranchIds, setActiveBranchIds] = useState([]);
  const activeBranchIdsRef = useRef([]); 

  // Store configs mapped by branch ID (e.g., { 'branchA': { deliveryCharge... }, 'branchB': { ... } })
  const [branchConfigs, setBranchConfigs] = useState({});
  const [branchCoupons, setBranchCoupons] = useState({});

  // 1. FETCH GLOBAL INDEX ON STARTUP
  useEffect(() => {
    const initGlobalConfig = async () => {
      if (!GLOBAL_CONFIG_URL) {
        setLoading(false);
        return;
      }
      
      // Use our native cache helper
      await fetchWithNativeCache(GLOBAL_CONFIG_URL, 'localboys_global_index', applyGlobalConfig);
      setLoading(false);
    };

    initGlobalConfig();
  }, []);

  const applyGlobalConfig = (data) => {
    if (!data) return;
    setCategoryMeta(data.categories || {});
    setEventUrl(data.eventUrl || "");
    setHeaderAnimationUrl(data.headerAnimationUrl || null); 
    setAppVersion(data.appVersion || {});
    setAllBranches(data.branchIndex || []);
  };

  // Distance Calculator
  const getDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  }, []);

  // 🔥 2. HYBRID: DETERMINE BRANCHES VIA PINCODE -> FALLBACK TO GPS
  const determineBranches = useCallback(async (userLat, userLng, userPincode) => {
    if (!allBranches.length || !userLat || !userLng) return;

    let matchedBranches = [];

    // STEP 1: FAST PINCODE FILTER
    if (userPincode) {
      const searchPin = String(userPincode).trim();
      matchedBranches = allBranches.filter(b => {
        const pins = b.serviceable_pincodes || [];
        return pins.map(p => String(p).trim()).includes(searchPin);
      });
    }

    // STEP 2: DISTANCE FALLBACK (If Pincode not found or user lacks pincode)
    if (matchedBranches.length === 0) {
      let closestBranch = null;
      let minDistance = Infinity;

      allBranches.forEach((branch) => {
        if (branch.lat && branch.lng) {
          const dist = getDistance(parseFloat(userLat), parseFloat(userLng), parseFloat(branch.lat), parseFloat(branch.lng));
          if (dist < minDistance) {
            minDistance = dist;
            closestBranch = branch;
          }
        }
      });

      if (closestBranch) {
        const branchRadius = closestBranch.radius || 15;
        if (minDistance <= branchRadius) {
          matchedBranches = [closestBranch];
        }
      }
    }

    const newBranchIds = matchedBranches.map(b => b.id).sort();
    
    // Only fetch configs if the active branches actually changed
    if (JSON.stringify(activeBranchIdsRef.current) !== JSON.stringify(newBranchIds)) {
      activeBranchIdsRef.current = newBranchIds;
      setActiveBranchIds(newBranchIds);
      
      if (newBranchIds.length === 0) {
          setBranchConfigs({});
          setBranchCoupons({});
          return;
      }

      // Fetch configs for ALL matched branches in parallel
      matchedBranches.forEach(async (branch) => {
        if (branch.configUrl) {
          try {
            await fetchWithNativeCache(
              branch.configUrl, 
              `branch_detail_${branch.id}`, 
              (data) => applyBranchSpecifics(branch.id, data, branch.radius || 15)
            );
          } catch (err) {
            console.error(`Failed to fetch specific config for ${branch.name}`, err);
          }
        }
      });
    }
  }, [allBranches, getDistance]); 

  // Safely sets maps of configs, COUPONS, and QR
  const applyBranchSpecifics = (branchId, data, radius) => {
    setBranchConfigs(prev => ({
      ...prev,
      [branchId]: {
        deliveryChargePerKm: data.deliveryChargePerKm || 5,
        shopVisibilityRadiusKm: radius,
        minOrderValue: data.minOrderValue || 100,
        maintenanceMode: data.maintenanceMode || false,
        qr: data.qr || null,
        qrId: data.qrId || null // 🔥 FIX: Extract and save the qrId from the fetched JSON
      }
    }));
    
    setBranchCoupons(prev => ({
      ...prev,
      [branchId]: data.coupons || {}
    }));

    // Set animation if available
    setHeaderAnimationUrl((prev) => {
        if (!prev && data.cityAnimationUrl) return data.cityAnimationUrl;
        return prev;
    });
  };

  return (
    <AdminContext.Provider value={{
      loading,
      categoryMeta,
      eventUrl,
      headerAnimationUrl,
      appVersion,
      allBranches,
      activeBranchIds, // EXPOSED: Array of IDs
      branchConfigs,   // EXPOSED: Map of Configs
      branchCoupons,
      determineBranches // EXPOSED: New Function signature
    }}>
      {children}
    </AdminContext.Provider>
  );
};