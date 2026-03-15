import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const TermsScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>MateDrive Terms</Text>
          <Text style={styles.text}>By using MateDrive, you agree to follow these basic terms.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service usage</Text>
          <Text style={styles.text}>Provide correct details during signup and verification.</Text>
          <Text style={styles.text}>Do not misuse the app or attempt fraudulent bookings.</Text>
          <Text style={styles.text}>Respect customers and follow local traffic laws.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payments & cancellations</Text>
          <Text style={styles.text}>Fares are calculated based on distance/time and pricing rules.</Text>
          <Text style={styles.text}>Cancellation policies may apply depending on booking stage.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.text}>You are responsible for your account security.</Text>
          <Text style={styles.text}>We may suspend accounts for policy violations.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  text: { marginTop: 8, color: '#CCCCCC', fontWeight: '700', lineHeight: 20 },
});

export default TermsScreen;
