import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants'; 

const AdminContext = createContext();
export const useAdmin = () => useContext(AdminContext);

// Updated to point to your GLOBAL INDEX file
const GLOBAL_CONFIG_URL = Constants.expoConfig?.extra?.configUrl; 

export const AdminProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);
  const [categoryMeta, setCategoryMeta] = useState({});
  const [eventUrl, setEventUrl] = useState("");
  const [headerAnimationUrl, setHeaderAnimationUrl] = useState(null);
  const [appVersion, setAppVersion] = useState(null);

  // Branch Specific State
  const [activeBranchId, setActiveBranchId] = useState(null);
  const activeBranchIdRef = useRef(null); // Prevents infinite loops during fetch

  const [branchConfig, setBranchConfig] = useState({
    deliveryChargePerKm: 5,
    shopVisibilityRadiusKm: 8,
    minOrderValue: 100,
    maintenanceMode: false
  });
  const [branchCoupons, setBranchCoupons] = useState({});

  // 1. FETCH GLOBAL INDEX ON STARTUP
  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        const cachedData = await AsyncStorage.getItem('localboys_global_index');
        if (cachedData) applyGlobalConfig(JSON.parse(cachedData));

        const response = await fetch(GLOBAL_CONFIG_URL, { cache: 'no-store' }); 
        const freshData = await response.json();

        applyGlobalConfig(freshData);
        await AsyncStorage.setItem('localboys_global_index', JSON.stringify(freshData));
      } catch (error) {
        console.error("Admin Config Sync Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalConfig();
  }, []);

  const applyGlobalConfig = (data) => {
    if (!data) return;
    setCategoryMeta(data.categories || {});
    setEventUrl(data.eventUrl || "");
    setHeaderAnimationUrl(data.headerAnimationUrl || null); // Global festival override
    setAppVersion(data.appVersion || {});
    setAllBranches(data.branchIndex || []); // Now loading the lightweight index
  };

  /**
   * Calculates distance between two points using the Haversine formula.
   */
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

  /**
   * 2. DETERMINE BRANCH & FETCH SPECIFIC DETAIL CONFIG
   * Wrapped in useCallback to guarantee stability and prevent infinite loops.
   */
  const determineBranch = useCallback(async (userLat, userLng) => {
    if (!allBranches.length || !userLat || !userLng) return;

    let closestBranch = null;
    let minDistance = Infinity;

    // Run math against the lightweight index
    allBranches.forEach((branch) => {
      if (branch.lat && branch.lng) {
        const dist = getDistance(userLat, userLng, branch.lat, branch.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestBranch = branch;
        }
      }
    });

    if (closestBranch) {
      const branchRadius = closestBranch.radius || 15;

      if (minDistance <= branchRadius) {
        // Use ref to safely check without triggering React re-renders in this function
        if (activeBranchIdRef.current !== closestBranch.id) {
          activeBranchIdRef.current = closestBranch.id;
          setActiveBranchId(closestBranch.id);
          
          try {
            // Check cache for this specific city first
            const cacheKey = `branch_detail_${closestBranch.id}`;
            const cachedCity = await AsyncStorage.getItem(cacheKey);
            
            if (cachedCity) {
              applyBranchConfig(JSON.parse(cachedCity), branchRadius);
            }

            // Fetch heavy config for this specific city
            if (closestBranch.configUrl) {
              const res = await fetch(closestBranch.configUrl, { cache: 'no-store' });
              const detailedData = await res.json();
              
              applyBranchConfig(detailedData, branchRadius);
              await AsyncStorage.setItem(cacheKey, JSON.stringify(detailedData));
            }
          } catch (err) {
            console.error(`Failed to fetch specific config for ${closestBranch.name}`, err);
          }
        }
      } else {
        // User is too far
        activeBranchIdRef.current = null;
        setActiveBranchId(null);
      }
    }
  }, [allBranches, getDistance]); // No volatile state in dependencies = 100% loop proof

  const applyBranchConfig = (data, radius) => {
    setBranchConfig({
      deliveryChargePerKm: data.deliveryChargePerKm || 5,
      shopVisibilityRadiusKm: radius,
      minOrderValue: data.minOrderValue || 100,
      maintenanceMode: data.maintenanceMode || false
    });
    setBranchCoupons(data.coupons || {});

    // Override local animation if city has one AND global is empty
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
      activeBranchId,
      branchConfig,
      branchCoupons,
      determineBranch
    }}>
      {children}
    </AdminContext.Provider>
  );
};