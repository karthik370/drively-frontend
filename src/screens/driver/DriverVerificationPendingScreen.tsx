import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { loadDriverVerificationStatus } from '../../redux/slices/driverSlice';
import { logout } from '../../redux/slices/authSlice';

const DriverVerificationPendingScreen = () => {
  const dispatch = useAppDispatch();
  const verification = useAppSelector((s) => s.driver.verification);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Icon name="shield-clock" size={44} color="#2563eb" />
        </View>

        <Text style={styles.title}>Verification Pending</Text>
        <Text style={styles.subtitle}>
          Your documents were submitted successfully. Please wait for admin approval.
        </Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{String(verification.backgroundCheckStatus || 'PENDING')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, verification.isLoading && styles.disabledButton]}
          activeOpacity={0.9}
          onPress={() => dispatch(loadDriverVerificationStatus())}
          disabled={verification.isLoading}
        >
          {verification.isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryText}>Refresh status</Text>
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 10 },
  subtitle: { textAlign: 'center', color: '#4b5563', fontWeight: '600', marginBottom: 18, lineHeight: 20 },
  statusRow: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  statusLabel: { color: '#6b7280', fontWeight: '700' },
  statusValue: { marginTop: 6, color: '#111827', fontWeight: '900' },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  logoutButton: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 18 },
  logoutText: { color: '#ef4444', fontWeight: '900' },
});

export default DriverVerificationPendingScreen;
