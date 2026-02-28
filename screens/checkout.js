import React, { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, StatusBar, Platform, Dimensions, Animated, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { db, auth } from "../firebase";
import { ref, get, set, push } from "firebase/database";
import Toast from "react-native-root-toast";
import { LinearGradient } from "expo-linear-gradient";

// --- GORHOM BOTTOM SHEET IMPORTS ---
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// --- IMPORT CONTEXTS & STORES ---
import { useUser } from "../context/UserContext";
import { useAdmin } from "../context/AdminContext";
import { useCoupon } from "../context/CouponContext";
import { useShopStore } from "../store/ShopStore"; // <-- ZUSTAND
import { useCartStore } from "../store/cartstore"; // <-- ZUSTAND

const { width, height } = Dimensions.get("window");

// --- UTILS ---
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
  const snapPoints = useMemo(() => ["72%", "92%"], []);
  
  // --- DESTRUCTURE PARAMS ---
  const { 
    shopId: paramShopId, 
    cart: paramCart, 
    isBuyNow = false 
  } = route.params || {};

  // --- CONTEXTS & STORES ---
  const { user, userData, mainAddress, loading: userLoading } = useUser();
  const { branchConfig, loading: adminLoading } = useAdmin();
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
  const [transactionId, setTransactionId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);

  // Derived
  const isPremiumOrder = subtotal > 10000;
  const deliveryChargePerKm = branchConfig?.deliveryChargePerKm || 5;

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (userLoading || shopsLoading || !shopId) return;

    // A. Set Shop Data
    const foundShop = shops.find(s => s.id === shopId);
    if (foundShop) {
      setShop(foundShop);
      setQrImage(foundShop.qr || "");
      setShopCommission(Number(foundShop.commission) || 15);
    } else {
      get(ref(db, `shops/${shopId}`)).then(snap => {
        if(snap.exists()) {
          const val = snap.val();
          console.warn("Shop data loaded from DB for checkout:", val);
          setShop({ id: shopId, ...val });
          setQrImage(val.qr || "");
          setShopCommission(Number(val.commission) || 15);
        }
      });
    }

    // B. Load Cart (From params for Buy Now, else from Zustand Store)
    if (paramCart) {
      const cleanCart = {};
      Object.keys(paramCart).forEach(k => {
        if (paramCart[k]?.price) cleanCart[k] = paramCart[k];
      });
      setCart(cleanCart);
      setLoadingCart(false);
    } else if (cartData && cartData[shopId]) {
      const cleanCart = {};
      const val = cartData[shopId];
      Object.keys(val).forEach(k => {
        if (val[k]?.price) cleanCart[k] = val[k];
      });
      setCart(cleanCart);
      setLoadingCart(false);
    } else {
        setCart({});
        setLoadingCart(false);
    }
  }, [userLoading, shopsLoading, shopId, paramCart, cartData, shops]);

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
    if (mainAddress && shop.location) {
      const uLat = Number(mainAddress.lat);
      const uLng = Number(mainAddress.lng);
      const sLat = Number(shop.location.lat);
      const sLng = Number(shop.location.lng);

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

  }, [cart, shop, mainAddress, discount, deliveryChargePerKm, shopCommission]);

  // --- 3. HANDLERS ---
  const applyCouponHandler = async () => {
    if (!couponCode.trim()) {
      Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
      return;
    }
    try {
      const discountValue = await validateCoupon(shopId, couponCode);
      setDiscount(discountValue);
      Toast.show(`Discount applied: ₹${discountValue}`, { duration: Toast.durations.SHORT });
    } catch (error) {
      Toast.show(error || "Invalid coupon", { duration: Toast.durations.SHORT });
      setDiscount(0);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Toast.show("Please login to place order", { duration: Toast.durations.SHORT });
      return;
    }
    if (!mainAddress) {
      Toast.show("Please add a delivery address", { duration: Toast.durations.SHORT });
      navigation.navigate("Addresses");
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
         cleanItems[pid] = { ...cart[pid] };
      });

      const orderData = {
        shopId,
        shopname: shop?.name || "Unknown Shop",
        shopimage: shop?.image || "",
        shopphone: shop?.phone || "",
        items: cleanItems,
        subtotal: Math.ceil(subtotal),
        discount: Math.ceil(discount),
        deliveryFee: Math.ceil(deliveryFee),
        platformFee,
        total: Math.ceil(total),
        paymentMode,
        transactionId: paymentMode === "Online" ? transactionId.trim() : null,
        address: mainAddress.formattedAddress,
        userLocation: { 
            lat: mainAddress.lat,
            lng: mainAddress.lng,
            ...mainAddress
        },
        customerName: userData?.firstName || "Customer",
        customerPhone: userData?.mobile || "",
        customerEmail: user.email,
        status: "pending",
        createdAt: Date.now(),
        orderType: "delivery", 
        restaurantPayout: {
          restaurantTotal,
          platformCommission: Math.ceil(subtotal - restaurantTotal),
          netPayout: restaurantTotal,
          calculationBreakdown: {
            subtotal,
            shopCommissionRate: shopCommission / 100,
            isPremiumOrder
          }
        },
        driverPayout: Math.ceil(deliveryFee),
        calculationMetadata: {
          deliveryChargePerKm,
          baseDeliveryFee: 20,
          platformFee,
          isPremiumOrder,
          shopCommission,
          shopLocation: shop?.location
        }
      };

      const newOrderRef = push(ref(db, `orders/${user.uid}`));
      await set(newOrderRef, orderData);
      
      if (!isBuyNow) {
        await clearCart();  
      } 

      navigation.replace("OrderConfirmation", { 
        orderData: { 
          order: { id: newOrderRef.key, ...orderData }, 
          message: "Order placed successfully" 
        } 
      });

    } catch (e) {
      console.error(e);
      Toast.show("Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
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
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
            <View style={[styles.section, { marginTop: 40 }]}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Addresses")}>
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
                <TouchableOpacity onPress={() => navigation.navigate("Addresses")} style={styles.noAddressBox}>
                   <Text style={styles.emptyText}>+ Add Delivery Address</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* GORHOM BOTTOM SHEET */}
          <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.bottomSheetIndicator}
          >
            {/* Scrollable Content inside Bottom Sheet */}
            {/* Notice the paddingBottom here is 120 so content clears the fixed bottom bar */}
            <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
              {isPremiumOrder && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>🎉 PREMIUM ORDER - Free Delivery & Low Platform Fee</Text>
                </View>
              )}

              <View style={styles.section}>
                <View style={styles.headerRow}>
                  <Text style={styles.sectionTitletwo}>YOUR ITEMS</Text>
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
                <Text style={styles.sectionTitletwo}>COUPON</Text>
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

              <View style={styles.sectiontwo}>
                <Text style={styles.sectionTitletwo}>PAYMENT MODE</Text>
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
                    {qrImage ? (
                      <Image source={{ uri: qrImage }} style={styles.qrImage} />
                    ) : (
                      <View style={[styles.qrImage, { justifyContent: "center", alignItems: "center", backgroundColor: "#eee" }]}>
                        <Text style={{ color: "#999" }}>No QR Available</Text>
                      </View>
                    )}
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

          {/* Sticky Bottom Bar - FIXED ABSOLUTELY AT THE BOTTOM OF THE SCREEN */}
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
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectiontwo: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: "#fff", fontSize: Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Medium", marginBottom: 10, opacity: 0.9, marginLeft: 3 },
  sectionTitletwo: { color: "#0e0e12", fontSize: Platform.OS === 'ios' ? 10 : 14, fontFamily: "Sen_Medium", marginBottom: 5, opacity: 0.9, marginLeft: 3 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editText: { color: "#ff7a00", fontSize: Platform.OS === 'ios' ? 10 : 13, fontFamily: "Sen_Medium" },
  addressBox: { backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 },
  noAddressBox: { backgroundColor: "#1a1a1f", padding: 20, borderRadius: 10, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#555' },
  username: { color: "#fff", fontSize: Platform.OS === 'ios' ? 12 : 16, fontFamily: "Sen_Bold", marginBottom: 4 },
  addressText: { color: "#fff", fontSize: Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" },
  addressSub: { color: "#888", fontSize: Platform.OS === 'ios' ? 11 : 13, marginTop: 4, fontFamily: "Sen_Regular" },
  
  // New Bottom Sheet Styles for Gorhom
  bottomSheetBackground: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bottomSheetIndicator: { backgroundColor: "#ccc", width: 40, height: 4 },
  skeletonBottomSheet: { position: "absolute", bottom: 0, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },

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
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop:2, marginBottom: 20 },
  modeBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4 },
  activeMode: { backgroundColor: "#ff7a00" },
  modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize: Platform.OS === 'ios' ? 10 : 13 },
  activeModeText: { color: "#fff" },
  onlineBox: { alignItems: "center", paddingBottom: 20 },
  qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 },
  transactionInput: { backgroundColor: "#f0f0f0", color: "#0e0e12", borderRadius: 8, width: "90%", padding: 10, marginBottom: 8, fontFamily: "Sen_Regular", fontSize: Platform.OS === 'ios' ? 12 : 14 },
  qrNote: { fontSize: Platform.OS === 'ios' ? 10 : 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" },
  
  // FIXED BOTTOM BAR STYLES
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Extra padding for iOS home indicator
    borderTopWidth: 1, 
    borderTopColor: "#ddd",
    zIndex: 100 // High zIndex ensures it overlays the bottom sheet
  },
  totalLabel: { color: "#555", fontSize: 12, fontFamily: "Sen_Regular" },
  totalAmount: { color: "#0e0e12", fontSize: 18, fontFamily: "Sen_Bold" },
  premiumSavings: { color: "#28a745", fontSize: Platform.OS === 'ios' ? 8 : 10, fontFamily: "Sen_Regular", marginTop: 2 },
  orderBtn: { backgroundColor: "#ff7a00", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  orderBtnDisabled: { backgroundColor: "#ccc" },
  orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 14 },
  backButton: { backgroundColor: "#ff7a00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  backButtonText: { color: "#fff", fontFamily: "Sen_Medium", fontSize: 14 },
});