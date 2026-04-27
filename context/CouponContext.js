import React, { createContext, useContext, useCallback } from 'react';
import { useAdmin } from './AdminContext';

// 🔥 NEW: Native Firebase Imports to check user usage history 🔥
import { auth, db } from '../firebase';
import { doc, getDoc } from '@react-native-firebase/firestore';

const CouponContext = createContext();

export const useCoupon = () => useContext(CouponContext);

export const CouponProvider = ({ children }) => {
  const { branchCoupons } = useAdmin();
  
  // Upgraded to handle arrays, usage limits, expiry dates, and percentage limits
  const validateCoupon = useCallback(async (shopId, code, subtotal = 0) => {
    // 1. Check if the CDN loaded any coupons at all
    if (!branchCoupons || Object.keys(branchCoupons).length === 0) {
      console.log("No coupons loaded in AdminContext.");
      throw "No coupons available in this region";
    }

    // 🔥 FIX: Search through all active branches to find the shop's coupons 🔥
    let shopCouponsData = null;
    for (const branchId in branchCoupons) {
      if (branchCoupons[branchId] && branchCoupons[branchId][shopId]) {
        shopCouponsData = branchCoupons[branchId][shopId];
        break;
      }
    }

    // 2. Check if this specific shop has coupons
    if (!shopCouponsData) {
      throw "This shop does not have any active coupons.";
    }

    // 3. Normalize data: Support both old JSON (single object) and new JSON (array of objects)
    const couponsArray = Array.isArray(shopCouponsData) ? shopCouponsData : [shopCouponsData];
    const enteredCode = code.trim().toUpperCase();

    // 4. Find the matching coupon
    const matchedCoupon = couponsArray.find(c => c.code && c.code.toUpperCase() === enteredCode);

    if (!matchedCoupon) {
      throw "Invalid coupon code.";
    }

    // 5. Check Active Status
    if (matchedCoupon.isActive === false) {
      throw "This coupon is currently disabled.";
    }

    // 6. Check Expiry Date
    if (matchedCoupon.expiryDate) {
      const expiry = new Date(matchedCoupon.expiryDate);
      if (new Date() > expiry) {
        throw "This coupon has expired.";
      }
    }

    // 7. Check Minimum Order Value
    if (matchedCoupon.minOrder && subtotal < matchedCoupon.minOrder) {
      throw `Add ₹${matchedCoupon.minOrder - subtotal} more to use this coupon.`;
    }

    // 8. 🔥 INDUSTRY LEVEL: Check User Usage Limit 🔥
    if (matchedCoupon.usageLimitPerUser && matchedCoupon.usageLimitPerUser > 0) {
      const user = auth.currentUser;
      if (!user) {
        throw "You must be logged in to use this coupon.";
      }

      let timesUsed = 0;

      try {
        // Fetch the user's specific coupon usage map from their Firestore document
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists) {
          const userData = userSnap.data();
          // We look for a 'couponUsage' map like: { "WELCOMEKKD": 1, "FREEDEL": 3 }
          const usageHistory = userData.couponUsage || {};
          timesUsed = usageHistory[enteredCode] || 0;
        }
      } catch (error) {
        // This only catches ACTUAL network/Firebase crashes now
        console.warn("Firebase network error while checking coupon:", error);
        throw "Failed to verify coupon. Please check your connection.";
      }

      // Check the logic OUTSIDE the try/catch so it gently passes to the Toast in Checkout.js
      if (timesUsed >= matchedCoupon.usageLimitPerUser) {
        throw `You have already used this coupon the maximum allowed times (${matchedCoupon.usageLimitPerUser}).`;
      }
    }

    // 9. Calculate the actual discount amount
    let finalDiscount = 0;
    if (matchedCoupon.type === "percentage") {
      finalDiscount = (subtotal * matchedCoupon.discount) / 100;
      
      // Cap the max discount if specified
      if (matchedCoupon.maxDiscount) {
        finalDiscount = Math.min(finalDiscount, matchedCoupon.maxDiscount);
      }
    } else {
      // Default to flat amount
      finalDiscount = matchedCoupon.discount;
    }

    // 10. Ensure we don't discount more than the actual order subtotal
    finalDiscount = Math.min(finalDiscount, subtotal);

    // Return the calculated value
    return Math.ceil(finalDiscount);
    
  }, [branchCoupons]); // Updates whenever new config downloads

  return (
    <CouponContext.Provider value={{ validateCoupon }}>
      {children}
    </CouponContext.Provider>
  );
};