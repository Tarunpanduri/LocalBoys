import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    Platform,
    ActivityIndicator,
    StatusBar,
    Alert,
    Image,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { useFonts } from "expo-font";

const { width } = Dimensions.get("window");

export default function ContactUs({ navigation }) {
    const [contactNumber, setContactNumber] = useState("");
    const [loading, setLoading] = useState(true);

    const [fontsLoaded] = useFonts({
        ...Ionicons.font,
    });

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;

        if (user) {
            const contactRef = ref(db, `users/${user.uid}/supportcontact`);

            const unsubscribe = onValue(contactRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const number = typeof data === 'object' ? data.phone : data;
                    setContactNumber(String(number));
                }
                setLoading(false);
            }, (error) => {
                console.error("Error fetching contact:", error);
                setLoading(false);
            });

            return () => unsubscribe();
        } else {
            setLoading(false);
            Alert.alert("Error", "User not logged in");
        }
    }, []);

    const handleCall = () => {
        if (!contactNumber) {
            Alert.alert("Error", "Contact number not available yet.");
            return;
        }

        // Clean the number (keep only digits and +)
        const phoneNumber = contactNumber.replace(/[^0-9+]/g, '');

        let url = "";
        if (Platform.OS === "android") {
            url = `tel:${phoneNumber}`;
        } else {
            // iOS works better with telprompt (shows a confirmation dialog)
            url = `telprompt:${phoneNumber}`; 
        }

        // Direct openURL is more reliable than checking canOpenURL first 
        // on newer Android versions due to manifest visibility restrictions.
        Linking.openURL(url).catch((err) => {
            console.error("An error occurred", err);
            Alert.alert("Error", "Unable to open the phone dialer. Please check if your device supports making calls.");
        });
    };

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#B0E57E' }}>
                <ActivityIndicator color="#fff" />
            </View>
        );
    }

    return (
        <SafeAreaView
            style={[
                styles.container,
                { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
            ]}
        >
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#B0E57E"
                translucent={false}
            />

            <View style={styles.headerContainer}>
                <Image
                    source={require("../assets/logo.png")}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.headerTitle}>Contact Us</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.contentContainer}>
                <View style={styles.infoSection}>
                    {/* Icon / Illustration */}
                    <View style={styles.iconCircle}>
                        <Ionicons name="headset" size={60} color="#28A745" />
                    </View>

                    <Text style={styles.heading}>We're here to help!</Text>
                    <Text style={styles.subText}>
                        Have an issue or query? Call our support team directly for immediate assistance.
                    </Text>

                    <View style={styles.numberDisplay}>
                        <Text style={styles.label}>Support Number</Text>
                        {loading ? (
                            <ActivityIndicator color="#28A745" style={{ marginTop: 10 }} />
                        ) : (
                            <Text style={styles.phoneNumber}>
                                {contactNumber || "Not Available"}
                            </Text>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.callButton, (!contactNumber && !loading) && styles.disabledButton]}
                    onPress={handleCall}
                    disabled={!contactNumber || loading}
                >
                    <Ionicons name="call" size={20} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.callButtonText}>CALL SUPPORT</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#B0E57E",
    },
    headerContainer: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 35,
        gap: 10,
    },
    logo: { width: 80, height: 80 },
    headerTitle: {
        fontSize: 18,
        fontFamily: "Sen_Bold",
        color: "#000",
    },
    contentContainer: {
        flex: 1,
        backgroundColor: "#fff",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
        justifyContent: "space-between",
        paddingBottom: 90,
        marginBottom: -50,
    },
    infoSection: {
        alignItems: "center",
        marginTop: 30,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#F3F6FA",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    heading: {
        fontSize: 24,
        fontFamily: "Sen_Bold",
        color: "#323232",
        marginBottom: 10,
        textAlign: "center",
    },
    subText: {
        fontSize: 14,
        fontFamily: "Sen_Regular",
        color: "#9796A1",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 40,
    },
    numberDisplay: {
        alignItems: "center",
        width: "100%",
        padding: 20,
        backgroundColor: "#F3F6FA",
        borderRadius: 15,
    },
    label: {
        fontSize: 12,
        fontFamily: "Sen_Regular",
        color: "#5C5C5C",
        textTransform: "uppercase",
        marginBottom: 5,
    },
    phoneNumber: {
        fontSize: 22,
        fontFamily: "Sen_Bold",
        color: "#000",
    },
    callButton: {
        flexDirection: 'row',
        backgroundColor: "#28A745",
        borderRadius: 12,
        height: 60,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        shadowColor: "#28A745",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    disabledButton: {
        backgroundColor: "#A0A0A0",
        shadowOpacity: 0,
        elevation: 0,
    },
    callButtonText: {
        fontSize: 16,
        fontFamily: "Sen_Bold",
        color: "#fff",
        letterSpacing: 1,
    },
});