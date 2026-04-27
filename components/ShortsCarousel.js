import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Modal,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

const extractVideoId = (url) => {
  if (!url || typeof url !== "string") return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

const ShortsCarousel = ({ shortsUrls = [], title = "Latest Shorts" }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  // Card dimensions for the horizontal feed
  const CARD_WIDTH = Math.floor(Math.min(windowWidth * 0.42, 180)); 
  const CARD_HEIGHT = Math.floor(CARD_WIDTH * (16 / 9)); 

  // Modern Modal Dimensions - Near edge-to-edge for immersion
  const MODAL_PLAYER_WIDTH = windowWidth * 0.92;
  const MODAL_PLAYER_HEIGHT = MODAL_PLAYER_WIDTH * (16 / 9);

  const [activeVideoId, setActiveVideoId] = useState(null);

  const videoData = useMemo(() => {
    return shortsUrls
      .map((url) => {
        const id = extractVideoId(url);
        return id ? {
          id,
          url,
          thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        } : null;
      })
      .filter(Boolean);
  }, [shortsUrls]);

  // Find the full active video object to use its thumbnail for the ambient background
  const activeVideo = useMemo(() => {
    return videoData.find((v) => v.id === activeVideoId);
  }, [activeVideoId, videoData]);

  const renderItem = useCallback(({ item }) => {
    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
        activeOpacity={0.8}
        onPress={() => setActiveVideoId(item.id)}
      >
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
        <View style={styles.overlay}>
          <View style={styles.playButtonCircle}>
            <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
          </View>
        </View>
        <View style={styles.shortsBadge}>
          <Ionicons name="flash" size={12} color="#fff" />
          <Text style={styles.shortsBadgeText}>Shorts</Text>
        </View>
      </TouchableOpacity>
    );
  }, [CARD_WIDTH, CARD_HEIGHT]);

  if (!videoData || videoData.length === 0) return null;

  // 🔥 THE MAGIC: Injects CSS to hide the YouTube website's header and footer.
  const INJECTED_JAVASCRIPT = `
    var style = document.createElement('style');
    style.innerHTML = 'ytm-mobile-topbar-renderer, ytm-pivot-bar-renderer, ytm-bottom-sheet-renderer { display: none !important; }';
    document.head.appendChild(style);
    true;
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="logo-youtube" size={22} color="#FF0000" />
        <Text style={styles.title}>{title}</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        data={videoData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
      />

      {/* 🎬 MODERN IMMERSIVE VIDEO MODAL 🎬 */}
      <Modal
        visible={!!activeVideoId}
        animationType="fade" // Fade feels more premium
        transparent={true} // Allows the blurred background to show
        onRequestClose={() => setActiveVideoId(null)}
      >
        <View style={styles.modalRoot}>
          
          {/* Ambient Blurred Background */}
          {activeVideo && (
            <>
              <Image 
                source={{ uri: activeVideo.thumbnail }} 
                style={StyleSheet.absoluteFillObject} 
                blurRadius={60} // Heavy blur for the modern glass look
              />
              <View style={styles.ambientDarkenLayer} />
            </>
          )}

          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

          {/* Floating Glass Close Button */}
          <TouchableOpacity 
            style={styles.floatingCloseBtn} 
            activeOpacity={0.7}
            onPress={() => setActiveVideoId(null)}
          >
            <Ionicons name="close" size={24} color="#fff" />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>

          {/* Center Elevated Video Player Container */}
          <View style={[
            styles.modernPlayerContainer, 
            { width: MODAL_PLAYER_WIDTH, height: MODAL_PLAYER_HEIGHT }
          ]}>
            {activeVideoId && (
              <WebView
                // Load the actual mobile Shorts site to avoid iframe restrictions
                source={{ uri: `https://www.youtube.com/shorts/${activeVideoId}` }}
                style={{ flex: 1, backgroundColor: '#000' }}
                injectedJavaScript={INJECTED_JAVASCRIPT}
                javaScriptEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                bounces={false}
                scrollEnabled={false}
              />
            )}
          </View>

        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, marginBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, marginBottom: 12 },
  title: { fontSize: 18, fontFamily: "Sen_Bold", marginLeft: 8, color: "#111" },
  listContent: { paddingHorizontal: 18, gap: 12 },
  card: { borderRadius: 12, backgroundColor: "#1a1a1a", overflow: "hidden" },
  thumbnail: { width: "100%", height: "100%", resizeMode: "cover" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  playButtonCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)" },
  shortsBadge: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 0, 0, 0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  shortsBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Sen_Bold", marginLeft: 4 },
  
  /* Modern Modal Styles */
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000", // Fallback color behind the blur
  },
  ambientDarkenLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)", // Darkens the blurred image so the video stands out
  },
  floatingCloseBtn: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : 40, // Safe area padding
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", // Frosted glass look
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    zIndex: 100, // Ensures close button stays above the WebView
  },
  closeText: {
    color: "#fff",
    fontFamily: "Sen_Bold",
    fontSize: 14,
    marginLeft: 4,
  },
  modernPlayerContainer: {
    borderRadius: 24, // Super smooth modern corners
    overflow: "hidden", // Clips the WebView to the rounded corners
    backgroundColor: "#000",
    elevation: 20, // Huge shadow for Android
    shadowColor: "#000", // Soft, wide shadow for iOS
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)", // Subtle rim light effect
  },
});

export default React.memo(ShortsCarousel);