/**
 * KycWebViewScreen
 * ─────────────────
 * Opens the Didit hosted verification URL inside a WebView.
 * Didit handles: ID scanning, liveness check, face match, final decision.
 *
 * Flow:
 *   1. This screen receives `verificationUrl` + `sessionId` via navigation params.
 *   2. User completes verification inside Didit's UI (camera, face, etc.)
 *   3. Didit redirects to: drivegaadi://kyc-callback?verificationSessionId=xxx&status=Approved
 *   4. We intercept that deep-link inside the WebView's `onShouldStartLoadWithRequest`.
 *   5. We call POST /kyc/session/:id/confirm to confirm server-side and update DB.
 *   6. On Approved → navigate back (DriverDocumentsSubmitScreen shows completed state).
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch } from '../../redux/store';
import { loadKycStatus } from '../../redux/slices/driverSlice';
import { confirmKycSession } from '../../services/api';
import { colors } from '../../theme';
import { showAlert } from '../../components/common/CustomAlert';

// ── Component ────────────────────────────────────────────────────────────────

const KycWebViewScreen = () => {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const dispatch   = useAppDispatch();

  const { verificationUrl, sessionId } = route.params as {
    verificationUrl: string;
    sessionId: string;
  };

  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [hasError, setHasError]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  // ── Android back button ───────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        showAlert(
          'Cancel Verification?',
          'Your progress may be saved. You can resume this verification later.',
          [
            { text: 'Stay',   style: 'cancel' },
            { text: 'Cancel', style: 'destructive', onPress: () => navigation.goBack() },
          ]
        );
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [navigation])
  );

  // ── Handle the deep-link callback from Didit ──────────────────────────────
  const handleCallback = useCallback(async (diditStatus: string, diditSessionId: string) => {
    if (confirming) return;
    setConfirming(true);

    try {
      const sid = diditSessionId || sessionId;

      // Call server to confirm the decision and update DB.
      // Pass verificationUrl so backend can backfill diditSessionUrl if it was null in DB.
      const result = await confirmKycSession(sid, verificationUrl);

      // Refresh Redux KYC status
      await dispatch(loadKycStatus());

      if (result.kycCompleted) {
        // ✅ Approved — go back to DriverDocumentsSubmitScreen which will show completed state
        showAlert(
          '🎉 Verification Complete!',
          'Your identity has been verified successfully. You can now start accepting rides.',
          [{ text: 'Continue', onPress: () => navigation.goBack() }]
        );
      } else if (result.status === 'Declined') {
        showAlert(
          'Verification Declined',
          'Your verification was declined. Please ensure your documents are clear and try again.',
          [
            { text: 'Try Again', onPress: () => navigation.goBack() },
          ]
        );
      } else if (result.status === 'In Review') {
        showAlert(
          'Under Review',
          "Your verification is under manual review. We'll notify you once it's complete (usually within 24 hours).",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // In Progress, Not Started, Expired, etc.
        navigation.goBack();
      }
    } catch (err: any) {
      // If confirm fails, still try to go back gracefully
      // The webhook will update DB eventually
      await dispatch(loadKycStatus());

      if (diditStatus === 'Approved') {
        showAlert(
          'Verification Complete',
          'Your verification appears successful. We\'re confirming the result — it should update shortly.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        navigation.goBack();
      }
    } finally {
      setConfirming(false);
    }
  }, [confirming, sessionId, dispatch, navigation]);

  // ── Intercept Didit's redirect to our deep link ───────────────────────────
  const onShouldStartLoadWithRequest = useCallback((request: WebViewNavigation): boolean => {
    const url = request.url || '';

    if (url.startsWith('drivegaadi://') || url.startsWith('drivegaadi%3A%2F%2F')) {
      const queryStart = url.indexOf('?');
      if (queryStart !== -1) {
        const queryString = url.substring(queryStart + 1);
        const params = new URLSearchParams(queryString);
        const status          = params.get('status') || '';
        const diditSessionId  = params.get('verificationSessionId') || '';
        handleCallback(status, diditSessionId);
      } else {
        navigation.goBack();
      }
      return false; // Block WebView from navigating to the deep link URL
    }

    return true;
  }, [handleCallback, navigation]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            showAlert(
              'Cancel Verification?',
              'Your progress may be saved. You can resume later.',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Cancel', style: 'destructive', onPress: () => navigation.goBack() },
              ]
            );
          }}
        >
          <Icon name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Icon name="shield-check" size={18} color={colors.gold} />
          <Text style={styles.headerTitle}>Identity Verification</Text>
        </View>

        <View style={styles.diditBadge}>
          <Text style={styles.diditBadgeText}>secured by Didit</Text>
        </View>
      </View>

      {/* Progress bar while loading */}
      {isLoading && !hasError && (
        <View style={styles.loadingBar}>
          <View style={styles.loadingBarFill} />
        </View>
      )}

      {/* WebView */}
      {!hasError ? (
        <WebView
          ref={webViewRef}
          source={{ uri: verificationUrl }}
          style={styles.webView}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={handleError}
          onHttpError={handleError}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          // Allow camera access for document scanning + liveness
          mediaCapturePermissionGrantType="grant"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Loading verification…</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Icon name="wifi-off" size={56} color={colors.textSecondary} />
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorText}>
            Could not load the verification page. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirming overlay */}
      {confirming && (
        <View style={styles.confirmingOverlay}>
          <View style={styles.confirmingCard}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.confirmingTitle}>Verifying your identity…</Text>
            <Text style={styles.confirmingSubtext}>This usually takes a few seconds</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111111',
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 6,
  },
  headerTitle: {
    color:       '#FFFFFF',
    fontSize:    15,
    fontWeight:  '600',
    letterSpacing: 0.2,
  },
  diditBadge: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius:    8,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:     1,
    borderColor:     'rgba(201,168,76,0.25)',
  },
  diditBadgeText: {
    color:     '#C9A84C',
    fontSize:  10,
    fontWeight: '500',
  },
  loadingBar: {
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  loadingBarFill: {
    width:           '60%',
    height:          3,
    backgroundColor: '#C9A84C',
    borderRadius:    2,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#0A0A0A',
    gap: 12,
  },
  loadingText: {
    color:    '#888',
    fontSize: 14,
  },
  errorContainer: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         32,
    gap:             16,
  },
  errorTitle: {
    color:       '#FFFFFF',
    fontSize:    20,
    fontWeight:  '700',
  },
  errorText: {
    color:       '#888',
    fontSize:    14,
    textAlign:   'center',
    lineHeight:  21,
  },
  retryBtn: {
    backgroundColor:  '#C9A84C',
    paddingHorizontal: 32,
    paddingVertical:   12,
    borderRadius:      12,
    marginTop:         8,
  },
  retryBtnText: {
    color:      '#000',
    fontWeight: '700',
    fontSize:   15,
  },
  confirmingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         32,
  },
  confirmingCard: {
    backgroundColor: '#1A1A1A',
    borderRadius:    20,
    padding:         32,
    alignItems:      'center',
    gap:             12,
    borderWidth:     1,
    borderColor:     'rgba(201,168,76,0.2)',
  },
  confirmingTitle: {
    color:      '#FFFFFF',
    fontSize:   17,
    fontWeight: '600',
  },
  confirmingSubtext: {
    color:    '#888',
    fontSize: 13,
  },
});

export default KycWebViewScreen;
