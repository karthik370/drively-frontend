import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { APP_CONFIG } from '../../constants/config';
import { G } from '../../constants/glassStyles';

const SupportScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Icon name="headset" size={22} color="#C9A84C" />
          <Text style={styles.title}>Support</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Need help?</Text>
          <Text style={styles.cardSub}>Contact us and we’ll respond as soon as possible.</Text>

          <View style={styles.actions}>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgAlt,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: G.textPrimary,
  },
  card: {
    backgroundColor: G.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border3,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: G.textPrimary,
  },
  cardSub: {
    marginTop: 6,
    fontSize: 13,
    color: G.textSecondary,
    lineHeight: 18,
  },
  actions: {
    marginTop: 12,
    gap: 10,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  actionText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
});

export default SupportScreen;
