import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDriverOnline } from '../../redux/slices/driverSlice';
import { goOffline, goOnline } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

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
                  showAlert('Status', e?.message || 'Failed to update online status');
                }
              }}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.searchingCard}>
            <Icon name="radar" size={48} color="#C9A84C" />
            <Text style={styles.searchingTitle}>Searching for rides...</Text>
            <Text style={styles.searchingSubtitle}>We'll notify you when a ride is available</Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon="cash" label="Today's Earnings" value="₹0" color="#10b981" />
            <StatCard icon="car" label="Trips Today" value="0" color="#C9A84C" />
          </View>
        </View>
      ) : (
        <View style={styles.offlineContainer}>
          <View style={styles.toggleCardCenter}>
            <View style={styles.statusInfo}>
              <Icon name="circle-outline" size={20} color="#8A8A8A" />
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
                  showAlert('Status', e?.message || 'Failed to update online status');
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
    backgroundColor: G.bgAlt,
  },
  header: {
    padding: 24,
    backgroundColor: G.bg,
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
    color: G.textPrimary,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: G.textPrimary,
  },
  toggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: G.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border3,
    marginBottom: 16,
  },
  toggleCardCenter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: G.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border3,
    width: '100%',
    maxWidth: 360,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchingCard: {
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: G.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 14,
    color: G.textSecondary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: G.bg,
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
    color: G.textSecondary,
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
    color: G.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 16,
    color: G.textSecondary,
    textAlign: 'center',
  },
});

export default DriverHomeScreen;
