import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants'; 

const AdminContext = createContext();
export const useAdmin = () => useContext(AdminContext);

const GLOBAL_CONFIG_URL = Constants.expoConfig?.extra?.configUrl; 

const fetchWithNativeCache = async (url, cacheKey, onDataRetrieved) => {
  let cachedDataStr = null;
  try {
    cachedDataStr = await AsyncStorage.getItem(cacheKey);
    if (cachedDataStr) {
      onDataRetrieved(JSON.parse(cachedDataStr));
    }
  } catch (e) {
    console.warn(`Failed to load local config cache for ${cacheKey}`, e);
  }

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (response.ok) {
      const freshData = await response.json();
      const freshDataStr = JSON.stringify(freshData);
      
      if (cachedDataStr === freshDataStr) {
         console.log(`[Cache Hit] Verified with Server ETag for ${cacheKey}.`);
         return; 
      }
      await AsyncStorage.setItem(cacheKey, freshDataStr);
      onDataRetrieved(freshData);
      console.log(`[Cache Miss] Server pushed new config data for ${cacheKey}.`);
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

  const [activeBranchIds, setActiveBranchIds] = useState([]);
  const activeBranchIdsRef = useRef([]); 

  const [branchConfigs, setBranchConfigs] = useState({});
  const [branchCoupons, setBranchCoupons] = useState({});

  useEffect(() => {
    const initGlobalConfig = async () => {
      if (!GLOBAL_CONFIG_URL) {
        setLoading(false);
        return;
      }
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

  const getDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  }, []);

  const determineBranches = useCallback(async (userLat, userLng, userPincode) => {
    if (!allBranches.length || !userLat || !userLng) return [];

    let matchedBranches = [];

    if (userPincode) {
      const searchPin = String(userPincode).trim();
      matchedBranches = allBranches.filter(b => {
        const pins = b.serviceable_pincodes || [];
        return pins.map(p => String(p).trim()).includes(searchPin);
      });
    }

    if (matchedBranches.length === 0) {
      let closestBranch = null;
      let minDistance = Infinity;
      allBranches.forEach((branch) => {
        if (branch.lat && branch.lng) {
          const dist = getDistance(parseFloat(userLat), parseFloat(userLng), parseFloat(branch.lat), parseFloat(branch.lng));
          if (dist < minDistance) { minDistance = dist; closestBranch = branch; }
        }
      });
      if (closestBranch) {
        const branchRadius = closestBranch.radius || 15;
        if (minDistance <= branchRadius) { matchedBranches = [closestBranch]; }
      }
    }

    const newBranchIds = matchedBranches.map(b => b.id).sort();
    
    if (JSON.stringify(activeBranchIdsRef.current) !== JSON.stringify(newBranchIds)) {
      activeBranchIdsRef.current = newBranchIds;
      setActiveBranchIds(newBranchIds);
      
      if (newBranchIds.length === 0) {
          setBranchConfigs({});
          setBranchCoupons({});
          return [];
      }

      await Promise.all(matchedBranches.map(async (branch) => {
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
      }));
    }
    
    return newBranchIds; // 🔥 NEW: Explicitly return the matched array
  }, [allBranches, getDistance]); 

  const applyBranchSpecifics = (branchId, data, radius) => {
    setBranchConfigs(prev => ({
      ...prev,
      [branchId]: {
        deliveryChargePerKm: data.deliveryChargePerKm || 5,
        shopVisibilityRadiusKm: radius,
        minOrderValue: data.minOrderValue || 100,
        maintenanceMode: data.maintenanceMode || false,
        qr: data.qr || null,
        qrId: data.qrId || null,
        shortsUrls: data.shortsUrls || [] 
      }
    }));
    
    setBranchCoupons(prev => ({ ...prev, [branchId]: data.coupons || {} }));
    setHeaderAnimationUrl((prev) => {
        if (!prev && data.cityAnimationUrl) return data.cityAnimationUrl;
        return prev;
    });
  };

  return (
    <AdminContext.Provider value={{
      loading, categoryMeta, eventUrl, headerAnimationUrl, appVersion, allBranches,
      activeBranchIds, branchConfigs, branchCoupons, determineBranches
    }}>
      {children}
    </AdminContext.Provider>
  );
};