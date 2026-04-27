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
  Keyboard
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from "expo-notifications";
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// 🔥 NATIVE FIREBASE MODULAR IMPORTS 🔥
import { auth, db } from "../firebase";
import { signInWithPhoneNumber, onAuthStateChanged } from "@react-native-firebase/auth";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "@react-native-firebase/firestore";

const { width, height } = Dimensions.get("window");

// --- SKELETON COMPONENT ---
const SkeletonItem = ({ width, height, style, borderRadius = 4 }) => {
  const translateX = useRef(new Animated.Value(-width)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(translateX, { toValue: width, duration: 1000, useNativeDriver: true })).start();
  }, [width]);
  return (
    <View style={[{ width: width, height: height, backgroundColor: "#E1E9EE", borderRadius: borderRadius, overflow: "hidden" }, style]}>
      <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateX }] }}>
        <LinearGradient colors={["transparent", "rgba(255, 255, 255, 0.6)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "100%", height: "100%" }} />
      </Animated.View>
    </View>
  );
};

const LoginSkeleton = () => {
  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <View style={styles.header}>
           <SkeletonItem width={80} height={80} borderRadius={10} style={{ marginBottom: 10 }} /> 
           <SkeletonItem width={120} height={30} style={{ marginBottom: 5 }} /> 
           <SkeletonItem width={180} height={14} />
        </View>
        <View style={styles.form}>
           <SkeletonItem width={50} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />
           <SkeletonItem width="100%" height={50} borderRadius={10} style={{ marginTop: 25 }} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function Login({ navigation }) {
  const [step, setStep] = useState(0); 
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirm, setConfirm] = useState(null); 
  const [verificationCode, setVerificationCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // 🔥 NEW STATE: Auto-detect countdown timer 🔥
  const [autoDetectTimer, setAutoDetectTimer] = useState(0);

  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  // Load remembered phone
  useEffect(() => {
    const loadRememberedUser = async () => {
      try {
        const savedPhone = await AsyncStorage.getItem("rememberedPhone");
        if (savedPhone) setPhoneNumber(savedPhone);
      } catch (error) {
        console.log("Error loading saved phone", error);
      }
    };
    loadRememberedUser();
  }, []);

  // 🔥 ANDROID BACKGROUND AUTO-VERIFY LISTENER 🔥
  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, async (user) => {
      // If Firebase automatically reads the SMS on Android, it logs them in.
      if (user && step === 1 && !loading) {
        setAutoDetectTimer(0);
        await processAuthenticatedUser(user.uid);
      }
    });
    return subscriber; 
  }, [step]);

  // 🔥 AUTO-VERIFY WHEN 6 DIGITS ARE ENTERED (iOS Autofill / Manual) 🔥
  useEffect(() => {
    if (verificationCode.length === 6 && step === 1 && !loading) {
      handleVerifyOTP();
    }
  }, [verificationCode]);

  // 🔥 VISUAL "FREEZE" COUNTDOWN TIMER 🔥
  useEffect(() => {
    let interval;
    if (autoDetectTimer > 0 && step === 1) {
      interval = setInterval(() => {
        setAutoDetectTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [autoDetectTimer, step]);


  if (!fontsLoaded) return <LoginSkeleton />;

  const getPushTokenAsync = async () => {
    if (!Device.isDevice) return null;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return null;
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: projectId });
      return tokenData.data || null;
    } catch (error) {
      console.error("Push token registration error:", error);
      return null;
    }
  };

  const handlePhoneChange = (text) => {
    let cleaned = text.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+91')) cleaned = cleaned.substring(3);
    else if (cleaned.startsWith('91') && cleaned.length > 10) cleaned = cleaned.substring(2);
    cleaned = cleaned.replace(/[^0-9]/g, '');
    if (cleaned.length > 10) cleaned = cleaned.substring(0, 10);
    setPhoneNumber(cleaned);
  };

  const handleOTPChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setVerificationCode(cleaned);
  };

  // 🔥 REUSABLE FUNCTION: Check if user exists after Auth 🔥
  const processAuthenticatedUser = async (userId) => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem('guestAddress');
      if (rememberMe) {
        await AsyncStorage.setItem("rememberedPhone", phoneNumber);
      } else {
        await AsyncStorage.removeItem("rememberedPhone");
      }

      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists && userDoc.data()?.firstName) {
        const pushToken = await getPushTokenAsync();
        if (pushToken) {
          await updateDoc(userDocRef, { expoPushToken: pushToken });
        }
        navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] });
      } else {
        setStep(2);
      }
    } catch (error) {
      console.log("Error processing user:", error);
      Alert.alert("Error", "Could not load profile data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (phoneNumber.length !== 10) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, `+91${phoneNumber}`);
      setConfirm(confirmation);
      setVerificationCode(""); 
      setStep(1);
      setAutoDetectTimer(10); // Start 10-second auto-detect phase
    } catch (error) {
      console.error("Phone Auth Error:", error);
      let errorMsg = "Failed to send OTP. Please try again.";
      if (error.code === 'auth/invalid-phone-number') errorMsg = "The phone number format is invalid.";
      else if (error.code === 'auth/too-many-requests') errorMsg = "Too many requests. Please try again later.";
      else if (error.code === 'auth/missing-client-identifier') errorMsg = "App integrity check failed.";
      Alert.alert("Authentication Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!verificationCode || verificationCode.length < 6) return;
    
    Keyboard.dismiss();
    setLoading(true);
    try {
      const userCredential = await confirm.confirm(verificationCode);
      setAutoDetectTimer(0);
      await processAuthenticatedUser(userCredential.user.uid);
    } catch (error) {
      console.log("OTP Verification Error:", error); 
      Alert.alert("Verification Failed", "The OTP is incorrect or expired.");
      setVerificationCode(""); // Clear invalid code
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Details", "Please enter your first and last name.");
      return;
    }
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const pushToken = await getPushTokenAsync();

      const userRef = doc(db, "users", userId);
      await setDoc(userRef, {
        uid: userId,
        mobile: phoneNumber,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: "",
        role: "customer",
        addresses: {},
        preferences: { smsEnabled: true, whatsappEnabled: true },
        expoPushToken: pushToken,
        createdAt: serverTimestamp()
      });

      navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] });
    } catch (error) {
      console.error("Profile Save Error:", error);
      Alert.alert("Error", "Failed to save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cancelOTP = () => {
    Keyboard.dismiss();
    setAutoDetectTimer(0);
    setStep(0);
    setVerificationCode("");
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
      <View style={styles.topRightContainer}>
        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.replace("MapScreen", { mode: 'add', isGuest: true })}>
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="arrow-forward" size={16} color="#333" />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -70} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.header}>
              <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>
                {step === 0 && "Welcome Back"}
                {step === 1 && "Verify OTP"}
                {step === 2 && "Almost There!"}
              </Text>
              <Text style={styles.subtitle}>
                {step === 0 && "Log in or sign up seamlessly"}
                {step === 1 && `Sent to +91 ${phoneNumber}`}
                {step === 2 && "What should we call you?"}
              </Text>
            </View>
            <View style={styles.form}>
              {step === 0 && (
                <>
                  <Text style={styles.label}>MOBILE NUMBER</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.mobileInput, { flex: 1, paddingLeft: 12, paddingVertical: 13 }]}
                      placeholder="9876******"
                      placeholderTextColor="#A0A0A0"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={handlePhoneChange}
                      maxLength={15}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      importantForAutofill="yes"
                    />
                  </View>
                  <View style={styles.rowBetween}>
                    <TouchableOpacity style={styles.rememberMe} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.8}>
                      <View style={[styles.checkbox, rememberMe && { backgroundColor: "#28A745", borderColor: "#28A745", justifyContent: 'center', alignItems: 'center' }]}>
                        {rememberMe && <Ionicons name="checkmark" size={12} color="white" />}
                      </View>
                      <Text style={styles.rememberText}>Remember me</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.actionButton} onPress={handleSendOTP} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>GET OTP</Text>}
                  </TouchableOpacity>
                  <View style={styles.termsContainer}>
                    <Text style={styles.termsText}>By continuing, you agree to our <Text style={styles.termsLink} onPress={() => navigation.navigate("Terms")}>Terms of Service</Text> and <Text style={styles.termsLink} onPress={() => navigation.navigate("PrivacyPolicy")}>Privacy Policy</Text></Text>
                  </View>
                </>
              )}
              
              {step === 1 && (
                <>
                  <View style={styles.rowBetween}>
                     <Text style={[styles.label, {marginTop: 0, marginBottom: 0}]}>ENTER OTP</Text>
                     {/* 🔥 VISUAL INDICATOR 🔥 */}
                     {autoDetectTimer > 0 && (
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                           <ActivityIndicator size="small" color="#28A745" style={{marginRight: 6}} />
                           <Text style={{color: '#28A745', fontSize: 11, fontFamily: "Sen_Bold"}}>Auto-detecting... {autoDetectTimer}s</Text>
                        </View>
                     )}
                  </View>
                  
                  <TextInput
                    style={[styles.otpInput, autoDetectTimer > 0 && { borderColor: '#B0E57E', backgroundColor: '#F9FCF5' }]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#ccc"
                    keyboardType="number-pad"
                    value={verificationCode}
                    onChangeText={handleOTPChange}
                    maxLength={6}
                    autoFocus={true}
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    importantForAutofill="yes"
                  />
                  <View style={styles.rowBetween}>
                    <TouchableOpacity onPress={cancelOTP} disabled={loading}>
                      <Text style={styles.forgotText}>Change Number</Text>
                    </TouchableOpacity>
                    
                    {autoDetectTimer === 0 ? (
                      <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                        <Text style={[styles.forgotText, {color: '#888'}]}>Resend OTP</Text>
                      </TouchableOpacity>
                    ) : (
                       <Text style={[styles.forgotText, {color: '#ccc'}]}>Resend OTP</Text>
                    )}
                  </View>
                  
                  <TouchableOpacity 
                     style={[styles.actionButton, autoDetectTimer > 0 && {backgroundColor: '#88C895', shadowOpacity: 0}]} 
                     onPress={handleVerifyOTP} 
                     disabled={loading || autoDetectTimer > 0}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>VERIFY & CONTINUE</Text>}
                  </TouchableOpacity>
                </>
              )}

              {step === 2 && (
                <>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.label}>FIRST NAME</Text>
                      <TextInput style={styles.input} placeholder="John" placeholderTextColor="#A0A0A0" value={firstName} onChangeText={setFirstName} autoFocus={true} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.label}>LAST NAME</Text>
                      <TextInput style={styles.input} placeholder="Doe" placeholderTextColor="#A0A0A0" value={lastName} onChangeText={setLastName} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.actionButton} onPress={handleSaveProfile} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>COMPLETE PROFILE</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#B0E57E", marginBottom: Platform.OS === "ios" ? -40 : -30 },
  topRightContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 60, right: 20, zIndex: 10 },
  skipButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  skipText: { fontFamily: "Sen_Bold", fontSize: Platform.OS === "ios" ? 10 : 12, color: "#333", marginRight: 4 },
  header: { alignItems: "center", marginBottom: 20, marginTop: 40 },
  logo: { width: 80, height: 80 },
  title: { fontSize: 28, color: "#000", fontFamily: "Sen_Bold", marginTop: 10 },
  subtitle: { fontSize: 14, color: "#555", fontFamily: "Sen_Regular", marginTop: 4 },
  form: { width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  row: { flexDirection: "row", marginBottom: 5 },
  label: { fontSize: 12, color: "#5C5C5C", marginTop: 20, marginBottom: 8, fontFamily: "Sen_Bold" },
  input: { backgroundColor: "#F3F6FA", borderRadius: 10, padding: 14, fontSize: 18, color: "#111", fontFamily: "Sen_Bold", letterSpacing: 1 },
  mobileInput: { backgroundColor: "#F3F6FA", borderTopRightRadius: 10, borderBottomRightRadius: 10, fontSize: 18, color: "#111", fontFamily: "Sen_Bold", letterSpacing: 1, flex: 1 },
  phoneInputContainer: { flexDirection: "row", alignItems: "center" },
  countryCodeBox: { backgroundColor: "#E1E9EE", borderTopLeftRadius: 10, borderBottomLeftRadius: 10, padding: 14, paddingHorizontal: 16 },
  countryCodeText: { fontSize: 16, fontFamily: "Sen_Bold", color: "#333" },
  otpInput: { backgroundColor: "#F3F6FA", borderRadius: 10, padding: 16, fontSize: 24, color: "#111", fontFamily: "Sen_Bold", letterSpacing: 8, textAlign: "center", marginTop: 15, borderWidth: 1, borderColor: "#E5E7EB" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15 },
  rememberMe: { flexDirection: "row", alignItems: "center" },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: "#C8C8C8", borderRadius: 3, marginRight: 8 },
  rememberText: { color: "#5C5C5C", fontFamily: "Sen_Regular" },
  forgotText: { color: "#28A745", fontFamily: "Sen_Medium", fontSize: 13 },
  actionButton: { backgroundColor: "#28A745", borderRadius: 10, alignItems: "center", paddingVertical: 16, marginTop: 25, shadowColor: "#28A745", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  actionButtonText: { color: "#fff", fontSize: 16, fontFamily: "Sen_Bold", letterSpacing: 1 },
  termsContainer: { marginTop: 25, alignItems: 'center', paddingHorizontal: 10 },
  termsText: { color: "#888", fontSize: 11, textAlign: 'center', fontFamily: "Sen_Regular", lineHeight: 18 },
  termsLink: { color: "#28A745", fontFamily: "Sen_Medium", fontSize: 11, textDecorationLine: 'underline' },
});