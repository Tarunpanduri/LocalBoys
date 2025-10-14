import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import { ref, get } from "firebase/database";
import { db } from "../firebase";

export default function Profile({ navigation, route }) {
  const { greetingName = "User" } = route.params || {};
  const auth = getAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUserData(); }, []);

  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { console.log("No user logged in"); setLoading(false); return; }
      const snapshot = await get(ref(db, `users/${currentUser.uid}`));
      snapshot.exists() ? setUserData(snapshot.val()) : console.log("No user data found");
    } catch (error) { console.error("Error fetching user data:", error); Alert.alert("Error", "Failed to load user data"); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); navigation.reset({ index: 0, routes: [{ name: "Login" }] }); }
    catch (error) { Alert.alert("Logout Failed", error.message); }
  };

const menuItems = [
  { title: "Personal Info", icon: <Ionicons name="person-circle-outline" size={22} color="#FF6B6B" />, route: "PersonalInfo", params: { userData } },
  { title: "Addresses", icon: <Ionicons name="home-outline" size={22} color="#6C63FF" />, route: "Addresses" },
  { title: "Current Orders", icon: <MaterialIcons name="shopping-cart" size={22} color="#FFD93D" />, route: "TrackOrder" },
  { title: "Terms & Conditions", icon: <MaterialIcons name="gavel" size={22} color="#4ECDC4" />, route: "FAQs" },
  { title: "Privacy Policy", icon: <FontAwesome5 name="user-shield" size={18} color="#FFAA00" />, route: "UserReviews" },
];


  const getInitial = () => userData?.firstName ? userData.firstName.charAt(0).toUpperCase() : greetingName.charAt(0).toUpperCase();
  const getDisplayName = () => userData?.firstName ? `${userData.firstName} ${userData.lastName || ''}` : greetingName;

  if (loading) return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back-outline" size={26} color="#000" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </View>

        <View style={styles.profileSection}>
          <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.username}>{getDisplayName()}</Text>
          <Text style={styles.userInfo}>Mobile: {userData?.mobile || "Not provided"}</Text>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={() => navigation.navigate(item.route, item.params || {})}>
              <View style={styles.menuLeft}><View style={styles.iconBox}>{item.icon}</View><Text style={styles.menuTitle}>{item.title}</Text></View>
              <Ionicons name="chevron-forward-outline" size={20} color="#A0A0A0" />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <View style={styles.menuLeft}><View style={[styles.iconBox, { backgroundColor: "#FFECEC" }]}><Ionicons name="log-out-outline" size={22} color="#E63946" /></View>
            <Text style={[styles.menuTitle, { color: "#E63946" }]}>Log Out</Text></View>
            <Ionicons name="chevron-forward-outline" size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  logo: { width: 80, height: 80,marginBottom: 10,marginTop:30 },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#666" },
  profileSection: { alignItems: "center", marginVertical: 25 },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  username: { fontSize: 20, fontWeight: "700", marginTop: 10, color: "#1A1A1A" },
  userTagline: { color: "#A0A0A0", marginTop: 4, fontSize: 14 },
  userInfo: { color: "#666", marginTop: 2, fontSize: 12 },
  menuContainer: { backgroundColor: "#fff", borderRadius: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  logoutItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 15 },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: { backgroundColor: "#F3F4F6", borderRadius: 10, padding: 8, marginRight: 15 },
  menuTitle: { fontSize: 16, color: "#1A1A1A" },
});