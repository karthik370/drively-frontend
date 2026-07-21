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
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { loadKycStatus } from '../../redux/slices/driverSlice';
import { loadUser } from '../../redux/slices/authSlice';
import { logout } from '../../redux/slices/authSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { G, glass } from '../../constants/glassStyles';
import {
  createKycSession,
  createOnboardingSupportTicket,
  uploadDriverImage,
  updateMyProfile,
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
  const user = useAppSelector((s) => s.auth.user);
  const [sessionLoading, setSessionLoading] = useState(false);

  // ── Profile Photo State ──────────────────────────────────────────────────
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const hasProfilePhoto = !!(user?.profileImage || photoUri);

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

  // ── Profile Photo Capture + Upload ──────────────────────────────────────
  const handleTakePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Camera Permission Required', 'Please allow camera access to take your profile photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],  // square crop for profile photo
        quality: 0.5,
        base64: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e: any) {
      showAlert('Camera Error', e?.message || 'Could not open camera.');
    }
  }, []);

  const handleUploadPhoto = useCallback(async () => {
    if (!photoUri) return;
    setPhotoUploading(true);
    try {
      // Upload image to Cloudinary via backend
      const uploaded = await uploadDriverImage({
        uri: photoUri,
        mimeType: 'image/jpeg',
        fileName: `profile_${Date.now()}.jpg`,
        kind: 'profile',
      });

      // Save the Cloudinary URL to user profile (include required name fields)
      await updateMyProfile({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        profileImage: uploaded.fileUrl,
      });

      // Refresh user in Redux so profileImage is updated everywhere
      await dispatch(loadUser());

      showAlert('Profile Photo Saved! ✅', 'Your profile photo has been updated.');
      setPhotoUri(null);
    } catch (e: any) {
      showAlert('Upload Failed', e?.message || 'Could not upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  }, [photoUri, dispatch]);


  const handleStartVerification = useCallback(async () => {
    // Resume any existing session URL directly — don't create a new one
    // Covers: IN_PROGRESS (mid-flow), REVIEW_PENDING (all steps done, under review),
    // FAILED (retry same session — Didit allows re-entry), NOT_STARTED (had URL but abandoned)
    if (kyc?.diditSessionUrl && kyc?.diditSessionId) {
      navigation.navigate('KycWebView' as never, {
        verificationUrl: kyc.diditSessionUrl,
        sessionId: kyc.diditSessionId,
      } as never);
      return;
    }

    // No session URL in DB → create a brand new session
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
  }, [navigation, kyc]);

  // ── Determine what to show ──────────────────────────────────────────────
  const isCompleted     = kyc?.status === 'COMPLETED';
  const isFailed        = kyc?.status === 'FAILED';
  const isReviewPending = kyc?.status === 'REVIEW_PENDING';
  const isInProgress    = kyc?.status === 'IN_PROGRESS';
  const isLoading       = kycLoading && !kyc;

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

            {/* ── Profile Photo Card (fallback if auto-upload from Didit failed) ── */}
            {!hasProfilePhoto && (
              <View style={styles.photoCard}>
                <View style={styles.photoCardHeader}>
                  <Icon name="camera-account" size={22} color="#F59E0B" />
                  <Text style={styles.photoCardTitle}>Profile Photo Missing</Text>
                </View>
                <Text style={styles.photoCardSubtitle}>
                  Your profile photo is normally captured automatically during verification. If it wasn't set, please take one below — it's shown to customers during trips.
                </Text>

                {/* Preview */}
                {photoUri ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                      <Icon name="camera-retake" size={16} color="#fff" />
                      <Text style={styles.retakeBtnText}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
                    <Icon name="camera-plus" size={22} color="#000" />
                    <Text style={styles.cameraBtnText}>Take Selfie Now</Text>
                  </TouchableOpacity>
                )}

                {/* Upload button — only show after photo is taken */}
                {photoUri && (
                  <TouchableOpacity
                    style={[styles.uploadBtn, photoUploading && styles.uploadBtnDisabled]}
                    onPress={handleUploadPhoto}
                    disabled={photoUploading}
                    activeOpacity={0.85}
                  >
                    {photoUploading ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Icon name="cloud-upload" size={18} color="#000" />
                        <Text style={styles.uploadBtnText}>Save as Profile Photo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Profile photo set (auto from Didit or manual) ─────────── */}
            {hasProfilePhoto && (
              <View style={styles.photoSetRow}>
                <Image
                  source={{ uri: user?.profileImage || photoUri || undefined }}
                  style={styles.profileThumb}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoSetTitle}>Profile Photo Set ✅</Text>
                  <Text style={styles.photoSetSub}>Shown to customers during trips</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Under Review State ──────────────────────────────────── */}
        {isReviewPending && (
          <View style={[glass.cardAccent, styles.completedCard]}>
            <View style={[styles.completedIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Icon name="clock-check-outline" size={48} color="#F59E0B" />
            </View>
            <Text style={styles.completedTitle}>Under Review ⏳</Text>
            <Text style={styles.completedSubtitle}>
              Your verification is being reviewed by our team. This usually takes a few hours. We'll notify you once it's complete.
            </Text>

            <View style={[styles.verifiedDetails, { marginTop: 16 }]}>
              <View style={[styles.verifiedRow, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                <PulsingDot color="#F59E0B" />
                <Text style={[styles.verifiedText, { color: '#F59E0B' }]}>Manual review in progress</Text>
              </View>
            </View>

            {/* Reopen session button — resume same Didit session */}
            {kyc?.diditSessionUrl && (
              <TouchableOpacity
                style={[styles.startBtn, { marginTop: 16, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' }]}
                onPress={handleStartVerification}
                activeOpacity={0.85}
              >
                <Icon name="eye-check-outline" size={20} color="#F59E0B" />
                <Text style={[styles.startBtnText, { color: '#F59E0B' }]}>Check Verification Status</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Not Completed — Start Verification ───────────────────── */}
        {!isCompleted && !isReviewPending && !isLoading && (
          <>
            {/* Explainer Card */}
            <View style={[glass.cardAccent, styles.explainerCard]}>
              <View style={styles.shieldWrap}>
                <Icon name="shield-check-outline" size={56} color={G.accent} />
              </View>
              <Text style={styles.explainerTitle}>
                {isInProgress ? 'Resume Verification' : 'Verify Your Identity'}
              </Text>
              <Text style={styles.explainerText}>
                {isInProgress
                  ? 'You have an ongoing verification session. Tap below to resume where you left off.'
                  : 'To start driving, we need to verify your identity. Our automated system will scan your documents and match your face — all in one quick step.'}
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

              {/* Start / Resume button */}
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
                    <Icon
                      name={isInProgress || (kyc?.diditSessionUrl && kyc?.diditSessionId) ? 'play-circle' : 'shield-check'}
                      size={20}
                      color="#000"
                    />
                    <Text style={styles.startBtnText}>
                      {isInProgress || (kyc?.diditSessionUrl && kyc?.diditSessionId)
                        ? 'Resume Verification'
                        : isFailed
                        ? 'Retry Verification'
                        : 'Start Verification'}
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
        {!isCompleted && !isReviewPending && !isLoading && (
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

  // Pulsing dot
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // ── Profile Photo Card ─────────────────────────────────────────────────
  photoCard: {
    marginTop: 20,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    gap: 12,
  },
  photoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: G.textPrimary,
  },
  photoCardSubtitle: {
    fontSize: 12,
    color: G.textMuted,
    lineHeight: 18,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: G.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  cameraBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  photoPreviewWrap: {
    alignItems: 'center',
    gap: 10,
  },
  photoPreview: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: G.accent,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: G.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  photoSetRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: 12,
    width: '100%',
  },
  profileThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: G.success,
  },
  photoSetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: G.success,
  },
  photoSetSub: {
    fontSize: 12,
    color: G.textMuted,
    marginTop: 2,
  },
});

export default DriverDocumentsSubmitScreen;
