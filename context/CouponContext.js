import React, { createContext, useContext, useCallback } from 'react';
import { useAdmin } from './AdminContext';

import { auth, db } from '../firebase';
import { doc, getDoc } from '@react-native-firebase/firestore';

const CouponContext = createContext();

export const useCoupon = () => useContext(CouponContext);

export const CouponProvider = ({ children }) => {
  const { branchCoupons } = useAdmin();
  
  const validateCoupon = useCallback(async (shopId, code, subtotal = 0) => {
    if (!branchCoupons || Object.keys(branchCoupons).length === 0) {
      console.log("No coupons loaded in AdminContext.");
      throw "No coupons available in this region";
    }

    let shopCouponsData = null;
    for (const branchId in branchCoupons) {
      if (branchCoupons[branchId] && branchCoupons[branchId][shopId]) {
        shopCouponsData = branchCoupons[branchId][shopId];
        break;
      }
    }

    if (!shopCouponsData) {
      throw "This shop does not have any active coupons.";
    }

    const couponsArray = Array.isArray(shopCouponsData) ? shopCouponsData : [shopCouponsData];
    const enteredCode = code.trim().toUpperCase();

    const matchedCoupon = couponsArray.find(c => c.code && c.code.toUpperCase() === enteredCode);

    if (!matchedCoupon) {
      throw "Invalid coupon code.";
    }

    if (matchedCoupon.isActive === false) {
      throw "This coupon is currently disabled.";
    }

    if (matchedCoupon.expiryDate) {
      const expiry = new Date(matchedCoupon.expiryDate);
      if (new Date() > expiry) {
        throw "This coupon has expired.";
      }
    }

    if (matchedCoupon.minOrder && subtotal < matchedCoupon.minOrder) {
      throw `Add ₹${matchedCoupon.minOrder - subtotal} more to use this coupon.`;
    }

    if (matchedCoupon.usageLimitPerUser && matchedCoupon.usageLimitPerUser > 0) {
      const user = auth.currentUser;
      if (!user) {
        throw "You must be logged in to use this coupon.";
      }

      let timesUsed = 0;

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists) {
          const userData = userSnap.data();
          const usageHistory = userData.couponUsage || {};
          timesUsed = usageHistory[enteredCode] || 0;
        }
      } catch (error) {
        console.warn("Firebase network error while checking coupon:", error);
        throw "Failed to verify coupon. Please check your connection.";
      }

      if (timesUsed >= matchedCoupon.usageLimitPerUser) {
        throw `You have already used this coupon the maximum allowed times (${matchedCoupon.usageLimitPerUser}).`;
      }
    }

    let finalDiscount = 0;
    if (matchedCoupon.type === "percentage") {
      finalDiscount = (subtotal * matchedCoupon.discount) / 100;
      
      if (matchedCoupon.maxDiscount) {
        finalDiscount = Math.min(finalDiscount, matchedCoupon.maxDiscount);
      }
    } else {
      finalDiscount = matchedCoupon.discount;
    }

    finalDiscount = Math.min(finalDiscount, subtotal);

    return Math.ceil(finalDiscount);
    
  }, [branchCoupons]); 

  return (
    <CouponContext.Provider value={{ validateCoupon }}>
      {children}
    </CouponContext.Provider>
  );
};