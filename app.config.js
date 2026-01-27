import 'dotenv/config';

export default {
  expo: {
    name: "LocalBoys",
    slug: "LocalBoys",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "cover",
      backgroundColor: "#ffffff"
    },
    ios: {
      googleServicesFile: "./GoogleService-Info.plist",
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "LocalBoys needs your location to provide the best experience and products",
        NSLocationAlwaysAndWhenInUseUsageDescription: "LocalBoys needs your location in background to update your deliveries accurately",
        NSUserTrackingUsageDescription: "LocalBoys may send notifications to keep you updated",
        UIBackgroundModes: [
          "location",
          "fetch",
          "remote-notification"
        ],
        ITSAppUsesNonExemptEncryption: false
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
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
        "FOREGROUND_SERVICE",
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
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#28A745",
          sounds: [],
          defaultChannel: "localboys_high_priority_v2"
        }
      ]
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
      eas: {
        projectId: "fcf95556-c415-4a5f-8f64-31a42bbeaa98"
      }
    }
  }
};