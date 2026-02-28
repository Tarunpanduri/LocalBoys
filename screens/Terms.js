import React, { useEffect, useState, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  StatusBar, 
  Linking,
  Animated,
  Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get("window");

// --- ☁️ YOUR HOSTED JSON URL ---
// Host a file here so you can update terms without app store submissions!
const TERMS_CDN_URL = "https://localboys-new.web.app/terms.json";

// --- 🛡️ FALLBACK DATA (Used if offline on first launch) ---
const FALLBACK_TERMS = {
  lastUpdated: "January 25, 2026",
  intro: "Please read these terms and conditions carefully before using Our Service.",
  contactEmail: "localboys307@gmail.com",
  sections: [
    {
      heading: "Interpretation and Definitions",
      subHeading: "Interpretation",
      paragraphs: [
        "The words whose initial letters are capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural."
      ],
      list: [
        { bold: "Application:", text: " refers to Local Boys, the software program provided by the Company." },
        { bold: "Company:", text: " (referred to as either \"the Company\", \"We\", \"Us\" or \"Our\") refers to Local Boys." },
        { bold: "Country:", text: " refers to: Andhra Pradesh, India." },
        { bold: "Service:", text: " refers to the Application." },
        { bold: "You:", text: " means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service." }
      ]
    },
    {
      heading: "Acknowledgment",
      paragraphs: [
        "These are the Terms and Conditions governing the use of this Service and the agreement that operates between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.",
        "Your access to and use of the Service is conditioned on Your acceptance of and compliance with these Terms and Conditions. These Terms and Conditions apply to all visitors, users and others who access or use the Service.",
        "By accessing or using the Service You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Service."
      ]
    },
    {
      heading: "User Accounts",
      paragraphs: [
        "When You create an account with Us, You must provide Us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of Your account on Our Service.",
        "You are responsible for safeguarding the password that You use to access the Service and for any activities or actions under Your password. You agree not to disclose Your password to any third party. You must notify Us immediately upon becoming aware of any breach of security or unauthorized use of Your account."
      ]
    },
    {
      heading: "Prohibited Activities",
      paragraphs: [
        "You may not access or use the Service for any purpose other than that for which We make the Service available. The Service may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by Us.",
        "As a user of the Service, You agree not to:"
      ],
      bullets: [
        "Systematically retrieve data or other content from the Service to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from Us.",
        "Make any unauthorized use of the Service, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email.",
        "Circvent, disable, or otherwise interfere with security-related features of the Service.",
        "Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools."
      ]
    },
    {
      heading: "Termination",
      paragraphs: [
        "We may terminate or suspend Your Account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.",
        "Upon termination, Your right to use the Service will cease immediately. If You wish to terminate Your Account, You may simply discontinue using the Service or delete your account from the settings menu."
      ]
    }
  ]
};

// --- SKELETON COMPONENT ---
const SkeletonItem = ({ width, height, style, borderRadius = 4 }) => {
  const translateX = useRef(new Animated.Value(-width)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(translateX, { toValue: width, duration: 1000, useNativeDriver: true })).start();
  }, [width]);
  return (
    <View style={[{ width, height, backgroundColor: "#1a1a1f", borderRadius, overflow: "hidden" }, style]}>
      <Animated.View style={{ width: "100%", height: "100%", transform: [{ translateX }] }}>
        <LinearGradient colors={["transparent", "rgba(255, 255, 255, 0.05)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "100%", height: "100%" }} />
      </Animated.View>
    </View>
  );
};

const TermsSkeleton = () => (
  <View style={styles.scrollContent}>
    <SkeletonItem width={180} height={14} style={{ marginBottom: 20 }} />
    <SkeletonItem width="100%" height={14} style={{ marginBottom: 6 }} />
    <SkeletonItem width="80%" height={14} style={{ marginBottom: 30 }} />
    {[1, 2, 3].map((i) => (
      <View key={i} style={styles.section}>
        <SkeletonItem width={200} height={20} style={{ marginBottom: 12 }} />
        <SkeletonItem width="100%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonItem width="100%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonItem width="90%" height={14} style={{ marginBottom: 12 }} />
      </View>
    ))}
  </View>
);

export default function TermsAndConditionsScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- CDN FETCH LOGIC ---
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        // 1. Load instantly from cache if available
        const cached = await AsyncStorage.getItem('localboys_terms');
        if (cached) setData(JSON.parse(cached));

        // 2. Fetch fresh from CDN
        const response = await fetch(TERMS_CDN_URL, { cache: 'no-store' });
        if (response.ok) {
          const freshData = await response.json();
          setData(freshData);
          await AsyncStorage.setItem('localboys_terms', JSON.stringify(freshData));
        } else if (!cached) {
          setData(FALLBACK_TERMS);
        }
      } catch (error) {
        console.warn("Failed to fetch terms from CDN, using fallback", error);
        if (!data) setData(FALLBACK_TERMS); // Offline & no cache
      } finally {
        setLoading(false);
      }
    };

    fetchTerms();
  }, []);

  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {loading && !data ? (
            <TermsSkeleton />
          ) : (
            <>
              <Text style={styles.lastUpdated}>Last updated: {data?.lastUpdated}</Text>
              
              {data?.intro && <Text style={styles.paragraph}>{data.intro}</Text>}

              {/* --- DYNAMIC SECTIONS RENDERER --- */}
              {data?.sections?.map((section, index) => (
                <View key={index} style={styles.section}>
                  <Text style={styles.heading}>{section.heading}</Text>
                  
                  {section.subHeading && (
                    <Text style={styles.subHeading}>{section.subHeading}</Text>
                  )}
                  
                  {section.paragraphs?.map((para, pIdx) => (
                    <Text key={`p-${pIdx}`} style={styles.paragraph}>{para}</Text>
                  ))}

                  {/* Bullet Points */}
                  {section.bullets && (
                    <View style={styles.bulletList}>
                      {section.bullets.map((bullet, bIdx) => (
                        <Text key={`b-${bIdx}`} style={styles.bulletItem}>• {bullet}</Text>
                      ))}
                    </View>
                  )}

                  {/* Highlighted Lists (e.g. Interpretation List) */}
                  {section.list && (
                    <View style={styles.listContainer}>
                      {section.list.map((item, lIdx) => (
                        <Text key={`l-${lIdx}`} style={styles.listItem}>
                          <Text style={styles.bold}>{item.bold}</Text>{item.text}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}

              {/* Dynamic Contact Us */}
              {data?.contactEmail && (
                <View style={[styles.section, { borderBottomWidth: 0, marginBottom: 40 }]}>
                  <Text style={styles.heading}>Contact Us</Text>
                  <Text style={styles.paragraph}>If you have any questions about these Terms and Conditions, You can contact us:</Text>
                  
                  <TouchableOpacity onPress={() => handleEmailPress(data.contactEmail)} style={styles.contactBox}>
                    <Text style={styles.contactLabel}>By email:</Text>
                    <Text style={styles.contactLink}>{data.contactEmail}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0e0e12" },
  container: { flex: 1, backgroundColor: "#0e0e12" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1a1f", backgroundColor: "#0e0e12" },
  backButton: { padding: 8, borderRadius: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Sen_Bold" },
  scrollContent: { padding: 16, paddingBottom: 50 },
  lastUpdated: { color: "#888", fontSize: 13, fontFamily: "Sen_Regular", marginBottom: 20, fontStyle: "italic" },
  section: { marginBottom: 25, borderBottomWidth: 1, borderBottomColor: "#1a1a1f", paddingBottom: 15 },
  heading: { color: "#fff", fontSize: 20, fontFamily: "Sen_Bold", marginBottom: 12 },
  subHeading: { color: "#ff7a00", fontSize: 16, fontFamily: "Sen_Bold", marginTop: 10, marginBottom: 8 },
  paragraph: { color: "#ccc", fontSize: 14, fontFamily: "Sen_Regular", lineHeight: 22, marginBottom: 12, textAlign: "justify" },
  listContainer: { marginTop: 5 },
  listItem: { color: "#ccc", fontSize: 14, fontFamily: "Sen_Regular", lineHeight: 22, marginBottom: 10, paddingLeft: 5 },
  bold: { color: "#fff", fontFamily: "Sen_Bold" },
  bulletList: { paddingLeft: 10, marginBottom: 12 },
  bulletItem: { color: "#ccc", fontSize: 14, fontFamily: "Sen_Regular", lineHeight: 24, marginBottom: 6 },
  contactBox: { backgroundColor: "#1a1a1f", padding: 16, borderRadius: 12, marginTop: 10, alignItems: "center", borderWidth: 1, borderColor: "#333" },
  contactLabel: { color: "#888", fontSize: 14, fontFamily: "Sen_Regular", marginBottom: 4 },
  contactLink: { color: "#ff7a00", fontSize: 16, fontFamily: "Sen_Bold", textDecorationLine: "underline" },
});