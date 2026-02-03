import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDriverOnline } from '../../redux/slices/driverSlice';
import { goOffline, goOnline } from '../../services/api';

const DriverHomeScreen = () => {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector((s) => s.driver.isOnline);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.greeting}>Hello Driver! 👋</Text>
        </View>
      </View>

      {isOnline ? (
        <View style={styles.content}>
          <View style={styles.toggleCard}>
            <View style={styles.statusInfo}>
              <Icon name="circle" size={20} color="#10b981" />
              <Text style={styles.statusText}>Online</Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={async (v) => {
                try {
                  if (v) {
                    await goOnline();
                  } else {
                    await goOffline();
                  }
                  dispatch(setDriverOnline(Boolean(v)));
                } catch (e: any) {
                  Alert.alert('Status', e?.message || 'Failed to update online status');
                }
              }}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.searchingCard}>
            <Icon name="radar" size={48} color="#2563eb" />
            <Text style={styles.searchingTitle}>Searching for rides...</Text>
            <Text style={styles.searchingSubtitle}>We'll notify you when a ride is available</Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon="cash" label="Today's Earnings" value="₹0" color="#10b981" />
            <StatCard icon="car" label="Trips Today" value="0" color="#2563eb" />
          </View>
        </View>
      ) : (
        <View style={styles.offlineContainer}>
          <View style={styles.toggleCardCenter}>
            <View style={styles.statusInfo}>
              <Icon name="circle-outline" size={20} color="#6b7280" />
              <Text style={styles.statusText}>Offline</Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={async (v) => {
                try {
                  if (v) {
                    await goOnline();
                  } else {
                    await goOffline();
                  }
                  dispatch(setDriverOnline(Boolean(v)));
                } catch (e: any) {
                  Alert.alert('Status', e?.message || 'Failed to update online status');
                }
              }}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          <Icon name="power-off" size={64} color="#d1d5db" style={{ marginTop: 22 }} />
          <Text style={styles.offlineTitle}>You're Offline</Text>
          <Text style={styles.offlineSubtitle}>Go online to start accepting rides</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const StatCard = ({ icon, label, value, color }: any) => (
  <View style={styles.statCard}>
    <Icon name={icon} size={24} color={color} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    backgroundColor: '#ffffff',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  toggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  toggleCardCenter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
    maxWidth: 360,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default DriverHomeScreen;
