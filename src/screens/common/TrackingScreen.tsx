import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import {
  clearLocations,
  clearRoute,
  setDropAddress,
  setDropLocation,
  setPickupAddress,
  setPickupLocation,
  setRoute,
  updateETA,
} from '../../redux/slices/locationSlice';
import {
  clearCurrentBooking,
  setCurrentBooking,
  updateBookingCustomerRating,
  updateBookingOtp,
  updateBookingStatus,
} from '../../redux/slices/bookingSlice';
import {
  calculateRoute,
  cancelBooking,
  getNearbyDrivers,
  type NearbyDriver,
  getBookingDetails,
  rateBooking,
  updateBookingStatus as updateBookingStatusApi,
  verifyBookingOtp,
} from '../../services/api';
import socketService from '../../services/socketService';
import { decodePolyline } from '../../utils/decodePolyline';
import DriverMarker from '../../components/maps/DriverMarker';
import RoutePolyline from '../../components/maps/RoutePolyline';
import DriverInfoCard from '../../components/customer/DriverInfoCard';
import useDriverTracking from '../../hooks/useDriverTracking';
import { BookingStatus, UserType } from '../../types';

const distanceApproxMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const normalizePhone = (raw: any): string | null => {
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === 'string' ? raw : String(raw);
  const cleaned = s.trim();
  if (!cleaned) return null;
  return cleaned;
};

const parseRating = (raw: any): number | null => {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
};

