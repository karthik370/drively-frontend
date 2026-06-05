import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDriverVerification, setKycStatus, loadKycStatus } from '../../redux/slices/driverSlice';
import { logout, loadUser } from '../../redux/slices/authSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { G, glass } from '../../constants/glassStyles';
import {
  initiateKyc,
  initiateDigiLocker,
  checkDigiLockerStatus,
  submitKycFallback,
  submitKycSelfie,
  KycStatusResponse,
} from '../../services/api';

// ── Step Constants ──────────────────────────────────────────────────────────
const STEPS = [
  { key: 'aadhaar', label: 'Aadhaar', icon: 'shield-lock' },
  { key: 'documents', label: 'PAN & DL', icon: 'file-document-edit' },
  { key: 'selfie', label: 'Selfie Match', icon: 'face-recognition' },
] as const;

type StepKey = 'aadhaar' | 'documents' | 'selfie';

// ── Helpers ─────────────────────────────────────────────────────────────────
const getActiveStep = (kyc: KycStatusResponse | null): StepKey => {
  if (!kyc || kyc.status === 'NOT_STARTED' || kyc.status === 'AADHAAR_OTP_PENDING' || kyc.status === 'DIGILOCKER_PENDING') return 'aadhaar';
  if (kyc.status === 'FALLBACK_PENDING' || kyc.status === 'DIGILOCKER_COMPLETED') return 'documents';
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
  const [digiboostHtml, setDigiboostHtml] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [panNumber, setPanNumber] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dobInput, setDobInput] = useState('');
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  // Load KYC status on mount
  useEffect(() => {
    dispatch(loadKycStatus());
  }, [dispatch]);

  const activeStep = getActiveStep(kyc);
  const progress = getProgressPercent(kyc);

  // ── Step 1: DigiLocker Aadhaar Verification via DigiBoost SDK ───────────
  const handleStartDigiLocker = useCallback(async () => {
    setLoading(true);
    try {
      const result = await initiateDigiLocker();
      if (result.sdkToken) {
        // Build HTML page that loads the DigiBoost SDK
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>DigiLocker Verification</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0A0A0A;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      color: #FFFFFF;
      padding: 20px;
    }
    #digilocker-button {
      margin-top: 20px;
    }
    .status {
      margin-top: 20px;
      text-align: center;
      font-size: 14px;
      color: #A0A0A0;
    }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(0, 229, 144, 0.2);
      border-top-color: #00E590;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading" id="loading">
    <div class="spinner"></div>
    <p>Initializing DigiLocker...</p>
  </div>
  <div id="digilocker-button"></div>
  <div class="status" id="status"></div>

  <script src="https://cdn.jsdelivr.net/gh/surepassio/surepass-digiboost-web-sdk@latest/index.min.js"></script>
  <script>
    document.getElementById('loading').style.display = 'none';
    document.getElementById('status').innerText = 'Tap the button below to verify your Aadhaar via DigiLocker.';

    try {
      window.DigiboostSdk({
        gateway: "${result.gateway}",
        token: "${result.sdkToken}",
        selector: "#digilocker-button",
        style: {
          backgroundColor: "#00E590",
          color: "#0A0A0A",
          padding: "16px 32px",
          borderRadius: "12px",
          fontSize: "16px",
          fontWeight: "700",
          width: "100%",
          border: "none",
          cursor: "pointer"
        },
        onSuccess: function(data) {
          document.getElementById('status').innerText = '✅ Verification successful! Processing...';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DIGILOCKER_SUCCESS',
            data: data
          }));
        },
        onFailure: function(error) {
          document.getElementById('status').innerText = '❌ Verification was cancelled or failed.';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DIGILOCKER_FAILURE',
            error: error
          }));
        }
      });
    } catch (e) {
      document.getElementById('status').innerText = 'Error loading SDK: ' + e.message;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DIGILOCKER_ERROR',
        error: e.message
      }));
    }
  </script>
