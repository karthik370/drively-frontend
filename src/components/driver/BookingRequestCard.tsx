import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Vibration, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import socketService from '../../services/socketService';
import { showAlert } from '../common/CustomAlert';
import { G } from '../../constants/glassStyles';

export type BookingRequest = {
  id: string;
  pickup?: { address?: string; latitude?: number; longitude?: number };
  drop?: { address?: string; latitude?: number; longitude?: number } | null;
  distanceKm?: number;
  etaMin?: number;
  fare?: number;
  vehicleType?: string;
  transmissionType?: string;
  tripType?: string;
  outstationTripType?: string;
  requestedHours?: number;
  scheduledTime?: string;
  createdAt: string;
  customerName?: string;
  customerPhoto?: string | null;
};

export type BookingRequestCardProps = {
  request: BookingRequest;
  driverLocation?: { latitude: number; longitude: number } | null;
  timeoutSeconds?: number;
  onAccept: (bookingId: string) => Promise<void> | void;
  onReject: (bookingId: string, reason?: string) => Promise<void> | void;
  onPress?: (bookingId: string) => void;
  showActions?: boolean;
  onTimeout?: (bookingId: string) => void;
};

const toRad = (deg: number) => deg * (Math.PI / 180);

const haversineKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

const BookingRequestCard = ({
  request,
  driverLocation,
  timeoutSeconds,
  onAccept,
  onReject,
  onPress,
  showActions = true,
  onTimeout,
}: BookingRequestCardProps) => {
  const theme = useTheme();
  const tickingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scheduledLabel = useMemo(() => {
    const raw = request.scheduledTime;
    if (!raw) return null;
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return null;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hh = d.getHours();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    const min = String(d.getMinutes()).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} • ${String(hh).padStart(2, '0')}:${min} ${ampm}`;
  }, [request.scheduledTime]);

  const tripTypeLabel = useMemo(() => {
    const t = String(request.tripType || '').toUpperCase();
    if (t === 'ROUND_TRIP') return 'Round Trip';
    if (t === 'OUTSTATION') {
      const sub = String(request.outstationTripType || '').toUpperCase();
      if (sub === 'ONE_WAY') return 'Outstation • One Way';
      if (sub === 'ROUND_TRIP') return 'Outstation • Round Trip';
      return 'Outstation';
    }
    return 'One Way';
  }, [request.outstationTripType, request.tripType]);

  const hoursLabel = useMemo(() => {
    const h = Number((request as any).requestedHours);
    if (!Number.isFinite(h) || h <= 0) return null;
    return `${Math.round(h)} hr`;
  }, [request]);

  const pickupDistanceKm = useMemo(() => {
    const lat = request.pickup?.latitude;
    const lng = request.pickup?.longitude;
    if (!driverLocation || typeof lat !== 'number' || typeof lng !== 'number') return null;
    return haversineKm(driverLocation, { latitude: lat, longitude: lng });
  }, [driverLocation, request.pickup?.latitude, request.pickup?.longitude]);

  useEffect(() => {
    // ── Timestamp guard ────────────────────────────────────────────────
    // Only fire haptic + vibration + local push if this booking was CREATED
    // after the driver went online. Pre-existing bookings still appear in
    // the list (this card still renders) but produce no sound/notification.
    const driverOnlineAt = socketService.getDriverOnlineAt();
    const bookingCreatedMs = request.createdAt ? new Date(request.createdAt).getTime() : Date.now();
    const isNewBooking = driverOnlineAt === 0 || bookingCreatedMs > driverOnlineAt;

    if (isNewBooking) {
      (async () => {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
        }

        try {
          Vibration.vibrate(120);
        } catch {
        }

        try {
          const perm = await Notifications.getPermissionsAsync();
          if (perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'New booking request',
                body: request.pickup?.address ? `Pickup: ${request.pickup.address}` : 'Open the app to accept/reject',
                sound: 'default',
              },
              trigger: null,
            });
          }
        } catch {
        }
      })();
    }

    return () => {
      if (tickingRef.current) {
        clearInterval(tickingRef.current);
        tickingRef.current = null;
      }
    };
  }, [request.id, request.pickup?.address, timeoutSeconds]);

  const accept = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
    }
    await onAccept(request.id);
  };

  const reject = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
    }

    showAlert('Reject booking?', 'Do you want to reject this booking request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          await onReject(request.id);
        },
      },
    ]);
  };

  return (
    <Card
      style={styles.card}
      accessibilityLabel="Booking request"
      onPress={
        onPress
          ? () => {
            onPress(request.id);
          }
          : undefined
      }
    >
      <Card.Content style={styles.content}>
        {/* Top row: "New request" + "Active" with fare underneath */}
        <View style={styles.topRow}>
          <View>
            <Text variant="titleMedium" style={styles.titleText}>New request</Text>
            <Text style={styles.typeText}>
              {hoursLabel ? `${tripTypeLabel} • ${hoursLabel}` : tripTypeLabel}
            </Text>
          </View>
          <View style={styles.activeWrap}>
            <Text style={styles.activeLabel}>Active</Text>
            <Text style={styles.fareText}>
              {typeof request.fare === 'number' ? `₹${Math.round(request.fare)}` : '—'}
            </Text>
          </View>
        </View>

        {/* Scheduled time if any */}
        {scheduledLabel ? (
          <View style={styles.scheduledRow}>
            <Text style={styles.scheduledIcon}>📅</Text>
            <Text style={styles.scheduledText}>{scheduledLabel}</Text>
          </View>
        ) : null}

        {/* Pickup + Vehicle + Distance in a compact row */}
        <View style={styles.infoRow}>
          <View style={styles.pickupWrap}>
            <Text style={styles.labelText}>Pickup</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {request.pickup?.address || '—'}
            </Text>
          </View>
          <View style={styles.metaWrap}>
            <Text style={styles.metaText}>
              {String(request.vehicleType || 'CAR')}
              {request.transmissionType ? ` • ${String(request.transmissionType)}` : ''}
            </Text>
            {typeof pickupDistanceKm === 'number' ? (
              <Text style={styles.distanceText}>{pickupDistanceKm.toFixed(1)} km away</Text>
            ) : null}
            {typeof request.distanceKm === 'number' ? (
              <Text style={styles.distanceText}>
                Trip: {request.distanceKm.toFixed(1)} km
                {typeof request.etaMin === 'number' ? ` • ${Math.round(request.etaMin)} min` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {showActions ? (
          <View style={styles.buttonsRow}>
            <Button
              mode="contained"
              onPress={accept}
              accessibilityLabel="Accept booking"
              buttonColor="#34C759"
              style={styles.button}
            >
              Accept
            </Button>
            <Button
              mode="outlined"
              onPress={reject}
              accessibilityLabel="Reject booking"
              textColor={theme.colors.error}
              style={styles.button}
            >
              Reject
            </Button>
          </View>
        ) : null}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
  },
  content: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleText: {
    fontWeight: '800',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A8A',
    marginTop: 2,
  },
  activeWrap: {
    alignItems: 'flex-end',
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34C759',
  },
  fareText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#C9A84C',
    marginTop: 1,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  scheduledIcon: {
    fontSize: 13,
  },
  scheduledText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 12,
  },
  pickupWrap: {
    flex: 1,
    minWidth: 0,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8A8A8A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CCCCCC',
    marginTop: 2,
  },
  metaWrap: {
    alignItems: 'flex-end',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A8A',
    marginTop: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  button: {
    flex: 1,
  },
});

export default BookingRequestCard;
