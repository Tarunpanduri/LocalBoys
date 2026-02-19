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
import { getAuth } from "firebase/auth";

// 1. IMPORT CONTEXTS
import { useShops } from "../context/ShopContext";
import { useAdmin } from "../context/AdminContext"; 
import { useUser } from "../context/UserContext"; 

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

export default function HomeScreen({ navigation }) {
  const { shops, loading: shopsLoading, fetchNearbyShops } = useShops();
  const { categoryMeta, eventUrl, loading: adminLoading, determineBranch, branchConfig, activeBranchId } = useAdmin();
  const { userLocation, mainAddress, loading: userLoading } = useUser(); 

  // UI State
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  
  // Initialize lock to prevent flash of empty content
  const [hasFetchedShops, setHasFetchedShops] = useState(false);
  
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [modalFeatureText, setModalFeatureText] = useState("");

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
  });

  // --- NAVIGATION HANDLERS ---
  const handleLocationPress = () => {
    const auth = getAuth();
    if (auth.currentUser) {
      navigation.navigate("Addresses");
    } else {
      navigation.navigate("MapScreen", { isGuest: true, mode: 'edit', initial: userLocation });
    }
  };

  const handleProfilePress = () => {
    const auth = getAuth();
    if (auth.currentUser) {
      navigation.navigate("Profile");
    } else {
      setModalFeatureText("access your profile and settings");
      setLoginModalVisible(true);
    }
  };

  const handleTrackOrderPress = () => {
    const auth = getAuth();
    if (auth.currentUser) {
      navigation.navigate("TrackOrder");
    } else {
      setModalFeatureText("track your active orders");
      setLoginModalVisible(true);
    }
  };

  // --- 1. COORDINATION EFFECT (BRANCH) ---
  useEffect(() => {
    if (userLocation?.lat && userLocation?.lng) {
      determineBranch(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, determineBranch]);

  // --- 2. COORDINATION EFFECT (FETCH SHOPS WITH GLITCH PREVENTION) ---
  useEffect(() => {
    if (userLoading || adminLoading) return; // Wait for base data

    if (userLocation?.lat && userLocation?.lng && branchConfig?.shopVisibilityRadiusKm) {
      fetchNearbyShops(userLocation.lat, userLocation.lng, branchConfig.shopVisibilityRadiusKm, false);
    }
    
    // We delay unmounting the skeleton by just 50ms so ShopContext's `shopsLoading` 
    // has time to flip to true. This eliminates the empty screen flash.
    const timer = setTimeout(() => {
      setHasFetchedShops(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [userLocation, branchConfig, fetchNearbyShops, userLoading, adminLoading]);


  // --- 3. SYNCHRONOUS FILTERING (REPLACES USEEFFECT TO STOP GLITCH) ---
  const { filteredShops, dynamicCategories } = useMemo(() => {
    if (!shops) return { filteredShops: [], dynamicCategories: [{ id: "all", label: "All" }] };

    let result = shops.filter((s) => s.isActive !== false);

    // Tab Filter
    result = result.filter((s) =>
      activeTab === "products"
        ? s.category?.toLowerCase() === "products"
        : s.category?.toLowerCase() === "services"
    );

    let shopsForDisplay = [...result];

    // Category Filter
    if (activeCategory !== "all") {
      shopsForDisplay = shopsForDisplay.filter((s) =>
        s.type?.toLowerCase().includes(activeCategory.toLowerCase())
      );
    }

    // Search Filter
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
  }, [shops, activeCategory, searchText, activeTab]);

  const filteredCategories = useMemo(() => {
    return dynamicCategories.filter((c) => {
      if (c.id === "all") {
        return shops?.some(s => s.isActive !== false && s.category?.toLowerCase() === activeTab);
      }
      return shops?.some((s) => 
        s.isActive !== false && 
        s.category?.toLowerCase() === activeTab &&
        s.type?.toLowerCase() === c.label.toLowerCase()
      );
    });
  }, [dynamicCategories, shops, activeTab]);


  // --- REFRESH HANDLER ---
  const onRefresh = useCallback(async () => {
    if (userLocation && branchConfig?.shopVisibilityRadiusKm) {
      setRefreshing(true);
      determineBranch(userLocation.lat, userLocation.lng); 
      await fetchNearbyShops(userLocation.lat, userLocation.lng, branchConfig.shopVisibilityRadiusKm, true);
      setRefreshing(false);
    }
  }, [userLocation, branchConfig, fetchNearbyShops, determineBranch]);


  // --- STYLING HELPERS ---
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

  const ShopCard = ({ shop }) => (
    <TouchableOpacity style={styles.shopCard} onPress={() => navigation?.navigate?.("ShopDetails", { shopId: shop.id, shop })}>
      <Image source={{ uri: shop.image }} style={styles.shopImage} resizeMode="cover" />
      <View style={styles.shopInfo}>
        <Text style={styles.shopName}>{shop.name}</Text>
        <Text style={styles.shopSubtitle}>{shop.type} {shop.avgPrepTime ? ` · ${shop.avgPrepTime} min` : ""}</Text>
        <View style={styles.shopMetaRow}>
          <View style={styles.metaItem}><FontAwesome5 name="star" size={14} /><Text style={styles.metaText}> {shop.rating ?? "—"}</Text></View>
          <View style={[styles.metaItem, { marginLeft: 12 }]}><MaterialIcons name="local-shipping" size={16} /><Text style={styles.metaText}> Free</Text></View>
          <View style={[styles.metaItem, { marginLeft: 12 }]}><Ionicons name="time-outline" size={16} /><Text style={styles.metaText}> {shop.deliveryTime ?? `${shop.avgPrepTime ?? "—"} min`}</Text></View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // --- UPDATED LOADING STATE: Includes hasFetchedShops lock ---
  if (shopsLoading || adminLoading || userLoading || !fontsLoaded || !hasFetchedShops) {
    return <SkeletonLoadingScreen />;
  }

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
        renderItem={({ item }) => <ShopCard shop={item} />} 
        contentContainerStyle={{ paddingBottom: 90 }} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} 
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptytext}>
              {activeBranchId ? `No ${activeTab === "products" ? "products" : "services"} available in this area.` : "Service not available at your location yet."}
            </Text>
          </View>
        )}
      />
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#19212a" translucent={false} />
      <LinearGradient colors={[activeCategoryColor || "#66BB6A", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }} />
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <View style={styles.deliveryCol}>
            <Text style={[styles.deliverLabel, { color: darkenColor(activeCategoryColor, 40) }]}>Deliver To</Text>
            
            <TouchableOpacity style={styles.locationRow} onPress={handleLocationPress}>
              <Text style={styles.locationText}>
                {mainAddress ? mainAddress.name || mainAddress.city || mainAddress.formattedAddress || "Unnamed address" : userLocation?.city ? `${userLocation.city}, ${userLocation.state}` : "Select Location"}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#000" />
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
          {eventUrl ? <Image source={{ uri: eventUrl }} style={[styles.banner, { width: width - 36, height: (width - 100) * 0.5, marginTop: 20 }]} resizeMode="stretch" /> : null}
          {renderContent()}
        </View>
        <View style={[styles.bottomNav, { backgroundColor: activeCategoryColor }]}>
          <TouchableOpacity style={[styles.navButton, activeTab === "products" && { backgroundColor: darkenColor(activeCategoryColor, 20) }]} onPress={() => { setActiveTab("products"); setActiveCategory("all"); }}><Text style={styles.navText}>Products</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.navButton, activeTab === "services" && { backgroundColor: darkenColor(activeCategoryColor, 20) }]} onPress={() => { setActiveTab("services"); setActiveCategory("all"); }}><Text style={styles.navText}>Services</Text></TouchableOpacity>
        </View>
      </View>

      {/* --- POLITE LOGIN MODAL --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={loginModalVisible}
        onRequestClose={() => setLoginModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
                <Ionicons name="person-add-outline" size={36} color="#009688" />
            </View>
            <Text style={styles.modalTitle}>Hello There!</Text>
            <Text style={styles.modalMessage}>
              You're currently browsing as a guest. To {modalFeatureText}, please log in or create a free account with us to have hassle-free access.
            </Text>
            
            <TouchableOpacity 
                style={styles.modalLoginBtn} 
                onPress={() => {
                    setLoginModalVisible(false);
                    navigation.navigate("Login");
                }}
            >
                <Text style={styles.modalLoginText}>Log In / Sign Up</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setLoginModalVisible(false)}
            >
                <Text style={styles.modalCancelText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#19212a" },
  containerCentered: { flex: 1, justifyContent: "center", alignItems: "center" },
  screen: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 },
  deliveryCol: { flex: 1 },
  deliverLabel: { fontSize: Platform.OS === 'ios' ? 12 : 13, fontFamily: "Sen_Bold", letterSpacing: 0.5 },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  locationText: { fontSize: Platform.OS === 'ios' ? 13 : 14, color: "#000", marginRight: 6, fontFamily: "Sen_Medium" },
  notifBtn: { width: 36, height: 36, borderRadius: 5, justifyContent: "center", alignItems: "center" },
  mediumcontent: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  searchBox: { height: 50, backgroundColor: "#fff", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#ddd" },
  searchInput: { flex: 1, fontSize: Platform.OS === 'ios' ? 12 : 15, fontFamily: "Sen_Regular" },
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
  bottomNav: { position: "absolute", bottom: 20, left: 20, right: 20, flexDirection: "row", borderRadius: 30, overflow: "hidden", zIndex: 999, elevation: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, height: 50 },
  navButton: { flex: 1, paddingVertical: 12, justifyContent: "center", alignItems: "center" },
  navText: { fontSize: Platform.OS === 'ios' ? 14 : 16, fontFamily: "Sen_Bold", color: "#fff" },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 20, color: '#111', marginBottom: 10 },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalLoginBtn: { backgroundColor: '#009688', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  modalLoginText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 16 },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { fontFamily: 'Sen_Medium', color: '#888', fontSize: 14 },
});


// https://i.ibb.co/FPsCSW3/hpy-sankranti.gif