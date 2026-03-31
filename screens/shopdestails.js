import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  StatusBar,
  Modal,
  Animated,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-root-toast";
import { useFonts } from "expo-font";

// 🔥 FIXED: NATIVE MODULAR IMPORTS 🔥
import { auth, db } from "../firebase";
import { doc, getDoc } from "@react-native-firebase/firestore";

// --- IMPORT NEW ZUSTAND STORES ---
import { useCartStore } from "../store/cartstore";
import { useProductStore } from "../store/productStore";
import { useAdmin } from "../context/AdminContext";

const { width } = Dimensions.get("window");
const CARD_PADDING = 12, CARD_GUTTER = 12, CARD_WIDTH = Math.round((width - CARD_PADDING * 2 - CARD_GUTTER) / 2);

// --- SKELETON COMPONENTS ---
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

const ShopDetailsSkeleton = () => (
  <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <View style={[styles.headerRow, { marginBottom: 10 }]}>
      <SkeletonItem width={38} height={38} borderRadius={19} />
      <SkeletonItem width={120} height={20} />
      <SkeletonItem width={38} height={38} borderRadius={19} />
    </View>
    <View style={{ paddingHorizontal: CARD_PADDING }}>
      <SkeletonItem width="100%" height={160} borderRadius={18} style={{ marginBottom: 12 }} />
      <SkeletonItem width={200} height={24} style={{ marginBottom: 8 }} />
      <SkeletonItem width="90%" height={14} style={{ marginBottom: 6 }} />
      <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20 }}>
        <SkeletonItem width={50} height={16} />
        <SkeletonItem width={50} height={16} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[1, 2, 3].map(i => <SkeletonItem key={i} width={70} height={32} borderRadius={22} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ width: CARD_WIDTH, marginBottom: CARD_GUTTER, borderRadius: 14, borderWidth: 1, borderColor: '#eee' }}>
            <SkeletonItem width="100%" height={CARD_WIDTH * 0.6} borderRadius={0} />
            <View style={{ padding: 10 }}>
              <SkeletonItem width="90%" height={16} style={{ marginBottom: 6 }} />
              <SkeletonItem width="70%" height={12} style={{ marginBottom: 10 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  </SafeAreaView>
);

export default function ShopDetails({ route, navigation }) {
  const { shopId, shop } = route.params || {};
  const [activeCategory, setActiveCategory] = useState(null);
  const [refreshing, setRefreshing] = useState(false); 
  
  const [isForceReloading, setIsForceReloading] = useState(false);

  // Modals state
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [checkoutAlert, setCheckoutAlert] = useState({
    visible: false,
    title: "",
    message: "",
    icon: "warning-outline",
    btnText: "OK",
    onAction: () => { }
  });

  const { categoryMeta } = useAdmin();

  // --- ZUSTAND STORE HOOKS ---
  const fetchProducts = useProductStore((state) => state.fetchProducts);
  const rawProductsObj = useProductStore((state) => state.menus[shopId]);
  const productsObj = rawProductsObj || {};
  const loading = useProductStore((state) => state.loadingStates[shopId]);
  const lastFetched = useProductStore((state) => state.lastFetchedTimestamps[shopId] || 0);

  const cartData = useCartStore((state) => state.cartData);
  const addToCart = useCartStore((state) => state.addToCart);
  const decreaseQty = useCartStore((state) => state.decreaseQty);
  
  const clearShopCart = useCartStore((state) => state.clearShopCart); 

  const [fontsLoaded] = useFonts({ ...Ionicons.font, ...MaterialIcons.font });

  // CART DERIVED STATE
  const keys = Object.keys(cartData).filter(k => k !== "updatedAt");
  const cartShopId = keys.length > 0 ? keys[0] : null;
  const cartShop = cartShopId ? cartData[cartShopId] : null;
  const cartItems = cartShop ? Object.keys(cartShop).filter(k => !["shopname", "shopimage", "shopphone"].includes(k)).map(key => ({ id: key, ...cartShop[key] })) : [];
  const cartItemCount = cartItems.reduce((count, item) => count + item.qty, 0);

  // --- FETCH DATA (SMART CACHE INVALIDATION) ---
  const shopUpdatedAt = shop?.updatedAt || shop?.lastUpdated || 0;

  useEffect(() => {
    const hasProducts = rawProductsObj && Object.keys(rawProductsObj).length > 0;

    if (shopId && (!hasProducts || shopUpdatedAt > lastFetched)) {
      console.log("Fetching fresh menu for shop...");
      fetchProducts(shopId);
    }
  }, [shopId, fetchProducts, rawProductsObj, shopUpdatedAt, lastFetched]);

  // --- DERIVED MENU DATA ---
  const productsArray = useMemo(() => Object.keys(productsObj).map((pid) => ({ id: pid, ...productsObj[pid] })), [productsObj]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(productsArray.map((p) => p.category || "Other")))], [productsArray]);

  useEffect(() => {
    if (categories.length && !activeCategory) setActiveCategory("All");
  }, [categories, activeCategory]);

  useEffect(() => {
    if (activeCategory && activeCategory !== "All" && !categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [categories, activeCategory]);

  const productsByActiveCategory = useMemo(() => {
    if (!activeCategory || activeCategory === "All") return productsArray;
    return productsArray.filter((p) => (p.category || "Other") === activeCategory);
  }, [productsArray, activeCategory]);

  const getCategoryTheme = useCallback((catLabel) => {
    return catLabel === "All" ? "#28A745" : categoryMeta?.[catLabel]?.Theme || "#28A745";
  }, [categoryMeta]);
  const themeColor = getCategoryTheme(activeCategory);

  const handleAddToCart = (item) => {
    if (!auth.currentUser) return setLoginModalVisible(true);

    const result = addToCart(shop, item);
    if (result && result.conflict) {
      setPendingProduct(item);
      setConflictModalVisible(true);
    }
  };

  const handleForceAddToCart = () => {
    if (pendingProduct) {
      addToCart(shop, pendingProduct, 1, true);
      setConflictModalVisible(false);
      setPendingProduct(null);
    }
  };

  // Pull‑to‑refresh - Also checks for cart conflicts!
  const handleRefresh = async () => {
    if (!shopId) return;
    setRefreshing(true);
    await fetchProducts(shopId);
    
    if (activeCategory && activeCategory !== "All" && !categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
    setRefreshing(false);

    if (cartShopId === shopId && cartItems.length > 0) {
       let invalid = false;
       const freshMenu = useProductStore.getState().menus[shopId];
       if (freshMenu) {
           cartItems.forEach(item => {
              const freshItem = freshMenu[item.id];
              if (!freshItem || freshItem.inStock === false || freshItem.price !== item.price) {
                 invalid = true;
              }
           });
           
           if (invalid) {
              setCheckoutAlert({
                visible: true,
                title: "Menu Updated",
                message: "Some items in your cart had their prices changed or are out of stock. Your cart will be cleared so you can view the fresh menu.",
                icon: "refresh-circle-outline",
                btnText: "Update Menu",
                onAction: async () => {
                  setCheckoutAlert(prev => ({ ...prev, visible: false }));
                  setIsForceReloading(true);
                  clearShopCart(shopId);
                  await fetchProducts(shopId);
                  setIsForceReloading(false);
                }
              });
              return;
           }
       }
    }
    Toast.show("Menu updated", { duration: Toast.durations.SHORT });
  };

  const handleProceedCheckout = async () => {
    if (!cartShopId || !cartItems.length) {
      return Toast.show("Cart is empty.", { duration: Toast.durations.SHORT });
    }

    if (isVerifying) return;
    setIsVerifying(true);

    try {
      // 1. LIVE CHECK: Is the Shop still active?
      const shopRef = doc(db, "shops", cartShopId);
      const shopSnap = await getDoc(shopRef);

      if (!shopSnap.exists || shopSnap.data().isActive === false || shopSnap.data().maintenanceMode === true) {
        setIsVerifying(false);
        setCheckoutAlert({
          visible: true,
          title: "Shop Closed",
          message: "Sorry, this shop is currently closed or not accepting orders.",
          icon: "close-circle-outline",
          btnText: "Go to Home",
          onAction: () => {
            setCheckoutAlert(prev => ({ ...prev, visible: false }));
            navigation.navigate("HomeScreen", { refresh: true });
          }
        });
        return;
      }

      const liveShopData = shopSnap.data();

      // 2. LIVE CHECK: Are items in stock AND are prices correct?
      const itemPromises = cartItems.map(item =>
        getDoc(doc(db, `shops/${cartShopId}/products/${item.id}`))
      );
      const itemSnaps = await Promise.all(itemPromises);

      let outOfStockItems = [];
      let priceChanged = false;

      itemSnaps.forEach((snap, index) => {
        const cartItem = cartItems[index];
        if (snap.exists) {
          const liveProductData = snap.data();

          if (liveProductData.inStock === false) {
            outOfStockItems.push(cartItem.productname);
          }
          if (liveProductData.price !== cartItem.price) {
            priceChanged = true;
          }
        } else {
          outOfStockItems.push(cartItem.productname);
        }
      });

      if (outOfStockItems.length > 0 || priceChanged) {
        setIsVerifying(false);
        
        let title = "Cart Update Required";
        let message = "";
        
        if (outOfStockItems.length > 0) {
          message = `The following items are no longer available:\n\n${outOfStockItems.join(", ")}\n\nYour cart will be cleared so you can view the fresh menu.`;
        } else {
          message = "Some items in your cart had their prices changed by the shop. Your cart will be cleared so you can view the fresh menu.";
        }

        setCheckoutAlert({
          visible: true,
          title: title,
          message: message,
          icon: outOfStockItems.length > 0 ? "cart-outline" : "pricetag-outline",
          btnText: "Update Menu",
          onAction: async () => {
            setCheckoutAlert(prev => ({ ...prev, visible: false }));
            setIsForceReloading(true); 
            clearShopCart(cartShopId); 
            await fetchProducts(cartShopId); 
            setIsForceReloading(false); 
          }
        });
        return;
      }

      const hasRide = cartItems.some(i => i.serviceType === "ride");
      const hasDelivery = cartItems.some(i => i.serviceType === "delivery");
      const shopToPass = { id: cartShopId, ...liveShopData };

      if (hasRide && !hasDelivery) {
        navigation.navigate("Checkout", { shopId: cartShopId, shop: shopToPass, cart: cartShop, orderType: "parcel" });
      } else if (hasDelivery && !hasRide) {
        navigation.navigate("Checkout", { shopId: cartShopId, shop: shopToPass, cart: cartShop, orderType: "delivery" });
      } else {
        setIsVerifying(false);
        setCheckoutAlert({
          visible: true,
          title: "Multiple Service Types",
          message: "Please separate ride and delivery items into different orders.",
          icon: "albums-outline",
          btnText: "OK",
          onAction: () => setCheckoutAlert(prev => ({ ...prev, visible: false }))
        });
      }

    } catch (error) {
      console.error("Checkout verification failed:", error);
      Toast.show("Failed to verify items. Please check your connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  if ((loading && productsArray.length === 0) || !fontsLoaded || isForceReloading) {
    return <ShopDetailsSkeleton />;
  }

  if (!shopId) return <SafeAreaView style={styles.centered}><Text>No shop provided</Text></SafeAreaView>;

  const renderHeader = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#10202A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop Details</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="#10202A" />
        </TouchableOpacity>
      </View>
      <View style={styles.bannerWrap}>
        <Image source={shop?.image ? { uri: shop.image } : { uri: "https://www.trueangle.in/public/assets/img/product-default.png" }} style={styles.banner} resizeMode="cover" />
      </View>
      <View style={styles.info}>
        <Text style={styles.shopName}>{shop?.name}</Text>
        <Text style={styles.shopDesc}>{shop?.description || "No description available."}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}><Ionicons name="star" size={16} color="#28A745" /><Text style={styles.metaText}>{shop?.rating ?? "—"}</Text></View>
          <View style={[styles.metaItem, { marginLeft: 18 }]}><MaterialIcons name="local-shipping" size={16} color="#444" /><Text style={styles.metaText}> Free</Text></View>
          <View style={[styles.metaItem, { marginLeft: 18 }]}><Ionicons name="time-outline" size={16} color="#444" /><Text style={styles.metaText}>{shop?.deliveryTime ?? `${shop?.avgPrepTime ?? "—"} min`}</Text></View>
        </View>
      </View>
      <View style={{ marginTop: 18 }}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(i, idx) => `${i}-${idx}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 12 }}
          renderItem={({ item, index }) => {
            const active = activeCategory === item;
            const catColor = getCategoryTheme(item);
            return (
              <TouchableOpacity
                onPress={() => setActiveCategory(item)}
                style={[
                  styles.catChip,
                  active && { backgroundColor: catColor, borderColor: catColor },
                  index === categories.length - 1 && { marginRight: 0 }
                ]}
              >
                <Text style={[styles.catLabel, active && { color: "#fff", fontFamily: "Sen_Bold" }]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
      <View style={{ marginVertical: 12 }}>
        <Text style={styles.sectionHeading}>
          {activeCategory} <Text style={styles.sectionCount}>({productsByActiveCategory.length})</Text>
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <FlatList
        data={productsByActiveCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: CARD_GUTTER }}
        contentContainerStyle={{ paddingHorizontal: CARD_PADDING, paddingBottom: 140 }}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#28A745"]} tintColor="#28A745" />
        }
        renderItem={({ item }) => {
          const cartItem = (cartShopId === shopId && cartShop) ? cartShop[item.id] : null;
          return (
            <View style={styles.productCard}>
              <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
              <View style={styles.productBody}>
                <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productSubtitle} numberOfLines={1}>{item.description || "No description"}</Text>
                <Text style={styles.productquantity}>{item.quantity || "N/A"}</Text>

                <View style={styles.productRow}>
                  <Text style={styles.price}>₹{item.price}</Text>
                  {cartItem ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <TouchableOpacity
                        onPress={() => decreaseQty(shopId, item)}
                        style={[styles.addBtn, { marginRight: 6, backgroundColor: "#ccc" }]}
                      >
                        <Ionicons name="remove" size={18} color="#fff" />
                      </TouchableOpacity>
                      <Text style={{ marginHorizontal: 4 }}>{cartItem.qty}</Text>
                      <TouchableOpacity
                        onPress={() => addToCart(shop, item)}
                        style={[styles.addBtn, { backgroundColor: themeColor }]}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addBtn, { backgroundColor: themeColor }]}
                      onPress={() => handleAddToCart(item)}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                {item.inStock === false && (
                  <Text style={{ color: "red", fontSize: 12, marginTop: 4, fontFamily: 'Sen_Medium' }}>Out of Stock</Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 20 }}>
            <Text style={{ color: "#666", textAlign: "center" }}>No items in this category.</Text>
          </View>
        )}
      />

      {cartShop && cartItemCount > 0 && cartShopId === shopId && (
        <View style={styles.cartBar}>
          <View style={styles.cartInfo}>
            <Image source={{ uri: cartShop.shopimage }} style={styles.cartShopImage} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cartText}>You have {cartItemCount} {cartItemCount > 1 ? "items" : "item"}</Text>
              <Text style={styles.cartSubText}>from {cartShop.shopname}</Text>
            </View>
            <View style={styles.cartActions}>
              <TouchableOpacity style={[styles.cartBtn, { backgroundColor: "#ccc" }]} onPress={() => clearShopCart(shopId)}>
                <Text style={styles.cartBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cartBtn, { backgroundColor: isVerifying ? "#888" : "#28A745" }]}
                onPress={handleProceedCheckout}
                disabled={isVerifying}
              >
                <Text style={[styles.cartBtnText, { color: "#fff" }]}>
                  {isVerifying ? "Verifying..." : "Checkout"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Login Modal */}
      <Modal animationType="fade" transparent={true} visible={loginModalVisible} onRequestClose={() => setLoginModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}><Ionicons name="cart-outline" size={40} color="#28A745" /></View>
            <Text style={styles.modalTitle}>Ready to Order?</Text>
            <Text style={styles.modalMessage}>Please log in to add items to your cart and track your order easily.</Text>
            <TouchableOpacity style={styles.modalLoginBtn} onPress={() => { setLoginModalVisible(false); navigation.navigate("Login"); }}>
              <Text style={styles.modalLoginText}>Log In / Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLoginModalVisible(false)}>
              <Text style={styles.modalCancelText}>I'm just browsing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Conflict (Start New Basket) Modal */}
      <Modal animationType="fade" transparent={true} visible={conflictModalVisible} onRequestClose={() => setConflictModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FFEBEB' }]}>
              <Ionicons name="warning-outline" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Start new basket?</Text>
            <Text style={styles.modalMessage}>Your cart contains items from another shop. Do you want to clear it and add items from {shop?.name}?</Text>
            <TouchableOpacity style={styles.modalLoginBtn} onPress={handleForceAddToCart}>
              <Text style={styles.modalLoginText}>Yes, Start New</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setConflictModalVisible(false); setPendingProduct(null); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dynamic Checkout Alert Modal */}
      <Modal animationType="fade" transparent={true} visible={checkoutAlert.visible} onRequestClose={checkoutAlert.onAction}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FFEBEB' }]}>
              <Ionicons name={checkoutAlert.icon} size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>{checkoutAlert.title}</Text>
            <Text style={styles.modalMessage}>{checkoutAlert.message}</Text>
            <TouchableOpacity style={[styles.modalLoginBtn, { backgroundColor: '#FF3B30' }]} onPress={checkoutAlert.onAction}>
              <Text style={styles.modalLoginText}>{checkoutAlert.btnText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  headerRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 20, backgroundColor: "#f3f5f7", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Sen_Medium", color: "#10202A" },
  bannerWrap: { marginTop: 14 },
  banner: { width: "100%", height: 160, borderRadius: 18, overflow: "hidden", borderColor: "#ddd", borderWidth: 1 },
  info: { paddingHorizontal: Platform.OS === 'ios' ? 10 : 12, marginTop: 12 },
  shopName: { fontSize: Platform.OS === 'ios' ? 16 : 20, fontFamily: "Sen_Bold", color: "#0b1b22", marginBottom: 8 },
  shopDesc: { fontSize: Platform.OS === 'ios' ? 10 : 13, fontFamily: "Sen_Regular", color: "#9aa5ad", lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: Platform.OS === 'ios' ? 10 : 13, fontFamily: "Sen_Medium", color: "#222", marginLeft: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", marginRight: 10, flexDirection: "row", alignItems: "center" },
  catLabel: { fontSize: Platform.OS === 'ios' ? 10 : 14, color: "#333", fontFamily: "Sen_Medium" },
  sectionHeading: { fontSize: Platform.OS === 'ios' ? 14 : 18, fontFamily: "Sen_Bold", color: "#111" },
  sectionCount: { fontSize: 16, color: "#8a98a0", fontFamily: "Sen_Regular" },
  productCard: { width: CARD_WIDTH, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#eee", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  productImage: { width: "100%", height: CARD_WIDTH * 0.6, backgroundColor: "#e6ecf0" },
  productBody: { padding: 10, minHeight: 86, justifyContent: "space-between" },
  productTitle: { fontSize: Platform.OS === 'ios' ? 12 : 16, fontFamily: "Sen_Bold", color: "#111" },
  productSubtitle: { fontSize: Platform.OS === 'ios' ? 10 : 12, fontFamily: "Sen_Regular", color: "#8a98a0", marginTop: 6 },
  productquantity: { fontSize: Platform.OS === 'ios' ? 10 : 12, fontFamily: "Sen_Regular", color: "#8a98a0", marginTop: 2 },
  productRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  price: { fontSize: Platform.OS === 'ios' ? 12 : 15, fontFamily: "Sen_Bold", color: "#222" },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  cartBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#ddd", padding: 12, paddingBottom: 23, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cartInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  cartShopImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e6ecf0" },
  cartText: { fontSize: Platform.OS === 'ios' ? 10 : 14, fontFamily: "Sen_Medium", color: "#111" },
  cartSubText: { fontSize: 12, fontFamily: "Sen_Regular", color: "#666", marginTop: 2 },
  cartActions: { flexDirection: "row", alignItems: "center" },
  cartBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginLeft: 10 },
  cartBtnText: { fontSize: Platform.OS === 'ios' ? 10 : 14, fontFamily: "Sen_Medium", color: "#333" },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 20, color: '#111', marginBottom: 10 },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalLoginBtn: { backgroundColor: '#28A745', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  modalLoginText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 16 },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { fontFamily: 'Sen_Medium', color: '#888', fontSize: 14 },
});