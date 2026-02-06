import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAuth, deleteUser, signOut } from "firebase/auth";
import { getDatabase, ref, remove, update, get } from "firebase/database";
import { useFonts } from "expo-font";
import { Sen_400Regular, Sen_500Medium, Sen_700Bold } from "@expo-google-fonts/sen";

export default function Settings() {
  const navigation = useNavigation();
  const auth = getAuth();
  const db = getDatabase();
  const user = auth.currentUser;

  // Loading State for Settings
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Toggles State (Default true)
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  // Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [fontsLoaded] = useFonts({
    Sen_Regular: Sen_400Regular,
    Sen_Medium: Sen_500Medium,
    Sen_Bold: Sen_700Bold,
  });

  // --- 1. FETCH SETTINGS ON LOAD ---
  useEffect(() => {
    if (!user) return;

    const fetchPreferences = async () => {
      try {
        const prefRef = ref(db, `users/${user.uid}/preferences`);
        const snapshot = await get(prefRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          // If data exists, use it. If a key is missing, default to true.
          setSmsEnabled(data.smsEnabled !== undefined ? data.smsEnabled : true);
          setWhatsappEnabled(data.whatsappEnabled !== undefined ? data.whatsappEnabled : true);
        } else {
          // If no data (First Time), set both to true in DB
          await update(prefRef, {
            smsEnabled: true,
            whatsappEnabled: true
          });
          setSmsEnabled(true);
          setWhatsappEnabled(true);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchPreferences();
  }, []);

  // --- 2. HANDLE TOGGLES ---
  const handleSmsToggle = async (value) => {
    setSmsEnabled(value); // Optimistic Update (UI changes immediately)
    if (user) {
      try {
        await update(ref(db, `users/${user.uid}/preferences`), {
          smsEnabled: value
        });
      } catch (error) {
        console.error("Failed to update SMS pref:", error);
        setSmsEnabled(!value); // Revert on error
      }
    }
  };

  const handleWhatsappToggle = async (value) => {
    setWhatsappEnabled(value); // Optimistic Update
    if (user) {
      try {
        await update(ref(db, `users/${user.uid}/preferences`), {
          whatsappEnabled: value
        });
      } catch (error) {
        console.error("Failed to update WhatsApp pref:", error);
        setWhatsappEnabled(!value); // Revert on error
      }
    }
  };

  // --- 3. HANDLE DELETE ACCOUNT (SAFE VERSION) ---
  const handleDeleteAccount = async () => {
    if (!user) return;

    // --- STEP A: SAFETY CHECK BEFORE DELETING DATA ---
    // Calculate how long ago the user signed in
    const lastSignInTime = new Date(user.metadata.lastSignInTime).getTime();
    const currentTime = Date.now();
    const timeSinceLogin = currentTime - lastSignInTime;
    const REAUTH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

    // If login was more than 5 minutes ago, force re-login NOW.
    // We do this BEFORE setIsDeleting(true) and BEFORE removing any data.
    if (timeSinceLogin > REAUTH_THRESHOLD) {
      setShowDeleteModal(false); // Close the modal
      Alert.alert(
        "Security Check Required", 
        "For your security, you must have recently logged in to delete your account. Please log in again to verify your identity.",
        [
          { 
            text: "Log In Now", 
            onPress: async () => {
              // Log them out and send to login screen
              await signOut(auth);
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return; // STOP HERE. Data is safe.
    }

    // --- STEP B: PROCEED WITH DELETION ---
    setIsDeleting(true);
    try {
      const userId = user.uid;

      // 1. Delete User Data from Realtime Database
      await Promise.all([
        remove(ref(db, `users/${userId}`)),
        remove(ref(db, `orders/${userId}`))
      ]);

      // 2. Delete User Authentication
      await deleteUser(user);

      setShowDeleteModal(false);
      Alert.alert("Account Deleted", "Your data has been erased. We're sorry to see you go.");
      
      // Navigate to Login (Reset Stack)
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });

    } catch (error) {
      console.error("Delete Error", error);
      
      // Double safety net: In case the time check passes but Firebase still rejects it
      if (error.code === 'auth/requires-recent-login') {
         Alert.alert(
          "Security Check", 
          "Please log out and log back in to delete your account."
        );
      } else {
        Alert.alert("Error", "Could not delete account. Please try again later.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!fontsLoaded || loadingSettings) {
    return <View style={styles.loadingContainer}><ActivityIndicator color="#FF6B00" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* SECTION 1: RECOMMENDATIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>RECOMMENDATIONS & REMINDERS</Text>
        </View>

        <View style={styles.whiteContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              Keep this on to receive offer recommendations & timely reminders based on your interests
            </Text>
          </View>
          
          <View style={styles.divider} />

          {/* SMS Toggle */}
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

          {/* WhatsApp Toggle */}
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
          Order related SMS cannot be disabled as they are critical to provide service
        </Text>

        {/* SECTION 3: ACCOUNT DELETION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>ACCOUNT DELETION</Text>
        </View>

        <View style={styles.whiteContainer}>
          <TouchableOpacity style={styles.row} onPress={() => setShowDeleteModal(true)}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* --- DELETE CONFIRMATION MODAL --- */}
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
              No data is stored after this. We will miss you!{"\n\n"}
              This will permanently delete your profile and order history.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteBtn} 
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F5F7" },
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7", 
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    paddingRight: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Sen_Bold",
    color: "#333",
    textTransform: "uppercase",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontFamily: "Sen_Bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  whiteContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  infoRow: {
    paddingVertical: 16,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Sen_Regular",
    color: "#666",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: "Sen_Medium",
    color: "#222",
  },
  deleteText: {
    fontSize: 16,
    fontFamily: "Sen_Bold",
    color: "#FF6B00",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },
  footerNote: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 12,
    fontFamily: "Sen_Regular",
    color: "#888",
    lineHeight: 16,
  },
  
  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 25,
    width: '100%',
    alignItems: 'center',
    elevation: 10
  },
  warningIcon: {
    backgroundColor: '#FFECEC',
    padding: 15,
    borderRadius: 50,
    marginBottom: 15
  },
  modalTitle: { fontSize: 20, fontFamily: "Sen_Bold", color: '#1A1A1A', marginBottom: 10 },
  modalText: { fontSize: 14, fontFamily: "Sen_Regular", color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 25 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 16, fontFamily: "Sen_Medium" },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#E63946', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 16, fontFamily: "Sen_Bold" }
});