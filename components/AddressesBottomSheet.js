import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Modal 
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import BottomSheet, { BottomSheetFlatList, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { useUser } from '../context/UserContext';
import { useAdmin } from '../context/AdminContext';

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function AddressesBottomSheet({ bottomSheetRef, navigation }) {
  const { userData, loading, mainAddress, setMainAddress } = useUser();
  const { allBranches } = useAdmin();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);

  const addresses = userData?.addresses || {};
  const entries = Object.entries(addresses);
  
  // Determine if user has any address (including guest)
  const isEmpty = useMemo(() => {
    if (userData?.isGuest) {
      return !mainAddress; // guest has no saved address
    }
    return entries.length === 0;
  }, [userData, mainAddress, entries]);

  const snapPoints = useMemo(() => ["50%", "85%"], []);

  // Auto-expand when the screen is focused and user has no address
  useFocusEffect(
    useCallback(() => {
      if (!loading && isEmpty) {
        setTimeout(() => {
          bottomSheetRef.current?.expand();
        }, 150);
      }
    }, [loading, isEmpty, bottomSheetRef])
  );

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop 
        {...props} 
        disappearsOnIndex={-1} 
        appearsOnIndex={0} 
        pressBehavior={isEmpty ? "none" : "close"}
      />
    ),
    [isEmpty]
  );

  const onAdd = () => {
    bottomSheetRef.current?.close();
    navigation.navigate('MapScreen', { mode: 'add', isGuest: userData?.isGuest || false });
  };

  const onEdit = (id, item) => {
    bottomSheetRef.current?.close();
    navigation.navigate('MapScreen', { mode: 'edit', addressId: id, initial: { ...item }, isGuest: userData?.isGuest || false });
  };

  const onDelete = (id) => {
    setAddressToDelete(id);
    if (entries.length <= 1) {
      setWarningModalVisible(true);
    } else {
      setDeleteModalVisible(true);
    }
  };

  const confirmDelete = async () => {
    setDeleteModalVisible(false);
    if (!addressToDelete) return;

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const updates = {};
      updates[`addresses.${addressToDelete}`] = deleteField();

      if (userData?.mainAddressId === addressToDelete) {
        const nextAddressEntry = entries.find(e => e[0] !== addressToDelete);
        if (nextAddressEntry) {
          const nextId = nextAddressEntry[0];
          const nextAddress = nextAddressEntry[1];
          updates['mainAddressId'] = nextId;

          if (nextAddress.lat && nextAddress.lng && allBranches?.length) {
            let minDist = Infinity;
            let nearestContact = null;
            allBranches.forEach(branch => {
              if (branch.lat && branch.lng && branch.contactNumber) {
                const dist = haversineDistance(
                  parseFloat(nextAddress.lat), parseFloat(nextAddress.lng),
                  parseFloat(branch.lat), parseFloat(branch.lng)
                );
                if (dist < minDist) { minDist = dist; nearestContact = branch.contactNumber; }
              }
            });
            if (nearestContact) updates['supportcontact'] = nearestContact;
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
      bottomSheetRef.current?.close();
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const selectedAddress = addresses[id];
      if (!selectedAddress) return;

      const updates = { mainAddressId: id };
      
      if (selectedAddress.lat && selectedAddress.lng && allBranches?.length) {
        let minDist = Infinity;
        let nearestContact = null;
        allBranches.forEach(branch => {
          if (branch.lat && branch.lng && branch.contactNumber) {
            const dist = haversineDistance(
              parseFloat(selectedAddress.lat), parseFloat(selectedAddress.lng),
              parseFloat(branch.lat), parseFloat(branch.lng)
            );
            if (dist < minDist) { minDist = dist; nearestContact = branch.contactNumber; }
          }
        });
        if (nearestContact) updates['supportcontact'] = nearestContact;
      }

      await updateDoc(doc(db, "users", uid), updates);
    } catch (e) {
      console.error('Set main address error:', e);
    }
  };

  const renderItem = ({ item }) => {
    const id = item[0];
    const addr = item[1];
    const isMain = userData?.mainAddressId === id;

    return (
      <TouchableOpacity 
        style={[styles.radioCard, isMain && styles.radioCardActive]} 
        activeOpacity={0.7}
        onPress={() => onSetMain(id)}
      >
        <View style={styles.radioHeader}>
          <View style={styles.radioLeft}>
            <Ionicons 
              name={isMain ? "radio-button-on" : "radio-button-off"} 
              size={24} 
              color={isMain ? "#149506" : "#ccc"} 
            />
            <View style={styles.titleWrapper}>
              <Text style={styles.title} numberOfLines={1}>{addr.name || 'Unnamed Location'}</Text>
              {isMain && <View style={styles.mainPill}><Text style={styles.mainPillText}>CURRENT</Text></View>}
            </View>
          </View>
        </View>

        <View style={styles.radioBody}>
          <Text style={styles.address} numberOfLines={2}>{addr.formattedAddress || '-'}</Text>
          <Text style={styles.phone}>{addr.phone || 'No phone number added'}</Text>
        </View>

        <View style={styles.radioFooter}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(id, addr)}>
            <Ionicons name="pencil" size={14} color="#555" />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(id)}>
            <Ionicons name="trash" size={14} color="#e53935" />
            <Text style={[styles.actionText, { color: '#e53935' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Guest view: show the single address (if any) without radio selection
  const renderGuestAddress = () => {
    if (!mainAddress) return null;
    return (
      <View style={styles.radioCard}>
        <View style={styles.radioHeader}>
          <View style={styles.radioLeft}>
            <Ionicons name="location-sharp" size={24} color="#149506" />
            <View style={styles.titleWrapper}>
              <Text style={styles.title} numberOfLines={1}>{mainAddress.name || 'Current Location'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.radioBody}>
          <Text style={styles.address} numberOfLines={2}>{mainAddress.formattedAddress || '-'}</Text>
          <Text style={styles.phone}>{mainAddress.phone || 'No phone number added'}</Text>
        </View>
        <View style={styles.radioFooter}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit('guest', mainAddress)}>
            <Ionicons name="pencil" size={14} color="#555" />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete('guest')}>
            <Ionicons name="trash" size={14} color="#e53935" />
            <Text style={[styles.actionText, { color: '#e53935' }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={!isEmpty}
        backgroundStyle={styles.bottomSheetBg}
        handleIndicatorStyle={styles.indicator}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select Delivery Address</Text>
          {!isEmpty && (
            <TouchableOpacity style={styles.closeBtn} onPress={() => bottomSheetRef.current?.close()}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sheetBody}>
          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color="#149506" /></View>
          ) : isEmpty ? (
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={60} color="#d3d3d3" />
              <Text style={styles.emptyTitle}>Welcome to LocalBoys!</Text>
              <Text style={styles.emptySub}>Please add a delivery location so we can show you the best shops and services nearby.</Text>
            </View>
          ) : userData?.isGuest ? (
            // Guest with an address
            <View style={styles.listContent}>
              {renderGuestAddress()}
            </View>
          ) : (
            <BottomSheetFlatList
              data={entries}
              renderItem={renderItem}
              keyExtractor={(it) => it[0]}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={styles.bottomAddContainer}>
            <TouchableOpacity onPress={onAdd} style={styles.addPrimaryBtn}>
              <Ionicons name="add-circle" size={22} color="#fff" style={{marginRight: 6}} />
              <Text style={styles.addPrimaryText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* Modals */}
      <Modal animationType="fade" transparent={true} visible={warningModalVisible} onRequestClose={() => setWarningModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#fff8e1' }]}>
              <Ionicons name="information-circle" size={36} color="#ffb300" />
            </View>
            <Text style={styles.modalTitle}>Keep one address</Text>
            <Text style={styles.modalMessage}>Please add a new address before removing your only saved location.</Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setWarningModalVisible(false)}>
              <Text style={styles.modalPrimaryBtnText}>Okay, got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#ffebee' }]}>
              <Ionicons name="trash-outline" size={36} color="#e53935" />
            </View>
            <Text style={styles.modalTitle}>Remove Address</Text>
            <Text style={styles.modalMessage}>Are you sure you want to remove this address from your saved locations?</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  bottomSheetBg: { backgroundColor: '#f6f7f9', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  indicator: { backgroundColor: '#ccc', width: 40, height: 5 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eaeaea', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetTitle: { fontSize: 18, fontFamily: 'Sen_Bold', color: '#111' },
  closeBtn: { padding: 4 },
  sheetBody: { flex: 1, position: 'relative' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 100 },
  radioCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eee', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  radioCardActive: { borderColor: '#40d24f', backgroundColor: '#d5f1d8' },
  radioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  radioLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  titleWrapper: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, flex: 1 },
  title: { fontSize: 16, fontFamily: 'Sen_Bold', color: '#111', flexShrink: 1 },
  mainPill: { backgroundColor: '#22a91d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginLeft: 8 },
  mainPillText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 9, letterSpacing: 0.5 },
  radioBody: { paddingLeft: 34, paddingRight: 10 },
  address: { color: '#666', fontSize: 13.5, fontFamily: 'Sen_Regular', lineHeight: 19 },
  phone: { color: '#444', fontSize: 13, fontFamily: 'Sen_Medium', marginTop: 4 },
  radioFooter: { flexDirection: 'row', marginTop: 12, paddingLeft: 34, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 15 },
  actionText: { fontSize: 13, fontFamily: 'Sen_Medium', color: '#555', marginLeft: 4 },
  divider: { width: 1, height: 14, backgroundColor: '#ddd', marginRight: 15 },
  bottomAddContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 16, 
    backgroundColor: '#f6f7f9', 
    borderTopWidth: 1, 
    borderTopColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 10
  },
  addPrimaryBtn: { backgroundColor: '#009688', flexDirection: 'row', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addPrimaryText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', paddingHorizontal: 30, marginTop: 60 },
  emptyTitle: { fontSize: 22, fontFamily: 'Sen_Bold', marginTop: 20, color: '#111', textAlign: 'center' },
  emptySub: { color: '#666', textAlign: 'center', marginTop: 10, fontFamily: 'Sen_Medium', fontSize: 14, lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '90%', maxWidth: 400, elevation: 5 },
  modalIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Sen_Bold', fontSize: 18, color: '#111', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontFamily: 'Sen_Regular', fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: { backgroundColor: '#009688', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalPrimaryBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 15 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f0f0f0' },
  modalCancelBtnText: { fontFamily: 'Sen_Medium', color: '#444', fontSize: 15 },
  modalDeleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#e53935' },
  modalDeleteBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 15 },
});