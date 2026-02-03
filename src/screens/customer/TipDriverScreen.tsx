import React, { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { createTip, createTipOrder, payTipWithWallet, verifyTipPayment } from '../../services/api';
import { openRazorpayCheckout } from '../../services/razorpayService';
import { useAppSelector } from '../../redux/store';

const TipDriverScreen = ({ navigation, route }: any) => {
  const user = useAppSelector((s) => s.auth.user);
  const bookingId = String(route?.params?.bookingId || '');

  const [amountText, setAmountText] = useState('50');
  const [isPaying, setIsPaying] = useState(false);

  const amount = useMemo(() => {
    const n = Number(amountText);
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);

  const tipWithWallet = async () => {
    if (!bookingId) {
      Alert.alert('Tip', 'Missing bookingId');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Tip', 'Enter a valid amount');
      return;
    }
    if (isPaying) return;

    setIsPaying(true);
    try {
      const tip = await createTip({ bookingId, amount, paymentMethod: 'WALLET' });
      await payTipWithWallet(String(tip.tipId));
      Alert.alert('Tip', 'Tip paid successfully');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Tip', e?.message || 'Failed to pay tip');
    } finally {
      setIsPaying(false);
    }
  };

  const tipWithRazorpay = async () => {
    if (!bookingId) {
      Alert.alert('Tip', 'Missing bookingId');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Tip', 'Enter a valid amount');
      return;
    }
    if (isPaying) return;

    setIsPaying(true);
    try {
      const tip = await createTip({ bookingId, amount, paymentMethod: 'UPI' });
      const order = await createTipOrder(String(tip.tipId));

      const success = await openRazorpayCheckout({
        orderId: String(order.orderId),
        amountPaise: Number(order.amount),
        currency: String(order.currency || 'INR'),
        name: 'DriveMate',
        description: 'Tip Driver',
        prefill: {
          contact: user?.phoneNumber,
          email: user?.email,
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
        },
      });

      await verifyTipPayment({ tipId: String(tip.tipId), ...success });
      Alert.alert('Tip', 'Tip paid successfully');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Tip', e?.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tip Driver</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Amount (INR)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amountText}
            onChangeText={setAmountText}
            placeholder="Enter amount"
            placeholderTextColor="#9ca3af"
          />

          <View style={styles.quickRow}>
            {[20, 50, 100, 200].map((v) => (
              <TouchableOpacity key={v} style={styles.quickBtn} onPress={() => setAmountText(String(v))}>
                <Text style={styles.quickText}>₹{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.cta, styles.ctaWallet, isPaying ? styles.ctaDisabled : null]}
            disabled={isPaying}
            onPress={tipWithWallet}
          >
            <Text style={styles.ctaText}>Pay with Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cta, styles.ctaRazorpay, isPaying ? styles.ctaDisabled : null]}
            disabled={isPaying}
            onPress={tipWithRazorpay}
          >
            <Text style={styles.ctaText}>Pay with Razorpay</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Tip is allowed only after trip completion.</Text>
        </View>
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
  content: { padding: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  label: { color: '#6b7280', fontWeight: '700' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111827',
    fontWeight: '800',
    fontSize: 18,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  quickText: { color: '#111827', fontWeight: '800' },
  cta: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaWallet: { backgroundColor: '#111827' },
  ctaRazorpay: { backgroundColor: '#2563eb' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#ffffff', fontWeight: '900' },
  hint: { marginTop: 12, color: '#6b7280', fontWeight: '600', fontSize: 12 },
});

export default TipDriverScreen;
