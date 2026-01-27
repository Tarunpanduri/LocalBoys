import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, StatusBar, Platform, Modal, FlatList, Animated, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import Toast from "react-native-root-toast";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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


export default function CheckoutTwoScreen() {
  const route = useRoute(), navigation = useNavigation();
  const { shopId: paramShopId, shop: paramShop, cart: paramCart } = route.params || {};
  const [qrImage, setQrImage] = useState("");
  const [shop, setShop] = useState(paramShop || null);
  const [shopId, setShopId] = useState(paramShopId);
  const [cart, setCart] = useState(() => {
    if (!paramCart) return null;
    const cleanCart = {};
    Object.keys(paramCart).forEach((k) => {
      if (paramCart[k] && typeof paramCart[k] === "object") cleanCart[k] = {
        price: paramCart[k].price, qty: paramCart[k].qty, productname: paramCart[k].productname
      };
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
  const [pickupAddress, setPickupAddress] = useState(null);
  const [dropAddress, setDropAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [userAddresses, setUserAddresses] = useState([]);
  const [shopCommission, setShopCommission] = useState(15);

  const user = auth.currentUser;
  const isPremiumOrder = subtotal > 10000;

  // Single useEffect to handle ALL data loading and calculations
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const finalShopId = shopId || route.params?.shopId;
        if (!finalShopId) return;

        // Load shop data FIRST to get commission
        const shopSnap = await get(ref(db, `shops/${finalShopId}`));
        let finalShop = shop;
        let commissionValue = 15;

        if (shopSnap.exists()) {
          const shopData = shopSnap.val();
          commissionValue = Number(shopData.commission) || 15;

          finalShop = {
            id: finalShopId,
            name: shopData.name,
            image: shopData.image,
            location: shopData.location,
            commission: commissionValue,
            qrImage: shopData.qr || ""
          };
        }

        setQrImage(finalShop.qrImage || "");

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
        const addresses = [];
        let activePickupAddress = pickupAddress; // Local variable for calculation

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

          if (u.addresses) {
            Object.keys(u.addresses).forEach(addressId => {
              addresses.push({ id: addressId, ...u.addresses[addressId] });
            });
          }

          if (u.mainAddressId && u.addresses?.[u.mainAddressId]) {
            const main = u.addresses[u.mainAddressId];
            activePickupAddress = { id: u.mainAddressId, ...main }; // Store locally
            setPickupAddress(activePickupAddress); // Update state
            fetchedUser.location = main;
          }
        }

        if (adminSnap.exists()) {
          const adminData = adminSnap.val();
          if (adminData.deliveryChargePerKm) {
            setDeliveryChargePerKm(adminData.deliveryChargePerKm);
          }
        }

        // Calculate everything AFTER all data is loaded
        if (finalCart) {
          const calculatedSubtotal = Object.keys(finalCart)
            .filter(k => k.startsWith("productId"))
            .reduce((sum, pid) => sum + finalCart[pid].price * finalCart[pid].qty, 0);

          setSubtotal(calculatedSubtotal);

          // Calculate platform fee
          const calculatedPlatformFee = calculatedSubtotal > 10000 ?
            Math.ceil(calculatedSubtotal * 0.00001) : 10;
          setPlatformFee(calculatedPlatformFee);

          // --- FIX START: Calculate Delivery Fee Locally ---
          let calculatedDeliveryFee = 0;

          if (activePickupAddress && dropAddress) {
            const pLat = Number(activePickupAddress.lat), pLng = Number(activePickupAddress.lng);
            const dLat = Number(dropAddress.lat), dLng = Number(dropAddress.lng);

            if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng)) {
              const distanceKm = getDistanceInKm(pLat, pLng, dLat, dLng) * 1.3;
              const fee = calculatedSubtotal > 10000 ? 0 : 20 + distanceKm * deliveryChargePerKm;
              calculatedDeliveryFee = Math.ceil(fee);
            }
          }

          // Update delivery fee state
          setDeliveryFee(calculatedDeliveryFee);
          // --- FIX END ---

          // Calculate totals using the LOCAL `calculatedDeliveryFee`
          const finalTotal = calculatedSubtotal - discount + calculatedDeliveryFee + calculatedPlatformFee;
          setTotal(finalTotal);

          // Calculate restaurant payout
          const platformCommission = calculatedSubtotal > 10000 ?
            Math.ceil(calculatedSubtotal * 0.00001) :
            Math.ceil(calculatedSubtotal * (commissionValue / 100));

          const restaurantPayout = calculatedSubtotal - platformCommission;
          setRestaurantTotal(Math.ceil(restaurantPayout));
        }

        // Set remaining state
        setShop(finalShop);
        setCart(finalCart);
        setUserData(fetchedUser);
        setUserAddresses(addresses);
        setShopCommission(commissionValue);

      } catch (e) {
        console.error("Checkout load error:", e);
        Toast.show("Failed to load checkout data", { duration: Toast.durations.SHORT });
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [user?.uid, shopId, dropAddress, discount]);

  const applyCoupon = async () => {
    if (!couponCode) {
      Toast.show("Enter a coupon code", { duration: Toast.durations.SHORT });
      return;
    }
    const couponSnap = await get(ref(db, `admin_data/general/coupons/${shopId}/${couponCode}`));
    if (couponSnap.exists()) {
      setDiscount(couponSnap.val());
      Toast.show(`Discount applied: ₹${couponSnap.val()}`, { duration: Toast.durations.SHORT });
    } else {
      Toast.show("Invalid coupon code", { duration: Toast.durations.SHORT });
    }
  };

  const handleSelectDropAddress = (address) => {
    setDropAddress(address);
    setShowAddressModal(false);
    // The useEffect will trigger automatically due to [dropAddress] dependency
    // and recalculate the fees and total correctly now.
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Toast.show("Please login to place an order", { duration: Toast.durations.SHORT });
      navigation.navigate("HomeScreen");
      return;
    }
    if (!dropAddress) {
      Toast.show("Please select a drop address", { duration: Toast.durations.SHORT });
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
        .filter(k => k.startsWith("productId"))
        .forEach(pid => {
          if (cart[pid].price && cart[pid].qty) {
            cleanItems[pid] = {
              price: cart[pid].price,
              qty: cart[pid].qty,
              productname: cart[pid].productname || "Product"
            };
          }
        });

      const platformCommission = isPremiumOrder ?
        Math.ceil(subtotal * 0.00001) :
        Math.ceil(subtotal * (shopCommission / 100));
      const driverPayout = Math.ceil(deliveryFee);
      const platformCommissionRate = isPremiumOrder ? 0.00001 : shopCommission / 100;

      const orderData = {
        shopId,
        shopname: shop?.name || "Unknown Shop",
        shopimage: shop?.image || "",
        items: cleanItems,
        subtotal: Math.ceil(subtotal),
        discount: Math.ceil(discount),
        deliveryFee: Math.ceil(deliveryFee),
        platformFee,
        total: Math.ceil(total),
        paymentMode,
        transactionId: paymentMode === "Online" ? transactionId.trim() : null,
        pickupAddress: { ...pickupAddress, customerName: userData?.name || "Customer", customerPhone: userData?.mobile || "" },
        dropAddress: { ...dropAddress },
        customerName: userData?.name || "Customer",
        customerPhone: userData?.phone || "",
        customerEmail: user?.email || "",
        status: "pending",
        createdAt: Date.now(),
        orderType: "parcel",

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
          baseDeliveryFee: 20,
          platformFee,
          isPremiumOrder,
          pickupLocation: pickupAddress,
          dropLocation: dropAddress,
          calculatedAt: Date.now(),
          shopCommission,
          driverPayout,
        }
      };

      const newOrderRef = push(ref(db, `orders/${user.uid}`));
      await set(newOrderRef, orderData);
      await remove(ref(db, `carts/${user.uid}/${shopId}`));

      navigation.replace("OrderConfirmation", {
        orderData: {
          order: { id: newOrderRef.key, ...orderData },
          message: "Parcel order placed successfully"
        }
      });
    } catch (e) {
      console.error("❌ Order error:", e);
      Toast.show("Failed to place order. Please try again.", {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderAddressItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.addressItem, dropAddress?.id === item.id && styles.selectedAddressItem]}
      onPress={() => handleSelectDropAddress(item)}
    >
      <Text style={styles.addressItemName}>{item.name}</Text>
      <Text style={styles.addressItemText}>{item.formattedAddress}</Text>
      <Text style={styles.addressItemSub}>{item.city}, {item.state} - {item.pincode}</Text>
      {dropAddress?.id === item.id && <Text style={styles.selectedText}>Selected</Text>}
    </TouchableOpacity>
  );

  if (loading) return (
    <CheckoutSkeleton />
  );

  if (!cart || Object.keys(cart).filter(k => k.startsWith("productId")).length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>No items in cart.</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back to Shop</Text>
      </TouchableOpacity>
    </View>
  );

  const products = Object.keys(cart)
    .filter(k => k.startsWith("productId"))
    .map(pid => cart[pid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>

          <View style={[styles.section, { marginTop: 15 }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>PICKUP ADDRESS</Text>
              <TouchableOpacity onPress={() => navigation.navigate("HomeScreen")}>
                <Text style={styles.editText}>EDIT</Text>
              </TouchableOpacity>
            </View>
            {pickupAddress ? (
              <View style={styles.addressBox}>
                <Text style={styles.username}>{pickupAddress.name}</Text>
                <Text style={styles.addressText}>{pickupAddress.formattedAddress}</Text>
                <Text style={styles.addressSub}>{pickupAddress.city}, {pickupAddress.state} - {pickupAddress.pincode}</Text>
              </View>
            ) : <Text style={styles.emptyText}>No pickup address found</Text>}
          </View>

          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={[styles.sectionTitle, { marginBottom: 5, marginTop: 20 }]}>DROP ADDRESS</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                <Text style={styles.editText}>SELECT</Text>
              </TouchableOpacity>
            </View>
            {dropAddress ? (
              <View style={styles.addressBox}>
                <Text style={styles.username}>{dropAddress.name}</Text>
                <Text style={styles.addressText}>{dropAddress.formattedAddress}</Text>
                <Text style={styles.addressSub}>{dropAddress.city}, {dropAddress.state} - {dropAddress.pincode}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.selectAddressButton} onPress={() => setShowAddressModal(true)}>
                <Text style={styles.selectAddressText}>+ Select Drop Address</Text>
              </TouchableOpacity>
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
              <View style={styles.headerRowtwo}>
                <Text style={[styles.sectionTitle, { color: "black" }]}>YOUR ITEMS</Text>
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
              <Text style={[styles.sectionTitle, { color: 'black' }]}>COUPON</Text>
              <View style={styles.couponRow}>
                <TextInput style={styles.couponInput} placeholder="Enter code" placeholderTextColor="#aaa" value={couponCode} onChangeText={setCouponCode} />
                <TouchableOpacity style={styles.applyBtn} onPress={applyCoupon}>
                  <Text style={styles.applyText}>APPLY</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₹{Math.ceil(subtotal)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Discount</Text><Text style={[styles.summaryValue, styles.discountText]}>-₹{Math.ceil(discount)}</Text></View>
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
              <View style={styles.summaryRow}><Text style={styles.totalText}>TOTAL</Text><Text style={styles.totalValue}>₹{Math.ceil(total)}</Text></View>
            </View>

            <View style={styles.sectiontwo}>
              <Text style={[styles.sectionTitle, { color: 'black' }]}>PAYMENT MODE</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity style={[styles.modeBtn, paymentMode === "COD" && styles.activeMode]} onPress={() => setPaymentMode("COD")}>
                  <Text style={[styles.modeText, paymentMode === "COD" && styles.activeModeText]}>CASH ON DELIVERY</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, paymentMode === "Online" && styles.activeMode]} onPress={() => setPaymentMode("Online")}>
                  <Text style={[styles.modeText, paymentMode === "Online" && styles.activeModeText]}>PAY ONLINE</Text>
                </TouchableOpacity>
              </View>
              {paymentMode === "Online" && (
                <View style={styles.onlineBox}>
                  {qrImage ? (
                    <Image source={{ uri: qrImage }} style={styles.qrImage} />
                  ) : (
                    <View style={[styles.qrImage, { justifyContent: "center", alignItems: "center", backgroundColor: "#eee" }]}>
                      <Text style={{ color: "#999" }}>No QR Available</Text>
                    </View>
                  )}
                  <TextInput style={styles.transactionInput} placeholder="Enter Transaction ID" placeholderTextColor="#999" value={transactionId} onChangeText={setTransactionId} />
                  <Text style={styles.qrNote}>Scan the QR to pay, then enter your transaction ID.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>₹{Math.ceil(total)}</Text>
              {isPremiumOrder && <Text style={styles.premiumSavings}>You save ₹{Math.ceil(deliveryFee + (10 - platformFee))} on this order!</Text>}
            </View>
            <TouchableOpacity style={[styles.orderBtn, placingOrder && styles.orderBtnDisabled]} onPress={handlePlaceOrder} disabled={placingOrder}>
              {placingOrder ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.orderText}>PLACE ORDER</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={showAddressModal} animationType="slide" transparent onRequestClose={() => setShowAddressModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Drop Address</Text>
                <TouchableOpacity onPress={() => setShowAddressModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
              </View>
              <FlatList data={userAddresses} renderItem={renderAddressItem} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.addressList} />
              {userAddresses.length === 0 && <View style={styles.noAddresses}><Text style={styles.noAddressesText}>No addresses found</Text></View>}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// Keep your existing styles unchanged
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0e0e12" }, container: { flex: 1, backgroundColor: "#0e0e12" }, center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0e0e12" }, emptyText: { color: "#aaa", fontSize: 15, fontFamily: "Sen_Regular" }, section: { paddingHorizontal: 16 }, sectiontwo: { paddingHorizontal: 16 }, sectionTitle: { color: "#fff", fontSize:Platform.OS === 'ios' ? 11 : 14, fontFamily: "Sen_Medium", opacity: 0.9, marginLeft: 3, marginBottom: 3 }, headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, headerRowtwo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 5 }, editText: { color: "#ff7a00", fontSize:Platform.OS === 'ios' ? 11 : 13, fontFamily: "Sen_Medium" }, addressBox: { backgroundColor: "#1a1a1f", padding: 14, borderRadius: 10 }, username: { color: "#fff", fontSize:Platform.OS === 'ios' ? 12 : 16, fontFamily: "Sen_Bold", marginBottom: 4 }, addressText: { color: "#fff", fontSize:Platform.OS === 'ios' ? 10 : 14, fontFamily: "Sen_Regular" }, addressSub: { color: "#888", fontSize:Platform.OS === 'ios' ? 10 : 13, marginTop: 4, fontFamily: "Sen_Regular" }, commissionInfo: { backgroundColor: "#2a2a2f", padding: 12, borderRadius: 8, marginTop: 10 }, commissionText: { color: "#ff7a00", fontSize:Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Medium" }, commissionSubtext: { color: "#aaa", fontSize: 12, fontFamily: "Sen_Regular", marginTop: 2 }, selectAddressButton: { backgroundColor: "#2a2a2f", padding: 16, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ff7a00", borderStyle: "dashed" }, selectAddressText: { color: "#ff7a00", fontSize: 14, fontFamily: "Sen_Medium" }, bottomSheet: { position: "absolute", bottom: Platform.OS === "ios" ? -70 : -100, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 10, paddingBottom: Platform.OS === "ios" ? 34 : 96, overflow: "hidden" }, premiumBadge: { backgroundColor: "#28a745", padding: 10, alignItems: "center", marginHorizontal: 16, marginTop: 10, borderRadius: 8 }, premiumBadgeText: { color: "#fff", fontFamily: "Sen_Bold", fontSize: 12 }, itemCard: { backgroundColor: "#f5f5f5", padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" }, itemInfo: { flex: 1 }, itemName: { color: "#0e0e12", fontSize:Platform.OS === 'ios' ? 12 : 15, fontFamily: "Sen_Medium" }, itemQty: { color: "#555", marginTop: 4, fontFamily: "Sen_Regular",fontSize:Platform.OS === 'ios' ? 10 :12 }, itemPrice: { color: "#0e0e12", fontWeight: "600", fontSize:Platform.OS === 'ios' ? 12 : 15 }, couponRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 }, couponInput: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, color: "#0e0e12", fontFamily: "Sen_Regular",fontSize:Platform.OS === 'ios' ? 12 :14 }, applyBtn: { backgroundColor: "#ff7a00", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginLeft: 8 }, applyText: { color: "#fff", fontFamily: "Sen_Medium",fontSize:Platform.OS === 'ios' ? 12 :16 }, summaryCard: { backgroundColor: "#f5f5f5", padding: 16, borderRadius: 12, marginVertical: 10, marginHorizontal: 16 }, summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }, summaryLabel: { color: "#555", fontSize:Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" }, summaryValue: { color: "#0e0e12", fontSize:Platform.OS === 'ios' ? 12 : 14, fontFamily: "Sen_Regular" }, discountText: { color: "#28a745" }, feeContainer: { flexDirection: "row", alignItems: "center" }, premiumFeeNote: { fontSize: 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Regular" }, freeDeliveryNote: { fontSize: 10, color: "#28a745", marginRight: 5, fontFamily: "Sen_Bold" }, divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 8 }, totalText: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize:Platform.OS === 'ios' ? 14 : 15 }, totalValue: { color: "#0e0e12", fontFamily: "Sen_Bold", fontSize:Platform.OS === 'ios' ? 14 : 15 }, paymentRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 20 }, modeBtn: { flex: 1, backgroundColor: "#f0f0f0", borderRadius: 8, padding: 12, alignItems: "center", marginHorizontal: 4 }, activeMode: { backgroundColor: "#ff7a00" }, modeText: { color: "#0e0e12", fontFamily: "Sen_Medium", fontSize:Platform.OS === 'ios' ? 10 : 13 }, activeModeText: { color: "#fff" }, onlineBox: { alignItems: "center", paddingBottom: 20 }, qrImage: { width: 140, height: 140, marginBottom: 12, borderRadius: 8 }, transactionInput: { backgroundColor: "#f0f0f0", color: "#0e0e12", borderRadius: 8, width: "90%", padding: 10, marginBottom: 8, fontFamily: "Sen_Regular" }, qrNote: { fontSize: 12, color: "#555", textAlign: "center", fontFamily: "Sen_Regular" }, bottomBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#ddd", borderTopLeftRadius: 24, borderTopRightRadius: 24 }, totalLabel: { color: "#555", fontSize:Platform.OS === 'ios' ? 12 : 12, fontFamily: "Sen_Regular" }, totalAmount: { color: "#0e0e12", fontSize:Platform.OS === 'ios' ? 16 : 18, fontFamily: "Sen_Bold" }, premiumSavings: { color: "#28a745", fontSize: 10, fontFamily: "Sen_Regular", marginTop: 2 }, orderBtn: { backgroundColor: "#ff7a00", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 }, orderBtnDisabled: { backgroundColor: "#ccc" }, orderText: { color: "#fff", fontFamily: "Sen_Bold", fontSize:Platform.OS === 'ios' ? 12 : 14 }, backButton: { backgroundColor: "#ff7a00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 }, backButtonText: { color: "#fff", fontFamily: "Sen_Medium", fontSize: 14 }, modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "flex-end" }, modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingBottom: Platform.OS === "ios" ? 20 : 20 }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" }, modalTitle: { fontSize: 18, fontFamily: "Sen_Bold", color: "#0e0e12" }, modalClose: { fontSize: 20, color: "#666" }, addressList: { padding: 16 }, addressItem: { backgroundColor: "#f9f9f9", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#eee" }, selectedAddressItem: { backgroundColor: "#fff8f0", borderColor: "#ff7a00", borderWidth: 2 }, addressItemName: { fontSize: 16, fontFamily: "Sen_Bold", color: "#0e0e12", marginBottom: 4 }, addressItemText: { fontSize: 14, fontFamily: "Sen_Regular", color: "#333", marginBottom: 2 }, addressItemSub: { fontSize: 12, fontFamily: "Sen_Regular", color: "#666" }, selectedText: { color: "#ff7a00", fontSize: 12, fontFamily: "Sen_Medium", marginTop: 4 }, noAddresses: { padding: 40, alignItems: "center" }, noAddressesText: { color: "#999", fontSize: 16, fontFamily: "Sen_Regular" }
});