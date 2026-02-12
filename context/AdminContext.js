import React, { createContext, useState, useEffect, useContext } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

const AdminContext = createContext();

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider = ({ children }) => {
  // Global Admin Data
  const [categories, setCategories] = useState([]);
  const [categoryMeta, setCategoryMeta] = useState({});
  const [eventUrl, setEventUrl] = useState("");
  const [appVersion, setAppVersion] = useState(null);

  // Branch Specific Data
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [branchConfig, setBranchConfig] = useState({
    deliveryChargePerKm: 5, // Default fallback
    shopVisibilityRadiusKm: 8, // Default fallback
    minOrderValue: 100,
    maintenanceMode: false
  });
  const [branchCoupons, setBranchCoupons] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState([]);

  // 1. Fetch Global Data (Categories, Event, Version) & All Branches Snapshot
  useEffect(() => {
    const adminRef = ref(db, 'admin_data');
    const branchesRef = ref(db, 'branches');

    const unsubAdmin = onValue(adminRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategoryMeta(data.categories || {});
        setEventUrl(data.general?.event || ""); // Based on your JSON path
        setAppVersion(data.general?.AppVersion || {});
      }
    });

    const unsubBranches = onValue(branchesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array for easier distance calc
        const branchList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setAllBranches(branchList);
      }
      setLoading(false);
    });

    return () => {
      unsubAdmin();
      unsubBranches();
    };
  }, []);

  // 2. Helper: Haversine Distance Calculation
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // 3. Function to Determine Nearest Branch based on User Location
  const determineBranch = (userLat, userLng) => {
    if (!allBranches.length || !userLat || !userLng) return;

    let closestBranch = null;
    let minDistance = Infinity;

    allBranches.forEach((branch) => {
      if (branch.lat && branch.lng) {
        const dist = getDistance(userLat, userLng, branch.lat, branch.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestBranch = branch;
        }
      }
    });

    // If we found a branch, apply its specific config
    if (closestBranch) {
      // Check if within visibility radius (defined in branch config or default)
      // Note: We use the branch's internal config for the check, or a safe default
      const branchRadius = closestBranch.config?.shopVisibilityRadiusKm || 15;

      if (minDistance <= branchRadius) {
        if (activeBranchId !== closestBranch.id) {
          console.log(`Switched to Branch: ${closestBranch.name} (${minDistance.toFixed(2)}km away)`);
          setActiveBranchId(closestBranch.id);
          setBranchConfig({
            deliveryChargePerKm: closestBranch.config?.deliveryChargePerKm || 5,
            shopVisibilityRadiusKm: closestBranch.config?.shopVisibilityRadiusKm || 8,
            minOrderValue: closestBranch.config?.minOrderValue || 100,
            maintenanceMode: closestBranch.config?.maintenanceMode || false
          });
          setBranchCoupons(closestBranch.coupons || {});
        }
      } else {
        console.log("User is too far from any branch");
        // Optional: Set a "Service Unavailable" state or keep previous
      }
    }
  };

  return (
    <AdminContext.Provider value={{
      loading,
      categoryMeta,
      eventUrl,
      appVersion,
      activeBranchId,
      branchConfig, // Usage: branchConfig.shopVisibilityRadiusKm
      branchCoupons,
      determineBranch // Call this from HomeScreen when user location is found
    }}>
      {children}
    </AdminContext.Provider>
  );
};