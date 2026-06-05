import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

import { getWalletBalance } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';

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
        showAlert('Wallet', e?.message || 'Failed to load wallet balance');
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
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
    backgroundColor: G.bgAlt,
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
    color: G.textPrimary,
  },
  balanceCard: {
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  balanceLabel: {
    fontSize: 14,
    color: G.textSecondary,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '800',
    color: G.textPrimary,
    marginTop: 8,
  },
  balanceHint: {
    fontSize: 12,
    color: G.textSecondary,
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
    backgroundColor: G.bg,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: G.border3,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: G.textPrimary,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: G.textPrimary,
    marginBottom: 10,
  },
  card: {
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 14,
    color: G.textPrimary,
    fontWeight: '500',
  },
});

export default CustomerWalletScreen;
