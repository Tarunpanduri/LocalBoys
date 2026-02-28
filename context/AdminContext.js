import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants'; 
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const AdminContext = createContext();
export const useAdmin = () => useContext(AdminContext);

const GLOBAL_CONFIG_URL = Constants.expoConfig?.extra?.configUrl; 

export const AdminProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);
  const [categoryMeta, setCategoryMeta] = useState({});
  const [eventUrl, setEventUrl] = useState("");
  const [headerAnimationUrl, setHeaderAnimationUrl] = useState(null);
  const [appVersion, setAppVersion] = useState(null);

  const [activeBranchId, setActiveBranchId] = useState(null);
  const activeBranchIdRef = useRef(null); 

  const [branchConfig, setBranchConfig] = useState({
    deliveryChargePerKm: 5,
    shopVisibilityRadiusKm: 8,
    minOrderValue: 100,
    maintenanceMode: false
  });
  const [branchCoupons, setBranchCoupons] = useState({});

  useEffect(() => {
    const fetchGlobalConfigAndBranches = async () => {
      try {
        if (GLOBAL_CONFIG_URL) {
          const cachedData = await AsyncStorage.getItem('localboys_global_index');
          if (cachedData) applyGlobalConfig(JSON.parse(cachedData));

          const response = await fetch(GLOBAL_CONFIG_URL, { cache: 'no-store' }); 
          const freshData = await response.json();

          applyGlobalConfig(freshData);
          await AsyncStorage.setItem('localboys_global_index', JSON.stringify(freshData));
        }

        const branchesSnap = await getDocs(collection(db, 'branches'));
        const branchesData = [];
        
        branchesSnap.forEach(doc => {
          const data = doc.data();
          branchesData.push({
            id: doc.id,
            ...data,
            // Extract lat/lng safely from Firestore GeoPoint
            lat: data.location?.latitude ?? data.location?.lat,
            lng: data.location?.longitude ?? data.location?.lng
          });
        });
        
        setAllBranches(branchesData);

      } catch (error) {
        console.error("Admin Config Sync Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalConfigAndBranches();
  }, []);

  const applyGlobalConfig = (data) => {
    if (!data) return;
    setCategoryMeta(data.categories || {});
    setEventUrl(data.eventUrl || "");
    setHeaderAnimationUrl(data.headerAnimationUrl || null); 
    setAppVersion(data.appVersion || {});
  };

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
      const branchRadius = closestBranch.config?.shopVisibilityRadiusKm || 15;

      if (minDistance <= branchRadius) {
        if (activeBranchIdRef.current !== closestBranch.id) {
          activeBranchIdRef.current = closestBranch.id;
          setActiveBranchId(closestBranch.id);
          
          setBranchConfig({
            deliveryChargePerKm: closestBranch.config?.deliveryChargePerKm || 5,
            shopVisibilityRadiusKm: branchRadius,
            minOrderValue: closestBranch.config?.minOrderValue || 100,
            maintenanceMode: closestBranch.config?.maintenanceMode || false
          });
          setBranchCoupons(closestBranch.coupons || {});

          if (closestBranch.config?.cityAnimationUrl && !headerAnimationUrl) {
             setHeaderAnimationUrl(closestBranch.config.cityAnimationUrl);
          }
        }
      } else {
        activeBranchIdRef.current = null;
        setActiveBranchId(null);
      }
    }
  }, [allBranches, getDistance, headerAnimationUrl]);

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