import React, { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, StatusBar, Platform, Modal, FlatList, Animated, Dimensions, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { db, auth } from "../firebase";
import { collection, doc, getDoc, addDoc, GeoPoint } from "firebase/firestore";
import Toast from "react-native-root-toast";
import { LinearGradient } from "expo-linear-gradient";

// --- GORHOM BOTTOM SHEET IMPORTS ---
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// --- IMPORT CONTEXTS & STORES ---
import { useUser } from "../context/UserContext";
import { useAdmin } from "../context/AdminContext";
import { useCoupon } from "../context/CouponContext";
import { useShopStore } from "../store/ShopStore"; 
import { useCartStore } from "../store/cartstore"; 

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

// --- SKELETONS ---
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

export default function CheckoutTwoScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // --- BOTTOM SHEET CONFIG ---
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["55%", "92%"], []);
  
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
  
  const [pickupAddress, setPickupAddress] = useState(null);
  const [dropAddress, setDropAddress] = useState(null);
  const [userAddresses, setUserAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);

  const [deliveryFee, setDeliveryFee] = useState(0);
  const [platformFee, setPlatformFee] = useState(10);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [restaurantTotal, setRestaurantTotal] = useState(0);
  const [shopCommission, setShopCommission] = useState(15);

  const [couponCode, setCouponCode] = useState("");
  const [paymentMode, setPaymentMode] = useState("COD");
  const [transactionId, setTransactionId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [loadingCart, setLoadingCart] = useState(true);

  const isPremiumOrder = subtotal > 10000;
  const deliveryChargePerKm = branchConfig?.deliveryChargePerKm || 5;

  // --- LOAD DATA ---
  useEffect(() => {
    if (userLoading || shopsLoading || !shopId) return;

    // A. Set Shop Data
    const foundShop = shops.find(s => s.id === shopId);
    if (foundShop) {
      setShop(foundShop);
      setQrImage(foundShop.qr || "");
      setShopCommission(Number(foundShop.commission) || 15);
    } else {
      // 🔥 FIRESTORE FALLBACK FETCH 🔥
      getDoc(doc(db, "shops", shopId)).then(snap => {
        if(snap.exists()) {
          const val = snap.data();
          setShop({ id: shopId, ...val });
          setQrImage(val.qr || "");
          setShopCommission(Number(val.commission) || 15);
        }
      }).catch(err => console.error("Error fetching shop fallback:", err));
    }

    if (userData?.addresses) {
      const addrList = Object.keys(userData.addresses).map(key => ({
        id: key, ...userData.addresses[key]
      }));
      setUserAddresses(addrList);
    }

    if (mainAddress) {
      setPickupAddress({ id: userData.mainAddressId, ...mainAddress });
    } else if (userData?.addresses) {
      const firstId = Object.keys(userData.addresses)[0];
      setPickupAddress({ id: firstId, ...userData.addresses[firstId]});
    }

    // B. Load Cart
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
  }, [userLoading, shopsLoading, shopId, userData, mainAddress, paramCart, cartData, shops]);

  // --- CALCULATE TOTALS ---
  useEffect(() => {
    if (!cart) return;

    const calcSubtotal = Object.keys(cart)
      .filter(k => k.startsWith("productId"))
      .reduce((sum, pid) => sum + cart[pid].price * cart[pid].qty, 0);
    setSubtotal(calcSubtotal);

    const calcPlatFee = calcSubtotal > 10000 ? Math.ceil(calcSubtotal * 0.00001) : 10;
    setPlatformFee(calcPlatFee);

    let calcDeliveryFee = 0;
    if (pickupAddress && dropAddress) {
      // 🔥 Extract GeoPoints securely 🔥
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
    setDeliveryFee(calcDeliveryFee);

    const calcTotal = calcSubtotal - discount + calcDeliveryFee + calcPlatFee;
    setTotal(calcTotal);

    const commissionAmount = calculateCommission(calcSubtotal, shopCommission, calcSubtotal > 10000);
    setRestaurantTotal(Math.ceil(calcSubtotal - commissionAmount));

  }, [cart, pickupAddress, dropAddress, discount, shopCommission, deliveryChargePerKm]);

  // --- HANDLERS ---
const applyCouponHandler = async () => {
    if (!couponCode.trim()) {
      Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
      return;
    }
    try {
      // 🔥 PASS SUBTOTAL HERE 🔥
      const discountValue = await validateCoupon(shopId, couponCode, subtotal);
      
      setDiscount(discountValue);
      Toast.show(`Discount applied: ₹${discountValue}`, { duration: Toast.durations.SHORT });
    } catch (error) {
      // The error message now comes dynamically from the Context!
      Toast.show(error || "Invalid coupon", { duration: Toast.durations.SHORT });
      setDiscount(0);
    }
  };

  const handleSelectDropAddress = (address) => {
    setDropAddress(address);
    setShowAddressModal(false);
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Toast.show("Please login", { duration: Toast.durations.SHORT });
      return;
    }
    if (!dropAddress) {
      Toast.show("Please select a drop address", { duration: Toast.durations.SHORT });
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

      // 🔥 Safely generate GeoPoints for the DB 🔥
      const pLat = Number(pickupAddress.lat ?? pickupAddress.location?.latitude ?? 0);
      const pLng = Number(pickupAddress.lng ?? pickupAddress.location?.longitude ?? 0);
      const dLat = Number(dropAddress.lat ?? dropAddress.location?.latitude ?? 0);
      const dLng = Number(dropAddress.lng ?? dropAddress.location?.longitude ?? 0);

      // 🔥 FIRESTORE FLATTENED ORDER SCHEMA 🔥
      const orderData = {
        userId: user.uid, // Required for secure read rules
        shopId,
        shopname: shop?.name || "Unknown",
        shopimage: shop?.image || "",
        items: cleanItems,
        subtotal: Math.ceil(subtotal),
        discount: Math.ceil(discount),
        deliveryFee: Math.ceil(deliveryFee),
        platformFee,
        total: Math.ceil(total),
        paymentMode,
        transactionId: paymentMode === "Online" ? transactionId.trim() : null,
        
        pickupAddress: { 
          ...pickupAddress, 
          customerName: userData?.name || userData?.firstName, 
          customerPhone: userData?.mobile,
          location: new GeoPoint(pLat, pLng)
        },
        dropAddress: { 
          ...dropAddress,
          location: new GeoPoint(dLat, dLng)
        },
        
        customerName: userData?.name || userData?.firstName,
        customerPhone: userData?.mobile,
        customerEmail: user.email,
        status: "pending",
        createdAt: Date.now(),
        orderType: "parcel",

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
          pickupLocation: {
            lat: pLat,
            lng: pLng,
            location: new GeoPoint(pLat, pLng)
          },
          dropLocation: {
            lat: dLat,
            lng: dLng,
            location: new GeoPoint(dLat, dLng)
          }
        }
      };

      // 🔥 WRITE TO FIRESTORE 🔥
      const newOrderRef = await addDoc(collection(db, "orders"), orderData);
      
      // Clear Cart unless it's a Buy Now flow
      if (!isBuyNow) {
        await clearCart();  
      }

      navigation.replace("OrderConfirmation", { 
        orderData: { 
          order: { id: newOrderRef.id, ...orderData }, 
          message: "Parcel order placed successfully" 
        } 
      });

    } catch (e) {
      console.error("Order placement error:", e);
      Toast.show("Failed to place order", { duration: Toast.durations.SHORT });
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
        <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
            
            <View style={[styles.section, { marginTop: 15 }]}>
              <View style={styles.headerRow}>
                <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>PICKUP ADDRESS</Text>
                <TouchableOpacity onPress={() => navigation.navigate("HomeScreen")}>
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

            <View style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={[styles.sectionTitle, { marginBottom: 5, marginTop: 20 }]}>DROP ADDRESS</Text>
                <TouchableOpacity onPress={() => setShowAddressModal(true)}>
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
                <TouchableOpacity style={styles.selectAddressButton} onPress={() => setShowAddressModal(true)}>
                  <Text style={styles.selectAddressText}>+ Select Drop Address</Text>
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
            <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
              {isPremiumOrder && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>🎉 PREMIUM ORDER - Free Delivery & Low Platform Fee</Text>
                </View>
              )}

              <View style={styles.section}>
                <View style={styles.headerRowtwo}>
                  <Text style={[styles.sectionTitle, { color: "black" }]}>YOUR ITEMS</Text>
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
                <Text style={[styles.sectionTitle, { color: 'black' }]}>COUPON</Text>
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
                <Text style={[styles.sectionTitle, { color: 'black' }]}>PAYMENT MODE</Text>
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

          {/* Sticky Bottom Bar */}
          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>₹{Math.ceil(total)}</Text>
              {isPremiumOrder && <Text style={styles.premiumSavings}>You save ₹{Math.ceil(deliveryFee + (10 - platformFee))} on this order!</Text>}
            </View>
            <TouchableOpacity 
              style={[styles.orderBtn, placingOrder && styles.orderBtnDisabled]} 
              onPress={handlePlaceOrder} 
              disabled={placingOrder}
            >
              {placingOrder ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.orderText}>PLACE ORDER</Text>}
            </TouchableOpacity>
          </View>

          <Modal 
            visible={showAddressModal} 
            animationType="slide" 
            transparent 
            onRequestClose={() => setShowAddressModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Drop Address</Text>
                  <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <FlatList 
                  data={userAddresses} 
                  renderItem={renderAddressItem} 
                  keyExtractor={item => item.id} 
                  showsVerticalScrollIndicator={false} 
                  contentContainerStyle={styles.addressList} 
                />
                {userAddresses.length === 0 && (
                  <View style={styles.noAddresses}>
                    <Text style={styles.noAddressesText}>No addresses found</Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>

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
  section: { paddingHorizontal: 16 }, 
  sectiontwo: { paddingHorizontal: 16 }, 
  sectionTitle: { color: "#fff", fontSize:Platform.OS === 'ios' ? 11 : 14, fontFamily: "Sen_Medium", opacity: 0.9, marginLeft: 3, marginBottom: 3 }, 
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, 
  headerRowtwo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 5 }, 
  editText: { color: "#ff7a00", fontSize:Platform.OS === 'ios' ? 11 : 13, fontFamily: "Sen_Medium" }, 
  addressBox: { backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 }, 
  username: { color: "#fff", fontSize:Platform.OS === 'ios' ? 12 : 16, fontFamily: "Sen_Bold", marginBottom: 4 }, 
  addressText: { color: "#fff", fontSize:Platform.OS === 'ios' ? 10 : 14, fontFamily: "Sen_Regular" }, 
  addressSub: { color: "#888", fontSize:Platform.OS === 'ios' ? 10 : 13, marginTop: 4, fontFamily: "Sen_Regular" }, 
  commissionInfo: { backgroundColor: "#2a2a2f", padding: 12, borderRadius: 8, marginTop: 10 }, 
  commissionText: { color: "#ff7a00", fontSize:Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Medium" }, 
  commissionSubtext: { color: "#aaa", fontSize: 12, fontFamily: "Sen_Regular", marginTop: 2 }, 
  selectAddressButton: { backgroundColor: "#2a2a2f", padding: 16, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ff7a00", borderStyle: "dashed" }, 
  selectAddressText: { color: "#ff7a00", fontSize: 14, fontFamily: "Sen_Medium" }, 
  
  bottomSheetBackground: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bottomSheetIndicator: { backgroundColor: "#ccc", width: 40, height: 4 },
  skeletonBottomSheet: { position: "absolute", bottom: 0, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  
  premiumBadge: { backgroundColor: "#28a745", padding: 10, alignItems: "center", marginHorizontal: 16, marginTop: 10, borderRadius: 8 }, 
  premiumBadgeText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 12 }, 
  itemCard: { backgroundColor: "#f5f5f5", padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" }, 
  itemInfo: { flex: 1 }, 
  itemName: { color: "#0e0e12", fontSize:Platform.OS === 'ios' ? 12 : 15, fontFamily: "Sen_Medium" }, 
  itemQty: { color: "#555", marginTop: 4, fontFamily: "Sen_Regular",fontSize:Platform.OS === 'ios' ? 10 :12 }, 
  itemPrice: { color: "#0e0e12", fontWeight: "600", fontSize:Platform.OS === 'ios' ? 12 : 15 }, 
  couponRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 }, 
  couponInput: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, color: "#0e0e12", fontFamily: "Sen_Regular",fontSize:Platform.OS === 'ios' ? 12 :14 }, 
  applyBtn: { backgroundColor: "#ff7a00", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginLeft: 8 }, 
  applyText: { color: "#fff", fontFamily: "Sen_Medium",fontSize:Platform.OS === 'ios' ? 12 :16 }, 
  summaryCard: { backgroundColor: "#f5f5f5", padding: 16, borderRadius: 12, marginVertical: 10, marginHorizontal: 16 }, 
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }, 
  summaryLabel: { color: "#555", fontSize:Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" }, 
  summaryValue: { color: "#0e0e12", fontSize:Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" }, 
  discountText: { color: "#28a745" }, 
  feeContainer: { flexDirection: "row", alignItems: "center" }, 
  premiumFeeNote: { fontSize: 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Regular" }, 
  freeDeliveryNote: { fontSize: 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Bold" }, 
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 }, 
  totalText: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize:Platform.OS === 'ios' ? 14 : 15 }, 
  totalValue: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize:Platform.OS === 'ios' ? 14 : 15 }, 
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 20 }, 
  modeBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4 }, 
  activeMode: { backgroundColor: "#ff7a00" }, 
  modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize:Platform.OS === 'ios' ? 10 : 13 }, 
  activeModeText: { color: "#fff" }, 
  onlineBox: { alignItems: "center", paddingBottom: 20 }, 
  qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 }, 
  transactionInput: { backgroundColor: "#f0f0f0", color: "#0e0e12", borderRadius: 8, width: "90%", padding: 10, marginBottom: 8, fontFamily: "Sen_Regular" }, 
  qrNote: { fontSize: 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" }, 
  
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
  
  totalLabel: { color: "#555", fontSize:Platform.OS === 'ios' ? 12 : 12, fontFamily: "Sen_Regular" }, 
  totalAmount: { color: "#0e0e12", fontSize:Platform.OS === 'ios' ? 16 : 18, fontFamily: "Sen_Bold" }, 
  premiumSavings: { color: "#28a745", fontSize: 10, fontFamily: "Sen_Regular", marginTop: 2 }, 
  orderBtn: { backgroundColor: "#ff7a00", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 }, 
  orderBtnDisabled: { backgroundColor: "#ccc" }, 
  orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize:Platform.OS === 'ios' ? 12 : 14 }, 
  backButton: { backgroundColor: "#ff7a00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 }, 
  backButtonText: { color: "#fff", fontFamily: "Sen_Medium", fontSize: 14 }, 
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "flex-end", zIndex: 1000 }, 
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingBottom: Platform.OS === "ios" ? 20 : 20 }, 
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" }, 
  modalTitle: { fontSize: 18, fontFamily: "Sen_Bold", color: "#0e0e12" }, 
  modalClose: { fontSize: 20, color: "#666" }, 
  addressList: { padding: 16 }, 
  addressItem: { backgroundColor: "#f9f9f9", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#eee" }, 
  selectedAddressItem: { backgroundColor: "#fff8f0", borderColor: "#ff7a00", borderWidth: 2 }, 
  addressItemName: { fontSize: 16, fontFamily: "Sen_Bold", color: "#0e0e12", marginBottom: 4 }, 
  addressItemText: { fontSize: 14, fontFamily: "Sen_Regular", color: "#333", marginBottom: 2 }, 
  addressItemSub: { fontSize: 12, fontFamily: "Sen_Regular", color: "#666" }, 
  selectedText: { color: "#ff7a00", fontSize: 12, fontFamily: "Sen_Medium", marginTop: 4 }, 
  noAddresses: { padding: 40, alignItems: "center" }, 
  noAddressesText: { color: "#999", fontSize: 16, fontFamily: "Sen_Regular" }
});