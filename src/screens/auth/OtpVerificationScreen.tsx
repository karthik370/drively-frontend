import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { verifyMsg91AccessToken } from '../../redux/slices/authSlice';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { API_URL } from '../../constants/config';
import { FadeIn, SlideUp, ScaleIn } from '../../components/premium/AnimatedComponents';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const OtpVerificationScreen = ({ route, navigation }: any) => {
  const { phoneNumber, reqId, msg91Identifier, signupReturnData } = route.params;
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.auth);
  const [localLoading, setLocalLoading] = useState(false);
  const [currentReqId, setCurrentReqId] = useState(String(reqId || '').trim());

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
        if (v.toLowerCase() === 'success') continue;
        return v;
      }
    }
    return '';
  };

  const extractMsg91AccessToken = (raw: any): string => {
    let payload = raw;
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (!trimmed) return '';
      try {
        payload = JSON.parse(trimmed);
      } catch {
        const looksLikeToken =
          trimmed.length >= 20 &&
          !trimmed.includes(' ') &&
          trimmed.toLowerCase() !== 'success' &&
          trimmed.toLowerCase() !== 'verified' &&
          trimmed.toLowerCase() !== 'otp verified';
        return looksLikeToken ? trimmed : '';
      }
    }

    const findAccessTokenRecursive = (node: any, depth = 0): string => {
      if (!node || depth > 10) return '';
      if (typeof node === 'string') return '';

      if (Array.isArray(node)) {
        for (const item of node) {
          const found = findAccessTokenRecursive(item, depth + 1);
          if (found) return found;
        }
        return '';
      }

      if (typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          const key = String(k).toLowerCase();
          const isAccessTokenKey =
            key === 'access-token' ||
            key === 'accesstoken' ||
            key === 'access_token' ||
            key === 'access-token ' ||
            key === 'accesstoken ';

          const isGenericTokenKey = key === 'token' || key === 'jwt' || key === 'jwt_token' || key === 'jwttoken';

          if (isAccessTokenKey && typeof v === 'string' && v.trim()) {
            return v.trim();
          }

          if (isGenericTokenKey && typeof v === 'string' && v.trim() && v.trim().length >= 20) {
            return v.trim();
          }

          if ((key.includes('access') && key.includes('token')) && typeof v === 'string' && v.trim()) {
            return v.trim();
          }

          if (key.includes('jwt') && typeof v === 'string' && v.trim() && v.trim().length >= 20) {
            return v.trim();
          }

          const found = findAccessTokenRecursive(v, depth + 1);
          if (found) return found;
        }
      }

      return '';
    };

    const candidates = [
      (payload as any)?.['access-token'],
      (payload as any)?.accessToken,
      (payload as any)?.access_token,
      (payload as any)?.data?.['access-token'],
      (payload as any)?.data?.accessToken,
      (payload as any)?.data?.access_token,
      (payload as any)?.token,
      (payload as any)?.jwt,
      (payload as any)?.jwtToken,
      (payload as any)?.data?.token,
      (payload as any)?.data?.jwt,
      (payload as any)?.data?.jwtToken,
      (payload as any)?.message,
      (payload as any)?.data?.message,
    ];

    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        const v = c.trim();
        if (v.toLowerCase() === 'success') continue;
        if (v.toLowerCase() === 'verified' || v.toLowerCase() === 'otp verified') continue;
        return v;
      }
    }

    const msg = (payload as any)?.message;
    if (msg && typeof msg === 'object') {
      const nestedCandidates = [
        (msg as any)?.['access-token'],
        (msg as any)?.accessToken,
        (msg as any)?.access_token,
      ];
      for (const c of nestedCandidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
      }
    }

    return findAccessTokenRecursive(payload);
  };

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const verifyingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-submit: fires verify the moment all 6 digits are filled
  const tryAutoSubmit = (digits: string[]) => {
    if (verifyingRef.current || localLoading || isLoading) return;
    if (digits.length === 6 && digits.every((d) => d !== '')) {
      verifyingRef.current = true;
      handleVerifyOtp(digits.join('')).finally(() => {
        verifyingRef.current = false;
      });
    }
  };

  // Hidden input auto-fill handler (for SMS auto-fill on Android/iOS)
  const handleAutoFillChange = (value: string) => {
    const digitsOnly = String(value || '').replace(/\D/g, '');
    if (digitsOnly.length >= 6) {
      const pasted = digitsOnly.slice(0, 6).split('');
      setOtp(pasted);
      inputRefs.current[5]?.focus();
      tryAutoSubmit(pasted);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const digitsOnly = String(value || '').replace(/\D/g, '');

    const normalized = digitsOnly.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = normalized;
    setOtp(newOtp);

    if (normalized && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when last digit entered
    if (normalized && index === 5) {
      tryAutoSubmit(newOtp);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (otpCode: string) => {
    try {
      if (localLoading || isLoading) return;
      setLocalLoading(true);
      const reqIdToUse = String(currentReqId || '').trim();
      if (!reqIdToUse) {
        throw new Error('OTP request expired. Please go back and request OTP again.');
      }

      const attemptVerifyOtp = async (): Promise<any> => {
        return OTPWidget.verifyOTP({ reqId: reqIdToUse, otp: String(otpCode || '').trim() } as any);
      };

      let verifyResp: any;
      try {
        verifyResp = await attemptVerifyOtp();
      } catch (firstErr: any) {
        await new Promise((r) => setTimeout(r, 300));
        verifyResp = await attemptVerifyOtp();
      }

      if (verifyResp && typeof verifyResp === 'object') {
        const respType = String((verifyResp as any)?.type || '').toLowerCase();
        const respCode = (verifyResp as any)?.code;
        const respMessage = String((verifyResp as any)?.message || '');

        if (respMessage === 'AuthenticationFailure') {
          await new Promise((r) => setTimeout(r, 600));
          verifyResp = await attemptVerifyOtp();
        }
        if (respType === 'error') {
          throw new Error(String((verifyResp as any)?.message || (verifyResp as any)?.error || 'OTP verification failed'));
        }
        if (respCode && String(respCode) !== '200' && respType !== 'success') {
          throw new Error(String((verifyResp as any)?.message || (verifyResp as any)?.error || 'OTP verification failed'));
        }
      }

      const msg91AccessToken = extractMsg91AccessToken(verifyResp);

      if (!msg91AccessToken) {
        const debug =
          verifyResp && typeof verifyResp === 'object'
            ? {
              type: (verifyResp as any)?.type,
              code: (verifyResp as any)?.code,
              message: (verifyResp as any)?.message,
            }
            : { type: typeof verifyResp };
        throw new Error(`OTP verification failed. access-token missing. ${JSON.stringify(debug)}`);
      }

      const result = await dispatch(
        verifyMsg91AccessToken({ accessToken: String(msg91AccessToken), phoneNumber })
      ).unwrap();

      if (result?.accessToken && result?.refreshToken) {
        return;
      }

      const userExistsRaw = (result as any)?.userExists;
      const userExistsStr = String(userExistsRaw).toLowerCase();
      if (userExistsRaw === false || userExistsRaw === 0 || userExistsStr === 'false' || userExistsStr === '0') {
        const newOtpSignupToken = (result as any)?.otpSignupToken;

        // If this is a re-verification from an expired signup session,
        // return to Signup with all preserved form data + the new token.
        if (signupReturnData && newOtpSignupToken) {
          navigation.navigate('Signup', {
            phoneNumber,
            userType: signupReturnData.userType,
            msg91AccessToken: String(msg91AccessToken),
            otpSignupToken: newOtpSignupToken,
            // Pre-filled form data — SignupScreen reads these from route.params
            prefillFirstName: signupReturnData.firstName,
            prefillLastName: signupReturnData.lastName,
            prefillEmail: signupReturnData.email,
            prefillReferralCode: signupReturnData.referralCode,
          });
          return;
        }

        navigation.navigate('UserTypeSelection', {
          phoneNumber,
          msg91AccessToken: String(msg91AccessToken),
          otpSignupToken: newOtpSignupToken,
        });
        return;
      }

      throw new Error(`Login failed. ${JSON.stringify({ userExists: (result as any)?.userExists, verified: (result as any)?.verified })}`);
    } catch (err: any) {
      const errMsg = getErrorMessage(err) || 'Invalid OTP';
      // Detect network errors — keep OTP digits so user can retry without re-typing
      const isNetworkError =
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('timeout') ||
        errMsg.toLowerCase().includes('connection') ||
        errMsg.toLowerCase().includes('failed to fetch') ||
        errMsg.toLowerCase().includes('xhr') ||
        errMsg.toLowerCase().includes('socket') ||
        err?.name === 'AbortError' ||
        err?.code === 'ECONNREFUSED' ||
        err?.status === 0;

      if (isNetworkError) {
        // Keep digits so user can tap retry without re-typing
        showAlert(
          'Network Error',
          'Could not connect to server. Please check your connection and tap "Verify & Continue" to try again.',
        );
      } else {
        // Real OTP error (wrong code, expired, etc.) — clear digits
        showAlert('Error', errMsg);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer === 0) {
      try {
        setLocalLoading(true);
        const reqIdToUse = String(currentReqId || '').trim();
        if (!reqIdToUse) {
          throw new Error('OTP request expired. Please go back and request OTP again.');
        }

        const retryResp: any = await OTPWidget.retryOTP({ reqId: reqIdToUse } as any);

        if (retryResp && typeof retryResp === 'object') {
          const respType = String((retryResp as any)?.type || '').toLowerCase();
          const respCode = (retryResp as any)?.code;
          if (respType === 'error') {
            throw new Error(String((retryResp as any)?.message || (retryResp as any)?.error || 'Failed to resend OTP'));
          }
          if (respCode && String(respCode) !== '200' && respType !== 'success') {
            throw new Error(String((retryResp as any)?.message || (retryResp as any)?.error || 'Failed to resend OTP'));
          }
        }

        const newReqId = extractReqId(retryResp);
        if (newReqId && newReqId !== reqIdToUse) {
          setCurrentReqId(newReqId);
        }

        setTimer(30);
      } catch (err: any) {
        try {
          const identifier = String(msg91Identifier || '').trim();
          if (!identifier) {
            throw err;
          }

          const sendResp: any = await OTPWidget.sendOTP({ identifier } as any);
          const newReqId = extractReqId(sendResp);
          if (!newReqId) {
            throw new Error(getErrorMessage(err) || 'Failed to resend OTP');
          }
          setCurrentReqId(newReqId);
          setTimer(30);
        } catch (fallbackErr: any) {
          showAlert('Error', getErrorMessage(fallbackErr) || 'Failed to resend OTP');
        }
      } finally {
        setLocalLoading(false);
      }
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

      <View style={styles.content}>
        <SlideUp delay={100} distance={20}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.phoneText}>{phoneNumber}</Text>
            </Text>
          </View>
        </SlideUp>

        <ScaleIn delay={250}>
          <View style={styles.otpContainer}>
            {/* Hidden input for SMS auto-fill — captures full OTP from keyboard suggestion */}
            <TextInput
              style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
              keyboardType="number-pad"
              textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : undefined}
              maxLength={6}
              onChangeText={handleAutoFillChange}
              autoFocus={false}
            />
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  focusedIndex === index && styles.otpInputFocused,
                  digit !== '' && styles.otpInputFilled,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(null)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>
        </ScaleIn>

        {(isLoading || localLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#C9A84C" />
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
  phoneText: {
    color: G.textPrimary,
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
    borderWidth: 1.5,
    borderColor: G.border3,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: G.textPrimary,
    backgroundColor: G.glass2,
  },
  otpInputFocused: {
    borderColor: G.accent,
    borderWidth: 2,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  otpInputFilled: {
    borderColor: 'rgba(201, 168, 76, 0.5)',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: G.textSecondary,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  verifyButton: {
    backgroundColor: G.accent,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    shadowColor: G.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  verifyButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  timerText: {
    fontSize: 14,
    color: G.textSecondary,
  },
  resendText: {
    fontSize: 14,
    color: G.accent,
    fontWeight: '600',
  },
});

export default OtpVerificationScreen;
