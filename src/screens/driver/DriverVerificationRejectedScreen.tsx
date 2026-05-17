import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { logout } from '../../redux/slices/authSlice';
import { G } from '../../constants/glassStyles';

const DriverVerificationRejectedScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const verification = useAppSelector((s) => s.driver.verification);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Icon name="shield-alert" size={44} color="#ef4444" />
          </View>

          <Text style={styles.title}>Verification Rejected</Text>
          <Text style={styles.subtitle}>
            Your documents could not be verified. Please review the reason below and resubmit corrected documents.
          </Text>

          {/* Rejection reason from admin */}
          {verification.reason ? (
            <View style={styles.reasonBox}>
              <View style={styles.reasonHeader}>
                <Icon name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.reasonTitle}>Rejection Reason</Text>
              </View>
              <Text style={styles.reasonText}>{verification.reason}</Text>
            </View>
          ) : (
            <View style={styles.reasonBox}>
              <View style={styles.reasonHeader}>
                <Icon name="information" size={18} color="#f59e0b" />
                <Text style={[styles.reasonTitle, { color: '#f59e0b' }]}>No reason provided</Text>
              </View>
              <Text style={styles.reasonText}>
                The admin did not provide a specific reason. Please ensure all documents are clear, readable, and match your details.
              </Text>
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>How to fix this</Text>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Take clear, well-lit photos of your documents (License, Aadhaar, PAN)</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Ensure all text and numbers are fully readable — no blur or glare</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Take a clear selfie with your face fully visible</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
              <Text style={styles.stepText}>Tap "Resubmit Documents" below to upload again</Text>
            </View>
          </View>

          {/* Resubmit button */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => {
              try {
                navigation.replace('DriverDocumentsSubmit');
              } catch {}
            }}
          >
            <Icon name="file-document-edit" size={20} color="#0A0A0A" style={{ marginRight: 8 }} />
            <Text style={styles.primaryText}>Resubmit Documents</Text>
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.9}
            onPress={() => dispatch(logout())}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: 18,
  },
  title: { fontSize: 24, fontWeight: '900', color: G.textPrimary, marginBottom: 10, textAlign: 'center' },
  subtitle: {
    textAlign: 'center',
    color: '#AAAAAA',
    fontWeight: '500',
    marginBottom: 20,
    lineHeight: 22,
    fontSize: 14,
    paddingHorizontal: 10,
  },
  reasonBox: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reasonTitle: { color: '#ef4444', fontWeight: '800', fontSize: 15, marginLeft: 8 },
  reasonText: { color: '#E0C0C0', fontWeight: '600', lineHeight: 22, fontSize: 14 },
  instructionsBox: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
    backgroundColor: G.glass2,
  },
  instructionsTitle: { color: G.accent, fontWeight: '800', fontSize: 15, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: G.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepNumberText: { color: '#0A0A0A', fontWeight: '900', fontSize: 13 },
  stepText: { flex: 1, color: '#CCCCCC', fontWeight: '500', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: G.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  primaryText: { color: '#0A0A0A', fontWeight: '900', fontSize: 16 },
  logoutButton: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 18 },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
});

export default DriverVerificationRejectedScreen;
