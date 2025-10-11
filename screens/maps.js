// MapScreen.js
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Alert,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import MapView from "react-native-maps";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { auth, db as database } from "../firebase";
import { ref, update, get } from "firebase/database";

const googleMapsApiKey = "AIzaSyA_pgpDfyn6jEmXkOKww8OvueM7puMKD_g";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function MapScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null); // will hold address for center coords
  const [expoPushToken, setExpoPushToken] = useState(null);
  const mapRef = useRef(null);
  const regionChangeTimeout = useRef(null);
  const lastRegionRef = useRef(null);

  useEffect(() => {
    checkLocationPermission();
    registerForPushNotificationsAsync();
    return () => {
      if (regionChangeTimeout.current) clearTimeout(regionChangeTimeout.current);
    };
  }, []);

  // --- LOCATION PERMISSIONS ---
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (e) {
      console.error("Permission check failed:", e);
      setHasPermission(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") setHasPermission(true);
      else Alert.alert("Permission Required", "Location permission is required to continue.");
    } catch (e) {
      console.error("Request permission failed:", e);
      Alert.alert("Error", "Could not request location permission.");
    }
  };

  // --- GEOCODING HELPERS ---
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`
      );
      const data = await res.json();
      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        const comp = result.address_components || [];
        const area =
          comp.find((c) => c.types.includes("sublocality") || c.types.includes("neighborhood"))?.long_name ||
          "";
        const city =
          comp.find((c) => c.types.includes("locality"))?.long_name ||
          comp.find((c) => c.types.includes("administrative_area_level_2"))?.long_name ||
          "";
        const state = comp.find((c) => c.types.includes("administrative_area_level_1"))?.long_name || "";
        const pincode = comp.find((c) => c.types.includes("postal_code"))?.long_name || "";
        return {
          formattedAddress: result.formatted_address || "",
          area,
          city,
          state,
          pincode,
        };
      }
      return { formattedAddress: "Address not found", area: "", city: "", state: "", pincode: "" };
    } catch (err) {
      console.error("Reverse geocode error:", err);
      return { formattedAddress: "Error", area: "", city: "", state: "", pincode: "" };
    }
  };

  const fetchSuggestions = async (text) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          text
        )}&key=${googleMapsApiKey}`
      );
      const data = await res.json();
      if (data && data.predictions) setSuggestions(data.predictions);
    } catch (err) {
      console.error("Suggestion error:", err);
    }
  };

  const fetchCoordinates = async (placeId) => {
    try {
      setFetching(true);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleMapsApiKey}`
      );
      const data = await res.json();
      if (data.result?.geometry) {
        const { lat, lng } = data.result.geometry.location;
        // animate map to the place; onRegionChangeComplete will reverse-geocode
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          800
        );
        // do immediate reverse geocode so UI updates faster
        const place = await reverseGeocode(lat, lng);
        setSelectedPlace({ lat, lng, ...place });
      }
    } catch (err) {
      console.error("Coordinate fetch error:", err);
    } finally {
      setFetching(false);
      setSuggestions([]);
      Keyboard.dismiss();
    }
  };

  // --- CENTER PIN (pinned PICK) BEHAVIOR ---
  // onRegionChangeComplete will be debounced; we reverse geocode the center coords and update selectedPlace
  const onRegionChangeComplete = (region) => {
    // region contains latitude, longitude, latitudeDelta, longitudeDelta
    lastRegionRef.current = region;
    if (regionChangeTimeout.current) clearTimeout(regionChangeTimeout.current);

    // debounce: wait 600ms after user stops moving map
    regionChangeTimeout.current = setTimeout(async () => {
      try {
        const { latitude, longitude } = lastRegionRef.current;
        setFetching(true);
        const place = await reverseGeocode(latitude, longitude);
        setSelectedPlace({ lat: latitude, lng: longitude, ...place });
      } catch (e) {
        console.error("onRegionChangeComplete reverse geocode error:", e);
      } finally {
        setFetching(false);
      }
    }, 600);
  };

  // Move map to user's current location and set selectedPlace
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
      console.error("getCurrentLocation error:", err);
      Alert.alert("Error", "Unable to fetch current location. Please select manually.");
    } finally {
      setFetching(false);
    }
  };

  // --- SAVE LOCATION (preserve expoPushToken) ---
  const handleConfirmLocation = async () => {
    if (!selectedPlace) return Alert.alert("Error", "Please pick a location first.");
    if (!auth.currentUser) return Alert.alert("Error", "User not logged in.");
    try {
      setSaving(true);
      const uid = auth.currentUser.uid;
      const userRef = ref(database, `users/${uid}`);

      // Read existing user to preserve token if present
      const snapshot = await get(userRef);
      const existingData = snapshot.val() || {};

      // Always write a location object; only write expoPushToken if existing or newly available
      const updates = {
        location: {
          lat: selectedPlace.lat || null,
          lng: selectedPlace.lng || null,
          area: selectedPlace.area || "",
          city: selectedPlace.city || "",
          state: selectedPlace.state || "",
          pincode: selectedPlace.pincode || "",
          formattedAddress: selectedPlace.formattedAddress || "",
          updatedAt: new Date().toISOString(),
        },
      };

      if (existingData.expoPushToken) {
        updates.expoPushToken = existingData.expoPushToken;
      } else if (expoPushToken) {
        updates.expoPushToken = expoPushToken;
      }
      await update(userRef, updates);

      // navigate back and confirm with a local notif
      navigation.navigate("HomeScreen");
      await Notifications.scheduleNotificationAsync({
        content: { title: "Location Saved", body: "Your location has been updated successfully." },
        trigger: null,
      });
    } catch (err) {
      console.error("Location update error:", err);
      Alert.alert("Error", err.message || "Failed to save location.");
    } finally {
      setSaving(false);
    }
  };

  // --- PUSH NOTIFICATIONS TOKEN LOGIC ---
  async function registerForPushNotificationsAsync() {
    try {
      if (!Constants.isDevice) {
        console.warn("Must use physical device for Push Notifications");
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert("Permission Required", "Enable notifications to receive updates.");
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      setExpoPushToken(token);

      // If user exists, only write token if missing or changed
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        const userRef = ref(database, `users/${uid}`);
        const snapshot = await get(userRef);
        const existingData = snapshot.val() || {};
        if (!existingData.expoPushToken || existingData.expoPushToken !== token) {
          await update(userRef, { expoPushToken: token });
        }
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#28A745",
        });
      }
    } catch (e) {
      console.error("registerForPushNotificationsAsync error:", e);
    }
  }

  // --- RENDER ---
  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.permissionText}>
          LocalBoys needs your location to provide the best experience and products.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#009688" />
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 20.5937,
          longitude: 78.9629,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={onRegionChangeComplete}
      />

      {/* Center pinned PICK marker overlay (non-interactive) */}
      <View pointerEvents="none" style={styles.centerMarkerContainer}>
        <View style={styles.pickLabel}>
          <Text style={styles.pickLabelText}>PICK</Text>
        </View>
        <View style={styles.pin}>
          <View style={styles.pinDot} />
        </View>
      </View>

      {/* Search box */}
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
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={styles.suggestion}
                onPress={() => fetchCoordinates(item.place_id)}
              >
                <Text style={styles.suggestionText}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Use current location button */}
      <TouchableOpacity style={styles.currentLocationButton} onPress={getCurrentLocation}>
        <Text style={styles.currentLocationText}>Use Current Location</Text>
      </TouchableOpacity>

      {/* Details & confirm — only show when we have a selectedPlace (center address) */}
      {selectedPlace && (
        <View style={styles.detailsContainer}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Area</Text>
              <Text style={styles.value}>{selectedPlace.area || "-"}</Text>
              <View style={styles.underline} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>City</Text>
              <Text style={styles.value}>{selectedPlace.city || "-"}</Text>
              <View style={styles.underline} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>State</Text>
              <Text style={styles.value}>{selectedPlace.state || "-"}</Text>
              <View style={styles.underline} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Pincode</Text>
              <Text style={styles.value}>{selectedPlace.pincode || "-"}</Text>
              <View style={styles.underline} />
            </View>
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Confirm Location</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const PIN_SIZE = 28;
const PICK_LABEL_HEIGHT = 26;

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  logo: { width: 80, height: 80, marginBottom: 10 },
  permissionText: { fontSize: 16, textAlign: "center", marginBottom: 20, color: "#333" },
  permissionButton: { backgroundColor: "#28A745", paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: "center" },
  permissionButtonText: { color: "#fff", fontSize: 16 },
  searchContainer: {
    position: "absolute",
    top: Platform.OS === "android" ? 54 : 70,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    borderColor: "#e4e7eb",
    borderWidth: 1,
  },
  suggestionsList: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: SCREEN_H * 0.28,
    borderColor: "#e6e6e6",
    borderWidth: 1,
  },
  suggestion: { paddingVertical: 12, paddingHorizontal: 12, borderBottomColor: "#f0f0f0", borderBottomWidth: 1 },
  suggestionText: { fontSize: 14, color: "#222" },

  currentLocationButton: {
    position: "absolute",
    top: Platform.OS === "android" ? 120 : 138,
    right: 16,
    backgroundColor: "#009688",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    zIndex: 1001,
  },
  currentLocationText: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  // center marker overlay container
  centerMarkerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: - (PIN_SIZE / 2),
    marginTop: - (PIN_SIZE + PICK_LABEL_HEIGHT + 6),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    pointerEvents: "none", // pass touches to the map
  },
  pickLabel: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    height: PICK_LABEL_HEIGHT,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  pickLabelText: { fontSize: 12, fontWeight: "700", color: "#222" },

  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: "#e53935",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ scale: 1.0 }],
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },

  detailsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    zIndex: 1000,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  field: { flex: 1, marginHorizontal: 6 },
  label: { fontSize: 12, color: "#888", marginBottom: 4 },
  value: { fontSize: 16, color: "#000" },
  underline: { height: 1, backgroundColor: "#E0E0E0", marginTop: 6 },

  confirmButton: { backgroundColor: "#28A745", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 6 },
  confirmButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});