import 'dotenv/config';

export default {
  expo: {
    name: "Localboys",
    slug: "LocalBoys",
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/fcf95556-c415-4a5f-8f64-31a42bbeaa98"
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      googleServicesFile: "./GoogleService-Info.plist",
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "LocalBoys needs your location to help you pin your delivery address.",
        UIBackgroundModes: ["fetch", "remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.44592964622-95i20pukdlbgd9s8r6m4su8lthb8u9bs"
            ]
          }
        ]
      },
      config: {
        googleMapsApiKey: process.env.googleMapsApiKey
      },
      bundleIdentifier: "com.tarunpanduri1388.LocalBoys"
    },
    android: {
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: "com.tarunpanduri1388.LocalBoys",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "POST_NOTIFICATIONS",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.googleMapsApiKey
        }
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/messaging",
      "expo-font",
      [
        "expo-image-picker",
        {
          photosPermission: "LocalBoys needs access to your photos so you can upload reference images for custom orders.",
          cameraPermission: "LocalBoys needs access to your camera so you can snap photos for custom orders."
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "LocalBoys needs your location to pinpoint your delivery address and find the closest shops."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#28A745",
          sounds: [],
          defaultChannel: "localboys_high_priority_v2"
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static"
          }
        }
      ],
      "./plugins/withReactNativeMapsFix.js"
    ],
    extra: {
      apiKey: process.env.API_KEY,
      authDomain: process.env.AUTH_DOMAIN,
      projectId: process.env.PROJECT_ID,
      storageBucket: process.env.STORAGE_BUCKET,
      messagingSenderId: process.env.MESSAGING_SENDER_ID,
      appId: process.env.APP_ID,
      measurementId: process.env.MEASUREMENT_ID,
      databaseURL: process.env.DATABASE_URL,
      googleMapsApiKey: process.env.googleMapsApiKey,
      configUrl: process.env.CONFIG_URL,
      eas: {
        projectId: "fcf95556-c415-4a5f-8f64-31a42bbeaa98"
      }
    }
  }
};