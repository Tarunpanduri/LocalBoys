import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, StatusBar, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import Toast from "react-native-root-toast";

function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CheckoutScreen() {
  const route = useRoute(), navigation = useNavigation();
  const { shopId: paramShopId, shop: paramShop, cart: paramCart } = route.params || {};
  const [shop, setShop] = useState(() => paramShop ? { id: paramShop.id, name: paramShop.name, image: paramShop.image, location: paramShop.location ? { lat: paramShop.location.lat, lng: paramShop.location.lng } : null } : null);
  const [shopId, setShopId] = useState(paramShopId || null);
  const [cart, setCart] = useState(() => {
    if (!paramCart) return null;
    const cleanCart = {};
    Object.keys(paramCart).forEach((k) => {
      if (paramCart[k] && typeof paramCart[k] === "object") cleanCart[k] = { price: paramCart[k].price, qty: paramCart[k].qty, productname: paramCart[k].productname };
    });
    return cleanCart;
  });

  const [userData, setUserData] = useState(null), [loading, setLoading] = useState(true), [placingOrder, setPlacingOrder] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0), [couponCode, setCouponCode] = useState(""), [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("COD"), [transactionId, setTransactionId] = useState("");
  const [platformFee] = useState(10), [total, setTotal] = useState(0), [deliveryChargePerKm, setDeliveryChargePerKm] = useState(5), [subtotal, setSubtotal] = useState(0);
  const [restaurantTotal, setRestaurantTotal] = useState(0);
  const user = auth.currentUser;

  useEffect(() => {
    const loadData = async () => {
      try {
        let finalShopId = shopId || route.params?.shopId, finalShop = shop, finalCart = cart;
        if (!finalShop && finalShopId) {
          const shopSnap = await get(ref(db, `shops/${finalShopId}`));
          if (shopSnap.exists()) {
            const shopData = shopSnap.val();
            finalShop = { id: finalShopId, name: shopData.name, image: shopData.image, location: shopData.location ? { lat: shopData.location.lat, lng: shopData.location.lng } : null };
          }
        }
        if (!finalCart && finalShopId && user?.uid) {
          const cartSnap = await get(ref(db, `carts/${user.uid}/${finalShopId}`));
          if (cartSnap.exists()) {
            const cartData = cartSnap.val(), cleanCart = {};
            Object.keys(cartData).forEach((k) => { if (cartData[k] && typeof cartData[k] === "object") cleanCart[k] = { price: cartData[k].price, qty: cartData[k].qty, productname: cartData[k].productname }; });
            finalCart = cleanCart;
          }
        }

        const [userSnap, adminSnap] = await Promise.all([get(ref(db, `users/${user.uid}`)), get(ref(db, `admin_data/general`))]);
        let fetchedUser = null, deliveryCharge = deliveryChargePerKm;

        if (userSnap.exists()) {
          const u = userSnap.val();
          fetchedUser = { uid: user.uid, firstName: u.firstName, lastName: u.lastName, name: u.name, phone: u.phone,mobile: u.mobile, email: u.email };
          if (u.mainAddressId && u.addresses && u.addresses[u.mainAddressId]) {
            const main = u.addresses[u.mainAddressId];
            fetchedUser.location = { area: main.area, city: main.city, state: main.state, pincode: main.pincode, formattedAddress: main.formattedAddress, lat: main.lat, lng: main.lng, updatedAt: main.updatedAt };
          } else if (u.location) fetchedUser.location = { area: u.location.area, city: u.location.city, state: u.location.state, pincode: u.location.pincode, formattedAddress: u.location.formattedAddress, lat: u.location.lat, lng: u.location.lng, updatedAt: u.location.updatedAt };
        }
        if (adminSnap.exists()) { const adminData = adminSnap.val(); if (adminData.deliveryChargePerKm) deliveryCharge = adminData.deliveryChargePerKm; setDeliveryChargePerKm(deliveryCharge); }

        if (fetchedUser && finalCart && finalShop?.location) {
          const calculatedSubtotal = Object.keys(finalCart).filter((k) => k.startsWith("productId")).reduce((s, pid) => s + finalCart[pid].price * finalCart[pid].qty, 0);
          setSubtotal(calculatedSubtotal);
          const uLat = Number(fetchedUser.location?.lat), uLng = Number(fetchedUser.location?.lng), sLat = Number(finalShop.location?.lat), sLng = Number(finalShop.location?.lng);
          if (!isNaN(uLat) && !isNaN(uLng) && !isNaN(sLat) && !isNaN(sLng)) {
            const distanceKm = getDistanceInKm(sLat, sLng, uLat, uLng) * 1.3; 
            const baseFee = 20, freeThreshold = 1000000;
            let fee = baseFee + distanceKm * deliveryCharge;
            if (calculatedSubtotal >= freeThreshold) fee = 0;
            setDeliveryFee(Math.ceil(fee));
          } else setDeliveryFee(0);
        }

        setShop(finalShop); setCart(finalCart); setUserData(fetchedUser);
      } catch (e) { console.error("Checkout load error:", e); Toast.show("Failed to load checkout data", { duration: Toast.durations.SHORT }); }
      finally { setLoading(false); }
    };
    loadData();
  }, [user?.uid]);

  useEffect(() => {
    if (!cart) return;
    const calculatedSubtotal = Object.keys(cart).filter((k) => k.startsWith("productId")).reduce((s, pid) => s + cart[pid].price * cart[pid].qty, 0);
    setSubtotal(calculatedSubtotal);
    setTotal(calculatedSubtotal - discount + deliveryFee + platformFee);
    
    // Calculate restaurant total (subtotal - platform commission + delivery fee share)
    const platformCommission = calculatedSubtotal * 0.10; // 10% platform commission
    const deliveryFeeShare = deliveryFee * 0.5; // 50% of delivery fee goes to restaurant
    const restaurantPayout = calculatedSubtotal - platformCommission + deliveryFeeShare;
    setRestaurantTotal(Math.ceil(restaurantPayout));
  }, [cart, discount, deliveryFee]);
console.log("userData:", userData);

  const applyCoupon = async () => {
    if (!couponCode) return Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
    const couponSnap = await get(ref(db, `admin_data/general/coupons/${shopId}/${couponCode}`));
    if (couponSnap.exists()) { setDiscount(couponSnap.val()); Toast.show(`Discount applied: ₹${couponSnap.val()}`, { duration: Toast.durations.SHORT }); }
    else Toast.show("Invalid coupon code", { duration: Toast.durations.SHORT });
  };

  const handlePlaceOrder = async () => {
    const user = auth.currentUser;
    if (!user) { Toast.show("Please login to place an order", { duration: Toast.durations.SHORT }); navigation.navigate("HomeScreen"); return; }
    if (paymentMode === "Online" && !transactionId.trim()) { Toast.show("Enter transaction ID", { duration: Toast.durations.SHORT }); return; }
    try {
      setPlacingOrder(true);
      const cleanItems = {};
      Object.keys(cart).filter((k) => k.startsWith("productId")).forEach((pid) => { if (cart[pid].price && cart[pid].qty) cleanItems[pid] = { price: cart[pid].price, qty: cart[pid].qty, productname: cart[pid].productname || "Product" }; });
      
      // Calculate restaurant payout breakdown
      const platformCommission = Math.ceil(subtotal * 0.15); // 15% platform commission
      const deliveryFeeShare = Math.ceil(deliveryFee * 0.5); // 50% of delivery fee goes to restaurant
      
      const orderData = {
        shopId, shopname: shop?.name || "Unknown Shop", shopimage: shop?.image || "", items: cleanItems,
        subtotal: Math.ceil(subtotal), discount: Math.ceil(discount), deliveryFee: Math.ceil(deliveryFee), platformFee, total: Math.ceil(total),
        paymentMode, transactionId: paymentMode === "Online" ? transactionId.trim() : null,
        address: userData?.location?.formattedAddress || "No address", customerName: userData?.firstName || "Customer", customerPhone: userData?.mobile || "", customerEmail: user?.email || "",
        status: "pending", createdAt: Date.now(),
        
        // Restaurant payout data (not displayed in frontend, only sent to cloud)
        restaurantPayout: {
          restaurantTotal: restaurantTotal,
          platformCommission: platformCommission,
          deliveryFeeShare: deliveryFeeShare,
          netPayout: restaurantTotal,
          calculationBreakdown: {
            subtotal: Math.ceil(subtotal),
            platformCommissionRate: 0.15,
            deliveryFeeShareRate: 0.5,
            finalRestaurantAmount: restaurantTotal
          }
        },
        
        calculationMetadata: {
          deliveryChargePerKm, freeDeliveryThreshold: 1000000, baseDeliveryFee: 20, platformFee: 10,
          userLocation: userData?.location ? { area: userData.location.area, city: userData.location.city, state: userData.location.state, pincode: userData.location.pincode, formattedAddress: userData.location.formattedAddress, lat: userData.location.lat, lng: userData.location.lng, updatedAt: userData.location.updatedAt } : null,
          shopLocation: shop?.location ? { lat: shop.location.lat, lng: shop.location.lng } : null, calculatedAt: Date.now(),
        },
      };
      const newOrderRef = push(ref(db, `orders/${user.uid}`));
      await set(newOrderRef, orderData);
      await remove(ref(db, `carts/${user.uid}/${shopId}`));
      navigation.replace("OrderConfirmation", { orderData: { order: { id: newOrderRef.key, ...orderData }, message: "Order placed successfully" } });
    } catch (e) { console.error("❌ Order error:", e); Toast.show("Failed to place order. Please try again.", { duration: Toast.durations.LONG, position: Toast.positions.BOTTOM }); }
    finally { setPlacingOrder(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#ff7a00" /></View>;
  if (!cart || Object.keys(cart).filter((k) => k.startsWith("productId")).length === 0) return <View style={styles.center}><Text style={styles.emptyText}>No items in cart.</Text><TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backButtonText}>Back to Shop</Text></TouchableOpacity></View>;

  const products = Object.keys(cart).filter((k) => k.startsWith("productId")).map((pid) => cart[pid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
          <View style={[styles.section, { marginTop: 40 }]}>
            <View style={styles.headerRow}><Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text><TouchableOpacity onPress={() => navigation.navigate("HomeScreen")}><Text style={styles.editText}>EDIT</Text></TouchableOpacity></View>
            {userData?.location ? <View style={styles.addressBox}><Text style={styles.username}>{userData.firstName} {userData.lastName}</Text><Text style={styles.addressText}>{userData.location.formattedAddress}</Text><Text style={styles.addressSub}>{userData.location.city}, {userData.location.state} - {userData.location.pincode}</Text></View> : (<Text style={styles.emptyText}>No address found</Text>)}
          </View>
        </ScrollView>

        <View style={styles.bottomSheet}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <View style={styles.section}>
              <View style={styles.headerRow}><Text style={styles.sectionTitle}>YOUR ITEMS</Text><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.editText}>EDIT ITEMS</Text></TouchableOpacity></View>
              {products.map((i, idx) => <View key={idx} style={styles.itemCard}><View style={styles.itemInfo}><Text style={styles.itemName}>{i.productname}</Text><Text style={styles.itemQty}>Qty: {i.qty}</Text></View><Text style={styles.itemPrice}>₹{i.price * i.qty}</Text></View>)}
            </View>

            <View style={styles.sectiontwo}>
              <Text style={styles.sectionTitle}>COUPON</Text>
              <View style={styles.couponRow}><TextInput style={styles.couponInput} placeholder="Enter code" placeholderTextColor="#aaa" value={couponCode} onChangeText={setCouponCode} /><TouchableOpacity style={styles.applyBtn} onPress={applyCoupon}><Text style={styles.applyText}>APPLY</Text></TouchableOpacity></View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₹{Math.ceil(subtotal)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Discount</Text><Text style={[styles.summaryValue, styles.discountText]}>-₹{Math.ceil(discount)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Platform Fee</Text><Text style={styles.summaryValue}>₹{platformFee}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery Fee</Text><Text style={styles.summaryValue}>₹{Math.ceil(deliveryFee)}</Text></View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}><Text style={styles.totalText}>TOTAL</Text><Text style={styles.totalValue}>₹{Math.ceil(total)}</Text></View>
            </View>

            <View style={styles.sectiontwo}>
              <Text style={styles.sectionTitle}>PAYMENT MODE</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity style={[styles.modeBtn, paymentMode === "COD" && styles.activeMode]} onPress={() => setPaymentMode("COD")}><Text style={[styles.modeText, paymentMode === "COD" && styles.activeModeText]}>CASH ON DELIVERY</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, paymentMode === "Online" && styles.activeMode]} onPress={() => setPaymentMode("Online")}><Text style={[styles.modeText, paymentMode === "Online" && styles.activeModeText]}>PAY ONLINE</Text></TouchableOpacity>
              </View>
              {paymentMode === "Online" && <View style={styles.onlineBox}><Image source={{ uri: "https://i.ibb.co/7WpZKqR/qr-placeholder.png" }} style={styles.qrImage} /><TextInput style={styles.transactionInput} placeholder="Enter Transaction ID" placeholderTextColor="#999" value={transactionId} onChangeText={setTransactionId} /><Text style={styles.qrNote}>Scan the QR to pay, then enter your transaction ID.</Text></View>}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <View><Text style={styles.totalLabel}>TOTAL</Text><Text style={styles.totalAmount}>₹{Math.ceil(total)}</Text></View>
            <TouchableOpacity style={[styles.orderBtn, placingOrder && styles.orderBtnDisabled]} onPress={handlePlaceOrder} disabled={placingOrder}>{placingOrder ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.orderText}>PLACE ORDER</Text>}</TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0e0e12" },
  container: { flex: 1, backgroundColor: "#0e0e12" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0e0e12" },
  emptyText: { color: "#aaa", fontSize: 15, fontFamily: "Sen_Regular" },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectiontwo: { paddingHorizontal: 16 },
  sectionTitle: { color: "#fff", fontSize: 14, fontFamily: "Sen_Medium", marginBottom: 10, opacity: 0.9, marginLeft: 3 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editText: { color: "#ff7a00", fontSize: 13, fontFamily: "Sen_Medium" },
  addressBox: { backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 },
  username: { color: "#fff", fontSize: 16, fontFamily: "Sen_Bold", marginBottom: 4 },
  addressText: { color: "#fff", fontSize: 14, fontFamily: "Sen_Regular" },
  addressSub: { color: "#888", fontSize: 13, marginTop: 4, fontFamily: "Sen_Regular" },
  bottomSheet: { position: "absolute", bottom: Platform.OS === "ios" ? -40 : -20, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 10, paddingBottom: Platform.OS === "ios" ? 34 : 26, overflow: "hidden" },
  itemCard: { backgroundColor: "#f5f5f5", padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  itemInfo: { flex: 1 },
  itemName: { color: "#0e0e12", fontSize: 15, fontFamily: "Sen_Medium" },
  itemQty: { color: "#555", marginTop: 4, fontFamily: "Sen_Regular" },
  itemPrice: { color: "#0e0e12", fontWeight: "600", fontSize: 15 },
  couponRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  couponInput: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, color: "#0e0e12", fontFamily: "Sen_Regular" },
  applyBtn: { backgroundColor: "#ff7a00", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginLeft: 8 },
  applyText: { color: "#fff", fontFamily: "Sen_Medium" },
  summaryCard: { backgroundColor: "#f5f5f5", padding: 16, borderRadius: 12, marginVertical: 10, marginHorizontal: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { color: "#555", fontSize: 14, fontFamily: "Sen_Regular" },
  summaryValue: { color: "#0e0e12", fontSize: 14, fontFamily: "Sen_Regular" },
  discountText: { color: "#28a745" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 },
  totalText: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
  totalValue: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 20 },
  modeBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4 },
  activeMode: { backgroundColor: "#ff7a00" },
  modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize: 13 },
  activeModeText: { color: "#fff" },
  onlineBox: { alignItems: "center", marginTop: 12, paddingBottom: 20 },
  qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 },
  transactionInput: { backgroundColor: "#f0f0f0", color: "#0e0e12", borderRadius: 8, width: "90%", padding: 10, marginBottom: 8, fontFamily: "Sen_Regular" },
  qrNote: { fontSize: 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" },
  bottomBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#ddd", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  totalLabel: { color: "#555", fontSize: 12, fontFamily: "Sen_Regular" },
  totalAmount: { color: "#0e0e12", fontSize: 18, fontFamily: "Sen_Bold" },
  orderBtn: { backgroundColor: "#ff7a00", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  orderBtnDisabled: { backgroundColor: "#ccc" },
  orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 14 },
  backButton: { backgroundColor: "#ff7a00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  backButtonText: { color: "#fff", fontFamily: "Sen_Medium", fontSize: 14 },
});