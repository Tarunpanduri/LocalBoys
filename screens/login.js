import React, { useState,useEffect,useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { db } from "../firebase";
import { ref, update } from "firebase/database";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

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

const SignUpSkeleton = () => {
  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        
        {/* Header Skeleton */}
        <View style={styles.header}>
           {/* Logo Placeholder */}
           <SkeletonItem width={80} height={80} borderRadius={10} style={{ marginBottom: 10 }} /> 
           {/* Title Placeholder */}
           <SkeletonItem width={120} height={30} style={{ marginBottom: 5 }} /> 
           {/* Subtitle Placeholder */}
           <SkeletonItem width={180} height={14} />
        </View>

        {/* Form Skeleton */}
        <View style={styles.form}>
           {/* Email */}
           <SkeletonItem width={50} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />

           {/* Password */}
           <SkeletonItem width={70} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />

           {/* Sign Up Button */}
           <SkeletonItem width="100%" height={50} borderRadius={10} style={{ marginTop: 25 }} />

           {/* Bottom Link */}
           <View style={{ alignItems: 'center', marginTop: 20 }}>
              <SkeletonItem width={200} height={14} />
           </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

    const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });


    if ( !fontsLoaded) {
    return <SignUpSkeleton />;
  }


  // Request notification permission and get Expo Push Token
  const registerForPushNotificationsAsync = async (userId) => {
    // 1. Check if physical device
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    try {
      // 2. Permission Check
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert("Permission denied", "Enable notifications to receive updates.");
        console.warn("❌ Permission denied for push notifications");
        return;
      }

      // 3. Get Expo Push Token (Replaces Native Device Token)
      // We explicitly pass projectId to ensure EAS compatibility
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      if (!projectId) {
        console.log('⚠️ Project ID not found. Ensure EAS Configuration is correct.');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      const expoToken = tokenData.data;

      if (!expoToken) {
        console.warn("⚠️ Expo token is null, cannot save to Firebase");
        return;
      }

      // 4. Save to Firebase
      if (userId) {
        // Using 'update' to safely add the token without overwriting other user data
        // Saving as 'expoPushToken' to match App.js logic
        await update(ref(db, `users/${userId}`), { expoPushToken: expoToken });
      }
    } catch (error) {
      console.error("❌ Push token registration error:", error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    const firebaseAuth = getAuth();

    try {
      const userCredential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password
      );

      const userId = userCredential.user.uid;

      // Register Token after successful login
      await registerForPushNotificationsAsync(userId);

      navigation.reset({
        index: 0,
        routes: [{ name: "Addresses" }],
      });
    } catch (error) {
      console.error("❌ Login failed:", error);
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#B0E57E"
        translucent={false}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -70}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.header}>
              <Image
                source={require("../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Log In</Text>
              <Text style={styles.subtitle}>
                Please sign in to your existing account
              </Text>
            </View>
            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                placeholder="example@gmail.com"
                placeholderTextColor="#A0A0A0"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="********"
                  placeholderTextColor="#A0A0A0"
                  secureTextEntry={secureText}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setSecureText(!secureText)}
                >
                  <Ionicons
                    name={secureText ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#A0A0A0"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.rememberMe}>
                  <TouchableOpacity
                    style={[styles.checkbox, rememberMe && { backgroundColor: "#28A745" }]}
                    onPress={() => setRememberMe(!rememberMe)}
                  />
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot Password</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>LOG IN</Text>
                )}
              </TouchableOpacity>
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don’t have an account?</Text>
                <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                  <Text style={styles.signupLink}> SIGN UP</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#B0E57E", marginBottom: Platform.OS === "ios" ? -40 : -30 },
  header: { alignItems: "center", marginBottom: 20 },
  logo: { width: 80, height: 80 },
  title: { fontSize: 28, color: "#000", fontFamily: "Sen_Bold" },
  subtitle: { fontSize: 14, color: "#555", fontFamily: "Sen_Regular" },
  form: { width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  label: { fontSize: 12, color: "#5C5C5C", marginTop: 20, marginBottom: 5, fontFamily: "Sen_Regular" },
  input: { backgroundColor: "#F3F6FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#333", fontFamily: "Sen_Regular" },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  eyeIcon: { position: "absolute", right: 15 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15 },
  rememberMe: { flexDirection: "row", alignItems: "center" },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: "#C8C8C8", borderRadius: 3, marginRight: 8 },
  rememberText: { color: "#5C5C5C", fontFamily: "Sen_Regular" },
  forgotText: { color: "#28A745", fontFamily: "Sen_Medium" },
  loginButton: { backgroundColor: "#28A745", borderRadius: 10, alignItems: "center", paddingVertical: 14, marginTop: 25 },
  loginButtonText: { color: "#fff", fontSize: 15, fontFamily: "Sen_Medium" },
  signupContainer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  signupText: { color: "#5C5C5C", fontFamily: "Sen_Regular" },
  signupLink: { color: "#28A745", fontFamily: "Sen_Medium" },
});