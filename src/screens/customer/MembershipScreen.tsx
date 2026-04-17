import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

import { createMembershipOrder, getCurrentMembership, listMembershipPlans, MembershipPlan, verifyMembershipPurchase } from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
import { useAppSelector } from '../../redux/store';
import { showAlert } from '../../components/common/CustomAlert';

type BenefitItem = { icon: string; text: string; highlight?: boolean };

const PLAN_BENEFITS: Record<string, BenefitItem[]> = {
  BASIC: [
    { icon: 'tag-outline', text: '₹30 off on every ride' },
    { icon: 'infinity', text: 'Unlimited discounted rides for 30 days' },
    { icon: 'shield-check-outline', text: 'Priority customer support' },
    { icon: 'fire', text: 'Streak bonuses stack on top of membership discount' },
  ],
  PREMIUM: [
    { icon: 'crown', text: '₹50 off on every ride', highlight: true },
    { icon: 'star-circle', text: 'Free experienced driver on all bookings', highlight: true },
    { icon: 'infinity', text: 'Unlimited discounted rides for 30 days' },
    { icon: 'shield-check', text: 'Priority customer support' },
    { icon: 'fire', text: 'Streak bonuses stack on top of membership discount' },
    { icon: 'lightning-bolt', text: 'Priority driver matching' },
  ],
};

