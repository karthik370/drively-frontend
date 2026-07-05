import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { verifyMsg91AccessToken } from '../../redux/slices/authSlice';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { FadeIn, SlideUp, ScaleIn } from '../../components/premium/AnimatedComponents';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const OtpVerificationScreen = ({ route, navigation }: any) => {
  const { phoneNumber, reqId, msg91Identifier, signupReturnData, userType } = route.params;
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector((state) => state.auth);
  const [localLoading, setLocalLoading] = useState(false);
  const [currentReqId, setCurrentReqId] = useState(String(reqId || '').trim());

  // ── OTP state: single string instead of array ──────────────────────────────
  // Production pattern (PhonePe/Google Pay style): one transparent TextInput
  // overlaid on 6 visual boxes. Android SMS auto-fill + iOS one-time-code work
  // reliably only when there is ONE focused input — not 6 individual boxes.
  const [otpValue, setOtpValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [timer, setTimer] = useState(30);
  const hiddenInputRef = useRef<TextInput | null>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Focus the hidden input as soon as screen mounts (required for iOS one-time-code keyboard banner)
  useEffect(() => {
    const t = setTimeout(() => hiddenInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

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
    if (typeof response === 'string') { try { response = JSON.parse(response); } catch { } }
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
      try { payload = JSON.parse(trimmed); }
      catch {
        const looksLikeToken = trimmed.length >= 20 && !trimmed.includes(' ') &&
          trimmed.toLowerCase() !== 'success' && trimmed.toLowerCase() !== 'verified' &&
          trimmed.toLowerCase() !== 'otp verified';
        return looksLikeToken ? trimmed : '';
      }
    }

    const findAccessTokenRecursive = (node: any, depth = 0): string => {
      if (!node || depth > 10) return '';
      if (typeof node === 'string') return '';
      if (Array.isArray(node)) {
        for (const item of node) { const found = findAccessTokenRecursive(item, depth + 1); if (found) return found; }
        return '';
      }
      if (typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          const key = String(k).toLowerCase();
          const isAccessTokenKey = key === 'access-token' || key === 'accesstoken' || key === 'access_token';
          const isGenericTokenKey = key === 'token' || key === 'jwt' || key === 'jwt_token' || key === 'jwttoken';
          if (isAccessTokenKey && typeof v === 'string' && v.trim()) return v.trim();
          if (isGenericTokenKey && typeof v === 'string' && v.trim() && v.trim().length >= 20) return v.trim();
          if ((key.includes('access') && key.includes('token')) && typeof v === 'string' && v.trim()) return v.trim();
          const found = findAccessTokenRecursive(v, depth + 1);
          if (found) return found;
        }
      }
      return '';
    };

    const candidates = [
      (payload as any)?.['access-token'], (payload as any)?.accessToken, (payload as any)?.access_token,
      (payload as any)?.data?.['access-token'], (payload as any)?.data?.accessToken, (payload as any)?.data?.access_token,
      (payload as any)?.token, (payload as any)?.jwt, (payload as any)?.jwtToken,
      (payload as any)?.data?.token, (payload as any)?.data?.jwt, (payload as any)?.data?.jwtToken,
      (payload as any)?.message, (payload as any)?.data?.message,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        const v = c.trim();
        if (v.toLowerCase() === 'success' || v.toLowerCase() === 'verified' || v.toLowerCase() === 'otp verified') continue;
        return v;
      }
    }
    const msg = (payload as any)?.message;
    if (msg && typeof msg === 'object') {
      const nested = [(msg as any)?.['access-token'], (msg as any)?.accessToken, (msg as any)?.access_token];
      for (const c of nested) { if (typeof c === 'string' && c.trim()) return c.trim(); }
    }
    return findAccessTokenRecursive(payload);
  };

  // ── Auto-submit when all 6 digits filled ───────────────────────────────────
  const tryAutoSubmit = useCallback((digits: string) => {
    if (verifyingRef.current || localLoading || isLoading) return;
    if (digits.length === 6) {
      verifyingRef.current = true;
      handleVerifyOtp(digits).finally(() => { verifyingRef.current = false; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localLoading, isLoading]);

  // ── Single input handler — works for typing AND SMS auto-fill ──────────────
  const handleOtpChange = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setOtpValue(digits);
    if (digits.length === 6) {
      hiddenInputRef.current?.blur();
      tryAutoSubmit(digits);
    }
  }, [tryAutoSubmit]);

  // ── Verify via MSG91 ───────────────────────────────────────────────────────
  const handleVerifyOtp = async (otpCode: string) => {
    if (verifyingRef.current && otpCode === otpValue) {
      // Only the auto-submit guard sets this, manual tap is allowed
    }
    if (localLoading || isLoading) return;

    try {
      setLocalLoading(true);
      const reqIdToUse = String(currentReqId || '').trim();
      if (!reqIdToUse) throw new Error('OTP request expired. Please go back and request OTP again.');

      const attemptVerify = async () =>
        OTPWidget.verifyOTP({ reqId: reqIdToUse, otp: String(otpCode || '').trim() } as any);

      let verifyResp: any;
      try { verifyResp = await attemptVerify(); }
      catch { await new Promise((r) => setTimeout(r, 300)); verifyResp = await attemptVerify(); }

      if (verifyResp && typeof verifyResp === 'object') {
        const respType = String((verifyResp as any)?.type || '').toLowerCase();
        const respCode = (verifyResp as any)?.code;
        const respMessage = String((verifyResp as any)?.message || '');
        if (respMessage === 'AuthenticationFailure') {
          await new Promise((r) => setTimeout(r, 600));
          verifyResp = await attemptVerify();
        }
        if (respType === 'error') throw new Error(String((verifyResp as any)?.message || 'OTP verification failed'));
        if (respCode && String(respCode) !== '200' && respType !== 'success')
          throw new Error(String((verifyResp as any)?.message || 'OTP verification failed'));
      }

      const msg91AccessToken = extractMsg91AccessToken(verifyResp);
      if (!msg91AccessToken) {
        const debug = verifyResp && typeof verifyResp === 'object'
          ? { type: (verifyResp as any)?.type, code: (verifyResp as any)?.code, message: (verifyResp as any)?.message }
          : { type: typeof verifyResp };
        throw new Error(`OTP verification failed. access-token missing. ${JSON.stringify(debug)}`);
      }

      const result = await dispatch(
        verifyMsg91AccessToken({ accessToken: String(msg91AccessToken), phoneNumber })
      ).unwrap();

      if (result?.accessToken && result?.refreshToken) return; // existing user — auth state updates, navigator redirects

      const userExistsRaw = (result as any)?.userExists;
      const userExistsStr = String(userExistsRaw).toLowerCase();
      if (userExistsRaw === false || userExistsRaw === 0 || userExistsStr === 'false' || userExistsStr === '0') {
        const newOtpSignupToken = (result as any)?.otpSignupToken;

        // Resume from incomplete signup (app was closed mid-flow)
        if (signupReturnData && newOtpSignupToken) {
          navigation.navigate('Signup', {
            phoneNumber,
            userType: signupReturnData.userType,
            msg91AccessToken: String(msg91AccessToken),
            otpSignupToken: newOtpSignupToken,
            prefillFirstName: signupReturnData.firstName,
            prefillLastName: signupReturnData.lastName,
            prefillEmail: signupReturnData.email,
            prefillReferralCode: signupReturnData.referralCode,
          });
          return;
        }

        // Happy path: userType was pre-selected on WelcomeScreen → go straight to Signup
        if (userType) {
          navigation.navigate('Signup', {
            phoneNumber,
            userType,
            msg91AccessToken: String(msg91AccessToken),
            otpSignupToken: newOtpSignupToken,
          });
          return;
        }

        // Fallback: userType not known (pending signup restore) → show selection screen
        navigation.navigate('UserTypeSelection', {
          phoneNumber,
          msg91AccessToken: String(msg91AccessToken),
          otpSignupToken: newOtpSignupToken,
        });
        return;
      }

      throw new Error(`Login failed. ${JSON.stringify({ userExists: (result as any)?.userExists })}`);
    } catch (err: any) {
      const errMsg = getErrorMessage(err) || 'Invalid OTP';
      const isNetworkError = errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('timeout') ||
        errMsg.toLowerCase().includes('connection') || errMsg.toLowerCase().includes('failed to fetch') ||
        err?.name === 'AbortError' || err?.code === 'ECONNREFUSED' || err?.status === 0;
      const isAlreadyVerified = errMsg.toLowerCase().includes('already used') || errMsg.toLowerCase().includes('already verified');

      if (isNetworkError) {
        showAlert('Network Error', 'Could not connect. Check your connection and tap Verify again.');
      } else if (isAlreadyVerified) {
        showAlert('Already Verified', 'Your OTP was already verified. Go back and request a new OTP if needed.');
      } else {
        showAlert('Error', errMsg);
        setOtpValue('');
        setTimeout(() => hiddenInputRef.current?.focus(), 100);
      }
    } finally {
      setLocalLoading(false);
      verifyingRef.current = false;
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      setLocalLoading(true);
      const reqIdToUse = String(currentReqId || '').trim();
      if (!reqIdToUse) throw new Error('OTP request expired. Please go back and try again.');
      const retryResp: any = await OTPWidget.retryOTP({ reqId: reqIdToUse } as any);
      if (retryResp && typeof retryResp === 'object') {
        const respType = String((retryResp as any)?.type || '').toLowerCase();
        const respCode = (retryResp as any)?.code;
        if (respType === 'error') throw new Error(String((retryResp as any)?.message || 'Failed to resend'));
        if (respCode && String(respCode) !== '200' && respType !== 'success')
          throw new Error(String((retryResp as any)?.message || 'Failed to resend'));
      }
      const newReqId = extractReqId(retryResp);
      if (newReqId && newReqId !== reqIdToUse) setCurrentReqId(newReqId);
      setTimer(30);
      setOtpValue('');
      setTimeout(() => hiddenInputRef.current?.focus(), 100);
    } catch (err: any) {
      try {
        const identifier = String(msg91Identifier || '').trim();
        if (!identifier) throw err;
        const sendResp: any = await OTPWidget.sendOTP({ identifier } as any);
        const newReqId = extractReqId(sendResp);
        if (!newReqId) throw new Error(getErrorMessage(err) || 'Failed to resend OTP');
        setCurrentReqId(newReqId);
        setTimer(30);
        setOtpValue('');
        setTimeout(() => hiddenInputRef.current?.focus(), 100);
      } catch (fallbackErr: any) {
        showAlert('Error', getErrorMessage(fallbackErr) || 'Failed to resend OTP');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  // ── Cursor blink ───────────────────────────────────────────────────────────
  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    if (!isFocused) return;
    const t = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, [isFocused]);

  // Active box = where next digit goes
  const activeBotIndex = Math.min(otpValue.length, 5);
  const allFilled = otpValue.length === 6;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
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
          {/*
           * ── OTP Input: single transparent TextInput over 6 visual boxes ──
           *
           * WHY THIS WORKS (and 6 individual inputs don't):
           *   • Android SMS auto-fill (autoComplete="sms-otp") targets the ONE
           *     focused input. With 6 inputs, Android doesn't know which to fill.
           *   • iOS one-time-code keyboard banner fills the focused input and
           *     requires textContentType="oneTimeCode" on that exact input.
           *   • The input is NOT hidden (opacity:0 + height:0 = auto-fill blocked).
           *     It's transparent and overlaid over the boxes at real size.
           */}
          <Pressable
            style={styles.otpContainer}
            onPress={() => hiddenInputRef.current?.focus()}
          >
            {/* Single real input — transparent, covers the boxes */}
            <TextInput
              ref={hiddenInputRef}
              style={styles.hiddenInput}
              value={otpValue}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              // iOS: shows OTP suggestion from keyboard banner
              textContentType="oneTimeCode"
              // Android: triggers SMS auto-retriever
              autoComplete="sms-otp"
              autoFocus
              caretHidden
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />

            {/* 6 visual display boxes — NOT TextInputs, just UI */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const digit = otpValue[i] ?? '';
              const isActive = isFocused && i === activeBotIndex && !allFilled;
              const isFilled = digit !== '';
              return (
                <View
                  key={i}
                  style={[
                    styles.otpBox,
                    isFilled && styles.otpBoxFilled,
                    isActive && styles.otpBoxActive,
                  ]}
                >
                  {digit ? (
                    <Text style={styles.otpDigit}>{digit}</Text>
                  ) : isActive && cursorVisible ? (
                    <View style={styles.cursor} />
                  ) : null}
                </View>
              );
            })}
          </Pressable>
        </ScaleIn>

        {(isLoading || localLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#C9A84C" />
            <Text style={styles.loadingText}>Verifying…</Text>
          </View>
        )}

        <View style={styles.resendContainer}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!allFilled || isLoading || localLoading) && styles.disabledButton,
            ]}
            onPress={() => handleVerifyOtp(otpValue)}
            disabled={!allFilled || isLoading || localLoading}
          >
            {isLoading || localLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          {timer > 0 ? (
            <Text style={styles.timerText}>Resend code in {timer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={localLoading}>
              <Text style={styles.resendText}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  titleContainer: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: G.textPrimary, marginBottom: 12 },
  subtitle: { fontSize: 16, color: G.textSecondary, lineHeight: 24 },
  phoneText: { color: G.textPrimary, fontWeight: '600' },

  // OTP container — Pressable so tapping anywhere focuses the hidden input
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    position: 'relative',
  },

  // The real TextInput: transparent text, no border, overlaid over boxes
  // It has real dimensions so Android's SMS auto-fill API can target it
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    zIndex: 10,
    fontSize: 24,
    letterSpacing: 40,  // spaces out chars roughly over the boxes
    opacity: 0.01,      // visually invisible but NOT zero — auto-fill can target it
  },

  // Visual digit boxes (plain Views, not TextInputs)
  otpBox: {
    width: 50,
    height: 60,
    borderWidth: 1.5,
    borderColor: G.border3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.glass2,
  },
  otpBoxActive: {
    borderColor: G.accent,
    borderWidth: 2,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  otpBoxFilled: {
    borderColor: 'rgba(201,168,76,0.5)',
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: '600',
    color: G.textPrimary,
  },
  cursor: {
    width: 2,
    height: 28,
    backgroundColor: G.accent,
    borderRadius: 1,
  },

  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { marginTop: 8, fontSize: 14, color: G.textSecondary },

  resendContainer: { alignItems: 'center', marginTop: 24 },
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
  verifyButtonText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  disabledButton: { opacity: 0.6 },
  timerText: { fontSize: 14, color: G.textSecondary },
  resendText: { fontSize: 14, color: G.accent, fontWeight: '600' },
});

export default OtpVerificationScreen;