</body>
</html>`;
        setDigiboostHtml(html);
        setShowWebView(true);
      } else {
        showAlert('Error', 'Failed to initialize DigiLocker. Please try again.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to start DigiLocker verification.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle messages from the DigiBoost SDK WebView
  const handleWebViewMessage = useCallback(async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'DIGILOCKER_SUCCESS') {
        setShowWebView(false);
        setDigiboostHtml(null);
        setLoading(true);
        try {
          // Fetch Aadhaar data from backend using stored client_id
          const status = await checkDigiLockerStatus();
          dispatch(setKycStatus(status));
          if (status.aadhaarVerified) {
            showAlert('Success! ✅', 'Aadhaar verified via DigiLocker.');
          } else {
            showAlert('Info', 'DigiLocker verification completed. Processing your data...');
          }
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed to process DigiLocker verification.');
        } finally {
          setLoading(false);
        }
      } else if (message.type === 'DIGILOCKER_FAILURE') {
        setShowWebView(false);
        setDigiboostHtml(null);
        showAlert('Cancelled', 'DigiLocker verification was cancelled or failed. You can try again.');
      } else if (message.type === 'DIGILOCKER_ERROR') {
        setShowWebView(false);
        setDigiboostHtml(null);
        showAlert('Error', `DigiLocker SDK error: ${message.error}`);
      }
    } catch {
      // ignore parse errors
    }
  }, [dispatch]);

  const handleCheckDigiLocker = useCallback(async () => {
    setLoading(true);
    try {
      const status = await checkDigiLockerStatus();
      dispatch(setKycStatus(status));
      if (status.aadhaarVerified) {
        showAlert('Success! ✅', 'Aadhaar verified via DigiLocker.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to check verification status.');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

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

  // ── Step 3: Selfie ──────────────────────────────────────────────────────
  const handleTakeSelfie = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission Required', 'Camera permission is needed to take a selfie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: false,
        quality: 0.5,
        base64: false,
        cameraType: ImagePicker.CameraType.front,
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
      // Read as base64
      const FileSystem = require('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(selfieUri, {
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

  // ── Progress Bar ────────────────────────────────────────────────────────
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>{progress}% Complete</Text>
    </View>
  );

  // ── Aadhaar DigiLocker Step UI ───────────────────────────────────────────
  const renderAadhaarStep = () => {
    // Show WebView if active
    if (showWebView && digiboostHtml) {
      return (
        <View style={[glass.card, styles.stepCard, { minHeight: 500 }]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepIconWrap}>
              <Icon name="shield-lock" size={28} color={G.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>DigiLocker Verification</Text>
              <Text style={styles.stepSubtitle}>
                Complete your Aadhaar verification in the DigiLocker window below.
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 450, borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
            <WebView
              source={{ html: digiboostHtml }}
              style={{ flex: 1, backgroundColor: '#0A0A0A' }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              javaScriptCanOpenWindowsAutomatically
              allowsPopups
              startInLoadingState
              renderLoading={() => (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' }}>
                  <ActivityIndicator size="large" color={G.accent} />
                  <Text style={[styles.stepSubtitle, { marginTop: 12 }]}>Loading DigiLocker SDK...</Text>
                </View>
              )}
            />
          </View>

          <TouchableOpacity
            style={[glass.buttonGhost, styles.actionBtn, { marginTop: 12 }]}
            activeOpacity={0.85}
            onPress={() => {
              setShowWebView(false);
              setDigiboostHtml(null);
            }}
          >
            <Icon name="close" size={18} color={G.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[glass.card, styles.stepCard]}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconWrap}>
            <Icon name="shield-lock" size={28} color={G.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Aadhaar Verification</Text>
            <Text style={styles.stepSubtitle}>
              Verify your Aadhaar via DigiLocker. You will be redirected to the official DigiLocker portal.
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
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Icon name="information" size={20} color={G.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.stepSubtitle, { fontWeight: '600', color: G.textPrimary }]}>How it works</Text>
              </View>
              <Text style={[styles.stepSubtitle, { marginBottom: 4 }]}>1. Tap "Open DigiLocker" below</Text>
              <Text style={[styles.stepSubtitle, { marginBottom: 4 }]}>2. Log in with your Aadhaar-linked mobile</Text>
              <Text style={[styles.stepSubtitle, { marginBottom: 4 }]}>3. Grant consent to share your Aadhaar details</Text>
              <Text style={styles.stepSubtitle}>4. You'll be redirected back automatically</Text>
            </View>

            <TouchableOpacity
              style={[glass.buttonPrimary, styles.actionBtn, loading && styles.disabledBtn]}
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleStartDigiLocker}
            >
              {loading ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <>
                  <Icon name="shield-check" size={18} color="#0A0A0A" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Open DigiLocker</Text>
                </>
              )}
            </TouchableOpacity>

            {kyc?.status === 'DIGILOCKER_PENDING' && kyc?.digilockerUrl && (
              <TouchableOpacity
                style={[glass.buttonGhost, styles.actionBtn, { marginTop: 10 }]}
                activeOpacity={0.85}
                disabled={loading}
                onPress={handleCheckDigiLocker}
              >
                <Icon name="refresh" size={18} color={G.textPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.ghostBtnText}>Check Verification Status</Text>
              </TouchableOpacity>
            )}
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
              <Text style={styles.inputLabel}>Date of Birth *</Text>
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

        {/* Step 1: Aadhaar OTP */}
        {(activeStep === 'aadhaar' || (!kyc?.aadhaarVerified && kyc?.status !== 'COMPLETED')) && renderAadhaarStep()}

        {/* Step 2: PAN & DL */}
        {(activeStep === 'documents' || (kyc?.aadhaarVerified && (!kyc?.panVerified || !kyc?.dlVerified) && kyc?.status !== 'COMPLETED')) && renderFallbackStep()}

        {/* Step 3: Selfie */}
        {(activeStep === 'selfie' || (kyc?.aadhaarVerified && kyc?.panVerified && kyc?.dlVerified && !kyc?.faceMatchPassed && kyc?.status !== 'COMPLETED')) && renderSelfieStep()}

        {/* Loading state */}
        {kycLoading && !kyc && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={G.accent} />
            <Text style={styles.loadingText}>Loading verification status...</Text>
          </View>
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
});

export default DriverDocumentsSubmitScreen;
