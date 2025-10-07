import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: "AIzaSyA4iWcMwkfevlM8tpdpYNgPqiFbr6_K4AU",
  authDomain: "localboys-c6a9a.firebaseapp.com",
  databaseURL: "https://localboys-c6a9a-default-rtdb.firebaseio.com/",
  projectId: "localboys-c6a9a",
  storageBucket: "localboys-c6a9a.appspot.com",
  messagingSenderId: "138829302985",
  appId: "1:138829302985:web:fc3398674ab16a093cd118",
  measurementId: "G-HQ2HEXGV9H"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getDatabase(app);

export default app;
