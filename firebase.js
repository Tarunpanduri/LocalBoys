import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
// --- CHANGED: Use standard getFirestore ---
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

const firebaseConfig = {
  apiKey: extra.apiKey,
  authDomain: extra.authDomain,
  projectId: extra.projectId,
  storageBucket: extra.storageBucket,
  messagingSenderId: extra.messagingSenderId,
  appId: extra.appId,
  measurementId: extra.measurementId,
  databaseURL: extra.databaseURL, 
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with React Native Persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// --- CHANGED: Initialize standard Firestore ---
// (Zustand + AsyncStorage handles all our offline capabilities flawlessly)
export const db = getFirestore(app);

export default app;