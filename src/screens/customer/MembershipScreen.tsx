import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { createMembershipOrder, getCurrentMembership, listMembershipPlans, MembershipPlan, verifyMembershipPurchase } from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
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
      const success = await openCashfreeCheckout({
        orderId: String(order.orderId),
        paymentSessionId: String(order.paymentSessionId),
      });

      await verifyMembershipPurchase({ purchaseId: String(order.purchaseId), cf_order_id: success.orderId });
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
          <Icon name="arrow-left" size={22} color="#C9A84C" />
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
            <ActivityIndicator size="small" color="#C9A84C" />
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
              <Text style={styles.ctaText}>{isPaying === p.type ? 'Processing…' : 'Buy Now'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 24 },
  currentCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  currentLabel: { color: '#8A8A8A', fontWeight: '700' },
  currentValue: { marginTop: 6, color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  center: { alignItems: 'center', paddingVertical: 20 },
  centerText: { marginTop: 10, color: '#FFFFFF', fontWeight: '600' },
  planCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  planPrice: { color: '#C9A84C', fontWeight: '900', fontSize: 16 },
  planDesc: { marginTop: 10, color: '#FFFFFF', fontWeight: '600' },
  planMeta: { marginTop: 10, color: '#8A8A8A', fontWeight: '700', fontSize: 12 },
  cta: {
    marginTop: 14,
    backgroundColor: '#C9A84C',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#ffffff', fontWeight: '900' },
});

export default MembershipScreen;
