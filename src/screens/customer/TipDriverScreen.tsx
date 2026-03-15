import React, { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { createTip, createTipOrder, payTipWithWallet, verifyTipPayment } from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
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

  const tipWithCashfree = async () => {
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

      const success = await openCashfreeCheckout({
        orderId: String(order.orderId),
        paymentSessionId: String(order.paymentSessionId),
      });

      await verifyTipPayment({ tipId: String(tip.tipId), cf_order_id: success.orderId });
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
          <Icon name="arrow-left" size={22} color="#C9A84C" />
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
            placeholderTextColor="#444444"
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
            style={[styles.cta, styles.ctaCashfree, isPaying ? styles.ctaDisabled : null]}
            disabled={isPaying}
            onPress={tipWithCashfree}
          >
            <Text style={styles.ctaText}>Pay Online</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Tip is allowed only after trip completion.</Text>
        </View>
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
  content: { padding: 16 },
  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  label: { color: '#8A8A8A', fontWeight: '700' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#111111',
  },
  quickText: { color: '#FFFFFF', fontWeight: '800' },
  cta: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaWallet: { backgroundColor: '#1E1E1E' },
  ctaCashfree: { backgroundColor: '#C9A84C' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#ffffff', fontWeight: '900' },
  hint: { marginTop: 12, color: '#8A8A8A', fontWeight: '600', fontSize: 12 },
});

export default TipDriverScreen;
