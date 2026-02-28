// update of address screen with better UI and robust distance calculation for support contact assignment. Also added user feedback modals for delete actions and empty state.
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Pressable, StatusBar, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from '../firebase';
// --- FIRESTORE IMPORTS ---
import { doc, updateDoc, deleteField, getDocs, collection } from 'firebase/firestore';

// --- IMPORT USER CONTEXT ---
import { useUser } from '../context/UserContext';

// --- ROBUST DISTANCE CALCULATION ---
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth Radius in km
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function AddressesScreen({ navigation }) {
  const { userData, loading } = useUser();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);

  const addresses = userData?.addresses || {};
  const mainAddressId = userData?.mainAddressId || null;

  const onAdd = () => navigation.navigate('MapScreen', { mode: 'add' });
  const onEdit = (id, item) => navigation.navigate('MapScreen', { mode: 'edit', addressId: id, initial: { ...item } });

  // 1. TRIGGER DELETE FLOW
  const onDelete = (id) => {
    setAddressToDelete(id);
    const entries = Object.entries(addresses);
    
    if (entries.length <= 1) {
      setWarningModalVisible(true);
    } else {
      setDeleteModalVisible(true);
    }
  };

  // 2. CONFIRM DELETE LOGIC (FIRESTORE MAP DELETION)
  const confirmDelete = async () => {
    setDeleteModalVisible(false);
    if (!addressToDelete) return;

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const id = addressToDelete;
      const currentEntries = Object.entries(addresses);
      const updates = {};
      
      // FIRESTORE PATTERN: Use deleteField() to remove an item from a map
      updates[`addresses.${id}`] = deleteField(); 

      // If the user deletes their main address, automatically set the next one
      if (mainAddressId === id) {
        const nextAddressEntry = currentEntries.find(e => e[0] !== id);
        
        if (nextAddressEntry) {
          const nextId = nextAddressEntry[0];
          const nextAddress = nextAddressEntry[1];
          
          updates['mainAddressId'] = nextId;

          // Recalculate nearest branch support contact for the new main address
          if (nextAddress.lat && nextAddress.lng) {
            const branchesSnap = await getDocs(collection(db, 'branches'));
            
            if (!branchesSnap.empty) {
              let minDist = Infinity;
              let nearestContact = null;
              
              branchesSnap.forEach(docSnap => {
                const branch = docSnap.data();
                if (branch.location && branch.contactNumber) {
                  const dist = haversineDistance(
                    parseFloat(nextAddress.lat), 
                    parseFloat(nextAddress.lng), 
                    branch.location.latitude, 
                    branch.location.longitude
                  );
                  if (dist < minDist) {
                    minDist = dist;
                    nearestContact = branch.contactNumber;
                  }
                }
              });
              
              if (nearestContact) {
                updates['supportcontact'] = nearestContact;
              }
            }
          }
        }
      }

      await updateDoc(doc(db, "users", uid), updates);

    } catch (e) {
      console.error('Delete address error:', e);
    } finally {
      setAddressToDelete(null);
    }
  };

  const onSetMain = async (id) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const selectedAddress = addresses[id];
      if (!selectedAddress) return;

      const updates = {};
      updates['mainAddressId'] = id;

      if (selectedAddress.lat && selectedAddress.lng) {
        const branchesSnap = await getDocs(collection(db, 'branches'));

        if (!branchesSnap.empty) {
          let minDist = Infinity;
          let nearestContact = null;

          branchesSnap.forEach(docSnap => {
            const branch = docSnap.data();
            if (branch.location && branch.contactNumber) {
              const dist = haversineDistance(
                parseFloat(selectedAddress.lat), 
                parseFloat(selectedAddress.lng), 
                branch.location.latitude, 
                branch.location.longitude
              );
              if (dist < minDist) {
                minDist = dist;
                nearestContact = branch.contactNumber;
              }
            }
          });
          if (nearestContact) {
            updates['supportcontact'] = nearestContact;
          }
        }
      }
      await updateDoc(doc(db, "users", uid), updates);
      // Removed automatic navigation back to Home to allow users to select an address without abruptly changing screens
    } catch (e) {
      console.error('Set main address error:', e);
    }
  };

  const onProceedHome = async () => {
    const entries = Object.entries(addresses);
    
    if (entries.length === 0) {
      Alert.alert('No Address Found', 'Please add at least one address to continue.');
      return;
    }

    if (!mainAddressId) {
      const firstAddressId = entries[0][0];
      await onSetMain(firstAddressId);
    }

    navigation.navigate('HomeScreen');
  };

  // --- NEW MODERN RENDER ITEM ---
  const renderItem = ({ item }) => {
    const id = item[0]; 
    const addr = item[1]; 
    const isMain = mainAddressId === id;
    
    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => !isMain && onSetMain(id)}
        style={[styles.card, isMain && styles.cardMain]} 
        key={id}
      >
        <View style={styles.cardLeft}>
          <Ionicons 
            name={isMain ? "radio-button-on" : "radio-button-off"} 
            size={24} 
            color={isMain ? "#ff7a00" : "#ccc"} 
          />
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.title, isMain && { color: "#ff7a00" }]} numberOfLines={1}>
              {addr.name || 'Unnamed'}
            </Text>
            {isMain && (
              <View style={styles.mainPill}>
                <Text style={styles.mainPillText}>SELECTED</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.address} numberOfLines={2}>{addr.formattedAddress || '-'}</Text>
          <Text style={styles.phone}>{addr.phone || 'No phone number'}</Text>
          
          <View style={styles.metaRow}>
            <View style={styles.actionsRow}>
              {/* Using TouchableOpacity here to stop event propagation so clicking edit/delete doesn't select the card */}
              <TouchableOpacity onPress={() => onEdit(id, addr)} style={styles.actionBtn}>
                <Ionicons name="pencil" size={16} color="#444" />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => onDelete(id)} style={styles.actionBtn}>
                <Ionicons name="trash" size={16} color="#e53935" />
                <Text style={[styles.actionText, { color: '#e53935' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.centered}>
      <ActivityIndicator size="large" color="#ff7a00" />
    </SafeAreaView>
  );

  const entries = Object.entries(addresses);
  const hasAddresses = entries.length > 0;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7f9" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('HomeScreen')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#222" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Addresses</Text>
        </View>
        
        <TouchableOpacity 
          onPress={onProceedHome} 
          style={[styles.headerAdd, !hasAddresses && styles.disabledBtn]}
          activeOpacity={hasAddresses ? 0.7 : 1}
        >
          <Ionicons name="home" size={18} color="#fff" />
          <Text style={styles.headerAddText}>Proceed to Home</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={56} color="#d3d3d3" />
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptySub}>Add at least one address to continue to Home. We’ll use your main address to find the nearest branch.</Text>
          <TouchableOpacity onPress={onAdd} style={[styles.addPrimary, { marginTop: 18 }]}>
            <Text style={styles.addPrimaryText}>Add address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(it) => it[0]}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity onPress={onAdd} style={styles.fab} activeOpacity={0.9}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* --- WARNING MODAL: Cannot delete only address --- */}
      <Modal 
        animationType="fade" 
        transparent={true} 
        visible={warningModalVisible} 
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#fff8f0' }]}>
              <Ionicons name="information-circle-outline" size={36} color="#ff7a00" />
            </View>
            <Text style={styles.modalTitle}>Keep one address</Text>
            <Text style={styles.modalMessage}>
              To ensure a seamless delivery experience, please add a new address before removing your only saved location.
            </Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setWarningModalVisible(false)}>
              <Text style={styles.modalPrimaryBtnText}>Okay, got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Modal 
        animationType="fade" 
        transparent={true} 
        visible={deleteModalVisible} 
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#ffebee' }]}>
              <Ionicons name="trash-outline" size={36} color="#e53935" />
            </View>
            <Text style={styles.modalTitle}>Remove Address</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to remove this address from your saved locations?
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.modalDeleteBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 14 : 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e6e6e6', backgroundColor: '#fff' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 8, padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: Platform.OS === 'ios' ? 14 : 16, fontFamily: 'Sen_Bold', color: '#222' },
  headerAdd: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff7a00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  headerAddText: { color: '#fff', fontFamily: 'Sen_Bold', marginLeft: 6, fontSize: Platform.OS === 'ios' ? 10 : 12 },
  disabledBtn: { backgroundColor: '#cccccc', opacity: 0.8 }, 
  
  listContent: { padding: 14, paddingBottom: 120 },
  
  // --- MODERN CARD UI ---
  card: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 12,
    borderWidth: 1.5, 
    borderColor: '#e8e8e8',
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 4, 
    alignItems: 'flex-start' 
  },
  cardMain: { 
    borderColor: '#ff7a00', 
    backgroundColor: '#fffcf7',
    elevation: 3,
    shadowOpacity: 0.08,
  },
  cardLeft: { marginRight: 12, marginTop: 2 },
  cardBody: { flex: 1 },
  
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 16, fontFamily: 'Sen_Bold', color: '#111', flex: 1, paddingRight: 10 },
  mainPill: { backgroundColor: '#ffe6cc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  mainPillText: { color: '#ff7a00', fontFamily: 'Sen_Bold', fontSize: 10, letterSpacing: 0.5 },
  
  address: { color: '#666', fontSize: 13.5, fontFamily: 'Sen_Regular', lineHeight: 19 },
  phone: { marginTop: 6, color: '#444', fontSize: 13, fontFamily: 'Sen_Medium' },
  
  metaRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  actionsRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingRight: 10 },
  actionText: { fontSize: 13, fontFamily: 'Sen_Medium', color: '#444', marginLeft: 4 },
  
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { fontSize: 20, fontFamily: 'Sen_Bold', marginTop: 12, color: '#111' },
  emptySub: { color: '#777', textAlign: 'center', marginTop: 8, fontFamily: 'Sen_Regular', fontSize: 14, lineHeight: 20 },
  addPrimary: { backgroundColor: '#ff7a00', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  addPrimaryText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 15 },
  
  fab: { position: 'absolute', right: 20, bottom: 28, backgroundColor: '#ff7a00', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#ff7a00', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  
  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 18, color: '#111', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: { backgroundColor: '#ff7a00', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalPrimaryBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 15 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f0f0f0' },
  modalCancelBtnText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 15 },
  modalDeleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#e53935' },
  modalDeleteBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 15 },
});