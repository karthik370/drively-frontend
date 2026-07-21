/**
 * DriverDocumentsSubmitScreen
 * ───────────────────────────
 * Single-screen KYC flow powered by Didit.
 * One button → opens Didit WebView → comes back verified.
 *
 * States:
 *   - Loading:   fetching KYC status from server
 *   - Not started / Failed: show "Start Verification" button
 *   - In Review: show "Under Review" status with info
 *   - Completed: show verified badge → user can proceed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { loadKycStatus } from '../../redux/slices/driverSlice';
import { logout } from '../../redux/slices/authSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { G, glass } from '../../constants/glassStyles';
import {
  createKycSession,
  createOnboardingSupportTicket,
} from '../../services/api';

// ── Pulsing Dot (for "Under Review" indicator) ─────────────────────────────
const PulsingDot = ({ color = G.accent }: { color?: string }) => {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.pulsingDot, { backgroundColor: color, opacity: pulse }]} />;
};

// ── Main Component ──────────────────────────────────────────────────────────
const DriverDocumentsSubmitScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const kyc = useAppSelector((s) => s.driver.kyc);
  const kycLoading = useAppSelector((s) => s.driver.kycLoading);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Load KYC status on mount & on screen focus
  useEffect(() => {
    dispatch(loadKycStatus());
  }, [dispatch]);

  // Re-fetch KYC on focus (e.g. coming back from WebView)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      dispatch(loadKycStatus());
    });
    return unsubscribe;
  }, [navigation, dispatch]);

  // ── Start Didit Session ─────────────────────────────────────────────────
  const handleStartVerification = useCallback(async () => {
    setSessionLoading(true);
    try {
      const session = await createKycSession();
      navigation.navigate('KycWebView' as never, {
        verificationUrl: session.verificationUrl,
        sessionId: session.sessionId,
      } as never);
    } catch (e: any) {
      showAlert(
        'Could Not Start Verification',
        e?.message || 'Failed to start verification. Please try again.'
      );
    } finally {
      setSessionLoading(false);
    }
  }, [navigation]);

  // ── Determine what to show ──────────────────────────────────────────────
  const isCompleted = kyc?.status === 'COMPLETED';
  const isFailed = kyc?.status === 'FAILED';
  const isLoading = kycLoading && !kyc;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Identity Verification</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => dispatch(logout())}
        >
          <Icon name="logout" size={18} color={G.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Loading State ─────────────────────────────────────────── */}
        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={G.accent} />
            <Text style={styles.loadingText}>Loading verification status...</Text>
          </View>
        )}

        {/* ── Completed State ───────────────────────────────────────── */}
        {isCompleted && (
          <View style={[glass.cardAccent, styles.completedCard]}>
            <View style={styles.completedIconWrap}>
              <Icon name="check-decagram" size={48} color={G.accent} />
            </View>
            <Text style={styles.completedTitle}>Identity Verified! 🎉</Text>
            <Text style={styles.completedSubtitle}>
              All your documents have been verified successfully. You can now proceed to subscribe and start driving.
            </Text>

            {/* Verification details */}
            <View style={styles.verifiedDetails}>
              {kyc.aadhaarVerified && (
                <View style={styles.verifiedRow}>
                  <Icon name="check-circle" size={16} color={G.success} />
                  <Text style={styles.verifiedText}>Aadhaar Verified</Text>
                </View>
              )}
              {kyc.dlVerified && (
                <View style={styles.verifiedRow}>
                  <Icon name="check-circle" size={16} color={G.success} />
                  <Text style={styles.verifiedText}>Driving License Verified</Text>
                </View>
              )}
              {kyc.faceMatchPassed && (
                <View style={styles.verifiedRow}>
                  <Icon name="check-circle" size={16} color={G.success} />
                  <Text style={styles.verifiedText}>Face Match Passed</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Not Completed — Start Verification ───────────────────── */}
        {!isCompleted && !isLoading && (
          <>
            {/* Explainer Card */}
            <View style={[glass.cardAccent, styles.explainerCard]}>
              <View style={styles.shieldWrap}>
                <Icon name="shield-check-outline" size={56} color={G.accent} />
              </View>
              <Text style={styles.explainerTitle}>Verify Your Identity</Text>
              <Text style={styles.explainerText}>
                To start driving, we need to verify your identity. Our automated system will scan your documents and match your face — all in one quick step.
              </Text>

              {/* What you need */}
              <View style={styles.requirementsList}>
                <View style={styles.requirementRow}>
                  <Icon name="card-account-details" size={20} color={G.accent} />
                  <View style={styles.requirementTextWrap}>
                    <Text style={styles.requirementLabel}>Aadhaar Card</Text>
                    <Text style={styles.requirementHint}>Keep your physical card ready</Text>
                  </View>
                </View>
                <View style={styles.requirementRow}>
                  <Icon name="car" size={20} color={G.accent} />
                  <View style={styles.requirementTextWrap}>
                    <Text style={styles.requirementLabel}>Driving License</Text>
                    <Text style={styles.requirementHint}>Valid driving license</Text>
                  </View>
                </View>
                <View style={styles.requirementRow}>
                  <Icon name="face-recognition" size={20} color={G.accent} />
                  <View style={styles.requirementTextWrap}>
                    <Text style={styles.requirementLabel}>Selfie / Face Match</Text>
                    <Text style={styles.requirementHint}>Camera access needed for liveness check</Text>
                  </View>
                </View>
              </View>

              {/* Failed state — show reason */}
              {isFailed && kyc?.failureReason && (
                <View style={styles.failedBox}>
                  <Icon name="alert-circle" size={18} color="#fca5a5" />
                  <Text style={styles.failedText}>
                    Previous attempt failed: {kyc.failureReason}
                  </Text>
                </View>
              )}

              {/* Start button */}
              <TouchableOpacity
                style={[styles.startBtn, sessionLoading && styles.startBtnDisabled]}
                onPress={handleStartVerification}
                disabled={sessionLoading}
                activeOpacity={0.85}
              >
                {sessionLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Icon name="shield-check" size={20} color="#000" />
                    <Text style={styles.startBtnText}>
                      {isFailed ? 'Retry Verification' : 'Start Verification'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.poweredBy}>
                <Text style={styles.poweredByText}>Secured by Didit • Takes ~2 minutes</Text>
              </View>
            </View>
          </>
        )}

        {/* ── Help Link (always visible when not completed) ─────────── */}
        {!isCompleted && !isLoading && (
          <TouchableOpacity
            style={styles.helpLink}
            activeOpacity={0.7}
            onPress={async () => {
              try {
                const ticket = await createOnboardingSupportTicket(
                  'I need help completing the identity verification process.'
                );
                navigation.navigate('SupportChat', {
                  bookingId: ticket.bookingId,
                  title: 'Verification Support',
                });
              } catch { /* silent fail */ }
            }}
          >
            <Icon name="headset" size={15} color={G.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.helpLinkText}>Having trouble? Contact Support</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '900', color: G.textPrimary },
  logoutButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  logoutText: { marginLeft: 6, color: G.error, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },

  // Loading
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: G.textSecondary,
  },

  // Completed Card
  completedCard: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 28,
  },
  completedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.accentSoft,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: G.textPrimary,
    marginBottom: 8,
  },
  completedSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: G.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  verifiedDetails: {
    gap: 8,
    width: '100%',
    paddingHorizontal: 20,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '600',
    color: G.success,
  },

  // Explainer Card
  explainerCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  shieldWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.accentSoft,
    marginBottom: 20,
  },
  explainerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: G.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  explainerText: {
    fontSize: 14,
    fontWeight: '500',
    color: G.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },

  // Requirements list
  requirementsList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.12)',
  },
  requirementTextWrap: {
    flex: 1,
  },
  requirementLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: G.textPrimary,
  },
  requirementHint: {
    fontSize: 12,
    fontWeight: '500',
    color: G.textMuted,
    marginTop: 2,
  },

  // Failed state
  failedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginBottom: 20,
    width: '100%',
  },
  failedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fca5a5',
    lineHeight: 18,
  },

  // Start button
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    width: '100%',
  },
  startBtnDisabled: {
    opacity: 0.7,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
  },

  // Powered by
  poweredBy: {
    marginTop: 12,
  },
  poweredByText: {
    fontSize: 11,
    fontWeight: '500',
    color: G.textMuted,
  },

  // Help link
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  helpLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: G.textMuted,
    textDecorationLine: 'underline',
  },

  // Pulsing dot (for future use if needed)
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default DriverDocumentsSubmitScreen;
