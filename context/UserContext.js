import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [userLocation, setUserLocation] = useState(null); 
  const [mainAddress, setMainAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
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
        setUserData(null);
        setUserLocation(null);
        setMainAddress(null);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  return (
    <UserContext.Provider value={{ user, userData, userLocation, mainAddress, loading }}>
      {children}
    </UserContext.Provider>
  );
};