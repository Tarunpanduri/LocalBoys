import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
  StatusBar,
  Animated,
  Platform,
  Modal
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// 🔥 FIXED: NATIVE FIREBASE IMPORT 🔥
import { auth } from "../firebase";

// IMPORT ZUSTAND STORE & CONTEXTS
import { useShopStore } from "../store/shopStore";
import { useAdmin } from "../context/AdminContext";
import { useUser } from "../context/UserContext";

// IMPORT COMPONENTS
import AddressesBottomSheet from "../components/AddressesBottomSheet"; 
import CustomOrderBottomSheet from "../components/CustomOrderBottomSheet";
import BottomNav from "../components/BottomNav";

const { width } = Dimensions.get("window");

// --- SKELETON COMPONENT ---
const SkeletonItem = ({ width, height, style, borderRadius = 4 }) => {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [width]);

  return (
    <View style={[{ width, height, backgroundColor: "#E1E9EE", borderRadius, overflow: "hidden" }, style]}>
      <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateX }] }}>
        <LinearGradient
          colors={["transparent", "rgba(255, 255, 255, 0.6)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>
    </View>
  );
};

// --- LOADING SCREEN ---
const SkeletonLoadingScreen = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />
      <LinearGradient colors={["#E0E0E0", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }} />
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <View style={styles.deliveryCol}>
            <SkeletonItem width={60} height={12} style={{ marginBottom: 6 }} />
            <SkeletonItem width={150} height={16} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SkeletonItem width={36} height={36} borderRadius={5} />
            <SkeletonItem width={36} height={36} borderRadius={5} />
          </View>
        </View>
        <View style={styles.mediumcontent}>
          <SkeletonItem width="100%" height={50} borderRadius={12} style={{ marginBottom: 20 }} />
          <SkeletonItem width={width - 36} height={(width - 100) * 0.5} borderRadius={10} style={{ marginBottom: 20 }} />
          <View style={styles.sectionHeader}><SkeletonItem width={100} height={20} /></View>
          <View style={{ flexDirection: "row", marginTop: 10, marginBottom: 15, gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonItem key={i} width={80} height={35} borderRadius={10} />
            ))}
          </View>
          {[1, 2].map((i) => (
            <View key={i} style={[styles.shopCard, { borderWidth: 0, elevation: 0 }]}>
              <SkeletonItem width="100%" height={Math.round(width * 0.38)} borderRadius={0} />
              <View style={styles.shopInfo}>
                <SkeletonItem width={180} height={18} style={{ marginBottom: 8 }} />
                <SkeletonItem width={120} height={14} style={{ marginBottom: 12 }} />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <SkeletonItem width={40} height={12} />
                  <SkeletonItem width={40} height={12} />
                  <SkeletonItem width={40} height={12} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- MEMOIZED SHOP CARD ---
const ShopCard = React.memo(({ shop, onPress }) => (
  <TouchableOpacity style={styles.shopCard} onPress={() => onPress(shop.id, shop)}>
    <Image source={{ uri: shop.image }} style={styles.shopImage} resizeMode="cover" />
    <View style={styles.shopInfo}>
      <Text style={styles.shopName}>{shop.name}</Text>
      <View style={styles.shopMetaRow}>
        <View style={styles.metaItem}><FontAwesome5 name="star" size={14} /><Text style={styles.metaText}> {shop.rating ?? "—"}</Text></View>
        <View style={[styles.metaItem, { marginLeft: 12 }]}><MaterialIcons name="local-shipping" size={16} /><Text style={styles.metaText}> Free</Text></View>
        <View style={[styles.metaItem, { marginLeft: 12 }]}><Ionicons name="time-outline" size={16} /><Text style={styles.metaText}> {shop.deliveryTime ?? `${shop.avgPrepTime ?? "—"} min`}</Text></View>
      </View>
    </View>
  </TouchableOpacity>
));

export default function HomeScreen({ navigation }) {
  const shops = useShopStore((state) => state.shops);
  const shopsLoading = useShopStore((state) => state.loading);
  const fetchNearbyShops = useShopStore((state) => state.fetchNearbyShops);

  const { categoryMeta, loading: adminLoading, determineBranches, branchConfigs, activeBranchIds } = useAdmin();
  const { userLocation, mainAddress, loading: userLoading } = useUser();

  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("products"); 

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [modalFeatureText, setModalFeatureText] = useState("");

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
  });

  // REFS
  const fetchDebounceTimer = useRef(null);
  const addressesSheetRef = useRef(null); 
  const customOrderSheetRef = useRef(null); 

  // --- TRIGGERS ---
  const handleLocationPress = () => {
    // 🔥 FIXED: Native Auth Current User
    const authUser = auth.currentUser;
    if (authUser) {
      addressesSheetRef.current?.expand();
    } else {
      navigation.navigate("MapScreen", { isGuest: true, mode: 'edit', initial: userLocation });
    }
  };

  const handleProfilePress = () => {
    // 🔥 FIXED: Native Auth Current User
    const authUser = auth.currentUser;
    if (authUser) {
      navigation.navigate("Profile");
    } else {
      setModalFeatureText("access your profile and settings");
      setLoginModalVisible(true);
    }
  };

  const handleTrackOrderPress = () => {
    // 🔥 FIXED: Native Auth Current User
    const authUser = auth.currentUser;
    if (authUser) {
      navigation.navigate("TrackOrder");
    } else {
      setModalFeatureText("track your active orders");
      setLoginModalVisible(true);
    }
  };

  const handleShopPress = useCallback((shopId, shop) => {
    navigation.navigate("ShopDetails", { shopId, shop });
  }, [navigation]);

  const openCustomOrderSheet = () => {
    customOrderSheetRef.current?.expand();
  };

  // --- Auto-open bottom sheet if no address ---
  const hasValidLocation = useMemo(() => {
    return userLocation && userLocation.lat && userLocation.lng;
  }, [userLocation]);

  useEffect(() => {
    if (!hasValidLocation && !userLoading) {
      const timer = setTimeout(() => {
        addressesSheetRef.current?.expand();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [hasValidLocation, userLoading]);

  useEffect(() => {
    if (userLocation?.lat && userLocation?.lng) {
      determineBranches(userLocation.lat, userLocation.lng, userLocation.pincode);
    }
  }, [userLocation?.lat, userLocation?.lng, userLocation?.pincode, determineBranches]);

  useEffect(() => {
    if (userLoading || adminLoading || activeBranchIds.length === 0 || !userLocation?.lat || !userLocation?.lng) return;

    if (fetchDebounceTimer.current) {
      clearTimeout(fetchDebounceTimer.current);
    }

    fetchDebounceTimer.current = setTimeout(() => {
      fetchNearbyShops(
        userLocation.lat,
        userLocation.lng,
        activeBranchIds,
        branchConfigs,
        false
      );
    }, 300);

    return () => {
      if (fetchDebounceTimer.current) {
        clearTimeout(fetchDebounceTimer.current);
      }
    };
  }, [userLocation?.lat, userLocation?.lng, activeBranchIds, branchConfigs, userLoading, adminLoading, fetchNearbyShops]);

  const { filteredShops, dynamicCategories } = useMemo(() => {
    if (!shops) return { filteredShops: [], dynamicCategories: [{ id: "all", label: "All" }] };

    let result = shops.filter((s) => s.isActive !== false && activeBranchIds.includes(s.parentBranchId));

    result = result.filter((s) =>
      activeTab === "products"
        ? s.category?.toLowerCase() === "products"
        : s.category?.toLowerCase() === "services"
    );

    let shopsForDisplay = [...result];

    if (activeCategory !== "all") {
      shopsForDisplay = shopsForDisplay.filter((s) =>
        s.type?.toLowerCase().includes(activeCategory.toLowerCase())
      );
    }

    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      shopsForDisplay = shopsForDisplay.filter((s) =>
        s.name?.toLowerCase().includes(lowerSearch) ||
        s.type?.toLowerCase().includes(lowerSearch)
      );
    }

    const shopTypes = Array.from(new Set(result.map((s) => s.type?.trim()))).filter(Boolean).map((t) => ({ id: t.toLowerCase(), label: t }));
    const finalCats = [{ id: "all", label: "All" }, ...shopTypes];

    return { filteredShops: shopsForDisplay, dynamicCategories: finalCats };
  }, [shops, activeCategory, searchText, activeTab, activeBranchIds]);

  const filteredCategories = useMemo(() => {
    return dynamicCategories.filter((c) => {
      if (c.id === "all") {
        return shops?.some(s => s.isActive !== false && activeBranchIds.includes(s.parentBranchId) && s.category?.toLowerCase() === activeTab);
      }
      return shops?.some((s) =>
        s.isActive !== false &&
        activeBranchIds.includes(s.parentBranchId) &&
        s.category?.toLowerCase() === activeTab &&
        s.type?.toLowerCase() === c.label.toLowerCase()
      );
    });
  }, [dynamicCategories, shops, activeTab, activeBranchIds]);

  const onRefresh = useCallback(async () => {
    if (userLocation?.lat && userLocation?.lng && activeBranchIds.length > 0) {
      setRefreshing(true);
      determineBranches(userLocation.lat, userLocation.lng, userLocation.pincode);
      await fetchNearbyShops(userLocation.lat, userLocation.lng, activeBranchIds, branchConfigs, true);
      setRefreshing(false);
    }
  }, [userLocation?.lat, userLocation?.lng, userLocation?.pincode, activeBranchIds, branchConfigs, fetchNearbyShops, determineBranches]);

  const activeCategoryColor = categoryMeta[dynamicCategories.find((c) => c.id === activeCategory)?.label]?.Theme || "#66BB6A";

  const darkenColor = (hex, percent) => {
    if (!hex) return "#66BB6A";
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) - amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) - amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) - amt));
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  };

  const handleCategoryPress = useCallback((id) => setActiveCategory(id), []);

  const renderCategory = ({ item }) => {
    const active = item.id === activeCategory;
    const meta = categoryMeta[item.label] || {};
    const themeColor = meta.Theme || "#8CCF8C";
    const darkenedColor = darkenColor(themeColor, 25);
    const iconName = meta.Icon || "apps-outline";
    return (
      <TouchableOpacity onPress={() => handleCategoryPress(item.id)} style={[styles.categoryChip, active && { backgroundColor: darkenedColor, borderColor: darkenedColor }]}>
        <Ionicons name={iconName} size={16} color={active ? "#fff" : themeColor} style={{ marginRight: 6 }} />
        <Text style={[styles.categoryLabel, active && { color: "#fff", fontFamily: "Sen_Bold" }]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  // --- Show loading states ---
  if (shopsLoading || adminLoading || userLoading || !fontsLoaded) {
    return <SkeletonLoadingScreen />;
  }

  // --- No Address View ---
  if (!hasValidLocation) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />
          <LinearGradient colors={["#66BB6A", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }} />
          <View style={styles.noAddressContainer}>
            <Ionicons name="location-outline" size={80} color="#ccc" />
            <Text style={styles.noAddressTitle}>No delivery address set</Text>
            <Text style={styles.noAddressSub}>Please add an address to see shops and services near you.</Text>
            <TouchableOpacity style={styles.addAddressButton} onPress={() => navigation.navigate("MapScreen" )}>
              <Text style={styles.addAddressButtonText}>Add Address</Text>
            </TouchableOpacity>
          </View>
          {/* 🔥 PASS SETACTIVETAB HERE */}
          <AddressesBottomSheet bottomSheetRef={addressesSheetRef} navigation={navigation} setActiveTab={setActiveTab} />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // --- Normal content when address exists ---
  const renderContent = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categories</Text>
      </View>
      <View style={{ height: 60 }}>
        <FlatList
          data={filteredCategories}
          horizontal
          keyExtractor={(i) => i.id || Math.random().toString()}
          renderItem={renderCategory}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 5 }}
        />
      </View>
      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={({ item }) => <ShopCard shop={item} onPress={handleShopPress} />}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptytext}>
              {activeBranchIds.length > 0
                ? `No ${activeTab === "products" ? "products" : "services"} available in this area.`
                : "Service not available at your location yet."}
            </Text>
          </View>
        )}
      />
    </>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <StatusBar barStyle="dark-content" backgroundColor="#19212a" translucent={false} />
        <LinearGradient colors={[activeCategoryColor || "#66BB6A", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }} />
        
        <View style={styles.screen}>
          <View style={styles.headerRow}>
            <View style={styles.deliveryCol}>
              <Text style={[styles.deliverLabel, { color: darkenColor(activeCategoryColor, 40) }]}>Deliver To</Text>
              <TouchableOpacity style={styles.locationRow} onPress={handleLocationPress}>
                <Text style={styles.locationText} numberOfLines={1}>
                  {mainAddress ? mainAddress.name || mainAddress.city || mainAddress.formattedAddress || "Unnamed address" : userLocation?.city ? `${userLocation.city}, ${userLocation.state}` : "Select Location"}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity style={styles.notifBtn} onPress={handleTrackOrderPress}>
                <Ionicons name="cart" size={28} color={darkenColor(activeCategoryColor, 50)} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.notifBtn} onPress={handleProfilePress}>
                <Ionicons name="person-circle-outline" size={28} color={darkenColor(activeCategoryColor, 50)} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mediumcontent}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} style={{ marginRight: 8 }} />
              <TextInput placeholder="Search products or services" placeholderTextColor="#666" style={styles.searchInput} value={searchText} onChangeText={setSearchText} returnKeyType="search" />
            </View>

            {renderContent()}
          </View>

          <BottomNav 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            setActiveCategory={setActiveCategory}
            activeCategoryColor={activeCategoryColor}
            openCustomOrderSheet={openCustomOrderSheet}
          />
        </View>

        {/* MODAL ALWAYS RENDERS ABOVE EVERYTHING */}
        <Modal animationType="fade" transparent={true} visible={loginModalVisible} onRequestClose={() => setLoginModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="person-add-outline" size={36} color="#009688" />
              </View>
              <Text style={styles.modalTitle}>Hello There!</Text>
              <Text style={styles.modalMessage}>You're currently browsing as a guest. To {modalFeatureText}, please log in or create a free account with us to have hassle-free access.</Text>
              <TouchableOpacity style={styles.modalLoginBtn} onPress={() => { setLoginModalVisible(false); navigation.navigate("Login"); }}>
                <Text style={styles.modalLoginText}>Log In / Sign Up</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLoginModalVisible(false)}>
                <Text style={styles.modalCancelText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>

      {/* BOTTOM SHEETS */}
      <CustomOrderBottomSheet 
        bottomSheetRef={customOrderSheetRef} 
        activeCategoryColor={activeCategoryColor} 
        setModalFeatureText={setModalFeatureText}
        setLoginModalVisible={setLoginModalVisible}
        addressesSheetRef={addressesSheetRef}
      />
      {/* 🔥 PASS SETACTIVETAB HERE TOO */}
      <AddressesBottomSheet 
        bottomSheetRef={addressesSheetRef} 
        navigation={navigation} 
        setActiveTab={setActiveTab}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#19212a" },
  containerCentered: { flex: 1, justifyContent: "center", alignItems: "center" },
  screen: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 },
  deliveryCol: { flex: 1, paddingRight: 10 },
  deliverLabel: { fontSize: Platform.OS === 'ios' ? 12 : 13, fontFamily: "Sen_Bold", letterSpacing: 0.5 },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  locationText: { fontSize: Platform.OS === 'ios' ? 13 : 14, color: "#000", marginRight: 6, fontFamily: "Sen_Medium", flexShrink: 1 },
  notifBtn: { width: 36, height: 36, borderRadius: 5, justifyContent: "center", alignItems: "center" },
  mediumcontent: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  searchBox: { height: 50, backgroundColor: "#fff", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#ddd" },
  searchInput: { flex: 1, fontSize: Platform.OS === 'ios' ? 12 : 15, fontFamily: "Sen_Regular" },
  banner: { borderRadius: 12 },
  sectionHeader: { marginTop: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: Platform.OS === 'ios' ? 16 : 18, fontFamily: "Sen_Bold", color: "#111", marginBottom: 5 },
  categoryChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fff", marginRight: 10, borderWidth: 1, borderColor: "#ddd" },
  categoryLabel: { fontSize: Platform.OS === 'ios' ? 12 : 14, color: "#333", fontFamily: "Sen_Medium" },
  shopCard: { marginTop: 14, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#ddd", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  shopImage: { width: "100%", height: Math.round(width * 0.38) },
  shopInfo: { padding: 12, borderColor: "#ddd", borderTopWidth: 1 },
  shopName: { fontSize: Platform.OS === 'ios' ? 14 : 16, fontFamily: "Sen_Bold", color: "#222" },
  shopSubtitle: { fontSize: Platform.OS === 'ios' ? 11 : 13, color: "#8b9aa4", marginTop: 4, fontFamily: "Sen_Medium" },
  shopMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: Platform.OS === 'ios' ? 11 : 13, color: "#444", fontFamily: "Sen_Regular" },
  emptyState: { marginTop: 40, alignItems: "center", justifyContent: "center" },
  emptytext: { fontSize: Platform.OS === 'ios' ? 12 : 15, color: "#555", textAlign: "center", paddingHorizontal: 20, fontFamily: "Sen_Regular" },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 20, color: '#111', marginBottom: 10 },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalLoginBtn: { backgroundColor: '#009688', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  modalLoginText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 16 },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { fontFamily: 'Sen_Medium', color: '#888', fontSize: 14 },
  
  // No Address State
  noAddressContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30, marginTop: -50 },
  noAddressTitle: { fontSize: 22, fontFamily: "Sen_Bold", marginTop: 20, color: "#111", textAlign: "center" },
  noAddressSub: { fontSize: 14, fontFamily: "Sen_Medium", color: "#666", textAlign: "center", marginTop: 10, lineHeight: 22 },
  addAddressButton: { backgroundColor: "#009688", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30, marginTop: 30 },
  addAddressButtonText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 16 },
});