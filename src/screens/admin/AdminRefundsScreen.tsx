import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getPendingRefunds, markRefundPaid, type PendingRefundItem } from '../../services/api';

const AdminRefundsScreen = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PendingRefundItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPendingRefunds();
      setItems(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setItems([]);
      Alert.alert('Refunds', e?.message || 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="cash-refund" size={22} color="#C9A84C" />
          <Text style={styles.title}>Refunds</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => void load()}>
          <Icon name="refresh" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#C9A84C" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(it) => it.refundId}
        contentContainerStyle={items.length ? styles.list : styles.listEmpty}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No pending refunds</Text>
              <Text style={styles.emptySub}>Refunds appear here when a customer cancels after the driver has travelled 5km.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.bookingNumber ? `#${String(item.bookingNumber).slice(0, 12)}` : item.bookingId.slice(0, 8)}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {item.driverName} • {item.driverPhoneNumber}
                </Text>
              </View>
              <View style={styles.amountPill}>
                <Text style={styles.amountText}>₹{Number(item.amount || 30)}</Text>
              </View>
            </View>

            <View style={styles.upiRow}>
              <Icon name="bank" size={16} color="#1e40af" />
              <Text style={styles.upiText} numberOfLines={1}>
                {item.upiId}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => {
                Alert.alert('Mark as paid?', `Confirm refund paid to ${item.upiId}`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Paid',
                    style: 'default',
                    onPress: async () => {
                      try {
                        await markRefundPaid(item.refundId);
                        setItems((prev) => prev.filter((x) => x.refundId !== item.refundId));
                      } catch (e: any) {
                        Alert.alert('Refund', e?.message || 'Failed to mark paid');
                      }
                    },
                  },
                ]);
              }}
            >
              <Icon name="check" size={18} color="#ffffff" />
              <Text style={styles.payBtnText}>Mark Paid</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  headerRow: {
    padding: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1E1E1E' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  loadingText: { color: '#FFFFFF', fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  listEmpty: { paddingHorizontal: 16, paddingBottom: 16 },
  emptyCard: { backgroundColor: '#0A0A0A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#8A8A8A', lineHeight: 18 },
  item: { backgroundColor: '#0A0A0A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', padding: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemTitle: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  itemSub: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#8A8A8A' },
  amountPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#141414', borderWidth: 1, borderColor: '#dbeafe' },
  amountText: { fontSize: 12, fontWeight: '900', color: '#1e40af' },
  upiRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  upiText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  payBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#C9A84C',
  },
  payBtnText: { color: '#ffffff', fontWeight: '900' },
});

export default AdminRefundsScreen;
