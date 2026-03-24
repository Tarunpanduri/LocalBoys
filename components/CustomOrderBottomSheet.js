import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  Image, 
  ActivityIndicator, 
  Keyboard 
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import Toast from "react-native-root-toast";
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { getAuth } from "firebase/auth";

// 🔥 FIRESTORE IMPORTS 🔥
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// IMPORT CONTEXTS
import { useUser } from "../context/UserContext";
import { useAdmin } from "../context/AdminContext";

export default function CustomOrderBottomSheet({ 
  bottomSheetRef, 
  activeCategoryColor, 
  setModalFeatureText, 
  setLoginModalVisible, 
  addressesSheetRef 
}) {
  const { user, userLocation, mainAddress } = useUser();
  const { allBranches, activeBranchIds } = useAdmin();

  const [customNote, setCustomNote] = useState("");
  const [customImage, setCustomImage] = useState(null);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  const customSnapPoints = useMemo(() => ["90%"], []);
  
  const renderCustomBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setCustomImage(result.assets[0].uri);
    }
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
        const a = Math.sin(dLat/2)**2 + Math.cos(userLocation.lat*Math.PI/180) * Math.cos(branch.lat*Math.PI/180) * Math.sin(dLon/2)**2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        if (distance < minDistance) {
          minDistance = distance;
          closestId = id;
        }
      }
    });
    return closestId;
  };

  const handleCustomOrderSubmit = async () => {
    const authUser = getAuth().currentUser; 
    
    if (!authUser) {
      bottomSheetRef.current?.close(); 
      setModalFeatureText("place a custom order");
      setLoginModalVisible(true);
      return;
    }
    
    if (!customNote.trim()) {
      Toast.show("Please add a description for your order.", { duration: Toast.durations.LONG });
      return;
    }
    if (!customImage) {
      Toast.show("Please upload a reference image.", { duration: Toast.durations.LONG });
      return;
    }
    if (!mainAddress) {
      Toast.show("Please set a delivery address first.", { duration: Toast.durations.SHORT });
      bottomSheetRef.current?.close();
      addressesSheetRef.current?.expand();
      return;
    }

    setIsSubmittingCustom(true);
    Keyboard.dismiss(); 

    try {
      let uploadedImageUrl = null;
      
      const response = await fetch(customImage);
      const blob = await response.blob();
      const storage = getStorage();
      const filename = `custom_orders/${authUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      
      const uploadTask = await uploadBytesResumable(storageRef, blob);
      uploadedImageUrl = await getDownloadURL(uploadTask.ref);

      const nearestBranchId = getNearestBranchId();

      await addDoc(collection(db, "custom_orders"), {
        userId: authUser.uid,
        branchId: nearestBranchId,
        note: customNote.trim(),
        imageUrl: uploadedImageUrl,
        deliveryAddress: mainAddress,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Toast.show("Order placed successfully! Our delivery partner will contact you shortly.", { 
        duration: Toast.durations.LONG,
        backgroundColor: "#28A745"
      });
      
      setCustomNote("");
      setCustomImage(null);
      bottomSheetRef.current?.close();
      
    } catch (error) {
      console.error("Custom order failed:", error);
      Toast.show("Failed to place order. Please try again.", { duration: Toast.durations.LONG });
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1} 
      snapPoints={customSnapPoints}
      backdropComponent={renderCustomBackdrop}
      enablePanDownToClose={true}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetIndicator}
    >
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.customFormContainer}>
        <View style={styles.customModalHeader}>
          <Text style={styles.customModalTitle}>Anything Delivered</Text>
          <TouchableOpacity onPress={() => bottomSheetRef.current?.close()} style={{ padding: 4 }}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.customAddressDisplay}>
          <View style={styles.customAddressIcon}>
            <Ionicons name="location" size={20} color="#009688" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customAddressLabel}>Delivery Address</Text>
            <Text style={styles.customAddressText} numberOfLines={2}>
              {mainAddress ? mainAddress.formattedAddress : "No address selected"}
            </Text>
          </View>
        </View>

        <Text style={styles.customSub}>Tell us what you need, and our nearest delivery partner will fetch it for you.</Text>

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
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Reference Image *</Text>
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
            {customImage ? (
              <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Image source={{ uri: customImage }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setCustomImage(null)}>
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

        <TouchableOpacity 
          style={[styles.submitCustomBtn, { backgroundColor: activeCategoryColor }, isSubmittingCustom && { opacity: 0.7 }]} 
          onPress={handleCustomOrderSubmit}
          disabled={isSubmittingCustom}
        >
          {isSubmittingCustom ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitCustomText}>Place Custom Order</Text>
          )}
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bottomSheetBackground: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bottomSheetIndicator: { backgroundColor: '#ccc', width: 40, height: 5, marginTop: 10 },
  customModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E5E9F0' },
  customModalTitle: { fontSize: 20, fontFamily: "Sen_Bold", color: "#111" },
  customFormContainer: { paddingHorizontal: 20, paddingBottom: 50 },
  customAddressDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F6FA', padding: 12, borderRadius: 12, marginBottom: 15 },
  customAddressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customAddressLabel: { fontSize: 12, fontFamily: "Sen_Bold", color: "#555", marginBottom: 2 },
  customAddressText: { fontSize: 13, fontFamily: "Sen_Medium", color: "#111" },
  customSub: { fontSize: 14, fontFamily: "Sen_Regular", color: "#666", marginBottom: 20, lineHeight: 20 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontFamily: "Sen_Bold", color: "#333", marginBottom: 8, marginLeft: 4 },
  customInput: { backgroundColor: "#F3F6FA", borderRadius: 12, padding: 16, fontSize: 15, fontFamily: "Sen_Regular", color: "#111", minHeight: 100, borderWidth: 1, borderColor: "#E5E9F0" },
  imagePickerBtn: { backgroundColor: "#F3F6FA", borderRadius: 12, borderWidth: 1, borderColor: "#E5E9F0", borderStyle: "dashed", height: 140, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  imagePlaceholder: { alignItems: "center" },
  imagePlaceholderText: { color: "#888", fontFamily: "Sen_Medium", marginTop: 8, fontSize: 13 },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  removeImageBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 14, padding: 2, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  submitCustomBtn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  submitCustomText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 16 },
});