const PLAN_COLORS: Record<string, { bg: string; border: string; accent: string; badge: string }> = {
  BASIC: {
    bg: '#0A0A0A',
    border: 'rgba(59,130,246,0.3)',
    accent: '#3b82f6',
    badge: 'rgba(59,130,246,0.15)',
  },
  PREMIUM: {
    bg: '#0F0D08',
    border: 'rgba(201,168,76,0.4)',
    accent: '#C9A84C',
    badge: 'rgba(201,168,76,0.15)',
  },
};

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
      showAlert('Membership', e?.message || 'Failed to load membership');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const currentType = String(current?.membershipType || 'NONE');
  const expiryDate = current?.membershipExpiryDate ? new Date(current.membershipExpiryDate) : null;
  const isExpired = expiryDate ? expiryDate.getTime() < Date.now() : true;
  const isActive = currentType !== 'NONE' && !isExpired;

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
      showAlert('🎉 Membership Activated', `Your ${plan.title} membership is now active! You'll get discounts on every ride.`);
      await load();
    } catch (e: any) {
      showAlert('Membership', e?.message || 'Payment failed');
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
        <Text style={styles.headerTitle}>Membership Plans</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current status card */}
        <View style={[styles.statusCard, isActive && styles.statusCardActive]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={isActive ? 'crown' : 'account-outline'} size={20} color={isActive ? '#C9A84C' : '#8A8A8A'} />
            <Text style={styles.statusLabel}>Current Membership</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={[styles.statusValue, isActive && { color: G.accent }]}>
              {isActive ? `${currentType} Member` : 'No Active Plan'}
            </Text>
            {isActive && expiryDate ? (
              <Text style={styles.statusExpiry}>
                Expires {expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#C9A84C" />
            <Text style={styles.centerText}>Loading plans…</Text>
          </View>
        ) : null}

        {/* Plan cards */}
        {plans.map((p) => {
          const colors = PLAN_COLORS[p.type] || PLAN_COLORS.BASIC;
          const benefits = PLAN_BENEFITS[p.type] || [];
          const isCurrentPlan = isActive && currentType === p.type;
          const isPremium = p.type === 'PREMIUM';

          return (
            <View key={p.id} style={[styles.planCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              {/* Plan header */}
              <View style={styles.planHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={isPremium ? 'crown' : 'shield-star'} size={22} color={colors.accent} />
                    <Text style={[styles.planTitle, { color: colors.accent }]}>{p.title}</Text>
                    {isPremium ? (
                      <View style={[styles.popularBadge, { backgroundColor: colors.badge }]}>
                        <Text style={[styles.popularText, { color: colors.accent }]}>Popular</Text>
                      </View>
                    ) : null}
                  </View>
                  {p.description ? (
                    <Text style={styles.planDesc}>{p.description}</Text>
                  ) : null}
                </View>
              </View>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={[styles.planPrice, { color: colors.accent }]}>₹{Number(p.price || 0).toFixed(0)}</Text>
                <Text style={styles.pricePeriod}>/ {p.durationDays} days</Text>
              </View>

              {/* Benefits list */}
              <View style={styles.benefitsList}>
                {benefits.map((b, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, { backgroundColor: b.highlight ? colors.badge : 'rgba(255,255,255,0.05)' }]}>
                      <Icon name={b.icon as any} size={14} color={b.highlight ? colors.accent : '#8A8A8A'} />
                    </View>
                    <Text style={[styles.benefitText, b.highlight && { color: G.textPrimary, fontWeight: '700' }]}>
                      {b.text}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Savings estimate */}
              <View style={[styles.savingsRow, { backgroundColor: colors.badge }]}>
                <Icon name="calculator" size={14} color={colors.accent} />
                <Text style={[styles.savingsText, { color: colors.accent }]}>
                  {isPremium
                    ? 'Save ₹50+ per ride — pays for itself in 8 rides!'
                    : 'Save ₹30 per ride — pays for itself in 7 rides!'}
                </Text>
              </View>

              {/* CTA */}
              {isCurrentPlan ? (
                <View style={[styles.cta, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  <Icon name="check-circle" size={18} color="#10b981" />
                  <Text style={[styles.ctaText, { color: '#10b981' }]}>Active Plan</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: colors.accent }, isPaying ? styles.ctaDisabled : null]}
                  disabled={Boolean(isPaying)}
                  onPress={() => buy(p)}
                >
                  <Text style={styles.ctaText}>
                    {isPaying === p.type ? 'Processing…' : isActive ? 'Upgrade Now' : 'Get Started'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Membership Works</Text>
          <View style={styles.infoRow}>
            <Icon name="numeric-1-circle" size={20} color="#C9A84C" />
            <Text style={styles.infoText}>Choose a plan and complete payment via Cashfree</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="numeric-2-circle" size={20} color="#C9A84C" />
            <Text style={styles.infoText}>Discounts auto-apply on every ride you book</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="numeric-3-circle" size={20} color="#C9A84C" />
            <Text style={styles.infoText}>See your savings in the fare breakdown before confirming</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="refresh" size={20} color="#8A8A8A" />
            <Text style={styles.infoText}>Plan renews after expiry — upgrade anytime</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bgAlt },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: G.bg,
    borderBottomWidth: 1, borderBottomColor: G.border3,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: G.glass2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.border3,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },
  content: { padding: 16, paddingBottom: 32 },

  // Status card
  statusCard: {
    backgroundColor: G.bg, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: G.border1,
  },
  statusCardActive: { borderColor: G.borderAccent, backgroundColor: '#0F0D08' },
  statusLabel: { fontSize: 12, fontWeight: '700', color: G.textSecondary },
  statusValue: { fontSize: 16, fontWeight: '900', color: G.textPrimary },
  statusExpiry: { fontSize: 11, fontWeight: '600', color: G.textSecondary },

  center: { alignItems: 'center', paddingVertical: 20 },
  centerText: { marginTop: 10, color: G.textPrimary, fontWeight: '600' },

  // Plan card
  planCard: {
    borderRadius: 16, padding: 18, borderWidth: 1.5, marginBottom: 16,
  },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  planTitle: { fontSize: 20, fontWeight: '900' },
  popularBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  popularText: { fontSize: 10, fontWeight: '800' },
  planDesc: { marginTop: 8, fontSize: 13, color: '#BBBBBB', fontWeight: '500', lineHeight: 18 },

  // Price
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 14, marginBottom: 14 },
  planPrice: { fontSize: 32, fontWeight: '900' },
  pricePeriod: { fontSize: 14, color: G.textSecondary, fontWeight: '600' },

  // Benefits
  benefitsList: { gap: 10, marginBottom: 14 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: 13, color: '#CCCCCC', fontWeight: '600' },

  // Savings
  savingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 10, marginBottom: 14,
  },
  savingsText: { flex: 1, fontSize: 12, fontWeight: '700' },

  // CTA
  cta: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: G.textPrimary, fontWeight: '900', fontSize: 15 },

  // Info
  infoCard: {
    backgroundColor: G.bg, borderRadius: 14, padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: G.border1,
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: G.textPrimary, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#CCCCCC', fontWeight: '600' },
});

export default MembershipScreen;
