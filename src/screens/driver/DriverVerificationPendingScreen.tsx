import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { loadDriverVerificationStatus, loadKycStatus } from '../../redux/slices/driverSlice';
import { logout } from '../../redux/slices/authSlice';
import { G } from '../../constants/glassStyles';
import { createOnboardingSupportTicket } from '../../services/api';

const DriverVerificationPendingScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const verification = useAppSelector((s) => s.driver.verification);
  const kyc = useAppSelector((s) => s.driver.kyc);
  const [isOpeningSupport, setIsOpeningSupport] = useState(false);

  // Load both verification and KYC status
  useEffect(() => {
    dispatch(loadKycStatus());
  }, [dispatch]);

  // If KYC is completed but verification is still pending, it means auto-approve worked
  const isAutoVerified = kyc?.status === 'COMPLETED' && kyc?.faceMatchPassed;

  // If KYC is still in progress, redirect back to the KYC screen
  const shouldRedirectToKyc =
    kyc && kyc.status !== 'COMPLETED' && kyc.status !== 'NOT_STARTED' &&
    !verification.documentsVerified;

  useEffect(() => {
    if (shouldRedirectToKyc) {
      try {
        navigation.replace('DriverDocumentsSubmit');
      } catch {}
    }
  }, [shouldRedirectToKyc, navigation]);

  const handleRefresh = () => {
    dispatch(loadDriverVerificationStatus());
    dispatch(loadKycStatus());
  };

  const handleNeedHelp = async () => {
    setIsOpeningSupport(true);
    try {
      const ticket = await createOnboardingSupportTicket(
        'I need help with my verification. My documents are pending review.'
      );
      navigation.navigate('SupportChat', {
        bookingId: ticket.bookingId,
        title: 'Verification Support',
      });
    } catch {
      Alert.alert(
        'Could not open support',
        'Please try again. If the issue persists, contact us at support@drivemate.in',
        [{ text: 'OK' }]
      );
    } finally {
      setIsOpeningSupport(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          {isAutoVerified ? (
            <Icon name="shield-check" size={44} color={G.success} />
          ) : (
            <Icon name="shield-check-outline" size={44} color={G.accent} />
          )}
        </View>

        <Text style={styles.title}>
          {isAutoVerified ? 'Verification Complete!' : 'Verification Pending'}
        </Text>
        <Text style={styles.subtitle}>
          {isAutoVerified
            ? 'Your identity has been verified automatically. You can now subscribe and start driving!'
            : 'Your documents are being verified. This usually takes a few moments.'}
        </Text>

        {/* KYC Status Summary */}
        {kyc && kyc.status !== 'NOT_STARTED' && (
          <View style={styles.kycSummary}>
            <View style={styles.kycRow}>
              <Icon name={kyc.aadhaarVerified ? 'check-circle' : 'clock-outline'} size={18} color={kyc.aadhaarVerified ? G.success : G.textMuted} />
              <Text style={[styles.kycText, kyc.aadhaarVerified && styles.kycTextDone]}>Aadhaar</Text>
            </View>
            <View style={styles.kycRow}>
              <Icon name={kyc.panVerified ? 'check-circle' : 'clock-outline'} size={18} color={kyc.panVerified ? G.success : G.textMuted} />
              <Text style={[styles.kycText, kyc.panVerified && styles.kycTextDone]}>PAN Card</Text>
            </View>
            <View style={styles.kycRow}>
              <Icon name={kyc.dlVerified ? 'check-circle' : 'clock-outline'} size={18} color={kyc.dlVerified ? G.success : G.textMuted} />
              <Text style={[styles.kycText, kyc.dlVerified && styles.kycTextDone]}>Driving License</Text>
            </View>
            <View style={styles.kycRow}>
              <Icon name={kyc.faceMatchPassed ? 'check-circle' : 'clock-outline'} size={18} color={kyc.faceMatchPassed ? G.success : G.textMuted} />
              <Text style={[styles.kycText, kyc.faceMatchPassed && styles.kycTextDone]}>Face Match</Text>
            </View>
          </View>
        )}

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{String(verification.backgroundCheckStatus || 'PENDING')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, verification.isLoading && styles.disabledButton]}
          activeOpacity={0.9}
          onPress={handleRefresh}
          disabled={verification.isLoading}
        >
          {verification.isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryText}>Refresh status</Text>
          )}
        </TouchableOpacity>

        {/* Need Help Button */}
        <TouchableOpacity
          style={[styles.helpButton, isOpeningSupport && styles.disabledButton]}
          activeOpacity={0.85}
          onPress={() => void handleNeedHelp()}
          disabled={isOpeningSupport}
        >
          {isOpeningSupport ? (
            <ActivityIndicator color={G.accent} size="small" />
          ) : (
            <>
              <Icon name="headset" size={18} color={G.accent} style={{ marginRight: 8 }} />
              <Text style={styles.helpText}>Need Help?</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.9}
          onPress={() => {
            dispatch(logout());
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  content: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.glass2,
    marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: '900', color: G.textPrimary, marginBottom: 10 },
  subtitle: { textAlign: 'center', color: '#CCCCCC', fontWeight: '600', marginBottom: 18, lineHeight: 20, paddingHorizontal: 10 },
  kycSummary: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: G.border2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: G.glass1,
    gap: 10,
  },
  kycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycText: {
    fontSize: 14,
    fontWeight: '600',
    color: G.textMuted,
  },
  kycTextDone: {
    color: G.success,
    fontWeight: '700',
  },
  statusRow: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  statusLabel: { color: G.textSecondary, fontWeight: '700' },
  statusValue: { marginTop: 6, color: G.textPrimary, fontWeight: '900' },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: G.textPrimary, fontWeight: '900', fontSize: 16 },
  helpButton: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: G.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  helpText: {
    color: G.accent,
    fontWeight: '800',
    fontSize: 15,
  },
  logoutButton: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 18 },
  logoutText: { color: '#ef4444', fontWeight: '900' },
});

export default DriverVerificationPendingScreen;
