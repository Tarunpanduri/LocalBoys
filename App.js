import React, { useCallback, useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

import Login from './screens/login';
import SignUp from './screens/signup';
import MapScreen from './screens/maps';
import HomeScreen from './screens/homescreen';

import { getAuth, onAuthStateChanged } from 'firebase/auth';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Sen_Regular: Sen_400Regular,
    Sen_Medium: Sen_500Medium,
    Sen_Bold: Sen_700Bold,
    Sen_ExtraBold: Sen_800ExtraBold,
  });

  const [initialRoute, setInitialRoute] = useState('Login');
  const [checkingAuth, setCheckingAuth] = useState(true);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !checkingAuth) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, checkingAuth]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        setInitialRoute('HomeScreen');
      } else {
        setInitialRoute('Login'); 
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  if (!fontsLoaded || checkingAuth) return null;

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="SignUp" component={SignUp} />
          <Stack.Screen name="MapScreen" component={MapScreen} />
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
