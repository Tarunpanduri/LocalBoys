import React, { useEffect, useState, useRef, useMemo } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  TextInput, Image, StatusBar, Platform, Modal, 
  FlatList, Animated, Dimensions 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Clipboard from 'expo-clipboard';

// 🔥 NATIVE FIREBASE MODULAR IMPORTS 🔥
import { db, auth, functions } from "../firebase";
import { doc, getDoc } from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";

import Toast from "react-native-root-toast";
import { LinearGradient } from "expo-linear-gradient";

// --- GORHOM BOTTOM SHEET & GESTURE IMPORTS ---
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView, ScrollView as GHScrollView } from "react-native-gesture-handler";

// --- IMPORT CONTEXTS & STORES ---
import { useUser } from "../context/UserContext";
import { useAdmin } from "../context/AdminContext";
import { useCoupon } from "../context/CouponContext";
import { useShopStore } from "../store/shopStore"; 
import { useCartStore } from "../store/cartstore"; 
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

// --- UTILS (For Display Purposes Only) ---
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const calculateCommission = (subtotal, shopCommission, isPremiumOrder = false) => {
  if (isPremiumOrder) return Math.ceil(subtotal * 0.00001);
  return Math.ceil(subtotal * (shopCommission / 100));
};

// --- SKELETON COMPONENT ---
const SkeletonItem = ({ width, height, style, borderRadius = 4, baseColor, highlightColor }) => {
  const translateX = useRef(new Animated.Value(-width)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(translateX, { toValue: width, duration: 1000, useNativeDriver: true })).start();
  }, [width]);
  return (
    <View style={[{ width, height, backgroundColor: baseColor, borderRadius, overflow: "hidden" }, style]}>
      <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateX }] }}>
        <LinearGradient colors={[baseColor, highlightColor, baseColor]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "100%", height: "100%" }} />
      </Animated.View>
    </View>
  );
};

