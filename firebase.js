// firebase.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA_pgpDfyn6jEmXkOKww8OvueM7puMKD_g",
  authDomain: "localboys-9516a.firebaseapp.com",
  projectId: "localboys-9516a",
  storageBucket: "localboys-9516a.firebasestorage.app",
  messagingSenderId: "792340084783",
  appId: "1:792340084783:web:6fcaa11104e3375835eeda",
  measurementId: "G-D2QF3QWSPX",
  databaseURL: "https://localboys-9516a-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getDatabase(app);



export default app;