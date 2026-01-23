import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateUserData } from "../utils/profile_util";

export default function EditProfile({ navigation, route }) {
  const { userData } = route.params || {};
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState(userData?.firstName || "");
  const [lastName, setLastName] = useState(userData?.lastName || "");
  const [mobile, setMobile] = useState(userData?.mobile || "");

  const handleSave = async () => {
    if (!firstName.trim() || !mobile.trim()) {
      Alert.alert("Validation Error", "First name and mobile number are required.");
      return;
    }

    setLoading(true);
    try {
      await updateUserData({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
      });

      Alert.alert("Success", "Profile updated successfully");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Edit Profile</Text>

        <Text style={styles.label}>First Name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Enter first name" />

        <Text style={styles.label}>Last Name</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Enter last name" />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput style={styles.input} value={mobile} onChangeText={setMobile} placeholder="Enter mobile number" keyboardType="phone-pad" />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  container: { padding: 20 },
  header: { fontSize: 24, fontFamily: "Sen_Bold", marginBottom: 20, color: "#000" },
  label: { fontSize: 14, fontFamily: "Sen_Medium", color: "#666", marginBottom: 5 },
  input: { backgroundColor: "#fff", paddingHorizontal: 15, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 15, fontSize: 16, fontFamily: "Sen_Regular", color: "#1A1A1A" },
  saveButton: { backgroundColor: "#28A745", paddingVertical: 15, borderRadius: 10, alignItems: "center", marginTop: 10 },
  saveButtonText: { color: "#fff", fontSize: 16, fontFamily: "Sen_Bold" },
});