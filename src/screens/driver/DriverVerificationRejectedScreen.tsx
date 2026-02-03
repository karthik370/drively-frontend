import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { logout } from '../../redux/slices/authSlice';

const DriverVerificationRejectedScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const verification = useAppSelector((s) => s.driver.verification);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Icon name="shield-alert" size={44} color="#ef4444" />
        </View>

        <Text style={styles.title}>Verification Rejected</Text>
        <Text style={styles.subtitle}>Please resubmit clear photos and correct numbers.</Text>

        {verification.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>Reason</Text>
            <Text style={styles.reasonText}>{verification.reason}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.9}
          onPress={() => {
            try {
              navigation.replace('DriverDocumentsSubmit');
            } catch {
            }
          }}
        >
          <Text style={styles.primaryText}>Resubmit documents</Text>
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 10 },
  subtitle: { textAlign: 'center', color: '#4b5563', fontWeight: '600', marginBottom: 16, lineHeight: 20 },
  reasonBox: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: '#fef2f2',
  },
  reasonTitle: { color: '#991b1b', fontWeight: '900' },
  reasonText: { marginTop: 6, color: '#7f1d1d', fontWeight: '700' },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  logoutButton: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 18 },
  logoutText: { color: '#ef4444', fontWeight: '900' },
});

export default DriverVerificationRejectedScreen;
