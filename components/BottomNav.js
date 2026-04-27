import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from "@expo/vector-icons";

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

export default function BottomNav({ activeTab, setActiveTab, setActiveCategory, activeCategoryColor, openCustomOrderSheet }) {
  const [visualTab, setVisualTab] = useState(activeTab);

  useEffect(() => {
    if (activeTab !== visualTab && activeTab !== "custom") {
      setVisualTab(activeTab);
    }
  }, [activeTab]);

  const flexProd = useRef(new Animated.Value(visualTab === "products" ? 6 : 2)).current;
  const flexCust = useRef(new Animated.Value(visualTab === "custom" ? 6 : 2)).current;
  const flexServ = useRef(new Animated.Value(visualTab === "services" ? 6 : 2)).current;

  const activeProd = useRef(new Animated.Value(visualTab === "products" ? 1 : 0)).current;
  const activeCust = useRef(new Animated.Value(visualTab === "custom" ? 1 : 0)).current;
  const activeServ = useRef(new Animated.Value(visualTab === "services" ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(flexProd, { toValue: visualTab === "products" ? 6 : 2, duration: 300, useNativeDriver: false }),
      Animated.timing(flexCust, { toValue: visualTab === "custom" ? 6 : 2, duration: 300, useNativeDriver: false }),
      Animated.timing(flexServ, { toValue: visualTab === "services" ? 6 : 2, duration: 300, useNativeDriver: false }),
      Animated.timing(activeProd, { toValue: visualTab === "products" ? 1 : 0, duration: 300, useNativeDriver: false }),
      Animated.timing(activeCust, { toValue: visualTab === "custom" ? 1 : 0, duration: 300, useNativeDriver: false }),
      Animated.timing(activeServ, { toValue: visualTab === "services" ? 1 : 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [visualTab]);

  const handlePress = (tabId) => {
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
  };

  const renderTab = (tabId, label, iconActive, iconInactive, flexAnim, activeAnim) => {
    const isActive = visualTab === tabId;
    const textMaxWidth = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });
    const textMargin = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
    
    return (
      <Animated.View style={[styles.navItemContainer, { flex: flexAnim }]}>
        <TouchableOpacity 
          activeOpacity={0.8}
          style={[
            styles.navButton, 
            isActive && { backgroundColor: darkenColor(activeCategoryColor, 15) } 
          ]} 
          onPress={() => handlePress(tabId)}
        >
          <Ionicons name={isActive ? iconActive : iconInactive} size={22} color="#fff" />
          <Animated.View style={{ maxWidth: textMaxWidth, opacity: activeAnim, overflow: 'hidden', marginLeft: textMargin }}>
            <Text style={styles.navText} numberOfLines={1}>{label}</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.bottomNav, { backgroundColor: activeCategoryColor || "#66BB6A" }]}>
      {renderTab("products", "Products", "bag-handle", "bag-handle-outline", flexProd, activeProd)}
      {renderTab("custom", "Custom", "cube", "cube-outline", flexCust, activeCust)}
      {renderTab("services", "Services", "construct", "construct-outline", flexServ, activeServ)}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { position: "absolute", bottom: 20, left: 20, right: 20, flexDirection: "row", borderRadius: 30, overflow: "hidden", zIndex: 10, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, height: 56, padding: 6, borderWidth: 1.5, borderColor: "rgba(85, 134, 85, 0.3)" },
  navItemContainer: { height: '100%', justifyContent: 'center', alignItems: 'center' },
  navButton: { flexDirection: 'row', width: '100%', height: '100%', justifyContent: "center", alignItems: "center", borderRadius: 25 },
  navText: { fontSize: Platform.OS === 'ios' ? 14 : 15, fontFamily: "Sen_Bold", color: "#fff" },
});