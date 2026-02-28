import React, { useState, useRef, useEffect } from "react";
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
  Animated,
  Dimensions,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
// --- 1. NEW FIRESTORE IMPORTS ---
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";

// --- IMPORT ASYNC STORAGE ---
import AsyncStorage from '@react-native-async-storage/async-storage';

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
           <SkeletonItem width={80} height={80} borderRadius={10} style={{ marginBottom: 10 }} /> 
           <SkeletonItem width={120} height={30} style={{ marginBottom: 5 }} /> 
           <SkeletonItem width={180} height={14} />
        </View>

        {/* Form Skeleton */}
        <View style={styles.form}>
           {/* First Name / Last Name Row */}
           <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                 <SkeletonItem width={70} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
                 <SkeletonItem width="100%" height={45} borderRadius={10} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                 <SkeletonItem width={70} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
                 <SkeletonItem width="100%" height={45} borderRadius={10} />
              </View>
           </View>

           {/* Email */}
           <SkeletonItem width={50} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />

           {/* Password */}
           <SkeletonItem width={70} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
           <SkeletonItem width="100%" height={45} borderRadius={10} />

           {/* Mobile */}
           <SkeletonItem width={90} height={12} style={{ marginTop: 10, marginBottom: 5 }} />
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


export default function SignUp({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return <SignUpSkeleton />;
  }

  const handleSignUp = async () => {
    // Basic validation feedback
    if (!firstName || !lastName || !email || !password || !mobile) {
      Alert.alert("Missing Details", "Please fill in all fields to create an account.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create Auth User
      const { user: { uid } } = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      
      // 2. CLEAR GUEST DATA UPON SIGN UP
      await AsyncStorage.removeItem('guestAddress');

      // 3. PRODUCTION FIRESTORE SAVE (Matching the new visual schema perfectly)
      await setDoc(doc(db, "users", uid), { 
        uid: uid, 
        firstName: firstName.trim(), 
        lastName: lastName.trim(), 
        email: email.trim().toLowerCase(), 
        mobile: mobile.trim(), 
        role: "customer",          // Default RBAC role
        addresses: {},             // Start with empty address map
        preferences: {             // Default preferences
          smsEnabled: true,
          whatsappEnabled: true
        },
        createdAt: serverTimestamp() // Native Firestore timestamp
      });

      navigation.navigate("Login");
    } catch (e) { 
      // User-friendly error mapping
      let errorMessage = e.message;
      if (e.code === 'auth/email-already-in-use') errorMessage = 'This email is already registered. Please log in.';
      if (e.code === 'auth/weak-password') errorMessage = 'Password should be at least 6 characters.';
      if (e.code === 'auth/invalid-email') errorMessage = 'Please enter a valid email address.';
      
      Alert.alert("Sign Up Failed", errorMessage); 
    }
    finally { 
      setLoading(false); 
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
      
      {/* --- SKIP BUTTON (TOP RIGHT) --- */}
      <View style={styles.topRightContainer}>
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={() => navigation.replace("MapScreen", { mode: 'add', isGuest: true })}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="arrow-forward" size={16} color="#333" />
        </TouchableOpacity>
      </View>
      {/* ------------------------------- */}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -70} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Sign Up</Text>
            <Text style={styles.subtitle}>Create a new account</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>First Name</Text>
                <TextInput style={styles.input} placeholder="John" placeholderTextColor="#A0A0A0" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput style={styles.input} placeholder="Doe" placeholderTextColor="#A0A0A0" value={lastName} onChangeText={setLastName} />
              </View>
            </View>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="example@gmail.com" placeholderTextColor="#A0A0A0" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="********" placeholderTextColor="#A0A0A0" secureTextEntry={secureText} value={password} onChangeText={setPassword} autoCapitalize="none" />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setSecureText(!secureText)}>
                <Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={22} color="#A0A0A0" />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput style={styles.input} placeholder="+91 985*******" placeholderTextColor="#A0A0A0" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
            
            <TouchableOpacity style={styles.signupButton} onPress={handleSignUp} disabled={loading}>
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.signupButtonText}>Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.signupButtonText}>SIGN UP</Text>
              )}
            </TouchableOpacity>

            {/* --- TERMS AND PRIVACY POLICY --- */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By clicking, I accept the <Text style={styles.termsLink} onPress={() => navigation.navigate("Terms")}>Terms and Conditions</Text> and <Text style={styles.termsLink} onPress={() => navigation.navigate("PrivacyPolicy")}>Privacy Policy</Text>
              </Text>
            </View>
            {/* -------------------------------- */}

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.signupLink}> LOG IN</Text>
              </TouchableOpacity>
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
  header: { alignItems: "center", marginBottom: 20 },
  logo: { width: 80, height: 80 },
  title: { fontSize: 28, color: "#000", fontFamily: "Sen_Bold" },
  subtitle: { fontSize: 14, color: "#555", fontFamily: "Sen_Regular" },
  form: { width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  row: { flexDirection: "row", marginBottom: 15 },
  label: { fontSize: 12, color: "#5C5C5C", marginTop: 10, marginBottom: 5, fontFamily: "Sen_Regular" },
  input: { backgroundColor: "#F3F6FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#333", fontFamily: "Sen_Regular" },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  eyeIcon: { position: "absolute", right: 15 },
  signupButton: { backgroundColor: "#28A745", borderRadius: 10, alignItems: "center", paddingVertical: 14, marginTop: 25, justifyContent: 'center' },
  signupButtonText: { color: "#fff", fontSize: 15, fontFamily: "Sen_Medium" },
  termsContainer: { marginTop: 5, alignItems: 'center', paddingHorizontal: 10 },
  termsText: { color: "#5C5C5C", fontSize: 10, textAlign: 'center', fontFamily: "Sen_Regular", lineHeight: 14 },
  termsLink: { color: "#28A745", fontFamily: "Sen_Medium", fontSize: 10, textDecorationLine: 'underline' },
  signupContainer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  signupText: { color: "#5C5C5C", fontFamily: "Sen_Regular" },
  signupLink: { color: "#28A745", fontFamily: "Sen_Medium" },
});