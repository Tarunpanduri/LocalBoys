import React, { useState, useEffect, useRef } from "react";
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
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail
} from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { db } from "../firebase";
import { ref, update } from "firebase/database";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get("window");

// --- SKELETON COMPONENTS ---
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
           <SkeletonItem width={80} height={80} borderRadius={10} style={{ marginBottom: 10 }} /> 
           <SkeletonItem width={120} height={30} style={{ marginBottom: 5 }} /> 
           <SkeletonItem width={180} height={14} />
        </View>

        {/* Form Skeleton */}
        <View style={styles.form}>
           <SkeletonItem width={50} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />

           <SkeletonItem width={70} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />

           <SkeletonItem width="100%" height={50} borderRadius={10} style={{ marginTop: 25 }} />

           <View style={{ alignItems: 'center', marginTop: 20 }}>
              <SkeletonItem width={200} height={14} />
           </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- MAIN LOGIN COMPONENT ---
export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  // 1. Load Remembered Email on Mount
  useEffect(() => {
    const loadRememberedUser = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("rememberedEmail");
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.log("Error loading saved email", error);
      }
    };
    loadRememberedUser();
  }, []);

  if (!fontsLoaded) {
    return <SignUpSkeleton />;
  }

  // Request notification permission
  const registerForPushNotificationsAsync = async (userId) => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert("Permission denied", "Enable notifications to receive updates.");
        return;
      }

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      const expoToken = tokenData.data;

      if (!expoToken) return;

      if (userId) {
        await update(ref(db, `users/${userId}`), { expoPushToken: expoToken });
      }
    } catch (error) {
      console.error("Push token registration error:", error);
    }
  };

  // 2. Forgot Password Logic with Custom Alerts
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Input Required", "Please enter your email address in the field above to reset your password.");
      return;
    }

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        "Check your Inbox",
        "A password reset link has been sent to your email address."
      );
    } catch (error) {
      let errorMessage = "An error occurred while sending the reset link.";
      
      // Map Firebase errors to user-friendly messages
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "No account exists with this email address.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Please enter a valid email address.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many requests. Please try again later.";
          break;
        case 'auth/network-request-failed':
          errorMessage = "Network error. Please check your internet connection.";
          break;
      }
      
      Alert.alert("Request Failed", errorMessage);
    }
  };

  // 3. Login Logic with Custom Alerts
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Details", "Please enter both email and password to continue.");
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

      // Handle Remember Me
      if (rememberMe) {
        await AsyncStorage.setItem("rememberedEmail", email.trim());
      } else {
        await AsyncStorage.removeItem("rememberedEmail");
      }

      // Register Token
      await registerForPushNotificationsAsync(userId);

      navigation.reset({
        index: 0,
        routes: [{ name: "Addresses" }],
      });
    } catch (error) {
      console.log("Login Error Code:", error.code); // Good for debugging
      
      let title = "Login Failed";
      let message = "An unexpected error occurred. Please try again.";

      // Map Firebase errors to user-friendly messages
      switch (error.code) {
        case 'auth/invalid-email':
          message = "The email address format is invalid.";
          break;
        
        // Note: Firebase often groups 'user-not-found' and 'wrong-password' 
        // into 'invalid-credential' for security in newer versions.
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = "Incorrect email or password. Please check your credentials.";
          break;

        case 'auth/user-disabled':
          message = "This account has been disabled. Please contact support.";
          break;

        case 'auth/too-many-requests':
          message = "Too many failed attempts. Please try again later.";
          break;
          
        case 'auth/network-request-failed':
          title = "Connection Error";
          message = "Please check your internet connection and try again.";
          break;
          
        default:
          message = "Unable to sign in. Please try again."; // Fallback generic message
      }

      Alert.alert(title, message);
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
                <TouchableOpacity 
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && { backgroundColor: "#28A745", borderColor: "#28A745", justifyContent: 'center', alignItems: 'center' },
                    ]}
                  >
                     {rememberMe && <Ionicons name="checkmark" size={12} color="white" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleForgotPassword}>
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