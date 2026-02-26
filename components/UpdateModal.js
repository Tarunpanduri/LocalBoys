import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAdmin } from '../context/AdminContext'; 

// Helper function to compare semantic versions (e.g. "1.0.5" > "1.0.2")
const isVersionGreater = (newVer, currentVer) => {
  if (!newVer || !currentVer) return false;
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
  const [updateType, setUpdateType] = useState('none'); // 'none', 'soft', 'hard'
  const [showSoftModal, setShowSoftModal] = useState(false);

  // Get current app version from Expo config
  const currentAppVersion = Constants.expoConfig?.version || "1.0.0";

  useEffect(() => {
    const checkUpdateStatus = async () => {
      if (!appVersion) return;

      const platformConfig = Platform.OS === 'ios' ? appVersion.ios : appVersion.android;
      if (!platformConfig) return;

      const needsHardUpdate = isVersionGreater(platformConfig.minSupported, currentAppVersion);
      const needsSoftUpdate = isVersionGreater(platformConfig.latest, currentAppVersion);

      if (needsHardUpdate) {
        // ALWAYS show hard updates, ignore limits
        setUpdateType('hard');
      } else if (needsSoftUpdate) {
        // RATE LIMITER: Only show soft updates max 2 times per day
        try {
          const today = new Date().toISOString().split('T')[0]; // Gets YYYY-MM-DD
          const storedTracker = await AsyncStorage.getItem('localboys_soft_update_tracker');
          let tracker = storedTracker ? JSON.parse(storedTracker) : { date: '', count: 0 };

          if (tracker.date !== today) {
            // It's a new day! Reset the counter to 1 and show modal
            await AsyncStorage.setItem('localboys_soft_update_tracker', JSON.stringify({ date: today, count: 1 }));
            setUpdateType('soft');
            setShowSoftModal(true);
          } else if (tracker.count < 2) {
            // It's the same day, but they haven't seen it 2 times yet. Increment and show.
            tracker.count += 1;
            await AsyncStorage.setItem('localboys_soft_update_tracker', JSON.stringify(tracker));
            setUpdateType('soft');
            setShowSoftModal(true);
          } else {
            // They have seen it 2 times today. Do not bother them.
            setUpdateType('none');
          }
        } catch (error) {
          console.error("Error reading update tracker", error);
          // Fallback just in case AsyncStorage fails
          setUpdateType('soft');
          setShowSoftModal(true);
        }
      }
    };

    checkUpdateStatus();
  }, [appVersion, currentAppVersion]);

  const handleUpdatePress = () => {
    const platformConfig = Platform.OS === 'ios' ? appVersion?.ios : appVersion?.android;
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
            {Platform.OS === 'ios' ? appVersion?.ios?.updateMessage : appVersion?.android?.updateMessage}
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