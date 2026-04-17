import React, { useEffect, useRef, useMemo, useState } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Animated, Dimensions, Modal 
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font"; 

import { useOrderStore } from "../store/orderStore";

const { width, height } = Dimensions.get("window");

const SkeletonItem = ({ width, height, style, borderRadius = 4 }) => {
  const translateX = useRef(new Animated.Value(-width)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(translateX, { toValue: width, duration: 1000, useNativeDriver: true })).start();
  }, [width]);
  return (
    <View style={[{ width, height, backgroundColor: "#E1E9EE", borderRadius, overflow: "hidden" }, style]}>
      <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateX }] }}>
        <LinearGradient colors={["transparent", "rgba(255, 255, 255, 0.6)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "100%", height: "100%" }} />
      </Animated.View>
    </View>
  );
};

const TrackOrderSkeleton = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={{ marginTop: 20 }}>
        <View style={styles.headerRow}>
          <SkeletonItem width={38} height={38} borderRadius={19} />
          <SkeletonItem width={120} height={20} style={{ marginLeft: 15 }} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginTop: 10 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ marginRight: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' }}>
              <SkeletonItem width={160} height={90} borderRadius={0} />
              <View style={{ padding: 10 }}>
                <SkeletonItem width={100} height={15} style={{ marginBottom: 6 }} />
                <SkeletonItem width={60} height={12} style={{ marginBottom: 6 }} />
                <SkeletonItem width={80} height={12} style={{ marginBottom: 8 }} />
                <SkeletonItem width={40} height={14} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.detailsContainer}>
        <View style={styles.detailsCard}>
          <SkeletonItem width={180} height={22} style={{ marginBottom: 8 }} />
          <SkeletonItem width={120} height={14} style={{ marginBottom: 20 }} />
          <SkeletonItem width="90%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonItem width="70%" height={16} style={{ marginBottom: 25 }} />
          <View style={{ alignItems: 'center', marginBottom: 25 }}>
            <SkeletonItem width={100} height={12} style={{ marginBottom: 8 }} />
            <SkeletonItem width={80} height={24} style={{ marginBottom: 12 }} />
            <SkeletonItem width={120} height={12} style={{ marginBottom: 8 }} />
            <SkeletonItem width={60} height={14} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const STATUS_STEPS = [
  { key: "pending", label: "Your order has been received" },
  { key: "accepted_restaurent", label: "Order Accepted" },
  { key: "ready", label: "Ready for pickup" },
  { key: "accepted_driver", label: "Driver Assigned" },
  { key: "picked_up", label: "Picked up for delivery" },
  { key: "completed", label: "Order Delivered!" },
];

const AnimatedTimelineStep = ({ step, index, activeIndex }) => {
  const isCompleted = index < activeIndex; 
  const isPastOrCurrent = index <= activeIndex; 

  const lineAnim = useRef(new Animated.Value(isCompleted ? 1 : 0)).current;
  const colorAnim = useRef(new Animated.Value(isPastOrCurrent ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(lineAnim, { toValue: isCompleted ? 1 : 0, duration: 400, useNativeDriver: false }),
      Animated.timing(colorAnim, { toValue: isPastOrCurrent ? 1 : 0, duration: 300, useNativeDriver: false })
    ]).start();
  }, [isCompleted, isPastOrCurrent]);

  const circleColor = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#ccc", "#4CAF50"] });
  const textColor = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#999", "#4CAF50"] });
  const lineHeight = lineAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIndicator}>
        <Animated.View style={[styles.stepCircle, { backgroundColor: circleColor }]} />
        {index < STATUS_STEPS.length - 1 && (
          <View style={styles.stepLineContainer}>
            <Animated.View style={[styles.activeStepLine, { height: lineHeight }]} />
          </View>
        )}
      </View>
      <Animated.Text style={[styles.stepLabel, { color: textColor }]}>{step.label}</Animated.Text>
    </View>
  );
};

