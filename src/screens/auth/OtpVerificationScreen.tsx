import React, { useState, useRef, useEffect } from 'react';
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
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { verifyMsg91AccessToken } from '../../redux/slices/authSlice';
import { OTPWidget } from '@msg91comm/sendotp-react-native';

const OtpVerificationScreen = ({ route, navigation }: any) => {
  const { phoneNumber, reqId } = route.params;
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.auth);
  const [localLoading, setLocalLoading] = useState(false);
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Verify is triggered explicitly by the user via the button below
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (otpCode: string) => {
    try {
      setLocalLoading(true);
      const verifyResp = await OTPWidget.verifyOTP({ reqId, otp: otpCode } as any);
      const msg91AccessToken =
        (verifyResp as any)?.['access-token'] ||
        (verifyResp as any)?.accessToken ||
        (verifyResp as any)?.data?.['access-token'] ||
        (verifyResp as any)?.data?.accessToken ||
        null;

      if (!msg91AccessToken) {
        throw new Error('OTP verification failed. access-token missing.');
      }

      const result = await dispatch(
        verifyMsg91AccessToken({ accessToken: String(msg91AccessToken), phoneNumber })
      ).unwrap();

      if (result?.accessToken && result?.refreshToken) {
        return;
      }

      if (result?.userExists === false) {
        navigation.navigate('UserTypeSelection', { phoneNumber, msg91AccessToken: String(msg91AccessToken) });
        return;
      }

      throw new Error('Login failed');
    } catch (err: any) {
      Alert.alert('Error', err?.message || err || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer === 0) {
      try {
        setLocalLoading(true);
        await OTPWidget.retryOTP({ reqId } as any);
        setTimer(30);
      } catch (err: any) {
        Alert.alert('Error', err?.message || err || 'Failed to resend OTP');
      } finally {
        setLocalLoading(false);
      }
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
          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.phoneText}>{phoneNumber}</Text>
          </Text>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.otpInput}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {(isLoading || localLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}

        <View style={styles.resendContainer}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!otp.every((d) => d !== '') || isLoading || localLoading) && styles.disabledButton,
            ]}
            onPress={() => handleVerifyOtp(otp.join(''))}
            disabled={!otp.every((d) => d !== '') || isLoading || localLoading}
          >
            {isLoading || localLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          {timer > 0 ? (
            <Text style={styles.timerText}>
              Resend code in {timer}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendText}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>
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
  phoneText: {
    color: '#111827',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  verifyButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  timerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resendText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default OtpVerificationScreen;
