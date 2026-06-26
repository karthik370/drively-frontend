import React, { useMemo, useState } from 'react';
import {
  Alert, Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

import { createWalletTopupOrder, getWalletBalance, verifyWalletTopup } from '../../services/api';
import { openCashfreeCheckout } from '../../services/cashfreeService';
import { useAppSelector } from '../../redux/store';
import { showAlert } from '../../components/common/CustomAlert';

const WalletTopupScreen = ({ navigation }: any) => {
  const user = useAppSelector((s) => s.auth.user);

  const [amountText, setAmountText] = useState('200');
  const [isPaying, setIsPaying] = useState(false);

  const amount = useMemo(() => {
    const n = Number(amountText);
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);

  const submit = async () => {
    if (isPaying) return;

    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert('Wallet', 'Enter a valid amount');
      return;
    }

    setIsPaying(true);
    try {
      const order = await createWalletTopupOrder(amount, 'UPI');
      const success = await openCashfreeCheckout({
        orderId: String(order.orderId),
        paymentSessionId: String(order.paymentSessionId),
      });

      await verifyWalletTopup({ cf_order_id: success.orderId });
      const bal = await getWalletBalance();
      showAlert('Wallet', `Top-up successful. New balance: ₹${bal.balance.toFixed(2)}`);
      navigation.goBack();
    } catch (e: any) {
      showAlert('Wallet topup', e?.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Money</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* KeyboardAvoidingView lifts content above the keyboard on iOS */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* TouchableWithoutFeedback: tap anywhere outside input dismisses keyboard */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.label}>Amount (INR)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                value={amountText}
                onChangeText={setAmountText}
                placeholder="Enter amount"
                placeholderTextColor="#444444"
              />

              <View style={styles.quickRow}>
                {[100, 200, 500, 1000].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={styles.quickBtn}
                    onPress={() => { Keyboard.dismiss(); setAmountText(String(v)); }}
                  >
                    <Text style={styles.quickText}>₹{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.cta, isPaying ? styles.ctaDisabled : null]}
                disabled={isPaying}
                onPress={() => { Keyboard.dismiss(); submit(); }}
              >
                <Text style={styles.ctaText}>{isPaying ? 'Processing…' : 'Pay Now'}</Text>
              </TouchableOpacity>

              <Text style={styles.hint}>Cashfree checkout will open to complete the payment.</Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bgAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: G.glass2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: G.textPrimary },
  content: { padding: 16 },
  card: {
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  label: { color: G.textSecondary, fontWeight: '700' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: G.textPrimary,
    fontWeight: '800',
    fontSize: 18,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: G.border3,
    backgroundColor: G.bgAlt,
  },
  quickText: { color: G.textPrimary, fontWeight: '800' },
  cta: {
    marginTop: 16,
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: G.textPrimary, fontWeight: '900' },
  hint: { marginTop: 12, color: G.textSecondary, fontWeight: '600', fontSize: 12 },
});

export default WalletTopupScreen;
