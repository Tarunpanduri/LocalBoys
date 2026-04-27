import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, useWindowDimensions } from "react-native";
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from "@expo/vector-icons";

const MultimediaCard = React.memo(({ url }) => {
  // FIXED: Dynamic dimensions updates correctly on orientation/tablet changes!
  const { width } = useWindowDimensions(); 
  const [lottieData, setLottieData] = useState(null);
  const [mediaType, setMediaType] = useState(null);

  useEffect(() => {
    if (!url) {
      setMediaType(null);
      return;
    }

    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('.json')) {
      setMediaType('lottie');
      fetchAndCacheLottie(url);
    } else if (lowerUrl.includes('.mp4')) {
      setMediaType('video'); 
    } else {
      setMediaType('image');
    }
  }, [url]);

  const fetchAndCacheLottie = async (currentUrl) => {
    const CACHE_DATA_KEY = '@localboys_event_lottie_data';
    const CACHE_URL_KEY = '@localboys_event_lottie_url';

    try {
      const savedUrl = await AsyncStorage.getItem(CACHE_URL_KEY);
      const cachedData = await AsyncStorage.getItem(CACHE_DATA_KEY);

      if (savedUrl === currentUrl && cachedData) {
        setLottieData(JSON.parse(cachedData));
      }

      const response = await fetch(currentUrl, { cache: 'no-cache' });
      
      if (response.ok) {
        const freshData = await response.json();
        const freshDataStr = JSON.stringify(freshData);

        if (savedUrl !== currentUrl || cachedData !== freshDataStr) {
          await AsyncStorage.setItem(CACHE_URL_KEY, currentUrl);
          await AsyncStorage.setItem(CACHE_DATA_KEY, freshDataStr);
          setLottieData(freshData);
          console.log("[MultimediaCard] Downloaded and cached fresh Lottie data.");
        } else {
          console.log("[MultimediaCard] Cache verified with server. No changes needed.");
        }
      }
    } catch (error) {
      console.warn("[MultimediaCard] Network error, relying on cache.", error);
    }
  };

  if (!url) return null;

  return (
    <View style={[styles.bannerContainer, { width: width }]}>
      {mediaType === 'lottie' && lottieData && (
        <LottieView
          source={lottieData} 
          autoPlay
          loop
          style={styles.mediaFill}
          resizeMode="cover"
        />
      )}
      
      {mediaType === 'image' && (
        <Image 
          source={{ uri: url }} 
          style={styles.mediaFill} 
          resizeMode="cover" 
        />
      )}
      
      {mediaType === 'video' && (
        <View style={[styles.mediaFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
          <Ionicons name="play-circle-outline" size={50} color="#fff" />
          <Text style={{color: '#fff', marginTop: 5, fontFamily: 'Sen_Medium'}}>Video formatting coming soon</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  bannerContainer: {
    aspectRatio: 2/1,
    marginTop: 15,
    overflow: 'hidden',
    alignSelf: 'center', 
  },
  mediaFill: {
    width: '100%',
    height: '100%',
  },
});

export default MultimediaCard;