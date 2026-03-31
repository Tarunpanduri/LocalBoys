import React, { useEffect, useRef, useState } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator,
  Animated, StatusBar, Modal, ScrollView
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font"; 
import { LinearGradient } from "expo-linear-gradient";

import { useOrderStore } from "../store/orderStore";

const SkeletonItem = ({ width, height, style, borderRadius = 8 }) => {
  const translateX = useRef(new Animated.Value(-width)).current;
  useEffect(() => { Animated.loop(Animated.timing(translateX, { toValue: width, duration: 1000, useNativeDriver: true })).start(); }, [width]);
  return (
    <View style={[{ width, height, backgroundColor: "#E1E9EE", borderRadius, overflow: "hidden" }, style]}>
      <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateX }] }}>
        <LinearGradient colors={["transparent", "rgba(255, 255, 255, 0.6)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "100%", height: "100%" }} />
      </Animated.View>
    </View>
  );
};

const PastOrdersSkeleton = () => (
  <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
    {[1, 2, 3, 4].map(i => (
      <View key={i} style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SkeletonItem width={40} height={40} borderRadius={20} />
            <View style={{ marginLeft: 12 }}>
              <SkeletonItem width={120} height={16} style={{ marginBottom: 6 }} />
              <SkeletonItem width={80} height={12} />
            </View>
          </View>
          <SkeletonItem width={60} height={20} borderRadius={10} />
        </View>
        <View style={styles.divider} />
        <View style={styles.cardFooter}>
          <SkeletonItem width={100} height={14} />
          <SkeletonItem width={60} height={16} />
        </View>
      </View>
    ))}
  </View>
);

