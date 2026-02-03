import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const PrivacyPolicyScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Your data, your control.</Text>
          <Text style={styles.text}>We collect only what is required to provide the service.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What we collect</Text>
          <Text style={styles.text}>Account details (name, phone).</Text>
          <Text style={styles.text}>Location data during trip and while driver is online (for matching and safety).</Text>
          <Text style={styles.text}>Documents/selfie for driver verification.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How we use it</Text>
          <Text style={styles.text}>To match bookings, show live tracking, and compute fares.</Text>
          <Text style={styles.text}>To prevent fraud and improve safety.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sharing</Text>
          <Text style={styles.text}>Customer and driver see each other’s limited info during active bookings.</Text>
          <Text style={styles.text}>We do not sell your personal data.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  content: { padding: 16, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: '#111827' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  text: { marginTop: 8, color: '#374151', fontWeight: '700', lineHeight: 20 },
});

export default PrivacyPolicyScreen;
