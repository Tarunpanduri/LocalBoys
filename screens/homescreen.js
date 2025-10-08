import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator, RefreshControl, Dimensions, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { db, auth } from "../firebase";
import { ref as dbRef, get, onValue } from "firebase/database";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const haversineDistance = (lat1, lon1, lat2, lon2) => { const toRad = v => (v * Math.PI) / 180; const R = 6371; const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };

export default function HomeScreen({ navigation }) {
    const [uid, setUid] = useState(null), [userData, setUserData] = useState(null), [userLocation, setUserLocation] = useState(null), [shops, setShops] = useState([]), [filteredShops, setFilteredShops] = useState([]), [categories, setCategories] = useState([{ id: "all", label: "All" }]), [loading, setLoading] = useState(true), [radiusKm, setRadiusKm] = useState(8), [searchText, setSearchText] = useState(""), [activeCategory, setActiveCategory] = useState("all"), [refreshing, setRefreshing] = useState(false), [notificationsCount, setNotificationsCount] = useState(0), [greetingName, setGreetingName] = useState("Guest"), [categoryMeta, setCategoryMeta] = useState({});

    useEffect(() => auth.onAuthStateChanged(user => setUid(user ? user.uid : null)), []);
    useEffect(() => { if (!uid) return; const fetchUserData = async () => { try { const userSnap = await get(dbRef(db, `users/${uid}`)); if (userSnap.exists()) { const u = userSnap.val(); setUserData(u); setUserLocation({ lat: u.location?.lat, lng: u.location?.lng, formattedAddress: u.location?.formattedAddress }); setGreetingName(u.firstName || "User"); } } catch (err) { console.warn("Error fetching user:", err); } }; fetchUserData(); }, [uid]);

    useEffect(() => {
        const adminRef = dbRef(db, "admin_data/general"), catsRef = dbRef(db, "admin_data/categories"), shopsRef = dbRef(db, "shops");
        const unsubAdmin = onValue(adminRef, snap => { const val = snap.val(); if (val?.shopVisibilityRadiusKm) setRadiusKm(Number(val.shopVisibilityRadiusKm)); });
        const unsubCats = onValue(catsRef, snap => { setCategoryMeta(snap.val() || {}); });
        const unsubShops = onValue(shopsRef, snap => { const val = snap.val() || {}; const arr = Object.keys(val).map(key => ({ id: key, ...val[key] })); setShops(arr); const shopTypes = Array.from(new Set(arr.map(s => s.type?.trim()))).filter(Boolean).map(t => ({ id: t.toLowerCase(), label: t })); setCategories([{ id: "all", label: "All" }, ...shopTypes]); setLoading(false); }, err => { console.warn("shops read error", err); setLoading(false); });
        if (!uid) return () => { unsubAdmin(); unsubCats(); unsubShops(); };
        const notifRef = dbRef(db, `notifications/${uid}`), unsubNotifs = onValue(notifRef, snap => setNotificationsCount(Object.values(snap.val() || {}).filter(x => !x.isRead).length));
        return () => { unsubAdmin(); unsubCats(); unsubShops(); unsubNotifs(); };
    }, [uid]);

    useEffect(() => { if (!userLocation) return; const filtered = shops.map(s => ({ ...s, distanceKm: s.location?.lat && s.location?.lng ? haversineDistance(userLocation.lat, userLocation.lng, Number(s.location.lat), Number(s.location.lng)) : Infinity })).filter(s => s.distanceKm <= radiusKm).filter(s => activeCategory === "all" ? true : s.type?.toLowerCase().includes(activeCategory.toLowerCase())).filter(s => !searchText ? true : s.name?.toLowerCase().includes(searchText.toLowerCase()) || s.type?.toLowerCase().includes(searchText.toLowerCase())).sort((a, b) => a.distanceKm - b.distanceKm); setFilteredShops(filtered); }, [shops, userLocation, radiusKm, activeCategory, searchText]);

    const onRefresh = useCallback(async () => { setRefreshing(true); try { const val = await get(dbRef(db, "shops")).then(snap => snap.val() || {}); setShops(Object.keys(val).map(key => ({ id: key, ...val[key] }))); } catch (err) { console.warn("refresh error", err); } finally { setRefreshing(false); } }, []);
    const getGreeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good Morning!" : hour < 16 ? "Good Afternoon!" : "Good Evening!"; };
    const activeCategoryColor = categoryMeta[categories.find(c => c.id === activeCategory)?.label]?.Theme || "#66BB6A";
    const darkenColor = (hex, percent) => { const num = parseInt(hex.replace("#", ""), 16); const amt = Math.round(2.55 * percent); const R = (num >> 16) - amt; const G = (num >> 8 & 0x00FF) - amt; const B = (num & 0x0000FF) - amt; return "#" + (0x1000000 + (R < 0 ? 0 : R > 255 ? 255 : R) * 0x10000 + (G < 0 ? 0 : G > 255 ? 255 : G) * 0x100 + (B < 0 ? 0 : B > 255 ? 255 : B)).toString(16).slice(1); };

    const renderCategory = ({ item }) => { const active = item.id === activeCategory; const meta = categoryMeta[item.label] || {}; const themeColor = meta.Theme || "#8CCF8C"; const darkenedColor = darkenColor(themeColor, 25); const iconName = meta.Icon || "apps-outline"; return (<TouchableOpacity onPress={() => setActiveCategory(item.id)} style={[styles.categoryChip, active && { backgroundColor: darkenedColor, borderColor: darkenedColor }]}><Ionicons name={iconName} size={16} color={active ? "#fff" : themeColor} style={{ marginRight: 6 }} /><Text style={[styles.categoryLabel, active && { color: "#fff", fontFamily: "Sen_Bold" }]}>{item.label}</Text></TouchableOpacity>); };

    const ShopCard = ({ shop }) => (<TouchableOpacity style={styles.shopCard} onPress={() => navigation?.navigate?.("ShopDetails", { shopId: shop.id, shop })}><Image source={{ uri: shop.image }} style={styles.shopImage} resizeMode="cover" /><View style={styles.shopInfo}><Text style={styles.shopName}>{shop.name}</Text><Text style={styles.shopSubtitle}>{shop.type} {shop.avgPrepTime ? ` · ${shop.avgPrepTime} min` : ""}</Text><View style={styles.shopMetaRow}><View style={styles.metaItem}><FontAwesome5 name="star" size={14} /><Text style={styles.metaText}> {shop.rating ?? "—"}</Text></View><View style={[styles.metaItem, { marginLeft: 12 }]}><MaterialIcons name="local-shipping" size={16} /><Text style={styles.metaText}> Free</Text></View><View style={[styles.metaItem, { marginLeft: 12 }]}><Ionicons name="time-outline" size={16} /><Text style={styles.metaText}> {shop.deliveryTime ?? `${shop.avgPrepTime ?? "—"} min`}</Text></View></View></View></TouchableOpacity>);

    if (loading) return (<SafeAreaView style={styles.containerCentered}><ActivityIndicator size="large" /></SafeAreaView>);

    return (<SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}><StatusBar barStyle="dark-content" backgroundColor="#19212a" translucent={false} />
        <LinearGradient colors={[activeCategoryColor || "#66BB6A", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 250 }} />
        <View style={styles.screen}>
            <View style={styles.headerRow}><View style={styles.deliveryCol}><Text style={[styles.deliverLabel, { color: darkenColor(activeCategoryColor, 40) }]}>Deliver To</Text><TouchableOpacity style={styles.locationRow} onPress={() => navigation.navigate("MapScreen")}><Text style={styles.locationText}>{userData?.location?.city ? `${userData.location.city}, ${userData.location.state}` : "Fetching..."}</Text><Ionicons name="chevron-down" size={12} color="#000" /></TouchableOpacity></View><TouchableOpacity style={[styles.notifBtn, { backgroundColor: darkenColor(activeCategoryColor, 10), borderColor: darkenColor(activeCategoryColor, 30), borderWidth: 1 }]} onPress={() => navigation.navigate("Notifications")}><Ionicons name="person-circle-outline" size={28} color="#fff" /></TouchableOpacity></View>
            <View style={styles.mediumcontent}><Text style={styles.greeting}>Hey {greetingName}, <Text style={styles.greetingStrong}>{getGreeting()}</Text></Text><View style={styles.searchBox}><Ionicons name="search" size={18} style={{ marginRight: 8 }} /><TextInput placeholder="Search dishes, restaurants" style={styles.searchInput} value={searchText} onChangeText={setSearchText} returnKeyType="search" /></View>
                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Categories</Text></View>
                <View style={{ height: 60 }}><FlatList data={categories} horizontal keyExtractor={i => i.id} renderItem={renderCategory} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 5 }} /></View>
                <FlatList data={filteredShops} keyExtractor={item => item.id} renderItem={({ item }) => <ShopCard shop={item} />} contentContainerStyle={{ paddingBottom: 10, paddingHorizontal: 2 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} ListEmptyComponent={() => (<View style={styles.emptyState}><Text style={styles.emptytext}>Sorry, our services are currently unavailable at this location. We will notify when we are here</Text></View>)} /></View>
        </View>
    </SafeAreaView>);
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#19212a" },
    containerCentered: { flex: 1, justifyContent: "center", alignItems: "center" },
    screen: { flex: 1 },

    headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 },
    deliveryCol: { flex: 1 },
    deliverLabel: { fontSize: 13, color: "#006400", fontFamily: "Sen_Bold", letterSpacing: 0.5 },
    locationRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    locationText: { fontSize: 14, color: "#000", marginRight: 6, fontFamily: "Sen_Medium" },
    notifBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

    mediumcontent: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
    greeting: { fontSize: 18, color: "#111", marginBottom: 12, fontFamily: "Sen_Regular" },
    greetingStrong: { fontFamily: "Sen_ExtraBold" },

    searchBox: { height: 50, backgroundColor: "#f2f4f6", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#ddd" },
    searchInput: { flex: 1, fontSize: 15, fontFamily: "Sen_Regular" },

    sectionHeader: { marginTop: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { fontSize: 18, fontFamily: "Sen_Bold", color: "#111",marginBottom:5 },

    categoryChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fff", marginRight: 10, borderWidth: 1, borderColor: "#ddd" },

    categoryLabel: { fontSize: 14, color: "#333", fontFamily: "Sen_Medium" },

    shopCard: { marginTop: 14, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#ddd", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    shopImage: { width: "100%", height: Math.round(width * 0.38) },
    shopInfo: { padding: 12, borderColor: "#ddd", borderTopWidth: 1 },
    shopName: { fontSize: 16, fontFamily: "Sen_Bold", color: "#222" },
    shopSubtitle: { fontSize: 13, color: "#8b9aa4", marginTop: 4, fontFamily: "Sen_Medium" },
    shopMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
    metaItem: { flexDirection: "row", alignItems: "center" },
    metaText: { fontSize: 13, color: "#444", fontFamily: "Sen_Regular" },

    emptyState: { marginTop: 40, alignItems: "center", justifyContent:'center', fontFamily: "Sen_Regular" },
    emptytext: { fontSize: 15, color: "#555", textAlign: "center", paddingHorizontal: 20, fontFamily: "Sen_Regular" },

});