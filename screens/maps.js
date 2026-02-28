import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, TextInput, Keyboard, Image, Platform, Dimensions, ScrollView, Linking, Modal } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { auth, db } from '../firebase';
// --- FIRESTORE IMPORTS ---
import { doc, getDoc, updateDoc, collection, getDocs, GeoPoint } from 'firebase/firestore';
import { MaterialIcons, Ionicons } from '@expo/vector-icons'; 

// --- IMPORTS FOR GUEST MODE ---
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// --- 1. DISTANCE CALCULATION FUNCTION ---
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

export default function MapScreen({ navigation, route }) {
  const mode = route?.params?.mode || 'add';
  const editingId = route?.params?.addressId || null;
  const initial = route?.params?.initial || null;
  
  // --- CHECK IF GUEST ---
  const isGuest = route?.params?.isGuest || false;
  // Get Context Setters to update Home Screen immediately
  const { setMainAddress, setUserLocation } = useUser(); 

  const [hasPermission, setHasPermission] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // --- CUSTOM ALERT MODAL STATE ---
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error', // 'error', 'validation', 'settings'
  });

  const mapRef = useRef(null);
  const regionChangeTimeout = useRef(null);
  const searchTimeout = useRef(null);
  const lastRegionRef = useRef(null);
  const lastGeocodeRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    checkLocationPermission();
    if (!isGuest) {
        registerForPushNotificationsAsync();
    }
    
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    if (mode === 'edit' && initial) {
      setSelectedPlace({ lat: initial.lat, lng: initial.lng, ...initial });
      setName(initial.name || '');
      setPhone(initial.phone || '');
      setQuery(initial.formattedAddress || '');
    }
    
    return () => {
      if (regionChangeTimeout.current) clearTimeout(regionChangeTimeout.current);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertConfig({ ...alertConfig, visible: false });
  };

  const handleOpenSettings = () => {
    closeAlert();
    Linking.openSettings();
  };

  const checkLocationPermission = async () => {
    try { 
      const { status } = await Location.getForegroundPermissionsAsync(); 
      setHasPermission(status === 'granted'); 
    } catch (e) { 
      console.error('Permission check failed:', e); 
      setHasPermission(false); 
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setHasPermission(true);
      } else {
        if (!canAskAgain) {
           showAlert(
            'Location Access',
            'To detect your delivery address automatically, please enable location access in Settings.',
            'settings'
          );
        }
      }
    } catch (e) { 
      console.error('Request permission failed:', e); 
      showAlert('Error', 'Could not request location permission.'); 
    }
  };

  const reverseGeocode = useCallback(async (lat, lng) => {
    const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (lastGeocodeRef.current && lastGeocodeRef.current.key === coordKey) {
      return lastGeocodeRef.current.result;
    }

    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const comp = result.address_components || [];
        const area = comp.find((c) => c.types.includes('sublocality') || c.types.includes('neighborhood'))?.long_name || '';
        const city = comp.find((c) => c.types.includes('locality'))?.long_name || comp.find((c) => c.types.includes('administrative_area_level_2'))?.long_name || '';
        const state = comp.find((c) => c.types.includes('administrative_area_level_1'))?.long_name || '';
        const pincode = comp.find((c) => c.types.includes('postal_code'))?.long_name || '';
        
        const geocodeResult = { formattedAddress: result.formatted_address || '', area, city, state, pincode };
        lastGeocodeRef.current = { key: coordKey, result: geocodeResult };
        return geocodeResult;
      }
      return { formattedAddress: 'Address not found', area: '', city: '', state: '', pincode: '' };
    } catch (err) { 
      console.error('Reverse geocode error:', err); 
      return { formattedAddress: 'Error', area: '', city: '', state: '', pincode: '' }; 
    }
  }, []);

  const fetchSuggestions = useCallback((text) => {
    setQuery(text);
    if (text.length < 3) { 
      setSuggestions([]); 
      return; 
    }
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await res.json();
        if (data && data.predictions) setSuggestions(data.predictions);
      } catch (err) { 
        console.error('Suggestion error:', err); 
      }
    }, 500);
  }, []);

  const fetchCoordinates = async (placeId) => {
    try {
      setFetching(true);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();
      if (data.result?.geometry) {
        const { lat, lng } = data.result.geometry.location;
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
        const place = await reverseGeocode(lat, lng);
        setSelectedPlace({ lat, lng, ...place });
      }
    } catch (err) { 
      console.error('Coordinate fetch error:', err); 
      showAlert('Error', 'Could not fetch place coordinates.'); 
    } finally { 
      setFetching(false); 
      setSuggestions([]); 
      Keyboard.dismiss(); 
    }
  };

  const onRegionChangeComplete = useCallback((region) => {
    lastRegionRef.current = region;
    
    if (regionChangeTimeout.current) clearTimeout(regionChangeTimeout.current);
    
    regionChangeTimeout.current = setTimeout(async () => {
      try { 
        const { latitude, longitude } = lastRegionRef.current; 
        setFetching(true); 
        const place = await reverseGeocode(latitude, longitude); 
        setSelectedPlace({ lat: latitude, lng: longitude, ...place }); 
      } catch (e) { 
        console.error('onRegionChangeComplete reverse geocode error:', e); 
      } finally { 
        setFetching(false); 
      }
    }, 800);
  }, [reverseGeocode]);

  const getCurrentLocation = async () => {
    try {
      setFetching(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
          showAlert('Permission Denied', 'Please allow location access to use this feature.', 'validation');
          return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const lat = loc.coords.latitude; 
      const lng = loc.coords.longitude;
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
      const place = await reverseGeocode(lat, lng);
      setSelectedPlace({ lat, lng, ...place });
    } catch (err) { 
      console.error('getCurrentLocation error:', err); 
      showAlert('Error', 'Unable to fetch current location. Please select manually.'); 
    } finally { 
      setFetching(false); 
    }
  };

  // --- 2. HANDLE CONFIRM LOCATION (FIRESTORE) ---
  const handleConfirmLocation = async () => {
    if (!selectedPlace) return showAlert('Error', 'Please pick a location first.');
    if (!name || name.trim().length < 2) return showAlert('Validation', 'Please enter a name for this address.', 'validation');
    
    // --- GUEST LOGIC ---
    if (isGuest) {
        try {
            setSaving(true);
            const guestAddressObj = {
                lat: selectedPlace.lat,
                lng: selectedPlace.lng,
                area: selectedPlace.area || '',
                city: selectedPlace.city || '',
                state: selectedPlace.state || '',
                pincode: selectedPlace.pincode || '',
                formattedAddress: selectedPlace.formattedAddress || '',
                name: name.trim(),
                phone: phone.trim() || 'Not Provided',
                id: 'guest_loc',
                isGuest: true
            };

            await AsyncStorage.setItem('guestAddress', JSON.stringify(guestAddressObj));
            if(setMainAddress) setMainAddress(guestAddressObj);
            if(setUserLocation) setUserLocation(guestAddressObj);

            navigation.reset({
                index: 0,
                routes: [{ name: 'HomeScreen' }],
            });

        } catch (e) {
            showAlert("Error", "Could not save guest location");
            console.error(e);
        } finally {
            setSaving(false);
        }
        return; 
    }

    // --- FIRESTORE USER LOGIC ---
    if (!phone || phone.trim().length < 6) return showAlert('Validation', 'Please enter a valid phone number.', 'validation');
    if (!auth.currentUser) return showAlert('Error', 'User not logged in.');

    try {
      setSaving(true);
      const uid = auth.currentUser.uid;
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const existingData = userSnap.data() || {};
      
      // We generate a custom ID for the address map or use the existing editing ID
      let keyToSet = editingId || doc(collection(db, 'dummy')).id;

      // Ensure location is converted to a native Firestore GeoPoint
      const addressObj = {
        location: new GeoPoint(selectedPlace.lat, selectedPlace.lng),
        area: selectedPlace.area || '',
        city: selectedPlace.city || '',
        state: selectedPlace.state || '',
        pincode: selectedPlace.pincode || '',
        formattedAddress: selectedPlace.formattedAddress || '',
        name: name.trim(),
        phone: phone.trim(),
        updatedAt: new Date().toISOString(),
      };

      const userUpdates = {};
      
      // Update specific map node dynamically
      userUpdates[`addresses.${keyToSet}`] = addressObj;

      if (!existingData.expoPushToken && expoPushToken) {
        userUpdates['expoPushToken'] = expoPushToken;
      } else if (existingData.expoPushToken !== expoPushToken && expoPushToken) {
        userUpdates['expoPushToken'] = expoPushToken;
      }

      const shouldSetAsMain = true; 

      if (shouldSetAsMain && keyToSet) {
        userUpdates['mainAddressId'] = keyToSet;

        if (selectedPlace.lat && selectedPlace.lng) {
          try {
            const branchesSnap = await getDocs(collection(db, 'branches'));

            if (!branchesSnap.empty) {
              let minDist = Infinity;
              let nearestContact = null;

              branchesSnap.forEach(docSnap => {
                const branch = docSnap.data();
                if (branch.location && branch.contactNumber) {
                  const dist = haversineDistance(
                    parseFloat(selectedPlace.lat), 
                    parseFloat(selectedPlace.lng), 
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
                userUpdates['supportcontact'] = nearestContact;
              }
            }
          } catch (branchError) {
            console.error("Error fetching branches for support contact:", branchError);
          }
        }
      }

      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(userRef, userUpdates);
      }

      navigation.navigate('HomeScreen', { refresh: true });
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Address saved', body: 'Your address was saved successfully and set as active.' },
        trigger: null,
      });

    } catch (err) {
      console.error('Save address error:', err);
      showAlert('Error', err.message || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  async function registerForPushNotificationsAsync() {
    try {
      if (!Constants.isDevice) return; 
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') { 
        const { status } = await Notifications.requestPermissionsAsync(); 
        finalStatus = status; 
      }
      if (finalStatus !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync()).data; 
      setExpoPushToken(token);
      
      if (Platform.OS === 'android') 
        await Notifications.setNotificationChannelAsync('default', { 
          name: 'default', 
          importance: Notifications.AndroidImportance.MAX, 
          vibrationPattern: [0, 250, 250, 250], 
          lightColor: '#28A745' 
        });
    } catch (e) { 
      console.error('registerForPushNotificationsAsync error:', e); 
    }
  }

  if (!hasPermission) return (
    <View style={styles.permissionContainer}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.permissionText}>
        To help you select your delivery location accurately, LocalBoys uses your location to show where you are on the map.
      </Text>
      <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
        <Text style={styles.permissionButtonText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={() => setHasPermission(true)}>
        <Text style={{ fontFamily: "Sen_Regular", color: '#666', textDecorationLine: 'underline' }}>
          Enter address manually
        </Text>
      </TouchableOpacity>
      
      <Modal animationType="fade" transparent={true} visible={alertConfig.visible} onRequestClose={closeAlert}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="settings-outline" size={36} color="#0288d1" />
            </View>
            <Text style={styles.modalTitle}>{alertConfig.title}</Text>
            <Text style={styles.modalMessage}>{alertConfig.message}</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeAlert}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalActionBtn} onPress={handleOpenSettings}>
                <Text style={styles.modalActionBtnText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" translucent={false} />
      <MapView 
        ref={mapRef} 
        style={{ flex: 1 }} 
        initialRegion={selectedPlace ? 
          { latitude: selectedPlace.lat, longitude: selectedPlace.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 } : 
          { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 0.5, longitudeDelta: 0.5 }} 
        showsUserLocation 
        showsMyLocationButton={false} 
        onRegionChangeComplete={onRegionChangeComplete} 
      />
      
      <View pointerEvents="none" style={styles.centerMarkerContainer}>
        <MaterialIcons name="location-pin" size={40} color="#e53935" style={{ marginBottom: -12, zIndex: 2 }} />
        <View style={styles.markerShadow} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Search address" 
          placeholderTextColor="#666" 
          value={query} 
          onChangeText={fetchSuggestions} 
          returnKeyType="search" 
        />
        {fetching && <ActivityIndicator size="small" color="#009688" style={{ marginLeft: 8 }} />}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            {suggestions.map(item => (
              <TouchableOpacity key={item.place_id} style={styles.suggestion} onPress={() => fetchCoordinates(item.place_id)}>
                <Text style={styles.suggestionText}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      
      <TouchableOpacity style={styles.currentLocationButton} onPress={getCurrentLocation}>
        <MaterialIcons name="my-location" size={22} color="#444" />
      </TouchableOpacity>

      {selectedPlace && (
        <View style={[styles.detailsContainer, { bottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          <ScrollView 
            ref={scrollViewRef} 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.row}>
              <View style={styles.fieldFull}>
                <Text style={styles.label}>Name</Text>
                <TextInput 
                  value={name} 
                  onChangeText={setName} 
                  style={styles.inputSmall} 
                  placeholder="Home, Office or Name" 
                  returnKeyType="next" 
                />
              </View>
              <View style={styles.fieldFull}>
                <Text style={styles.label}>Phone</Text>
                <TextInput 
                  value={phone} 
                  onChangeText={setPhone} 
                  style={styles.inputSmall} 
                  placeholder="Phone number" 
                  keyboardType="phone-pad" 
                  returnKeyType="done" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Area</Text>
                <Text style={styles.value}>{selectedPlace.area || '-'}</Text>
                <View style={styles.underline} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>City</Text>
                <Text style={styles.value}>{selectedPlace.city || '-'}</Text>
                <View style={styles.underline} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>State</Text>
                <Text style={styles.value}>{selectedPlace.state || '-'}</Text>
                <View style={styles.underline} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Pincode</Text>
                <Text style={styles.value}>{selectedPlace.pincode || '-'}</Text>
                <View style={styles.underline} />
              </View>
            </View>
            
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>{mode === 'edit' ? 'Save & Use Address' : 'Add & Use Address'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <Modal animationType="fade" transparent={true} visible={alertConfig.visible} onRequestClose={closeAlert}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: alertConfig.type === 'validation' ? '#fff3e0' : alertConfig.type === 'settings' ? '#e3f2fd' : '#ffebee' }]}>
              <Ionicons 
                name={alertConfig.type === 'validation' ? 'alert-circle-outline' : alertConfig.type === 'settings' ? 'settings-outline' : 'warning-outline'} 
                size={36} 
                color={alertConfig.type === 'validation' ? '#ff9800' : alertConfig.type === 'settings' ? '#0288d1' : '#e53935'} 
              />
            </View>
            <Text style={styles.modalTitle}>{alertConfig.title}</Text>
            <Text style={styles.modalMessage}>{alertConfig.message}</Text>
            
            {alertConfig.type === 'settings' ? (
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeAlert}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalActionBtn} onPress={handleOpenSettings}>
                  <Text style={styles.modalActionBtnText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={closeAlert}>
                <Text style={styles.modalPrimaryBtnText}>Okay</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  logo: { width: 80, height: 80, marginBottom: 10 },
  permissionText: { fontSize: 16, textAlign: 'center', marginBottom: 20, color: '#333', fontFamily: "Sen_Medium" },
  permissionButton: { backgroundColor: '#28A745', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center' },
  permissionButtonText: { color: '#fff', fontSize: 16, fontFamily: "Sen_Bold" },
  searchContainer: { position: 'absolute', top: Platform.OS === 'android' ? 54 : 70, left: 12, right: 12, zIndex: 1000 },
  input: { height: 48, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, backgroundColor: '#fff', borderColor: '#e4e7eb', borderWidth: 1,fontFamily: "Sen_Regular" },
  inputSmall: { height: 44, borderRadius: 8, paddingHorizontal: 10, fontSize: 14, backgroundColor: '#fff', borderColor: '#e4e7eb', borderWidth: 1, fontFamily: "Sen_Regular" },
  suggestionsList: { marginTop: 6, backgroundColor: '#fff', borderRadius: 8, maxHeight: SCREEN_H * 0.28, borderColor: '#e6e6e6', borderWidth: 1 },
  suggestion: { paddingVertical: 12, paddingHorizontal: 12, borderBottomColor: '#f0f0f0', borderBottomWidth: 1 },
  suggestionText: { fontSize:Platform.OS === 'ios' ? 8 : 12, color: '#222', fontFamily: "Sen_Regular" },
  
  currentLocationButton: { 
    position: 'absolute', 
    top: Platform.OS === 'android' ? 120 : 138, 
    right: 16, 
    backgroundColor: '#fff', 
    width: 44,
    height: 44,
    borderRadius: 22, 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },

  centerMarkerContainer: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    marginLeft: -24, 
    marginTop: -48, 
    alignItems: 'center', 
    justifyContent: 'flex-end', 
    zIndex: 1000, 
    pointerEvents: 'none',
    width: 48,
    height: 48
  },
  markerShadow: {
    width: 12,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    transform: [{ scaleX: 2 }], 
    zIndex: 1
  },

  detailsContainer: { position: 'absolute', left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, elevation: 6, maxHeight: SCREEN_H * 0.5,zIndex: 1000},
  scrollView: { padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  field: { flex: 1, marginHorizontal: 6 },
  fieldFull: { flex: 1, marginHorizontal: 6 },
  label: { fontSize: 12, color: '#888', marginBottom: 6, fontFamily: "Sen_Regular" },
  value: { fontSize: Platform.OS === 'ios' ? 12 : 16, color: '#000', fontFamily: "Sen_Medium" },
  underline: { height: 1, backgroundColor: '#E0E0E0', marginTop: 6 },
  confirmButton: { backgroundColor: '#28A745', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12, marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  confirmButtonText: { color: '#fff', fontSize: 15, fontFamily: "Sen_Bold" },

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
  modalActionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#0288d1' },
  modalActionBtnText: { fontFamily: 'Sen_Bold', color: '#fff', fontSize: 15 },
});