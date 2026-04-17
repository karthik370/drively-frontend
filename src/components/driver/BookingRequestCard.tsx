import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Vibration, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
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
      <Card.Content>
        <View style={styles.rowBetween}>
          <Text variant="titleMedium">New request</Text>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            Active
          </Text>
        </View>

        <View style={styles.block}>
          <Text variant="labelSmall">Booking Type</Text>
          <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
            {hoursLabel ? `${tripTypeLabel} • ${hoursLabel}` : tripTypeLabel}
          </Text>
        </View>

        <View style={styles.block}>
          <Text variant="labelSmall">Vehicle</Text>
          <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
            {String(request.vehicleType || 'CAR')}
            {request.transmissionType ? ` • ${String(request.transmissionType)}` : ''}
          </Text>
        </View>

        {scheduledLabel ? (
          <View style={styles.block}>
            <Text variant="labelSmall">Scheduled Time</Text>
            <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
              {scheduledLabel}
            </Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text variant="labelSmall">Pickup</Text>
          <Text variant="bodyMedium" numberOfLines={2}>
            {request.pickup?.address || '—'}
          </Text>
          {typeof pickupDistanceKm === 'number' ? (
            <Text variant="labelSmall">{pickupDistanceKm.toFixed(1)} km away</Text>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text variant="labelSmall">Drop</Text>
          <Text variant="bodyMedium" numberOfLines={2}>
            {request.drop?.address || '—'}
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <View>
            <Text variant="labelSmall">Trip</Text>
            <Text variant="bodyMedium">
              {typeof request.distanceKm === 'number' ? `${request.distanceKm.toFixed(1)} km` : '—'}
              {typeof request.etaMin === 'number' ? ` • ${Math.round(request.etaMin)} min` : ''}
            </Text>
          </View>
          <View style={styles.earningsWrap}>
            <Text variant="labelSmall">Earnings</Text>
            <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
              ₹{request.fare ? Math.round(request.fare) : '—'}
            </Text>
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
    marginTop: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  block: {
    marginTop: 10,
  },
  earningsWrap: {
    alignItems: 'flex-end',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  button: {
    flex: 1,
  },
});

export default BookingRequestCard;
