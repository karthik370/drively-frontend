import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppSelector } from '../../redux/store';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from '../../constants/config';

const PhoneLoginScreen = ({ navigation }: any) => {
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sending, setSending] = useState(false);

  const getErrorMessage = (err: any): string => {
    if (!err) return 'Something went wrong';
    if (typeof err === 'string') return err;
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;
    if (typeof err?.error === 'string' && err.error.trim()) return err.error;
    if (typeof err?.reason === 'string' && err.reason.trim()) return err.reason;
    try {
      const asJson = JSON.stringify(err);
      return asJson && asJson !== '{}' ? asJson : String(err);
    } catch {
      return String(err);
    }
  };

  const initMsg91 = (widgetId: string, tokenAuth: string) => {
    try {
      OTPWidget.initializeWidget(widgetId, tokenAuth);
    } catch {
    }
  };

  const initMsg91Fallback = (widgetId: string, tokenAuth: string) => {
    try {
      OTPWidget.initializeWidget(widgetId, { authToken: tokenAuth } as any);
    } catch {
    }
  };

  const extractReqId = (raw: any): string => {
    let response = raw;
    if (typeof response === 'string') {
      try {
        response = JSON.parse(response);
      } catch {
      }
    }

    const successMessage =
      response &&
        typeof response === 'object' &&
        String((response as any)?.type || '').toLowerCase() === 'success' &&
        typeof (response as any)?.message === 'string'
        ? String((response as any).message)
        : '';

    const candidates = [
      (response as any)?.reqId,
      (response as any)?.reqid,
      (response as any)?.req_id,
      (response as any)?.requestId,
      (response as any)?.request_id,
      successMessage,
      (response as any)?.data?.reqId,
      (response as any)?.data?.reqid,
      (response as any)?.data?.req_id,
      (response as any)?.data?.requestId,
      (response as any)?.data?.request_id,
      (response as any)?.data?.message,
    ];

    for (const c of candidates) {
      if (typeof c === 'string') {
        const v = c.trim();
        if (!v) continue;
        if (v === 'AuthenticationFailure') continue;
        return v;
      }
    }
    return '';
  };

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const digits = String(phoneNumber || '').replace(/\D/g, '');
    const last10 = digits.length > 10 ? digits.slice(-10) : digits;
    const formattedPhone = `+91${last10}`;
    const msg91Identifier = `91${last10}`;

    try {
      setSending(true);

      const widgetId = String(MSG91_WIDGET_ID || '').trim();
      const tokenAuth = String(MSG91_TOKEN_AUTH || '').trim();
      if (!widgetId || !tokenAuth) {
        throw new Error('MSG91 is not configured. Please set EXPO_PUBLIC_MSG91_WIDGET_ID and EXPO_PUBLIC_MSG91_TOKEN_AUTH in mobile .env');
      }

      console.log('MSG91 init', {
        widgetId: widgetId,
        tokenAuthLen: tokenAuth.length,
        tokenAuthPrefix: tokenAuth.slice(0, 6),
      });

      initMsg91(widgetId, tokenAuth);

      let response: any = await OTPWidget.sendOTP({ identifier: msg91Identifier } as any);

      if (
        response &&
        typeof response === 'object' &&
        String((response as any)?.code || '') === '401' &&
        String((response as any)?.message || '') === 'AuthenticationFailure'
      ) {
        initMsg91Fallback(widgetId, tokenAuth);
        response = await OTPWidget.sendOTP({ identifier: msg91Identifier } as any);
      }

      const reqId = extractReqId(response);
      if (!reqId) {
        console.log('MSG91 sendOTP response:', response);
        throw new Error('Failed to request OTP. reqId missing. Check MSG91 config/tokenAuth and console logs.');
      }

      navigation.replace('OtpVerification', {
        phoneNumber: formattedPhone,
        reqId,
        msg91Identifier,
      });
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err) || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

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
              placeholder="9876543210"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={10}
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
            <Text style={styles.continueButtonText}>Send OTP</Text>
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
    backgroundColor: '#0A0A0A',
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
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A8A',
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 32,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#141414',
  },
  countryCode: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#C9A84C',
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  continueButton: {
    backgroundColor: '#C9A84C',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#C9A84C',
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
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: '#C9A84C',
    fontWeight: '600',
  },
});

export default PhoneLoginScreen;
