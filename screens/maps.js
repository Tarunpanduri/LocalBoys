import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, TextInput, Keyboard, Alert, Image,Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { auth, db as database } from "../firebase";
import { ref, update } from "firebase/database";

const GOOGLE_API_KEY = "AIzaSyAoF8ZGAKdI_vCzvYZTpAFM1jbHQyPIMCc";

export default function MapScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => { checkLocationPermission(); }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") { setHasPermission(true); getCurrentLocation(); }
    else { setHasPermission(false); }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") { setHasPermission(true); getCurrentLocation(); }
    else { Alert.alert("Permission Required", "Location permission is required to continue."); }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
      const data = await res.json();
      if (data.status === "OK" && data.results.length > 0) {
        const comp = data.results[0].address_components;
        const area = comp.find((c) => c.types.includes("sublocality") || c.types.includes("neighborhood"))?.long_name || "";
        const city = comp.find((c) => c.types.includes("locality"))?.long_name || comp.find((c) => c.types.includes("administrative_area_level_2"))?.long_name || "";
        const state = comp.find((c) => c.types.includes("administrative_area_level_1"))?.long_name || "";
        const pincode = comp.find((c) => c.types.includes("postal_code"))?.long_name || "";
        return { formattedAddress: data.results[0].formatted_address, area, city, state, pincode };
      }
      return { formattedAddress: "Address not found", area: "", city: "", state: "", pincode: "" };
    } catch (err) { console.error("Reverse geocode error:", err); return { formattedAddress: "Error", area: "", city: "", state: "", pincode: "" }; }
  };

  const getCurrentLocation = async () => {
    try {
      setFetching(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const place = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      const newPlace = { lat: loc.coords.latitude, lng: loc.coords.longitude, ...place };
      setSelectedPlace(newPlace);
      mapRef.current?.animateToRegion({ latitude: newPlace.lat, longitude: newPlace.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    } catch (err) { console.error(err); Alert.alert("Error", "Unable to fetch current location. Please select manually"); }
    finally { setFetching(false); }
  };

  const fetchSuggestions = async (text) => {
    setQuery(text);
    if (text.length < 3) return;
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_API_KEY}`);
      const data = await res.json();
      if (data && data.predictions) setSuggestions(data.predictions);
    } catch (err) { console.error("Suggestion error:", err); }
  };

  const fetchCoordinates = async (placeId) => {
    try {
      setFetching(true);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}`);
      const data = await res.json();
      if (data.result?.geometry) {
        const { lat, lng } = data.result.geometry.location;
        const place = await reverseGeocode(lat, lng);
        setSelectedPlace({ lat, lng, ...place });
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
      }
    } catch (err) { console.error("Coordinate fetch error:", err); }
    finally { setFetching(false); setSuggestions([]); Keyboard.dismiss(); }
  };

  const handleConfirmLocation = async () => {
    if (!selectedPlace) return Alert.alert("Error", "Please select a location first.");
    if (!auth.currentUser) return Alert.alert("Error", "User not logged in.");
    try {
      setSaving(true);
      const uid = auth.currentUser.uid;
      const userRef = ref(database, `users/${uid}`);
      const updates = { location: { lat: selectedPlace.lat || null, lng: selectedPlace.lng || null, area: selectedPlace.area || "", city: selectedPlace.city || "", state: selectedPlace.state || "", pincode: selectedPlace.pincode || "", formattedAddress: selectedPlace.formattedAddress || "", updatedAt: new Date().toISOString() } };
      await update(userRef, updates);
      navigation.navigate("HomeScreen");
    } catch (err) { console.error("Location update error:", err); Alert.alert("Error", err.message || "Failed to save location."); }
    finally { setSaving(false); }
  };

  if (!hasPermission) return (
    <View style={styles.permissionContainer}>
      <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.permissionText}>LocalBoys needs your location to provide the best experience and products.</Text>
      <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
        <Text style={styles.permissionButtonText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#009688" />
      <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: 20.5937, longitude: 78.9629, latitudeDelta: 0.5, longitudeDelta: 0.5 }} showsUserLocation>
        {selectedPlace && <Marker coordinate={{ latitude: selectedPlace.lat, longitude: selectedPlace.lng }} title={selectedPlace.area || "Selected Location"} description={selectedPlace.city || ""} />}
      </MapView>

      <View style={styles.searchContainer}>
        <TextInput style={styles.input} placeholder="Search address" value={query} onChangeText={fetchSuggestions} />
        {fetching && <ActivityIndicator size="small" color="#009688" />}
        {suggestions.map((item) => (
          <TouchableOpacity key={item.place_id} style={styles.suggestion} onPress={() => fetchCoordinates(item.place_id)}>
            <Text>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedPlace && (
        <View style={styles.detailsContainer}>
          <View style={styles.row}>
            <View style={styles.field}><Text style={styles.label}>Area</Text><Text style={styles.value}>{selectedPlace.area || "-"}</Text><View style={styles.underline} /></View>
            <View style={styles.field}><Text style={styles.label}>City</Text><Text style={styles.value}>{selectedPlace.city || "-"}</Text><View style={styles.underline} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.field}><Text style={styles.label}>State</Text><Text style={styles.value}>{selectedPlace.state || "-"}</Text><View style={styles.underline} /></View>
            <View style={styles.field}><Text style={styles.label}>Pincode</Text><Text style={styles.value}>{selectedPlace.pincode || "-"}</Text><View style={styles.underline} /></View>
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "bold" }}>Confirm Location</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#fff" },
  logo: { width: 80, height: 80, marginBottom: 10 },
  permissionText: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#333", fontFamily: "Sen_Regular" },
  permissionButton: { backgroundColor: "#28A745", paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: "center" },
  permissionButtonText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 16 },
  searchContainer: { position: "absolute", top: Platform.OS === "android" ? 60 : 70, left: 10, right: 10, backgroundColor: "#fff", borderRadius: 10, zIndex: 1000, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  input: { height: 45, borderColor: "#ccc", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontFamily: "Sen_Regular", color: "#333", backgroundColor: "#F3F6FA" },
  suggestion: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#E0E0E0", fontFamily: "Sen_Regular" },
  detailsContainer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 1000, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  field: { flex: 1, marginHorizontal: 5 },
  label: { fontSize: 12, color: "#888", marginBottom: 3, fontFamily: "Sen_Regular" },
  value: { fontSize: 16, color: "#000", fontFamily: "Sen_Medium" },
  underline: { height: 1, backgroundColor: "#E0E0E0", marginTop: 3 },
  confirmButton: { backgroundColor: "#28A745", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  confirmButtonText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 15 }
});