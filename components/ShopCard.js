import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image'; // 🔥 PRODUCTION IMAGE CACHING
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ShopCard = ({ shop, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.8} 
      onPress={() => onPress(shop.id, shop)}
    >
      <Image 
        source={{ uri: shop.image }} 
        style={styles.image} 
        contentFit="cover"
        transition={200} // Smooth fade-in
        cachePolicy="disk" // Prevent re-downloading
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{shop.type || shop.category}</Text>
        
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={12} color="#fc8019" />
            <Text style={styles.metaText}>{shop.rating ?? "—"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color="#666" />
            <Text style={styles.metaText}>{shop.deliveryTime ?? `${shop.avgPrepTime ?? "—"} min`}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// React.memo prevents re-rendering cards that haven't changed
export default memo(ShopCard);

const styles = StyleSheet.create({
  card: { marginTop: 14, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#eee", elevation: 2 },
  image: { width: "100%", height: Math.round(width * 0.38), backgroundColor: '#E1E9EE' },
  info: { padding: 12 },
  name: { fontSize: 16, fontFamily: "Sen_Bold", color: "#222" },
  subtitle: { fontSize: 13, color: "#8b9aa4", marginTop: 4, fontFamily: "Sen_Medium" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 15 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, color: "#444", fontFamily: "Sen_Regular" }
});