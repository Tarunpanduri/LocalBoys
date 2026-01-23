import { getAuth } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { db } from "../firebase";

export const getCurrentUserId = () => {
  const auth = getAuth();
  return auth.currentUser?.uid || null;
};

export const fetchUserData = async () => {
  const uid = getCurrentUserId();
  if (!uid) return null;

  const snapshot = await get(ref(db, `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
};

export const updateUserData = async (data) => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error("No user logged in");

  return update(ref(db, `users/${uid}`), data);
};
