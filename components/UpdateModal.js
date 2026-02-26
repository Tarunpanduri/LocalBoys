import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../context/AdminContext'; // Assuming you have this context

// Helper function to compare semantic versions (e.g. "1.0.5" > "1.0.2")
const isVersionGreater = (newVer, currentVer) => {
  const v1 = newVer.split('.').map(Number);
  const v2 = currentVer.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
};

export default function UpdateModal() {
  const { appVersion } = useAdmin();
  const [updateType, setUpdateType] = useState('none'); 
  const [showSoftModal, setShowSoftModal] = useState(false);

  // Get current app version from Expo config
  const currentAppVersion = Constants.expoConfig.version || "0.0.0";

  useEffect(() => {
    if (!appVersion) return;

    const platformConfig = Platform.OS === 'ios' ? appVersion.ios : appVersion.android;
    if (!platformConfig) return;

    const needsHardUpdate = isVersionGreater(platformConfig.minSupported, currentAppVersion);
    const needsSoftUpdate = isVersionGreater(platformConfig.latest, currentAppVersion);

    if (needsHardUpdate) {
      setUpdateType('hard');
    } else if (needsSoftUpdate) {
      setUpdateType('soft');
      setShowSoftModal(true);
    }
  }, [appVersion, currentAppVersion]);

  const handleUpdatePress = () => {
    const platformConfig = Platform.OS === 'ios' ? appVersion.ios : appVersion.android;
    if (platformConfig?.storeUrl) {
      Linking.openURL(platformConfig.storeUrl).catch(err => console.error("Couldn't open store", err));
    }
  };

  if (updateType === 'none') return null;

  const isHard = updateType === 'hard';
  const isVisible = isHard ? true : showSoftModal;

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={[styles.iconWrap, isHard ? {backgroundColor: '#ffebee'} : {backgroundColor: '#e3f2fd'}]}>
             <Ionicons 
                name={isHard ? "warning" : "rocket"} 
                size={36} 
                color={isHard ? "#d32f2f" : "#1976d2"} 
             />
          </View>
          
          <Text style={styles.title}>
            {isHard ? "Time to Update!" : "New Update Available"}
          </Text>
          
          <Text style={styles.message}>
            {Platform.OS === 'ios' ? appVersion.ios.updateMessage : appVersion.android.updateMessage}
          </Text>

          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdatePress}>
            <Text style={styles.updateText}>Update Now</Text>
          </TouchableOpacity>

          {/* Only show the "Later" button if it's a Soft Update */}
          {!isHard && (
            <TouchableOpacity style={styles.laterBtn} onPress={() => setShowSoftModal(false)}>
              <Text style={styles.laterText}>Maybe Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 5 },
  iconWrap: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Sen_Bold', color: '#111', marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 14, fontFamily: 'Sen_Regular', color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  updateBtn: { backgroundColor: '#28A745', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  updateText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 16 },
  laterBtn: { paddingVertical: 10, width: '100%', alignItems: 'center' },
  laterText: { color: '#777', fontFamily: 'Sen_Medium', fontSize: 15 }
});