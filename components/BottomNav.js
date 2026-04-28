import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

// FIXED: Bulletproof logic
const darkenColor = (hex, percent) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return "#66BB6A";
  const num = parseInt(hex.replace("#", ""), 16);
  if (isNaN(num)) return "#66BB6A";
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) - amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) - amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) - amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

// 🔥 THE FIX: Extracted to a proper React Component to respect Rules of Hooks
const NavTab = React.memo(({ tabId, label, iconActive, iconInactive, isActive, darkenedColor, onPress }) => {
  
  // Natively animate flex container
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      flex: withTiming(isActive ? 6 : 2, { duration: 300, easing: Easing.out(Easing.ease) })
    };
  }, [isActive]);

  // Natively animate text expanding
  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      maxWidth: withTiming(isActive ? 80 : 0, { duration: 300 }),
      opacity: withTiming(isActive ? 1 : 0, { duration: 300 }),
      marginLeft: withTiming(isActive ? 6 : 0, { duration: 300 })
    };
  }, [isActive]);

  return (
    <Animated.View style={[styles.navItemContainer, animatedContainerStyle]}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        // 🔥 THE FIX: Apply background color exactly like the old code for instant, glitch-free selection
        style={[styles.navButton, isActive && { backgroundColor: darkenedColor }]} 
        onPress={() => onPress(tabId)}
      >
        <Ionicons name={isActive ? iconActive : iconInactive} size={22} color="#fff" />
        <Animated.View style={[{ overflow: 'hidden' }, animatedTextStyle]}>
          <Text style={styles.navText} numberOfLines={1}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function BottomNav({ activeTab, setActiveTab, setActiveCategory, activeCategoryColor, openCustomOrderSheet }) {
  const [visualTab, setVisualTab] = useState(activeTab);

  // Pre-calculate the color on the JS thread so the UI thread doesn't crash
  const darkenedActiveColor = useMemo(() => darkenColor(activeCategoryColor, 15), [activeCategoryColor]);

  useEffect(() => {
    if (activeTab !== visualTab && activeTab !== "custom") {
      setVisualTab(activeTab);
    }
  }, [activeTab]);

  const handlePress = useCallback((tabId) => {
    setVisualTab(tabId);
    if (tabId === "products") {
      setActiveTab("products");
      setActiveCategory("all");
    } else if (tabId === "services") {
      setActiveTab("services");
      setActiveCategory("all");
    } else if (tabId === "custom") {
      openCustomOrderSheet();
    }
  }, [setActiveTab, setActiveCategory, openCustomOrderSheet]);

  return (
    <View style={[styles.bottomNav, { backgroundColor: activeCategoryColor || "#66BB6A" }]}>
      <NavTab 
        tabId="products" 
        label="Products" 
        iconActive="bag-handle" 
        iconInactive="bag-handle-outline" 
        isActive={visualTab === "products"} 
        darkenedColor={darkenedActiveColor} 
        onPress={handlePress} 
      />
      <NavTab 
        tabId="custom" 
        label="Custom" 
        iconActive="cube" 
        iconInactive="cube-outline" 
        isActive={visualTab === "custom"} 
        darkenedColor={darkenedActiveColor} 
        onPress={handlePress} 
      />
      <NavTab 
        tabId="services" 
        label="Services" 
        iconActive="construct" 
        iconInactive="construct-outline" 
        isActive={visualTab === "services"} 
        darkenedColor={darkenedActiveColor} 
        onPress={handlePress} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { position: "absolute", bottom: 20, left: 20, right: 20, flexDirection: "row", borderRadius: 30, overflow: "hidden", zIndex: 10, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, height: 56, padding: 6, borderWidth: 1.5, borderColor: "rgba(85, 134, 85, 0.3)" },
  navItemContainer: { height: '100%', justifyContent: 'center', alignItems: 'center' },
  navButton: { flexDirection: 'row', width: '100%', height: '100%', justifyContent: "center", alignItems: "center", borderRadius: 25 },
  navText: { fontSize: Platform.OS === 'ios' ? 14 : 15, fontFamily: "Sen_Bold", color: "#fff" },
});