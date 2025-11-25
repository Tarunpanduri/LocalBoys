import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated, Linking, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ref, onValue, off } from "firebase/database";
import { auth, db } from "../firebase";

export default function OrderConfirmation({ route, navigation }) {
    const { orderData } = route.params;
    const { order } = orderData;
    const [currentOrder, setCurrentOrder] = useState(order);
    const [loading, setLoading] = useState(true);
    const [fadeAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (!auth.currentUser) { setLoading(false); return; }
        const orderRef = ref(db, `orders/${auth.currentUser.uid}/${order.id}`);
        onValue(orderRef, (snapshot) => {
            if (snapshot.exists()) setCurrentOrder({ id: snapshot.key, ...snapshot.val() });
            setLoading(false);
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        return () => off(orderRef);
    }, [order.id]);

    const handleContactSupport = () => Linking.openURL(`tel:+919876543210`);
    const getStatusColor = (status) => {
        switch (status) {
            case "pending": return "#ffc107"; case "accepted": return "#17a2b8";
            case "preparing": return "#fd7e14"; case "ready": return "#20c997";
            case "out_for_delivery": return "#007bff"; case "delivered": return "#28a745";
            case "cancelled": return "#dc3545"; default: return "#6c757d";
        }
    };
    const formatOrderId = (orderId) => { if (!orderId) return "N/A"; const shortId = orderId.length > 8 ? orderId.slice(-8) : orderId; return `#${shortId.toUpperCase()}`; };

    if (loading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#28a745" /><Text style={styles.loadingText}>Loading order details...</Text></View>);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
            <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.successContainer}>
                        <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={80} color="#28a745" /></View>
                        <Text style={styles.successTitle}>Order Confirmed!</Text>
                        <Text style={styles.successSubtitle}>Your order {formatOrderId(currentOrder.id)} has been placed successfully. Will notify you once it's on the way.</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentOrder.status) }]}><Text style={styles.statusText}>{currentOrder.status?.replace(/_/g, ' ').toUpperCase() || "PENDING"}</Text></View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Details</Text>
                        <View style={styles.detailsGrid}>
                            <View style={styles.detailItem}><Text style={styles.detailLabel}>Order ID</Text><Text style={styles.detailValue}>{formatOrderId(currentOrder.id)}</Text></View>
                            <View style={styles.detailItem}><Text style={styles.detailLabel}>Shop</Text><Text style={styles.detailValue}>{currentOrder.shopname || "Unknown Shop"}</Text></View>
                            <View style={styles.detailItem}><Text style={styles.detailLabel}>Payment</Text><Text style={styles.detailValue}>{currentOrder.paymentMode || "COD"}</Text></View>
                            <View style={styles.detailItem}><Text style={styles.detailLabel}>Order Time</Text><Text style={styles.detailValue}>{new Date(currentOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.actionGrid}>
                            <TouchableOpacity style={styles.actionButton} onPress={handleContactSupport}><Ionicons name="headset-outline" size={24} color="#28a745" /><Text style={styles.actionText}>Support</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("TrackOrder")}><Ionicons name="navigate-outline" size={24} color="#28a745" /><Text style={styles.actionText}>Track</Text></TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        <View style={styles.summaryGrid}>
                            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Items Total</Text><Text style={styles.summaryValue}>₹{currentOrder.subtotal || 0}</Text></View>
                            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Delivery</Text><Text style={styles.summaryValue}>₹{currentOrder.deliveryFee || 0}</Text></View>
                            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Platform Fee</Text><Text style={styles.summaryValue}>₹{currentOrder.platformFee || 0}</Text></View>
                            {currentOrder.discount > 0 && (<View style={styles.summaryItem}><Text style={styles.summaryLabel}>Discount</Text><Text style={[styles.summaryValue, styles.discountValue]}>-₹{currentOrder.discount || 0}</Text></View>)}
                            <View style={[styles.summaryItem, styles.totalItem]}><Text style={styles.totalLabel}>Total Amount</Text><Text style={styles.totalValue}>₹{currentOrder.total || 0}</Text></View>
                        </View>
                    </View>

                    {currentOrder.items && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Order Items</Text>
                            {Object.keys(currentOrder.items).filter(key => key.startsWith("productId")).map((itemKey, index) => {
                                const item = currentOrder.items[itemKey];
                                return (
                                    <View key={index} style={styles.orderItem}>
                                        <View style={styles.itemDetails}><Text style={styles.itemName}>{item.productname || "Product"}</Text><Text style={styles.itemQuantity}>Qty: {item.qty || 1}</Text></View>
                                        <Text style={styles.itemPrice}>₹{(item.price || 0) * (item.qty || 1)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>What Happens Next?</Text>
                        <View style={styles.timeline}>
                            <View style={styles.timelineStep}><View style={styles.timelineDot} /><Text style={styles.timelineText}>Admin Confirmation</Text></View>
                            <View style={styles.timelineStep}><View style={styles.timelineDot} /><Text style={styles.timelineText}>Order preparation</Text></View>
                            <View style={styles.timelineStep}><View style={styles.timelineDot} /><Text style={styles.timelineText}>Driver assignment</Text></View>
                            <View style={styles.timelineStep}><View style={styles.timelineDot} /><Text style={styles.timelineText}>Delivery to your location</Text></View>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("TrackOrder")}>
                        <Ionicons name="location-outline" size={20} color="#fff" /><Text style={styles.primaryButtonText}>Track Your Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] })}>
                        <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8f9fa" },
    scrollView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa" },
    loadingText: { marginTop: 16, fontSize: 16, color: "#666", fontFamily: "Sen_Regular" },
    successContainer: { backgroundColor: "#fff", alignItems: "center", padding: 32, margin: 16, borderRadius: 20, borderWidth: 1, borderColor: "#e0e0e0" },
    successIcon: { marginBottom: 16 },
    successTitle: { fontSize: 24, color: "#28a745", marginBottom: 8, textAlign: "center", fontFamily: "Sen_Bold" },
    successSubtitle: { fontSize: 16, color: "#666", textAlign: "center", lineHeight: 22, marginBottom: 16, fontFamily: "Sen_Regular" },
    statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    statusText: { color: "#fff", fontSize: 12, fontFamily: "Sen_Medium" },
    section: { backgroundColor: "#fff", margin: 16, marginTop: 0, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#e0e0e0" },
    sectionTitle: { fontSize: 18, marginBottom: 16, color: "#1a1a1a", fontFamily: "Sen_Bold" },
    deliveryInfo: { flexDirection: "row", alignItems: "center" },
    deliveryText: { marginLeft: 12 },
    deliveryLabel: { fontSize: 14, color: "#666", marginBottom: 4, fontFamily: "Sen_Regular" },
    deliveryTime: { fontSize: 16, color: "#28a745", fontFamily: "Sen_Medium" },
    detailsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    detailItem: { width: "48%", marginBottom: 12 },
    detailLabel: { fontSize: 12, color: "#666", marginBottom: 4, fontFamily: "Sen_Regular" },
    detailValue: { fontSize: 14, color: "#333", fontFamily: "Sen_Medium" },
    actionGrid: { flexDirection: "row", justifyContent: "space-around" },
    actionButton: { alignItems: "center", padding: 12, flex: 1, maxWidth: 150 },
    actionText: { marginTop: 8, fontSize: 12, color: "#666", fontFamily: "Sen_Medium" },
    summaryGrid: { marginTop: 8 },
    summaryItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, },
    totalItem: { borderBottomWidth: 0, paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: "#e0e0e0" },
    summaryLabel: { color: "#666", fontSize: 14, fontFamily: "Sen_Regular" },
    summaryValue: { color: "#333", fontSize: 14, fontFamily: "Sen_Medium" },
    discountValue: { color: "#28a745" },
    totalLabel: { fontSize: 16, color: "#1a1a1a", fontFamily: "Sen_Bold" },
    totalValue: { fontSize: 18, color: "#28a745", fontFamily: "Sen_Bold" },
    orderItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    itemDetails: { flex: 1 },
    itemName: { fontSize: 14, color: "#333", marginBottom: 4, fontFamily: "Sen_Medium" },
    itemQuantity: { fontSize: 12, color: "#666", fontFamily: "Sen_Regular" },
    itemPrice: { fontSize: 14, color: "#333", fontFamily: "Sen_Medium" },
    timeline: { marginTop: 8 },
    timelineStep: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#28a745", marginRight: 12 },
    timelineText: { color: "#666", fontSize: 14, fontFamily: "Sen_Regular" },
    footer: { padding: 20, paddingBottom: Platform.OS === 'android' ? 20 : 30, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e0e0e0", borderWidth: 1, borderColor: "#e0e0e0", },
    primaryButton: { backgroundColor: "#28a745", padding: 16, borderRadius: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", marginBottom: 12, shadowColor: "#28a745", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryButtonText: { color: "#fff", fontSize: 16, marginLeft: 8, fontFamily: "Sen_Bold" },
    secondaryButton: { padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#28a745" },
    secondaryButtonText: { color: "#28a745", fontSize: 16, fontFamily: "Sen_Medium" },
});