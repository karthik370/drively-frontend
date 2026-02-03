import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { createMembershipOrder, getCurrentMembership, listMembershipPlans, MembershipPlan, verifyMembershipPurchase } from '../../services/api';
import { openRazorpayCheckout } from '../../services/razorpayService';
import { useAppSelector } from '../../redux/store';

const MembershipScreen = ({ navigation }: any) => {
  const user = useAppSelector((s) => s.auth.user);

  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [isPaying, setIsPaying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listMembershipPlans(), getCurrentMembership()]);
      setPlans(p);
      setCurrent(c);
    } catch (e: any) {
      Alert.alert('Membership', e?.message || 'Failed to load membership');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const currentLabel = useMemo(() => {
    const type = String(current?.membershipType || 'NONE');
    const exp = current?.membershipExpiryDate ? new Date(current.membershipExpiryDate).toLocaleDateString() : null;
    return exp ? `${type} (expires ${exp})` : type;
  }, [current]);

  const buy = async (plan: MembershipPlan) => {
    if (isPaying) return;
    setIsPaying(plan.type);
    try {
      const order = await createMembershipOrder(plan.type, 'UPI');
      const success = await openRazorpayCheckout({
        orderId: String(order.orderId),
        amountPaise: Number(order.amount),
        currency: String(order.currency || 'INR'),
        name: 'DriveMate',
        description: `Membership: ${plan.title}`,
        prefill: {
          contact: user?.phoneNumber,
          email: user?.email,
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
        },
      });

      await verifyMembershipPurchase({ purchaseId: String(order.purchaseId), ...success });
      Alert.alert('Membership', 'Membership activated successfully');
      await load();
    } catch (e: any) {
      Alert.alert('Membership', e?.message || 'Payment failed');
    } finally {
      setIsPaying(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Current membership</Text>
          <Text style={styles.currentValue}>{currentLabel}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.centerText}>Loading plans…</Text>
          </View>
        ) : null}

        {plans.map((p) => (
          <View key={p.id} style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planTitle}>{p.title}</Text>
              <Text style={styles.planPrice}>₹{Number(p.price || 0).toFixed(0)}</Text>
            </View>
            {p.description ? <Text style={styles.planDesc}>{p.description}</Text> : null}
            <Text style={styles.planMeta}>Duration: {p.durationDays} days</Text>
            <TouchableOpacity
              style={[styles.cta, isPaying ? styles.ctaDisabled : null]}
              disabled={Boolean(isPaying)}
              onPress={() => buy(p)}
            >
              <Text style={styles.ctaText}>{isPaying === p.type ? 'Processing…' : 'Buy with Razorpay'}</Text>
            </TouchableOpacity>
          </View>
        ))}
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
  currentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  currentLabel: { color: '#6b7280', fontWeight: '700' },
  currentValue: { marginTop: 6, color: '#111827', fontWeight: '900', fontSize: 16 },
  center: { alignItems: 'center', paddingVertical: 20 },
  centerText: { marginTop: 10, color: '#111827', fontWeight: '600' },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planTitle: { color: '#111827', fontWeight: '900', fontSize: 16 },
  planPrice: { color: '#2563eb', fontWeight: '900', fontSize: 16 },
  planDesc: { marginTop: 10, color: '#111827', fontWeight: '600' },
  planMeta: { marginTop: 10, color: '#6b7280', fontWeight: '700', fontSize: 12 },
  cta: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#ffffff', fontWeight: '900' },
});

export default MembershipScreen;
