import React, { useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Sen_400Regular, Sen_500Medium, Sen_700Bold, Sen_800ExtraBold } from '@expo-google-fonts/sen';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device'; 

// Screens
import Login from './screens/login';
import SignUp from './screens/signup';
import MapScreen from './screens/maps';
import HomeScreen from './screens/homescreen';
import ShopDetails from './screens/shopdestails';
import CheckoutScreen from './screens/checkout';
import OrderConfirmation from "./screens/OrderConfirmation";
import TrackOrder from './screens/trackorder';
import AddressesScreen from './screens/AddressesScreen';
import Profile from './screens/profile';
import CheckoutScreentwo from './screens/checkouttwo';
import EditProfile from './screens/editprofile';
import PrivacyPolicyScreen from './screens/privacypolicy';
import TermsAndConditionsScreen from './screens/Terms';
import ContactUs from './screens/contact';

// Firebase
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { ref, update } from 'firebase/database';

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
  const [initialRoute, setInitialRoute] = useState('Login');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const responseListener = useRef(null);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !checkingAuth) await SplashScreen.hideAsync();
  }, [fontsLoaded, checkingAuth]);

  const registerForPushNotificationsAsync = async (userId = null) => {
    // 1. Check if physical device
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    // 2. Setup Android Channel (UPDATED ID TO FORCE REFRESH)
    if (Platform.OS === 'android') {
      // We added '_v2' to force Android to create a fresh channel with new settings
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
      // 3. Check Permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Enable notifications to receive updates.');
        return null;
      }

      // 4. Get Expo Push Token
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      if (!projectId) {
        console.log('Project ID not found in app config');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      const expoToken = tokenData.data;

      // 5. Save to Firebase as expoPushToken
      if (userId && expoToken) {
        await update(ref(db, `users/${userId}`), { expoPushToken: expoToken });
      }
      
      return expoToken;
    } catch (err) {
      console.log('❌ Push registration error:', err);
      return null;
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, user => {
      setInitialRoute(user ? 'HomeScreen' : 'Login');
      setCheckingAuth(false);
      if (user) registerForPushNotificationsAsync(user.uid);
    });

    // Handle Notification Response (User taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const content = response.notification.request.content;
        const data = content.data || {};
        const route = data.screen;
        
        // Ensure we grab the image URL if provided in data
        const imageUrl = data.image || data.imageUrl;
        
        if (route && allowedRoutes.includes(route) && navigationRef.isReady()) {
          navigationRef.navigate(route, { 
            ...data, 
            notificationImage: imageUrl, 
            fromNotification: true 
          });
        }
      } catch (e) {
        console.error("Navigation error:", e);
      }
    });

    return () => {
      unsubscribe();
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  if (!fontsLoaded || checkingAuth) return null;

  return (
    <RootSiblingParent>
      <View style={styles.container} onLayout={onLayoutRootView}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
            <Stack.Screen name="Login" component={Login}/>
            <Stack.Screen name="SignUp" component={SignUp}/>
            <Stack.Screen name="MapScreen" component={MapScreen}/>
            <Stack.Screen name="HomeScreen" component={HomeScreen}/>
            <Stack.Screen name="ShopDetails" component={ShopDetails}/>
            <Stack.Screen name="Checkout" component={CheckoutScreen}/>
            <Stack.Screen name="TrackOrder" component={TrackOrder}/>
            <Stack.Screen name="Addresses" component={AddressesScreen}/>
            <Stack.Screen name="Profile" component={Profile}/>
            <Stack.Screen name="CheckoutScreentwo" component={CheckoutScreentwo}/>
            <Stack.Screen name="EditProfile" component={EditProfile}/>
            <Stack.Screen name="OrderConfirmation" component={OrderConfirmation} options={{ headerShown: false, gestureEnabled: false }}/>
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen}/>
            <Stack.Screen name="Terms" component={TermsAndConditionsScreen}/>
            <Stack.Screen name="ContactUs" component={ContactUs}/>
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </RootSiblingParent>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' } });