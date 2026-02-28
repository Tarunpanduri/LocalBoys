import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView,
  Modal,
  Platform,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function EditProfile({ navigation, route }) {
  const { userData } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState(userData?.firstName || "");
  const [lastName, setLastName] = useState(userData?.lastName || "");
  const [mobile, setMobile] = useState(userData?.mobile || "");

  // --- CUSTOM MODAL STATE ---
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "error", 
    onConfirm: null
  });

  const showModal = (title, message, type = "error", onConfirm = null) => {
    setModalConfig({ visible: true, title, message, type, onConfirm });
  };

  const closeModal = () => {
    const { onConfirm } = modalConfig;
    setModalConfig(prev => ({ ...prev, visible: false }));
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !mobile.trim()) {
      showModal("Validation Error", "First name and mobile number are required to update your profile.", "validation");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      showModal("Authentication Error", "You must be logged in to update your profile.", "error");
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
      });

      showModal("Success", "Your profile has been updated successfully.", "success", () => {
        navigation.goBack();
      });

    } catch (error) {
      console.error("Profile update error:", error);
      showModal("Update Failed", error.message || "Failed to update profile. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={firstName} 
              onChangeText={setFirstName} 
              placeholder="Enter first name" 
              placeholderTextColor="#aaa"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={lastName} 
              onChangeText={setLastName} 
              placeholder="Enter last name" 
              placeholderTextColor="#aaa"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#888" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              value={mobile} 
              onChangeText={setMobile} 
              placeholder="Enter mobile number" 
              keyboardType="phone-pad" 
              placeholderTextColor="#aaa"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSave} 
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* --- CUSTOM GLOBAL MODAL --- */}
      <Modal 
        animationType="fade" 
        transparent={true} 
        visible={modalConfig.visible} 
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.modalIconContainer, 
              { backgroundColor: modalConfig.type === 'success' ? '#E8F5E9' : modalConfig.type === 'validation' ? '#FFF3E0' : '#FFECEC' }
            ]}>
              <Ionicons 
                name={modalConfig.type === 'success' ? "checkmark-circle-outline" : modalConfig.type === 'validation' ? "warning-outline" : "close-circle-outline"} 
                size={40} 
                color={modalConfig.type === 'success' ? "#28A745" : modalConfig.type === 'validation' ? "#FF9800" : "#E63946"} 
              />
            </View>
            <Text style={styles.modalTitle}>{modalConfig.title}</Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[
                styles.modalPrimaryBtn, 
                { backgroundColor: modalConfig.type === 'success' ? "#28A745" : "#ff7a00" }
              ]} 
              onPress={closeModal}
            >
              <Text style={styles.modalPrimaryBtnText}>{modalConfig.type === 'success' ? "Awesome" : "Okay"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  headerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: "Sen_Bold", color: "#111" },
  container: { padding: 20, paddingTop: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: "Sen_Bold", color: "#555", marginBottom: 8, marginLeft: 4 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Sen_Medium", color: "#111" },
  saveButton: { 
    backgroundColor: "#ff7a00", 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: "center", 
    marginTop: 20,
    shadowColor: "#ff7a00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: "#fff", fontSize: 16, fontFamily: "Sen_Bold" },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 10 },
  modalIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 20, color: '#111', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  modalPrimaryBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 16 },
});