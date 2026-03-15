import React, { useEffect, useMemo, useRef } from 'react';
import QRCode from 'react-native-qrcode-svg';
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
  Share,
  ScrollView,
  Dimensions,
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
  addChatMessage,
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
  createTripShareLink,
  createBookingPaymentOrder,
  verifyBookingPayment,
  payBookingWithWallet,
  getBookingPaymentStatus,
} from '../../services/api';
import socketService from '../../services/socketService';
import { decodePolyline } from '../../utils/decodePolyline';
import DriverMarker from '../../components/maps/DriverMarker';
import RoutePolyline from '../../components/maps/RoutePolyline';
import DriverArrivingCard from '../../components/customer/DriverArrivingCard';
import SearchingForDriverCard from '../../components/customer/SearchingForDriverCard';
import SOSButton from '../../components/common/SOSButton';
import useDriverTracking from '../../hooks/useDriverTracking';
import useRealTimeLocation from '../../hooks/useRealTimeLocation';
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
  const [unreadChatCount, setUnreadChatCount] = React.useState(0);
  const [isRatingModalVisible, setIsRatingModalVisible] = React.useState(false);
  const [ratingValue, setRatingValue] = React.useState<number>(5);
  const [ratingReview, setRatingReview] = React.useState<string>('');
  const [isRatingSubmitting, setIsRatingSubmitting] = React.useState(false);
  const [completedSyncDone, setCompletedSyncDone] = React.useState(true);
  const [paymentProcessing, setPaymentProcessing] = React.useState(false);
  const [paymentDone, setPaymentDone] = React.useState(false);
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [qrPayUrl, setQrPayUrl] = React.useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = React.useState<string | null>(null);
  const [qrLoading, setQrLoading] = React.useState(false);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = React.useState<NearbyDriver[]>([]);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const mapRef = useRef<MapView | null>(null);
  const nearbyFetchRef = useRef<{ inFlight: boolean }>({ inFlight: false });
  const lastRouteKeyRef = useRef<string | null>(null);

  // Poll payment status while QR modal is open
  useEffect(() => {
    if (!showQrModal || !booking?.id) return;
    if (paymentDone) return;

    const poll = async () => {
      try {
        const status = await getBookingPaymentStatus(booking.id);
        if (status?.paymentStatus === 'PAID') {
          setPaymentDone(true);
          // Auto-close QR after short delay
          setTimeout(() => setShowQrModal(false), 2000);
        }
      } catch {}
    };

    poll(); // Initial check
    qrPollRef.current = setInterval(poll, 4000);

    return () => {
      if (qrPollRef.current) {
        clearInterval(qrPollRef.current);
        qrPollRef.current = null;
      }
    };
  }, [showQrModal, booking?.id, paymentDone]);
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

  // Driver must keep emitting live location updates while on Tracking screen,
  // otherwise customer won't receive driver:location-update after accept.
  useRealTimeLocation(Boolean(trackingBookingId), 'foreground', trackingBookingId);

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
    if (trackingBookingId) return;

    didEndNavigateRef.current = true;
    navigation.navigate('Tabs');
  }, [booking, navigation, trackingBookingId]);

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

  const statusInfo = useMemo(() => {
    const s = booking?.status;
    if (!s) return { text: 'Waiting for driver...', color: '#C9A84C', bg: '#eff6ff', icon: 'clock-outline' as const };
    if (s === 'SEARCHING') return { text: 'Searching for nearby drivers...', color: '#C9A84C', bg: '#eff6ff', icon: 'radar' as const };
    if (s === 'ACCEPTED') return { text: 'Driver accepted • On the way', color: '#f59e0b', bg: '#fffbeb', icon: 'car-side' as const };
    if (s === 'DRIVER_ARRIVING') return { text: 'Driver arriving soon', color: '#f59e0b', bg: '#fffbeb', icon: 'car-side' as const };
    if (s === 'ARRIVED') return { text: 'Driver arrived at pickup', color: '#10b981', bg: '#f0fdf4', icon: 'map-marker-check' as const };
    if (s === 'STARTED' || s === 'IN_PROGRESS') return { text: 'Trip in progress', color: '#C9A84C', bg: '#eff6ff', icon: 'navigation-variant' as const };
    if (s === 'COMPLETED') return { text: 'Trip completed', color: '#059669', bg: '#f0fdf4', icon: 'check-circle' as const };
    if (s === 'CANCELLED') return { text: 'Booking cancelled', color: '#ef4444', bg: '#fef2f2', icon: 'close-circle' as const };
    return { text: `Status: ${s}`, color: '#8A8A8A', bg: '#f9fafb', icon: 'information' as const };
  }, [booking?.status]);

  const statusText = statusInfo.text;

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

  // ── Listen for incoming chat messages to show unread badge ──
  useEffect(() => {
    if (!booking?.id) return;
    const bId = booking.id;
    let active = true;

    const onChatMessage = (payload: any) => {
      if (!active) return;
      const senderId = String(payload?.senderId ?? '');
      const myId = String(authedUserId ?? '');
      const msgText = String(payload?.message ?? '');
      const incomingClientId = typeof payload?.clientMessageId === 'string' ? payload.clientMessageId : null;
      const ts = payload?.timestamp instanceof Date
        ? payload.timestamp.toISOString()
        : typeof payload?.timestamp === 'string'
          ? payload.timestamp
          : new Date().toISOString();

      // Persist message in Redux
      if (msgText) {
        const stableId = incomingClientId
          ? incomingClientId
          : `${senderId || 'unknown'}-${ts}-${msgText.slice(0, 12)}`;
        dispatch(addChatMessage({
          bookingId: bId,
          id: stableId,
          senderId: senderId || null,
          message: msgText,
          timestamp: ts,
        }));
      }

      // Count unread from other party
      if (senderId && myId && senderId !== myId) {
        setUnreadChatCount((prev) => prev + 1);
      }
    };

    const init = async () => {
      try {
        await socketService.connect();
        if (!active) return;
        socketService.joinBooking(bId);
        socketService.on('chat:message', onChatMessage);
      } catch {}
    };
    init();

    return () => {
      active = false;
      socketService.off('chat:message', onChatMessage);
    };
  }, [booking?.id, authedUserId, dispatch]);

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
          <Icon name="arrow-left" size={24} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Ride</Text>
        <SOSButton bookingId={booking?.id ? String(booking.id) : undefined} compact />
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
            <RoutePolyline coordinates={decodedRoute} strokeWidth={4} strokeColor="#2412eaff" animated />
          ) : null}
          {effectivePickupLocation ? (
            <Marker coordinate={effectivePickupLocation} zIndex={5} title="Pickup">
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
                  <Icon name="account" size={14} color="#ffffff" />
                </View>
                <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#10b981', marginTop: -2 }} />
              </View>
            </Marker>
          ) : null}
          {effectiveDropLocation ? (
            <Marker coordinate={effectiveDropLocation} zIndex={5} title="Drop">
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
                  <Icon name="flag-checkered" size={14} color="#ffffff" />
                </View>
                <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#ef4444', marginTop: -2 }} />
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

      <ScrollView style={styles.bottomScrollView} contentContainerStyle={[styles.bottomSheet, { paddingBottom: 20 + Math.max(0, insets.bottom) }]} bounces={false}>
        <View style={[styles.statusBar, { backgroundColor: statusInfo.bg }]}>
          <Icon name={statusInfo.icon} size={16} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusText}</Text>
        </View>

        {/* ── OTP card — prominently shown to customer ── */}
        {showCustomerOtp ? (
          <View style={styles.otpCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="lock-outline" size={18} color="#C9A84C" />
              <Text style={styles.otpTitle}>Trip OTP</Text>
            </View>
            <Text style={styles.otpValue}>{String((booking as any).otp)}</Text>
            <Text style={styles.otpHint}>Share this OTP with driver to start the trip</Text>
          </View>
        ) : null}

        {/* ── Driver card — inside flow, no absolute ── */}
        {showDriverSection && booking?.id && !isDriverMode ? (
          <View style={styles.driverCardWrap}>
            <DriverArrivingCard
              driverName={`${String((booking as any)?.driver?.firstName ?? '')} ${String(
                (booking as any)?.driver?.lastName ?? ''
              )}`.trim() || 'Driver'}
              driverPhoto={(booking as any)?.driver?.profileImage ?? null}
              driverRating={parseRating(
                (booking as any)?.driver?.rating ??
                (booking as any)?.driver?.avgRating ??
                (booking as any)?.driver?.averageRating ??
                (booking as any)?.driver?.driverRating
              )}
              vehicleInfo={
                (booking as any)?.driver?.driverProfile
                  ? `${(booking as any).driver.driverProfile.vehicleMake ?? ''} ${(booking as any).driver.driverProfile.vehicleModel ?? ''}`.trim() || null
                  : null
              }
              licensePlate={(booking as any)?.driver?.driverProfile?.licensePlate ?? null}
              etaMinutes={eta}
              status={String(booking.status)}
              phoneNumber={normalizePhone(
                (booking as any)?.driver?.phoneNumber ??
                (booking as any)?.driver?.phone ??
                (booking as any)?.driver?.mobileNumber ??
                (booking as any)?.driver?.mobile ??
                (booking as any)?.driver?.contactNumber
              )}
              shareUrl={shareUrl}
              onCall={booking?.status === 'STARTED' || booking?.status === 'IN_PROGRESS' || booking?.status === 'COMPLETED' ? undefined : callOtherParty}
              onChat={booking?.status === 'STARTED' || booking?.status === 'IN_PROGRESS' || booking?.status === 'COMPLETED' ? undefined : () => {
                if (booking?.id) {
                  setUnreadChatCount(0);
                  navigation.navigate('Chat', { bookingId: booking.id });
                }
              }}
              onShare={async () => {
                if (!booking?.id) return;
                try {
                  setIsSharing(true);
                  let url = shareUrl;
                  if (!url) {
                    const res = await createTripShareLink(booking.id);
                    url = res.shareUrl;
                    setShareUrl(url);
                  }
                  await Share.share({
                    message: `Track my DriveMate ride live: ${url}`,
                  });
                } catch (e: any) {
                  if (e?.message !== 'User did not share') {
                    Alert.alert('Share', 'Failed to create share link');
                  }
                } finally {
                  setIsSharing(false);
                }
              }}
            />
          </View>
        ) : null}

        {isWaitingForDriver ? (
          <SearchingForDriverCard
            pickupAddress={(booking as any)?.pickupAddress}
            dropAddress={(booking as any)?.dropAddress}
            fare={typeof booking?.totalAmount === 'number' ? booking.totalAmount : undefined}
            vehicleType={(booking as any)?.vehicleType}
            onCancel={canCustomerCancelSearching ? () => {
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
            } : undefined}
          />
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
                {booking?.status !== 'STARTED' && booking?.status !== 'IN_PROGRESS' && booking?.status !== 'COMPLETED' ? (
                  <>
                    <TouchableOpacity style={styles.contactActionBtn} onPress={callOtherParty}>
                      <Icon name="phone" size={18} color="#10b981" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contactActionBtn}
                      onPress={() => {
                        if (booking?.id) {
                          setUnreadChatCount(0);
                          navigation.navigate('Chat', { bookingId: booking.id });
                        }
                      }}
                    >
                      <Icon name="chat" size={18} color="#C9A84C" />
                      {unreadChatCount > 0 ? (
                        <View style={styles.chatBadge}>
                          <Text style={styles.chatBadgeText}>{unreadChatCount > 9 ? '9+' : unreadChatCount}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </>
                ) : null}
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

        {canCustomerCancelSearching && !isWaitingForDriver ? (
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
            <Text style={styles.finalFareHint}>
              {isDriverMode
                ? 'Trip completed'
                : (booking as any)?.paymentMethod === 'CASH'
                  ? (paymentDone || (booking as any)?.paymentStatus === 'PAID') ? 'Paid via QR ✓' : 'Pay driver in cash or scan QR'
                  : (booking as any)?.paymentMethod === 'WALLET'
                    ? (paymentDone || (booking as any)?.paymentStatus === 'PAID') ? 'Paid from wallet ✓' : 'Paying from wallet...'
                    : (paymentDone || (booking as any)?.paymentStatus === 'PAID') ? 'Payment complete ✓' : `Pay via ${(booking as any)?.paymentMethod === 'UPI' ? 'UPI' : 'Card'}`
              }
            </Text>

            {/* UPI/CARD: Pay button */}

            {/* DRIVER: Show QR Code button for CASH trips */}
            {isDriverMode && !paymentDone && (booking as any)?.paymentStatus !== 'PAID' ? (
              <TouchableOpacity
                style={[styles.finalFareDone, { backgroundColor: '#10b981', marginBottom: 12 }]}
                disabled={qrLoading}
                onPress={async () => {
                  if (!booking?.id) return;
                  setQrLoading(true);
                  try {
                    const order = await createBookingPaymentOrder(booking.id);
                    if (order.alreadyPaid) {
                      setPaymentDone(true);
                      Alert.alert('Payment', 'Already paid!');
                      return;
                    }
                    const cfEnv = __DEV__ ? 'sandbox' : 'api';
                    const payUrl = `https://${cfEnv}.cashfree.com/pg/orders/sessions/${order.paymentSessionId}`;
                    setQrPayUrl(payUrl);
                    setQrOrderId(order.orderId);
                    setShowQrModal(true);
                  } catch (e: any) {
                    Alert.alert('QR Code', e?.message || 'Could not generate QR code');
                  } finally {
                    setQrLoading(false);
                  }
                }}
              >
                {qrLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.finalFareDoneText}>{paymentDone ? 'Payment Received ✓' : 'Show QR Code'}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {/* DRIVER: Payment received indicator */}
            {isDriverMode && (paymentDone || (booking as any)?.paymentStatus === 'PAID') ? (
              <View style={[styles.finalFareDone, { backgroundColor: '#059669', marginBottom: 12, opacity: 1 }]}>
                <Text style={styles.finalFareDoneText}>💰 Payment Received</Text>
              </View>
            ) : null}

            {!isDriverMode && ((booking as any)?.paymentMethod === 'UPI' || (booking as any)?.paymentMethod === 'CARD') && !paymentDone && (booking as any)?.paymentStatus !== 'PAID' ? (
              <TouchableOpacity
                style={[styles.finalFareDone, { backgroundColor: '#7c3aed', marginBottom: 12 }]}
                disabled={paymentProcessing}
                onPress={async () => {
                  if (!booking?.id) return;
                  setPaymentProcessing(true);
                  try {
                    const order = await createBookingPaymentOrder(booking.id);
                    if (order.alreadyPaid) {
                      setPaymentDone(true);
                      Alert.alert('Payment', 'Already paid!');
                      return;
                    }
                    // Open Cashfree payment link
                    const cfEnv = __DEV__ ? 'sandbox' : 'api';
                    const payUrl = `https://${cfEnv}.cashfree.com/pg/orders/sessions/${order.paymentSessionId}`;
                    await Linking.openURL(payUrl);
                    // After returning, verify
                    setTimeout(async () => {
                      try {
                        await verifyBookingPayment({ bookingId: booking.id, cf_order_id: order.orderId });
                        setPaymentDone(true);
                        Alert.alert('Payment', 'Payment successful!');
                      } catch {
                        Alert.alert('Payment', 'Payment not verified yet. Pull down to check again or retry.');
                      } finally {
                        setPaymentProcessing(false);
                      }
                    }, 3000);
                  } catch (e: any) {
                    Alert.alert('Payment', e?.message || 'Could not initiate payment');
                    setPaymentProcessing(false);
                  }
                }}
              >
                {paymentProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.finalFareDoneText}>Pay ₹{Number(booking?.totalAmount || 0).toFixed(0)}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {/* WALLET: Auto-pay button */}
            {!isDriverMode && (booking as any)?.paymentMethod === 'WALLET' && !paymentDone && (booking as any)?.paymentStatus !== 'PAID' ? (
              <TouchableOpacity
                style={[styles.finalFareDone, { backgroundColor: '#C9A84C', marginBottom: 12 }]}
                disabled={paymentProcessing}
                onPress={async () => {
                  if (!booking?.id) return;
                  setPaymentProcessing(true);
                  try {
                    const result = await payBookingWithWallet(booking.id);
                    if (result.alreadyPaid) {
                      setPaymentDone(true);
                      Alert.alert('Payment', 'Already paid!');
                    } else {
                      setPaymentDone(true);
                      Alert.alert('Payment', `Paid from wallet! Remaining balance: ₹${result.balance?.toFixed(0) ?? '—'}`);
                    }
                  } catch (e: any) {
                    Alert.alert('Payment Failed', e?.message || 'Could not pay from wallet');
                  } finally {
                    setPaymentProcessing(false);
                  }
                }}
              >
                {paymentProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.finalFareDoneText}>Pay ₹{Number(booking?.totalAmount || 0).toFixed(0)} from Wallet</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.finalFareDone, { backgroundColor: '#1E1E1E', marginBottom: 12 }]}
              onPress={() => {
                if (booking) {
                  navigation.navigate('RideReceipt', { booking });
                }
              }}
            >
              <Text style={styles.finalFareDoneText}>View Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.finalFareDone,
                // Disable Done for online methods until paid
                !isDriverMode && (booking as any)?.paymentMethod !== 'CASH' && !paymentDone && (booking as any)?.paymentStatus !== 'PAID'
                  ? { opacity: 0.4 }
                  : {},
              ]}
              disabled={
                !isDriverMode && (booking as any)?.paymentMethod !== 'CASH' && !paymentDone && (booking as any)?.paymentStatus !== 'PAID'
              }
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
              <Icon name="clock-outline" size={20} color="#8A8A8A" />
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
      </ScrollView>

      {/* QR Code Payment Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => { setShowQrModal(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 }}>Scan to Pay</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Customer, scan this QR with any UPI app</Text>

            {qrPayUrl ? (
              <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E5E5E5' }}>
                <QRCode value={qrPayUrl} size={220} backgroundColor="#FFFFFF" color="#000000" />
              </View>
            ) : (
              <ActivityIndicator size="large" color="#C9A84C" />
            )}

            <Text style={{ fontSize: 28, fontWeight: '900', color: '#111', marginTop: 20 }}>₹{Number(booking?.totalAmount || 0).toFixed(0)}</Text>

            {paymentDone || (booking as any)?.paymentStatus === 'PAID' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#ecfdf5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                <Icon name="check-circle" size={20} color="#059669" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#059669', marginLeft: 6 }}>Payment Received!</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <ActivityIndicator size="small" color="#C9A84C" />
                <Text style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>Waiting for payment...</Text>
              </View>
            )}

            <TouchableOpacity
              style={{ marginTop: 20, backgroundColor: paymentDone ? '#059669' : '#222', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 }}
              onPress={() => setShowQrModal(false)}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{paymentDone ? 'Done' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
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
    backgroundColor: '#C9A84C',
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
    backgroundColor: '#0A0A0A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mapWrap: {
    height: Dimensions.get('window').height * 0.38,
    backgroundColor: '#141414',
  },
  bottomScrollView: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheet: {
    padding: 16,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  finalFareCard: {
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    marginBottom: 16,
  },
  finalFareTitle: { color: '#065f46', fontWeight: '800', fontSize: 14 },
  finalFareValue: { marginTop: 6, color: '#FFFFFF', fontWeight: '900', fontSize: 24 },
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
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    marginBottom: 16,
  },
  liveFareTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 14 },
  liveFareValue: { marginTop: 6, color: '#FFFFFF', fontWeight: '900', fontSize: 22 },
  otpCard: {
    backgroundColor: '#1a1400',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C9A84C',
    padding: 16,
    marginBottom: 16,
  },
  otpTitle: { color: '#C9A84C', fontWeight: '800', fontSize: 14 },
  otpValue: { marginTop: 8, color: '#FFFFFF', fontWeight: '900', fontSize: 36, letterSpacing: 6, textAlign: 'center' },
  otpHint: { marginTop: 6, color: '#C9A84C', fontWeight: '700', fontSize: 13, textAlign: 'center' },
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
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
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
    color: '#FFFFFF',
  },
  contactSubTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  tripMetaStrong: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
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
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#FFFFFF',
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
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C9A84C',
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
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#8A8A8A',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A0A0A',
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
    backgroundColor: '#111111',
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
    color: '#FFFFFF',
  },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    backgroundColor: '#141414',
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
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  otpModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  otpModalSubTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  otpInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: '#141414',
  },
  otpModalBtnPrimary: {
    backgroundColor: '#C9A84C',
  },
  otpModalBtnDisabled: {
    opacity: 0.6,
  },
  otpModalBtnSecondaryText: {
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: '#C9A84C',
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
    backgroundColor: '#141414',
    marginBottom: 16,
  },
  driverChatText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C9A84C',
  },
  driverCardWrap: {
    marginBottom: 12,
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
});

export default TrackingScreen;
