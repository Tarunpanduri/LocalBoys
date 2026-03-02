import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants'; 

const AdminContext = createContext();
export const useAdmin = () => useContext(AdminContext);

// Points to your GLOBAL INDEX file on Firebase Hosting
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
  const activeBranchIdRef = useRef(null); 

  const [branchConfig, setBranchConfig] = useState({
    deliveryChargePerKm: 5,
    shopVisibilityRadiusKm: 8,
    minOrderValue: 100,
    maintenanceMode: false,
    qr: null // <-- Added default qr state
  });
  const [branchCoupons, setBranchCoupons] = useState({});

  // 1. FETCH GLOBAL INDEX ON STARTUP (Zero Firestore Cost)
  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        if (!GLOBAL_CONFIG_URL) return;

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

  // 2. DETERMINE BRANCH & FETCH COUPONS FROM SPECIFIC CONFIG URL
  const determineBranch = useCallback(async (userLat, userLng) => {
    if (!allBranches.length || !userLat || !userLng) return;

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
        if (activeBranchIdRef.current !== closestBranch.id) {
          activeBranchIdRef.current = closestBranch.id;
          setActiveBranchId(closestBranch.id);
          
          try {
            // Fetch heavy config for this specific city (e.g. kkdconfig.json)
            if (closestBranch.configUrl) {
              const res = await fetch(closestBranch.configUrl, { cache: 'no-store' });
              const detailedData = await res.json();
              
              applyBranchConfig(detailedData, branchRadius);
              
              // Cache it so it loads instantly next time
              await AsyncStorage.setItem(`branch_detail_${closestBranch.id}`, JSON.stringify(detailedData));
            } else {
              // Fallback to cache if offline
              const cachedCity = await AsyncStorage.getItem(`branch_detail_${closestBranch.id}`);
              if (cachedCity) applyBranchConfig(JSON.parse(cachedCity), branchRadius);
            }
          } catch (err) {
            console.error(`Failed to fetch specific config for ${closestBranch.name}`, err);
          }
        }
      } else {
        // User is outside delivery zone
        activeBranchIdRef.current = null;
        setActiveBranchId(null);
      }
    }
  }, [allBranches, getDistance]); 

  // Safely sets state, COUPONS, and QR
  const applyBranchConfig = (data, radius) => {
    setBranchConfig({
      deliveryChargePerKm: data.deliveryChargePerKm || 5,
      shopVisibilityRadiusKm: radius,
      minOrderValue: data.minOrderValue || 100,
      maintenanceMode: data.maintenanceMode || false,
      qr: data.qr || null // <-- Maps the QR URL from your JSON
    });
    
    // 🔥 THIS RESTORES YOUR COUPONS! 🔥
    setBranchCoupons(data.coupons || {});

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
      activeBranchId,
      branchConfig,
      branchCoupons,
      determineBranch
    }}>
      {children}
    </AdminContext.Provider>
  );
};