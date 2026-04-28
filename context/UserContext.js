import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { doc, onSnapshot } from '@react-native-firebase/firestore';

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
          pincode: parsedAddress.pincode
        });
      }
    } catch (e) {
      console.log("Error loading guest address", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    let unsubDb = null;
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (unsubDb) {
        unsubDb();
        unsubDb = null;
      }
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        unsubDb = onSnapshot(userRef,
          (snapshot) => {
            if (snapshot.exists) {
              const val = snapshot.data();
              if (val && typeof val === 'object') {
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
                    pincode: loc.pincode || ''
                  });
                } else {
                  setUserLocation(null);
                }
              } else {
                setUserData(null);
                setUserLocation(null);
              }
            } else {
              setUserData(null);
              setUserLocation(null);
            }
            setLoading(false);
          },
          (error) => {
            if (error.code === 'permission-denied' || error.code === 'firestore/permission-denied') {
              console.log("User logged out or deleted. Detaching listener.");
            } else {
              console.error("Firestore user sync error:", error);
            }
            setLoading(false);
          }
        );
      } else {
        setUserData(null);
        setMainAddress(null);
        setUserLocation(null);
        loadGuestLocation();
      }
    });

    return () => {
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