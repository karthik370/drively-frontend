import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { getBookingDetails } from '../../services/api';
import { useAppSelector } from '../../redux/store';
import { showAlert } from '../../components/common/CustomAlert';
import { G, glass, gText } from '../../constants/glassStyles';
import { isAdminPhone } from '../../constants/adminConfig';

/* ───────────── helpers ─────────────────────────────── */
const fmt = (v: number) => `₹${Number(v || 0).toFixed(0)}`;
const fmtKm = (m: number) => `${(m / 1000).toFixed(1)} km`;
const fmtMin = (s: number) => `${Math.round(s / 60)} min`;

const statusColor = (s: string) => {
  const l = s?.toLowerCase() || '';
  if (l === 'completed') return G.success;
  if (l === 'cancelled' || l === 'failed') return G.error;
  if (l.includes('progress') || l.includes('started')) return '#3b82f6';
  return G.accent;
};

/* ───────────── component ──────────────────────────── */
const BookingDetailsScreen = ({ navigation, route }: any) => {
  const user = useAppSelector((s) => s.auth.user);
  const effectiveBookingId = String(route?.params?.bookingId || '');

  const isAdmin = useMemo(() => isAdminPhone(String((user as any)?.phoneNumber || '')), [user]);

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  const load = async () => {
    if (!effectiveBookingId) return;
    setLoading(true);
    try {
      const b = await getBookingDetails(effectiveBookingId);
      setBooking(b);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [effectiveBookingId]);

  /* derived data */
  const isViewingAsDriver = useMemo(() => {
    const userId = String((user as any)?.id || '');
    const driverId = String(booking?.driver?.id || booking?.driverId || '');
    if (userId && driverId) return userId === driverId;
    return String(user?.userType) === 'DRIVER';
  }, [booking, user]);

  const personInfo = useMemo(() => {
    const d = booking?.driver;
    const c = booking?.customer;
    const target = isViewingAsDriver ? c : d;
    const first = String(target?.firstName || '').trim();
    const last = String(target?.lastName || '').trim();
    const name = `${first} ${last}`.trim() || '—';
    const initials = `${first[0] || (isViewingAsDriver ? 'C' : 'D')}${last[0] || ''}`.toUpperCase();
    const phone = String(target?.phoneNumber || '').trim();
    const rating = !isViewingAsDriver && d?.rating ? Number(d.rating).toFixed(1) : null;
    return { name, initials, phone, rating, label: isViewingAsDriver ? 'Customer' : 'Driver' };
  }, [booking, isViewingAsDriver]);

  /* pricing breakdown — uses the actual pricingBreakdown fields from backend */
  const breakdown = useMemo(() => {
    const pb = booking?.pricingBreakdown;
    const rows: { label: string; value: string; accent?: boolean; muted?: boolean; negative?: boolean }[] = [];

    if (!pb && !booking?.totalAmount) return rows;

    // Package / Base fare
    const packagePrice = Number(pb?.packagePrice || pb?.baseAmount || pb?.baseFare || 0);
    const pkgHours = Number(pb?.packageHours || 0);
    if (packagePrice > 0) {
      rows.push({ label: pkgHours > 0 ? `Base package (${pkgHours} hr)` : 'Base fare', value: fmt(packagePrice) });
    }

    // One-way charge
    const oneWayCharge = Number(pb?.oneWayCharge || 0);
    if (oneWayCharge > 0) rows.push({ label: 'One-way charge', value: fmt(oneWayCharge) });

    // Extra km
    const extraKmCharge = Number(pb?.extraKmCharge || pb?.excessDistanceCharge || 0);
    const extraKm = Number(pb?.extraKm || 0);
    if (extraKmCharge > 0) rows.push({
      label: extraKm > 0 ? `Extra km (${extraKm.toFixed(1)} km)` : 'Extra km charges',
      value: fmt(extraKmCharge), accent: true,
    });

    // Extra time / minutes
    const extraMinuteCharge = Number(pb?.extraMinuteCharge || pb?.extraTimeCharge || pb?.excessTimeCharge || 0);
    const extraMinutes = Number(pb?.extraMinutes || 0);
    if (extraMinuteCharge > 0) rows.push({
      label: extraMinutes > 0 ? `Extra time (${extraMinutes} min)` : 'Extra time charges',
      value: fmt(extraMinuteCharge), accent: true,
    });

    // Extra hours (outstation)
    const extraHourCharge = Number(pb?.extraHourCharge || 0);
    const extraHours = Number(pb?.extraHours || 0);
    if (extraHourCharge > 0) rows.push({
      label: extraHours > 0 ? `Extra hours (${extraHours} hr)` : 'Extra hour charges',
      value: fmt(extraHourCharge), accent: true,
    });

    // Return km (round trip)
    const extraReturnKmCharge = Number(pb?.extraReturnKmCharge || pb?.returnFare || pb?.returnTripCharge || 0);
    if (extraReturnKmCharge > 0) rows.push({ label: 'Return distance charge', value: fmt(extraReturnKmCharge) });

    // Night charge
    const nightCharge = Number(pb?.nightCharge || pb?.nightSurcharge || 0);
    if (nightCharge > 0) rows.push({ label: 'Night charge (10PM–6AM)', value: fmt(nightCharge), accent: true });

    // Experienced driver fee
    const experiencedFee = Number(booking?.experiencedDriverFee || pb?.experiencedDriverFee || 0);
    if (experiencedFee > 0) rows.push({ label: 'Experienced driver fee', value: fmt(experiencedFee) });

    // Surge
    const surge = Number(pb?.surgeCharge || pb?.surgeAmount || 0);
    if (surge > 0) rows.push({ label: 'Surge pricing', value: fmt(surge), accent: true });

    // Taxes & fees
    const taxesFee = Number(pb?.taxesFee || pb?.convenienceFee || pb?.taxes || 0);
    if (taxesFee > 0) rows.push({ label: 'Taxes & convenience fee', value: fmt(taxesFee) });

    // Fallback: if nothing parsed, show trip fare
    if (rows.length === 0) {
      const fallback = Number(pb?.subtotal || booking?.fare || booking?.totalAmount || 0);
      if (fallback > 0) rows.push({ label: 'Trip Fare', value: fmt(fallback) });
    }

    // ── DISCOUNTS ──────────────────────────────────────────────────────────
    // Drivers don't need to see the customer's promo/membership/streak savings.
    // Those are platform-absorbed discounts — irrelevant to driver earnings.
    // Drivers only see the platform subsidy (what was topped up to their wallet).
    // Customers see all discount breakdown lines.
    if (!isViewingAsDriver) {
      const promoDiscount = Number(pb?.discounts?.promoDiscount || 0);
      if (promoDiscount > 0) rows.push({ label: 'Promo / coupon discount', value: `-${fmt(promoDiscount)}`, negative: true });

      const membershipDiscount = Number(pb?.discounts?.membershipDiscount || pb?.membershipDiscount || 0);
      const membershipType = String(pb?.discounts?.membershipType || '').trim();
      if (membershipDiscount > 0) rows.push({
        label: membershipType ? `${membershipType} plan discount` : 'Membership discount',
        value: `-${fmt(membershipDiscount)}`,
        negative: true,
      });

      const streakDiscount = Number(pb?.discounts?.streakDiscount || 0);
      const streakRides = Number(pb?.discounts?.streakRides || 0);
      const streakPct = Number(pb?.discounts?.streakPct || 0);
      if (streakDiscount > 0) rows.push({
        label: streakRides > 0
          ? `Streak discount (${streakRides} rides${streakPct > 0 ? `, ${streakPct}% off` : ''})`
          : 'Streak discount',
        value: `-${fmt(streakDiscount)}`,
        negative: true,
      });

      const walletUsed = Number(pb?.walletDeduction || booking?.walletAmountUsed || 0);
      if (walletUsed > 0) rows.push({ label: 'Wallet applied', value: `-${fmt(walletUsed)}`, negative: true });
    }

    // For drivers: show platform subsidy as a positive line item (green)
    if (isViewingAsDriver) {
      const subsidy = Number(pb?.platformSubsidy ?? pb?.discounts?.platformSubsidy ?? 0);
      const earnings = Number(booking?.driverEarnings || 0);
      const customerPays = Number(booking?.totalAmount || 0);
      const computedSubsidy = subsidy > 0 ? subsidy : Math.max(0, Math.round((earnings - customerPays) * 100) / 100);
      if (computedSubsidy > 0) {
        rows.push({
          label: '💚 Platform subsidy',
          value: `+${fmt(computedSubsidy)}`,
          negative: true, // renders green (reusing "negative" = green color convention)
        });
      }
    }


    return rows;
  }, [booking, isViewingAsDriver]);

  const totalAmount = Number(booking?.totalAmount || 0);
  const isCompleted = String(booking?.status || '').toUpperCase() === 'COMPLETED';

  /* ─── render ──────────────────────────────────────── */
  if (loading && !booking) {
    return (
      <SafeAreaView style={s.screen} edges={['top','bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={G.accent} />
          <Text style={[gText.body, { marginTop: 12 }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top','bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={24} color={G.accent} />
        </TouchableOpacity>
        <Text style={gText.h3}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        {booking ? (
          <View style={s.statusCard}>
            <View style={[s.statusBadge, { backgroundColor: statusColor(booking.status) + '20' }]}>
              <View style={[s.statusDot, { backgroundColor: statusColor(booking.status) }]} />
              <Text style={[s.statusText, { color: statusColor(booking.status) }]}>{String(booking.status)}</Text>
            </View>
            <Text style={s.bookingNumber}>#{String(booking.bookingNumber || '').slice(0, 12)}</Text>
            <Text style={s.bookingDate}>
              {booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : ''}
            </Text>
          </View>
        ) : null}

        {/* Trip Details */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <Icon name="map-marker-path" size={18} color={G.accent} />
            <Text style={s.sectionTitle}>Trip Details</Text>
          </View>

          <View style={s.locationContainer}>
            <View style={s.locationRow}>
              <View style={[s.locationDot, { backgroundColor: G.success }]} />
              <View style={s.locationInfo}>
                <Text style={gText.caption}>PICKUP</Text>
                <Text style={gText.value}>{String(booking?.pickupAddress || '—')}</Text>
              </View>
            </View>
            <View style={s.connector} />
            <View style={s.locationRow}>
              <View style={[s.locationDot, { backgroundColor: G.error }]} />
              <View style={s.locationInfo}>
                <Text style={gText.caption}>DROP</Text>
                <Text style={gText.value}>{String(booking?.dropAddress || '—')}</Text>
              </View>
            </View>
          </View>

          <View style={s.metaRow}>
            {typeof booking?.distanceMeters === 'number' ? (
              <View style={s.metaPill}>
                <Icon name="map-marker-distance" size={14} color={G.accent} />
                <Text style={s.metaPillText}>{fmtKm(booking.distanceMeters)}</Text>
              </View>
            ) : null}
            {typeof booking?.durationSeconds === 'number' ? (
              <View style={s.metaPill}>
                <Icon name="clock-outline" size={14} color={G.accent} />
                <Text style={s.metaPillText}>{fmtMin(booking.durationSeconds)}</Text>
              </View>
            ) : null}
            <View style={s.metaPill}>
              <Icon name="car" size={14} color={G.accent} />
              <Text style={s.metaPillText}>{String(booking?.vehicleType || 'CAR')}</Text>
            </View>
            <View style={s.metaPill}>
              <Icon name="cog" size={14} color={G.accent} />
              <Text style={s.metaPillText}>{String(booking?.transmissionType || 'MANUAL')}</Text>
            </View>
          </View>

          {booking?.scheduledTime ? (
            <View style={[s.metaPill, { marginTop: 8 }]}>
              <Icon name="calendar-clock" size={14} color={G.warning} />
              <Text style={s.metaPillText}>{new Date(booking.scheduledTime).toLocaleString()}</Text>
            </View>
          ) : null}

          {booking?.otp ? (
            <View style={s.otpContainer}>
              <Text style={gText.caption}>TRIP OTP</Text>
              <Text style={s.otpText}>{String(booking.otp)}</Text>
            </View>
          ) : null}
        </View>

        {/* Person Details */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <Icon name="account" size={18} color={G.accent} />
            <Text style={s.sectionTitle}>{personInfo.label} Details</Text>
          </View>
          <View style={s.personRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{personInfo.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={gText.h4}>{personInfo.name}</Text>
              {personInfo.rating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Icon name="star" size={14} color="#f59e0b" />
                  <Text style={gText.bodySm}>{personInfo.rating}</Text>
                </View>
              ) : null}
            </View>
            {personInfo.phone ? (
              <TouchableOpacity
                style={s.callBtn}
                onPress={() => {
                  const Linking = require('react-native').Linking;
                  Linking.openURL(`tel:${personInfo.phone}`);
                }}
              >
                <Icon name="phone" size={18} color={G.accent} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ─── Fare Breakdown ─────────────────────────── */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <Icon name="receipt" size={18} color={G.accent} />
            <Text style={s.sectionTitle}>Fare Breakdown</Text>
          </View>

          {breakdown.map((row, i) => (
            <View key={i} style={s.fareRow}>
              <Text style={[gText.label, row.negative && { color: G.success }, row.accent && { color: G.warning }]}>
                {row.label}
              </Text>
              <Text style={[gText.value, row.negative && { color: G.success }, row.accent && { color: G.warning }]}>
                {row.value}
              </Text>
            </View>
          ))}

          {breakdown.length === 0 ? (
            <Text style={[gText.bodySm, { textAlign: 'center', paddingVertical: 8 }]}>No breakdown available</Text>
          ) : null}

          {/* Total — driver sees their full earnings, customer sees discounted amount */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{isViewingAsDriver ? 'Your Earnings' : 'Total Amount'}</Text>
            <Text style={s.totalValue}>
              {isViewingAsDriver
                ? fmt(Number(booking?.driverEarnings || booking?.totalAmount || 0))
                : fmt(totalAmount)}
            </Text>
          </View>

          {/* Payment method */}
          <View style={s.payRow}>
            <Icon
              name={
                String(booking?.paymentMethod || '').toUpperCase() === 'CASH'
                  ? 'cash'
                  : String(booking?.paymentMethod || '').toUpperCase() === 'WALLET'
                    ? 'wallet'
                    : 'credit-card-outline'
              }
              size={18}
              color={G.success}
            />
            <Text style={gText.bodySm}>
              {String(booking?.paymentMethod || 'CASH')} • {String(booking?.paymentStatus || 'PENDING')}
            </Text>
          </View>

          {/* View receipt button */}
          {isCompleted ? (
            <TouchableOpacity
              style={[glass.buttonGhost, { marginTop: 14, flexDirection: 'row', gap: 8 }]}
              onPress={() => navigation.navigate('RideReceipt', { booking })}
            >
              <Icon name="file-document-outline" size={18} color={G.textPrimary} />
              <Text style={gText.btnGhost}>View Receipt</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Support */}
        <TouchableOpacity
          style={s.supportBtn}
          onPress={() => {
            if (!effectiveBookingId) return;
            try {
              if (isAdmin) {
                // Admin: go to the Need Help inbox — threads for this booking
                // will appear (customer thread + driver thread separately)
                navigation.navigate('AdminNeedHelp', {
                  screen: 'AdminNeedHelp',
                  params: { filterBookingId: effectiveBookingId },
                });
              } else {
                // Driver or customer: threadUserId = their own userId.
                // Each user has their own separate thread with admin.
                const myUserId = String((user as any)?.id || '');
                navigation.navigate('SupportChat', {
                  bookingId: effectiveBookingId,
                  ...(myUserId ? { threadUserId: myUserId } : {}),
                });
              }
            } catch {}
          }}
        >
          <Icon name="headphones" size={20} color={G.accent} />
          <Text style={[gText.btnGhost, { color: G.accent }]}>Need Help?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

/* ───────────── styles ─────────────────────────────── */
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: G.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: G.glass2,
    borderBottomWidth: 1,
    borderBottomColor: G.border2,
  },

  /* Status card */
  statusCard: {
    ...glass.cardAccent as any,
    alignItems: 'center',
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bookingNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: G.textPrimary,
    letterSpacing: 1,
  },
  bookingDate: {
    fontSize: 13,
    color: G.textMuted,
    marginTop: 4,
  },

  /* Glass card */
  glassCard: {
    backgroundColor: G.glass2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: G.border2,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14 },
      android: { elevation: 8 },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: G.textPrimary,
  },

  /* Location */
  locationContainer: {
    paddingLeft: 4,
    marginBottom: 14,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  connector: {
    width: 2,
    height: 24,
    backgroundColor: G.border2,
    marginLeft: 4,
    marginVertical: 4,
  },

  /* Meta */
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: G.glass3,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: G.border1,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: G.textSecondary,
  },

  /* OTP */
  otpContainer: {
    marginTop: 14,
    alignItems: 'center',
    backgroundColor: G.glass3,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: G.borderAccent,
  },
  otpText: {
    fontSize: 26,
    fontWeight: '800',
    color: G.accent,
    letterSpacing: 6,
    marginTop: 4,
  },

  /* Person */
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: G.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.borderAccent,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: G.accent,
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: G.glass3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },

  /* Fare */
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: G.borderAccent,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: G.textPrimary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: G.accent,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: G.glass1,
    borderRadius: 10,
  },

  /* Support */
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.borderAccent,
    marginTop: 4,
    marginBottom: 16,
  },
});

export default BookingDetailsScreen;
