import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
// 🔥 STRICT FIRESTORE IMPORTS. NO RTDB. 🔥
import { doc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [userLocation, setUserLocation] = useState(null); 
  const [mainAddress, setMainAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGuestLocation = async () => {
    try {
      const savedAddress = await AsyncStorage.getItem('guestAddress');
      if (savedAddress) {
        const parsedAddress = JSON.parse(savedAddress);
        
        setUserData({ isGuest: true }); 
        setMainAddress(parsedAddress);
        setUserLocation({
          lat: parseFloat(parsedAddress.lat),
          lng: parseFloat(parsedAddress.lng),
          formattedAddress: parsedAddress.formattedAddress,
          city: parsedAddress.city,
          state: parsedAddress.state,
          pincode: parsedAddress.pincode // Crucial for hybrid logic
        });
      }
    } catch (e) {
      console.log("Error loading guest address", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    // 1. Declare the unsubscribe function OUTSIDE the auth callback
    let unsubDb = null; 

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      // 2. Clear any existing Firestore listener BEFORE creating a new one or logging out
      if (unsubDb) {
        unsubDb();
        unsubDb = null;
      }

      if (currentUser) {
        // 🔥 FIRESTORE SYNC LOGIC 🔥
        const userRef = doc(db, 'users', currentUser.uid);
        
        // 3. Assign the new listener to our variable
        unsubDb = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.data();
            
            // Map Firestore GeoPoints for UI
            if (val.addresses) {
              Object.keys(val.addresses).forEach(key => {
                const addr = val.addresses[key];
                if (addr.location) {
                  addr.lat = addr.location.latitude ?? addr.location.lat;
                  addr.lng = addr.location.longitude ?? addr.location.lng;
                }
              });
            }

            setUserData(val);

            let loc = null;
            if (val.mainAddressId && val.addresses && val.addresses[val.mainAddressId]) {
              loc = val.addresses[val.mainAddressId];
              setMainAddress(loc);
            } else if (val.location || val.lat) {
              loc = val;
              setMainAddress(null);
            } else {
              setMainAddress(null);
            }

            const finalLat = loc?.lat ?? loc?.location?.latitude;
            const finalLng = loc?.lng ?? loc?.location?.longitude;

            if (finalLat && finalLng) {
              setUserLocation({
                lat: parseFloat(finalLat),
                lng: parseFloat(finalLng),
                formattedAddress: loc.formattedAddress || '',
                city: loc.city || '',
                state: loc.state || '',
                pincode: loc.pincode || '' // Crucial for hybrid logic
              });
            } else {
              setUserLocation(null);
            }
          } else {
            setUserData(null);
            setUserLocation(null);
          }
          setLoading(false);
        }, (error) => {
           // 4. Gracefully ignore permission errors that happen at the exact millisecond of account deletion
           if (error.code === 'permission-denied') {
             console.log("User logged out or deleted. Detaching listener.");
           } else {
             console.error("Firestore user sync error:", error);
           }
           setLoading(false);
        });

      } else {
        setUserData(null);
        setMainAddress(null);
        setUserLocation(null);
        loadGuestLocation(); 
      }
    });

    return () => {
      // 5. Clean up BOTH listeners when the entire provider unmounts
      if (unsubDb) unsubDb();
      unsubAuth();
    };
  }, []);

  return (
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