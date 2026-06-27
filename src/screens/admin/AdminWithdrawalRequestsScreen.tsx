import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
  getAdminPendingPayouts,
  adminApprovePayout,
  adminRejectPayout,
} from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

interface PayoutItem {
  payoutId: string;
  amount: number;
  status: string;
  createdAt: string;
  driverName: string;
  driverPhone: string;
  payoutMethod: 'UPI' | 'BANK';
  upiId: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankAccountHolderName: string | null;
}

const AdminWithdrawalRequestsScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getAdminPendingPayouts();
      setItems(Array.isArray(res) ? res : []);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load withdrawal requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = (item: PayoutItem) => {
    const methodLine = item.payoutMethod === 'UPI'
      ? `UPI: ${item.upiId}`
      : `Bank: ${item.bankAccountHolderName} — ****${item.bankAccountNumber?.slice(-4)} (${item.bankIfscCode})`;

    Alert.alert(
      'Confirm Approval',
      `Transfer Rs.${item.amount.toFixed(0)} to ${item.driverName}?\n\n${methodLine}\n\nMake sure you have already sent the money before tapping Done.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Done - Transferred',
          style: 'default',
          onPress: async () => {
            setProcessingId(item.payoutId);
            try {
              await adminApprovePayout(item.payoutId);
              showAlert('Approved', `Rs.${item.amount.toFixed(0)} payout for ${item.driverName} marked as completed. Driver notified.`);
              setItems(prev => prev.filter(p => p.payoutId !== item.payoutId));
            } catch (e: any) {
              showAlert('Error', e?.message || 'Failed to approve payout');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = (item: PayoutItem) => {
    Alert.alert(
      'Reject Withdrawal',
      `Reject Rs.${item.amount.toFixed(0)} request from ${item.driverName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.payoutId);
            try {
              await adminRejectPayout(item.payoutId, 'Rejected by admin');
              showAlert('Rejected', `Withdrawal for ${item.driverName} rejected. Driver notified.`);
              setItems(prev => prev.filter(p => p.payoutId !== item.payoutId));
            } catch (e: any) {
              showAlert('Error', e?.message || 'Failed to reject payout');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const callDriver = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const renderItem = ({ item }: { item: PayoutItem }) => {
    const isProcessing = processingId === item.payoutId;
    const dateStr = new Date(item.createdAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Icon name="account" size={22} color="#C9A84C" />
          </View>
          <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
            <Text style={styles.driverName} numberOfLines={1}>{item.driverName}</Text>
            <TouchableOpacity onPress={() => callDriver(item.driverPhone)} style={styles.phoneRow}>
              <Icon name="phone" size={12} color="#10b981" />
              <Text style={styles.driverPhone}>{item.driverPhone}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.amountBadge}>
            <Text style={styles.amountText}>Rs.{item.amount.toFixed(0)}</Text>
          </View>
        </View>

        <View style={styles.methodBox}>
          {item.payoutMethod === 'UPI' ? (
            <View style={styles.methodRow}>
              <Icon name="qrcode" size={16} color="#C9A84C" style={{ marginRight: 6 }} />
              <Text style={styles.methodLabel}>UPI</Text>
              <Text style={styles.methodValue} numberOfLines={1}>{item.upiId || '-'}</Text>
            </View>
          ) : (
            <>
              <View style={styles.methodRow}>
                <Icon name="bank" size={16} color="#C9A84C" style={{ marginRight: 6 }} />
                <Text style={styles.methodLabel}>Bank</Text>
                <Text style={styles.methodValue} numberOfLines={1}>{item.bankAccountHolderName || '-'}</Text>
              </View>
              <View style={styles.methodRow}>
                <Icon name="credit-card" size={14} color="#6b7280" style={{ marginRight: 6, marginLeft: 2 }} />
                <Text style={styles.methodSub}>
                  {'****'}{item.bankAccountNumber?.slice(-4) || '----'}{'  |  '}{item.bankIfscCode || '-'}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.metaRow}>
          <Icon name="clock-outline" size={12} color="#6b7280" style={{ marginRight: 4 }} />
          <Text style={styles.dateText}>{dateStr}</Text>
          <View style={[styles.statusPill, item.status === 'PROCESSING' && styles.statusPillProcessing]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        {isProcessing ? (
          <View style={styles.actionsRow}>
            <ActivityIndicator size="small" color="#C9A84C" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
              <Icon name="close-circle" size={16} color="#ef4444" />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
              <Icon name="check-circle" size={16} color="#fff" />
              <Text style={styles.approveBtnText}>Done - Mark Paid</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Withdrawal Requests</Text>
          {items.length > 0 && (
            <Text style={styles.subtitle}>{items.length} pending</Text>
          )}
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => void load(true)}>
          <Icon name="refresh" size={22} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C9A84C" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <FlatList
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={5}
          data={items}
          keyExtractor={(it) => it.payoutId}
          contentContainerStyle={items.length ? styles.list : styles.listEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#C9A84C" />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Icon name="bank-check" size={56} color="#374151" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySub}>Withdrawal requests from drivers will appear here</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: G.border2,
    backgroundColor: G.glass2,
  },
  backBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: G.glass3,
  },
  title: { color: G.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#C9A84C', fontSize: 12, fontWeight: '600', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: G.textSecondary, fontSize: 14 },
  list: { padding: 16, gap: 12 },
  listEmpty: { flex: 1, justifyContent: 'center', padding: 24 },
  emptyCard: { alignItems: 'center', gap: 12 },
  emptyTitle: { color: G.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySub: { color: G.textSecondary, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: G.glass2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: G.border2,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  driverName: { color: G.textPrimary, fontSize: 15, fontWeight: '700' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  driverPhone: { color: '#10b981', fontSize: 12, fontWeight: '600' },
  amountBadge: {
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#C9A84C',
  },
  amountText: { color: '#C9A84C', fontSize: 18, fontWeight: '800' },
  methodBox: {
    backgroundColor: G.glass3, borderRadius: 10,
    padding: 12, gap: 6,
  },
  methodRow: { flexDirection: 'row', alignItems: 'center' },
  methodLabel: { color: G.textSecondary, fontSize: 12, fontWeight: '700', width: 36 },
  methodValue: { color: G.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  methodSub: { color: G.textSecondary, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: G.textSecondary, fontSize: 12, flex: 1 },
  statusPill: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  statusPillProcessing: { backgroundColor: 'rgba(59,130,246,0.15)' },
  statusText: { color: '#C9A84C', fontSize: 10, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: '#ef4444',
  },
  rejectBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  approveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#10b981',
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  processingText: { color: G.textSecondary, fontSize: 13, marginLeft: 8 },
});

export default AdminWithdrawalRequestsScreen;

