import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, FlatList, Dimensions, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { auth, db } from "../firebase";
import { ref as dbRef, set, get, remove, onValue } from "firebase/database";
import Toast from "react-native-root-toast";

const { width } = Dimensions.get("window");
const CARD_PADDING = 12, CARD_GUTTER = 12, CARD_WIDTH = Math.round((width - CARD_PADDING * 2 - CARD_GUTTER) / 2);

export default function ShopDetails({ route, navigation }) {
  const { shopId, shop } = route.params || {};
  const [productsObj, setProductsObj] = useState({}), [loading, setLoading] = useState(true), [activeCategory, setActiveCategory] = useState(null),
    [adminCats, setAdminCats] = useState({}), [error, setError] = useState(null), [userCart, setUserCart] = useState({});
  const user = auth.currentUser;

  const cartShopId = Object.keys(userCart || {}).find((k) => k !== "updatedAt");
  const cartShop = cartShopId ? userCart[cartShopId] : null;
  const cartItemsCount = cartShop ? Object.keys(cartShop).filter((k) => !["shopname", "shopimage"].includes(k)).length : 0;

  const handleClearCart = async () => {
    if (!user || !cartShopId) return;
    Alert.alert("Clear Cart", "Are you sure you want to clear your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive", onPress: async () => {
          try {
            await remove(dbRef(db, `carts/${user.uid}`));
            Toast.show("Cart cleared.", { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
          } catch {
            Toast.show("Failed to clear cart.", { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
          }
        }
      },
    ]);
  };

const handleProceedCheckout = async () => {
  if (!cartShopId) return;

  const shopCart = userCart[cartShopId] || {};
  const cartItems = Object.keys(shopCart).filter(k => !["shopname", "shopimage"].includes(k)).map(k => shopCart[k]);
  
  if (!cartItems.length) return Toast.show("Cart is empty.", { duration: Toast.durations.SHORT });

  // Determine service type of items
  const hasRideService = cartItems.some(item => item.serviceType === "ride");
  const hasDeliveryService = cartItems.some(item => item.serviceType === "delivery");

  // Decide which checkout screen to navigate to
  if (hasRideService && !hasDeliveryService) {
    navigation.navigate("CheckoutScreentwo", { shopId: cartShopId, shop, cart: shopCart });
  } else if (hasDeliveryService && !hasRideService) {
    navigation.navigate("Checkout", { shopId: cartShopId, shop, cart: shopCart });
  } else {
    // Mixed items: either show alert or navigate to combined checkout
    Alert.alert(
      "Multiple Service Types",
      "Your cart contains items with different service types. Please separate them into different orders.",
      [{ text: "OK" }]
    );
  }
};



  useEffect(() => {
    if (!user) return;
    const userCartRef = dbRef(db, `carts/${user.uid}`);
    const unsub = onValue(userCartRef, (snap) => setUserCart(snap.val() || {}));
    return () => unsub();
  }, [user]);

const addToCart = async (product) => {
  if (!user) return Toast.show("Please login to add items to cart.", { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
  if (product.inStock === false) return Toast.show("Product is out of stock.", { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });

  const userCartRef = dbRef(db, `carts/${user.uid}`);
  try {
    const snapshot = await get(userCartRef);
    const cart = snapshot.val() || {}, cartShops = Object.keys(cart).filter((k) => k !== "updatedAt"), currentShopId = shopId;

    if (cartShops.length && cartShops[0] !== currentShopId) {
      Alert.alert("Cart contains items from another shop", "Do you want to clear the old cart and start a new one?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes", onPress: async () => {
            await set(userCartRef, {
              [currentShopId]: {
                shopname: shop.name,
                shopimage: shop.image,
                [product.id]: { 
                  productname: product.name, 
                  price: product.price, 
                  qty: 1,
                  serviceType: product.serviceType || null // <-- add serviceType here
                }
              },
              updatedAt: Date.now()
            });
            Toast.show(`${product.name} added to cart.`, { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
          }
        },
      ]);
      return;
    }

    const shopCart = cart[currentShopId] || { shopname: shop.name, shopimage: shop.image };
    const existingProduct = shopCart[product.id], newQty = existingProduct ? existingProduct.qty + 1 : 1;
    const updateObj = {
      [currentShopId]: {
        ...shopCart,
        [product.id]: { 
          ...existingProduct, 
          productname: product.name, 
          price: product.price, 
          qty: newQty, 
          serviceType: product.serviceType || null // <-- add serviceType here
        }
      },
      updatedAt: Date.now()
    };
    await set(userCartRef, updateObj);
    Toast.show(`${product.name} added to cart.`, { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
  } catch (err) {
    console.error(err);
    Toast.show("Failed to add product to cart.", { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
  }
};

  const removeFromCart = async (productId) => {
    if (!user) return;
    try { await remove(dbRef(db, `carts/${user.uid}/${shopId}/${productId}`)); }
    catch (err) { console.error(err); Toast.show("Failed to remove product from cart.", { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM }); }
  };

  const decreaseCartQty = async (product) => {
    if (!user) return;
    const shopCart = userCart[shopId] || {}, existingProduct = shopCart[product.id];
    if (!existingProduct) return;
    const newQty = existingProduct.qty - 1;
    if (newQty <= 0) await removeFromCart(product.id);
    else {
      const updateObj = { [shopId]: { ...shopCart, [product.id]: { ...existingProduct, qty: newQty } }, updatedAt: Date.now() };
      await set(dbRef(db, `carts/${user.uid}`), updateObj);
    }
  };

  useEffect(() => {
    if (!shopId) { setError("No shopId provided"); setLoading(false); return; }
    setLoading(true);
    const productsRef = dbRef(db, `products/${shopId}`), adminCatsRef = dbRef(db, `admin_data/categories`);
    const unsubProducts = onValue(productsRef, (snap) => { setProductsObj(snap.val() || {}); setLoading(false); }, (err) => { console.warn("products read error", err); setError("Failed to load products"); setLoading(false); });
    const unsubAdminCats = onValue(adminCatsRef, (snap) => setAdminCats(snap.val() || {}));
    return () => { unsubProducts(); unsubAdminCats(); };
  }, [shopId]);

  const productsArray = useMemo(() => Object.keys(productsObj || {}).map((pid) => ({ id: pid, ...productsObj[pid] })), [productsObj]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(productsArray.map((p) => p.category || "Other")))], [productsArray]);
  useEffect(() => { if (categories.length && !activeCategory) setActiveCategory("All"); }, [categories, activeCategory]);
  const productsByActiveCategory = useMemo(() => (!activeCategory || activeCategory === "All") ? productsArray : productsArray.filter((p) => (p.category || "Other") === activeCategory), [productsArray, activeCategory]);
  const getCategoryTheme = useCallback((catLabel) => (catLabel === "All" ? "#28A745" : adminCats[catLabel]?.Theme || "#28A745"), [adminCats]);
  const themeColor = getCategoryTheme(activeCategory);

  if (loading) return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" /></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.centered}><Text style={{ color: "#b00020" }}>{error}</Text></SafeAreaView>;
  if (!shop) return <SafeAreaView style={styles.centered}><Text style={{ color: "#333" }}>Shop not found</Text></SafeAreaView>;

  const renderHeader = () => (<>
    <View style={styles.headerRow}>
      <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={20} color="#10202A" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Shop Details</Text>
      <TouchableOpacity style={styles.iconBtn} onPress={() => Alert.alert("Menu", "Menu actions")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={18} color="#10202A" />
      </TouchableOpacity>
    </View>
    <View style={styles.bannerWrap}>
      <Image source={shop.image ? { uri: shop.image } : { uri: "https://www.trueangle.in/public/assets/img/product-default.png" }} style={styles.banner} resizeMode="cover" />
    </View>
    <View style={styles.info}>
      <Text style={styles.shopName}>{shop.name}</Text>
      <Text style={styles.shopDesc}>{shop.description || "No description available."}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}><Ionicons name="star" size={16} color="#28A745" /><Text style={styles.metaText}>{shop.rating ?? "—"}</Text></View>
        <View style={[styles.metaItem, { marginLeft: 18 }]}><MaterialIcons name="local-shipping" size={16} color="#444" /><Text style={styles.metaText}> Free</Text></View>
        <View style={[styles.metaItem, { marginLeft: 18 }]}><Ionicons name="time-outline" size={16} color="#444" /><Text style={styles.metaText}>{shop.deliveryTime ?? `${shop.avgPrepTime ?? "—"} min`}</Text></View>
      </View>
    </View>
    <View style={{ marginTop: 18 }}>
      <FlatList horizontal data={categories} keyExtractor={(item, idx) => `${item}-${idx}`} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 12 }}
        renderItem={({ item, index }) => {
          const active = activeCategory === item, catColor = getCategoryTheme(item);
          return (<TouchableOpacity onPress={() => setActiveCategory(item)} style={[styles.catChip, active && { backgroundColor: catColor, borderColor: catColor }, index === categories.length - 1 ? { marginRight: 0 } : null]} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.catLabel, active && { color: "#fff", fontFamily: "Sen_Bold" }]}>{item}</Text>
          </TouchableOpacity>);
        }} />
    </View>
    <View style={{ marginVertical: 12 }}>
      <Text style={styles.sectionHeading}>{activeCategory} <Text style={styles.sectionCount}>({productsByActiveCategory.length})</Text></Text>
    </View>
  </>);

  return (<SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <FlatList
      data={productsByActiveCategory}
      keyExtractor={(item) => item.id}
      numColumns={2}
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={{ justifyContent: "space-between", marginBottom: CARD_GUTTER }}
      contentContainerStyle={{ paddingHorizontal: CARD_PADDING, paddingBottom: 140 }}
      ListHeaderComponent={renderHeader}
      renderItem={({ item }) => {
        const shopCart = userCart[shopId] || {}, cartItem = shopCart[item.id];
        return (<View style={styles.productCard}>
          <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
          <View style={styles.productBody}>
            <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.productSubtitle} numberOfLines={1}>{item.description || "No description"}</Text>
            <Text style={styles.productquantity}>{item.quantity || "N/A"}</Text>
            <View style={styles.productRow}>
              <Text style={styles.price}>₹{item.price}</Text>
              {cartItem ? (<View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity onPress={() => decreaseCartQty(item)} style={[styles.addBtn, { marginRight: 6, backgroundColor: "#ccc" }]}>
                  <Ionicons name="remove" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={{ marginHorizontal: 4 }}>{cartItem.qty}</Text>
                <TouchableOpacity onPress={() => addToCart(item)} style={[styles.addBtn, { backgroundColor: themeColor }]}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>) : (<TouchableOpacity style={[styles.addBtn, { backgroundColor: themeColor }]} onPress={() => addToCart(item)}>
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>)}
            </View>
            {item.inStock === false && <Text style={{ color: "red", fontSize: 12, marginTop: 4 }}>Out of Stock</Text>}
          </View>
        </View>);
      }}
      ListEmptyComponent={() => <View style={{ padding: 20 }}><Text style={{ color: "#666", textAlign: "center" }}>No items in this category.</Text></View>}
    />
    {cartShop && cartItemsCount > 0 && (<View style={styles.cartBar}>
      <View style={styles.cartInfo}>
        <Image source={{ uri: cartShop.shopimage }} style={styles.cartShopImage} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cartText}>You have {cartItemsCount} {cartItemsCount > 1 ? "items" : "item"}</Text>
          <Text style={styles.cartSubText}>from {cartShop.shopname}</Text>
        </View>
        <View style={styles.cartActions}>
          <TouchableOpacity style={[styles.cartBtn, { backgroundColor: "#ccc" }]} onPress={handleClearCart}><Text style={styles.cartBtnText}>Clear</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.cartBtn, { backgroundColor: "#28A745" }]} onPress={handleProceedCheckout}><Text style={[styles.cartBtnText, { color: "#fff" }]}>Checkout</Text></TouchableOpacity>
        </View>
      </View>
    </View>)}
  </SafeAreaView>);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  headerRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 20, backgroundColor: "#f3f5f7", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Sen_Medium", color: "#10202A" },
  bannerWrap: { marginTop: 14 },
  banner: { width: "100%", height: 160, borderRadius: 18, overflow: "hidden", borderColor: "#ddd", borderWidth: 1 },
  info: { paddingHorizontal: 12, marginTop: 12 },
  shopName: { fontSize: 20, fontFamily: "Sen_Bold", color: "#0b1b22", marginBottom: 8 },
  shopDesc: { fontSize: 13, fontFamily: "Sen_Regular", color: "#9aa5ad", lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 13, fontFamily: "Sen_Medium", color: "#222", marginLeft: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", marginRight: 10, flexDirection: "row", alignItems: "center" },
  catLabel: { fontSize: 14, color: "#333", fontFamily: "Sen_Medium" },
  sectionHeading: { fontSize: 18, fontFamily: "Sen_Bold", color: "#111" },
  sectionCount: { fontSize: 16, color: "#8a98a0", fontFamily: "Sen_Regular" },
  productCard: { width: CARD_WIDTH, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#eee", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  productImage: { width: "100%", height: CARD_WIDTH * 0.6, backgroundColor: "#e6ecf0" },
  productBody: { padding: 10, minHeight: 86, justifyContent: "space-between" },
  productTitle: { fontSize: 14, fontFamily: "Sen_Bold", color: "#111" },
  productSubtitle: { fontSize: 12, fontFamily: "Sen_Regular", color: "#8a98a0", marginTop: 6 },
  productquantity: { fontSize: 12, fontFamily: "Sen_Regular", color: "#8a98a0", marginTop: 2 },
  productRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  price: { fontSize: 15, fontFamily: "Sen_Bold", color: "#222" },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  cartBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#ddd", padding: 12, paddingBottom: 23, flexDirection: "row", alignItems: "center", justifyContent: "space-between", elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cartInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  cartShopImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e6ecf0" },
  cartText: { fontSize: 14, fontFamily: "Sen_Medium", color: "#111" },
  cartSubText: { fontSize: 12, fontFamily: "Sen_Regular", color: "#666", marginTop: 2 },
  cartActions: { flexDirection: "row", alignItems: "center" },
  cartBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginLeft: 10 },
  cartBtnText: { fontSize: 14, fontFamily: "Sen_Medium", color: "#333" }
});