export default function PreviousOrders({ navigation }) {
  const { pastOrders, loadingPastOrders, loadingMorePastOrders, hasMorePastOrders, refreshPastOrders, fetchMorePastOrders } = useOrderStore(); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [fontsLoaded] = useFonts({ ...Ionicons.font, ...MaterialIcons.font });

  useEffect(() => { refreshPastOrders(); }, []);

  const getStatusColor = (status) => {
    const s = String(status).toLowerCase();
    if (s === "completed") return { bg: "#E8F5E9", text: "#2E7D32" }; 
    if (s === "cancelled" || s === "rejected") return { bg: "#FFEBEE", text: "#C62828" }; 
    return { bg: "#F5F5F5", text: "#616161" }; 
  };

  const openOrderDetails = (order) => { setSelectedOrder(order); setDetailsModalVisible(true); };

  const renderOrderCard = ({ item: order }) => {
    const statusColors = getStatusColor(order.status);
    const formattedDate = order.createdAt 
      ? new Date(order.createdAt.toMillis ? order.createdAt.toMillis() : order.createdAt).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      : "Unknown Date";

    const itemCount = order.isCustom ? 1 : (order.items ? Object.values(order.items).reduce((acc, curr) => acc + (curr.qty || 1), 0) : 0);
    const shopName = order.isCustom ? "Custom Request" : (order.shopname || "Unknown Shop");
    const coverImg = order.isCustom ? (order.imageUrl ? { uri: order.imageUrl } : require('../assets/logo.png')) : (order.shopimage ? { uri: order.shopimage } : require('../assets/logo.png'));
    const itemLabel = order.isCustom ? "Custom Order" : `${itemCount} ${itemCount === 1 ? 'Item' : 'Items'}`;

    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.8} onPress={() => openOrderDetails(order)}>
        <View style={styles.cardHeader}>
          <View style={styles.shopInfoWrap}>
            <Image source={coverImg} style={styles.shopImage} />
            <View style={styles.shopTextWrap}>
              <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.orderDate}>{formattedDate}</Text>
            </View>
          </View>
          
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>{order.status.toUpperCase()}</Text>
            </View>
            {/* 🔥 SCHEDULED INDICATOR 🔥 */}
            {order.isScheduled && (
              <View style={styles.scheduleBadgeSmall}>
                <Ionicons name="time" size={10} color="#ff7a00" />
                <Text style={styles.scheduleBadgeSmallText}>Scheduled</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <Text style={styles.itemCountText}>
            {itemLabel} • {order.isCustom ? 'Fetch/Delivery' : (order.orderType === 'parcel' ? 'Parcel' : 'Delivery')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.orderTotal}>₹{order.total || '--'}</Text>
            <Ionicons name="chevron-forward" size={16} color="#aaa" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (loadingMorePastOrders) return <View style={styles.footerLoader}><ActivityIndicator size="small" color="#4CAF50" /></View>;
    if (hasMorePastOrders && pastOrders.length >= 10) return <TouchableOpacity style={styles.viewMoreBtn} onPress={fetchMorePastOrders}><Text style={styles.viewMoreText}>View More Orders</Text></TouchableOpacity>;
    if (!hasMorePastOrders && pastOrders.length > 0) return <View style={styles.footerLoader}><Text style={styles.endOfListText}>You've reached the end of your order history.</Text></View>;
    return null;
  };

  const renderDetailsModal = () => {
    if (!selectedOrder) return null;
    const statusColors = getStatusColor(selectedOrder.status);
    const formattedDate = selectedOrder.createdAt 
      ? new Date(selectedOrder.createdAt.toMillis ? selectedOrder.createdAt.toMillis() : selectedOrder.createdAt).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      : "Unknown Date";

    const shopName = selectedOrder.isCustom ? "Custom Request" : (selectedOrder.shopname || "Unknown Shop");
    const coverImg = selectedOrder.isCustom ? (selectedOrder.imageUrl ? { uri: selectedOrder.imageUrl } : require('../assets/logo.png')) : (selectedOrder.shopimage ? { uri: selectedOrder.shopimage } : require('../assets/logo.png'));

    return (
      <Modal animationType="slide" transparent={true} visible={detailsModalVisible} onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Order Details</Text>
                <Text style={styles.modalOrderId}>ID: #{selectedOrder.id.slice(-8).toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalShopRow}>
                <Image source={coverImg} style={styles.modalShopImage} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.modalShopName}>{shopName}</Text>
                  <Text style={styles.modalDate}>Placed: {formattedDate}</Text>
                  {/* 🔥 FULL SCHEDULE TIMESTAMP IN DETAILS 🔥 */}
                  {selectedOrder.isScheduled && selectedOrder.scheduledAt && (
                    <Text style={styles.modalScheduledDate}>
                      <Ionicons name="time" size={10} color="#ff7a00" /> Scheduled: {selectedOrder.scheduledAt}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
                  <Text style={[styles.statusText, { color: statusColors.text }]}>{selectedOrder.status.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.sectionHeading}>Order Description</Text>
              
              {selectedOrder.isCustom ? (
                <View style={{ backgroundColor: '#F3F6FA', padding: 15, borderRadius: 10 }}>
                   <Text style={[styles.receiptItemName, { fontStyle: 'italic', color: '#555' }]}>"{selectedOrder.note}"</Text>
                </View>
              ) : (
                selectedOrder.items && Object.values(selectedOrder.items).map((item, index) => (
                  <View key={index} style={styles.receiptItem}>
                    <View style={styles.receiptItemLeft}>
                      <Text style={styles.receiptItemQty}>{item.qty}x</Text>
                      <Text style={styles.receiptItemName}>{item.productname}</Text>
                    </View>
                    <Text style={styles.receiptItemPrice}>₹{item.price * item.qty}</Text>
                  </View>
                ))
              )}

              <View style={styles.modalDivider} />

              {!selectedOrder.isCustom && <View style={styles.billRow}><Text style={styles.billLabel}>Item Total</Text><Text style={styles.billValue}>₹{selectedOrder.subtotal}</Text></View>}
              {selectedOrder.discount > 0 && <View style={styles.billRow}><Text style={styles.billLabel}>Discount</Text><Text style={[styles.billValue, { color: '#2E7D32' }]}>- ₹{selectedOrder.discount}</Text></View>}
              {!selectedOrder.isCustom && <View style={styles.billRow}><Text style={styles.billLabel}>Delivery Fee</Text><Text style={styles.billValue}>₹{selectedOrder.deliveryFee}</Text></View>}
              
              {/* 🔥 FIXED: ADDED PLATFORM FEE DISPLAY 🔥 */}
              {!selectedOrder.isCustom && selectedOrder.platformFee !== undefined && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Platform Fee</Text>
                  <Text style={styles.billValue}>₹{selectedOrder.platformFee}</Text>
                </View>
              )}

              <View style={[styles.billRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Paid via {selectedOrder.paymentMode || 'N/A'}</Text>
                <Text style={styles.grandTotalValue}>₹{selectedOrder.total || '--'}</Text>
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.sectionHeading}>Delivery Details</Text>
              <View style={styles.addressBox}>
                <Ionicons name="location" size={20} color="#009688" style={{ marginTop: 2 }} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.addressType}>{selectedOrder.orderType === 'parcel' ? 'Drop Address' : 'Delivery Address'}</Text>
                  <Text style={styles.addressText}>{selectedOrder.dropAddress?.formattedAddress || selectedOrder.address || selectedOrder.deliveryAddress?.formattedAddress || "N/A"}</Text>
                </View>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color="#111" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
        <View style={{ width: 40 }} /> 
      </View>

      {loadingPastOrders ? <PastOrdersSkeleton /> : pastOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No past orders</Text>
          <Text style={styles.emptySub}>You haven't placed any orders yet. Start exploring shops near you!</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate("HomeScreen")}><Text style={styles.browseBtnText}>Browse Shops</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={pastOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderFooter}
          refreshing={loadingPastOrders}
          onRefresh={refreshPastOrders}
        />
      )}
      {renderDetailsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: "Sen_Bold", color: "#111" },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  orderCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#eee', shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  shopInfoWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  shopImage: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#eee' },
  shopTextWrap: { marginLeft: 12, flex: 1 },
  shopName: { fontFamily: "Sen_Bold", fontSize: 16, color: "#111", marginBottom: 4 },
  orderDate: { fontFamily: "Sen_Medium", fontSize: 12, color: "#777" },
  
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontFamily: "Sen_Bold", fontSize: 10, letterSpacing: 0.5 },
  scheduleBadgeSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-end' },
  scheduleBadgeSmallText: { color: '#ff7a00', fontSize: 9, fontFamily: 'Sen_Bold', marginLeft: 2 },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCountText: { fontFamily: "Sen_Medium", fontSize: 13, color: "#555" },
  orderTotal: { fontFamily: "Sen_Bold", fontSize: 16, color: "#111" },
  viewMoreBtn: { marginVertical: 20, backgroundColor: '#E8F5E9', paddingVertical: 12, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#C8E6C9' },
  viewMoreText: { color: '#2E7D32', fontFamily: 'Sen_Bold', fontSize: 14 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  endOfListText: { fontFamily: 'Sen_Medium', color: '#999', fontSize: 12 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30, paddingBottom: 50 },
  emptyTitle: { fontFamily: "Sen_Bold", fontSize: 20, color: "#222", marginTop: 20 },
  emptySub: { fontFamily: "Sen_Regular", fontSize: 14, color: "#666", textAlign: "center", marginTop: 10, lineHeight: 22 },
  browseBtn: { marginTop: 25, backgroundColor: "#4CAF50", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30 },
  browseBtnText: { fontFamily: "Sen_Bold", fontSize: 15, color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 20, fontFamily: 'Sen_Bold', color: '#111' },
  modalOrderId: { fontSize: 12, fontFamily: 'Sen_Medium', color: '#888', marginTop: 4 },
  closeBtn: { padding: 4, backgroundColor: '#f5f5f5', borderRadius: 16 },
  modalScrollContent: { padding: 20, paddingBottom: 40 },
  modalShopRow: { flexDirection: 'row', alignItems: 'center' },
  modalShopImage: { width: 50, height: 50, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  modalShopName: { fontSize: 16, fontFamily: 'Sen_Bold', color: '#111', marginBottom: 4 },
  modalDate: { fontSize: 12, fontFamily: 'Sen_Regular', color: '#777' },
  modalScheduledDate: { fontSize: 11, fontFamily: 'Sen_Bold', color: '#ff7a00', marginTop: 2 },
  modalDivider: { height: 1, borderBottomWidth: 1, borderBottomColor: '#eee', borderStyle: 'dashed', marginVertical: 20 },
  sectionHeading: { fontSize: 16, fontFamily: 'Sen_Bold', color: '#111', marginBottom: 15 },
  receiptItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptItemLeft: { flexDirection: 'row', flex: 1, paddingRight: 15 },
  receiptItemQty: { fontSize: 14, fontFamily: 'Sen_Bold', color: '#4CAF50', marginRight: 10, width: 20 },
  receiptItemName: { fontSize: 14, fontFamily: 'Sen_Medium', color: '#333', flex: 1, lineHeight: 20 },
  receiptItemPrice: { fontSize: 14, fontFamily: 'Sen_Bold', color: '#111' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, fontFamily: 'Sen_Regular', color: '#555' },
  billValue: { fontSize: 14, fontFamily: 'Sen_Medium', color: '#111' },
  grandTotalRow: { marginTop: 5, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
  grandTotalLabel: { fontSize: 14, fontFamily: 'Sen_Medium', color: '#555' },
  grandTotalValue: { fontSize: 18, fontFamily: 'Sen_Bold', color: '#111' },
  addressBox: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  addressType: { fontSize: 12, fontFamily: 'Sen_Bold', color: '#555', marginBottom: 4 },
  addressText: { fontSize: 14, fontFamily: 'Sen_Regular', color: '#111', lineHeight: 20 },
});