const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

setGlobalOptions({ 
  maxInstances: 10,
  timeoutSeconds: 60,
  memory: "256MiB"
});

// Initialize Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

// Helper: calculate distance in km
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: send Expo push notification
async function sendExpoNotification(expoPushToken, title, body) {
  if (!expoPushToken) return;
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ 
        to: expoPushToken, 
        sound: "default", 
        title, 
        body 
      }),
    });
    
    if (!response.ok) {
      console.error("Expo API error:", response.status);
    }
  } catch (err) {
    console.error("Error sending Expo notification:", err);
  }
}

// ✅ Callable function: placeOrder with enhanced auth handling
exports.placeOrder = onCall({ 
  cors: [
    "https://yourdomain.com",
    "http://localhost:19006",
    "exp://localhost:19000"
  ],
  region: 'us-central1'
}, async (request) => {
  console.log("placeOrder function called");
  
  // Check authentication
  if (!request.auth) {
    console.error("❌ Unauthenticated request - no auth token provided");
    console.log("Request headers:", request.rawRequest.headers);
    throw new Error("UNAUTHENTICATED");
  }

  const callerUid = request.auth.uid;
  console.log(`✅ Authenticated request from user: ${callerUid}`);

  try {
    const { userId, shopId, items, discount = 0, paymentMode, transactionId } = request.data;

    console.log("Received data:", { userId, shopId, itemsCount: Object.keys(items).length });

    // Validate request data
    if (!userId || !shopId || !items || Object.keys(items).length === 0) {
      throw new Error("Missing required order data");
    }

    // Verify that the authenticated user matches the userId in request
    if (callerUid !== userId) {
      console.error(`❌ UID mismatch: caller=${callerUid}, request=${userId}`);
      throw new Error("UNAUTHORIZED");
    }

    // Fetch user, shop, and admin settings
    const [userSnap, shopSnap, adminSnap] = await Promise.all([
      db.ref(`users/${userId}`).get(),
      db.ref(`shops/${shopId}`).get(),
      db.ref(`admin_data/general`).get(),
    ]);

    if (!userSnap.exists()) {
      throw new Error("User not found in database");
    }
    if (!shopSnap.exists()) {
      throw new Error("Shop not found in database");
    }

    const userData = userSnap.val();
    const shopData = shopSnap.val();
    const adminData = adminSnap.exists() ? adminSnap.val() : {};

    const deliveryChargePerKm = adminData.deliveryChargePerKm || 5;
    const platformFee = 10;

    // Calculate subtotal
    const subtotal = Object.keys(items).reduce(
      (sum, key) => sum + items[key].price * items[key].qty,
      0
    );

    // Calculate delivery fee
    let deliveryFee = 0;
    if (userData.location && shopData.location) {
      const distanceKm = getDistanceInKm(
        shopData.location.lat,
        shopData.location.lng,
        userData.location.lat,
        userData.location.lng
      );
      const baseFee = 20;
      const freeDeliveryThreshold = 500;
      
      deliveryFee = baseFee + distanceKm * deliveryChargePerKm;
      if (subtotal >= freeDeliveryThreshold) deliveryFee = 0;
    }

    const total = subtotal - discount + deliveryFee + platformFee;

    // Order object
    const orderData = {
      shopId,
      shopname: shopData.name || "Unknown Shop",
      shopimage: shopData.image || "",
      items,
      subtotal: Math.ceil(subtotal),
      discount: Math.ceil(discount),
      deliveryFee: Math.ceil(deliveryFee),
      platformFee,
      total: Math.ceil(total),
      paymentMode,
      transactionId: paymentMode === "Online" ? transactionId || null : null,
      address: userData.location?.formattedAddress || "No address",
      status: "pending",
      createdAt: admin.database.ServerValue.TIMESTAMP,
    };

    // Save order & clear cart
    const newOrderRef = db.ref(`orders/${userId}`).push();
    await newOrderRef.set(orderData);
    await db.ref(`carts/${userId}/${shopId}`).remove();

    // Send notification
    if (userData.expoPushToken) {
      await sendExpoNotification(
        userData.expoPushToken,
        "Order Placed Successfully",
        `Your order at ${shopData.name} has been placed! Total: ₹${Math.ceil(total)}`
      );
    }

    return { 
      success: true,
      order: { 
        id: newOrderRef.key, 
        ...orderData 
      }, 
      message: "Order placed successfully" 
    };

  } catch (error) {
    console.error("❌ Error in placeOrder function:", error);
    
    // Convert to HttpsError for proper client handling
    throw new Error(error.message || "Failed to place order");
  }
});

// Test function to verify authentication
exports.testAuth = onCall(async (request) => {
  console.log("testAuth called");
  
  if (!request.auth) {
    console.log("No authentication in testAuth");
    throw new Error("UNAUTHENTICATED");
  }
  
  return {
    success: true,
    uid: request.auth.uid,
    email: request.auth.token?.email || "No email",
    message: "Authentication successful"
  };
});