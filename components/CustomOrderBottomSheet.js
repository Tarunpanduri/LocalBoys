import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Keyboard, ScrollView, KeyboardAvoidingView,
  Platform, Modal, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import Toast from "react-native-root-toast";
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

import { auth } from '../firebase';

import { useUser } from "../context/UserContext";
import { useAdmin } from "../context/AdminContext";

// Helper: compress image to WebP
const compressImageToWebP = async (imageUri) => {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.WEBP }
    );
    return manipResult.uri;
  } catch (error) {
    console.error("Image compression error:", error);
    return imageUri;
  }
};

export default function CustomOrderScreen({ navigation, route }) {
  const activeCategoryColor = route?.params?.activeCategoryColor || "#009688";
  const { userLocation, mainAddress } = useUser();
  const { allBranches, activeBranchIds } = useAdmin();

  const [customNote, setCustomNote] = useState("");
  const [customImage, setCustomImage] = useState(null);
  const [orderState, setOrderState] = useState("idle");
  const [deliveryPreference, setDeliveryPreference] = useState("now");
  const [scheduledDay, setScheduledDay] = useState("Today");
  const [scheduledTime, setScheduledTime] = useState("");
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  const TIME_SLOTS = [
    "10:00 AM - 12:00 PM", "12:00 PM - 02:00 PM", "02:00 PM - 04:00 PM",
    "04:00 PM - 06:00 PM", "06:00 PM - 08:00 PM", "08:00 PM - 10:00 PM"
  ];

  const handleCloseSheet = () => navigation.goBack();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) setCustomImage(result.assets[0].uri);
  };

  const getNearestBranchId = () => {
    if (!userLocation?.lat || !userLocation?.lng || !activeBranchIds.length) return null;
    let closestId = activeBranchIds[0];
    let minDistance = Infinity;
    const R = 6371;
    activeBranchIds.forEach(id => {
      const branch = allBranches.find(b => b.id === id);
      if (branch && branch.lat && branch.lng) {
        const dLat = (branch.lat - userLocation.lat) * Math.PI / 180;
        const dLon = (branch.lng - userLocation.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(userLocation.lat * Math.PI/180) *
                  Math.cos(branch.lat * Math.PI/180) *
                  Math.sin(dLon/2)**2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (distance < minDistance) {
          minDistance = distance;
          closestId = id;
        }
      }
    });
    return closestId;
  };

  const handleCustomOrderSubmit = async () => {
    const authUser = auth.currentUser;
    if (!authUser) {
      setLoginModalVisible(true);
      return;
    }
    if (!customNote.trim() && !customImage) {
      Toast.show("Please add a description or image for your order.", { duration: Toast.durations.LONG });
      return;
    }
    if (!mainAddress) {
      Toast.show("Please set a delivery address first.", { duration: Toast.durations.SHORT });
      navigation.navigate("AddressesScreen");
      return;
    }
    if (deliveryPreference === "schedule" && !scheduledTime) {
      Toast.show("Please select a time slot for your scheduled order.", { duration: Toast.durations.SHORT });
      return;
    }

    setOrderState("submitting");
    Keyboard.dismiss();

    try {
      const nearestBranchId = getNearestBranchId();
      if (!nearestBranchId) {
        setOrderState("failed_no_area");
        return;
      }

      // Prepare optional Base64 image
      let base64Image = null;
      if (customImage) {
        const compressedUri = await compressImageToWebP(customImage);
        base64Image = await FileSystem.readAsStringAsync(compressedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // ✅ MODULAR FUNCTIONS API
      const functions = getFunctions();
      const createCustomOrder = httpsCallable(functions, 'createCustomOrder');
      const result = await createCustomOrder({
        customNote: customNote.trim(),
        customImageBase64: base64Image,
        deliveryAddress: mainAddress,
        branchId: nearestBranchId,
        isScheduled: deliveryPreference === "schedule",
        scheduledAt: deliveryPreference === "schedule" ? `${scheduledDay}, ${scheduledTime}` : null,
      });

      if (result.data.success) {
        setOrderState("success");
      } else {
        throw new Error("Order creation failed");
      }
    } catch (error) {
      console.error("Custom order failed:", error);
      // Log the full server response if available
      if (error.code) console.error("Error code:", error.code);
      if (error.message) console.error("Error message:", error.message);
      if (error.details) console.error("Error details:", error.details);
      setOrderState("error");
    }
  };

  // ---------- UI rendering (no changes, same as before) ----------
  const renderScreenContent = () => {
    if (orderState === "success") {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#28A745" />
          <Text style={styles.stateTitle}>Order Successful!</Text>
          <Text style={styles.stateMessage}>
            Your custom order has been placed successfully. Our delivery partner will review it and contact you shortly.
          </Text>
          <TouchableOpacity
            style={[styles.stateBtn, { backgroundColor: activeCategoryColor }]}
            onPress={() => { handleCloseSheet(); navigation.navigate("TrackOrder"); }}
          >
            <Text style={styles.stateBtnText}>Track Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stateBtnOutline} onPress={handleCloseSheet}>
            <Text style={styles.stateBtnOutlineText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (orderState === "failed_no_area") {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="location-outline" size={80} color="#FF3B30" />
          <Text style={styles.stateTitle}>Service Unavailable</Text>
          <Text style={styles.stateMessage}>
            We're sorry, but there are no delivery branches available for your selected area yet.
          </Text>
          <TouchableOpacity
            style={[styles.stateBtn, { backgroundColor: activeCategoryColor }]}
            onPress={() => { setOrderState("idle"); navigation.navigate("AddressesScreen"); }}
          >
            <Text style={styles.stateBtnText}>Change Address</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stateBtnOutline} onPress={handleCloseSheet}>
            <Text style={styles.stateBtnOutlineText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (orderState === "error") {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle" size={80} color="#FF3B30" />
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.stateMessage}>
            We couldn't process your request. Please check your connection and try again.
          </Text>
          <TouchableOpacity
            style={[styles.stateBtn, { backgroundColor: activeCategoryColor }]}
            onPress={() => setOrderState("idle")}
          >
            <Text style={styles.stateBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stateBtnOutline} onPress={handleCloseSheet}>
            <Text style={styles.stateBtnOutlineText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Original form UI (unchanged)
    return (
      <View>
        <View style={styles.customModalHeader}>
          <Text style={styles.customModalTitle}>Anything Delivered</Text>
          <TouchableOpacity onPress={handleCloseSheet} style={{ padding: 4 }}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.customAddressDisplay}>
          <View style={styles.customAddressIcon}>
            <Ionicons name="location" size={20} color="#009688" />
          </View>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.customAddressLabel}>
              {mainAddress?.name ? `Delivery Address` : 'Delivery Address'}
            </Text>
            <Text style={styles.customAddressLabelName}>{mainAddress?.name}</Text>
            <Text style={styles.customAddressText} numberOfLines={2}>
              {mainAddress ? mainAddress.formattedAddress : "No address selected"}
            </Text>
          </View>
          <TouchableOpacity style={styles.changeAddressBtn} onPress={() => navigation.navigate("AddressesScreen")}>
            <Text style={styles.changeAddressText}>Change</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.customSub}>
          Tell us what you need, and our nearest delivery partner will fetch it for you.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Order Description *</Text>
          <TextInput
            style={styles.customInput}
            placeholder="E.g., Please buy 1kg tomatoes and 1 packet of bread from any local store."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={customNote}
            onChangeText={setCustomNote}
            editable={orderState !== "submitting"}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Reference Image</Text>
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} disabled={orderState === "submitting"}>
            {customImage ? (
              <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Image source={{ uri: customImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setCustomImage(null)}
                  disabled={orderState === "submitting"}
                >
                  <Ionicons name="close-circle" size={28} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={30} color="#888" />
                <Text style={styles.imagePlaceholderText}>Tap to upload photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Delivery Time *</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.modeBtn, deliveryPreference === "now" && { backgroundColor: activeCategoryColor }]}
              onPress={() => setDeliveryPreference("now")}
              disabled={orderState === "submitting"}
            >
              <Text style={[styles.modeText, deliveryPreference === "now" && styles.activeModeText]}>Deliver Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, deliveryPreference === "schedule" && { backgroundColor: activeCategoryColor }]}
              onPress={() => setDeliveryPreference("schedule")}
              disabled={orderState === "submitting"}
            >
              <Text style={[styles.modeText, deliveryPreference === "schedule" && styles.activeModeText]}>Schedule Later</Text>
            </TouchableOpacity>
          </View>

          {deliveryPreference === "schedule" && (
            <View style={styles.scheduleContainer}>
              <Text style={styles.scheduleLabel}>Select Day</Text>
              <View style={styles.dayRow}>
                <TouchableOpacity
                  style={[styles.dayBtn, scheduledDay === "Today" && { borderColor: activeCategoryColor, backgroundColor: activeCategoryColor + '1A' }]}
                  onPress={() => { setScheduledDay("Today"); setScheduledTime(""); }}
                  disabled={orderState === "submitting"}
                >
                  <Text style={[styles.dayText, scheduledDay === "Today" && { color: activeCategoryColor, fontFamily: 'Sen_Bold' }]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dayBtn, scheduledDay === "Tomorrow" && { borderColor: activeCategoryColor, backgroundColor: activeCategoryColor + '1A' }]}
                  onPress={() => { setScheduledDay("Tomorrow"); setScheduledTime(""); }}
                  disabled={orderState === "submitting"}
                >
                  <Text style={[styles.dayText, scheduledDay === "Tomorrow" && { color: activeCategoryColor, fontFamily: 'Sen_Bold' }]}>Tomorrow</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.scheduleLabel}>Select Time Slot</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotScroll}>
                {TIME_SLOTS.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.timeSlotBtn, scheduledTime === slot && { borderColor: activeCategoryColor, backgroundColor: activeCategoryColor }]}
                    onPress={() => setScheduledTime(slot)}
                    disabled={orderState === "submitting"}
                  >
                    <Text style={[styles.timeSlotText, scheduledTime === slot && styles.activeTimeSlotText]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitCustomBtn, { backgroundColor: activeCategoryColor }, orderState === "submitting" && { opacity: 0.7 }]}
          onPress={handleCustomOrderSubmit}
          disabled={orderState === "submitting"}
        >
          {orderState === "submitting" ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitCustomText}>Place Custom Order</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.customFormContainer} keyboardShouldPersistTaps="handled">
          {renderScreenContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="fade" transparent visible={loginModalVisible} onRequestClose={() => setLoginModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="person-add-outline" size={36} color="#009688" />
            </View>
            <Text style={styles.modalTitle}>Hello There!</Text>
            <Text style={styles.modalMessage}>
              You're currently browsing as a guest. To place a custom order, please log in or create a free account.
            </Text>
            <TouchableOpacity style={styles.modalLoginBtn} onPress={() => { setLoginModalVisible(false); navigation.navigate("NewLogin"); }}>
              <Text style={styles.modalLoginText}>Log In / Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLoginModalVisible(false)}>
              <Text style={styles.modalCancelText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... your existing styles (unchanged) ...
  safeArea: { flex: 1, backgroundColor: '#fff' },
  customFormContainer: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 10 },
  customModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E5E9F0' },
  customModalTitle: { fontSize: 20, fontFamily: "Sen_Bold", color: "#111" },
  customAddressDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F6FA', padding: 12, borderRadius: 12, marginBottom: 15 },
  customAddressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customAddressLabel: { fontSize: 12, fontFamily: "Sen_Bold", color: "#555", marginBottom: 2 },
  customAddressLabelName: { fontSize: 13, fontFamily: "Sen_Bold", color: "#0b0a0a", marginBottom: 2 },
  customAddressText: { fontSize: 13, fontFamily: "Sen_Medium", color: "#111" },
  changeAddressBtn: { backgroundColor: '#E0F2F1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  changeAddressText: { color: '#009688', fontFamily: 'Sen_Bold', fontSize: 12 },
  customSub: { fontSize: 14, fontFamily: "Sen_Regular", color: "#666", marginBottom: 20, lineHeight: 20 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontFamily: "Sen_Bold", color: "#333", marginBottom: 8, marginLeft: 4 },
  customInput: { backgroundColor: "#F3F6FA", borderRadius: 12, padding: 16, fontSize: 15, fontFamily: "Sen_Regular", color: "#111", minHeight: 100, borderWidth: 1, borderColor: "#E5E9F0" },
  imagePickerBtn: { backgroundColor: "#F3F6FA", borderRadius: 12, borderWidth: 1, borderColor: "#E5E9F0", borderStyle: "dashed", height: 140, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  imagePlaceholder: { alignItems: "center" },
  imagePlaceholderText: { color: "#888", fontFamily: "Sen_Medium", marginTop: 8, fontSize: 13 },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  removeImageBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 14, padding: 2, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2, marginBottom: 10 },
  modeBtn: { flex: 1, backgroundColor: "#F3F6FA", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4, borderWidth: 1, borderColor: "#E5E9F0" },
  modeText: { color: "#333", fontFamily: "Sen_Medium", fontSize: 13 },
  activeModeText: { color: "#fff", fontFamily: "Sen_Bold" },
  scheduleContainer: { backgroundColor: '#F3F6FA', padding: 14, borderRadius: 12, marginTop: 5, borderWidth: 1, borderColor: '#E5E9F0' },
  scheduleLabel: { fontSize: 12, fontFamily: 'Sen_Bold', color: '#555', marginBottom: 8, marginTop: 4 },
  dayRow: { flexDirection: 'row', marginBottom: 15 },
  dayBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginHorizontal: 4 },
  dayText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 13 },
  timeSlotScroll: { paddingBottom: 5, paddingRight: 20 },
  timeSlotBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginRight: 8 },
  timeSlotText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 12 },
  activeTimeSlotText: { color: '#fff', fontFamily: 'Sen_Bold' },
  submitCustomBtn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  submitCustomText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 16 },
  stateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 10 },
  stateTitle: { fontSize: 24, fontFamily: "Sen_Bold", color: "#111", marginTop: 20, marginBottom: 10, textAlign: 'center' },
  stateMessage: { fontSize: 15, fontFamily: "Sen_Regular", color: "#666", textAlign: "center", marginBottom: 30, lineHeight: 22 },
  stateBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  stateBtnText: { color: '#fff', fontFamily: "Sen_Bold", fontSize: 16 },
  stateBtnOutline: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  stateBtnOutlineText: { color: '#555', fontFamily: "Sen_Bold", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 20, color: '#111', marginBottom: 10 },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalLoginBtn: { backgroundColor: '#009688', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  modalLoginText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 16 },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { fontFamily: 'Sen_Medium', color: '#888', fontSize: 14 },
});