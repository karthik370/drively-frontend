import React, { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar, Button, Divider, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { showAlert } from '../common/CustomAlert';
import { G } from '../../constants/glassStyles';

export type DriverBadgeInfo = {
  title: string;
  icon: string;
  color: string;
};

export type DriverInfo = {
  id: string;
  name: string;
  photo?: string | null;
  rating?: number | null;
  vehicleLabel?: string | null;
  vehicleNumber?: string | null;
  phoneNumber?: string | null;
  badges?: DriverBadgeInfo[];
};

export type DriverInfoCardProps = {
  visible: boolean;
  bookingId: string;
  driver: DriverInfo;
  tripOtp?: string | null;
  etaLabel?: string;
  etaMinutes: number | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  estimatedFare: number | null;
  statusLabel: string;
  onClose: () => void;
  onCancelBooking: () => Promise<void> | void;
};

const SHEET_HEIGHT = Math.min(520, Math.round(Dimensions.get('window').height * 0.62));

const DriverInfoCard = ({
  visible,
  bookingId,
  driver,
  tripOtp,
  etaLabel = 'ETA',
  etaMinutes,
  pickupAddress,
  dropAddress,
  estimatedFare,
  statusLabel,
  onClose,
  onCancelBooking,
}: DriverInfoCardProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const driverRating = (() => {
    const raw = (driver as any)?.rating;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  })();

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  const canCall = Boolean(typeof driver.phoneNumber === 'string' && driver.phoneNumber.trim().length > 0);

  const etaText = useMemo(() => {
    if (etaMinutes === null || !Number.isFinite(etaMinutes)) return '—';
    if (etaMinutes <= 1) return '1 min';
    return `${Math.round(etaMinutes)} min`;
  }, [etaMinutes]);

  const onPressCall = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {
    }

    const phone = typeof driver.phoneNumber === 'string' ? driver.phoneNumber.trim() : '';
    if (!phone) {
      showAlert('Call not available', 'Driver phone number is not available.');
      return;
    }

    const url = `tel:${phone}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      showAlert('Call not supported', 'Your device cannot place calls.');
      return;
    }

    await Linking.openURL(url);
  };

  const onPressShare = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {
    }

    const link = `drivegaadi://booking/${bookingId}`;
    await Share.share({
      message: `Track my trip on DriveGaadi: ${link}`,
      url: link,
    });
  };

  const confirmCancel = () => {
    showAlert('Cancel booking?', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {
          }
          await onCancelBooking();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ translateY }],
              paddingBottom: Math.max(16, insets.bottom + 12),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.driverRow}>
              {driver.photo ? (
                <Avatar.Image
                  size={52}
                  source={{ uri: driver.photo }}
                  style={{ backgroundColor: theme.colors.backdrop }}
                />
              ) : (
                <Avatar.Icon
                  size={52}
                  icon="account"
                  style={{ backgroundColor: theme.colors.backdrop }}
                />
              )}
              <View style={styles.driverMeta}>
                <Text variant="titleMedium">{driver.name}</Text>
                <Text variant="labelMedium">
                  {driverRating !== null ? `${driverRating.toFixed(1)} ★` : '—'}
                  {driver.vehicleLabel ? `  •  ${driver.vehicleLabel}` : ''}
                  {driver.vehicleNumber ? `  •  ${driver.vehicleNumber}` : ''}
                </Text>
                {Array.isArray(driver.badges) && driver.badges.length > 0 && (
                  <View style={styles.badgeRow}>
                    {driver.badges.slice(0, 3).map((b, i) => (
                      <View key={i} style={[styles.badgePill, { backgroundColor: b.color + '22', borderColor: b.color + '55' }]}>
                        <Text style={[styles.badgeText, { color: b.color }]}>{b.title}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.etaWrap}>
              <Text variant="labelSmall">{etaLabel}</Text>
              <Text variant="titleMedium">{etaText}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
              {statusLabel}
            </Text>
          </View>

          {tripOtp ? (
            <View style={styles.tripRow}>
              <Text variant="labelSmall">Trip OTP</Text>
              <Text variant="titleLarge" style={{ fontWeight: '900', letterSpacing: 2 }}>
                {String(tripOtp)}
              </Text>
              <Text variant="labelSmall">Share this OTP with driver to start the trip</Text>
            </View>
          ) : null}

          <Divider />

          <View style={styles.tripRow}>
            <Text variant="labelSmall">Pickup</Text>
            <Text variant="bodyMedium" numberOfLines={2}>
              {pickupAddress || '—'}
            </Text>
          </View>

          <View style={styles.tripRow}>
            <Text variant="labelSmall">Drop</Text>
            <Text variant="bodyMedium" numberOfLines={2}>
              {dropAddress || '—'}
            </Text>
          </View>

          <View style={styles.tripRow}>
            <Text variant="labelSmall">Fare</Text>
            <Text variant="bodyMedium">{estimatedFare !== null ? `₹${Math.round(estimatedFare)}` : '—'}</Text>
          </View>

          <View style={styles.actions}>
            <Button
              mode="contained"
              icon="phone"
              onPress={onPressCall}
              disabled={!canCall}
              accessibilityLabel="Call driver"
            >
              Call
            </Button>
            <Button mode="outlined" icon="share-variant" onPress={onPressShare} accessibilityLabel="Share trip">
              Share
            </Button>
          </View>

          <View style={styles.footerActions}>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={confirmCancel}
              accessibilityLabel="Cancel booking"
            >
              Cancel Booking
            </Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  driverMeta: {
    marginLeft: 10,
    flex: 1,
  },
  etaWrap: {
    alignItems: 'flex-end',
  },
  statusRow: {
    marginTop: 6,
    marginBottom: 8,
  },
  tripRow: {
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  footerActions: {
    marginTop: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
});

export default DriverInfoCard;
