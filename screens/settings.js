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
  TextInput,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

// 🔥 NATIVE FIREBASE AUTH & FIRESTORE IMPORTS 🔥
import { auth, db } from "../firebase";
import { EmailAuthProvider, reauthenticateWithCredential } from "@react-native-firebase/auth";
import { doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "@react-native-firebase/firestore";

import { useFonts } from "expo-font";
import { Sen_400Regular, Sen_500Medium, Sen_700Bold } from "@expo-google-fonts/sen";

// --- IMPORT CONTEXT ---
import { useUser } from "../context/UserContext";
import { useAdmin } from "../context/AdminContext";

export default function Settings() {
  const navigation = useNavigation();
  
  const { userData, loading: userLoading } = useUser();
  const { activeBranchIds } = useAdmin();

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

  // Delivery Boy Application State
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    firstName: "",
    lastName: "",
    mobile: ""
  });

  // --- CUSTOM INFO MODAL STATE (Replaces Alert.alert) ---
  const [infoModal, setInfoModal] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info", // "error", "success", "info"
    onCloseAction: null
  });

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
      
      setDeliveryForm({
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        mobile: userData.mobile || ""
      });
    }
  }, [userData]);

  // --- HELPER TO SHOW CUSTOM ALERTS ---
  const showGlobalModal = (title, message, type = "info", onCloseAction = null) => {
    setInfoModal({ visible: true, title, message, type, onCloseAction });
  };

  const handleCloseGlobalModal = () => {
    const action = infoModal.onCloseAction;
    setInfoModal({ ...infoModal, visible: false });
    if (action) action();
  };

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

  // --- JOIN AS DELIVERY BOY ---
  const handleDeliveryPress = () => {
    const user = auth.currentUser;
    if (!user) {
      showGlobalModal("Authentication Required", "Please log in to apply as a delivery partner.", "error");
      return;
    }

    if (!activeBranchIds || activeBranchIds.length === 0) {
      showGlobalModal(
        "Not Available",
        "We currently do not have an active branch in your area. Please check back later!",
        "info"
      );
      return;
    }

    setShowDeliveryModal(true);
  };

  const submitDeliveryApplication = async () => {
    if (!deliveryForm.firstName.trim() || !deliveryForm.mobile.trim()) {
      showGlobalModal("Required Fields", "Please provide at least your First Name and Mobile Number.", "error");
      return;
    }

    setIsApplying(true);
    try {
      const user = auth.currentUser;
      const applicationId = `APP_${user.uid}_${Date.now()}`;
      const applicationRef = doc(db, "delivery_applications", applicationId);
      
      await setDoc(applicationRef, {
        userId: user.uid,
        firstName: deliveryForm.firstName.trim(),
        lastName: deliveryForm.lastName.trim(),
        mobile: deliveryForm.mobile.trim(),
        targetBranches: activeBranchIds,
        status: "pending",
        createdAt: serverTimestamp()
      });

      setShowDeliveryModal(false);
      showGlobalModal("Success", "Your application has been submitted! Our team will contact you soon.", "success");
      
    } catch (error) {
      console.error("Delivery application error:", error);
      showGlobalModal("Error", "Failed to submit application. Please try again.", "error");
    } finally {
      setIsApplying(false);
    }
  };

  // --- ENTERPRISE DELETION FLOW ---
  const initiateDeletion = () => {
    const user = auth.currentUser;
    if (!user) return;

    const lastSignInTime = new Date(user.metadata.lastSignInTime).getTime();
    const timeSinceLogin = Date.now() - lastSignInTime;
    const REAUTH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    setShowDeleteModal(false);

    if (timeSinceLogin > REAUTH_THRESHOLD) {
      setReauthPassword("");
      setReauthError("");
      setShowReauthModal(true);
    } else {
      executeDeletion();
    }
  };

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
      
      setIsAuthenticating(false);
      setShowReauthModal(false);
      await executeDeletion();
    } catch (error) {
      setIsAuthenticating(false);
      setReauthError("Incorrect password. Please try again.");
    }
  };

  const executeDeletion = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setShowDeleteModal(false);
    setShowReauthModal(false);
    setShowFullScreenLoader(true);

    try {
      const userId = user.uid;

      await deleteDoc(doc(db, "carts", userId));
      await deleteDoc(doc(db, "users", userId));

      await user.delete();

      setShowFullScreenLoader(false);
      showGlobalModal(
        "Account Deleted", 
        "Your personal data has been erased. We're sorry to see you go.", 
        "success",
        () => navigation.reset({ index: 0, routes: [{ name: "NewLogin" }] })
      );

    } catch (error) {
      console.error("Deletion Error", error);
      setShowFullScreenLoader(false);
      showGlobalModal("Error", "Could not complete account deletion. Please try again or contact support.", "error");
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
        
        {/* --- NOTIFICATIONS SECTION --- */}
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

        {/* --- JOIN US SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>PARTNER WITH US</Text>
        </View>

        <View style={styles.whiteContainer}>
          <TouchableOpacity style={[styles.row, { paddingVertical: 18 }]} onPress={handleDeliveryPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FontAwesome5 name="motorcycle" size={18} color="#009688" style={{ marginRight: 15 }} />
              <Text style={styles.rowLabel}>Join as Delivery Boy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* --- DANGER ZONE SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>ACCOUNT DELETION</Text>
        </View>

        <View style={styles.whiteContainer}>
          <TouchableOpacity style={styles.row} onPress={() => setShowDeleteModal(true)}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- GLOBAL INFO/ALERT MODAL --- */}
      <Modal
        visible={infoModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseGlobalModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.warningIcon, 
              { backgroundColor: infoModal.type === 'success' ? '#E8F5E9' : infoModal.type === 'error' ? '#FFECEC' : '#E0F7FA' }
            ]}>
              <Ionicons 
                name={infoModal.type === 'success' ? "checkmark-circle" : infoModal.type === 'error' ? "warning" : "information-circle"} 
                size={40} 
                color={infoModal.type === 'success' ? "#28A745" : infoModal.type === 'error' ? "#E63946" : "#00BCD4"} 
              />
            </View>
            <Text style={styles.modalTitle}>{infoModal.title}</Text>
            <Text style={styles.modalText}>{infoModal.message}</Text>
            <TouchableOpacity 
              style={[
                styles.deleteBtn, 
                { width: '100%', backgroundColor: infoModal.type === 'success' ? '#28A745' : infoModal.type === 'error' ? '#E63946' : '#00BCD4' }
              ]} 
              onPress={handleCloseGlobalModal}
            >
              {/* 🔥 FIXED: Hardcoded color to #fff so it never inherits a dark color */}
              <Text style={[styles.modaltexttt, { color: '#fff' }]}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- DELIVERY BOY APPLICATION MODAL --- */}
      <Modal
        visible={showDeliveryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !isApplying && setShowDeliveryModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.warningIcon, { backgroundColor: '#E0F2F1' }]}>
              <FontAwesome5 name="motorcycle" size={32} color="#009688" />
            </View>
            <Text style={styles.modalTitle}>Join the Team</Text>
            <Text style={styles.modalText}>
              Please confirm your details below to apply as a delivery partner in your area.
            </Text>

            <View style={styles.inputWrapper}>
               <TextInput
                 style={styles.modalInput}
                 placeholder="First Name"
                 placeholderTextColor="#aaa"
                 value={deliveryForm.firstName}
                 onChangeText={(text) => setDeliveryForm({...deliveryForm, firstName: text})}
                 editable={!isApplying}
               />
            </View>

            <View style={styles.inputWrapper}>
               <TextInput
                 style={styles.modalInput}
                 placeholder="Last Name"
                 placeholderTextColor="#aaa"
                 value={deliveryForm.lastName}
                 onChangeText={(text) => setDeliveryForm({...deliveryForm, lastName: text})}
                 editable={!isApplying}
               />
            </View>

            <View style={styles.inputWrapper}>
               <TextInput
                 style={styles.modalInput}
                 placeholder="Mobile Number"
                 placeholderTextColor="#aaa"
                 keyboardType="phone-pad"
                 value={deliveryForm.mobile}
                 onChangeText={(text) => setDeliveryForm({...deliveryForm, mobile: text})}
                 editable={!isApplying}
               />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setShowDeliveryModal(false)}
                disabled={isApplying}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteBtn, { backgroundColor: '#009688' }]} 
                onPress={submitDeliveryApplication}
                disabled={isApplying}
              >
                {isApplying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.deleteBtnText, { color: '#fff' }]}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- WARNING MODAL (Account Deletion) --- */}
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
                <Text style={[styles.deleteBtnText, { color: '#fff' }]}>Proceed</Text>
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
              style={[styles.passwordInput, { marginBottom: 10 }]}
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
                {isAuthenticating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.deleteBtnText, { color: '#fff' }]}>Confirm</Text>}
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
  modalTitle: { fontSize: 20, fontFamily: "Sen_Bold", color: '#1A1A1A', marginBottom: 10, textAlign: 'center' },
  modalText: { fontSize: 14, fontFamily: "Sen_Regular", color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  
  // Form Inputs
  inputWrapper: { width: '100%', marginBottom: 12 },
  modalInput: { width: '100%', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Sen_Regular", borderWidth: 1, borderColor: '#E5E7EB', color: '#111' },
  passwordInput: { width: '100%', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Sen_Regular", borderWidth: 1, borderColor: '#E5E7EB', color: '#111' },
  
  errorText: { color: '#E63946', fontSize: 12, fontFamily: "Sen_Medium", marginBottom: 15, width: '100%', textAlign: 'left', paddingLeft: 4 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 16, fontFamily: "Sen_Medium" },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#E63946', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontFamily: "Sen_Bold", fontSize: 16, color: '#fff' }, 
  modaltexttt: { fontFamily: "Sen_Bold", fontSize: 16, color: '#fff' },

  // FULL SCREEN LOADER STYLES
  fullScreenLoaderOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  fullScreenLoaderContent: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 10, minWidth: 200 },
  fullScreenLoaderText: { marginTop: 20, fontSize: 16, fontFamily: "Sen_Bold", color: '#1A1A1A' },
  fullScreenLoaderSubText: { marginTop: 6, fontSize: 13, fontFamily: "Sen_Regular", color: '#666' }
});