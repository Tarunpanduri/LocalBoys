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
const PRIVACY_CDN_URL = "https://localboys-new.web.app/privacy.json";

// --- 🛡️ FALLBACK DATA (Matches your provided text) ---
const FALLBACK_PRIVACY = {
  lastUpdated: "January 25, 2026",
  intro: "This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.",
  contactEmail: "localboys307@gmail.com",
  sections: [
    {
      heading: "Interpretation and Definitions",
      subHeading: "Definitions",
      paragraphs: ["For the purposes of this Privacy Policy:"],
      list: [
        { bold: "Account:", text: " means a unique account created for You to access our Service." },
        { bold: "Application:", text: " refers to Local Boys." },
        { bold: "Personal Data:", text: " is any information that relates to an identified or identifiable individual." }
      ]
    },
    {
      heading: "Collecting and Using Your Personal Data",
      smallHeading: "Personal Data",
      paragraphs: ["While using Our Service, We may ask You to provide Us with certain personally identifiable information:"],
      bullets: ["Email address", "First name and last name", "Phone number", "Location Data"]
    },
    {
      heading: "Retention of Your Personal Data",
      paragraphs: ["The Company will retain Your Personal Data only for as long as is necessary:"],
      list: [
        { bold: "User Accounts:", text: " Retained for the duration of relationship plus 24 months." },
        { bold: "Chat transcripts:", text: " Up to 24 months." }
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

const PrivacySkeleton = () => (
  <View style={styles.scrollContent}>
    <SkeletonItem width={180} height={14} style={{ marginBottom: 20 }} />
    <SkeletonItem width="100%" height={14} style={{ marginBottom: 6 }} />
    {[1, 2, 3].map((i) => (
      <View key={i} style={styles.section}>
        <SkeletonItem width={200} height={20} style={{ marginBottom: 12 }} />
        <SkeletonItem width="100%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonItem width="90%" height={14} style={{ marginBottom: 12 }} />
      </View>
    ))}
  </View>
);

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const cached = await AsyncStorage.getItem('localboys_privacy');
        if (cached) setData(JSON.parse(cached));

        const response = await fetch(PRIVACY_CDN_URL, { cache: 'no-store' });
        if (response.ok) {
          const freshData = await response.json();
          setData(freshData);
          await AsyncStorage.setItem('localboys_privacy', JSON.stringify(freshData));
        } else if (!cached) {
          setData(FALLBACK_PRIVACY);
        }
      } catch (error) {
        if (!data) setData(FALLBACK_PRIVACY);
      } finally {
        setLoading(false);
      }
    };
    fetchPrivacy();
  }, []);

  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {loading && !data ? (
            <PrivacySkeleton />
          ) : (
            <>
              <Text style={styles.lastUpdated}>Last updated: {data?.lastUpdated}</Text>
              <Text style={styles.paragraph}>{data?.intro}</Text>

              {data?.sections?.map((section, index) => (
                <View key={index} style={styles.section}>
                  <Text style={styles.heading}>{section.heading}</Text>
                  
                  {section.subHeading && <Text style={styles.subHeading}>{section.subHeading}</Text>}
                  {section.smallHeading && <Text style={styles.smallHeading}>{section.smallHeading}</Text>}
                  
                  {section.paragraphs?.map((para, pIdx) => (
                    <Text key={`p-${pIdx}`} style={styles.paragraph}>{para}</Text>
                  ))}

                  {section.bullets && (
                    <View style={styles.bulletList}>
                      {section.bullets.map((bullet, bIdx) => (
                        <Text key={`b-${bIdx}`} style={styles.bulletItem}>• {bullet}</Text>
                      ))}
                    </View>
                  )}

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

              {data?.contactEmail && (
                <View style={[styles.section, { borderBottomWidth: 0, marginBottom: 40 }]}>
                  <Text style={styles.heading}>Contact Us</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1a1f" },
  backButton: { padding: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Sen_Bold" },
  scrollContent: { padding: 16, paddingBottom: 50 },
  lastUpdated: { color: "#888", fontSize: 13, fontStyle: "italic", marginBottom: 20 },
  section: { marginBottom: 25, borderBottomWidth: 1, borderBottomColor: "#1a1a1f", paddingBottom: 15 },
  heading: { color: "#fff", fontSize: 20, fontFamily: "Sen_Bold", marginBottom: 12 },
  subHeading: { color: "#ff7a00", fontSize: 16, fontFamily: "Sen_Bold", marginTop: 10, marginBottom: 8 },
  smallHeading: { color: "#fff", fontSize: 15, fontFamily: "Sen_Bold", marginTop: 8, marginBottom: 4, textDecorationLine: "underline" },
  paragraph: { color: "#ccc", fontSize: 14, lineHeight: 22, marginBottom: 12, textAlign: "justify" },
  listItem: { color: "#ccc", fontSize: 14, lineHeight: 22, marginBottom: 10 },
  bold: { color: "#fff", fontFamily: "Sen_Bold" },
  bulletList: { paddingLeft: 10, marginBottom: 12 },
  bulletItem: { color: "#ccc", fontSize: 14, lineHeight: 24, marginBottom: 6 },
  contactBox: { backgroundColor: "#1a1a1f", padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#333" },
  contactLabel: { color: "#888", fontSize: 14, marginBottom: 4 },
  contactLink: { color: "#ff7a00", fontSize: 16, fontFamily: "Sen_Bold", textDecorationLine: "underline" },
});