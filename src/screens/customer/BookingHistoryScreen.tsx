import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { G } from '../../constants/glassStyles';

import { getBookingHistory } from '../../services/api';
import { useAppSelector } from '../../redux/store';
import { UserType } from '../../types';
import { showAlert } from '../../components/common/CustomAlert';

const BookingHistoryScreen = ({ navigation }: any) => {
  const authedUserType = useAppSelector((s) => s.auth.user?.userType);
  const authedUserId = useAppSelector((s) => s.auth.user?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const load = async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await getBookingHistory(1, 30);
      setItems(Array.isArray(res?.bookings) ? res.bookings : []);
    } catch (e: any) {
      showAlert('My Rides', e?.message || 'Failed to load booking history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load('initial');
  }, []);

  const renderBookingItem = useCallback(({ item }: any) => {
    // Determine if this user is the DRIVER of this specific booking.
    // For BOTH-type users, check if their userId matches booking.driverId.
    const isDriverOfBooking =
      authedUserType === UserType.DRIVER ||
      (authedUserType === UserType.BOTH && item?.driverId && String(item.driverId) === authedUserId);

    // Show driver's actual earnings (includes platform subsidy) not customer's discounted fare.
    const displayAmount = isDriverOfBooking
      ? Number(item?.driverEarnings || item?.totalAmount || 0)
      : Number(item?.totalAmount || 0);

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => {
          const bookingId = String(item?.id || '');
          if (!bookingId) return;
          const parentNav = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
          (parentNav || navigation).navigate('BookingDetails', { bookingId });
        }}
      >
        <View style={styles.bookingHeader}>
          <View>
            <Text style={styles.bookingNumber}>#{String(item.bookingNumber || '').slice(0, 10)}</Text>
            <Text style={styles.bookingDate}>
              {item?.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <Icon name="circle" size={12} color="#10b981" />
            <Text style={styles.locationText} numberOfLines={1}>{String(item.pickupAddress || '')}</Text>
          </View>
          <View style={styles.connector} />
          <View style={styles.locationRow}>
            <Icon name="map-marker" size={12} color="#ef4444" />
            <Text style={styles.locationText} numberOfLines={1}>{String(item.dropAddress || '')}</Text>
          </View>
        </View>

        <View style={styles.bookingFooter}>
          <View style={styles.driverInfo}>
            <Icon name="account-circle" size={20} color="#8A8A8A" />
            <Text style={styles.driverName}>
              {isDriverOfBooking
                ? item?.customer
                  ? `${String(item.customer.firstName || '')} ${String(item.customer.lastName || '')}`.trim()
                  : '—'
                : item?.driver
                  ? `${String(item.driver.firstName || '')} ${String(item.driver.lastName || '')}`.trim()
                  : '—'}
            </Text>
          </View>
          {/* Drivers see their actual earnings (with subsidy), customers see their fare */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isDriverOfBooking && (
              <Icon name="wallet-outline" size={13} color="#10b981" />
            )}
            <Text style={[styles.amount, isDriverOfBooking && { color: '#10b981' }]}>
              ₹{displayAmount.toFixed(0)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [authedUserType, authedUserId, navigation]);

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Rides</Text>
      </View>

      <FlatList
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
        data={items}
        renderItem={renderBookingItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="car-off" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No rides yet'}</Text>
            <Text style={styles.emptySubtitle}>
              {loading ? 'Fetching your rides…' : 'Your ride history will appear here'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return '#d1fae5';
    case 'CANCELLED':
      return '#fee2e2';
    case 'IN_PROGRESS':
      return '#dbeafe';
    default:
      return '#f3f4f6';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgAlt,
  },
  header: {
    padding: 24,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: G.border3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: G.textPrimary,
  },
  listContent: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: G.bg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: G.textPrimary,
  },
  bookingDate: {
    fontSize: 12,
    color: G.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#CCCCCC',
  },
  connector: {
    width: 2,
    height: 16,
    backgroundColor: G.glass3,
    marginLeft: 5,
    marginVertical: 4,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    fontSize: 14,
    color: G.textSecondary,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: G.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: G.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: G.textSecondary,
    marginTop: 8,
  },
});

export default React.memo(BookingHistoryScreen);
