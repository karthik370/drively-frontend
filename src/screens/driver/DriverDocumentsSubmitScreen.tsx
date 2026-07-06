import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDriverVerification, setKycStatus, loadKycStatus } from '../../redux/slices/driverSlice';
import { logout, loadUser } from '../../redux/slices/authSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { G, glass } from '../../constants/glassStyles';
import {
  initiateKyc,
  verifyAadhaarDirect,
  submitKycFallback,
  submitKycSelfie,
  submitKycDLPhoto,
  KycStatusResponse,
  createOnboardingSupportTicket,
} from '../../services/api';

// ── Step Constants ──────────────────────────────────────────────────────────
const STEPS = [
  { key: 'aadhaar', label: 'Aadhaar', icon: 'shield-lock' },
  { key: 'documents', label: 'PAN & DL', icon: 'file-document-edit' },
  { key: 'dl-photo', label: 'DL Photo', icon: 'card-account-details' },
  { key: 'selfie', label: 'Selfie', icon: 'face-recognition' },
] as const;

type StepKey = 'aadhaar' | 'documents' | 'dl-photo' | 'selfie';

// ── Helpers ─────────────────────────────────────────────────────────────────
const getActiveStep = (kyc: KycStatusResponse | null): StepKey => {
  if (!kyc || kyc.status === 'NOT_STARTED') return 'aadhaar';
  if (!kyc.aadhaarVerified) return 'aadhaar';
  if (!kyc.panVerified || !kyc.dlVerified) return 'documents';
  // PAN+DL numbers verified but face match not yet pending → DL photo step
  if (kyc.status === 'FALLBACK_PENDING') return 'dl-photo';
  // Face match pending/failed → selfie step
  if (kyc.status === 'FACE_MATCH_PENDING') return 'selfie';
  if (kyc.status === 'FAILED') {
    if (!kyc.aadhaarVerified) return 'aadhaar';
    if (!kyc.panVerified || !kyc.dlVerified) return 'documents';
    return 'selfie';
  }
  return 'selfie';
};

const getProgressPercent = (kyc: KycStatusResponse | null): number => {
  if (!kyc) return 0;
  let progress = 0;
  if (kyc.aadhaarVerified) progress += 25;
  if (kyc.panVerified) progress += 25;
  if (kyc.dlVerified) progress += 25;
  if (kyc.faceMatchPassed) progress += 25;
  return progress;
};

