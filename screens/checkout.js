import React, { useEffect, useState,useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, StatusBar, Platform,Animated,Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import Toast from "react-native-root-toast";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

// Utils
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const SkeletonItem = ({ width, height, style, borderRadius = 4, baseColor, highlightColor }) => {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [width]);

  return (
    <View
      style={[
        {
          width: width,
          height: height,
          backgroundColor: baseColor,
          borderRadius: borderRadius,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[baseColor, highlightColor, baseColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>
    </View>
  );
};

const CheckoutSkeleton = () => {
  // Config for Dark Mode area (Top)
  const darkBase = "#1a1a1f";
  const darkHigh = "#2a2a2f";

  // Config for Light Mode area (Bottom Sheet)
  const lightBase = "#f0f0f0";
  const lightHigh = "#ffffff";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        
        {/* Top Section - Address (Dark Theme) */}
        <View style={{ marginTop: 40, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <SkeletonItem width={120} height={14} baseColor={darkBase} highlightColor={darkHigh} />
            <SkeletonItem width={40} height={14} baseColor={darkBase} highlightColor={darkHigh} />
          </View>
          {/* Address Box */}
          <View style={{ backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 }}>
            <SkeletonItem width={150} height={18} baseColor="#2a2a2f" highlightColor="#3a3a3f" style={{ marginBottom: 8 }} />
            <SkeletonItem width="90%" height={14} baseColor="#2a2a2f" highlightColor="#3a3a3f" style={{ marginBottom: 6 }} />
            <SkeletonItem width="60%" height={14} baseColor="#2a2a2f" highlightColor="#3a3a3f" />
          </View>
        </View>

        {/* Bottom Sheet Simulation (Light Theme) */}
        <View style={[styles.bottomSheet, { height: height * 0.65, justifyContent: 'flex-start' }]}>
           {/* Items Section */}
           <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <SkeletonItem width={100} height={16} baseColor={lightBase} highlightColor={lightHigh} />
                <SkeletonItem width={60} height={14} baseColor={lightBase} highlightColor={lightHigh} />
              </View>

              {/* Item Rows */}
              {[1, 2].map((i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                  <View>
                    <SkeletonItem width={140} height={16} baseColor={lightBase} highlightColor={lightHigh} style={{ marginBottom: 6 }} />
                    <SkeletonItem width={50} height={12} baseColor={lightBase} highlightColor={lightHigh} />
                  </View>
                  <SkeletonItem width={60} height={16} baseColor={lightBase} highlightColor={lightHigh} />
                </View>
              ))}

              {/* Coupon Section */}
              <View style={{ marginTop: 10, marginBottom: 20 }}>
                 <SkeletonItem width={80} height={16} baseColor={lightBase} highlightColor={lightHigh} style={{ marginBottom: 10 }} />
                 <View style={{ flexDirection: 'row' }}>
                    <SkeletonItem width="75%" height={45} baseColor={lightBase} highlightColor={lightHigh} style={{ marginRight: 10, borderRadius: 8 }} />
                    <SkeletonItem width="20%" height={45} baseColor={lightBase} highlightColor={lightHigh} style={{ borderRadius: 8 }} />
                 </View>
              </View>

              {/* Summary Section */}
              <View style={{ backgroundColor: "#f9f9f9", padding: 16, borderRadius: 12 }}>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <SkeletonItem width={60} height={14} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
                    <SkeletonItem width={40} height={14} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
                 </View>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <SkeletonItem width={60} height={14} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
                    <SkeletonItem width={40} height={14} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
                 </View>
                 <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 8 }} />
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <SkeletonItem width={80} height={18} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
                    <SkeletonItem width={60} height={18} baseColor="#e0e0e0" highlightColor="#f0f0f0" />
                 </View>
              </View>
           </View>

           {/* Bottom Bar Simulation */}
           <View style={[styles.bottomBar, { position: 'absolute', bottom: 0, width: '100%' }]}>
              <View>
                 <SkeletonItem width={40} height={12} baseColor={lightBase} highlightColor={lightHigh} style={{ marginBottom: 4 }} />
                 <SkeletonItem width={80} height={20} baseColor={lightBase} highlightColor={lightHigh} />
              </View>
              <SkeletonItem width={140} height={45} baseColor={lightBase} highlightColor={lightHigh} borderRadius={10} />
           </View>
        </View>

      </View>
    </SafeAreaView>
  );
};

const calculateCommission = (subtotal, shopCommission, isPremiumOrder = false) => {
  if (isPremiumOrder) {
    return Math.ceil(subtotal * 0.00001); // 0.001% for premium
  }
  return Math.ceil(subtotal * (shopCommission / 100)); // Use actual shop commission
};

export default function CheckoutScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { shopId: paramShopId, shop: paramShop, cart: paramCart } = route.params || {};
  
  // State
  const [shop, setShop] = useState(null);
  const [shopId, setShopId] = useState(paramShopId);
  const [cart, setCart] = useState(() => {
    if (!paramCart) return null;
    const cleanCart = {};
    Object.keys(paramCart).forEach((k) => {
      if (paramCart[k] && typeof paramCart[k] === "object") {
        cleanCart[k] = { 
          price: paramCart[k].price, 
          qty: paramCart[k].qty, 
          productname: paramCart[k].productname 
        };
      }
    });
    return cleanCart;
  });
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("COD");
  const [transactionId, setTransactionId] = useState("");
  const [platformFee, setPlatformFee] = useState(10);
  const [total, setTotal] = useState(0);
  const [deliveryChargePerKm, setDeliveryChargePerKm] = useState(5);
  const [subtotal, setSubtotal] = useState(0);
  const [restaurantTotal, setRestaurantTotal] = useState(0);
  const [shopCommission, setShopCommission] = useState(15); // Will be updated from shop data
  const [qrImage, setQrImage] = useState("");
  
  const user = auth.currentUser;
  const isPremiumOrder = subtotal > 10000;

  // Load all data including shop commission
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const finalShopId = shopId || route.params?.shopId;
        
        if (!finalShopId) {
          throw new Error("Shop ID not found");
        }

        // Load shop data first to get commission
        const shopSnap = await get(ref(db, `shops/${finalShopId}`));
        if (!shopSnap.exists()) {
          throw new Error("Shop not found");
        }

        const shopData = shopSnap.val();
        const shopCommissionValue = Number(shopData.commission) || 15;
        
        const finalShop = { 
          id: finalShopId, 
          name: shopData.name, 
          image: shopData.image, 
          phone: shopData.phone || "",
          location: shopData.location ? { 
            lat: shopData.location.lat, 
            lng: shopData.location.lng 
          } : null,
          commission: shopCommissionValue,
          qrImage: shopData.qr || ""
        };
        setQrImage(finalShop.qrImage);

        // Load cart data
        let finalCart = cart;
        if (!finalCart && user?.uid) {
          const cartSnap = await get(ref(db, `carts/${user.uid}/${finalShopId}`));
          if (cartSnap.exists()) {
            const cartData = cartSnap.val();
            finalCart = {};
            Object.keys(cartData).forEach((k) => { 
              if (cartData[k] && typeof cartData[k] === "object") {
                finalCart[k] = { 
                  price: cartData[k].price, 
                  qty: cartData[k].qty, 
                  productname: cartData[k].productname 
                }; 
              }
            });
          }
        }

        // Load user and admin data
        const [userSnap, adminSnap] = await Promise.all([
          get(ref(db, `users/${user.uid}`)),
          get(ref(db, `admin_data/general`))
        ]);

        let fetchedUser = null;
        let deliveryCharge = deliveryChargePerKm;

        if (userSnap.exists()) {
          const u = userSnap.val();
          fetchedUser = { 
            uid: user.uid, 
            firstName: u.firstName, 
            lastName: u.lastName, 
            name: u.name, 
            phone: u.phone,
            mobile: u.mobile, 
            email: u.email 
          };
          
          if (u.mainAddressId && u.addresses && u.addresses[u.mainAddressId]) {
            const main = u.addresses[u.mainAddressId];
            fetchedUser.location = { 
              area: main.area, 
              city: main.city, 
              state: main.state, 
              pincode: main.pincode, 
              formattedAddress: main.formattedAddress, 
              lat: main.lat, 
              lng: main.lng, 
              updatedAt: main.updatedAt 
            };
          } else if (u.location) {
            fetchedUser.location = { 
              area: u.location.area, 
              city: u.location.city, 
              state: u.location.state, 
              pincode: u.location.pincode, 
              formattedAddress: u.location.formattedAddress, 
              lat: u.location.lat, 
              lng: u.location.lng, 
              updatedAt: u.location.updatedAt 
            };
          }
        }

        if (adminSnap.exists()) { 
          const adminData = adminSnap.val(); 
          if (adminData.deliveryChargePerKm) {
            deliveryCharge = adminData.deliveryChargePerKm; 
          }
          setDeliveryChargePerKm(deliveryCharge); 
        }

        // Calculate pricing
        if (fetchedUser && finalCart && finalShop?.location) {
          const calculatedSubtotal = Object.keys(finalCart)
            .filter((k) => k.startsWith("productId"))
            .reduce((s, pid) => s + finalCart[pid].price * finalCart[pid].qty, 0);
          
          setSubtotal(calculatedSubtotal);

          const calculatedPlatformFee = isPremiumOrder ? 
            Math.ceil(calculatedSubtotal * 0.00001) : 10;
          setPlatformFee(calculatedPlatformFee);

          // Calculate delivery fee
          const uLat = Number(fetchedUser.location?.lat);
          const uLng = Number(fetchedUser.location?.lng);
          const sLat = Number(finalShop.location?.lat);
          const sLng = Number(finalShop.location?.lng);
          
          if (!isNaN(uLat) && !isNaN(uLng) && !isNaN(sLat) && !isNaN(sLng)) {
            const distanceKm = getDistanceInKm(sLat, sLng, uLat, uLng) * 1.3; 
            const baseFee = 20;
            let fee = isPremiumOrder ? 0 : baseFee + distanceKm * deliveryCharge;
            setDeliveryFee(Math.ceil(fee));
          } else {
            setDeliveryFee(0);
          }
        }

        // Set all state at once
        setShop(finalShop);
        setCart(finalCart);
        setUserData(fetchedUser);
        setShopCommission(shopCommissionValue); // This is crucial - set commission AFTER shop is loaded
        

      } catch (error) {
        console.error("Checkout load error:", error);
        Toast.show("Failed to load checkout data", { 
          duration: Toast.durations.SHORT,
          position: Toast.positions.BOTTOM
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.uid, shopId]);

  // Calculate totals when dependencies change
  useEffect(() => {
    if (!cart || !shopCommission) return;

    const calculatedSubtotal = Object.keys(cart)
      .filter((k) => k.startsWith("productId"))
      .reduce((s, pid) => s + cart[pid].price * cart[pid].qty, 0);
    
    setSubtotal(calculatedSubtotal);

    const calculatedPlatformFee = isPremiumOrder ? 
      Math.ceil(calculatedSubtotal * 0.00001) : 10;
    setPlatformFee(calculatedPlatformFee);

    const finalTotal = calculatedSubtotal - discount + deliveryFee + calculatedPlatformFee;
    setTotal(finalTotal);

    // Calculate restaurant payout using ACTUAL shop commission
    const platformCommission = calculateCommission(calculatedSubtotal, shopCommission, isPremiumOrder);
    const restaurantPayout = calculatedSubtotal - platformCommission;
    setRestaurantTotal(Math.ceil(restaurantPayout));



  }, [cart, discount, deliveryFee, shopCommission, isPremiumOrder]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
      return;
    }

    try {
      const couponSnap = await get(ref(db, `admin_data/general/coupons/${shopId}/${couponCode}`));
      if (couponSnap.exists()) {
        const discountValue = couponSnap.val();
        setDiscount(discountValue);
        Toast.show(`Discount applied: ₹${discountValue}`, { duration: Toast.durations.SHORT });
      } else {
        Toast.show("Invalid coupon code", { duration: Toast.durations.SHORT });
      }
    } catch (error) {
      console.error("Coupon error:", error);
      Toast.show("Failed to apply coupon", { duration: Toast.durations.SHORT });
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Toast.show("Please login to place an order", { duration: Toast.durations.SHORT });
      navigation.navigate("HomeScreen");
      return;
    }

    if (paymentMode === "Online" && !transactionId.trim()) {
      Toast.show("Enter transaction ID", { duration: Toast.durations.SHORT });
      return;
    }

    try {
      setPlacingOrder(true);

      const cleanItems = {};
      Object.keys(cart)
        .filter((k) => k.startsWith("productId"))
        .forEach((pid) => {
          if (cart[pid].price && cart[pid].qty) {
            cleanItems[pid] = {
              price: cart[pid].price,
              qty: cart[pid].qty,
              productname: cart[pid].productname || "Product"
            };
          }
        });

      const platformCommission = calculateCommission(subtotal, shopCommission, isPremiumOrder);
      const driverPayout = Math.ceil(deliveryFee);
      const platformCommissionRate = isPremiumOrder ? 0.00001 : shopCommission / 100;

      const orderData = {
        shopId,
        shopname: shop?.name || "Unknown Shop",
        shopimage: shop?.image || "",
        shopphone: shop?.phone || "",
        items: cleanItems,
        subtotal: Math.ceil(subtotal),
        discount: Math.ceil(discount),
        deliveryFee: Math.ceil(deliveryFee),
        platformFee,
        total: Math.ceil(total),
        paymentMode,
        transactionId: paymentMode === "Online" ? transactionId.trim() : null,
        address: userData?.location?.formattedAddress || "No address",
        customerName: userData?.firstName || "Customer",
        customerPhone: userData?.mobile || "",
        customerEmail: user?.email || "",
        status: "pending",
        createdAt: Date.now(),
        
        restaurantPayout: {
          restaurantTotal,
          platformCommission,
          netPayout: restaurantTotal,
          calculationBreakdown: {
            subtotal: Math.ceil(subtotal),
            platformCommissionRate,
            shopCommissionRate: shopCommission / 100,
            finalRestaurantAmount: restaurantTotal,
            isPremiumOrder
          }
        },
        
        driverPayout,
        
        calculationMetadata: {
          deliveryChargePerKm,
          freeDeliveryThreshold: 1000000,
          baseDeliveryFee: 20,
          platformFee,
          isPremiumOrder,
          userLocation: userData?.location,
          shopLocation: shop?.location,
          calculatedAt: Date.now(),
          shopCommission,
          driverPayout,
        },
      };


      const newOrderRef = push(ref(db, `orders/${user.uid}`));
      await set(newOrderRef, orderData);
      await remove(ref(db, `carts/${user.uid}/${shopId}`));
      
      navigation.replace("OrderConfirmation", {
        orderData: {
          order: { id: newOrderRef.key, ...orderData },
          message: "Order placed successfully"
        }
      });

    } catch (error) {
      console.error("❌ Order error:", error);
      Toast.show("Failed to place order. Please try again.", {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  // Render loading
  if (loading) {
    return (
      <CheckoutSkeleton />
    );
  }

  // Render empty cart
  if (!cart || Object.keys(cart).filter((k) => k.startsWith("productId")).length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No items in cart.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back to Shop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const products = Object.keys(cart)
    .filter((k) => k.startsWith("productId"))
    .map((pid) => cart[pid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
          <View style={[styles.section, { marginTop: 40 }]}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
              <TouchableOpacity onPress={() => navigation.navigate("HomeScreen")}>
                <Text style={styles.editText}>EDIT</Text>
              </TouchableOpacity>
            </View>
            {userData?.location ? (
              <View style={styles.addressBox}>
                <Text style={styles.username}>{userData.firstName} {userData.lastName}</Text>
                <Text style={styles.addressText}>{userData.location.formattedAddress}</Text>
                <Text style={styles.addressSub}>
                  {userData.location.city}, {userData.location.state} - {userData.location.pincode}
                </Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>No address found</Text>
            )}
          </View>
          
        </ScrollView>

        <View style={styles.bottomSheet}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {isPremiumOrder && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>🎉 PREMIUM ORDER - Free Delivery & Low Platform Fee</Text>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitletwo}>YOUR ITEMS</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text style={styles.editText}>EDIT ITEMS</Text>
                </TouchableOpacity>
              </View>
              {products.map((item, idx) => (
                <View key={idx} style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productname}</Text>
                    <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectiontwo}>
              <Text style={styles.sectionTitletwo}>COUPON</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Enter code"
                  placeholderTextColor="#aaa"
                  value={couponCode}
                  onChangeText={setCouponCode}
                />
                <TouchableOpacity style={styles.applyBtn} onPress={applyCoupon}>
                  <Text style={styles.applyText}>APPLY</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{Math.ceil(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-₹{Math.ceil(discount)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <View style={styles.feeContainer}>
                  {isPremiumOrder && <Text style={styles.premiumFeeNote}>(0.001%)</Text>}
                  <Text style={styles.summaryValue}>₹{platformFee}</Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <View style={styles.feeContainer}>
                  {isPremiumOrder && <Text style={styles.freeDeliveryNote}>FREE</Text>}
                  <Text style={styles.summaryValue}>{isPremiumOrder ? "₹0" : `₹${Math.ceil(deliveryFee)}`}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalText}>TOTAL</Text>
                <Text style={styles.totalValue}>₹{Math.ceil(total)}</Text>
              </View>
            </View>

            <View style={styles.sectiontwo}>
              <Text style={styles.sectionTitletwo}>PAYMENT MODE</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, paymentMode === "COD" && styles.activeMode]}
                  onPress={() => setPaymentMode("COD")}
                >
                  <Text style={[styles.modeText, paymentMode === "COD" && styles.activeModeText]}>
                    CASH ON DELIVERY
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, paymentMode === "Online" && styles.activeMode]}
                  onPress={() => setPaymentMode("Online")}
                >
                  <Text style={[styles.modeText, paymentMode === "Online" && styles.activeModeText]}>
                    PAY ONLINE
                  </Text>
                </TouchableOpacity>
              </View>
              {paymentMode === "Online" && (
                <View style={styles.onlineBox}>
                  {qrImage ? (
                    <Image source={{ uri: qrImage }} style={styles.qrImage} />
                  ) : (
                    <Text style={styles.noQrText}>QR code not available</Text>
                  )}
                  <TextInput
                    style={styles.transactionInput}
                    placeholder="Enter Transaction ID"
                    placeholderTextColor="#999"
                    value={transactionId}
                    onChangeText={setTransactionId}
                  />
                  <Text style={styles.qrNote}>
                    Scan the QR to pay, then enter your transaction ID.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>₹{Math.ceil(total)}</Text>
              {isPremiumOrder && (
                <Text style={styles.premiumSavings}>
                  You save ₹{Math.ceil(deliveryFee + (10 - platformFee))} on this order!
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.orderBtn, placingOrder && styles.orderBtnDisabled]}
              onPress={handlePlaceOrder}
              disabled={placingOrder}
            >
              {placingOrder ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.orderText}>PLACE ORDER</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Keep your existing styles - they are good
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0e0e12" },
  container: { flex: 1, backgroundColor: "#0e0e12" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0e0e12" },
  emptyText: { color: "#aaa", fontSize: 15, fontFamily: "Sen_Regular" },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectiontwo: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: "#fff", fontSize: 14, fontFamily: "Sen_Medium", marginBottom: 10, opacity: 0.9, marginLeft: 3 },
  sectionTitletwo: { color: "#0e0e12", fontSize: 14, fontFamily: "Sen_Medium", marginBottom: 5, opacity: 0.9, marginLeft: 3 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editText: { color: "#ff7a00", fontSize: 13, fontFamily: "Sen_Medium" },
  addressBox: { backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 },
  username: { color: "#fff", fontSize: 16, fontFamily: "Sen_Bold", marginBottom: 4 },
  addressText: { color: "#fff", fontSize: 14, fontFamily: "Sen_Regular" },
  addressSub: { color: "#888", fontSize: 13, marginTop: 4, fontFamily: "Sen_Regular" },
  commissionInfo: { backgroundColor: "#2a2a2f", padding: 12, borderRadius: 8, marginTop: 10 },
  commissionText: { color: "#ff7a00", fontSize: 14, fontFamily: "Sen_Medium" },
  commissionSubtext: { color: "#aaa", fontSize: 12, fontFamily: "Sen_Regular", marginTop: 2 },
  bottomSheet: { position: "absolute", bottom: Platform.OS === "ios" ? -40 : -20, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 10, paddingBottom: Platform.OS === "ios" ? 34 : 26, overflow: "hidden" },
  premiumBadge: { backgroundColor: "#28a745", padding: 10, alignItems: "center", marginHorizontal: 16, marginTop: 10, borderRadius: 8 },
  premiumBadgeText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 12 },
  itemCard: { backgroundColor: "#f5f5f5", padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  itemInfo: { flex: 1 },
  itemName: { color: "#0e0e12", fontSize: 15, fontFamily: "Sen_Medium" },
  itemQty: { color: "#555", marginTop: 4, fontFamily: "Sen_Regular" },
  itemPrice: { color: "#0e0e12", fontWeight: "600", fontSize: 15 },
  couponRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  couponInput: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, color: "#0e0e12", fontFamily: "Sen_Regular" },
  applyBtn: { backgroundColor: "#ff7a00", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginLeft: 8 },
  applyText: { color: "#fff", fontFamily: "Sen_Medium" },
  summaryCard: { backgroundColor: "#f5f5f5", padding: 16, borderRadius: 12, marginVertical: 10, marginHorizontal: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { color: "#555", fontSize: 14, fontFamily: "Sen_Regular" },
  summaryValue: { color: "#0e0e12", fontSize: 14, fontFamily: "Sen_Regular" },
  discountText: { color: "#28a745" },
  feeContainer: { flexDirection: "row", alignItems: "center" },
  premiumFeeNote: { fontSize: 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Regular" },
  freeDeliveryNote: { fontSize: 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 },
  totalText: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
  totalValue: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize: 15 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop:2, marginBottom: 20 },
  modeBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4 },
  activeMode: { backgroundColor: "#ff7a00" },
  modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize: 13 },
  activeModeText: { color: "#fff" },
  onlineBox: { alignItems: "center", paddingBottom: 20 },
  qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 },
  transactionInput: { backgroundColor: "#f0f0f0", color: "#0e0e12", borderRadius: 8, width: "90%", padding: 10, marginBottom: 8, fontFamily: "Sen_Regular" },
  qrNote: { fontSize: 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" },
  bottomBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#ddd", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  totalLabel: { color: "#555", fontSize: 12, fontFamily: "Sen_Regular" },
  totalAmount: { color: "#0e0e12", fontSize: 18, fontFamily: "Sen_Bold" },
  premiumSavings: { color: "#28a745", fontSize: 10, fontFamily: "Sen_Regular", marginTop: 2 },
  orderBtn: { backgroundColor: "#ff7a00", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  orderBtnDisabled: { backgroundColor: "#ccc" },
  orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 14 },
  backButton: { backgroundColor: "#ff7a00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  backButtonText: { color: "#fff", fontFamily: "Sen_Medium", fontSize: 14 },
});