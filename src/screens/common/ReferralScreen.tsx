import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const ReferralScreen = () => {
  const referralCode = useMemo(() => {
    return 'DRIVEMATE';
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Icon name="ticket-percent" size={22} color="#111827" />
          <Text style={styles.title}>Referral</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invite friends</Text>
          <Text style={styles.cardSub}>Share your code and earn rewards when your friends complete their first trip.</Text>

          <View style={styles.codeRow}>
            <Text style={styles.code}>{referralCode}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => {
              }}
            >
              <Icon name="content-copy" size={18} color="#111827" />
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.note}>
            <Icon name="information" size={16} color="#6b7280" />
            <Text style={styles.noteText}>
              Rewards will appear in your wallet once the referral is verified.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    color: '#111827',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  codeRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  code: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  copyText: {
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});

export default ReferralScreen;
