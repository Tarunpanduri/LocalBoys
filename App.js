import React, { useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Platform, Modal, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Sen_400Regular, Sen_500Medium, Sen_700Bold, Sen_800ExtraBold } from '@expo-google-fonts/sen';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates'; 

import { AdminProvider } from './context/AdminContext';
import { UserProvider } from './context/UserContext';
import { CouponProvider } from './context/CouponContext';

import Login from './screens/login';
import SignUp from './screens/signup';
import MapScreen from './screens/maps';
import HomeScreen from './screens/homescreen';
import ShopDetails from './screens/shopdestails';
import CheckoutScreen from './screens/checkout';
import OrderConfirmation from "./screens/OrderConfirmation";
import TrackOrder from './screens/trackorder';
import Profile from './screens/profile';
import EditProfile from './screens/editprofile';
import PrivacyPolicyScreen from './screens/privacypolicy';
import TermsAndConditionsScreen from './screens/Terms';
import ContactUs from './screens/contact';
import Settings from './screens/settings';
import PreviousOrders from './screens/PreviousOrders';
import NewLogin from './screens/newlogin';

import CustomOrderScreen from './components/CustomOrderBottomSheet';
import AddressesScreen from './components/AddressesBottomSheet';

// 🔥 REMOVED THE WEB SDK IMPORT. PURE NATIVE FIREBASE ONLY. 🔥
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc } from '@react-native-firebase/firestore'; 

// Initialize Native Instances
const auth = getAuth();
const db = getFirestore();

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
  })
});

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();
const allowedRoutes = ['HomeScreen', 'TrackOrder', 'OrderConfirmation', 'Profile', 'ShopDetails', 'Addresses'];

export default function App() {
  const [fontsLoaded] = useFonts({ Sen_Regular: Sen_400Regular, Sen_Medium: Sen_500Medium, Sen_Bold: Sen_700Bold, Sen_ExtraBold: Sen_800ExtraBold });
  const [initialRoute, setInitialRoute] = useState('NewLogin');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const responseListener = useRef(null);

  // Modal State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !checkingAuth) await SplashScreen.hideAsync();
  }, [fontsLoaded, checkingAuth]);

  useEffect(() => {
    async function onFetchUpdateAsync() {
      if (__DEV__) return; 
      
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          setShowUpdateModal(true);
        }
      } catch (error) {
        console.log(`Error fetching latest Expo update: ${error}`);
      }
    }
    
    onFetchUpdateAsync();
  }, []);

  const registerForPushNotificationsAsync = async (userId = null) => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('localboys_high_priority_v2', {
        name: 'High Priority Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Push permission not granted');
        return null;
      }
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) console.log('Project ID not found in app config');
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoToken = tokenData.data;
      if (userId && expoToken) {
        const cachedToken = await AsyncStorage.getItem(`pushToken_${userId}`);
        if (cachedToken !== expoToken) {
          const userDocRef = doc(db, "users", userId);
          await setDoc(userDocRef, { expoPushToken: expoToken }, { merge: true });
          await AsyncStorage.setItem(`pushToken_${userId}`, expoToken);
        }
      }
      return expoToken;
    } catch (err) {
      console.log('❌ Push registration error:', err);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setInitialRoute('HomeScreen');
        registerForPushNotificationsAsync(user.uid);
      } else {
        try {
          const guestAddress = await AsyncStorage.getItem('guestAddress');
          setInitialRoute(guestAddress ? 'HomeScreen' : 'NewLogin');
        } catch (e) {
          setInitialRoute('NewLogin');
        }
      }
      setCheckingAuth(false);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const content = response.notification.request.content;
        const data = content.data || {};
        const route = data.screen;
        const imageUrl = data.image || data.imageUrl;
        if (route && allowedRoutes.includes(route) && navigationRef.isReady()) {
          navigationRef.navigate(route, { ...data, notificationImage: imageUrl, fromNotification: true });
        }
      } catch (e) {
        console.error("Navigation error:", e);
      }
    });

    return () => {
      unsubscribe();
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  if (!fontsLoaded || checkingAuth) return null;

  return (
    <RootSiblingParent>
      <View style={styles.container} onLayout={onLayoutRootView}>
        <AdminProvider>
          <UserProvider>
            <CouponProvider>
              <NavigationContainer ref={navigationRef}>
                <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
                  <Stack.Screen name="Login" component={Login} />
                  <Stack.Screen name="SignUp" component={SignUp} />
                  <Stack.Screen name="MapScreen" component={MapScreen} />
                  <Stack.Screen name="HomeScreen" component={HomeScreen} />
                  <Stack.Screen name="ShopDetails" component={ShopDetails} />
                  <Stack.Screen name="Checkout" component={CheckoutScreen} />
                  <Stack.Screen name="TrackOrder" component={TrackOrder} />
                  <Stack.Screen name="Profile" component={Profile} />
                  <Stack.Screen name="EditProfile" component={EditProfile} />
                  <Stack.Screen name="OrderConfirmation" component={OrderConfirmation} options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                  <Stack.Screen name="Terms" component={TermsAndConditionsScreen} />
                  <Stack.Screen name="ContactUs" component={ContactUs} />
                  <Stack.Screen name="Settings" component={Settings} />
                  <Stack.Screen name="PreviousOrders" component={PreviousOrders} />
                  <Stack.Screen name="NewLogin" component={NewLogin} />

                  <Stack.Group screenOptions={{ presentation: 'formSheet' }}>
                    <Stack.Screen name="AddressesScreen" component={AddressesScreen} />
                    <Stack.Screen name="CustomOrderScreen" component={CustomOrderScreen} />
                  </Stack.Group>
                </Stack.Navigator>
              </NavigationContainer>
            </CouponProvider>
          </UserProvider>
        </AdminProvider>

        {/* Custom Update Modal */}
        <Modal
          visible={showUpdateModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Update Available!</Text>
              <Text style={styles.modalText}>
                A new version of LocalBoys is ready. Please restart the app to apply the latest features and fixes.
              </Text>
              <TouchableOpacity
                style={styles.updateButton}
                activeOpacity={0.8}
                onPress={async () => {
                  setIsRestarting(true);
                  await Updates.reloadAsync();
                }}
                disabled={isRestarting}
              >
                {isRestarting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.updateButtonText}>Restart Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </RootSiblingParent>
  );
}

const styles = StyleSheet.create({ 
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontFamily: 'Sen_Bold',
    fontSize: 22,
    marginBottom: 12,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  modalText: {
    fontFamily: 'Sen_Regular',
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    lineHeight: 24,
  },
  updateButton: {
    backgroundColor: '#000', 
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    fontFamily: 'Sen_Bold',
    color: '#fff',
    fontSize: 16,
  }
});