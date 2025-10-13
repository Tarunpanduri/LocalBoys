import React, { useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Sen_400Regular,
  Sen_500Medium,
  Sen_700Bold,
  Sen_800ExtraBold
} from '@expo-google-fonts/sen';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

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

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { ref, update } from 'firebase/database';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

// Create navigation ref for handling navigation outside components
export const navigationRef = React.createRef();

export default function App() {
  const [fontsLoaded] = useFonts({
    Sen_Regular: Sen_400Regular,
    Sen_Medium: Sen_500Medium,
    Sen_Bold: Sen_700Bold,
    Sen_ExtraBold: Sen_800ExtraBold,
  });

  const [initialRoute, setInitialRoute] = useState('Login');
  const [checkingAuth, setCheckingAuth] = useState(true);

  const notificationListener = useRef();
  const responseListener = useRef();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !checkingAuth) await SplashScreen.hideAsync();
  }, [fontsLoaded, checkingAuth]);

  const registerForPushNotificationsAsync = async (userId = null) => {
    if (!Constants.isDevice) {
      console.log('Push notifications require a physical device.');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permission denied', 'Failed to get push token for notifications.');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log('Expo Push Token:', tokenData.data);

      if (userId) await update(ref(db, `users/${userId}`), { expoPushToken: tokenData.data });

      return tokenData.data;
    } catch (err) {
      console.log('Push registration error:', err);
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

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification Received:', notification);
    });

    // Handle notification responses
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Response:', response);
      const route = response.notification.request.content.data.screen;
      if (route) navigationRef.current?.navigate(route);
    });

    return () => {
      unsubscribe();
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  if (!fontsLoaded || checkingAuth) return null;

  return (
    <RootSiblingParent>
      <View style={styles.container} onLayout={onLayoutRootView}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="SignUp" component={SignUp} />
            <Stack.Screen name="MapScreen" component={MapScreen} />
            <Stack.Screen name="HomeScreen" component={HomeScreen} />
            <Stack.Screen name="ShopDetails" component={ShopDetails} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="TrackOrder" component={TrackOrder} />
            <Stack.Screen name="Addresses" component={AddressesScreen} />
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen
              name="OrderConfirmation"
              component={OrderConfirmation}
              options={{ headerShown: false, gestureEnabled: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </RootSiblingParent>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});