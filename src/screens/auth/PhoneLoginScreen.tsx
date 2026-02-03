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

const PhoneLoginScreen = ({ navigation }: any) => {
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sending, setSending] = useState(false);

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
      const response = await OTPWidget.sendOTP({ identifier: msg91Identifier } as any);
      const reqId =
        (response as any)?.reqId ||
        (response as any)?.data?.reqId ||
        (response as any)?.data?.requestId ||
        (response as any)?.requestId ||
        null;

      if (!reqId) {
        throw new Error('Failed to request OTP. reqId missing.');
      }

      navigation.push('OtpVerification', {
        phoneNumber: formattedPhone,
        reqId,
        msg91Identifier,
      });
    } catch (err: any) {
      Alert.alert('Error', err || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#111827" />
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
    backgroundColor: '#ffffff',
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
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 32,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryCode: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  continueButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  disabledButton: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default PhoneLoginScreen;
