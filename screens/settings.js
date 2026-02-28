import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

// 🔥 FIREBASE AUTH & FIRESTORE IMPORTS 🔥
import { getAuth, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

import { useFonts } from "expo-font";
import { Sen_400Regular, Sen_500Medium, Sen_700Bold } from "@expo-google-fonts/sen";

// --- IMPORT CONTEXT ---
import { useUser } from "../context/UserContext";

export default function Settings() {
  const navigation = useNavigation();
  const auth = getAuth();
  
  const { userData, loading: userLoading } = useUser();

  // Toggles State
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  // Deletion & Re-Auth State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [showFullScreenLoader, setShowFullScreenLoader] = useState(false);
  
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");

  const [fontsLoaded] = useFonts({
    Sen_Regular: Sen_400Regular,
    Sen_Medium: Sen_500Medium,
    Sen_Bold: Sen_700Bold,
  });

  useEffect(() => {
    if (userData) {
      const prefs = userData.preferences || {};
      setSmsEnabled(prefs.smsEnabled !== undefined ? prefs.smsEnabled : true);
      setWhatsappEnabled(prefs.whatsappEnabled !== undefined ? prefs.whatsappEnabled : true);
    }
  }, [userData]);

  // --- TOGGLES ---
  const handleSmsToggle = async (value) => {
    setSmsEnabled(value); 
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { "preferences.smsEnabled": value });
      } catch (error) {
        setSmsEnabled(!value); 
      }
    }
  };

  const handleWhatsappToggle = async (value) => {
    setWhatsappEnabled(value);
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { "preferences.whatsappEnabled": value });
      } catch (error) {
        setWhatsappEnabled(!value); 
      }
    }
  };

  // --- ENTERPRISE DELETION FLOW ---
  
  // 1. Initiate Request
  const initiateDeletion = () => {
    const user = auth.currentUser;
    if (!user) return;

    const lastSignInTime = new Date(user.metadata.lastSignInTime).getTime();
    const timeSinceLogin = Date.now() - lastSignInTime;
    const REAUTH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    setShowDeleteModal(false);

    // If session is old, prompt in-app password confirmation
    if (timeSinceLogin > REAUTH_THRESHOLD) {
      setReauthPassword("");
      setReauthError("");
      setShowReauthModal(true);
    } else {
      executeDeletion();
    }
  };

  // 2. Re-Authenticate (If necessary)
  const handleReauthenticate = async () => {
    const user = auth.currentUser;
    if (!user || !reauthPassword.trim()) {
      setReauthError("Password is required.");
      return;
    }

    setIsAuthenticating(true);
    setReauthError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Stop local loader, close modal, and proceed to wipe
      setIsAuthenticating(false);
      setShowReauthModal(false);
      await executeDeletion();
    } catch (error) {
      setIsAuthenticating(false);
      setReauthError("Incorrect password. Please try again.");
    }
  };

  // 3. Execute Database Wipe
  const executeDeletion = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Show full screen blocking loader
    setShowDeleteModal(false);
    setShowReauthModal(false);
    setShowFullScreenLoader(true);

    try {
      const userId = user.uid;

      // 1. MUST wipe Firestore Data FIRST while the user is still Authenticated (to pass security rules)
      await deleteDoc(doc(db, "carts", userId));
      await deleteDoc(doc(db, "users", userId));

      // 2. Delete Firebase Auth Account LAST
      await deleteUser(user);

      // 3. Clean up and navigate out
      setShowFullScreenLoader(false);
      Alert.alert("Account Deleted", "Your personal data has been erased. We're sorry to see you go.");
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });

    } catch (error) {
      console.error("Deletion Error", error);
      setShowFullScreenLoader(false);
      Alert.alert("Error", "Could not complete account deletion. Please try again or contact support.");
    }
  };

  if (!fontsLoaded || userLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator color="#FF6B00" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>RECOMMENDATIONS & REMINDERS</Text>
        </View>

        <View style={styles.whiteContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              Keep this on to receive offer recommendations & timely reminders based on your interests.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>SMS</Text>
            <Switch
              trackColor={{ false: "#E0E0E0", true: "#08a710" }} 
              thumbColor={"#fff"}
              ios_backgroundColor="#E0E0E0"
              onValueChange={handleSmsToggle}
              value={smsEnabled}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>WhatsApp</Text>
            <Switch
              trackColor={{ false: "#E0E0E0", true: "#08a710" }}
              thumbColor={"#fff"}
              ios_backgroundColor="#E0E0E0"
              onValueChange={handleWhatsappToggle}
              value={whatsappEnabled}
            />
          </View>
        </View>

        <Text style={styles.footerNote}>
          Order related SMS cannot be disabled as they are critical to provide service.
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>ACCOUNT DELETION</Text>
        </View>

        <View style={styles.whiteContainer}>
          <TouchableOpacity style={styles.row} onPress={() => setShowDeleteModal(true)}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- WARNING MODAL --- */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.warningIcon}>
              <MaterialIcons name="report-problem" size={40} color="#E63946" />
            </View>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalText}>
              This action is permanent. It will erase your profile and you will lose access to your order history.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={initiateDeletion}>
                <Text style={styles.deleteBtnText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- IN-APP RE-AUTHENTICATION MODAL --- */}
      <Modal
        visible={showReauthModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !isAuthenticating && setShowReauthModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.warningIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="lock-closed" size={32} color="#FF9800" />
            </View>
            <Text style={styles.modalTitle}>Security Verification</Text>
            <Text style={styles.modalText}>
              For your security, please enter your password to confirm account deletion.
            </Text>

            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={reauthPassword}
              onChangeText={(text) => {
                setReauthPassword(text);
                setReauthError("");
              }}
              editable={!isAuthenticating}
            />
            {reauthError ? <Text style={styles.errorText}>{reauthError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setShowReauthModal(false)}
                disabled={isAuthenticating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteBtn} 
                onPress={handleReauthenticate}
                disabled={isAuthenticating}
              >
                {isAuthenticating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.deleteBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- FULL SCREEN LOADING MODAL --- */}
      <Modal
        visible={showFullScreenLoader}
        transparent={true}
        animationType="fade"
        // Prevent closing by tapping back button on Android
        onRequestClose={() => {}} 
      >
        <View style={styles.fullScreenLoaderOverlay}>
          <View style={styles.fullScreenLoaderContent}>
            <ActivityIndicator size="large" color="#E63946" />
            <Text style={styles.fullScreenLoaderText}>Deleting account...</Text>
            <Text style={styles.fullScreenLoaderSubText}>Please do not close the app</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F5F7" },
  container: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  backButton: { paddingRight: 16 },
  headerTitle: { fontSize: 16, fontFamily: "Sen_Bold", color: "#333", textTransform: "uppercase" },
  scrollContent: { paddingBottom: 40 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  sectionHeaderText: { fontSize: 12, fontFamily: "Sen_Bold", color: "#666", textTransform: "uppercase", letterSpacing: 0.5 },
  whiteContainer: { backgroundColor: "#fff", paddingHorizontal: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E0E0E0" },
  infoRow: { paddingVertical: 16 },
  infoText: { fontSize: 13, fontFamily: "Sen_Regular", color: "#666", lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  rowLabel: { fontSize: 16, fontFamily: "Sen_Medium", color: "#222" },
  deleteText: { fontSize: 16, fontFamily: "Sen_Bold", color: "#E63946" },
  divider: { height: 1, backgroundColor: "#F0F0F0" },
  footerNote: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, fontFamily: "Sen_Regular", color: "#888", lineHeight: 16 },
  
  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 25, width: '100%', alignItems: 'center', elevation: 10 },
  warningIcon: { backgroundColor: '#FFECEC', padding: 15, borderRadius: 50, marginBottom: 15 },
  modalTitle: { fontSize: 20, fontFamily: "Sen_Bold", color: '#1A1A1A', marginBottom: 10 },
  modalText: { fontSize: 14, fontFamily: "Sen_Regular", color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  passwordInput: { width: '100%', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Sen_Regular", marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  errorText: { color: '#E63946', fontSize: 12, fontFamily: "Sen_Medium", marginBottom: 15, width: '100%', textAlign: 'left', paddingLeft: 4 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 16, fontFamily: "Sen_Medium" },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#E63946', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 16, fontFamily: "Sen_Bold" },

  // FULL SCREEN LOADER STYLES
  fullScreenLoaderOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  fullScreenLoaderContent: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 10, minWidth: 200 },
  fullScreenLoaderText: { marginTop: 20, fontSize: 16, fontFamily: "Sen_Bold", color: '#1A1A1A' },
  fullScreenLoaderSubText: { marginTop: 6, fontSize: 13, fontFamily: "Sen_Regular", color: '#666' }
});