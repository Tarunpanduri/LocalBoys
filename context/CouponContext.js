import React, { createContext, useContext, useCallback } from 'react';
import { useAdmin } from './AdminContext';

const CouponContext = createContext();

export const useCoupon = () => useContext(CouponContext);

export const CouponProvider = ({ children }) => {
  const { branchCoupons } = useAdmin();
  
  // Upgraded to accept subtotal for percentage math
  const validateCoupon = useCallback((shopId, code, subtotal = 0) => {
    return new Promise((resolve, reject) => {
      
      // 1. Check if the CDN loaded any coupons at all
      if (!branchCoupons || Object.keys(branchCoupons).length === 0) {
        console.log("No coupons loaded in AdminContext.");
        reject("No coupons available in this region");
        return;
      }

      const shopCoupon = branchCoupons[shopId];

      // 2. Check if this specific shop has a coupon
      if (!shopCoupon) {
        reject("This shop does not have any active coupons.");
        return;
      }

      // 3. Check if the code matches (ignores spaces and capitalization)
      if (shopCoupon.code.toUpperCase() !== code.trim().toUpperCase()) {
        reject("Invalid coupon code.");
        return;
      }

      // 4. (Optional) Check Minimum Order Value if you add it to your JSON
      if (shopCoupon.minOrder && subtotal < shopCoupon.minOrder) {
        reject(`Add ₹${shopCoupon.minOrder - subtotal} more to use this coupon.`);
        return;
      }

      // 5. Calculate the actual discount amount
      let finalDiscount = 0;
      if (shopCoupon.type === "percentage") {
        finalDiscount = (subtotal * shopCoupon.discount) / 100;
        
        // Cap the max discount if you specified one in JSON (e.g. "maxDiscount": 100)
        if (shopCoupon.maxDiscount) {
          finalDiscount = Math.min(finalDiscount, shopCoupon.maxDiscount);
        }
      } else {
        // Default to flat amount (your current setup)
        finalDiscount = shopCoupon.discount;
      }

      // 6. Ensure we don't discount more than the actual order cost
      finalDiscount = Math.min(finalDiscount, subtotal);

      resolve(Math.ceil(finalDiscount));
    });
  }, [branchCoupons]); // Updates whenever new config downloads

  return (
    <CouponContext.Provider value={{ validateCoupon }}>
      {children}
    </CouponContext.Provider>
  );
};