import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { getWalletBalance } from '../../services/api';

const CustomerWalletScreen = ({ navigation }: any) => {
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    getWalletBalance()
      .then((b) => {
        if (!alive) return;
        setBalance(Number(b.balance || 0));
      })
      .catch((e: any) => {
        if (!alive) return;
        Alert.alert('Wallet', e?.message || 'Failed to load wallet balance');
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Wallet</Text>
          <Icon name="wallet" size={28} color="#111827" />
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>₹{balance.toFixed(2)}</Text>
          <Text style={styles.balanceHint}>Add money to your wallet for faster payments</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('WalletTopup')}>
            <Icon name="plus-circle" size={22} color="#2563eb" />
            <Text style={styles.actionText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('WalletTransactions')}>
            <Icon name="history" size={22} color="#2563eb" />
            <Text style={styles.actionText}>Transactions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Icon name="cash" size={22} color="#6b7280" />
              <Text style={styles.rowText}>Cash</Text>
            </View>
            <View style={styles.row}>
              <Icon name="credit-card" size={22} color="#6b7280" />
              <Text style={styles.rowText}>Card</Text>
            </View>
            <View style={styles.row}>
              <Icon name="qrcode" size={22} color="#6b7280" />
              <Text style={styles.rowText}>UPI</Text>
            </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  balanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  balanceHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
});

export default CustomerWalletScreen;