export default function TrackOrder({ navigation }) {
  const { activeOrders, selectedOrderId, loadingOrders, startListening, selectOrder, stopListening } = useOrderStore(); 
  const [fontsLoaded] = useFonts({ ...Ionicons.font, ...MaterialIcons.font });

  // 🔥 Image Viewer Modal State 🔥
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const selectedOrder = useMemo(() => {
    return activeOrders.find(o => o.id === selectedOrderId) || activeOrders[0];
  }, [activeOrders, selectedOrderId]);

  // Derived array of images to handle both old single string and new array format
  const orderImages = useMemo(() => {
    if (!selectedOrder?.isCustom) return [];
    if (selectedOrder.imageUrls && selectedOrder.imageUrls.length > 0) return selectedOrder.imageUrls;
    if (selectedOrder.imageUrl) return [selectedOrder.imageUrl];
    return [];
  }, [selectedOrder]);

  useEffect(() => {
    startListening(); 
    return () => stopListening(); 
  }, []);

  if (loadingOrders || !fontsLoaded) return <TrackOrderSkeleton />;
  
  if (activeOrders.length === 0) return (
    <SafeAreaView style={styles.center}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.noOrders}>We are always waiting for your orders.</Text>
      <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: "#4CAF50", borderRadius: 8 }} onPress={() => navigation.navigate("HomeScreen")}>
        <Text style={{ color: "#fff", fontFamily: "Sen_Bold" }}>Browse Shops</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const getStatusColor = (status) => {
    const colors = {
      "pending": "#FF9800", "accepted_restaurent": "#2196F3", "ready": "#f68afaff",
      "accepted_driver": "#9C27B0", "picked_up": "#FF5722", "completed": "#4CAF50", "REJECTED": "#ff0000ff"
    };
    return colors[status] || "#666";
  };

  const renderOrderCard = (order) => {
    const shopName = order.isCustom ? "Custom Delivery Request" : order.shopname;
    const coverImg = order.isCustom ? (order.imageUrl ? { uri: order.imageUrl } : require('../assets/logo.png')) : { uri: order.shopimage };
    const totalDisplay = order.total ? `₹${order.total}` : (order.isCustom ? 'Calculating...' : '₹0');

    return (
      <TouchableOpacity 
        key={order.id} 
        style={[styles.orderCard, selectedOrder?.id === order.id && styles.orderCardSelected]} 
        onPress={() => selectOrder(order.id)} 
        activeOpacity={0.8}
      >
        <Image source={coverImg} style={styles.shopImage} resizeMode="cover" />
        <View style={styles.cardInfo}>
          <Text style={styles.cardShop} numberOfLines={1}>{shopName}</Text>
          <Text style={styles.cardId}>#{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={[styles.cardStatus, { color: getStatusColor(order.status) }]}>
            {order.status.replace(/_/g, " ").toUpperCase()}
          </Text>
          {order.isScheduled && (
            <View style={styles.scheduleBadgeSmall}>
              <Ionicons name="time" size={10} color="#ff7a00" />
              <Text style={styles.scheduleBadgeSmallText}>Scheduled</Text>
            </View>
          )}
          <Text style={styles.cardTotal}>{totalDisplay}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === selectedOrder?.status);
  const formattedTime = selectedOrder?.createdAt 
    ? new Date(selectedOrder.createdAt.toMillis ? selectedOrder.createdAt.toMillis() : selectedOrder.createdAt).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : "";

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ marginTop: 20 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10 }}>
            <Ionicons name="chevron-back" size={20} color="#10202A" />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Active Orders</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ordersContainer}>
          {activeOrders.map(renderOrderCard)}
        </ScrollView>
      </View>

      <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.detailsCard}>
          <Text style={styles.shopTitle}>{selectedOrder?.isCustom ? "Custom Request" : selectedOrder?.shopname}</Text>
          <Text style={styles.orderTime}>Ordered At {formattedTime}</Text>

          {selectedOrder?.isScheduled && selectedOrder?.scheduledAt && (
             <View style={styles.scheduleBanner}>
                <Ionicons name="calendar" size={20} color="#ff7a00" style={{marginRight: 8}}/>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleBannerTitle}>Scheduled Delivery</Text>
                  <Text style={styles.scheduleBannerText}>{selectedOrder.scheduledAt}</Text>
                </View>
             </View>
          )}
          
          <View style={styles.itemList}>
            {selectedOrder?.isCustom ? (
              <View>
                <Text style={[styles.itemText, { color: '#444', fontStyle: 'italic' }]}>
                  "{selectedOrder.note}"
                </Text>
                
                {/* 🔥 NEW: View Attachments Button 🔥 */}
                {orderImages.length > 0 && (
                  <TouchableOpacity 
                    style={styles.attachmentBtn} 
                    onPress={() => { setCurrentImageIndex(0); setImageModalVisible(true); }}
                  >
                    <Ionicons name="image-outline" size={16} color="#007BFF" />
                    <Text style={styles.attachmentBtnText}>
                      View Attachment{orderImages.length > 1 ? `s (${orderImages.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              Object.values(selectedOrder?.items || {}).map((itm, idx) => (
                <Text key={idx} style={styles.itemText}>{itm.qty}x <Text style={styles.itemBold}>{itm.productname}</Text></Text>
              ))
            )}
          </View>

          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>{selectedOrder?.isCustom && !selectedOrder.total ? "ESTIMATING TOTAL..." : "TOTAL AMOUNT"}</Text>
            <Text style={styles.summaryValue}>{selectedOrder?.total ? `₹${selectedOrder.total}` : '--'}</Text>
            {selectedOrder?.paymentMode && (
              <>
                <Text style={styles.summaryLabel}>MODE OF PAYMENT</Text>
                <Text style={styles.summaryValue}>{selectedOrder.paymentMode}</Text>
              </>
            )}
          </View>
          
          <View style={styles.timelineContainer}>
            {STATUS_STEPS.map((step, index) => (
              <AnimatedTimelineStep key={step.key} step={step} index={index} activeIndex={currentIndex} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 🔥 NEW: IMAGE VIEWER MODAL 🔥 */}
      <Modal visible={imageModalVisible} transparent={true} animationType="fade" onRequestClose={() => setImageModalVisible(false)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalCloseBtn} onPress={() => setImageModalVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.imageViewerContainer}>
            {orderImages.length > 0 && (
              <Image 
                source={{ uri: orderImages[currentImageIndex] }} 
                style={styles.fullScreenImage} 
                resizeMode="contain" 
              />
            )}
          </View>

          {/* Multi-image navigation controls */}
          {orderImages.length > 1 && (
            <View style={styles.imageControls}>
              <TouchableOpacity 
                style={[styles.navBtn, currentImageIndex === 0 && { opacity: 0.5 }]} 
                onPress={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                disabled={currentImageIndex === 0}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.imageCountText}>{currentImageIndex + 1} / {orderImages.length}</Text>
              <TouchableOpacity 
                style={[styles.navBtn, currentImageIndex === orderImages.length - 1 && { opacity: 0.5 }]} 
                onPress={() => setCurrentImageIndex(prev => Math.min(orderImages.length - 1, prev + 1))}
                disabled={currentImageIndex === orderImages.length - 1}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

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
  
  scheduleBadgeSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  scheduleBadgeSmallText: { color: '#ff7a00', fontSize: 9, fontFamily: 'Sen_Bold', marginLeft: 2 },

  cardTotal: { fontFamily: "Sen_Bold", fontSize: 14, marginTop: 6, color: "#111" },
  detailsContainer: { flex: 1, paddingHorizontal: 16 },
  detailsCard: { backgroundColor: "#fff", borderRadius: 12, padding: 18, marginTop: 12, borderWidth: 1, borderColor: "#eee", marginBottom: 30 },
  shopTitle: { fontFamily: "Sen_Bold", fontSize: 18, color: "#222" },
  orderTime: { fontFamily: "Sen_Regular", fontSize: 13, color: "#777", marginTop: 4 },
  
  scheduleBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#ffe0b2' },
  scheduleBannerTitle: { fontFamily: 'Sen_Bold', fontSize: 13, color: '#ff7a00' },
  scheduleBannerText: { fontFamily: 'Sen_Medium', fontSize: 14, color: '#333', marginTop: 2 },

  itemList: { marginTop: 12, backgroundColor: '#F3F6FA', padding: 12, borderRadius: 8 },
  itemText: { fontFamily: "Sen_Regular", fontSize: 15, color: "#444", marginTop: 2 },
  itemBold: { fontFamily: "Sen_Bold" },
  
  // Custom Order Attachment Styles
  attachmentBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#E3F2FD', borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBDEFB' },
  attachmentBtnText: { color: '#007BFF', fontFamily: 'Sen_Bold', fontSize: 12, marginLeft: 6 },

  summaryContainer: { alignItems: "center", marginVertical: 16 },
  summaryLabel: { fontFamily: "Sen_Medium", fontSize: 12, color: "#888", marginTop: 10 },
  summaryValue: { fontFamily: "Sen_Bold", fontSize: 22, color: "#111" },
  timelineContainer: { marginTop: 10, marginLeft: 6 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  stepIndicator: { alignItems: "center", marginRight: 10 },
  stepCircle: { width: 12, height: 12, borderRadius: 6 },
  stepLabel: { flex: 1, fontFamily: "Sen_Regular", fontSize: 14, lineHeight: 20 },
  stepLineContainer: { width: 2, height: 32, marginTop: 2, backgroundColor: "#ccc", overflow: "hidden" },
  activeStepLine: { width: "100%", backgroundColor: "#4CAF50" },

  // Image Modal Styles
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
  imageModalCloseBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  imageViewerContainer: { width: width, height: height * 0.7, justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  imageControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 40, width: '100%', gap: 20 },
  navBtn: { padding: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 30 },
  imageCountText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 16 },
});