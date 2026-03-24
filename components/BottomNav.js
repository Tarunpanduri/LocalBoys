import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from "@expo/vector-icons";

// Helper to darken the dynamically passed category color for the active tab background
const darkenColor = (hex, percent) => {
  if (!hex) return "#66BB6A";
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) - amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) - amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) - amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

export default function BottomNav({ activeTab, setActiveTab, setActiveCategory, activeCategoryColor, openCustomOrderSheet }) {
  // Local state to manage the visual expansion (so the Custom tab can expand temporarily)
  const [visualTab, setVisualTab] = useState(activeTab);

  // Sync external tab changes (e.g., if a user places a custom order and it auto-returns to 'products')
  useEffect(() => {
    if (activeTab !== visualTab && activeTab !== "custom") {
      setVisualTab(activeTab);
    }
  }, [activeTab]);

  // --- ANIMATION VALUES ---
  // Flex determines the 60% / 20% / 20% layout ratio (6 + 2 + 2 = 10)
  const flexProd = useRef(new Animated.Value(visualTab === "products" ? 6 : 2)).current;
  const flexCust = useRef(new Animated.Value(visualTab === "custom" ? 6 : 2)).current;
  const flexServ = useRef(new Animated.Value(visualTab === "services" ? 6 : 2)).current;

  // Opacity & Width for the text labels
  const activeProd = useRef(new Animated.Value(visualTab === "products" ? 1 : 0)).current;
  const activeCust = useRef(new Animated.Value(visualTab === "custom" ? 1 : 0)).current;
  const activeServ = useRef(new Animated.Value(visualTab === "services" ? 1 : 0)).current;

  // --- TRIGGER SMOOTH ANIMATIONS ---
  useEffect(() => {
    Animated.parallel([
      // Flex Ratio Animations
      Animated.timing(flexProd, { toValue: visualTab === "products" ? 6 : 2, duration: 300, useNativeDriver: false }),
      Animated.timing(flexCust, { toValue: visualTab === "custom" ? 6 : 2, duration: 300, useNativeDriver: false }),
      Animated.timing(flexServ, { toValue: visualTab === "services" ? 6 : 2, duration: 300, useNativeDriver: false }),
      
      // Text Visibility/Expansion Animations
      Animated.timing(activeProd, { toValue: visualTab === "products" ? 1 : 0, duration: 300, useNativeDriver: false }),
      Animated.timing(activeCust, { toValue: visualTab === "custom" ? 1 : 0, duration: 300, useNativeDriver: false }),
      Animated.timing(activeServ, { toValue: visualTab === "services" ? 1 : 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [visualTab]);

  const handlePress = (tabId) => {
    setVisualTab(tabId);
    
    // Execute logical actions based on tab
    if (tabId === "products") {
      setActiveTab("products");
      setActiveCategory("all");
    } else if (tabId === "services") {
      setActiveTab("services");
      setActiveCategory("all");
    } else if (tabId === "custom") {
      openCustomOrderSheet();
    }
  };

  // --- REUSABLE TAB RENDERER ---
  const renderTab = (tabId, label, iconActive, iconInactive, flexAnim, activeAnim) => {
    const isActive = visualTab === tabId;
    
    // Interpolate the text width from 0 to 80px as it expands
    const textMaxWidth = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });
    // Interpolate margin so it doesn't push the icon off-center when closed
    const textMargin = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
    
    return (
      <Animated.View style={[styles.navItemContainer, { flex: flexAnim }]}>
        <TouchableOpacity 
          activeOpacity={0.8}
          style={[
            styles.navButton, 
            isActive && { backgroundColor: darkenColor(activeCategoryColor, 15) } // Slightly darkened pill
          ]} 
          onPress={() => handlePress(tabId)}
        >
          <Ionicons 
            name={isActive ? iconActive : iconInactive} 
            size={22} 
            color="#fff" 
          />
          <Animated.View style={{ maxWidth: textMaxWidth, opacity: activeAnim, overflow: 'hidden', marginLeft: textMargin }}>
            <Text style={styles.navText} numberOfLines={1}>{label}</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.bottomNav, { backgroundColor: activeCategoryColor }]}>
      {renderTab("products", "Products", "bag-handle", "bag-handle-outline", flexProd, activeProd)}
      {renderTab("custom", "Custom", "cube", "cube-outline", flexCust, activeCust)}
      {renderTab("services", "Services", "construct", "construct-outline", flexServ, activeServ)}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { 
    position: "absolute", 
    bottom: 20, 
    left: 20, 
    right: 20, 
    flexDirection: "row", 
    borderRadius: 30, 
    overflow: "hidden", 
    zIndex: 10, 
    elevation: 10, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 6, 
    height: 56, // Slightly taller to fit the nice pill shape 
    padding: 6, // Internal padding creates a floating pill effect for the active tab
  },
  navItemContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButton: { 
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    justifyContent: "center", 
    alignItems: "center",
    borderRadius: 25, // Perfect rounded pill inside the nav
  },
  navText: { 
    fontSize: Platform.OS === 'ios' ? 14 : 15, 
    fontFamily: "Sen_Bold", 
    color: "#fff",
  },
});