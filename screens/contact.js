import React, { useRef, useMemo } from "react";
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
  Dimensions 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";

// --- GORHOM BOTTOM SHEET IMPORTS ---
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// IMPORT CONTEXTS
import { useUser } from "../context/UserContext"; 
import { useAdmin } from "../context/AdminContext"; 

const { width } = Dimensions.get("window");

export default function ContactUs({ navigation }) {
    // USE CONTEXT
    const { loading: userLoading } = useUser();
    const { allBranches, activeBranchIds, loading: adminLoading } = useAdmin();
    
    // Bottom Sheet Configuration
    const bottomSheetRef = useRef(null);
    // Snap points: Starts at 75% height, can be dragged up to 95%
    const snapPoints = useMemo(() => ["75%", "95%"], []);

    // Derive active branches based on the IDs matched for the user's location/pincode
    const activeBranchesList = allBranches.filter(b => activeBranchIds.includes(b.id));

    const [fontsLoaded] = useFonts({ ...Ionicons.font });

    const handleCall = (phoneNumberString) => {
        if (!phoneNumberString) {
            Alert.alert("Error", "Contact number not available.");
            return;
        }
        const phoneNumber = phoneNumberString.replace(/[^0-9+]/g, '');
        let url = Platform.OS === "android" ? `tel:${phoneNumber}` : `telprompt:${phoneNumber}`;
        
        Linking.openURL(url).catch((err) => {
            console.error("An error occurred", err);
            Alert.alert("Error", "Unable to open dialer.");
        });
    };

    if (!fontsLoaded || userLoading || adminLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#B0E57E' }}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#B0E57E" }}>
            <StatusBar barStyle="dark-content" backgroundColor="#B0E57E" translucent={false} />
            
            <SafeAreaView style={[styles.headerSafeArea, { paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }]}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={26} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Contact Us</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* A subtle decorative background icon behind the bottom sheet */}
                <View style={styles.decorativeBg}>
                    <Ionicons name="chatbubbles-outline" size={120} color="rgba(0,0,0,0.05)" />
                </View>
            </SafeAreaView>

            {/* GORHOM BOTTOM SHEET AS THE MAIN CONTENT CONTAINER */}
            <BottomSheet
                ref={bottomSheetRef}
                index={0}
                snapPoints={snapPoints}
                backgroundStyle={styles.bottomSheetBackground}
                handleIndicatorStyle={styles.bottomSheetIndicator}
            >
                <BottomSheetScrollView 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={styles.sheetContentContainer}
                >
                    {activeBranchesList.length > 0 ? (
                        <>
                            <View style={styles.iconCircle}>
                                <Ionicons name="headset" size={60} color="#28A745" />
                            </View>
                            <Text style={styles.heading}>We're here to help!</Text>
                            <Text style={styles.subText}>
                                Call your local branch support team directly for immediate assistance.
                            </Text>

                            {activeBranchesList.map((branch, index) => {
                                const phone = branch.contactNumber;
                                return (
                                    <View key={branch.id || index} style={styles.branchCard}>
                                        <View style={styles.branchInfo}>
                                            <Text style={styles.label}>Branch</Text>
                                            <Text style={styles.branchName}>{branch.name}</Text>
                                            <Text style={styles.phoneNumber}>{phone || "Not Available"}</Text>
                                        </View>
                                        
                                        <TouchableOpacity
                                            style={[styles.callButton, !phone && styles.disabledButton]}
                                            onPress={() => handleCall(phone)}
                                            disabled={!phone}
                                        >
                                            <Ionicons name="call" size={20} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={styles.callButtonText}>CALL</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </>
                    ) : (
                        <View style={styles.emptyStateContainer}>
                            <View style={[styles.iconCircle, { backgroundColor: "#FCE8E8" }]}>
                                <Ionicons name="location-outline" size={60} color="#DC3545" />
                            </View>
                            <Text style={styles.heading}>No Branch Detected</Text>
                            <Text style={styles.subText}>
                                Currently, there are no active branches detected in your area. Service is not available at your location yet.
                            </Text>
                        </View>
                    )}
                </BottomSheetScrollView>
            </BottomSheet>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    headerSafeArea: { 
        flex: 1, 
        backgroundColor: "#B0E57E" 
    },
    headerContainer: { 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between", 
        paddingHorizontal: 20, 
        zIndex: 10
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: { 
        fontSize: 20, 
        fontFamily: "Sen_Bold", 
        color: "#000" 
    },
    decorativeBg: {
        position: 'absolute',
        top: '18%',
        alignSelf: 'center',
        zIndex: 1
    },

    // Bottom Sheet Specific Styles
    bottomSheetBackground: { 
        backgroundColor: "#fff", 
        borderTopLeftRadius: 30, 
        borderTopRightRadius: 30,
        // Optional iOS shadow for the sheet
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10
    },
    bottomSheetIndicator: { 
        backgroundColor: "#ccc", 
        width: 50, 
        height: 5,
        marginTop: 10 
    },
    sheetContentContainer: { 
        padding: 25, 
        paddingBottom: 60, 
        alignItems: "center" 
    },

    iconCircle: { 
        width: 100, 
        height: 100, 
        borderRadius: 50, 
        backgroundColor: "#F3F6FA", 
        justifyContent: "center", 
        alignItems: "center", 
        marginBottom: 20,
        marginTop: 10
    },
    heading: { 
        fontSize: 24, 
        fontFamily: "Sen_Bold", 
        color: "#323232", 
        marginBottom: 10, 
        textAlign: "center" 
    },
    subText: { 
        fontSize: 14, 
        fontFamily: "Sen_Regular", 
        color: "#9796A1", 
        textAlign: "center", 
        lineHeight: 22, 
        marginBottom: 30 
    },
    branchCard: {
        width: "100%",
        backgroundColor: "#F3F6FA",
        borderRadius: 15,
        padding: 20,
        marginBottom: 15,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    branchInfo: {
        flex: 1,
        paddingRight: 10
    },
    label: { 
        fontSize: 12, 
        fontFamily: "Sen_Regular", 
        color: "#5C5C5C", 
        textTransform: "uppercase", 
        marginBottom: 2 
    },
    branchName: {
        fontSize: 16,
        fontFamily: "Sen_Bold",
        color: "#323232",
        marginBottom: 4
    },
    phoneNumber: { 
        fontSize: 18, 
        fontFamily: "Sen_Bold", 
        color: "#000" 
    },
    callButton: { 
        flexDirection: 'row', 
        backgroundColor: "#28A745", 
        borderRadius: 12, 
        height: 50, 
        paddingHorizontal: 20,
        justifyContent: "center", 
        alignItems: "center", 
        shadowColor: "#28A745", 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.2, 
        shadowRadius: 10, 
        elevation: 3 
    },
    disabledButton: { 
        backgroundColor: "#A0A0A0", 
        shadowOpacity: 0, 
        elevation: 0 
    },
    callButtonText: { 
        fontSize: 14, 
        fontFamily: "Sen_Bold", 
        color: "#fff", 
        letterSpacing: 0.5 
    },
    emptyStateContainer: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 50,
        marginTop: 20
    }
});