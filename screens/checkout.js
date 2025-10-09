import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Image,
    ScrollView,
    Platform,
    StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebase";
import { ref, get, set, remove, push } from "firebase/database";
import Toast from "react-native-root-toast";

// Helper to calculate distance between two coords in km
function getDistanceInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default function CheckoutScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { shopId, shop } = route.params || {};

    const [userData, setUserData] = useState(null);
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [couponCode, setCouponCode] = useState("");
    const [discount, setDiscount] = useState(0);
    const [paymentMode, setPaymentMode] = useState("COD");
    const [transactionId, setTransactionId] = useState("");
    const [platformFee] = useState(10);
    const [total, setTotal] = useState(0);
    const [deliveryChargePerKm, setDeliveryChargePerKm] = useState(5);

    const user = auth.currentUser;

    // Fetch data and calculate delivery fee
    useEffect(() => {
        const loadData = async () => {
            try {
                const [userSnap, cartSnap, adminSnap] = await Promise.all([
                    get(ref(db, `users/${user.uid}`)),
                    get(ref(db, `carts/${user.uid}/${shopId}`)),
                    get(ref(db, `admin_data/general`)),
                ]);

                let fetchedUser = null;
                let fetchedCart = null;
                let deliveryCharge = deliveryChargePerKm;

                if (userSnap.exists()) {
                    fetchedUser = userSnap.val();
                    setUserData(fetchedUser);
                }

                if (cartSnap.exists()) {
                    fetchedCart = cartSnap.val();
                    setCart(fetchedCart);
                }

                if (adminSnap.exists()) {
                    const adminData = adminSnap.val();
                    if (adminData.deliveryChargePerKm) {
                        deliveryCharge = adminData.deliveryChargePerKm;
                        setDeliveryChargePerKm(deliveryCharge);
                    }
                }

                // Calculate delivery fee if all data exists
                if (fetchedUser && fetchedCart && shop?.location) {
                    const subtotal = Object.keys(fetchedCart)
                        .filter(k => k.startsWith("productId"))
                        .reduce((sum, pid) => sum + fetchedCart[pid].price * fetchedCart[pid].qty, 0);

                    const userLat = Number(fetchedUser.location.lat);
                    const userLng = Number(fetchedUser.location.lng);
                    const shopLat = Number(shop.location.lat);
                    const shopLng = Number(shop.location.lng);

                    if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(shopLat) && !isNaN(shopLng)) {
                        const distanceKm = getDistanceInKm(shopLat, shopLng, userLat, userLng);
                        const baseFee = 20;
                        const freeDeliveryThreshold = 500;
                        let calculatedFee = baseFee + distanceKm * deliveryCharge;
                        if (subtotal >= freeDeliveryThreshold) calculatedFee = 0;
                        setDeliveryFee(Math.ceil(calculatedFee));
                    } else {
                        setDeliveryFee(0);
                    }
                }
            } catch (error) {
                console.error("Checkout load error:", error);
                Toast.show("Failed to load checkout data", { duration: Toast.durations.SHORT });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user.uid, shopId, shop]);



    // Calculate total whenever cart, discount, or deliveryFee changes
    useEffect(() => {
        if (!cart) return;
        const subtotal = Object.keys(cart)
            .filter(k => k.startsWith("productId"))
            .reduce((sum, pid) => sum + cart[pid].price * cart[pid].qty, 0);
        const totalAmount = subtotal - discount + deliveryFee + platformFee;
        setTotal(totalAmount);
    }, [cart, discount, deliveryFee]);

    const applyCoupon = async () => {
        if (!couponCode) {
            Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
            return;
        }

        const couponRef = ref(db, `admin_data/general/coupons/${shopId}/${couponCode}`);
        const snap = await get(couponRef);

        if (snap.exists()) {
            const flatValue = snap.val();
            setDiscount(flatValue);
            Toast.show(`Discount applied: ₹${flatValue}`, { duration: Toast.durations.SHORT });
        } else {
            Toast.show("Invalid coupon code", { duration: Toast.durations.SHORT });
        }
    };


    // Place order
    const handlePlaceOrder = async () => {
        if (!cart || !userData) return;

        if (paymentMode === "Online" && !transactionId.trim()) {
            Toast.show("Enter transaction ID before placing order", { duration: Toast.durations.SHORT });
            return;
        }

        const orderRef = ref(db, `orders/${user.uid}`);
        const newOrderRef = push(orderRef);

        const items = {};
        Object.keys(cart)
            .filter(k => k.startsWith("productId"))
            .forEach(pid => {
                items[pid] = cart[pid];
            });

        const subtotal = Object.keys(cart)
            .filter(k => k.startsWith("productId"))
            .reduce((sum, pid) => sum + cart[pid].price * cart[pid].qty, 0);

        const orderData = {
            shopId,
            shopname: shop.name,
            shopimage: shop.image,
            items,
            subtotal,
            discount,
            deliveryFee,
            platformFee,
            total,
            paymentMode,
            transactionId: paymentMode === "Online" ? transactionId : null,
            address: userData.location?.formattedAddress || "No address",
            status: "pending",
            createdAt: Date.now(),
        };

        await set(newOrderRef, orderData);
        await remove(ref(db, `carts/${user.uid}/${shopId}`));

        Toast.show("Order placed successfully!", {
            duration: Toast.durations.SHORT,
            position: Toast.positions.BOTTOM,
        });

    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff7a00" />
            </View>
        );
    }

    if (!cart) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyText}>No items in cart.</Text>
            </View>
        );
    }

    const products = Object.keys(cart)
        .filter(k => k.startsWith("productId"))
        .map(pid => cart[pid]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
            <View style={styles.container}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
                    {/* Address Section */}
                    <View style={[styles.section, { marginTop: 40 }]}>
                        <View style={styles.headerRow}>
                            <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
                            <TouchableOpacity onPress={() => navigation.navigate("HomeScreen")}>
                                <Text style={styles.editText}>EDIT</Text>
                            </TouchableOpacity>
                        </View>
                        {userData?.location ? (
                            <View style={styles.addressBox}>
                                <Text style={styles.username}>{userData.firstName} {userData.lastName}</Text>
                                <Text style={styles.addressText}>{userData.location.formattedAddress}</Text>
                                <Text style={styles.addressSub}>
                                    {userData.location.city}, {userData.location.state} - {userData.location.pincode}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No address found</Text>
                        )}
                    </View>
                </ScrollView>

                {/* Bottom Sheet */}
                <View style={styles.bottomSheet}>
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                        {/* Cart Items */}
                        <View style={styles.section}>
                            <View style={styles.headerRow}>
                                <Text style={styles.sectionTitle}>YOUR ITEMS</Text>
                                <TouchableOpacity onPress={() => navigation.goBack()}>
                                    <Text style={styles.editText}>EDIT ITEMS</Text>
                                </TouchableOpacity>
                            </View>
                            {products.map((item, index) => (
                                <View key={index} style={styles.itemCard}>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{item.productname}</Text>
                                        <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Coupon */}
                        <View style={styles.sectiontwo}>
                            <Text style={styles.sectionTitle}>COUPON</Text>
                            <View style={styles.couponRow}>
                                <TextInput
                                    style={styles.couponInput}
                                    placeholder="Enter code"
                                    placeholderTextColor="#aaa"
                                    value={couponCode}
                                    onChangeText={setCouponCode}
                                />
                                <TouchableOpacity style={styles.applyBtn} onPress={applyCoupon}>
                                    <Text style={styles.applyText}>APPLY</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Payment Summary */}
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal</Text>
                                <Text style={styles.summaryValue}>₹{total - (deliveryFee + platformFee - discount)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Discount</Text>
                                <Text style={styles.summaryValue}>-₹{discount}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Platform Fee</Text>
                                <Text style={styles.summaryValue}>₹{platformFee}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                                <Text style={styles.summaryValue}>₹{deliveryFee}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.totalText}>TOTAL</Text>
                                <Text style={styles.totalValue}>₹{total}</Text>
                            </View>
                        </View>

                        {/* Payment Mode */}
                        <View style={styles.sectiontwo}>
                            <Text style={styles.sectionTitle}>PAYMENT MODE</Text>
                            <View style={styles.paymentRow}>
                                <TouchableOpacity
                                    style={[styles.modeBtn, paymentMode === "COD" && styles.activeMode]}
                                    onPress={() => setPaymentMode("COD")}
                                >
                                    <Text style={styles.modeText}>CASH ON DELIVERY</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modeBtn, paymentMode === "Online" && styles.activeMode]}
                                    onPress={() => setPaymentMode("Online")}
                                >
                                    <Text style={styles.modeText}>PAY ONLINE</Text>
                                </TouchableOpacity>
                            </View>

                            {paymentMode === "Online" && (
                                <View style={styles.onlineBox}>
                                    <Image
                                        source={{ uri: "https://i.ibb.co/7WpZKqR/qr-placeholder.png" }}
                                        style={styles.qrImage}
                                    />
                                    <TextInput
                                        style={styles.transactionInput}
                                        placeholder="Enter Transaction ID"
                                        placeholderTextColor="#999"
                                        value={transactionId}
                                        onChangeText={setTransactionId}
                                    />
                                    <Text style={styles.qrNote}>
                                        Scan the QR to pay, then enter your transaction ID.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* Bottom Order Bar */}
                    <View style={styles.bottomBar}>
                        <View>
                            <Text style={styles.totalLabel}>TOTAL</Text>
                            <Text style={styles.totalAmount}>₹{total}</Text>
                        </View>
                        <TouchableOpacity style={styles.orderBtn} onPress={handlePlaceOrder}>
                            <Text style={styles.orderText}>PLACE ORDER</Text>
                        </TouchableOpacity>
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
    bottomSheet: {
        position: "absolute",
        bottom: 0,
        width: "100%",
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 10,
        paddingBottom: Platform.OS === "ios" ? 34 : 16,
        overflow: "hidden",
    },
    itemCard: {
        backgroundColor: "#f5f5f5",
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
    },
    itemInfo: { flex: 1 },
    itemName: { color: "#0e0e12", fontSize: 15, fontFamily: "Sen_Medium" },
    itemQty: { color: "#555", marginTop: 4, fontFamily: "Sen_Regular" },
    itemPrice: { color: "#0e0e12", fontWeight: "600", fontSize: 15 },
    couponRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    couponInput: {
        flex: 1,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        padding: 12,
        color: "#0e0e12",
        fontFamily: "Sen_Regular",
    },
    applyBtn: {
        backgroundColor: "#ff7a00",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginLeft: 8,
    },
    applyText: { color: "#fff", fontFamily: "Sen_Medium" },
    summaryCard: {
        backgroundColor: "#f5f5f5",
        padding: 16,
        borderRadius: 12,
        marginVertical: 10,
        marginHorizontal: 16,
    },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    summaryLabel: { color: "#555", fontSize: 14, fontFamily: "Sen_Regular" },
    summaryValue: { color: "#0e0e12", fontSize: 14, fontFamily: "Sen_Regular" },
    divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 },
    totalText: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
    totalValue: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
    paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 20 },
    modeBtn: {
        flex: 1,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        padding: 12,
        alignItems: "center",
        marginHorizontal: 4,
    },
    activeMode: { backgroundColor: "#ff7a00" },
    modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize: 13 },
    onlineBox: { alignItems: "center", marginTop: 12, paddingBottom: 20 },
    qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 },
    transactionInput: {
        backgroundColor: "#f0f0f0",
        color: "#0e0e12",
        borderRadius: 8,
        width: "90%",
        padding: 10,
        marginBottom: 8,
        fontFamily: "Sen_Regular",
    },
    qrNote: { fontSize: 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" },
    bottomBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#ddd",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    totalLabel: { color: "#555", fontSize: 12, fontFamily: "Sen_Regular" },
    totalAmount: { color: "#0e0e12", fontSize: 18, fontFamily: "Sen_Bold" },
    orderBtn: {
        backgroundColor: "#ff7a00",
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 26,
    },
    orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 14 },
});