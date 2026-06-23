import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { useAppDispatch } from '../../redux/store';
import { signup } from '../../redux/slices/authSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';
import { applyReferralCode } from '../../services/api';
import { MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from '../../constants/config';

const SignupScreen = ({ route, navigation }: any) => {
  const {
    phoneNumber,
    userType,
    msg91AccessToken,
    otpSignupToken,
    // Prefill params — passed back after re-verification from an expired session
    prefillFirstName = '',
    prefillLastName = '',
    prefillEmail = '',
    prefillReferralCode = '',
  } = route.params;
  const dispatch = useAppDispatch();

  const [formData, setFormData] = useState({
    firstName: prefillFirstName || '',
    lastName: prefillLastName || '',
    email: prefillEmail || '',
  });
  const [referralCode, setReferralCode] = useState(prefillReferralCode || '');
  const [isLoading, setIsLoading] = useState(false);

  // ── Re-verification when otpSignupToken expires ────────────────────────────
  // Sends a fresh OTP to the same phone, then navigates to OtpVerification
  // carrying all the form data so the user continues from where they left off.
  const reVerifyPhone = async () => {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    const last10 = digits.length > 10 ? digits.slice(-10) : digits;
    const msg91Identifier = `91${last10}`;

    const widgetId = String(MSG91_WIDGET_ID || '').trim();
    const tokenAuth = String(MSG91_TOKEN_AUTH || '').trim();

    setIsLoading(true);
    try {
      try { OTPWidget.initializeWidget(widgetId, tokenAuth); } catch {}

      const resp: any = await OTPWidget.sendOTP({ identifier: msg91Identifier } as any);

      // Extract reqId from MSG91 response
      let reqId = '';
      const candidates = [
        resp?.reqId, resp?.reqid, resp?.req_id, resp?.requestId,
        resp?.data?.reqId, resp?.data?.message,
        typeof resp?.message === 'string' ? resp.message : '',
      ];
      for (const c of candidates) {
        if (typeof c === 'string' && c.trim() && c.trim() !== 'AuthenticationFailure') {
          reqId = c.trim();
          break;
        }
      }

      if (!reqId) throw new Error('Failed to send OTP. Please try again.');

      // Navigate to OTP screen — pass signupReturnData so we return here after verify
      navigation.navigate('OtpVerification', {
        phoneNumber,
        reqId,
        msg91Identifier,
        signupReturnData: {
          userType,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          referralCode: referralCode.trim(),
        },
      });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to send OTP');
      showAlert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const email = formData.email.trim();

    // ── Client-side validation (match backend rules exactly so users never see raw API errors) ──
    if (!firstName) {
      showAlert('First Name Required', 'Please enter your first name.');
      return;
    }
    if (firstName.length < 2) {
      showAlert('First Name Too Short', 'First name must be at least 2 characters.\n\nFor example, use "Ab" instead of "A".');
      return;
    }
    if (!lastName) {
      showAlert('Last Name Required', 'Please enter your last name.');
      return;
    }
    if (lastName.length < 2) {
      showAlert('Last Name Too Short', 'Last name must be at least 2 characters.\n\nFor example, use "Vc" instead of "V". You can use any 2+ letter abbreviation.');
      return;
    }
    if (!email) {
      showAlert('Email Required', 'Please enter your email address for account notifications.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address. Example: name@gmail.com');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        phoneNumber,
        userType,
        firstName,
        lastName,
        otpSignupToken,
        msg91AccessToken,
        email: email.toLowerCase(),
        referralCode: referralCode.trim() || undefined,
      };

      await dispatch(signup(payload)).unwrap();

      // Apply referral code silently after signup (non-blocking)
      const code = referralCode.trim().toUpperCase();
      if (code) {
        try { await applyReferralCode(code); } catch { /* non-blocking */ }
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err?.message || '');
      const isExpired =
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('jwt') ||
        msg.toLowerCase().includes('token');

      if (isExpired) {
        // Re-send OTP to same phone, carry form data across — no data lost
        showAlert(
          'Session Expired',
          'Your verification session has timed out. We\'ll send a new OTP to ' + phoneNumber + ' so you can continue.',
          [{ text: 'Send OTP', onPress: reVerifyPhone }]
        );
      } else {
        showAlert('Signup Failed', msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Tell us a bit about yourself
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your first name"
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your last name"
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#555"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.emailHint}>Used for account notifications</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={phoneNumber}
              editable={false}
            />
          </View>

          {/* Referral Code — optional */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Referral Code <Text style={{ color: G.textSecondary, fontWeight: '400' }}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter referral code"
              placeholderTextColor="#555"
              value={referralCode}
              onChangeText={(t) => setReferralCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />
            <Text style={styles.emailHint}>Have a referral code? Enter it to earn rewards 🎁</Text>
          </View>

        </View>

        <TouchableOpacity
          style={[styles.signupButton, isLoading && styles.disabledButton]}
          onPress={handleSignup}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.signupButtonText}>Complete Signup</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  },
  titleContainer: {
    marginBottom: 32,
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
  },
  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: G.textPrimary,
  },
  disabledInput: {
    backgroundColor: G.glass2,
    color: G.textSecondary,
  },
  emailHint: {
    fontSize: 11,
    color: G.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },
  signupButton: {
    backgroundColor: G.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: G.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignupScreen;
