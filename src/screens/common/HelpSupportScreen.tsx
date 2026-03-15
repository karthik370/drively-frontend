import React from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { APP_CONFIG } from '../../constants/config';

const HelpSupportScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>We’re here to help</Text>
          <Text style={styles.text}>
            If you’re facing an issue with a booking, payment, driver verification, or app usage, contact us anytime.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick help</Text>
          <Text style={styles.text}>Booking not showing? Refresh the app and check internet.</Text>
          <Text style={styles.text}>Driver mode issues? Make sure you are offline before switching modes.</Text>
          <Text style={styles.text}>Payments? Verify your payment method and try again.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <TouchableOpacity
            style={styles.action}
            onPress={() => {
              Linking.openURL(`mailto:${APP_CONFIG.supportEmail}`).catch(() => undefined);
            }}
          >
            <Icon name="email" size={18} color="#C9A84C" />
            <Text style={styles.actionText}>{APP_CONFIG.supportEmail}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={() => {
              Linking.openURL(`tel:${APP_CONFIG.supportPhone}`).catch(() => undefined);
            }}
          >
            <Icon name="phone" size={18} color="#C9A84C" />
            <Text style={styles.actionText}>{APP_CONFIG.supportPhone}</Text>
          </TouchableOpacity>
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
  action: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  actionText: { color: '#1d4ed8', fontWeight: '800' },
});

export default HelpSupportScreen;
