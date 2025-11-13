import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { db } from "../firebase";
import { Ionicons } from "@expo/vector-icons";

export default function SignUp({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password || !mobile) return;
    setLoading(true);
    try {
      const { user: { uid } } = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      await set(ref(db, `users/${uid}`), { uid, firstName, lastName, email, mobile, createdAt: new Date().toISOString() });
      navigation.navigate("Login");
    } catch (e) { Alert.alert("Sign Up Failed", e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -70} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}><Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" /><Text style={styles.title}>Sign Up</Text><Text style={styles.subtitle}>Create a new account</Text></View>
          <View style={styles.form}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}><Text style={styles.label}>First Name</Text><TextInput style={styles.input} placeholder="John" placeholderTextColor="#A0A0A0" value={firstName} onChangeText={setFirstName} /></View>
              <View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.label}>Last Name</Text><TextInput style={styles.input} placeholder="Doe" placeholderTextColor="#A0A0A0" value={lastName} onChangeText={setLastName} /></View>
            </View>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="example@gmail.com" placeholderTextColor="#A0A0A0" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}><TextInput style={[styles.input, { flex: 1 }]} placeholder="********" placeholderTextColor="#A0A0A0" secureTextEntry={secureText} value={password} onChangeText={setPassword} autoCapitalize="none" /><TouchableOpacity style={styles.eyeIcon} onPress={() => setSecureText(!secureText)}><Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={22} color="#A0A0A0" /></TouchableOpacity></View>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput style={styles.input} placeholder="+91 985*******" placeholderTextColor="#A0A0A0" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
            <TouchableOpacity style={styles.signupButton} onPress={handleSignUp} disabled={loading}><Text style={styles.signupButtonText}>{loading ? "Creating Account..." : "SIGN UP"}</Text></TouchableOpacity>
            <View style={styles.signupContainer}><Text style={styles.signupText}>Already have an account?</Text><TouchableOpacity onPress={() => navigation.navigate("Login")}><Text style={styles.signupLink}> LOG IN</Text></TouchableOpacity></View>
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
  row: { flexDirection: "row", marginBottom: 15 },
  label: { fontSize: 12, color: "#5C5C5C", marginTop: 10, marginBottom: 5, fontFamily: "Sen_Regular" },
  input: { backgroundColor: "#F3F6FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#333", fontFamily: "Sen_Regular" },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  eyeIcon: { position: "absolute", right: 15 },
  signupButton: { backgroundColor: "#28A745", borderRadius: 10, alignItems: "center", paddingVertical: 14, marginTop: 25 },
  signupButtonText: { color: "#fff", fontSize: 15, fontFamily: "Sen_Medium" },
  signupContainer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  signupText: { color: "#5C5C5C", fontFamily: "Sen_Regular" },
  signupLink: { color: "#28A745", fontFamily: "Sen_Medium" },
});