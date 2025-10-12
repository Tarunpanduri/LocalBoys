import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { auth, db as database } from '../firebase';
import { ref, onValue, remove, update } from 'firebase/database';

export default function AddressesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [mainAddressId, setMainAddressId] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const userRef = ref(database, `users/${uid}`);
    const unsubscribe = onValue(userRef, snap => {
      const val = snap.val() || {};
      setAddresses(val.addresses || {});
      setMainAddressId(val.mainAddressId || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const onAdd = () => navigation.navigate('MapScreen', { mode: 'add' });
  const onEdit = (id, item) => navigation.navigate('MapScreen', { mode: 'edit', addressId: id, initial: { ...item } });

  const onDelete = (id) => {
    Alert.alert('Delete address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const uid = auth.currentUser.uid;
            await remove(ref(database, `users/${uid}/addresses/${id}`));
            if (mainAddressId === id) await update(ref(database, `users/${uid}`), { mainAddressId: null });
          } catch (e) { console.error('Delete address error:', e); Alert.alert('Error', 'Could not delete address.'); }
        }
      }
    ]);
  };

  const onSetMain = async (id) => {
    try { const uid = auth.currentUser.uid; await update(ref(database, `users/${uid}`), { mainAddressId: id }); }
    catch (e) { console.error('Set main address error:', e); Alert.alert('Error', 'Could not set main address.'); }
  };

  const renderItem = ({ item }) => {
    const id = item[0]; const addr = item[1]; const isMain = mainAddressId === id;
    return (
      <View style={styles.card} key={id}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconWrap, isMain && { backgroundColor: '#009688' }]}>
            <Ionicons name="location-outline" size={20} color={isMain ? '#fff' : '#009688'} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.rowTop}>
            <Text style={styles.title} numberOfLines={1}>{addr.name || 'Unnamed'}</Text>
            {isMain && <View style={styles.mainPill}><Text style={styles.mainPillText}>MAIN</Text></View>}
          </View>
          <Text style={styles.address} numberOfLines={2}>{addr.formattedAddress || '-'}</Text>
          <Text style={styles.phone}>{addr.phone || 'No phone number'}</Text>
          <View style={styles.metaRow}>
            <View style={styles.actionsRow}>
              <Pressable onPress={() => onEdit(id, addr)} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}>
                <Ionicons name="pencil" size={16} color="#007bff" /><Text style={styles.actionText}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(id)} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}>
                <Ionicons name="trash" size={16} color="#e53935" /><Text style={[styles.actionText, { color: '#e53935' }]}>Delete</Text>
              </Pressable>
              <Pressable onPress={() => onSetMain(id)} style={({ pressed }) => [styles.actionBtn, isMain ? styles.actionBtnMain : null, pressed && styles.actionBtnPressed]}>
                <Ionicons name={isMain ? 'star' : 'star-outline'} size={16} color={isMain ? '#fff' : '#007bff'} />
                <Text style={[styles.actionText, isMain && { color: '#fff' }]}>{isMain ? 'Main' : 'Set main'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.centered}>
      <ActivityIndicator size="large" color="#009688" />
    </SafeAreaView>
  );

  const entries = Object.entries(addresses || {});

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7f9" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('HomeScreen')} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color="#222" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Your addresses</Text>
        </View>
        <TouchableOpacity onPress={onAdd} style={styles.headerAdd}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.headerAddText}>Add</Text></TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={56} color="#d3d3d3" />
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptySub}>Add an address to get started. You can set one as main and we’ll use it by default.</Text>
          <TouchableOpacity onPress={onAdd} style={[styles.addPrimary, { marginTop: 18 }]}><Text style={styles.addPrimaryText}>Add address</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(it) => it[0]}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      <TouchableOpacity onPress={onAdd} style={styles.fab} activeOpacity={0.9}><Ionicons name="add" size={26} color="#fff" /></TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 14 : 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e6e6e6' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 8, padding: 6, borderRadius: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Sen_Bold', color: '#222' },
  headerAdd: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#009688', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  headerAddText: { color: '#fff', fontFamily: 'Sen_Bold', marginLeft: 6, fontSize: 14 },
  listContent: { padding: 14, paddingBottom: 120 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, alignItems: 'flex-start' },
  cardLeft: { width: 44, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#e8f6f6', alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, paddingLeft: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontFamily: 'Sen_Bold', color: '#111', maxWidth: '78%' },
  mainPill: { backgroundColor: '#28A745', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  mainPillText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 10.5, letterSpacing: 0.5 },
  address: { marginTop: 6, color: '#666', fontSize: 13.5, fontFamily: 'Sen_Regular', lineHeight: 19 },
  metaRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phone: { color: '#333', fontSize: 13, fontFamily: 'Sen_Medium' },
  actionsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd' },
  actionBtnPressed: { opacity: 0.6 },
  actionBtnMain: { backgroundColor: '#28A745' },
  actionText: { fontSize: 13, fontFamily: 'Sen_Medium', color: '#007bff', marginLeft: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { fontSize: 20, fontFamily: 'Sen_Bold', marginTop: 12, color: '#111' },
  emptySub: { color: '#777', textAlign: 'center', marginTop: 8, fontFamily: 'Sen_Regular', fontSize: 14, lineHeight: 20 },
  addPrimary: { backgroundColor: '#009688', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  addPrimaryText: { color: '#fff', fontFamily: 'Sen_Bold', fontSize: 15 },
  fab: { position: 'absolute', right: 20, bottom: 28, backgroundColor: '#009688', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
});