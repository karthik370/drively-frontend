import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { getWalletTransactions, WalletTx } from '../../services/api';

const WalletTransactionsScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<WalletTx[]>([]);

  const load = async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);

    try {
      const txs = await getWalletTransactions(50);
      setItems(txs);
    } catch (e: any) {
      Alert.alert('Wallet', e?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load('initial');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.centerText}>Loading…</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.center}>
            <Icon name="history" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptySubtitle}>Your wallet activity will appear here.</Text>
          </View>
        ) : null}

        {items.map((t) => {
          const sign = t.type === 'CREDIT' ? '+' : '-';
          const color = t.type === 'CREDIT' ? '#16a34a' : '#dc2626';
          return (
            <View key={t.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.left}>
                  <Text style={styles.reason}>{t.reason}</Text>
                  <Text style={styles.meta}>{new Date(t.createdAt).toLocaleString()}</Text>
                  <Text style={styles.meta}>Status: {t.status}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.amount, { color }]}>
                    {sign}₹{Number(t.amount || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.balance}>Bal: ₹{Number(t.balanceAfter || 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 24 },
  center: { alignItems: 'center', paddingVertical: 30 },
  centerText: { marginTop: 10, color: '#111827', fontWeight: '600' },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '800', color: '#111827' },
  emptySubtitle: { marginTop: 6, fontSize: 13, color: '#6b7280' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  left: { flex: 1, paddingRight: 10 },
  right: { alignItems: 'flex-end' },
  reason: { color: '#111827', fontWeight: '800' },
  meta: { marginTop: 4, color: '#6b7280', fontWeight: '600', fontSize: 12 },
  amount: { fontWeight: '900', fontSize: 16 },
  balance: { marginTop: 4, color: '#6b7280', fontWeight: '600', fontSize: 12 },
});

export default WalletTransactionsScreen;
