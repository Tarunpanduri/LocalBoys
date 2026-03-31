import { getApp, getApps } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions } from '@react-native-firebase/functions';

// ✅ ADD WEB SDK STORAGE
import { initializeApp as initializeWebApp } from "firebase/app";
import { getStorage as getWebStorage } from "firebase/storage";
import Constants from 'expo-constants'; // 👈 IMPORT CONSTANTS

// 🔥 Native App
const app = getApps().length === 0 ? getApp() : getApp();

// 🔥 Native services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// 🔥 Web Firebase config (Fetch from Expo Constants)
const firebaseConfig = {
  apiKey: Constants.expoConfig.extra.apiKey,
  authDomain: Constants.expoConfig.extra.authDomain,
  projectId: Constants.expoConfig.extra.projectId,
  storageBucket: Constants.expoConfig.extra.storageBucket, // 👈 Now properly defined
  messagingSenderId: Constants.expoConfig.extra.messagingSenderId,
  appId: Constants.expoConfig.extra.appId,
};

// 🔥 Web app (for storage only)
const webApp = initializeWebApp(firebaseConfig);

// ✅ EXPORT WEB STORAGE
export const storage = getWebStorage(webApp);