const CheckoutSkeleton = () => {
  const darkBase = "#1a1a1f", darkHigh = "#2a2a2f", lightBase = "#f0f0f0", lightHigh = "#ffffff";
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        <View style={{ marginTop: 40, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <SkeletonItem width={120} height={14} baseColor={darkBase} highlightColor={darkHigh} />
            <SkeletonItem width={40} height={14} baseColor={darkBase} highlightColor={darkHigh} />
          </View>
          <View style={{ backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 }}>
            <SkeletonItem width={150} height={18} baseColor="#2a2a2f" highlightColor="#3a3a3f" style={{ marginBottom: 8 }} />
            <SkeletonItem width="90%" height={14} baseColor="#2a2a2f" highlightColor="#3a3a3f" style={{ marginBottom: 6 }} />
            <SkeletonItem width="60%" height={14} baseColor="#2a2a2f" highlightColor="#3a3a3f" />
          </View>
        </View>
        <View style={[styles.skeletonBottomSheet, { height: height * 0.65, justifyContent: 'flex-start' }]}>
          <View style={{ padding: 16 }}>
            <SkeletonItem width={100} height={16} baseColor={lightBase} highlightColor={lightHigh} style={{marginBottom: 15}}/>
            {[1, 2].map((i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <View>
                  <SkeletonItem width={140} height={16} baseColor={lightBase} highlightColor={lightHigh} style={{ marginBottom: 6 }} />
                  <SkeletonItem width={50} height={12} baseColor={lightBase} highlightColor={lightHigh} />
                </View>
                <SkeletonItem width={60} height={16} baseColor={lightBase} highlightColor={lightHigh} />
              </View>
            ))}
            <SkeletonItem width="100%" height={45} baseColor={lightBase} highlightColor={lightHigh} style={{ borderRadius: 8, marginVertical: 20 }} />
            <View style={{ backgroundColor: "#f9f9f9", padding: 16, borderRadius: 12 }}>
              <SkeletonItem width={80} height={14} baseColor="#e0e0e0" highlightColor="#f0f0f0" style={{marginBottom: 8}} />
              <SkeletonItem width={100} height={14} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function CheckoutScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  
  // --- BOTTOM SHEET CONFIG ---
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["60%", "92%"], []);
  
  // DROP ADDRESS BOTTOM SHEET REF
  const dropAddressSheetRef = useRef(null);
  const dropSnapPoints = useMemo(() => ["50%", "85%"], []);

  // 🔥 NEW: COUPON BOTTOM SHEET REF 🔥
  const couponSheetRef = useRef(null);

  // --- DESTRUCTURE PARAMS ---
  const { 
    shopId: paramShopId, 
    shop: paramShop,
    cart: paramCart, 
    isBuyNow = false,
    orderType = "delivery" 
  } = route.params || {};

  // --- CONTEXTS & STORES ---
  const { user, userData, mainAddress, loading: userLoading } = useUser();
  const { branchConfigs, activeBranchIds, branchCoupons, allBranches, loading: adminLoading } = useAdmin();
  const { validateCoupon } = useCoupon();
  
  // ZUSTAND
  const shops = useShopStore((state) => state.shops);
  const shopsLoading = useShopStore((state) => state.loading);
  const cartData = useCartStore((state) => state.cartData);
  const clearCart = useCartStore((state) => state.clearCart);

  // --- STATE ---
  const [shopId] = useState(paramShopId);
  const [shop, setShop] = useState(null);
  const [cart, setCart] = useState(null);
  
  // Shared Address State
  const [pickupAddress, setPickupAddress] = useState(null);
  const [dropAddress, setDropAddress] = useState(null);
  const [userAddresses, setUserAddresses] = useState([]);
  
  // CUSTOM MODAL STATE
  const [showChangeAddressModal, setShowChangeAddressModal] = useState(false);

  // Financials
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [platformFee, setPlatformFee] = useState(10);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [restaurantTotal, setRestaurantTotal] = useState(0);
  const [shopCommission, setShopCommission] = useState(15);

  // UI / Logic
  const [couponCode, setCouponCode] = useState("");
  const [paymentMode, setPaymentMode] = useState("COD");
  
  // SCHEDULE ORDER STATE
  const [deliveryPreference, setDeliveryPreference] = useState("now"); 
  const [scheduledDay, setScheduledDay] = useState("Today"); 
  const [scheduledTime, setScheduledTime] = useState(""); 
  const TIME_SLOTS = ["10:00 AM - 12:00 PM", "12:00 PM - 02:00 PM", "02:00 PM - 04:00 PM", "04:00 PM - 06:00 PM", "06:00 PM - 08:00 PM", "08:00 PM - 10:00 PM"];

  const [transactionId, setTransactionId] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);

  // QR Code States
  const [qrImage, setQrImage] = useState("");
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const [qrRetryCount, setQrRetryCount] = useState(0);

  const fallbackFetchedRef = useRef(false);

  // --- BRANCH RESOLUTION LOGIC ---
  const currentBranchId = useMemo(() => {
    if (shop?.parentBranchId) return shop.parentBranchId;
    return activeBranchIds?.[0] || null;
  }, [shop, activeBranchIds]);

  const currentBranchConfig = useMemo(() => {
    return currentBranchId ? (branchConfigs[currentBranchId] || {}) : {};
  }, [currentBranchId, branchConfigs]);

  // Derived Configs
  const isPremiumOrder = subtotal > 10000;
  const deliveryChargePerKm = currentBranchConfig.deliveryChargePerKm || 6;
  const qrIdText = currentBranchConfig.qrId || shop?.qrId || "localboys@upi";

  // 🔥 NEW: EXTRACT AVAILABLE COUPONS FOR THIS SHOP 🔥
  const availableCoupons = useMemo(() => {
    if (!currentBranchId || !branchCoupons || !branchCoupons[currentBranchId]) return [];
    const shopCoupons = branchCoupons[currentBranchId][shopId];
    if (!shopCoupons) return [];
    return Array.isArray(shopCoupons) ? shopCoupons : [shopCoupons];
  }, [branchCoupons, currentBranchId, shopId]);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (userLoading || shopsLoading || adminLoading || !shopId) return;

    if (paramShop && Object.keys(paramShop).length > 0) {
      setShop(paramShop);
      setShopCommission(Number(paramShop.commission) || 15);
    } 
    else {
      const foundShop = shops.find(s => s.id === shopId);
      if (foundShop) {
        setShop(foundShop);
        setShopCommission(Number(foundShop.commission) || 15);
      } 
      else if (!fallbackFetchedRef.current) { 
        fallbackFetchedRef.current = true;
        getDoc(doc(db, "shops", shopId)).then(snap => {
          if(snap.exists) {
            const val = snap.data();
            setShop({ id: shopId, ...val });
            setShopCommission(Number(val.commission) || 15);
          }
        }).catch(err => {
            console.error("Error fetching shop fallback:", err);
            fallbackFetchedRef.current = false; 
        });
      }
    }

    if (userData?.addresses) {
      const addrList = Object.keys(userData.addresses).map(key => ({
        id: key, ...userData.addresses[key]
      }));
      setUserAddresses(addrList);
    }

    if (orderType === "parcel") {
      if (mainAddress) {
        setPickupAddress({ id: userData.mainAddressId, ...mainAddress });
      } else if (userData?.addresses) {
        const firstId = Object.keys(userData.addresses)[0];
        setPickupAddress({ id: firstId, ...userData.addresses[firstId]});
      }
    }

    if (cartData && cartData[shopId]) {
      const cleanCart = {};
      const val = cartData[shopId];
      Object.keys(val).forEach(k => {
        if (val[k]?.price) cleanCart[k] = val[k];
      });
      setCart(cleanCart);
      setLoadingCart(false);
    } 
    else if (paramCart) {
      const cleanCart = {};
      Object.keys(paramCart).forEach(k => {
        if (paramCart[k]?.price) cleanCart[k] = paramCart[k];
      });
      setCart(cleanCart);
      setLoadingCart(false);
    } 
    else {
       setCart({});
       setLoadingCart(false);
    }
  }, [userLoading, shopsLoading, adminLoading, shopId, paramCart, cartData, shops, paramShop, userData, mainAddress, orderType]);

  // Sync Dynamic QR Image safely
  useEffect(() => {
    if (shop?.qr || currentBranchConfig?.qr) {
      setQrImage(shop?.qr || currentBranchConfig?.qr);
    }
  }, [shop, currentBranchConfig]);

  // --- 2. CALCULATE TOTALS ---
  useEffect(() => {
    if (!cart || !shop) return;

    const calcSubtotal = Object.keys(cart)
      .filter(k => k.startsWith("productId"))
      .reduce((sum, pid) => sum + cart[pid].price * cart[pid].qty, 0);
    setSubtotal(calcSubtotal);

    const calcPlatFee = calcSubtotal > 10000 ? Math.ceil(calcSubtotal * 0.00001) : 10;
    setPlatformFee(calcPlatFee);

    let calcDeliveryFee = 0;
    
    if (orderType === "parcel" && pickupAddress && dropAddress) {
      const pLat = Number(pickupAddress.lat ?? pickupAddress.location?.latitude);
      const pLng = Number(pickupAddress.lng ?? pickupAddress.location?.longitude);
      const dLat = Number(dropAddress.lat ?? dropAddress.location?.latitude);
      const dLng = Number(dropAddress.lng ?? dropAddress.location?.longitude);
      
      if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng)) {
        const distanceKm = getDistanceInKm(pLat, pLng, dLat, dLng) * 1.3;
        const fee = (calcSubtotal > 10000) ? 0 : 20 + distanceKm * deliveryChargePerKm;
        calcDeliveryFee = Math.ceil(fee);
      }
    } 
    else if (orderType === "delivery" && mainAddress && shop.location) {
      const uLat = Number(mainAddress.lat ?? mainAddress.location?.latitude);
      const uLng = Number(mainAddress.lng ?? mainAddress.location?.longitude);
      const sLat = Number(shop.location.latitude ?? shop.location.lat);
      const sLng = Number(shop.location.longitude ?? shop.location.lng);

      if (!isNaN(uLat) && !isNaN(uLng) && !isNaN(sLat) && !isNaN(sLng)) {
        const distanceKm = getDistanceInKm(sLat, sLng, uLat, uLng) * 1.3;
        const baseFee = 20;
        const fee = (calcSubtotal > 10000) ? 0 : baseFee + distanceKm * deliveryChargePerKm;
        calcDeliveryFee = Math.ceil(fee);
      }
    }

    setDeliveryFee(calcDeliveryFee);
    setTotal(calcSubtotal - discount + calcDeliveryFee + calcPlatFee);

    const commissionAmount = calculateCommission(calcSubtotal, shopCommission, calcSubtotal > 10000);
    setRestaurantTotal(Math.ceil(calcSubtotal - commissionAmount));

  }, [cart, shop, mainAddress, pickupAddress, dropAddress, discount, deliveryChargePerKm, shopCommission, orderType]);

  // --- 3. HANDLERS ---
  // 🔥 UPDATED: Now supports applying via button OR bottom sheet string 🔥
  const applyCouponHandler = async (overrideCode) => {
    // If it's a string, use it. Otherwise, use the state (from the text input)
    const codeToUse = typeof overrideCode === 'string' ? overrideCode : couponCode;
    
    if (!codeToUse.trim()) {
      Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
      return;
    }
    try {
      const discountValue = await validateCoupon(shopId, codeToUse, subtotal);
      setDiscount(discountValue);
      setCouponCode(codeToUse); // Instantly fill the input if it came from the sheet
      Toast.show(`Discount applied: ₹${discountValue}`, { duration: Toast.durations.SHORT });
    } catch (error) {
      Toast.show(error || "Invalid coupon", { duration: Toast.durations.SHORT });
      setDiscount(0);
    }
  };

  const handleSelectDropAddress = (address) => {
    setDropAddress(address);
    dropAddressSheetRef.current?.close(); 
  };

  const handleChangePrimaryAddress = () => {
    setShowChangeAddressModal(true);
  };

  const confirmChangePrimaryAddress = () => {
    setShowChangeAddressModal(false);
    navigation.navigate("HomeScreen", { openAddressSheet: true, timestamp: Date.now() });
  };

  const copyQrIdToClipboard = async () => {
    await Clipboard.setStringAsync(qrIdText);
    Toast.show("QR ID Copied to clipboard!", { duration: Toast.durations.SHORT });
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Toast.show("Please login to place order", { duration: Toast.durations.SHORT });
      return;
    }
    
    if (orderType === "delivery" && !mainAddress) {
      Toast.show("Please add a delivery address", { duration: Toast.durations.SHORT });
      handleChangePrimaryAddress();
      return;
    }
    if (orderType === "parcel" && !dropAddress) {
      Toast.show("Please select a drop address", { duration: Toast.durations.SHORT });
      return;
    }

    if (deliveryPreference === "schedule" && !scheduledTime) {
      Toast.show("Please select a time slot for your scheduled order.", { duration: Toast.durations.SHORT });
      return;
    }

    if (paymentMode === "Online" && !transactionId.trim()) {
      Toast.show("Enter transaction ID", { duration: Toast.durations.SHORT });
      return;
    }

    try {
      setPlacingOrder(true);

      const cleanItems = {};
      Object.keys(cart).filter(k => k.startsWith("productId")).forEach(pid => {
         cleanItems[pid] = { 
           id: pid,
           qty: cart[pid].qty,
           price: cart[pid].price,
           productname: cart[pid].productname,
           image: cart[pid].image || "",
           serviceType: cart[pid].serviceType || "delivery"
         };
      });

      let deliveryAddressData = null;
      let parcelPickupData = null;
      let parcelDropData = null;

      if (orderType === "parcel") {
        parcelPickupData = {
          ...pickupAddress,
          customerName: userData?.name || userData?.firstName || "Customer",
          customerPhone: userData?.mobile || "",
          lat: Number(pickupAddress.lat ?? pickupAddress.location?.latitude ?? 0),
          lng: Number(pickupAddress.lng ?? pickupAddress.location?.longitude ?? 0)
        };
        parcelDropData = {
          ...dropAddress,
          lat: Number(dropAddress.lat ?? dropAddress.location?.latitude ?? 0),
          lng: Number(dropAddress.lng ?? dropAddress.location?.longitude ?? 0)
        };
      } else {
        deliveryAddressData = {
          ...mainAddress,
          lat: Number(mainAddress.lat ?? mainAddress.location?.latitude ?? 0),
          lng: Number(mainAddress.lng ?? mainAddress.location?.longitude ?? 0)
        };
      }

      const branchConfigUrl = allBranches.find(b => b.id === currentBranchId)?.configUrl || null;

      const securePayload = {
        shopId: shopId,
        orderType: orderType,
        items: cleanItems,
        couponCode: couponCode.trim() || null,
        paymentMode: paymentMode,
        transactionId: paymentMode === "Online" ? transactionId.trim() : null,
        
        isScheduled: deliveryPreference === "schedule",
        scheduledAt: deliveryPreference === "schedule" ? `${scheduledDay}, ${scheduledTime}` : null,
        
        activeBranchId: currentBranchId,
        branchConfigUrl: branchConfigUrl, 
        
        expoPushToken: userData?.expoPushToken || null,
        customerName: userData?.name || userData?.firstName || "Customer",
        customerPhone: userData?.mobile || "",
        
        deliveryAddress: deliveryAddressData,
        parcelPickup: parcelPickupData,
        parcelDrop: parcelDropData,
      };

      const createSecureOrder = httpsCallable(functions, 'createSecureOrder');
      const response = await createSecureOrder(securePayload);
      
      const newOrderId = response.data.orderId;
      const summary = response.data.orderSummary;

      if (!isBuyNow) {
        await clearCart();  
      } 

      navigation.replace("OrderConfirmation", { 
        orderData: { 
          order: { id: newOrderId, ...summary }, 
          message: deliveryPreference === "schedule" ? "Scheduled order placed successfully" : (orderType === "parcel" ? "Parcel order placed successfully" : "Order placed successfully")
        } 
      });

    } catch (e) {
      console.error("Order Placement Error:", e);
      Toast.show("Failed to place order. Check your internet connection.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderAddressItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.addressItem, dropAddress?.id === item.id && styles.selectedAddressItem]} 
      onPress={() => handleSelectDropAddress(item)}
    >
      <Text style={styles.addressItemName}>{item.name}</Text>
      <Text style={styles.addressItemText}>{item.formattedAddress}</Text>
      <Text style={styles.addressItemSub}>{item.city}, {item.state} - {item.pincode}</Text>
      {dropAddress?.id === item.id && <Text style={styles.selectedText}>Selected</Text>}
    </TouchableOpacity>
  );

  const getQrUri = () => {
    if (!qrImage) return null;
    return `${qrImage}?retry=${qrRetryCount}`;
  };

  if (userLoading || loadingCart) return <CheckoutSkeleton />;

  if (!cart || Object.keys(cart).length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>No items in cart.</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back to Shop</Text>
      </TouchableOpacity>
    </View>
  );

  const products = Object.keys(cart).filter(k => k.startsWith("productId")).map(pid => cart[pid]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0e0e12" }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          
          <GHScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
            {orderType === "parcel" ? (
              <>
                {/* Parcel: Pickup Address */}
                <View style={[styles.section, { marginTop: 15 }]}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>PICKUP ADDRESS</Text>
                    <TouchableOpacity onPress={handleChangePrimaryAddress}>
                      <Text style={styles.editText}>EDIT</Text>
                    </TouchableOpacity>
                  </View>
                  {pickupAddress ? (
                    <View style={styles.addressBox}>
                      <Text style={styles.username}>{pickupAddress.name}</Text>
                      <Text style={styles.addressText}>{pickupAddress.formattedAddress}</Text>
                      <Text style={styles.addressSub}>{pickupAddress.city}, {pickupAddress.state} - {pickupAddress.pincode}</Text>
                    </View>
                  ) : <Text style={styles.emptyText}>No pickup address found</Text>}
                </View>

                {/* Parcel: Drop Address */}
                <View style={styles.section}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.sectionTitle, { marginBottom: 5, marginTop: 20 }]}>DROP ADDRESS</Text>
                    <TouchableOpacity onPress={() => dropAddressSheetRef.current?.expand()}>
                      <Text style={styles.editText}>SELECT</Text>
                    </TouchableOpacity>
                  </View>
                  {dropAddress ? (
                    <View style={styles.addressBox}>
                      <Text style={styles.username}>{dropAddress.name}</Text>
                      <Text style={styles.addressText}>{dropAddress.formattedAddress}</Text>
                      <Text style={styles.addressSub}>{dropAddress.city}, {dropAddress.state} - {dropAddress.pincode}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.selectAddressButton} onPress={() => dropAddressSheetRef.current?.expand()}>
                      <Text style={styles.selectAddressText}>+ Select Drop Address</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              /* Delivery: Single Address */
              <View style={[styles.section, { marginTop: 40 }]}>
                <View style={styles.headerRow}>
                  <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
                  <TouchableOpacity onPress={handleChangePrimaryAddress}>
                    <Text style={styles.editText}>CHANGE</Text>
                  </TouchableOpacity>
                </View>
                {mainAddress ? (
                  <View style={styles.addressBox}>
                    <Text style={styles.username}>{mainAddress.name || userData?.firstName}</Text>
                    <Text style={styles.addressText}>{mainAddress.formattedAddress}</Text>
                    <Text style={styles.addressSub}>
                      {mainAddress.city}, {mainAddress.state} - {mainAddress.pincode}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleChangePrimaryAddress} style={styles.noAddressBox}>
                     <Text style={styles.emptyText}>+ Add Delivery Address</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </GHScrollView>

          {/* GORHOM BOTTOM SHEET (Main Items) */}
          <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
          >
            <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
              {isPremiumOrder && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>🎉 PREMIUM ORDER - Free Delivery & Low Platform Fee</Text>
                </View>
              )}

              <View style={styles.section}>
                <View style={styles.headerRowtwo}>
                  <Text style={[styles.sectionTitletwo, { color: "black", fontSize: 14 }]}>YOUR ITEMS</Text>
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.editText}>EDIT ITEMS</Text>
                  </TouchableOpacity>
                </View>
                {products.map((item, idx) => (
                  <View key={idx} style={styles.itemCard}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.productname}</Text>
                      <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                    </View>
                    <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.sectiontwo}>
                {/* 🔥 NEW: VIEW OFFERS HEADER 🔥 */}
                <View style={styles.headerRowtwo}>
                  <Text style={[styles.sectionTitletwo, { color: 'black', fontSize: 14 }]}>COUPON</Text>
                  <TouchableOpacity onPress={() => couponSheetRef.current?.expand()}>
                    <Text style={styles.editText}>VIEW OFFERS</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.couponRow}>
                  <TextInput
                    style={styles.couponInput}
                    placeholder="Enter code"
                    placeholderTextColor="#aaa"
                    value={couponCode}
                    onChangeText={setCouponCode}
                  />
                  <TouchableOpacity style={styles.applyBtn} onPress={applyCouponHandler}>
                    <Text style={styles.applyText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>₹{Math.ceil(subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountText]}>-₹{Math.ceil(discount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Platform Fee</Text>
                  <View style={styles.feeContainer}>
                    {isPremiumOrder && <Text style={styles.premiumFeeNote}>(0.001%)</Text>}
                    <Text style={styles.summaryValue}>₹{platformFee}</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <View style={styles.feeContainer}>
                    {isPremiumOrder && <Text style={styles.freeDeliveryNote}>FREE</Text>}
                    <Text style={styles.summaryValue}>{isPremiumOrder ? "₹0" : `₹${Math.ceil(deliveryFee)}`}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalText}>TOTAL</Text>
                  <Text style={styles.totalValue}>₹{Math.ceil(total)}</Text>
                </View>
              </View>

              {/* SCHEDULE PREFERENCE UI */}
              <View style={[styles.sectiontwo, { marginTop: 10, marginBottom: 10 }]}>
                <Text style={[styles.sectionTitletwo, { color: 'black', fontSize: 14 }]}>DELIVERY TIME</Text>
                <View style={styles.paymentRow}>
                  <TouchableOpacity
                    style={[styles.modeBtn, deliveryPreference === "now" && styles.activeMode]}
                    onPress={() => setDeliveryPreference("now")}
                  >
                    <Text style={[styles.modeText, deliveryPreference === "now" && styles.activeModeText]}>Deliver Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeBtn, deliveryPreference === "schedule" && styles.activeMode]}
                    onPress={() => setDeliveryPreference("schedule")}
                  >
                    <Text style={[styles.modeText, deliveryPreference === "schedule" && styles.activeModeText]}>Schedule Later</Text>
                  </TouchableOpacity>
                </View>

                {deliveryPreference === "schedule" && (
                  <View style={styles.scheduleContainer}>
                    <Text style={styles.scheduleLabel}>Select Day</Text>
                    <View style={styles.dayRow}>
                      <TouchableOpacity 
                        style={[styles.dayBtn, scheduledDay === "Today" && styles.activeDayBtn]} 
                        onPress={() => { setScheduledDay("Today"); setScheduledTime(""); }}
                      >
                        <Text style={[styles.dayText, scheduledDay === "Today" && styles.activeDayText]}>Today</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.dayBtn, scheduledDay === "Tomorrow" && styles.activeDayBtn]} 
                        onPress={() => { setScheduledDay("Tomorrow"); setScheduledTime(""); }}
                      >
                        <Text style={[styles.dayText, scheduledDay === "Tomorrow" && styles.activeDayText]}>Tomorrow</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.scheduleLabel}>Select Time Slot</Text>
                    <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotScroll}>
                      {TIME_SLOTS.map((slot, index) => (
                        <TouchableOpacity 
                          key={index} 
                          style={[styles.timeSlotBtn, scheduledTime === slot && styles.activeTimeSlotBtn]}
                          onPress={() => setScheduledTime(slot)}
                        >
                          <Text style={[styles.timeSlotText, scheduledTime === slot && styles.activeTimeSlotText]}>{slot}</Text>
                        </TouchableOpacity>
                      ))}
                    </GHScrollView>
                  </View>
                )}
              </View>

              <View style={styles.sectiontwo}>
                <Text style={[styles.sectionTitletwo, { color: 'black', fontSize: 14 }]}>PAYMENT MODE</Text>
                <View style={styles.paymentRow}>
                  <TouchableOpacity
                    style={[styles.modeBtn, paymentMode === "COD" && styles.activeMode]}
                    onPress={() => setPaymentMode("COD")}
                  >
                    <Text style={[styles.modeText, paymentMode === "COD" && styles.activeModeText]}>CASH ON DELIVERY</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeBtn, paymentMode === "Online" && styles.activeMode]}
                    onPress={() => setPaymentMode("Online")}
                  >
                    <Text style={[styles.modeText, paymentMode === "Online" && styles.activeModeText]}>PAY ONLINE</Text>
                  </TouchableOpacity>
                </View>
                
                {paymentMode === "Online" && (
                  <View style={styles.onlineBox}>
                    {qrImage && !qrImageFailed ? (
                      <Image 
                        source={{ uri: getQrUri() }} 
                        style={styles.qrImage} 
                        onError={() => setQrImageFailed(true)}
                      />
                    ) : qrImageFailed ? (
                      <TouchableOpacity 
                        style={[styles.qrImage, styles.qrFallbackBox]} 
                        onPress={() => {
                          setQrImageFailed(false);
                          setQrRetryCount(prev => prev + 1);
                        }}
                      >
                        <Ionicons name="refresh-circle-outline" size={36} color="#666" />
                        <Text style={styles.qrFallbackText}>Tap to reload</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.qrImage, styles.qrFallbackBox]}>
                        <Text style={styles.qrFallbackText}>No QR Available</Text>
                      </View>
                    )}

                    <View style={styles.qrInfoBox}>
                      <Text style={styles.qrIdText}>QR ID: <Text style={{fontWeight: 'bold'}}>{qrIdText}</Text></Text>
                      <TouchableOpacity onPress={copyQrIdToClipboard} style={styles.copyBtn}>
                        <Ionicons name="copy-outline" size={16} color="#009688" />
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={styles.transactionInput}
                      placeholder="Enter Transaction ID"
                      placeholderTextColor="#999"
                      value={transactionId}
                      onChangeText={setTransactionId}
                    />
                    <Text style={styles.qrNote}>Scan the QR to pay, then enter your transaction ID.</Text>
                  </View>
                )}
              </View>
            </BottomSheetScrollView>
          </BottomSheet>

          {/* Sticky Bottom Bar */}
          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>₹{Math.ceil(total)}</Text>
              {isPremiumOrder && (
                <Text style={styles.premiumSavings}>You save ₹{Math.ceil(deliveryFee + (10 - platformFee))} on this order!</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.orderBtn, placingOrder && styles.orderBtnDisabled]}
              onPress={handlePlaceOrder}
              disabled={placingOrder}
            >
              {placingOrder ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.orderText}>PLACE ORDER</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* CUSTOM MODAL: CONFIRM PRIMARY ADDRESS CHANGE */}
          <Modal animationType="fade" transparent={true} visible={showChangeAddressModal} onRequestClose={() => setShowChangeAddressModal(false)}>
            <View style={styles.popupOverlay}>
              <View style={styles.popupContent}>
                <View style={[styles.modalIconContainer, { backgroundColor: '#fff8e1' }]}>
                  <Ionicons name="location-outline" size={36} color="#ffb300" />
                </View>
                <Text style={styles.modalTitleCentered}>Change Address?</Text>
                <Text style={styles.modalMessage}>Are you sure you want to change your primary delivery location? You will be redirected to the home screen.</Text>
                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowChangeAddressModal(false)}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmChangePrimaryAddress}>
                    <Text style={styles.modalConfirmBtnText}>Yes, Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* SHARED DROP ADDRESS BOTTOM SHEET */}
          <BottomSheet
            ref={dropAddressSheetRef}
            index={-1}
            snapPoints={dropSnapPoints}
            enablePanDownToClose={true}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            backdropComponent={(props) => (
              <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
            )}
          >
            <View style={styles.sheetHeaderDrop}>
              <Text style={styles.sheetTitleDrop}>Select Drop Address</Text>
              <TouchableOpacity style={styles.closeBtnDrop} onPress={() => dropAddressSheetRef.current?.close()}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.addressList}>
              {userAddresses.map((item) => (
                <React.Fragment key={item.id}>
                  {renderAddressItem({ item })}
                </React.Fragment>
              ))}
              {userAddresses.length === 0 && (
                <View style={styles.noAddresses}>
                  <Text style={styles.noAddressesText}>No addresses found</Text>
                </View>
              )}
            </BottomSheetScrollView>
          </BottomSheet>

          {/* 🔥 NEW: COUPONS OFFERS BOTTOM SHEET 🔥 */}
          <BottomSheet
            ref={couponSheetRef}
            index={-1}
            snapPoints={["50%", "75%"]}
            enablePanDownToClose={true}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            backdropComponent={(props) => (
              <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
            )}
          >
            <View style={styles.sheetHeaderDrop}>
              <Text style={styles.sheetTitleDrop}>Available Offers</Text>
              <TouchableOpacity style={styles.closeBtnDrop} onPress={() => couponSheetRef.current?.close()}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.addressList}>
              {availableCoupons.filter(c => c.isActive !== false).map((c, idx) => (
                <View key={idx} style={styles.couponOfferCard}>
                  <View style={styles.couponOfferLeft}>
                    <View style={styles.couponCodePill}><Text style={styles.couponCodeText}>{c.code}</Text></View>
                    <Text style={styles.couponOfferDesc}>
                      {c.type === "percentage" ? `Get ${c.discount}% off` : `Flat ₹${c.discount} off`}
                      {c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ""}
                    </Text>
                    {c.minOrder ? <Text style={styles.couponOfferMin}>On orders above ₹{c.minOrder}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.couponOfferApplyBtn} onPress={() => {
                    couponSheetRef.current?.close();
                    applyCouponHandler(c.code);
                  }}>
                    <Text style={styles.couponOfferApplyText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {availableCoupons.filter(c => c.isActive !== false).length === 0 && (
                <View style={styles.noAddresses}>
                  <Ionicons name="ticket-outline" size={40} color="#ddd" style={{ marginBottom: 10 }} />
                  <Text style={styles.noAddressesText}>No coupons available for this shop.</Text>
                </View>
              )}
            </BottomSheetScrollView>
          </BottomSheet>

        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0e0e12" },
  container: { flex: 1, backgroundColor: "#0e0e12", position: "relative" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0e0e12" },
  emptyText: { color: "#aaa", fontSize: 15, fontFamily: "Sen_Regular" },
  section: { marginTop: 0, paddingHorizontal: 16 },
  sectiontwo: { paddingHorizontal: 16, marginTop: 5 },
  sectionTitle: { color: "#fff", fontSize: Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Medium", marginBottom: 10, opacity: 0.9, marginLeft: 3 },
  sectionTitletwo: { color: "#0e0e12", fontSize: Platform.OS === 'ios' ? 10 : 14, fontFamily: "Sen_Medium", marginBottom: 5, opacity: 0.9, marginLeft: 3 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRowtwo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 5 }, 
  editText: { color: "#ff7a00", fontSize: Platform.OS === 'ios' ? 10 : 13, fontFamily: "Sen_Medium" },
  addressBox: { backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 },
  noAddressBox: { backgroundColor: "#1a1a1f", padding: 20, borderRadius: 10, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#555' },
  selectAddressButton: { backgroundColor: "#2a2a2f", padding: 16, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ff7a00", borderStyle: "dashed" }, 
  selectAddressText: { color: "#ff7a00", fontSize: 14, fontFamily: "Sen_Medium" }, 
  username: { color: "#fff", fontSize: Platform.OS === 'ios' ? 12 : 16, fontFamily: "Sen_Bold", marginBottom: 4 },
  addressText: { color: "#fff", fontSize: Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" },
  addressSub: { color: "#888", fontSize: Platform.OS === 'ios' ? 11 : 13, marginTop: 4, fontFamily: "Sen_Regular" },
  
  bottomSheetBackground: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bottomSheetIndicator: { backgroundColor: "#ccc", width: 40, height: 4 },
  skeletonBottomSheet: { position: "absolute", bottom: 0, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },

  // Drop Address Sheet specific styles
  sheetHeaderDrop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eaeaea' },
  sheetTitleDrop: { fontSize: 18, fontFamily: 'Sen_Bold', color: '#111' },
  closeBtnDrop: { padding: 4 },

  premiumBadge: { backgroundColor: "#28a745", padding: 10, alignItems: "center", marginHorizontal: 16, marginTop: 10, borderRadius: 8 },
  premiumBadgeText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 12 },
  itemCard: { backgroundColor: "#f5f5f5", padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  itemInfo: { flex: 1 },
  itemName: { color: "#0e0e12", fontSize: Platform.OS === 'ios' ? 12 : 15, fontFamily: "Sen_Medium" },
  itemQty: { color: "#555", marginTop: 4, fontFamily: "Sen_Regular", fontSize: Platform.OS === 'ios' ? 9 : 13 },
  itemPrice: { color: "#0e0e12", fontWeight: "600", fontSize: Platform.OS === 'ios' ? 12 : 15 },
  couponRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  couponInput: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, color: "#0e0e12", fontFamily: "Sen_Regular",fontSize: Platform.OS === 'ios' ? 12 : 14 },
  applyBtn: { backgroundColor: "#ff7a00", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginLeft: 8 },
  applyText: { color: "#fff", fontFamily: "Sen_Medium",fontSize: Platform.OS === 'ios' ? 10 : 14 },
  summaryCard: { backgroundColor: "#f5f5f5", padding: 16, borderRadius: 12, marginVertical: 10, marginHorizontal: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { color: "#555", fontSize: Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" },
  summaryValue: { color: "#0e0e12", fontSize: Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" },
  discountText: { color: "#28a745" },
  feeContainer: { flexDirection: "row", alignItems: "center" },
  premiumFeeNote: { fontSize: Platform.OS === 'ios' ? 8 : 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Regular" },
  freeDeliveryNote: { fontSize: Platform.OS === 'ios' ? 8 : 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 },
  totalText: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
  totalValue: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
  
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop:2, marginBottom: 10 },
  modeBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4 },
  activeMode: { backgroundColor: "#ff7a00" },
  modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize: Platform.OS === 'ios' ? 10 : 13 },
  activeModeText: { color: "#fff" },
  
  // Schedule UI Styles
  scheduleContainer: { backgroundColor: '#f9f9f9', padding: 14, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  scheduleLabel: { fontSize: 12, fontFamily: 'Sen_Bold', color: '#555', marginBottom: 8, marginTop: 4 },
  dayRow: { flexDirection: 'row', marginBottom: 15 },
  dayBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginHorizontal: 4 },
  activeDayBtn: { borderColor: '#ff7a00', backgroundColor: '#fff3e0' },
  dayText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 13 },
  activeDayText: { color: '#ff7a00', fontFamily: 'Sen_Bold' },
  timeSlotScroll: { paddingBottom: 5, paddingRight: 20 },
  timeSlotBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginRight: 8 },
  activeTimeSlotBtn: { borderColor: '#ff7a00', backgroundColor: '#ff7a00' },
  timeSlotText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 12 },
  activeTimeSlotText: { color: '#fff', fontFamily: 'Sen_Bold' },

  onlineBox: { alignItems: "center", paddingBottom: 20 },
  qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 },
  qrFallbackBox: { justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#ddd", borderStyle: "dashed" },
  qrFallbackText: { color: "#888", marginTop: 4, fontFamily: 'Sen_Medium', fontSize: 12 },
  
  // QR Copy Styles
  qrInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2F1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 15 },
  qrIdText: { color: '#333', fontFamily: 'Sen_Regular', fontSize: 13, marginRight: 10 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#009688' },
  copyBtnText: { color: '#009688', fontFamily: 'Sen_Bold', fontSize: 11, marginLeft: 4 },

  transactionInput: { backgroundColor: "#f0f0f0", color: "#0e0e12", borderRadius: 8, width: "90%", padding: 10, marginBottom: 8, fontFamily: "Sen_Regular", fontSize: Platform.OS === 'ios' ? 12 : 14 },
  qrNote: { fontSize: Platform.OS === 'ios' ? 10 : 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" },
  
  bottomBar: { 
    position: "absolute", 
    bottom: 0, 
    left: 0, 
    right: 0, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    backgroundColor: "#fff", 
    padding: 16, 
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, 
    borderTopWidth: 1, 
    borderTopColor: "#ddd",
    zIndex: 100 
  },
  totalLabel: { color: "#555", fontSize: 12, fontFamily: "Sen_Regular" },
  totalAmount: { color: "#0e0e12", fontSize: 18, fontFamily: "Sen_Bold" },
  premiumSavings: { color: "#28a745", fontSize: Platform.OS === 'ios' ? 8 : 10, fontFamily: "Sen_Regular", marginTop: 2 },
  orderBtn: { backgroundColor: "#ff7a00", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  orderBtnDisabled: { backgroundColor: "#ccc" },
  orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 14 },
  
  addressList: { padding: 16, paddingBottom: 40 }, 
  addressItem: { backgroundColor: "#f9f9f9", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#eee" }, 
  selectedAddressItem: { backgroundColor: "#fff8f0", borderColor: "#ff7a00", borderWidth: 2 }, 
  addressItemName: { fontSize: 16, fontFamily: "Sen_Bold", color: "#0e0e12", marginBottom: 4 }, 
  addressItemText: { fontSize: 14, fontFamily: "Sen_Regular", color: "#333", marginBottom: 2 }, 
  addressItemSub: { fontSize: 12, fontFamily: "Sen_Regular", color: "#666" }, 
  selectedText: { color: "#ff7a00", fontSize: 12, fontFamily: "Sen_Medium", marginTop: 4 }, 
  noAddresses: { padding: 40, alignItems: "center" }, 
  noAddressesText: { color: "#999", fontSize: 16, fontFamily: "Sen_Regular" },

  // CUSTOM MODAL STYLES
  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
  popupContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16, alignSelf: 'center' },
  modalTitleCentered: { fontFamily: 'Sen_Bold', fontSize: 18, color: '#111', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f0f0f0' },
  modalCancelBtnText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 15 },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#ff7a00' },
  modalConfirmBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 15 },

  // 🔥 NEW COUPON STYLES 🔥
  couponOfferCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  couponOfferLeft: { flex: 1, paddingRight: 10 },
  couponCodePill: { backgroundColor: '#fff3e0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8, borderWidth: 1, borderColor: '#ffcc80' },
  couponCodeText: { color: '#ff7a00', fontFamily: 'Sen_Bold', fontSize: 14, letterSpacing: 1 },
  couponOfferDesc: { fontFamily: 'Sen_Medium', fontSize: 14, color: '#333', marginBottom: 4 },
  couponOfferMin: { fontFamily: 'Sen_Regular', fontSize: 12, color: '#777' },
  couponOfferApplyBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  couponOfferApplyText: { color: '#ff7a00', fontFamily: 'Sen_Bold', fontSize: 14 },
});