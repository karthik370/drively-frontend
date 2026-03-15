import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
          <Icon name="wallet" size={28} color="#C9A84C" />
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>₹{balance.toFixed(2)}</Text>
          <Text style={styles.balanceHint}>Add money to your wallet for faster payments</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('WalletTopup')}>
            <Icon name="plus-circle" size={22} color="#C9A84C" />
            <Text style={styles.actionText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('WalletTransactions')}>
            <Icon name="history" size={22} color="#C9A84C" />
            <Text style={styles.actionText}>Transactions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Icon name="cash" size={22} color="#8A8A8A" />
              <Text style={styles.rowText}>Cash</Text>
            </View>
            <View style={styles.row}>
              <Icon name="credit-card" size={22} color="#8A8A8A" />
              <Text style={styles.rowText}>Card</Text>
            </View>
            <View style={styles.row}>
              <Icon name="qrcode" size={22} color="#8A8A8A" />
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
    backgroundColor: '#111111',
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
    color: '#FFFFFF',
  },
  balanceCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#8A8A8A',
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  balanceHint: {
    fontSize: 12,
    color: '#8A8A8A',
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
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default CustomerWalletScreen;
