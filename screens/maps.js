import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, TextInput, Keyboard, Alert, Image, Platform, Dimensions, KeyboardAvoidingView, ScrollView } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { auth, db as database } from '../firebase';
import { ref, update, get, push, set } from 'firebase/database';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function MapScreen({ navigation, route }) {
  const mode = route?.params?.mode || 'add';
  const editingId = route?.params?.addressId || null;
  const initial = route?.params?.initial || null;

  const [hasPermission, setHasPermission] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [setAsMain, setSetAsMain] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const mapRef = useRef(null);
  const regionChangeTimeout = useRef(null);
  const searchTimeout = useRef(null);
  const lastRegionRef = useRef(null);
  const lastGeocodeRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    checkLocationPermission();
    registerForPushNotificationsAsync();
    
    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

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
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') setHasPermission(true);
      else Alert.alert('Permission Required', 'Location permission is required to continue.');
    } catch (e) { 
      console.error('Request permission failed:', e); 
      Alert.alert('Error', 'Could not request location permission.'); 
    }
  };

  const reverseGeocode = useCallback(async (lat, lng) => {
    const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (lastGeocodeRef.current === coordKey) {
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
      Alert.alert('Error', 'Could not fetch place coordinates.'); 
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
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude; 
      const lng = loc.coords.longitude;
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
      const place = await reverseGeocode(lat, lng);
      setSelectedPlace({ lat, lng, ...place });
    } catch (err) { 
      console.error('getCurrentLocation error:', err); 
      Alert.alert('Error', 'Unable to fetch current location. Please select manually.'); 
    } finally { 
      setFetching(false); 
    }
  };

  const handleConfirmLocation = async () => {
    if (!selectedPlace) return Alert.alert('Error', 'Please pick a location first.');
    if (!name || name.trim().length < 2) return Alert.alert('Validation', 'Please enter a name for this address.');
    if (!phone || phone.trim().length < 6) return Alert.alert('Validation', 'Please enter a valid phone number.');
    if (!auth.currentUser) return Alert.alert('Error', 'User not logged in.');

    try {
      setSaving(true);
      const uid = auth.currentUser.uid;
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      const existingData = snapshot.val() || {};
      const addressRef = ref(database, `users/${uid}/addresses`);
      const addressSnap = await get(addressRef);
      const hasExistingAddresses = addressSnap.exists();

      const addressObj = {
        lat: selectedPlace.lat || null,
        lng: selectedPlace.lng || null,
        area: selectedPlace.area || '',
        city: selectedPlace.city || '',
        state: selectedPlace.state || '',
        pincode: selectedPlace.pincode || '',
        formattedAddress: selectedPlace.formattedAddress || '',
        name: name.trim(),
        phone: phone.trim(),
        updatedAt: new Date().toISOString(),
      };

      let keyToSet = editingId;

      if (mode === 'edit' && editingId) {
        await update(ref(database, `users/${uid}/addresses/${editingId}`), addressObj);
      } else {
        const newRef = push(addressRef);
        await set(newRef, addressObj);
        keyToSet = newRef.key;

        if (!hasExistingAddresses) {
          await update(userRef, { mainAddressId: keyToSet });
        }
      }

      if (setAsMain && keyToSet) {
        await update(userRef, { mainAddressId: keyToSet });
      }

      if (existingData.expoPushToken) {
        await update(userRef, { expoPushToken: existingData.expoPushToken });
      } else if (expoPushToken) {
        await update(userRef, { expoPushToken });
      }

      navigation.navigate('Addresses', { refresh: true });
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Address saved', body: 'Your address was saved successfully.' },
        trigger: null,
      });
    } catch (err) {
      console.error('Save address error:', err);
      Alert.alert('Error', err.message || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  async function registerForPushNotificationsAsync() {
    try {
      if (!Constants.isDevice) { 
        console.warn('Must use physical device for Push Notifications'); 
        return; 
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') { 
        const { status } = await Notifications.requestPermissionsAsync(); 
        finalStatus = status; 
      }
      if (finalStatus !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync()).data; 
      setExpoPushToken(token);
      if (auth.currentUser) { 
        const uid = auth.currentUser.uid; 
        const userRef = ref(database, `users/${uid}`); 
        const snapshot = await get(userRef); 
        const existingData = snapshot.val() || {}; 
        if (!existingData.expoPushToken || existingData.expoPushToken !== token) 
          await update(userRef, { expoPushToken: token }); 
      }
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
      <Text style={styles.permissionText}>LocalBoys needs your location to provide the best experience.</Text>
      <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
        <Text style={styles.permissionButtonText}>Grant Permission</Text>
      </TouchableOpacity>
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
        <View style={styles.pickLabel}><Text style={styles.pickLabelText}>PICK</Text></View>
        <View style={styles.pin}><View style={styles.pinDot} /></View>
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
        <Text style={styles.currentLocationText}>Use Current Location</Text>
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
            <View style={styles.checkboxContainer}>
              <TouchableOpacity onPress={() => setSetAsMain(v => !v)} style={styles.checkbox}>
                <View style={[styles.checkboxInner, setAsMain && styles.checkboxInnerChecked]} />
              </TouchableOpacity>
              <Text style={styles.checkboxText}>Set as main address</Text>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>{mode === 'edit' ? 'Save Address' : 'Add Address'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const PIN_SIZE = 28;
const PICK_LABEL_HEIGHT = 26;
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
  suggestionText: { fontSize: 14, color: '#222', fontFamily: "Sen_Regular" },
  currentLocationButton: { position: 'absolute', top: Platform.OS === 'android' ? 120 : 138, right: 16, backgroundColor: '#009688', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, zIndex: 1001 },
  currentLocationText: { color: '#fff', fontSize: 13, fontFamily: "Sen_Bold" },
  centerMarkerContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -(PIN_SIZE / 2), marginTop: -(PIN_SIZE + PICK_LABEL_HEIGHT + 6), alignItems: 'center', justifyContent: 'center', zIndex: 1000, pointerEvents: 'none' },
  pickLabel: { backgroundColor: '#fff', paddingHorizontal: 8, height: PICK_LABEL_HEIGHT, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6, elevation: 2 },
  pickLabelText: { fontSize: 12, fontFamily: "Sen_Regular", color: '#222' },
  pin: { width: PIN_SIZE, height: PIN_SIZE, borderRadius: PIN_SIZE / 2, backgroundColor: '#e53935', justifyContent: 'center', alignItems: 'center', transform: [{ scale: 1.0 }], elevation: 3 },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  detailsContainer: { position: 'absolute', left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, elevation: 6, maxHeight: SCREEN_H * 0.5,zIndex: 1000},
  scrollView: { padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  field: { flex: 1, marginHorizontal: 6 },
  fieldFull: { flex: 1, marginHorizontal: 6 },
  label: { fontSize: 12, color: '#888', marginBottom: 6, fontFamily: "Sen_Regular" },
  value: { fontSize: 16, color: '#000', fontFamily: "Sen_Medium" },
  underline: { height: 1, backgroundColor: '#E0E0E0', marginTop: 6 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  checkboxInner: { width: 12, height: 12 },
  checkboxInnerChecked: { backgroundColor: '#28A745' },
  checkboxText: { marginLeft: 8, fontSize: 14, color: '#333', fontFamily: "Sen_Regular" },
  confirmButton: { backgroundColor: '#28A745', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12, marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  confirmButtonText: { color: '#fff', fontSize: 15, fontFamily: "Sen_Bold" },
});