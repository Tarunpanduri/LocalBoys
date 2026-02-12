import React, { createContext, useContext, useState } from 'react';
import { useAdmin } from './AdminContext';

const CouponContext = createContext();

export const useCoupon = () => useContext(CouponContext);

export const CouponProvider = ({ children }) => {
  const { branchCoupons } = useAdmin();
  
  // Function to validate coupon against the active branch data
  // Returns a Promise that resolves with the discount amount
  const validateCoupon = (shopId, code) => {
    return new Promise((resolve, reject) => {
      if (!branchCoupons) {
        reject("No coupons available in this region");
        return;
      }

      // Structure: branches/{branchId}/coupons/{shopId} = { code: "ABC", discount: 50 }
      const shopCoupon = branchCoupons[shopId];

      if (
        shopCoupon && 
        shopCoupon.code && 
        code && 
        shopCoupon.code.toUpperCase() === code.trim().toUpperCase()
      ) {
        resolve(shopCoupon.discount);
      } else {
        reject("Invalid or expired coupon code");
      }
    });
  };

  return (
    <CouponContext.Provider value={{ validateCoupon }}>
      {children}
    </CouponContext.Provider>
  );
};