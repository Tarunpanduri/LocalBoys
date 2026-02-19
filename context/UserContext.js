import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
// 1. Import Async Storage
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [userLocation, setUserLocation] = useState(null); 
  const [mainAddress, setMainAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- NEW: Helper to load guest data from Local Storage ---
  const loadGuestLocation = async () => {
    try {
      const savedAddress = await AsyncStorage.getItem('guestAddress');
      if (savedAddress) {
        const parsedAddress = JSON.parse(savedAddress);
        
        // Mimic the structure the app expects so HomeScreen works
        setUserData({ isGuest: true }); 
        setMainAddress(parsedAddress);
        setUserLocation({
          lat: parseFloat(parsedAddress.lat),
          lng: parseFloat(parsedAddress.lng),
          formattedAddress: parsedAddress.formattedAddress,
          city: parsedAddress.city,
          state: parsedAddress.state,
          pincode: parsedAddress.pincode
        });
      }
    } catch (e) {
      console.log("Error loading guest address", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // --- EXISTING LOGIC: User is logged in (Firebase) ---
        const userRef = ref(db, `users/${currentUser.uid}`);
        const unsubDb = onValue(userRef, (snapshot) => {
          const val = snapshot.val();
          setUserData(val);

          if (val) {
            let loc = null;
            if (val.mainAddressId && val.addresses && val.addresses[val.mainAddressId]) {
              loc = val.addresses[val.mainAddressId];
              setMainAddress(loc);
            } 
            else if (val.location) {
              loc = val.location;
              setMainAddress(null);
            } else {
              setMainAddress(null);
            }

            if (loc && loc.lat && loc.lng) {
              setUserLocation({
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
                formattedAddress: loc.formattedAddress,
                city: loc.city,
                state: loc.state,
                pincode: loc.pincode
              });
            } else {
              setUserLocation(null);
            }
          } else {
            setUserData(null);
            setUserLocation(null);
          }
          setLoading(false);
        });

        return () => unsubDb();
      } else {
        // --- GUEST LOGIC: User is NOT logged in ---
        // Reset user data but try to load guest location
        setUserData(null);
        setMainAddress(null);
        setUserLocation(null);
        loadGuestLocation(); 
      }
    });

    return () => unsubAuth();
  }, []);

  return (
    // Expose setters so MapScreen can update context instantly
    <UserContext.Provider value={{ 
        user, 
        userData, 
        userLocation, 
        mainAddress, 
        loading,
        setMainAddress, 
        setUserLocation 
    }}>
      {children}
    </UserContext.Provider>
  );
};