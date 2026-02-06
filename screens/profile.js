import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Linking,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import { useFonts } from "expo-font";
import { Sen_400Regular, Sen_500Medium, Sen_700Bold, Sen_800ExtraBold } from "@expo-google-fonts/sen";
import { fetchUserData } from "../utils/profile_util";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get('window');

// --- Skeleton Component ---
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
    <View
      style={[
        {
          width: width,
          height: height,
          backgroundColor: "#E1E9EE",
          borderRadius: borderRadius,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateX }],
        }}
      >
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

const ProfileSkeleton = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <View style={styles.headerRow}>
          <SkeletonItem width={26} height={26} borderRadius={13} />
          <SkeletonItem width={100} height={24} />
          <SkeletonItem width={26} height={26} borderRadius={13} />
        </View>

        <View style={{ alignItems: 'center', marginVertical: 25 }}>
          <SkeletonItem width={80} height={80} borderRadius={40} style={{ marginBottom: 15, marginTop: 10 }} />
          <SkeletonItem width={180} height={24} style={{ marginBottom: 8 }} />
          <SkeletonItem width={120} height={16} />
        </View>

        <View style={[styles.menuContainer, { paddingVertical: 20 }]}>
          {[1, 2, 3, 4, 5, 6].map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 25 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SkeletonItem width={40} height={40} borderRadius={10} style={{ marginRight: 15 }} />
                <SkeletonItem width={140} height={18} />
              </View>
              <SkeletonItem width={16} height={16} borderRadius={8} />
            </View>
          ))}
        </View>

        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <SkeletonItem width={150} height={14} style={{ marginBottom: 6 }} />
          <SkeletonItem width={100} height={16} />
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Main Profile Component ---
export default function Profile({ navigation, route }) {
  const { greetingName = "User" } = route.params || {};
  const auth = getAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const MY_PROFILE_URL = "https://tarunpanduri.github.io/Portfolio/";

  const [fontsLoaded] = useFonts({
    Sen_Regular: Sen_400Regular,
    Sen_Medium: Sen_500Medium,
    Sen_Bold: Sen_700Bold,
    Sen_ExtraBold: Sen_800ExtraBold,
    ...Ionicons.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
  });

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  const loadUser = async () => {
    try {
      const data = await fetchUserData();
      setUserData(data);
    } catch (e) {
      Alert.alert("Error", "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      Alert.alert("Logout Failed", error.message);
    }
  };

  const handleCraftedByPress = async () => {
    const supported = await Linking.canOpenURL(MY_PROFILE_URL);
    if (supported) {
      await Linking.openURL(MY_PROFILE_URL);
    } else {
      Alert.alert("Error", "Cannot open the link");
    }
  };

  const menuItems = [
    { title: "Edit Profile", icon: <Ionicons name="person-circle-outline" size={22} color="#FF6B6B" />, route: "EditProfile", params: { userData } },
    { title: "Addresses", icon: <Ionicons name="home-outline" size={22} color="#6C63FF" />, route: "Addresses" },
    { title: "Privacy Policy", icon: <FontAwesome5 name="user-shield" size={18} color="#FFAA00" />, route: "PrivacyPolicy" },
    { title: "Terms & Conditions", icon: <MaterialIcons name="gavel" size={22} color="#4ECDC4" />, route: "Terms" },
    { title: "Contact Us", icon: <Ionicons name="information-circle-outline" size={22} color="#1DD1A1" />, route: "ContactUs" },
  ];

  const getDisplayName = () =>
    userData?.firstName ? `${userData.firstName} ${userData.lastName || ""}` : greetingName;

  if (!fontsLoaded || loading) {
    return <ProfileSkeleton />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={26} color="#000" />
          </TouchableOpacity>
          
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={[styles.headerTitle, { fontFamily: "Sen_Bold" }]}>Profile</Text>
          </View>
          
          {/* UPDATED: Settings Icon instead of Delete */}
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.username, { fontFamily: "Sen_Bold" }]}>{getDisplayName()}</Text>
          <Text style={[styles.userInfo, { fontFamily: "Sen_Regular" }]}>
            Mobile: {userData?.mobile || "Not provided"}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem} 
              onPress={() => navigation.navigate(item.route, item.params || {})}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconBox}>{item.icon}</View>
                <Text style={[styles.menuTitle, { fontFamily: "Sen_Medium" }]}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color="#A0A0A0" />
            </TouchableOpacity>
          ))}

          {/* Logout */}
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#FFECEC" }]}>
                <Ionicons name="log-out-outline" size={22} color="#E63946" />
              </View>
              <Text style={[styles.menuTitle, { color: "#E63946", fontFamily: "Sen_Medium" }]}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <TouchableOpacity style={styles.footerContainer} onPress={handleCraftedByPress} activeOpacity={0.7}>
          <Text style={[styles.footerText, { fontFamily: "Sen_Medium" }]}>
            Rooted with <Text style={styles.heart}>❤️</Text> in India by
          </Text>
          <Text style={[styles.footerSubText, { fontFamily: "Sen_Bold" }]}>Tarun Panduri</Text>
        </TouchableOpacity>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  logo: { width: 80, height: 80, marginBottom: 10, marginTop: Platform.OS === 'ios' ? 0 : 30 },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, color: "#000" },
  profileSection: { alignItems: "center", marginVertical: 25 },
  username: { fontSize: Platform.OS === 'ios' ? 18 : 20, marginTop: 10, color: "#1A1A1A" },
  userInfo: { color: "#666", marginTop: 2, fontSize: Platform.OS === 'ios' ? 12 : 14 },
  menuContainer: { backgroundColor: "#fff", borderRadius: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  logoutItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 15 },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: { backgroundColor: "#F3F4F6", borderRadius: 10, padding: 8, marginRight: 15 },
  menuTitle: { fontSize: Platform.OS === 'ios' ? 14 : 16, color: "#1A1A1A" },
  footerContainer: { marginTop: 40, alignItems: "center", justifyContent: "center", padding: Platform.OS === 'ios' ? 0 : 10, opacity: 0.8 },
  footerText: { fontSize: Platform.OS === 'ios' ? 10 : 12, color: "#888", marginBottom: 2 },
  footerSubText: { fontSize: Platform.OS === 'ios' ? 11 : 13, color: "#04a60a", textDecorationLine: 'underline' },
  heart: { color: "#E63946", fontSize: 10 },
});