import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";

const STATUS_STEPS = [
  { key: "pending", label: "Your order has been received" },
  { key: "accepted", label: "The restaurant is preparing your food" },
  { key: "ready", label: "Your order is ready for pickup" },
  { key: "picked_up", label: "Your order has been picked up for delivery" },
  { key: "delivered", label: "Order arriving soon!" },
];

const TrackOrder = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ordersRef = ref(db, `orders/${uid}`);
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.entries(data)
          .map(([id, order]) => ({ id, ...order }))
          .filter((order) => order.status !== "delivered");
        setOrders(formatted);
        if (!selectedOrder && formatted.length > 0) setSelectedOrder(formatted[0]);
      } else {
        setOrders([]);
        setSelectedOrder(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#4CAF50" /></SafeAreaView>;
  if (orders.length === 0) return (
    <SafeAreaView style={styles.center}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.noOrders}>We are always waiting for your orders.</Text>
    </SafeAreaView>
  );

  const renderOrderCard = (order) => (
    <TouchableOpacity key={order.id} style={[styles.orderCard, selectedOrder?.id === order.id && styles.orderCardSelected]} onPress={() => setSelectedOrder(order)} activeOpacity={0.8}>
      <Image source={{ uri: order.shopimage }} style={styles.shopImage} resizeMode="cover" />
      <View style={styles.cardInfo}>
        <Text style={styles.cardShop} numberOfLines={1}>{order.shopname}</Text>
        <Text style={styles.cardId}>#{order.id.slice(-6)}</Text>
        <Text style={[styles.cardStatus, order.status === "pending" && { color: "#FF9800" }, order.status === "accepted" && { color: "#2196F3" },order.status === "ready" && { color: "#f68afaff" }, order.status === "picked_up" && { color: "#9C27B0" }, order.status === "REJECTED" && { color: "#ff0000ff" }, order.status === "delivered" && { color: "#4CAF50" }]}>{order.status.replace("_", " ").toUpperCase()}</Text>
        <Text style={styles.cardTotal}>₹{order.total}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTrackingStep = (step, index, activeIndex) => (
    <View key={step.key} style={styles.stepRow}>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepCircle, index <= activeIndex ? styles.activeCircle : styles.inactiveCircle]} />
        {index < STATUS_STEPS.length - 1 && <View style={[styles.stepLine, index < activeIndex ? styles.activeLine : styles.inactiveLine]} />}
      </View>
      <Text style={[styles.stepLabel, index <= activeIndex ? styles.activeLabel : styles.inactiveLabel]}>{step.label}</Text>
    </View>
  );

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === selectedOrder?.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ marginTop: 20 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("HomeScreen")} hitSlop={{ top: 10, bottom: 10, left: 10 }}>
            <Ionicons name="chevron-back" size={20} color="#10202A" />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Active Orders</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ordersContainer}>
          {orders.map(renderOrderCard)}
        </ScrollView>
      </View>

      <ScrollView style={styles.detailsContainer}>
        <View style={styles.detailsCard}>
          <Text style={styles.shopTitle}>{selectedOrder?.shopname}</Text>
          <Text style={styles.orderTime}>Ordered At {new Date(selectedOrder?.createdAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
          <View style={styles.itemList}>{Object.values(selectedOrder?.items || {}).map((itm, idx) => <Text key={idx} style={styles.itemText}>{itm.qty}x <Text style={styles.itemBold}>{itm.productname}</Text></Text>)}</View>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.summaryValue}>₹{selectedOrder.total}</Text>
            <Text style={styles.summaryLabel}>MODE OF PAYMENT</Text>
            <Text style={styles.summaryValue}>{selectedOrder.paymentMode}</Text>
          </View>
          <View style={styles.timelineContainer}>{STATUS_STEPS.map((step, index) => renderTrackingStep(step, index, currentIndex))}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackOrder;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  logo: { width: 120, height: 120, marginBottom: 20 },
  noOrders: { fontFamily: "Sen_Medium", textAlign: "center", fontSize: 16, color: "#666" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 12 ,marginBottom: 6},
  iconBtn: { width: 38, height: 38, borderRadius: 20, backgroundColor: "#f3f5f7", justifyContent: "center", alignItems: "center",borderWidth: 1, borderColor: "#e1e4e8" },
  sectionTitle: { fontFamily: "Sen_Bold", fontSize: 18, color: "#222", marginHorizontal: 16, marginTop: 10, marginBottom: 6 },
  ordersContainer: { paddingHorizontal: 12, paddingVertical: 8 },
  orderCard: { backgroundColor: "#fff", borderRadius: 12, marginRight: 12, width: 160, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: "transparent" },
  orderCardSelected: { borderColor: "#4CAF50", shadowColor: "#4CAF50", shadowOpacity: 0.3, elevation: 4 },
  shopImage: { width: "100%", height: 90 },
  cardInfo: { padding: 10 },
  cardShop: { fontFamily: "Sen_Bold", fontSize: 15, color: "#222" },
  cardId: { fontFamily: "Sen_Regular", fontSize: 12, color: "#777", marginTop: 2 },
  cardStatus: { fontFamily: "Sen_Medium", fontSize: 12.5, marginTop: 4 },
  cardTotal: { fontFamily: "Sen_Bold", fontSize: 14, marginTop: 6, color: "#111" },
  detailsContainer: { flex: 1, paddingHorizontal: 16 },
  detailsCard: { backgroundColor: "#fff", borderRadius: 12, padding: 18, marginTop: 12, borderWidth: 1, borderColor: "#eee" },
  shopTitle: { fontFamily: "Sen_Bold", fontSize: 18, color: "#222" },
  orderTime: { fontFamily: "Sen_Regular", fontSize: 13, color: "#777", marginTop: 4 },
  itemList: { marginTop: 10 },
  itemText: { fontFamily: "Sen_Regular", fontSize: 15, color: "#444", marginTop: 2 },
  itemBold: { fontFamily: "Sen_Bold" },
  summaryContainer: { alignItems: "center", marginVertical: 16 },
  summaryLabel: { fontFamily: "Sen_Medium", fontSize: 12, color: "#888", marginTop: 10 },
  summaryValue: { fontFamily: "Sen_Bold", fontSize: 22, color: "#111" },
  timelineContainer: { marginTop: 10, marginLeft: 6 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  stepIndicator: { alignItems: "center", marginRight: 10 },
  stepCircle: { width: 12, height: 12, borderRadius: 6 },
  activeCircle: { backgroundColor: "#4CAF50" },
  inactiveCircle: { backgroundColor: "#ccc" },
  stepLine: { width: 2, height: 32, marginTop: 2 },
  activeLine: { backgroundColor: "#4CAF50" },
  inactiveLine: { backgroundColor: "#ccc" },
  stepLabel: { flex: 1, fontFamily: "Sen_Regular", fontSize: 14, lineHeight: 20 },
  activeLabel: { color: "#4CAF50" },
  inactiveLabel: { color: "#999" },
});