import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  StatusBar, 
  Linking 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";


export default function TermsAndConditionsScreen() {
  const navigation = useNavigation();

  const handleEmailPress = () => {
    Linking.openURL('mailto:localboys307@gmail.com');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <View style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.lastUpdated}>Last updated: January 25, 2026</Text>

          <Text style={styles.paragraph}>
            Please read these terms and conditions carefully before using Our Service.
          </Text>

          {/* Section: Interpretation and Definitions */}
          <View style={styles.section}>
            <Text style={styles.heading}>Interpretation and Definitions</Text>
            <Text style={styles.subHeading}>Interpretation</Text>
            <Text style={styles.paragraph}>
              The words whose initial letters are capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
            </Text>
            <Text style={styles.subHeading}>Definitions</Text>
            <Text style={styles.paragraph}>For the purposes of these Terms and Conditions:</Text>
            
            <View style={styles.listContainer}>
              <Text style={styles.listItem}>
                <Text style={styles.bold}>Application:</Text> refers to Local Boys, the software program provided by the Company.
              </Text>
              <Text style={styles.listItem}>
                <Text style={styles.bold}>Company:</Text> (referred to as either "the Company", "We", "Us" or "Our") refers to Local Boys.
              </Text>
              <Text style={styles.listItem}>
                <Text style={styles.bold}>Country:</Text> refers to: Andhra Pradesh, India.
              </Text>
              <Text style={styles.listItem}>
                <Text style={styles.bold}>Service:</Text> refers to the Application.
              </Text>
              <Text style={styles.listItem}>
                <Text style={styles.bold}>You:</Text> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service.
              </Text>
            </View>
          </View>

          {/* Section: Acknowledgment */}
          <View style={styles.section}>
            <Text style={styles.heading}>Acknowledgment</Text>
            <Text style={styles.paragraph}>
              These are the Terms and Conditions governing the use of this Service and the agreement that operates between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.
            </Text>
            <Text style={styles.paragraph}>
              Your access to and use of the Service is conditioned on Your acceptance of and compliance with these Terms and Conditions. These Terms and Conditions apply to all visitors, users and others who access or use the Service.
            </Text>
            <Text style={styles.paragraph}>
              By accessing or using the Service You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Service.
            </Text>
          </View>

          {/* Section: User Accounts */}
          <View style={styles.section}>
            <Text style={styles.heading}>User Accounts</Text>
            <Text style={styles.paragraph}>
              When You create an account with Us, You must provide Us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of Your account on Our Service.
            </Text>
            <Text style={styles.paragraph}>
              You are responsible for safeguarding the password that You use to access the Service and for any activities or actions under Your password. You agree not to disclose Your password to any third party. You must notify Us immediately upon becoming aware of any breach of security or unauthorized use of Your account.
            </Text>
          </View>

          {/* Section: Content & Restrictions */}
          <View style={styles.section}>
            <Text style={styles.heading}>Prohibited Activities</Text>
            <Text style={styles.paragraph}>
              You may not access or use the Service for any purpose other than that for which We make the Service available. The Service may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by Us.
            </Text>
            <Text style={styles.paragraph}>As a user of the Service, You agree not to:</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Systematically retrieve data or other content from the Service to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from Us.</Text>
              <Text style={styles.bulletItem}>• Make any unauthorized use of the Service, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email.</Text>
              <Text style={styles.bulletItem}>• Circumvent, disable, or otherwise interfere with security-related features of the Service.</Text>
              <Text style={styles.bulletItem}>• Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.</Text>
            </View>
          </View>

          {/* Section: Intellectual Property */}
          <View style={styles.section}>
            <Text style={styles.heading}>Intellectual Property</Text>
            <Text style={styles.paragraph}>
              The Service and its original content (excluding Content provided by You or other users), features and functionality are and will remain the exclusive property of the Company and its licensors.
            </Text>
            <Text style={styles.paragraph}>
              The Service is protected by copyright, trademark, and other laws of both the Country and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of the Company.
            </Text>
          </View>

          {/* Section: Termination */}
          <View style={styles.section}>
            <Text style={styles.heading}>Termination</Text>
            <Text style={styles.paragraph}>
              We may terminate or suspend Your Account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.
            </Text>
            <Text style={styles.paragraph}>
              Upon termination, Your right to use the Service will cease immediately. If You wish to terminate Your Account, You may simply discontinue using the Service or delete your account from the settings menu.
            </Text>
          </View>

          {/* Section: Limitation of Liability */}
          <View style={styles.section}>
            <Text style={styles.heading}>Limitation of Liability</Text>
            <Text style={styles.paragraph}>
              Notwithstanding any damages that You might incur, the entire liability of the Company and any of its suppliers under any provision of this Terms and Your exclusive remedy for all of the foregoing shall be limited to the amount actually paid by You through the Service or 1000 INR if You haven't purchased anything through the Service.
            </Text>
            <Text style={styles.paragraph}>
              To the maximum extent permitted by applicable law, in no event shall the Company or its suppliers be liable for any special, incidental, indirect, or consequential damages whatsoever (including, but not limited to, damages for loss of profits, loss of data or other information, for business interruption, for personal injury, loss of privacy arising out of or in any way related to the use of or inability to use the Service).
            </Text>
          </View>

          {/* Section: Governing Law */}
          <View style={styles.section}>
            <Text style={styles.heading}>Governing Law</Text>
            <Text style={styles.paragraph}>
              The laws of Andhra Pradesh, India, excluding its conflicts of law rules, shall govern this Terms and Your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.
            </Text>
            <Text style={styles.paragraph}>
              If You have any concern or dispute about the Service, You agree to first try to resolve the dispute informally by contacting the Company.
            </Text>
          </View>

          {/* Section: Changes to Terms */}
          <View style={styles.section}>
            <Text style={styles.heading}>Changes to These Terms</Text>
            <Text style={styles.paragraph}>
              We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. If a revision is material We will make reasonable efforts to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at Our sole discretion.
            </Text>
            <Text style={styles.paragraph}>
              By continuing to access or use Our Service after those revisions become effective, You agree to be bound by the revised terms. If You do not agree to the new terms, in whole or in part, please stop using the website and the Service.
            </Text>
          </View>

          {/* Contact Us */}
          <View style={[styles.section, { borderBottomWidth: 0, marginBottom: 40 }]}>
            <Text style={styles.heading}>Contact Us</Text>
            <Text style={styles.paragraph}>If you have any questions about these Terms and Conditions, You can contact us:</Text>
            
            <TouchableOpacity onPress={handleEmailPress} style={styles.contactBox}>
              <Text style={styles.contactLabel}>By email:</Text>
              <Text style={styles.contactLink}>localboys307@gmail.com</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0e0e12",
  },
  container: {
    flex: 1,
    backgroundColor: "#0e0e12",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1f",
    backgroundColor: "#0e0e12",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ff7a00",
    fontSize: 16,
    fontFamily: "Sen_Medium",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Sen_Bold",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  lastUpdated: {
    color: "#888",
    fontSize: 13,
    fontFamily: "Sen_Regular",
    marginBottom: 20,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1f",
    paddingBottom: 15,
  },
  heading: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Sen_Bold",
    marginBottom: 12,
  },
  subHeading: {
    color: "#ff7a00",
    fontSize: 16,
    fontFamily: "Sen_Bold",
    marginTop: 10,
    marginBottom: 8,
  },
  paragraph: {
    color: "#ccc",
    fontSize: 14,
    fontFamily: "Sen_Regular",
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "justify",
  },
  listContainer: {
    marginTop: 5,
  },
  listItem: {
    color: "#ccc",
    fontSize: 14,
    fontFamily: "Sen_Regular",
    lineHeight: 22,
    marginBottom: 10,
    paddingLeft: 5,
  },
  bold: {
    color: "#fff",
    fontFamily: "Sen_Bold",
  },
  bulletList: {
    paddingLeft: 10,
    marginBottom: 12,
  },
  bulletItem: {
    color: "#ccc",
    fontSize: 14,
    fontFamily: "Sen_Regular",
    lineHeight: 24,
    marginBottom: 6,
  },
  contactBox: {
    backgroundColor: "#1a1a1f",
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  contactLabel: {
    color: "#888",
    fontSize: 14,
    fontFamily: "Sen_Regular",
    marginBottom: 4,
  },
  contactLink: {
    color: "#ff7a00",
    fontSize: 16,
    fontFamily: "Sen_Bold",
    textDecorationLine: "underline",
  },
});