const TrackingScreen = ({ navigation, route }: any) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const booking = useAppSelector((s) => s.booking.currentBooking);
  const authedUserType = useAppSelector((s) => s.auth.user?.userType);
  const authedUserId = useAppSelector((s) => s.auth.user?.id);
  const roleOverride = useAppSelector((s) => s.auth.roleOverride);
  const { pickupLocation, dropLocation, driverLocation, decodedRoute, eta, distance, currentLocation, userLocation, routePolyline } =
    useAppSelector((s) => s.location);
  const [isInfoVisible, setIsInfoVisible] = React.useState(true);
  const [isOtpModalVisible, setIsOtpModalVisible] = React.useState(false);
  const [otpInput, setOtpInput] = React.useState('');
  const [isOtpSubmitting, setIsOtpSubmitting] = React.useState(false);
  const [isRatingModalVisible, setIsRatingModalVisible] = React.useState(false);
  const [ratingValue, setRatingValue] = React.useState<number>(5);
  const [ratingReview, setRatingReview] = React.useState<string>('');
  const [isRatingSubmitting, setIsRatingSubmitting] = React.useState(false);
  const [completedSyncDone, setCompletedSyncDone] = React.useState(true);
  const [nearbyDrivers, setNearbyDrivers] = React.useState<NearbyDriver[]>([]);
  const mapRef = useRef<MapView | null>(null);
  const nearbyFetchRef = useRef<{ inFlight: boolean }>({ inFlight: false });
  const lastRouteKeyRef = useRef<string | null>(null);
  const lastRouteTsRef = useRef<number>(0);
  const lastApproxEtaTsRef = useRef<number>(0);
  const lastFitTargetKeyRef = useRef<string | null>(null);
  const lastCameraFitTsRef = useRef<number>(0);
  const lastRouteStartRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastRouteTargetRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFollowCameraTsRef = useRef<number>(0);
  const lastFollowCameraCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const didEndNavigateRef = useRef<boolean>(false);
  const didPromptRatingRef = useRef<boolean>(false);

  const trackingBookingId = useMemo(() => {
    const fromRoute = typeof route?.params?.bookingId === 'string' ? String(route.params.bookingId) : '';
    const fromStore = typeof booking?.id === 'string' ? booking.id : '';
    return fromRoute || fromStore;
  }, [booking?.id, route?.params?.bookingId]);

  useDriverTracking(trackingBookingId);

  useEffect(() => {
    if (!trackingBookingId) return;

    if (booking?.id && String(booking.id) === String(trackingBookingId)) return;

    void (async () => {
      try {
        const raw = await getBookingDetails(trackingBookingId);
        dispatch(setCurrentBooking(raw as any));

        const pickupLat = Number((raw as any)?.pickupLocationLat);
        const pickupLng = Number((raw as any)?.pickupLocationLng);
        if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
          dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
        }
        dispatch(setPickupAddress(typeof (raw as any)?.pickupAddress === 'string' ? (raw as any).pickupAddress : null));

        const dropLatRaw = (raw as any)?.dropLocationLat;
        const dropLngRaw = (raw as any)?.dropLocationLng;
        const dropLat = dropLatRaw !== null && dropLatRaw !== undefined ? Number(dropLatRaw) : NaN;
        const dropLng = dropLngRaw !== null && dropLngRaw !== undefined ? Number(dropLngRaw) : NaN;
        if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
          dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
        }
        dispatch(setDropAddress(typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : null));
      } catch {
      }
    })();
  }, [booking?.id, dispatch, trackingBookingId]);

  const showDriverSection = Boolean(
    booking?.status &&
      ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(String(booking.status))
  );

  const effectiveUserType = useMemo(() => {
    if (authedUserType === UserType.DRIVER && roleOverride === UserType.CUSTOMER) {
      return UserType.CUSTOMER;
    }
    return authedUserType;
  }, [authedUserType, roleOverride]);

  const isDriverMode = effectiveUserType === UserType.DRIVER;
  const isDriverForThisBooking = Boolean(
    authedUserId && ((booking as any)?.driver?.id ? String((booking as any).driver.id) === String(authedUserId) : true)
  );

  const otherParty = useMemo(() => {
    if (!booking) return null;
    if (isDriverMode) {
      const c = (booking as any)?.customer;
      return {
        role: 'CUSTOMER' as const,
        name: `${String(c?.firstName ?? 'Customer')} ${String(c?.lastName ?? '')}`.trim(),
        phoneNumber: normalizePhone(c?.phoneNumber ?? c?.phone ?? c?.mobileNumber ?? c?.mobile ?? c?.contactNumber),
      };
    }

    const d = (booking as any)?.driver;
    return {
      role: 'DRIVER' as const,
      name: `${String(d?.firstName ?? 'Driver')} ${String(d?.lastName ?? '')}`.trim(),
      phoneNumber: normalizePhone(d?.phoneNumber ?? d?.phone ?? d?.mobileNumber ?? d?.mobile ?? d?.contactNumber),
    };
  }, [booking, isDriverMode]);

  const effectivePickupLocation = useMemo(() => {
    const latRaw = (booking as any)?.pickupLocationLat;
    const lngRaw = (booking as any)?.pickupLocationLng;
    const lat = latRaw !== null && latRaw !== undefined ? Number(latRaw) : NaN;
    const lng = lngRaw !== null && lngRaw !== undefined ? Number(lngRaw) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return pickupLocation;
  }, [booking, pickupLocation]);

  const effectiveDropLocation = useMemo(() => {
    const latRaw = (booking as any)?.dropLocationLat;
    const lngRaw = (booking as any)?.dropLocationLng;
    const lat = latRaw !== null && latRaw !== undefined ? Number(latRaw) : NaN;
    const lng = lngRaw !== null && lngRaw !== undefined ? Number(lngRaw) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return dropLocation;
  }, [booking, dropLocation]);

  const bookingTypeLabel = useMemo(() => {
    const t = String((booking as any)?.tripType ?? '').toUpperCase();
    if (t === 'ROUND_TRIP') return 'Round Trip';
    if (t === 'OUTSTATION') {
      const sub =
        typeof (booking as any)?.pricingBreakdown === 'object' && (booking as any)?.pricingBreakdown
          ? String(((booking as any).pricingBreakdown as any).outstationTripType ?? '').toUpperCase()
          : '';
      if (sub === 'ONE_WAY') return 'Outstation • One Way';
      if (sub === 'ROUND_TRIP') return 'Outstation • Round Trip';
      return 'Outstation';
    }
    return 'One Way';
  }, [booking]);

  const selectedHoursLabel = useMemo(() => {
    const raw =
      typeof (booking as any)?.pricingBreakdown === 'object' && (booking as any)?.pricingBreakdown
        ? ((booking as any).pricingBreakdown as any).packageHours ?? ((booking as any).pricingBreakdown as any).durationHours
        : undefined;
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return `${Math.round(hours)} hr`;
  }, [booking]);

  const tripTypeHoursLabel = useMemo(() => {
    return selectedHoursLabel ? `${bookingTypeLabel} • ${selectedHoursLabel}` : bookingTypeLabel;
  }, [bookingTypeLabel, selectedHoursLabel]);

  const navTarget = useMemo(() => {
    const status = booking?.status;
    const shouldGoToDrop = Boolean(
      status && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(status as any)
    );
    if (shouldGoToDrop && effectiveDropLocation) return effectiveDropLocation;
    if (effectivePickupLocation) return effectivePickupLocation;
    return null;
  }, [booking?.status, effectiveDropLocation, effectivePickupLocation]);

  const openGoogleMaps = async () => {
    if (!navTarget) {
      Alert.alert('Navigation', 'Location not available');
      return;
    }
    const lat = navTarget.latitude;
    const lng = navTarget.longitude;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Navigation', 'Failed to open Google Maps');
    }
  };

  const etaText = useMemo(() => {
    if (eta === null || !Number.isFinite(eta)) return '—';
    if (eta <= 1) return '1 min';
    return `${Math.round(eta)} min`;
  }, [eta]);

  const etaTargetLabel = useMemo(() => {
    const s = booking?.status;
    if (!s) return 'ETA';
    if ([BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(s as any)) {
      return 'ETA to Drop';
    }
    return 'ETA to Pickup';
  }, [booking?.status]);

  const isWaitingForDriver = Boolean(
    booking?.status && [BookingStatus.REQUESTED, BookingStatus.SEARCHING].includes(booking.status as any)
  );

  useEffect(() => {
    const shouldShow = Boolean(!isDriverMode && isWaitingForDriver && effectivePickupLocation);

    if (!shouldShow) {
      setNearbyDrivers([]);
      return;
    }

    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      if (!mounted) return;
      if (!effectivePickupLocation) return;
      if (nearbyFetchRef.current.inFlight) return;

      nearbyFetchRef.current.inFlight = true;
      try {
        const res = await getNearbyDrivers(effectivePickupLocation.latitude, effectivePickupLocation.longitude, 6);
        if (!mounted) return;
        setNearbyDrivers(Array.isArray(res) ? res : []);
      } catch {
        if (!mounted) return;
        setNearbyDrivers([]);
      } finally {
        nearbyFetchRef.current.inFlight = false;
      }
    };

    run();
    timer = setInterval(run, 6000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [effectivePickupLocation, isDriverMode, isWaitingForDriver]);

  const navigateTargetLabel = useMemo(() => {
    const s = booking?.status;
    if (s && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(s as any)) {
      return 'Drop';
    }
    return 'Pickup';
  }, [booking?.status]);

  const routeStart = useMemo(() => {
    const base = isDriverMode ? (currentLocation ?? driverLocation) : driverLocation;
    if (!base) return null;
    if (!Number.isFinite(base.latitude) || !Number.isFinite(base.longitude)) return null;
    return { latitude: base.latitude, longitude: base.longitude };
  }, [currentLocation, driverLocation, isDriverMode]);

  const routeTarget = useMemo(() => {
    const status = booking?.status;
    if (!effectivePickupLocation) return null;
    const shouldGoToDrop = Boolean(
      status && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(status as any)
    );

    if (shouldGoToDrop && effectiveDropLocation) {
      return { latitude: effectiveDropLocation.latitude, longitude: effectiveDropLocation.longitude };
    }

    return { latitude: effectivePickupLocation.latitude, longitude: effectivePickupLocation.longitude };
  }, [booking?.status, effectiveDropLocation, effectivePickupLocation]);

  const distanceText = useMemo(() => {
    if (distance === null || !Number.isFinite(distance)) return '—';
    return `${Number(distance).toFixed(1)} km`;
  }, [distance]);

  const callOtherParty = async () => {
    const phone = normalizePhone(otherParty?.phoneNumber);
    if (!phone) {
      Alert.alert('Call not available', 'Phone number is not available.');
      return;
    }

    const url = `tel:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        await Linking.openURL(url);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Call', 'Unable to place call from this device.');
    }
  };

  const canControlTrip = Boolean(
    booking?.id &&
      isDriverMode &&
      isDriverForThisBooking &&
      booking?.status &&
      [BookingStatus.ACCEPTED, BookingStatus.DRIVER_ARRIVING, BookingStatus.ARRIVED, BookingStatus.STARTED, BookingStatus.IN_PROGRESS].includes(
        booking.status as any
      )
  );

  const canCustomerCancelSearching = Boolean(
    !isDriverMode &&
      booking?.id &&
      booking?.status &&
      [BookingStatus.REQUESTED, BookingStatus.SEARCHING].includes(booking.status as any)
  );

  const canDriverCancelPreStart = Boolean(
    booking?.id &&
      isDriverMode &&
      isDriverForThisBooking &&
      booking?.status &&
      [BookingStatus.ACCEPTED, BookingStatus.DRIVER_ARRIVING, BookingStatus.ARRIVED].includes(booking.status as any)
  );

  const handleDriverStatusUpdate = async (nextStatus: BookingStatus) => {
    const bookingId = booking?.id;
    if (!bookingId) return;

     if (nextStatus === BookingStatus.COMPLETED) {
      Alert.alert('Complete trip?', 'Are you sure you want to complete this trip?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, complete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await updateBookingStatusApi(bookingId, nextStatus);
                dispatch(updateBookingStatus({ id: bookingId, status: nextStatus }));
              } catch (e: any) {
                Alert.alert('Update status', e?.message || 'Failed to update booking status');
              }
            })();
          },
        },
      ]);
      return;
    }
    try {
      await updateBookingStatusApi(bookingId, nextStatus);
      dispatch(updateBookingStatus({ id: bookingId, status: nextStatus }));
    } catch (e: any) {
      Alert.alert('Update status', e?.message || 'Failed to update booking status');
    }
  };

  const canCustomerRateDriver = Boolean(
    !isDriverMode &&
      booking?.id &&
      booking?.status === BookingStatus.COMPLETED &&
      (booking as any)?.driver?.id &&
      completedSyncDone &&
      !(booking as any)?.customerRating
  );

  useEffect(() => {
    const bookingId = booking?.id;
    const status = booking?.status;
    if (!bookingId) return;
    if (isDriverMode) {
      setCompletedSyncDone(true);
      return;
    }
    if (status !== BookingStatus.COMPLETED) {
      setCompletedSyncDone(true);
      return;
    }

    setCompletedSyncDone(false);
    void (async () => {
      try {
        const raw = await getBookingDetails(bookingId);
        const ratingRaw = (raw as any)?.customerRating;
        const ratingNum = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw);
        if (Number.isFinite(ratingNum) && ratingNum > 0) {
          dispatch(
            updateBookingCustomerRating({
              id: bookingId,
              rating: Number(ratingNum),
              review: typeof (raw as any)?.customerReview === 'string' ? (raw as any).customerReview : null,
            })
          );
        }
      } catch {
      } finally {
        setCompletedSyncDone(true);
      }
    })();
  }, [booking?.id, booking?.status, dispatch, isDriverMode]);

  const submitRating = async () => {
    if (!booking?.id) return;
    if (!canCustomerRateDriver) return;
    if (isRatingSubmitting) return;

    setIsRatingSubmitting(true);
    try {
      await rateBooking(booking.id, ratingValue, ratingReview.trim() || undefined);
      dispatch(updateBookingCustomerRating({ id: booking.id, rating: ratingValue, review: ratingReview.trim() || null }));
      dispatch(updateBookingStatus({ id: booking.id, status: BookingStatus.COMPLETED }));
      setIsRatingModalVisible(false);
      Alert.alert('Thank you', 'Rating submitted successfully');
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : Number(e?.status);
      if (status === 409) {
        setIsRatingModalVisible(false);
        try {
          const raw = await getBookingDetails(booking.id);
          const ratingRaw = (raw as any)?.customerRating;
          const ratingNum = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw);
          if (Number.isFinite(ratingNum) && ratingNum > 0) {
            dispatch(
              updateBookingCustomerRating({
                id: booking.id,
                rating: Number(ratingNum),
                review: typeof (raw as any)?.customerReview === 'string' ? (raw as any).customerReview : null,
              })
            );
          }
        } catch {
        }
        Alert.alert('Submit rating', 'Rating already submitted');
      } else {
        Alert.alert('Submit rating', e?.message || 'Failed to submit rating');
      }
    } finally {
      setIsRatingSubmitting(false);
    }
  };

  const handleStartTripWithOtp = async () => {
    if (!booking?.id) return;
    if (isOtpSubmitting) return;

    const otp = otpInput.trim();
    if (!otp) {
      Alert.alert('Enter OTP', 'Please enter the OTP from the customer.');
      return;
    }

    setIsOtpSubmitting(true);
    try {
      await verifyBookingOtp(booking.id, otp);
      dispatch(updateBookingOtp({ id: booking.id, otp: null }));
      dispatch(updateBookingStatus({ id: booking.id, status: BookingStatus.STARTED }));
      setIsOtpModalVisible(false);
      setOtpInput('');
    } catch (e: any) {
      Alert.alert('Verify OTP', e?.message || 'Failed to verify OTP');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  useEffect(() => {
    const s = booking?.status;
    if (!s) return;
    if (didEndNavigateRef.current) return;

    if (s === BookingStatus.CANCELLED) {
      didEndNavigateRef.current = true;
      navigation.navigate('Tabs');
    }
  }, [booking?.status, navigation]);

  useEffect(() => {
    if (didEndNavigateRef.current) return;
    if (booking) return;

    didEndNavigateRef.current = true;
    navigation.navigate('Tabs');
  }, [booking, navigation]);

  useEffect(() => {
    const s = booking?.status;
    if (!s) return;
    if (s === BookingStatus.STARTED || s === BookingStatus.IN_PROGRESS) {
      lastRouteKeyRef.current = null;
      lastRouteTsRef.current = 0;
      lastFitTargetKeyRef.current = null;
      lastFollowCameraTsRef.current = 0;
    }
  }, [booking?.status]);

  const statusText = useMemo(() => {
    const s = booking?.status;
    if (!s) return 'Waiting for driver...';
    if (s === 'SEARCHING') return 'Searching for nearby drivers...';
    if (s === 'ACCEPTED') return 'Driver accepted. On the way.';
    if (s === 'ARRIVED') return 'Driver arrived at pickup.';
    if (s === 'STARTED' || s === 'IN_PROGRESS') return 'Trip in progress.';
    if (s === 'COMPLETED') return 'Trip completed.';
    if (s === 'CANCELLED') return 'Booking cancelled.';
    return `Status: ${s}`;
  }, [booking?.status]);

  const showFinalFare = Boolean(booking?.status === BookingStatus.COMPLETED && typeof booking?.totalAmount === 'number');
  const showLiveFare = Boolean(
    booking?.status &&
      [BookingStatus.STARTED, BookingStatus.IN_PROGRESS].includes(booking.status as any) &&
      typeof booking?.totalAmount === 'number'
  );

  const showCustomerOtp = Boolean(
    !isDriverMode &&
      booking?.status &&
      [
        BookingStatus.ACCEPTED,
        BookingStatus.DRIVER_ARRIVING,
        BookingStatus.ARRIVED,
        BookingStatus.STARTED,
        BookingStatus.IN_PROGRESS,
      ].includes(booking.status as any) &&
      Boolean((booking as any)?.driver?.id) &&
      (typeof (booking as any)?.otp === 'string' || typeof (booking as any)?.otp === 'number') &&
      String((booking as any).otp).trim().length > 0
  );

  const initialRegion = useMemo(() => {
    const base = effectivePickupLocation ?? driverLocation ?? effectiveDropLocation;
    if (!base) {
      return {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [driverLocation, effectiveDropLocation, effectivePickupLocation]);

  const mapEdgePadding = useMemo(
    () => ({
      top: Math.max(90, insets.top + 90),
      right: 60,
      bottom: Math.max(320, 320 + Math.max(0, insets.bottom)),
      left: 60,
    }),
    [insets.bottom, insets.top]
  );

  useEffect(() => {
    if (!showDriverSection) return;

    const status = booking?.status;
    const tripStarted = Boolean(status && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS].includes(status as any));

    if (routeStart && routeTarget) {
      const targetKey = `${routeTarget.latitude.toFixed(5)},${routeTarget.longitude.toFixed(5)}`;
      const now = Date.now();
      const shouldFit = lastFitTargetKeyRef.current !== targetKey;

      if (tripStarted) {
        const intervalMs = 2200;
        const prevFollow = lastFollowCameraCoordRef.current;
        const movedMeters = prevFollow ? distanceApproxMeters(prevFollow, routeStart) : Number.POSITIVE_INFINITY;

        if (movedMeters >= 10 && now - lastFollowCameraTsRef.current >= intervalMs) {
          lastFollowCameraTsRef.current = now;
          lastFollowCameraCoordRef.current = { latitude: routeStart.latitude, longitude: routeStart.longitude };

          const distKm = routeTarget ? distanceApproxMeters(routeStart, routeTarget) / 1000 : 0;
          const zoom = clamp(0.008 + distKm * 0.002, 0.008, 0.03);
          mapRef.current?.animateToRegion(
            {
              latitude: routeStart.latitude,
              longitude: routeStart.longitude,
              latitudeDelta: zoom,
              longitudeDelta: zoom,
            },
            650
          );
        }
        return;
      }

      if (shouldFit) {
        lastFitTargetKeyRef.current = targetKey;
        lastCameraFitTsRef.current = now;
        mapRef.current?.fitToCoordinates([routeStart, routeTarget], {
          edgePadding: mapEdgePadding,
          animated: true,
        });
      }

      return;
    }

    if (!driverLocation) return;
    if (lastCameraFitTsRef.current > 0) return;

    lastCameraFitTsRef.current = Date.now();
    mapRef.current?.animateToRegion(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      650
    );
  }, [driverLocation?.latitude, driverLocation?.longitude, mapEdgePadding, routeStart, routeTarget, showDriverSection]);

  useEffect(() => {
    const status = booking?.status;
    if (!status || status === BookingStatus.CANCELLED) {
      dispatch(clearRoute());
      lastRouteKeyRef.current = null;
      lastFitTargetKeyRef.current = null;
      return;
    }

    const canDraw = Boolean(routeStart && routeTarget);
    if (!canDraw) {
      dispatch(clearRoute());
      lastRouteKeyRef.current = null;
      lastRouteStartRef.current = null;
      lastRouteTargetRef.current = null;
      return;
    }

    const now = Date.now();
    const approxDistKm = distanceApproxMeters(routeStart!, routeTarget!) / 1000;
    if (Number.isFinite(approxDistKm)) {
      const approxIntervalMs = 900;
      if (now - lastApproxEtaTsRef.current >= approxIntervalMs) {
        lastApproxEtaTsRef.current = now;
        const assumedKmph = 24;
        const approxEtaMin = Math.max(1, Math.round((approxDistKm / assumedKmph) * 60));
        dispatch(updateETA({ eta: approxEtaMin, distance: approxDistKm }));
      }
    }

    const prevStart = lastRouteStartRef.current;
    const prevTarget = lastRouteTargetRef.current;
    const startMovedMeters = prevStart ? distanceApproxMeters(prevStart, routeStart!) : Number.POSITIVE_INFINITY;

    const targetKey = `${routeTarget!.latitude.toFixed(5)},${routeTarget!.longitude.toFixed(5)}`;
    const prevTargetKey = prevTarget ? `${prevTarget.latitude.toFixed(5)},${prevTarget.longitude.toFixed(5)}` : null;
    const targetChanged = prevTargetKey !== targetKey;

    const tripStarted = Boolean([BookingStatus.STARTED, BookingStatus.IN_PROGRESS].includes(status as any));
    const minIntervalMs = tripStarted ? 9000 : 12000;
    const shouldSkip =
      !targetChanged &&
      now - lastRouteTsRef.current < minIntervalMs &&
      Number.isFinite(startMovedMeters) &&
      startMovedMeters < 35;

    if (shouldSkip) {
      return;
    }

    lastRouteKeyRef.current = `${routeStart!.latitude.toFixed(5)},${routeStart!.longitude.toFixed(5)}->${targetKey}`;
    lastRouteTsRef.current = now;
    lastRouteStartRef.current = routeStart!;
    lastRouteTargetRef.current = routeTarget!;

    calculateRoute(routeStart!, routeTarget!)
      .then((res) => {
        const poly = String((res as any)?.polyline ?? '');
        if (!poly) return;
        if (typeof routePolyline === 'string' && routePolyline && poly === routePolyline) return;
        const decoded = decodePolyline(poly);
        dispatch(setRoute({ polyline: poly, decodedRoute: decoded }));

        const durationSeconds = typeof (res as any)?.duration === 'number' ? Number((res as any).duration) : NaN;
        const distanceMeters = typeof (res as any)?.distance === 'number' ? Number((res as any).distance) : NaN;
        if (Number.isFinite(durationSeconds) && Number.isFinite(distanceMeters)) {
          dispatch(updateETA({ eta: Math.max(1, Math.round(durationSeconds / 60)), distance: distanceMeters / 1000 }));
        }
      })
      .catch(() => {
      });
  }, [booking?.status, dispatch, eta, mapEdgePadding, routePolyline, routeStart, routeTarget]);

  useEffect(() => {
    if (!booking?.status) return;
    if (booking.status === 'COMPLETED') {
      setIsInfoVisible(false);
    }
  }, [booking?.status]);

  useEffect(() => {
    if (!canCustomerRateDriver) return;
    if (didPromptRatingRef.current) return;
    didPromptRatingRef.current = true;
    setRatingValue(5);
    setRatingReview('');
    setIsRatingModalVisible(true);
  }, [canCustomerRateDriver]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Ride</Text>
        <TouchableOpacity>
          <Icon name="dots-vertical" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
        >
          {decodedRoute && decodedRoute.length > 1 ? (
            <RoutePolyline coordinates={decodedRoute} strokeWidth={4} strokeColor="#2563eb" animated />
          ) : null}
          {effectivePickupLocation ? (
            <Marker coordinate={effectivePickupLocation} zIndex={5}>
              <View style={styles.pickupMarker}>
                <Icon name="map-marker" size={18} color="#ffffff" />
              </View>
            </Marker>
          ) : null}
          {effectiveDropLocation ? (
            <Marker coordinate={effectiveDropLocation} zIndex={5}>
              <View style={styles.dropMarker}>
                <Icon name="map-marker" size={18} color="#ffffff" />
              </View>
            </Marker>
          ) : null}
          {!isDriverMode && isWaitingForDriver
            ? nearbyDrivers.map((d) => {
                const lat = Number((d as any)?.location?.latitude);
                const lng = Number((d as any)?.location?.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return (
                  <DriverMarker
                    key={String((d as any)?.id)}
                    latitude={lat}
                    longitude={lng}
                    status="online"
                    driverPhoto={(d as any)?.photo ?? null}
                  />
                );
              })
            : null}
          {driverLocation ? (
            <DriverMarker latitude={driverLocation.latitude} longitude={driverLocation.longitude} status="busy" />
          ) : null}
        </MapView>
      </View>

      {showDriverSection && booking?.id && !isDriverMode ? (
        <DriverInfoCard
          visible={isInfoVisible}
          bookingId={booking.id}
          driver={{
            id: String((booking as any)?.driver?.id ?? ''),
            name: `${String((booking as any)?.driver?.firstName ?? '')} ${String(
              (booking as any)?.driver?.lastName ?? ''
            )}`.trim(),
            photo: (booking as any)?.driver?.profileImage ?? null,
            rating: parseRating(
              (booking as any)?.driver?.rating ??
                (booking as any)?.driver?.avgRating ??
                (booking as any)?.driver?.averageRating ??
                (booking as any)?.driver?.driverRating
            ),
            phoneNumber: normalizePhone(
              (booking as any)?.driver?.phoneNumber ??
                (booking as any)?.driver?.phone ??
                (booking as any)?.driver?.mobileNumber ??
                (booking as any)?.driver?.mobile ??
                (booking as any)?.driver?.contactNumber
            ),
          }}
          tripOtp={showCustomerOtp ? String((booking as any).otp) : null}
          etaMinutes={eta}
          pickupAddress={(booking as any)?.pickupAddress ?? null}
          dropAddress={(booking as any)?.dropAddress ?? null}
          estimatedFare={
            Number.isFinite(Number((booking as any)?.totalAmount)) ? Number((booking as any).totalAmount) : null
          }
          statusLabel={statusText}
          etaLabel={`${etaTargetLabel} • ${bookingTypeLabel}`}
          onClose={() => setIsInfoVisible(false)}
          onCancelBooking={() => {
            if (!booking?.id) {
              setIsInfoVisible(false);
              return;
            }

            return cancelBooking(booking.id, 'Cancelled by customer', 'CUSTOMER')
              .then(() => {
                dispatch(updateBookingStatus({ id: booking.id, status: 'CANCELLED' }));
                setIsInfoVisible(false);
              })
              .catch((e: any) => {
                Alert.alert('Cancel booking', e?.message || 'Failed to cancel booking');
              });
          }}
        />
      ) : null}

      <View style={[styles.bottomSheet, { paddingBottom: 20 + Math.max(0, insets.bottom) }]}>
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {isWaitingForDriver ? (
          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.waitingText}>Waiting for driver...</Text>
          </View>
        ) : null}

        <Modal
          visible={isRatingModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (isRatingSubmitting) return;
            setIsRatingModalVisible(false);
          }}
        >
          <View style={styles.otpModalOverlay}>
            <View style={styles.otpModalCard}>
              <Text style={styles.otpModalTitle}>Rate your driver</Text>
              <Text style={styles.otpModalSubTitle}>How was your trip?</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRatingValue(n)} disabled={isRatingSubmitting}>
                    <Icon name={n <= ratingValue ? 'star' : 'star-outline'} size={26} color="#f59e0b" />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={ratingReview}
                onChangeText={setRatingReview}
                placeholder="Write a review (optional)"
                style={styles.otpInput}
                editable={!isRatingSubmitting}
              />

              <View style={styles.otpModalActionsRow}>
                <TouchableOpacity
                  style={[styles.otpModalBtn, styles.otpModalBtnSecondary]}
                  onPress={() => {
                    if (isRatingSubmitting) return;
                    setIsRatingModalVisible(false);
                  }}
                >
                  <Text style={styles.otpModalBtnSecondaryText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.otpModalBtn, styles.otpModalBtnPrimary, isRatingSubmitting ? styles.otpModalBtnDisabled : null]}
                  onPress={() => void submitRating()}
                  disabled={isRatingSubmitting}
                >
                  <Text style={styles.otpModalBtnPrimaryText}>{isRatingSubmitting ? 'Submitting…' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {showCustomerOtp ? (
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Trip OTP</Text>
            <Text style={styles.otpValue}>{String((booking as any).otp)}</Text>
            <Text style={styles.otpHint}>Share this OTP with driver to start the trip</Text>
          </View>
        ) : null}

        {showDriverSection && booking?.id && isDriverMode && otherParty ? (
          <View style={styles.contactCard}>
            <View style={styles.contactTopRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.contactTitle}>{otherParty.name || 'Customer'}</Text>
                <Text style={styles.tripMetaStrong} numberOfLines={2}>
                  {tripTypeHoursLabel}
                </Text>
                <Text style={styles.contactSubTitle}>
                  {etaTargetLabel}: {etaText}  •  Distance: {distanceText}
                </Text>
              </View>

              <View style={styles.contactActionsRow}>
                <TouchableOpacity style={styles.navigateBtn} onPress={openGoogleMaps}>
                  <Icon name="map-marker-path" size={18} color="#ffffff" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.navigateBtnTitle} numberOfLines={1}>
                      Navigate to {navigateTargetLabel}
                    </Text>
                    <Text style={styles.navigateBtnSub} numberOfLines={1}>
                      Open Google Maps
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactActionBtn} onPress={callOtherParty}>
                  <Icon name="phone" size={18} color="#10b981" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {canDriverCancelPreStart ? (
          <TouchableOpacity
            style={styles.driverCancelButton}
            onPress={() => {
              if (!booking?.id) return;
              Alert.alert('Cancel ride?', 'Do you want to cancel this ride?', [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Yes, cancel',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await cancelBooking(booking.id, 'Cancelled by driver', 'DRIVER');
                      dispatch(clearCurrentBooking());
                      dispatch(clearLocations());
                      dispatch(clearRoute());
                      navigation.navigate('Tabs');
                    } catch (e: any) {
                      Alert.alert('Cancel ride', e?.message || 'Failed to cancel ride');
                    }
                  },
                },
              ]);
            }}
          >
            <Icon name="close-circle" size={18} color="#ffffff" />
            <Text style={styles.driverCancelText}>Cancel ride</Text>
          </TouchableOpacity>
        ) : null}

        {canCustomerCancelSearching ? (
          <TouchableOpacity
            style={styles.cancelSearchingButton}
            onPress={() => {
              if (!booking?.id) return;
              Alert.alert('Cancel booking?', 'Do you want to cancel this booking request?', [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Yes, cancel',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await cancelBooking(booking.id, 'Cancelled by customer', 'CUSTOMER');
                      dispatch(updateBookingStatus({ id: booking.id, status: 'CANCELLED' }));
                      dispatch(clearCurrentBooking());
                      navigation.navigate('Tabs');
                    } catch (e: any) {
                      Alert.alert('Cancel booking', e?.message || 'Failed to cancel booking');
                    }
                  },
                },
              ]);
            }}
          >
            <Icon name="close-circle" size={18} color="#ffffff" />
            <Text style={styles.cancelSearchingText}>Cancel booking</Text>
          </TouchableOpacity>
        ) : null}

        {showFinalFare ? (
          <View style={styles.finalFareCard}>
            <Text style={styles.finalFareTitle}>Final price</Text>
            <Text style={styles.finalFareValue}>₹{Number(booking?.totalAmount || 0).toFixed(0)}</Text>
            <Text style={styles.finalFareHint}>{isDriverMode ? 'Trip completed' : 'Pay driver in cash'}</Text>
            <TouchableOpacity
              style={styles.finalFareDone}
              onPress={() => {
                dispatch(clearCurrentBooking());
                dispatch(clearLocations());
                dispatch(clearRoute());
                navigation.navigate('Tabs');
              }}
            >
              <Text style={styles.finalFareDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showLiveFare ? (
          <View style={styles.liveFareCard}>
            <Text style={styles.liveFareTitle}>Current price</Text>
            <Text style={styles.liveFareValue}>₹{Number(booking?.totalAmount || 0).toFixed(0)}</Text>
          </View>
        ) : null}

        {canControlTrip ? (
          <View style={styles.driverControlsRow}>
            {booking?.status === BookingStatus.ACCEPTED ? (
              <TouchableOpacity
                style={[styles.tripActionButton, styles.tripActionPrimary]}
                onPress={() => handleDriverStatusUpdate(BookingStatus.ARRIVED)}
              >
                <Icon name="map-marker-check" size={18} color="#ffffff" />
                <Text style={styles.tripActionTextPrimary}>Arrived</Text>
              </TouchableOpacity>
            ) : null}

            {booking?.status === BookingStatus.ARRIVED ? (
              <TouchableOpacity
                style={[styles.tripActionButton, styles.tripActionPrimary]}
                onPress={() => setIsOtpModalVisible(true)}
              >
                <Icon name="car" size={18} color="#ffffff" />
                <Text style={styles.tripActionTextPrimary}>Start Trip</Text>
              </TouchableOpacity>
            ) : null}

            {booking?.status === BookingStatus.STARTED || booking?.status === BookingStatus.IN_PROGRESS ? (
              <TouchableOpacity
                style={[styles.tripActionButton, styles.tripActionDanger]}
                onPress={() => handleDriverStatusUpdate(BookingStatus.COMPLETED)}
              >
                <Icon name="flag-checkered" size={18} color="#ffffff" />
                <Text style={styles.tripActionTextPrimary}>Complete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {showDriverSection && booking?.id && !isDriverMode ? (
          <View style={styles.etaCard}>
            <View style={styles.etaInfo}>
              <Icon name="clock-outline" size={20} color="#6b7280" />
              <Text style={styles.etaText}>
                {etaTargetLabel}: {etaText}  •  Distance: {distanceText}
              </Text>
            </View>
          </View>
        ) : null}

        <Modal
          visible={isOtpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (isOtpSubmitting) return;
            setIsOtpModalVisible(false);
          }}
        >
          <View style={styles.otpModalOverlay}>
            <View style={styles.otpModalCard}>
              <Text style={styles.otpModalTitle}>Enter Trip OTP</Text>
              <Text style={styles.otpModalSubTitle}>Ask customer for the OTP to start the trip</Text>
              <TextInput
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.otpInput}
              />

              <View style={styles.otpModalActionsRow}>
                <TouchableOpacity
                  style={[styles.otpModalBtn, styles.otpModalBtnSecondary]}
                  onPress={() => {
                    if (isOtpSubmitting) return;
                    setIsOtpModalVisible(false);
                  }}
                >
                  <Text style={styles.otpModalBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.otpModalBtn, styles.otpModalBtnPrimary]}
                  onPress={handleStartTripWithOtp}
                >
                  <Text style={styles.otpModalBtnPrimaryText}>{isOtpSubmitting ? 'Verifying...' : 'Verify & Start'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  pickupMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dropMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  mapWrap: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  finalFareCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    marginBottom: 16,
  },
  finalFareTitle: { color: '#065f46', fontWeight: '800', fontSize: 14 },
  finalFareValue: { marginTop: 6, color: '#111827', fontWeight: '900', fontSize: 24 },
  finalFareHint: { marginTop: 4, color: '#065f46', fontWeight: '700' },
  finalFareDone: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalFareDoneText: { color: '#ffffff', fontWeight: '900' },
  liveFareCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    marginBottom: 16,
  },
  liveFareTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 14 },
  liveFareValue: { marginTop: 6, color: '#111827', fontWeight: '900', fontSize: 22 },
  otpCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    marginBottom: 16,
  },
  otpTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 14 },
  otpValue: { marginTop: 6, color: '#111827', fontWeight: '900', fontSize: 28, letterSpacing: 2 },
  otpHint: { marginTop: 4, color: '#1e40af', fontWeight: '700' },
  cancelSearchingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    marginBottom: 16,
  },
  cancelSearchingText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  driverCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    marginBottom: 16,
  },
  driverCancelText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  contactCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  contactSubTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tripMetaStrong: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  contactActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#111827',
    minWidth: 160,
    maxWidth: 220,
  },
  navigateBtnTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    lineHeight: 15,
  },
  navigateBtnSub: {
    marginTop: 1,
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 13,
  },
  contactActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  etaCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
  },
  etaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  otpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  otpModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  otpModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  otpModalSubTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  otpInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 2,
  },
  otpModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  otpModalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpModalBtnSecondary: {
    backgroundColor: '#f3f4f6',
  },
  otpModalBtnPrimary: {
    backgroundColor: '#2563eb',
  },
  otpModalBtnDisabled: {
    opacity: 0.6,
  },
  otpModalBtnSecondaryText: {
    fontWeight: '800',
    color: '#111827',
  },
  otpModalBtnPrimaryText: {
    fontWeight: '800',
    color: '#ffffff',
  },
  driverControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tripActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tripActionPrimary: {
    backgroundColor: '#2563eb',
  },
  tripActionDanger: {
    backgroundColor: '#16a34a',
  },
  tripActionTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  driverChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    marginBottom: 16,
  },
  driverChatText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
});

export default TrackingScreen;
