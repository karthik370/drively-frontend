import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { getBookingDetails } from '../../services/api';
import { useAppSelector } from '../../redux/store';

const BookingDetailsScreen = ({ navigation, route }: any) => {
  const user = useAppSelector((s) => s.auth.user);
  const effectiveBookingId = String(route?.params?.bookingId || '');

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  const load = async () => {
    if (!effectiveBookingId) return;
    setLoading(true);
    try {
      const b = await getBookingDetails(effectiveBookingId);
      setBooking(b);
    } catch (e: any) {
      Alert.alert('Booking', e?.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [effectiveBookingId]);

  const isViewingAsDriver = useMemo(() => {
    const userId = String((user as any)?.id || '');
    const driverId = String((booking as any)?.driver?.id || (booking as any)?.driverId || '');
    if (userId && driverId) return userId === driverId;
    return String(user?.userType) === 'DRIVER';
  }, [booking, user]);

  const driverName = useMemo(() => {
    if (!booking?.driver) return '—';
    return `${String(booking.driver.firstName || '')} ${String(booking.driver.lastName || '')}`.trim() || '—';
  }, [booking?.driver]);

  const driverInitials = useMemo(() => {
    const a = String(booking?.driver?.firstName || '').trim()[0] || 'D';
    const b = String(booking?.driver?.lastName || '').trim()[0] || '';
    return `${a}${b}`.toUpperCase();
  }, [booking?.driver]);

  const customerName = useMemo(() => {
    if (!booking?.customer) return '—';
    return `${String(booking.customer.firstName || '')} ${String(booking.customer.lastName || '')}`.trim() || '—';
  }, [booking?.customer]);

  const customerInitials = useMemo(() => {
    const a = String(booking?.customer?.firstName || '').trim()[0] || 'C';
    const b = String(booking?.customer?.lastName || '').trim()[0] || '';
    return `${a}${b}`.toUpperCase();
  }, [booking?.customer]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={{ marginTop: 10, color: '#111827', fontWeight: '600' }}>Loading…</Text>
          </View>
        ) : null}

        {booking ? (
          <View style={styles.statusCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{String(booking.status)}</Text>
            </View>
            <Text style={styles.bookingNumber}>#{String(booking.bookingNumber || '').slice(0, 12)}</Text>
            <Text style={styles.bookingDate}>
              {booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : ''}
            </Text>
            <Text style={styles.bookingDate}>
              Payment: {String(booking.paymentMethod)} ({String(booking.paymentStatus)})
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Details</Text>
          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <Icon name="circle" size={12} color="#10b981" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Pickup</Text>
                <Text style={styles.locationAddress}>{String(booking?.pickupAddress || '')}</Text>
              </View>
            </View>
            <View style={styles.connector} />
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={12} color="#ef4444" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Drop</Text>
                <Text style={styles.locationAddress}>{String(booking?.dropAddress || '')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Car Type</Text>
              <Text style={styles.metaValue}>{String(booking?.vehicleType || 'CAR')}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Transmission</Text>
              <Text style={styles.metaValue}>{String(booking?.transmissionType || 'MANUAL')}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Trip Type</Text>
              <Text style={styles.metaValue}>{String(booking?.tripType || 'ONE_WAY')}</Text>
            </View>
            {booking?.scheduledTime ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Scheduled Time</Text>
                <Text style={styles.metaValue}>{new Date(booking.scheduledTime).toLocaleString()}</Text>
              </View>
            ) : null}
            {booking?.otp ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Trip OTP</Text>
                <Text style={styles.metaValue}>{String(booking.otp)}</Text>
              </View>
            ) : null}
            {typeof booking?.distanceMeters === 'number' ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Distance</Text>
                <Text style={styles.metaValue}>{(booking.distanceMeters / 1000).toFixed(1)} km</Text>
              </View>
            ) : null}
            {typeof booking?.durationSeconds === 'number' ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Duration</Text>
                <Text style={styles.metaValue}>{Math.round(booking.durationSeconds / 60)} min</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isViewingAsDriver ? 'Customer Details' : 'Driver Details'}</Text>
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{isViewingAsDriver ? customerInitials : driverInitials}</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{isViewingAsDriver ? customerName : driverName}</Text>
              {isViewingAsDriver ? null : (
                <View style={styles.ratingRow}>
                  <Icon name="star" size={14} color="#f59e0b" />
                  <Text style={styles.ratingText}>
                    {booking?.driver?.rating ? Number(booking.driver.rating).toFixed(1) : '0.0'}
                  </Text>
                </View>
              )}

              {isViewingAsDriver ? (
                booking?.customer?.phoneNumber ? (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => {
                      const phone = String(booking.customer.phoneNumber).trim();
                      if (phone) {
                        const Linking = require('react-native').Linking;
                        Linking.openURL(`tel:${phone}`);
                      }
                    }}
                  >
                    <Icon name="phone" size={16} color="#2563eb" />
                    <Text style={styles.contactText}>{String(booking.customer.phoneNumber).trim()}</Text>
                  </TouchableOpacity>
                ) : null
              ) : booking?.driver?.phoneNumber ? (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => {
                    const phone = String(booking.driver.phoneNumber).trim();
                    if (phone) {
                      const Linking = require('react-native').Linking;
                      Linking.openURL(`tel:${phone}`);
                    }
                  }}
                >
                  <Icon name="phone" size={16} color="#2563eb" />
                  <Text style={styles.contactText}>{String(booking.driver.phoneNumber).trim()}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fare Breakdown</Text>
          {booking?.discountAmount ? (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Discount</Text>
              <Text style={styles.fareValue}>-₹{Number(booking.discountAmount || 0).toFixed(0)}</Text>
            </View>
          ) : null}
          <View style={[styles.fareRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{Number(booking?.totalAmount || 0).toFixed(0)}</Text>
          </View>
          <View style={styles.paymentMethod}>
            <Icon name="cash" size={20} color="#10b981" />
            <Text style={styles.paymentMethodText}>
              Pay driver in cash
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => {
            if (!effectiveBookingId) return;
            try {
              navigation.navigate('SupportChat', { bookingId: effectiveBookingId });
            } catch {
            }
          }}
        >
          <Icon name="headphones" size={20} color="#2563eb" />
          <Text style={styles.supportText}>Need Help?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  bookingNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  locationContainer: {
    paddingLeft: 8,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  locationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  connector: {
    width: 2,
    height: 24,
    backgroundColor: '#d1d5db',
    marginLeft: 5,
    marginVertical: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginHorizontal: -4,
  },
  metaItem: {
    width: '50%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  contactText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  fareValue: {
    fontSize: 14,
    color: '#111827',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#374151',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  supportText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});

export default BookingDetailsScreen;
