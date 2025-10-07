import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    setLoading(true);
    const firebaseAuth = getAuth();
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      navigation.navigate("MapScreen");
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -70} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.header}>
              <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>Log In</Text>
              <Text style={styles.subtitle}>Please sign in to your existing account</Text>
            </View>
            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput style={styles.input} placeholder="example@gmail.com" placeholderTextColor="#A0A0A0" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="********" placeholderTextColor="#A0A0A0" secureTextEntry={secureText} value={password} onChangeText={setPassword} autoCapitalize="none" />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setSecureText(!secureText)}>
                  <Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={22} color="#A0A0A0" />
                </TouchableOpacity>
              </View>
              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.rememberMe} >
                  <TouchableOpacity style={[styles.checkbox, rememberMe && { backgroundColor: "#28A745" }]} onPress={() => setRememberMe(!rememberMe)} />
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity><Text style={styles.forgotText}>Forgot Password</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}><Text style={styles.loginButtonText}>{loading ? "Logging In..." : "LOG IN"}</Text></TouchableOpacity>
              <View style={styles.signupContainer}><Text style={styles.signupText}>Don’t have an account?</Text><TouchableOpacity onPress={() => navigation.navigate("SignUp")}><Text style={styles.signupLink}> SIGN UP</Text></TouchableOpacity></View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#B0E57E", marginBottom: -30 },
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