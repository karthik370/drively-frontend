import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppSelector, useAppDispatch } from '../../redux/store';
import { adminLogin } from '../../redux/slices/authSlice';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from '../../constants/config';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const PhoneLoginScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.auth);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminSecretKey, setAdminSecretKey] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Admin phones from env — comma or space separated (last 10 digits)
  const adminPhones: string[] = String(
    process.env.EXPO_PUBLIC_ADMIN_PHONES ||
    process.env.EXPO_PUBLIC_ADMIN_PHONE ||
    ''
  )
    .split(/[,\s;]+/)
    .map((p) => p.replace(/\D/g, '').slice(-10))
    .filter(Boolean);

  const last10 = (n: string) => n.replace(/\D/g, '').slice(-10);
  const isAdminPhone = (n: string) => adminPhones.length > 0 && adminPhones.includes(last10(n));

  const getErrorMessage = (err: any): string => {
    if (!err) return 'Something went wrong';
    if (typeof err === 'string') return err;
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;
    if (typeof err?.error === 'string' && err.error.trim()) return err.error;
    try {
      const asJson = JSON.stringify(err);
      return asJson && asJson !== '{}' ? asJson : String(err);
    } catch {
      return String(err);
    }
  };

  const initMsg91 = (widgetId: string, tokenAuth: string) => {
    try { OTPWidget.initializeWidget(widgetId, tokenAuth); } catch {}
  };

  const initMsg91Fallback = (widgetId: string, tokenAuth: string) => {
    try { OTPWidget.initializeWidget(widgetId, { authToken: tokenAuth } as any); } catch {}
  };

  const extractReqId = (raw: any): string => {
    let response = raw;
    if (typeof response === 'string') { try { response = JSON.parse(response); } catch {} }
    const successMessage =
      response && typeof response === 'object' &&
      String((response as any)?.type || '').toLowerCase() === 'success' &&
      typeof (response as any)?.message === 'string'
        ? String((response as any).message) : '';
    const candidates = [
      (response as any)?.reqId, (response as any)?.reqid, (response as any)?.req_id,
      (response as any)?.requestId, (response as any)?.request_id, successMessage,
      (response as any)?.data?.reqId, (response as any)?.data?.reqid,
      (response as any)?.data?.req_id, (response as any)?.data?.requestId,
      (response as any)?.data?.request_id, (response as any)?.data?.message,
    ];
    for (const c of candidates) {
      if (typeof c === 'string') {
        const v = c.trim();
        if (!v || v === 'AuthenticationFailure') continue;
        return v;
      }
    }
    return '';
  };

  // ── Admin direct login (no OTP) ──────────────────────────────
  const handleAdminLogin = async () => {
    if (!adminSecretKey.trim()) {
      showAlert('Error', 'Please enter the admin secret key');
      return;
    }
    const digits10 = last10(phoneNumber);
    const formattedPhone = `+91${digits10}`;
    setAdminLoading(true);
    try {
      await (dispatch as any)(
        adminLogin({ phoneNumber: formattedPhone, adminSecretKey: adminSecretKey.trim() })
      ).unwrap();
      setShowAdminModal(false);
      // Navigation handled automatically by auth state change (isAuthenticated = true)
    } catch (err: any) {
      showAlert('Admin Login Failed', getErrorMessage(err));
    } finally {
      setAdminLoading(false);
    }
  };

  // ── Normal OTP flow ──────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      showAlert('Error', 'Please enter a valid phone number');
      return;
    }

    const digits = String(phoneNumber || '').replace(/\D/g, '');
    const last10Phone = digits.length > 10 ? digits.slice(-10) : digits;
    const formattedPhone = `+91${last10Phone}`;
    const msg91Identifier = `91${last10Phone}`;

    // Admin bypass — show secret key modal instead of OTP
    if (isAdminPhone(phoneNumber)) {
      setAdminSecretKey('');
      setShowAdminModal(true);
      return;
    }

    try {
      setSending(true);

      const widgetId = String(MSG91_WIDGET_ID || '').trim();
      const tokenAuth = String(MSG91_TOKEN_AUTH || '').trim();
      if (!widgetId || !tokenAuth) {
        throw new Error('MSG91 is not configured. Please set EXPO_PUBLIC_MSG91_WIDGET_ID and EXPO_PUBLIC_MSG91_TOKEN_AUTH in mobile .env');
      }

      initMsg91(widgetId, tokenAuth);

      let response: any = await OTPWidget.sendOTP({ identifier: msg91Identifier } as any);

      if (
        response && typeof response === 'object' &&
        String((response as any)?.code || '') === '401' &&
        String((response as any)?.message || '') === 'AuthenticationFailure'
      ) {
        initMsg91Fallback(widgetId, tokenAuth);
        response = await OTPWidget.sendOTP({ identifier: msg91Identifier } as any);
      }

      const reqId = extractReqId(response);
      if (!reqId) {
        throw new Error('Failed to request OTP. reqId missing. Check MSG91 config/tokenAuth and console logs.');
      }

      navigation.replace('OtpVerification', {
        phoneNumber: formattedPhone,
        reqId,
        msg91Identifier,
      });
    } catch (err: any) {
      showAlert('Error', getErrorMessage(err) || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <StatusBar style="light" />

      {/* Admin secret key modal */}
      <Modal
        visible={showAdminModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdminModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.adminModal}>
            <View style={styles.adminModalHeader}>
              <Icon name="shield-account" size={22} color="#C9A84C" />
              <Text style={styles.adminModalTitle}>Admin Login</Text>
            </View>
            <Text style={styles.adminModalSubtitle}>
              Enter your admin secret key to continue without OTP
            </Text>
            <TextInput
              style={styles.adminSecretInput}
              placeholder="Secret key"
              placeholderTextColor="#555"
              secureTextEntry
              value={adminSecretKey}
              onChangeText={setAdminSecretKey}
              autoFocus
              onSubmitEditing={handleAdminLogin}
            />
            <View style={styles.adminButtonRow}>
              <TouchableOpacity
                style={[styles.adminButton, styles.adminCancelButton]}
                onPress={() => setShowAdminModal(false)}
                disabled={adminLoading}
              >
                <Text style={styles.adminCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminButton, styles.adminSignInButton, adminLoading && styles.disabledButton]}
                onPress={handleAdminLogin}
                disabled={adminLoading}
              >
                {adminLoading
                  ? <ActivityIndicator color="#0A0A0A" size="small" />
                  : <Text style={styles.adminSignInText}>Sign In</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Enter Your Phone Number</Text>
          <Text style={styles.subtitle}>
            We'll send you a verification code to confirm your number
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="Enter Your Phone Number"
              placeholderTextColor={G.textMuted}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '');
                if (digits.length > phoneNumber.length + 1) {
                  // Paste detected (jumped by more than 1 digit at once)
                  // Strip country code → take LAST 10 (handles +91XXXXXXXXXX)
                  setPhoneNumber(digits.slice(-10));
                } else {
                  // Normal key-by-key typing → cap at FIRST 10 (first digit never drops)
                  setPhoneNumber(digits.slice(0, 10));
                }
              }}
              autoFocus
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, (isLoading || sending) && styles.disabledButton]}
          onPress={handleSendOtp}
          disabled={isLoading || sending}
        >
          {isLoading || sending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.continueButtonText}>
              {isAdminPhone(phoneNumber) ? 'Continue as Admin' : 'Send OTP'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  titleContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: G.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: G.textSecondary,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 32,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: G.glass2,
  },
  countryCode: {
    backgroundColor: G.glass3,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  countryCodeText: {
    fontSize: 16,
    color: G.accent,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: G.textPrimary,
  },
  continueButton: {
    backgroundColor: G.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: G.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  termsText: {
    fontSize: 14,
    color: G.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: G.accent,
    fontWeight: '600',
  },
  // Admin modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  adminModal: {
    backgroundColor: G.glass3,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: G.borderAccent,
  },
  adminModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: G.textPrimary,
    marginLeft: 8,
  },
  adminModalSubtitle: {
    fontSize: 13,
    color: G.textSecondary,
    marginBottom: 20,
  },
  adminSecretInput: {
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.borderAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: G.textPrimary,
    marginBottom: 20,
  },
  adminButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  adminButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  adminCancelButton: {
    backgroundColor: G.glass4,
    borderWidth: 1,
    borderColor: G.border2,
  },
  adminSignInButton: {
    backgroundColor: G.accent,
  },
  adminCancelText: {
    color: G.textSecondary,
    fontWeight: '600',
  },
  adminSignInText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default PhoneLoginScreen;