// ── Pulsing Dot Indicator ───────────────────────────────────────────────────
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

  const [loading, setLoading] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [fullName, setFullName] = useState('');         // required by Didit for Aadhaar
  const [aadhaarPan, setAadhaarPan] = useState('');     // required by Didit alongside Aadhaar
  const [aadhaarDobInput, setAadhaarDobInput] = useState(''); // required by Didit for Aadhaar
  const [panNumber, setPanNumber] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dobInput, setDobInput] = useState('');
  const [dlPhotoUri, setDlPhotoUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load KYC status on mount
  useEffect(() => {
    dispatch(loadKycStatus());
  }, [dispatch]);

  // Auto-fill DOB from Aadhaar once KYC status loads
  // This prevents wrong DOB input that causes DL verification to fail (VAHAN mismatch)
  useEffect(() => {
    if (kyc?.aadhaarDob && !dobInput) {
      // Convert YYYY-MM-DD → DD/MM/YYYY for display
      const parts = kyc.aadhaarDob.split('-');
      if (parts.length === 3) {
        setDobInput(`${parts[2]}/${parts[1]}/${parts[0]}`);
      }
    }
  }, [kyc?.aadhaarDob]);

  // ── Step 1: Aadhaar Verification (Didit — requires 4 fields) ──────────────
  const handleVerifyAadhaar = useCallback(async () => {
    const cleaned = aadhaarNumber.replace(/\s/g, '');
    if (cleaned.length !== 12 || !/^\d{12}$/.test(cleaned)) {
      showAlert('Invalid Aadhaar', 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (!fullName.trim()) {
      showAlert('Name Required', 'Please enter your full name as shown on Aadhaar.');
      return;
    }
    const cleanPan = aadhaarPan.trim().toUpperCase();
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(cleanPan)) {
      showAlert('Invalid PAN', 'Please enter a valid PAN number (e.g. ABCDE1234F).');
      return;
    }
    // Parse and validate DOB
    let dobFormatted = '';
    const dobTrimmed = aadhaarDobInput.trim();
    const slashMatch = dobTrimmed.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/);
    if (slashMatch) {
      dobFormatted = `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dobTrimmed)) {
      dobFormatted = dobTrimmed;
    } else {
      showAlert('Invalid Date', 'Please enter your date of birth as DD/MM/YYYY.');
      return;
    }
    if (isNaN(new Date(dobFormatted).getTime())) {
      showAlert('Invalid Date', 'Please enter a valid date of birth.');
      return;
    }

    setLoading(true);
    try {
      const status = await verifyAadhaarDirect(cleaned, fullName.trim(), cleanPan, dobFormatted);
      dispatch(setKycStatus(status));
      showAlert('Aadhaar Verified ✅', 'Your Aadhaar has been verified successfully!');
    } catch (e: any) {
      showAlert('Verification Failed', e?.message || 'Aadhaar could not be verified. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  }, [aadhaarNumber, fullName, aadhaarPan, aadhaarDobInput, dispatch]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const activeStep = getActiveStep(kyc);
  const progress = getProgressPercent(kyc);

  // ── Step 2: Fallback (PAN / DL) ─────────────────────────────────────────
  const handleSubmitFallback = useCallback(async () => {
    if (!panNumber.trim() && !dlNumber.trim()) {
      showAlert('Missing Info', 'Please enter your PAN number and/or Driving License number.');
      return;
    }

    setLoading(true);
    try {
      // Format DOB to YYYY-MM-DD if user entered DD/MM/YYYY or DD-MM-YYYY
      let dob: string | undefined;
      const dobTrimmed = dobInput.trim();
      if (dobTrimmed) {
        // Support formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
        const slashMatch = dobTrimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
        if (slashMatch) {
          dob = `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dobTrimmed)) {
          dob = dobTrimmed;
        } else {
          showAlert('Invalid Date', 'Please enter DOB as DD/MM/YYYY');
          setLoading(false);
          return;
        }

        // Validate the date is real (e.g. reject day=75)
        const parsed = new Date(dob);
        if (isNaN(parsed.getTime())) {
          showAlert('Invalid Date', 'Please enter a valid date of birth.');
          setLoading(false);
          return;
        }
      }

      const status = await submitKycFallback({
        panNumber: panNumber.trim() || undefined,
        dlNumber: dlNumber.trim() || undefined,
        dob,
      });
      dispatch(setKycStatus(status));
    } catch (e: any) {
      showAlert('Verification Failed', e?.message || 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  }, [panNumber, dlNumber, dobInput, dispatch]);

  // ── Step 3: DL Photo — capture front of physical DL card ────────────────
  const handleCaptureDLPhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission Required', 'Camera permission is needed to photograph your DL.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [16, 10],  // DL card landscape ratio
        quality: 0.7,
        base64: false,
        cameraType: ImagePicker.CameraType.back, // back camera for document
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) setDlPhotoUri(asset.uri);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to open camera.');
    }
  }, []);

  const handlePickDLPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) setDlPhotoUri(asset.uri);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to open gallery.');
    }
  }, []);

  const handleSubmitDLPhoto = useCallback(async () => {
    if (!dlPhotoUri) {
      showAlert('Missing Photo', 'Please take a photo of your DL card front first.');
      return;
    }
    setLoading(true);
    try {
      const ImageManipulator = require('expo-image-manipulator');
      const compressed = await ImageManipulator.manipulateAsync(
        dlPhotoUri,
        [{ resize: { width: 1200 } }],  // Higher res for OCR accuracy
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const FileSystem = require('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await submitKycDLPhoto(base64, 'image/jpeg');
      dispatch(setKycStatus({ ...kyc!, status: 'FACE_MATCH_PENDING' }));
      showAlert(
        result.faceExtracted ? 'DL Verified ✅' : 'DL Processed',
        result.message
      );
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to process DL photo. Please retake.');
    } finally {
      setLoading(false);
    }
  }, [dlPhotoUri, kyc, dispatch]);

  // ── Step 4: Selfie ──────────────────────────────────────────────────────
  const handleTakeSelfie = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission Required', 'Camera permission is needed to take a selfie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,          // Low quality to keep base64 small
        base64: false,
        cameraType: ImagePicker.CameraType.front,
        exif: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        showAlert('Error', 'Could not capture selfie. Please try again.');
        return;
      }

      setSelfieUri(asset.uri);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to open camera.');
    }
  }, []);

  const handleSubmitSelfie = useCallback(async () => {
    if (!selfieUri) {
      showAlert('Missing Selfie', 'Please take a selfie first.');
      return;
    }

    setLoading(true);
    try {
      // Resize + compress image before base64 encoding to keep payload small
      const ImageManipulator = require('expo-image-manipulator');
      const compressed = await ImageManipulator.manipulateAsync(
        selfieUri,
        [{ resize: { width: 640 } }],   // Max 640px wide
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const FileSystem = require('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await submitKycSelfie(base64, 'image/jpeg');

      if (result.kycCompleted) {
        dispatch(setKycStatus({
          status: 'COMPLETED',
          aadhaarVerified: true,
          panVerified: true,
          dlVerified: true,
          faceMatchPassed: true,
          faceMatchScore: result.faceMatchScore,
          failureReason: null,
          digilockerUrl: null,
          digilockerUrlExpiresAt: null,
        }));

        dispatch(setDriverVerification({
          documentsVerified: true,
          backgroundCheckStatus: 'VERIFIED',
          submitted: true,
          updatedAt: new Date().toISOString(),
          reason: null,
        }));

        // Refresh user data so profileImage (selfie) is updated everywhere
        dispatch(loadUser());

        showAlert('Success! 🎉', 'Your identity has been verified. You can now go online!');

        // Navigate to home after a brief moment so user sees the success message
        setTimeout(() => {
          try {
            navigation.reset({
              index: 0,
              routes: [{ name: 'DriverHome' as never }],
            });
          } catch {
            try { navigation.replace('DriverHome' as never); } catch { }
          }
        }, 1500);
      } else {
        dispatch(setKycStatus({
          status: 'FAILED',
          aadhaarVerified: kyc?.aadhaarVerified ?? true,
          panVerified: kyc?.panVerified ?? true,
          dlVerified: kyc?.dlVerified ?? true,
          faceMatchPassed: false,
          faceMatchScore: result.faceMatchScore,
          failureReason: `Face match score: ${(result.faceMatchScore * 100).toFixed(0)}%. Please retake in better lighting.`,
          digilockerUrl: null,
          digilockerUrlExpiresAt: null,
        }));
        setSelfieUri(null);
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to verify selfie. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selfieUri, kyc, dispatch, navigation]);

  // ── Step Indicator ──────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, idx) => {
        const isActive = step.key === activeStep;
        const isDone =
          (step.key === 'aadhaar' && kyc?.aadhaarVerified) ||
          (step.key === 'documents' && kyc?.panVerified && kyc?.dlVerified) ||
          (step.key === 'selfie' && kyc?.faceMatchPassed);
        const isSkipped = step.key === 'documents' && kyc?.panVerified && kyc?.dlVerified && !isActive;

        return (
          <React.Fragment key={step.key}>
            {idx > 0 && (
              <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
            )}
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                isDone && styles.stepCircleDone,
                isActive && styles.stepCircleActive,
              ]}>
                {isDone ? (
                  <Icon name="check" size={16} color="#0A0A0A" />
                ) : (
                  <Icon name={step.icon as any} size={16} color={isActive ? G.accent : G.textMuted} />
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                isDone && styles.stepLabelDone,
                isActive && styles.stepLabelActive,
              ]}>
                {step.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );

  // ── Progress Bar ────────────────────────────────────────────────────────────────
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>{progress}% Complete</Text>
    </View>
  );

  // ── Step 1: Aadhaar Direct Input UI ──────────────────────────────────
  const renderAadhaarStep = () => {
    const isFormReady = aadhaarNumber.length === 12 &&
      fullName.trim().length > 2 &&
      /^[A-Z]{5}\d{4}[A-Z]$/.test(aadhaarPan.trim().toUpperCase()) &&
      aadhaarDobInput.trim().length >= 8;

    return (
      <View style={[glass.card, styles.stepCard]}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconWrap}>
            <Icon name="shield-lock" size={28} color={G.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Aadhaar Verification</Text>
            <Text style={styles.stepSubtitle}>
              Required for identity verification. All fields are cross-checked with UIDAI.
            </Text>
          </View>
        </View>

        {kyc?.aadhaarVerified && (
          <View style={styles.docRow}>
            <Icon name="check-circle" size={20} color={G.success} />
            <Text style={styles.docText}>Aadhaar verified ✓</Text>
          </View>
        )}

        {kyc?.status === 'FAILED' && kyc.failureReason && !kyc.aadhaarVerified && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={G.error} />
            <Text style={styles.errorText}>{kyc.failureReason}</Text>
          </View>
        )}

        {!kyc?.aadhaarVerified && (
          <>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <Text style={[styles.stepSubtitle, { color: G.textMuted, lineHeight: 20 }]}>
                ℹ️  Didit requires your name, Aadhaar, PAN, and date of birth to verify your identity against UIDAI records. No OTP needed.
              </Text>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name (as on Aadhaar) *</Text>
              <TextInput
                style={[glass.input, styles.inputField]}
                placeholder="e.g. Govardhan Reddy"
                placeholderTextColor={G.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Aadhaar Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Aadhaar Number *</Text>
              <TextInput
                style={[glass.input, styles.inputField]}
                placeholder="Enter 12-digit Aadhaar number"
                placeholderTextColor={G.textMuted}
                value={aadhaarNumber}
                onChangeText={(t) => setAadhaarNumber(t.replace(/\D/g, '').slice(0, 12))}
                keyboardType="number-pad"
                maxLength={12}
              />
              {aadhaarNumber.length > 0 && aadhaarNumber.length < 12 && (
                <Text style={[styles.aadhaarDobHint, { color: G.textMuted }]}>
                  {12 - aadhaarNumber.length} digits remaining
                </Text>
              )}
            </View>

            {/* PAN Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PAN Number *</Text>
              <TextInput
                style={[glass.input, styles.inputField]}
                placeholder="e.g. ABCDE1234F"
                placeholderTextColor={G.textMuted}
                value={aadhaarPan}
                onChangeText={(t) => setAadhaarPan(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth *</Text>
              <TextInput
                style={[glass.input, styles.inputField]}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={G.textMuted}
                value={aadhaarDobInput}
                onChangeText={setAadhaarDobInput}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <TouchableOpacity
              style={[glass.buttonPrimary, styles.actionBtn, (!isFormReady || loading) && styles.disabledBtn]}
              activeOpacity={0.85}
              disabled={loading || !isFormReady}
              onPress={handleVerifyAadhaar}
            >
              {loading ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <>
                  <Icon name="shield-check" size={18} color="#0A0A0A" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Verify Aadhaar</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ── Fallback Step UI ────────────────────────────────────────────────────
  const renderFallbackStep = () => {
    const needPan = !kyc?.panVerified;
    const needDl = !kyc?.dlVerified;

    if (!needPan && !needDl) return null;

    return (
      <View style={[glass.card, styles.stepCard]}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconWrap}>
            <Icon name="file-document-edit" size={28} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Verify PAN & Driving License</Text>
            <Text style={styles.stepSubtitle}>
              Enter your PAN number and Driving License details for verification.
            </Text>
          </View>
        </View>

        {kyc?.aadhaarVerified && (
          <View style={styles.docRow}>
            <Icon name="check-circle" size={20} color={G.success} />
            <Text style={styles.docText}>Aadhaar verified ✓</Text>
          </View>
        )}

        {kyc?.panVerified && (
          <View style={styles.docRow}>
            <Icon name="check-circle" size={20} color={G.success} />
            <Text style={styles.docText}>PAN verified ✓</Text>
          </View>
        )}

        {kyc?.dlVerified && (
          <View style={styles.docRow}>
            <Icon name="check-circle" size={20} color={G.success} />
            <Text style={styles.docText}>Driving License verified ✓</Text>
          </View>
        )}

        {needPan && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PAN Number *</Text>
            <TextInput
              style={[glass.input, styles.inputField]}
              placeholder="e.g. ABCDE1234F"
              placeholderTextColor={G.textMuted}
              value={panNumber}
              onChangeText={(t) => setPanNumber(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
            />
          </View>
        )}

        {needDl && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Driving License Number *</Text>
              <TextInput
                style={[glass.input, styles.inputField]}
                placeholder="e.g. KA0120200012345"
                placeholderTextColor={G.textMuted}
                value={dlNumber}
                onChangeText={(t) => setDlNumber(t.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
        <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.inputLabel}>Date of Birth *</Text>
                {kyc?.aadhaarDob && (
                  <View style={styles.aadhaarDobBadge}>
                    <Icon name="pencil" size={11} color={G.accent} />
                    <Text style={styles.aadhaarDobBadgeText}>pre-filled · editable</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={[glass.input, styles.inputField]}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={G.textMuted}
                value={dobInput}
                onChangeText={(text) => {
                  // Strip non-digits
                  const digits = text.replace(/\D/g, '');
                  // Auto-format: DD/MM/YYYY
                  let formatted = '';
                  if (digits.length <= 2) {
                    formatted = digits;
                  } else if (digits.length <= 4) {
                    formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                  } else {
                    formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                  }
                  setDobInput(formatted);
                }}
                keyboardType="number-pad"
                maxLength={10}
              />
              {kyc?.aadhaarDob && (
                <Text style={styles.aadhaarDobHint}>
                  Pre-filled from Aadhaar. Change it if your DL was issued with a different date of birth.
                </Text>
              )}
            </View>
          </>
        )}

        {kyc?.failureReason && (kyc.status === 'FALLBACK_PENDING' || (kyc.status === 'FAILED' && kyc.aadhaarVerified)) && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={G.error} />
            <Text style={styles.errorText}>{kyc.failureReason}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[glass.buttonPrimary, styles.actionBtn, loading && styles.disabledBtn]}
          activeOpacity={0.85}
          disabled={loading}
          onPress={handleSubmitFallback}
        >
          {loading ? (
            <ActivityIndicator color="#0A0A0A" />
          ) : (
            <>
              <Icon name="check-decagram" size={18} color="#0A0A0A" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Verify Documents</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step 3: DL Card Photo UI ────────────────────────────────────────────
  const renderDLPhotoStep = () => (
    <View style={[glass.card, styles.stepCard]}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconWrap}>
          <Icon name="card-account-details" size={28} color={G.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>DL Card Photo</Text>
          <Text style={styles.stepSubtitle}>
            Take a clear photo of the front of your Driving License card. We extract your photo for face match.
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Icon name="information" size={18} color={G.accent} style={{ marginRight: 8 }} />
          <Text style={[styles.stepSubtitle, { fontWeight: '600', color: G.textPrimary }]}>Tips for best results</Text>
        </View>
        {[
          { icon: 'lightning-bolt', text: 'Good lighting — no glare or shadows' },
          { icon: 'card-text', text: 'All 4 corners of the card visible' },
          { icon: 'camera', text: 'Use back camera, hold steady' },
          { icon: 'blur-off', text: 'Card must be in focus and not blurry' },
        ].map((tip) => (
          <View key={tip.icon} style={styles.hintRow}>
            <Icon name={tip.icon as any} size={14} color={G.accent} />
            <Text style={styles.hintText}>{tip.text}</Text>
          </View>
        ))}
      </View>

      {dlPhotoUri ? (
        <View style={styles.selfiePreviewWrap}>
          <Image source={{ uri: dlPhotoUri }} style={[styles.selfiePreview, { aspectRatio: 16 / 10, borderRadius: 10 }]} />
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setDlPhotoUri(null)}>
            <Icon name="camera-retake" size={16} color={G.textPrimary} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <TouchableOpacity
            style={[glass.buttonPrimary, styles.actionBtn, { flex: 1 }]}
            activeOpacity={0.85}
            onPress={handleCaptureDLPhoto}
          >
            <Icon name="camera" size={18} color="#0A0A0A" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[glass.buttonGhost, styles.actionBtn, { flex: 1 }]}
            activeOpacity={0.85}
            onPress={handlePickDLPhoto}
          >
            <Icon name="image" size={18} color={G.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.ghostBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {dlPhotoUri && (
        <TouchableOpacity
          style={[glass.buttonPrimary, styles.actionBtn, loading && styles.disabledBtn]}
          activeOpacity={0.85}
          disabled={loading}
          onPress={handleSubmitDLPhoto}
        >
          {loading ? (
            <ActivityIndicator color="#0A0A0A" />
          ) : (
            <>
              <Icon name="check-decagram" size={18} color="#0A0A0A" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Scan DL Photo</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Selfie Step UI ──────────────────────────────────────────────────────
  const renderSelfieStep = () => (
    <View style={[glass.card, styles.stepCard]}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconWrap}>
          <Icon name="face-recognition" size={28} color="#3b82f6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>Selfie Verification</Text>
          <Text style={styles.stepSubtitle}>
            Take a clear selfie using your front camera. This will be matched against your government ID.
          </Text>
        </View>
      </View>

      <View style={styles.selfieHints}>
        <View style={styles.hintRow}>
          <Icon name="lightbulb-on" size={16} color={G.accent} />
          <Text style={styles.hintText}>Good lighting, face the camera</Text>
        </View>
        <View style={styles.hintRow}>
          <Icon name="glasses" size={16} color={G.accent} />
          <Text style={styles.hintText}>Remove sunglasses and hats</Text>
        </View>
        <View style={styles.hintRow}>
          <Icon name="camera-front" size={16} color={G.accent} />
          <Text style={styles.hintText}>Front camera only</Text>
        </View>
      </View>

      {selfieUri && (
        <View style={styles.selfiePreviewWrap}>
          <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => setSelfieUri(null)}
          >
            <Icon name="camera-retake" size={16} color={G.textPrimary} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
        </View>
      )}

      {kyc?.failureReason && kyc.status === 'FAILED' && kyc.aadhaarVerified && kyc.panVerified && kyc.dlVerified && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={18} color={G.error} />
          <Text style={styles.errorText}>{kyc.failureReason}</Text>
        </View>
      )}

      <View style={styles.selfieButtons}>
        {!selfieUri ? (
          <TouchableOpacity
            style={[glass.buttonGhost, styles.actionBtn]}
            activeOpacity={0.85}
            onPress={handleTakeSelfie}
          >
            <Icon name="camera" size={20} color={G.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.ghostBtnText}>Take Selfie</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[glass.buttonPrimary, styles.actionBtn, loading && styles.disabledBtn]}
            activeOpacity={0.85}
            disabled={loading}
            onPress={handleSubmitSelfie}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Icon name="check-circle" size={18} color="#0A0A0A" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Verify Selfie</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Completed State ─────────────────────────────────────────────────────
  const renderCompletedState = () => (
    <View style={[glass.cardAccent, styles.completedCard]}>
      <View style={styles.completedIconWrap}>
        <Icon name="check-decagram" size={48} color={G.accent} />
      </View>
      <Text style={styles.completedTitle}>Identity Verified! 🎉</Text>
      <Text style={styles.completedSubtitle}>
        All your documents have been verified successfully. You can now proceed to subscribe and start driving.
      </Text>
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  // WebView removed — Aadhaar is now verified directly (no WebView needed)


  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
        {renderStepIndicator()}
        {renderProgressBar()}

        {kyc?.status === 'COMPLETED' && renderCompletedState()}

        {/* Show ONLY the current active step — one at a time */}
        {kyc?.status !== 'COMPLETED' && activeStep === 'aadhaar'   && renderAadhaarStep()}
        {kyc?.status !== 'COMPLETED' && activeStep === 'documents' && renderFallbackStep()}
        {kyc?.status !== 'COMPLETED' && activeStep === 'dl-photo'  && renderDLPhotoStep()}
        {kyc?.status !== 'COMPLETED' && activeStep === 'selfie'    && renderSelfieStep()}

        {/* Loading state */}
        {kycLoading && !kyc && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={G.accent} />
            <Text style={styles.loadingText}>Loading verification status...</Text>
          </View>
        )}

        {/* Need Help link — always visible for drivers who are stuck */}
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
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },

  // ── Full-screen WebView layout ──────────────────────────────────────────
  webviewContainer: {
    flex: 1,
    backgroundColor: G.bg,
  },
  webviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.18)',
  },
  webviewBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  webviewTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: G.textPrimary,
  },
  webviewCheckBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  webviewStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.10)',
  },
  webviewStatusText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: G.accent,
    lineHeight: 15,
  },
  fullWebView: {
    flex: 1,
    backgroundColor: '#ffffff', // White bg so Surepass portal renders correctly
  },
  webviewLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },

  // ── Main layout ─────────────────────────────────────────────────────────
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

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.glass2,
    borderWidth: 1.5,
    borderColor: G.border2,
  },
  stepCircleDone: {
    backgroundColor: G.accent,
    borderColor: G.accent,
  },
  stepCircleActive: {
    borderColor: G.accent,
    backgroundColor: G.accentSoft,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: G.textMuted,
    textAlign: 'center',
    maxWidth: 80,
  },
  stepLabelDone: { color: G.accent },
  stepLabelActive: { color: G.textPrimary },
  stepLine: {
    height: 2,
    width: 40,
    backgroundColor: G.border1,
    marginHorizontal: 4,
    marginBottom: 20,
  },
  stepLineDone: { backgroundColor: G.accent },

  // Progress Bar
  progressContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: G.glass2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: G.accent,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: G.textSecondary,
  },

  // Step Cards
  stepCard: {
    marginBottom: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  stepIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: G.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: G.textPrimary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: G.textSecondary,
    lineHeight: 18,
  },

  // Document rows
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: G.successSoft,
    marginBottom: 8,
  },
  docText: {
    fontSize: 14,
    fontWeight: '700',
    color: G.success,
  },

  // Polling
  pollingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: G.accentSoft,
    marginBottom: 12,
  },
  pollingText: {
    fontSize: 13,
    fontWeight: '600',
    color: G.accent,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: G.errorSoft,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fca5a5',
    lineHeight: 18,
  },

  // Action buttons
  actionBtn: {
    flexDirection: 'row',
    marginTop: 4,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
  },
  ghostBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: G.textPrimary,
  },
  disabledBtn: {
    opacity: 0.55,
  },

  // Inputs
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: G.textSecondary,
    marginBottom: 8,
  },
  inputField: {
    fontSize: 16,
    letterSpacing: 1,
  },
  inputFieldLocked: {
    opacity: 0.7,
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderColor: 'rgba(201,168,76,0.3)',
  },
  aadhaarDobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: G.accentSoft,
  },
  aadhaarDobBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: G.accent,
  },
  aadhaarDobHint: {
    fontSize: 11,
    fontWeight: '500',
    color: G.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },

  // Selfie
  selfieHints: {
    marginBottom: 16,
    gap: 8,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '600',
    color: G.textSecondary,
  },
  selfiePreviewWrap: {
    marginBottom: 12,
    alignItems: 'center',
  },
  selfiePreview: {
    width: 200,
    height: 260,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: G.accent,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.border2,
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: G.textPrimary,
  },
  selfieButtons: {
    marginTop: 4,
  },

  // Completed
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
  },

  // Loading
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: G.textSecondary,
  },
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
});

export default DriverDocumentsSubmitScreen;
