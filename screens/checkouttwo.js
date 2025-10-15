import React, { useEffect, useState } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
    TextInput, Image, ScrollView, StatusBar, Platform, Modal, FlatList
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import Toast from "react-native-root-toast";

function getDistanceInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
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
    const route = useRoute(),
        navigation = useNavigation();
    const { shopId: paramShopId, shop: paramShop, cart: paramCart } = route.params || {};
    const [shop, setShop] = useState(() =>
        paramShop
            ? {
                id: paramShop.id,
                name: paramShop.name,
                image: paramShop.image,
                location: paramShop.location
                    ? { lat: paramShop.location.lat, lng: paramShop.location.lng }
                    : null,
            }
            : null
    );
    const [shopId, setShopId] = useState(paramShopId || null);
    const [cart, setCart] = useState(() => {
        if (!paramCart) return null;
        const cleanCart = {};
        Object.keys(paramCart).forEach((k) => {
            if (paramCart[k] && typeof paramCart[k] === "object")
                cleanCart[k] = {
                    price: paramCart[k].price,
                    qty: paramCart[k].qty,
                    productname: paramCart[k].productname,
                };
        });
        return cleanCart;
    });

    const [userData, setUserData] = useState(null),
        [loading, setLoading] = useState(true),
        [placingOrder, setPlacingOrder] = useState(false);
    const [deliveryFee, setDeliveryFee] = useState(0),
        [couponCode, setCouponCode] = useState(""),
        [discount, setDiscount] = useState(0);
    const [paymentMode, setPaymentMode] = useState("COD"),
        [transactionId, setTransactionId] = useState("");
    const [platformFee] = useState(10),
        [total, setTotal] = useState(0),
        [deliveryChargePerKm, setDeliveryChargePerKm] = useState(5),
        [subtotal, setSubtotal] = useState(0);
    const [addressModalVisible, setAddressModalVisible] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const user = auth.currentUser;

    const recalcDeliveryFee = (userLoc, shopLoc, sub) => {
        if (!userLoc || !shopLoc) return setDeliveryFee(0);
        const uLat = Number(userLoc.lat),
            uLng = Number(userLoc.lng),
            sLat = Number(shopLoc.lat),
            sLng = Number(shopLoc.lng);
        if (isNaN(uLat) || isNaN(uLng) || isNaN(sLat) || isNaN(sLng))
            return setDeliveryFee(0);
        const distanceKm = getDistanceInKm(sLat, sLng, uLat, uLng);
        const baseFee = 20,
            freeThreshold = 1000000;
        let fee = baseFee + distanceKm * deliveryChargePerKm;
        if (sub >= freeThreshold) fee = 0;
        setDeliveryFee(Math.ceil(fee));
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                let finalShopId = shopId || route.params?.shopId,
                    finalShop = shop,
                    finalCart = cart;

                if (!finalShop && finalShopId) {
                    const shopSnap = await get(ref(db, `shops/${finalShopId}`));
                    if (shopSnap.exists()) {
                        const shopData = shopSnap.val();
                        finalShop = {
                            id: finalShopId,
                            name: shopData.name,
                            image: shopData.image,
                            location: shopData.location
                                ? { lat: shopData.location.lat, lng: shopData.location.lng }
                                : null,
                        };
                    }
                }

                if (!finalCart && finalShopId && user?.uid) {
                    const cartSnap = await get(ref(db, `carts/${user.uid}/${finalShopId}`));
                    if (cartSnap.exists()) {
                        const cartData = cartSnap.val(),
                            cleanCart = {};
                        Object.keys(cartData).forEach((k) => {
                            if (cartData[k] && typeof cartData[k] === "object")
                                cleanCart[k] = {
                                    price: cartData[k].price,
                                    qty: cartData[k].qty,
                                    productname: cartData[k].productname,
                                };
                        });
                        finalCart = cleanCart;
                    }
                }

                const [userSnap, adminSnap] = await Promise.all([
                    get(ref(db, `users/${user.uid}`)),
                    get(ref(db, `admin_data/general`)),
                ]);

                let fetchedUser = null,
                    deliveryCharge = deliveryChargePerKm;

                if (userSnap.exists()) {
                    const u = userSnap.val();
                    fetchedUser = {
                        uid: user.uid,
                        firstName: u.firstName,
                        lastName: u.lastName,
                        name: u.name,
                        phone: u.phone,
                        email: u.email,
                        addresses: u.addresses || {},
                        mainAddressId: u.mainAddressId,
                    };

                    if (u.mainAddressId && u.addresses && u.addresses[u.mainAddressId]) {
                        fetchedUser.location = u.addresses[u.mainAddressId];
                        setSelectedAddress(u.addresses[u.mainAddressId]);
                    } else if (u.location) {
                        fetchedUser.location = u.location;
                        setSelectedAddress(u.location);
                    }
                }

                if (adminSnap.exists()) {
                    const adminData = adminSnap.val();
                    if (adminData.deliveryChargePerKm)
                        deliveryCharge = adminData.deliveryChargePerKm;
                    setDeliveryChargePerKm(deliveryCharge);
                }

                if (fetchedUser && finalCart && finalShop?.location) {
                    const sub = Object.keys(finalCart)
                        .filter((k) => k.startsWith("productId"))
                        .reduce((s, pid) => s + finalCart[pid].price * finalCart[pid].qty, 0);
                    setSubtotal(sub);
                    recalcDeliveryFee(fetchedUser.location, finalShop.location, sub);
                }

                setShop(finalShop);
                setCart(finalCart);
                setUserData(fetchedUser);
            } catch (e) {
                console.error("Checkout load error:", e);
                Toast.show("Failed to load checkout data", {
                    duration: Toast.durations.SHORT,
                });
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user?.uid]);

    useEffect(() => {
        if (!cart) return;
        const sub = Object.keys(cart)
            .filter((k) => k.startsWith("productId"))
            .reduce((s, pid) => s + cart[pid].price * cart[pid].qty, 0);
        setSubtotal(sub);
        setTotal(sub - discount + deliveryFee + platformFee);
    }, [cart, discount, deliveryFee]);

    const handleAddressSelect = (address) => {
        setSelectedAddress(address);
        recalcDeliveryFee(address, shop?.location, subtotal);
        setAddressModalVisible(false);
    };

    const applyCoupon = async () => {
        if (!couponCode)
            return Toast.show("Enter a coupon code", {
                duration: Toast.durations.SHORT,
            });
        const couponSnap = await get(
            ref(db, `admin_data/general/coupons/${shopId}/${couponCode}`)
        );
        if (couponSnap.exists()) {
            setDiscount(couponSnap.val());
            Toast.show(`Discount applied: ₹${couponSnap.val()}`, {
                duration: Toast.durations.SHORT,
            });
        } else Toast.show("Invalid coupon code", { duration: Toast.durations.SHORT });
    };

    const handlePlaceOrder = async () => {
        const user = auth.currentUser;
        if (!user) {
            Toast.show("Please login to place an order", {
                duration: Toast.durations.SHORT,
            });
            navigation.navigate("HomeScreen");
            return;
        }
        if (paymentMode === "Online" && !transactionId.trim()) {
            Toast.show("Enter transaction ID", { duration: Toast.durations.SHORT });
            return;
        }
        try {
            setPlacingOrder(true);
            const cleanItems = {};
            Object.keys(cart)
                .filter((k) => k.startsWith("productId"))
                .forEach((pid) => {
                    if (cart[pid].price && cart[pid].qty)
                        cleanItems[pid] = {
                            price: cart[pid].price,
                            qty: cart[pid].qty,
                            productname: cart[pid].productname || "Product",
                        };
                });
            const orderData = {
                shopId,
                shopname: shop?.name || "Unknown Shop",
                shopimage: shop?.image || "",
                items: cleanItems,
                subtotal: Math.ceil(subtotal),
                discount: Math.ceil(discount),
                deliveryFee: Math.ceil(deliveryFee),
                platformFee,
                total: Math.ceil(total),
                paymentMode,
                transactionId: paymentMode === "Online" ? transactionId.trim() : null,
                address:
                    selectedAddress?.formattedAddress || "No address selected",
                customerName: userData?.name || "Customer",
                customerPhone: userData?.phone || "",
                customerEmail: user?.email || "",
                status: "pending",
                createdAt: Date.now(),
                calculationMetadata: {
                    deliveryChargePerKm,
                    baseDeliveryFee: 20,
                    platformFee: 10,
                    userLocation: selectedAddress || null,
                    shopLocation: shop?.location || null,
                    calculatedAt: Date.now(),
                },
            };
            const newOrderRef = push(ref(db, `orders/${user.uid}`));
            await set(newOrderRef, orderData);
            await remove(ref(db, `carts/${user.uid}/${shopId}`));
            navigation.replace("OrderConfirmation", {
                orderData: {
                    order: { id: newOrderRef.key, ...orderData },
                    message: "Order placed successfully",
                },
            });
        } catch (e) {
            console.error("❌ Order error:", e);
            Toast.show("Failed to place order. Please try again.", {
                duration: Toast.durations.LONG,
                position: Toast.positions.BOTTOM,
            });
        } finally {
            setPlacingOrder(false);
        }
    };

    if (loading)
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff7a00" />
            </View>
        );

    if (!cart || Object.keys(cart).filter((k) => k.startsWith("productId")).length === 0)
        return (
            <View style={styles.center}>
                <Text style={styles.emptyText}>No items in cart.</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>Back to Shop</Text>
                </TouchableOpacity>
            </View>
        );

    const products = Object.keys(cart)
        .filter((k) => k.startsWith("productId"))
        .map((pid) => cart[pid]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
            <View style={styles.container}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 180 }}
                >
                    <View style={[styles.section, { marginTop: 40 }]}>
                        <View style={styles.headerRow}>
                            <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
                            <TouchableOpacity onPress={() => setAddressModalVisible(true)}>
                                <Text style={styles.editText}>CHANGE</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedAddress ? (
                            <View style={styles.addressBox}>
                                <Text style={styles.username}>
                                    {userData.firstName} {userData.lastName}
                                </Text>
                                <Text style={styles.addressText}>
                                    {selectedAddress.formattedAddress}
                                </Text>
                                <Text style={styles.addressSub}>
                                    {selectedAddress.city}, {selectedAddress.state} -{" "}
                                    {selectedAddress.pincode}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No address selected</Text>
                        )}
                    </View>
                </ScrollView>

                {/* Address Modal */}
                <Modal
                    visible={addressModalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setAddressModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Delivery Address</Text>
                            <FlatList
                                data={userData?.addresses ? Object.values(userData.addresses) : []}
                                keyExtractor={(item, index) => index.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.addressOption}
                                        onPress={() => handleAddressSelect(item)}
                                    >
                                        <Text style={styles.addressLine}>{item.formattedAddress}</Text>
                                        <Text style={styles.addressSubLine}>
                                            {item.city}, {item.state} - {item.pincode}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>No saved addresses.</Text>
                                }
                            />
                            <TouchableOpacity
                                style={styles.closeModalBtn}
                                onPress={() => setAddressModalVisible(false)}
                            >
                                <Text style={styles.closeModalText}>CLOSE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Bottom Sheet */}
                <View style={styles.bottomSheet}>
                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                        <View style={styles.section}>
                            <View style={styles.headerRow}>
                                <Text style={styles.sectionTitle}>YOUR ITEMS</Text>
                                <TouchableOpacity onPress={() => navigation.goBack()}>
                                    <Text style={styles.editText}>EDIT ITEMS</Text>
                                </TouchableOpacity>
                            </View>
                            {products.map((i, idx) => (
                                <View key={idx} style={styles.itemCard}>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{i.productname}</Text>
                                        <Text style={styles.itemQty}>Qty: {i.qty}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>₹{i.price * i.qty}</Text>
                                </View>
                            ))}
                        </View>

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

                        <View style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal</Text>
                                <Text style={styles.summaryValue}>₹{Math.ceil(subtotal)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Discount</Text>
                                <Text style={[styles.summaryValue, styles.discountText]}>
                                    -₹{Math.ceil(discount)}
                                </Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Platform Fee</Text>
                                <Text style={styles.summaryValue}>₹{platformFee}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                                <Text style={styles.summaryValue}>₹{Math.ceil(deliveryFee)}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.totalText}>TOTAL</Text>
                                <Text style={styles.totalValue}>₹{Math.ceil(total)}</Text>
                            </View>
                        </View>

                        <View style={styles.sectiontwo}>
                            <Text style={styles.sectionTitle}>PAYMENT MODE</Text>
                            <View style={styles.paymentRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.modeBtn,
                                        paymentMode === "COD" && styles.activeMode,
                                    ]}
                                    onPress={() => setPaymentMode("COD")}
                                >
                                    <Text
                                        style={[
                                            styles.modeText,
                                            paymentMode === "COD" && styles.activeModeText,
                                        ]}
                                    >
                                        CASH ON DELIVERY
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modeBtn,
                                        paymentMode === "Online" && styles.activeMode,
                                    ]}
                                    onPress={() => setPaymentMode("Online")}
                                >
                                    <Text
                                        style={[
                                            styles.modeText,
                                            paymentMode === "Online" && styles.activeModeText,
                                        ]}
                                    >
                                        PAY ONLINE
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {paymentMode === "Online" && (
                                <View style={styles.onlineBox}>
                                    <Image
                                        source={{
                                            uri: "https://i.ibb.co/7WpZKqR/qr-placeholder.png",
                                        }}
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

                    <View style={styles.bottomBar}>
                        <View>
                            <Text style={styles.totalLabel}>TOTAL</Text>
                            <Text style={styles.totalAmount}>₹{Math.ceil(total)}</Text>
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

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 20,
        width: "85%",
        maxHeight: "70%",
    },
    modalTitle: {
        fontFamily: "Sen_Bold",
        fontSize: 16,
        color: "#0e0e12",
        marginBottom: 12,
    },
    addressOption: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: "#f7f7f7",
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    addressLine: { fontFamily: "Sen_Medium", color: "#0e0e12" },
    addressSubLine: { fontFamily: "Sen_Regular", color: "#666", fontSize: 12 },
    closeModalBtn: {
        backgroundColor: "#ff7a00",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    closeModalText: { color: "#fff", fontFamily: "Sen_Bold" },
});