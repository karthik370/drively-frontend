import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-native';
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
  setDriverLocation,
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
  collectCashPayment,
  checkFavoriteDriver,
  addFavoriteDriver,
  removeFavoriteDriver,
} from '../../services/api';
import { formatMaskedPhone } from '../../utils/phoneMask';
import socketService from '../../services/socketService';
import { decodePolyline } from '../../utils/decodePolyline';
import DriverMarker, { CAR_IMAGE } from '../../components/maps/DriverMarker';
import RoutePolyline from '../../components/maps/RoutePolyline';
import DriverArrivingCard from '../../components/customer/DriverArrivingCard';
import SearchingForDriverCard from '../../components/customer/SearchingForDriverCard';
import SOSButton from '../../components/common/SOSButton';
import useDriverTracking from '../../hooks/useDriverTracking';
import useRealTimeLocation from '../../hooks/useRealTimeLocation';
import { BookingStatus, UserType } from '../../types';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

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

  // Stable refs for values used in timer-based effects (avoids re-render deps)
  const routeStartRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const routeTargetRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const bookingStatusRef = useRef<string | null>(null);
  const routePolylineRef = useRef<string | null>(null);
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
  const [qrDriverUpiId, setQrDriverUpiId] = React.useState<string | null>(null);
  const [qrLoading, setQrLoading] = React.useState(false);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = React.useState<NearbyDriver[]>([]);
  // Remaining polyline ahead of driver — updated by DriverMarker's road-snapping pipeline
  const [remainingRoute, setRemainingRoute] = React.useState<{ latitude: number; longitude: number }[] | null>(null);
  // Reset remaining route when the base decoded route changes (e.g. pickup→drop transition)
  React.useEffect(() => { setRemainingRoute(null); }, [decodedRoute]);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const [isFavDriver, setIsFavDriver] = React.useState(false);
  const [showDriverStatsModal, setShowDriverStatsModal] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false); // Loading overlay for status transitions
  const [isMapPanned, setIsMapPanned] = React.useState(false); // Suspends auto-camera when user moves map
  const isMapPannedRef = useRef(false);
  const pannedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { isMapPannedRef.current = isMapPanned; }, [isMapPanned]);
  // Auto-reset panned flag after 10s so camera resumes following driver
  const handleMapPan = React.useCallback(() => {
    setIsMapPanned(true);
    if (pannedTimerRef.current) clearTimeout(pannedTimerRef.current);
    pannedTimerRef.current = setTimeout(() => setIsMapPanned(false), 10000);
  }, []);
  useEffect(() => { return () => { if (pannedTimerRef.current) clearTimeout(pannedTimerRef.current); }; }, []);
  
  const isCancellingRef = useRef<boolean>(false); // Prevents 'searching' flash on cancel
  const mapRef = useRef<MapView | null>(null);
  const nearbyFetchRef = useRef<{ inFlight: boolean }>({ inFlight: false });
  const lastRouteKeyRef = useRef<string | null>(null);
  const hasRouteEtaRef = useRef<boolean>(false); // Suppress approx ETA when route API ETA exists
  const lastEtaDispatchTsRef = useRef<number>(0); // ETA smoothing: min 5s between updates

  // (markerTracksChanges removed — pickup/drop markers now use native pinColor, no bitmap tracking needed)

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

  // Real-time payment confirmation � both parties update immediately
  useEffect(() => {
    const socket = (socketService as any)?.socket ?? (socketService as any)?.getSocket?.();
    if (!socket) return;
    const onPaymentConfirmed = (data: any) => {
      if (data?.bookingId === booking?.id && data?.paymentStatus === 'PAID') {
        setPaymentDone(true);
        setShowQrModal(false);
      }
    };
    socket.on('payment_confirmed', onPaymentConfirmed);
    return () => { socket.off('payment_confirmed', onPaymentConfirmed); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  // Fix #7: Fallback polling for cash payment — if socket event doesn't arrive,
  // poll the REST API every 5s while trip is COMPLETED and payment is not yet confirmed.
  useEffect(() => {
    if (paymentDone) return;
    if ((booking as any)?.paymentStatus === 'PAID') { setPaymentDone(true); return; }
    if (booking?.status !== BookingStatus.COMPLETED) return;
    if (!booking?.id) return;

    let mounted = true;
    const timer = setInterval(async () => {
      if (!mounted || paymentDone) return;
      try {
        const res = await getBookingPaymentStatus(booking.id);
        if (res?.paymentStatus === 'PAID' && mounted) {
          setPaymentDone(true);
          setShowQrModal(false);
          console.log('[PAYMENT-POLL] Detected PAID via REST fallback');
        }
      } catch {
        // Non-critical — keep trying
      }
    }, 5000);

    return () => { mounted = false; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, booking?.status, paymentDone]);

  const lastRouteTsRef = useRef<number>(0);
  const lastApproxEtaTsRef = useRef<number>(0);
  const lastFitTargetKeyRef = useRef<string | null>(null);
  const lastCameraFitTsRef = useRef<number>(0);
  const lastRouteStartRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastRouteTargetRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFollowCameraTsRef = useRef<number>(0);
  const lastFollowCameraCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  // BUG 2 FIX: Track "just started" window — show full route for first 10s after STARTED
  const justStartedRef = useRef<boolean>(false);
  // BUG 1 FIX: Debounce competing fitToCoordinates calls (last one wins)
  const lastFitCallTsRef = useRef<number>(0);
  const pendingFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Show full route" button state for mid-trip
  const [showFullRouteBtn, setShowFullRouteBtn] = useState(false);
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

  const bookingStatus = booking?.status ?? null;
  const bookingId = booking?.id ?? null;
  const bookingDriver = (booking as any)?.driver ?? null;

  const showDriverSection = Boolean(
    bookingStatus &&
    ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(String(bookingStatus))
  );

  const effectiveUserType = useMemo(() => {
    if (authedUserType === UserType.DRIVER && roleOverride === UserType.CUSTOMER) {
      return UserType.CUSTOMER;
    }
    return authedUserType;
  }, [authedUserType, roleOverride]);

  const isDriverMode = effectiveUserType === UserType.DRIVER;
  const isDriverModeRef = useRef(isDriverMode);
  isDriverModeRef.current = isDriverMode;
  const isDriverForThisBooking = Boolean(
    authedUserId && ((booking as any)?.driver?.id ? String((booking as any).driver.id) === String(authedUserId) : true)
  );

  // ── Auto-navigate back when booking is cleared (e.g. by socket cancel event) ──
  // This catches cases where the socket handler dispatches clearCurrentBooking()
  // but the screen has no trigger to unmount itself.
  useEffect(() => {
    if (isCancellingRef.current) return; // User is actively cancelling — don't fight navigation
    if (!booking) {
      // Booking was cleared by socket handler — go back
      navigation.navigate('Tabs');
      return;
    }
    if (booking.status === 'CANCELLED') {
      navigation.navigate('Tabs');
    }
  }, [booking, booking?.status, navigation]);

  // Check if driver is already a favorite on mount
  useEffect(() => {
    const driverId = (booking as any)?.driver?.id || (booking as any)?.driverId;
    if (!driverId || isDriverMode) return;
    checkFavoriteDriver(String(driverId))
      .then((res) => setIsFavDriver(Boolean(res?.isFavorite)))
      .catch(() => {});
  }, [(booking as any)?.driver?.id, (booking as any)?.driverId, isDriverMode]);

  const otherParty = useMemo(() => {
    if (!booking) return null;
    if (isDriverMode) {
      const c = (booking as any)?.customer;
      const rawPhone = normalizePhone(c?.phoneNumber ?? c?.phone ?? c?.mobileNumber ?? c?.mobile ?? c?.contactNumber);
      return {
        role: 'CUSTOMER' as const,
        name: `${String(c?.firstName ?? 'Customer')} ${String(c?.lastName ?? '')}`.trim(),
        phoneNumber: rawPhone,
        maskedPhone: formatMaskedPhone(rawPhone),
      };
    }

    const d = (booking as any)?.driver;
    const rawPhone = normalizePhone(d?.phoneNumber ?? d?.phone ?? d?.mobileNumber ?? d?.mobile ?? d?.contactNumber);
    return {
      role: 'DRIVER' as const,
      name: `${String(d?.firstName ?? 'Driver')} ${String(d?.lastName ?? '')}`.trim(),
      phoneNumber: rawPhone,
      maskedPhone: formatMaskedPhone(rawPhone),
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
  }, [pickupLocation, (booking as any)?.pickupLocationLat, (booking as any)?.pickupLocationLng]);

  const effectiveDropLocation = useMemo(() => {
    const latRaw = (booking as any)?.dropLocationLat;
    const lngRaw = (booking as any)?.dropLocationLng;
    const lat = latRaw !== null && latRaw !== undefined ? Number(latRaw) : NaN;
    const lng = lngRaw !== null && lngRaw !== undefined ? Number(lngRaw) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return dropLocation;
  }, [dropLocation, (booking as any)?.dropLocationLat, (booking as any)?.dropLocationLng]);

  // --- Stable pickup coordinate (prevents marker vanishing on coord update) ---
  const stablePickupRef = useRef<{latitude: number; longitude: number} | null>(null);
  if (
    effectivePickupLocation &&
    Number.isFinite(effectivePickupLocation.latitude) &&
    Number.isFinite(effectivePickupLocation.longitude) &&
    (effectivePickupLocation.latitude !== 0 || effectivePickupLocation.longitude !== 0)
  ) {
    stablePickupRef.current = effectivePickupLocation;
  }
  const stablePickupCoord = stablePickupRef.current ?? effectivePickupLocation;

  // --- Stable drop coordinate (prevents marker vanishing on coord update) ---
  const stableDropRef = useRef<{latitude: number; longitude: number} | null>(null);
  if (
    effectiveDropLocation &&
    Number.isFinite(effectiveDropLocation.latitude) &&
    Number.isFinite(effectiveDropLocation.longitude) &&
    (effectiveDropLocation.latitude !== 0 || effectiveDropLocation.longitude !== 0)
  ) {
    stableDropRef.current = effectiveDropLocation;
  }
  const stableDropCoord = stableDropRef.current ?? effectiveDropLocation;

  // Markers use tracksViewChanges={false} always — static coords don't need re-rendering.
  // The initial 2.5s window handles the first render, after that Android caches the bitmap.

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
  }, [(booking as any)?.tripType, (booking as any)?.pricingBreakdown]);

  const selectedHoursLabel = useMemo(() => {
    const raw =
      typeof (booking as any)?.pricingBreakdown === 'object' && (booking as any)?.pricingBreakdown
        ? ((booking as any).pricingBreakdown as any).packageHours ?? ((booking as any).pricingBreakdown as any).durationHours
        : undefined;
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return `${Math.round(hours)} hr`;
  }, [(booking as any)?.pricingBreakdown]);

  const tripTypeHoursLabel = useMemo(() => {
    return selectedHoursLabel ? `${bookingTypeLabel} • ${selectedHoursLabel}` : bookingTypeLabel;
  }, [bookingTypeLabel, selectedHoursLabel]);

  // ── Round-trip countdown: detect round-trip in progress ──
  const isRoundTripStarted = useMemo(() => {
    const t = String((booking as any)?.tripType ?? '').toUpperCase();
    const isRoundTrip = t === 'ROUND_TRIP';
    const isTripPhase = bookingStatus && ['STARTED', 'IN_PROGRESS'].includes(bookingStatus);
    return Boolean(isRoundTrip && isTripPhase);
  }, [(booking as any)?.tripType, bookingStatus]);

  // Get package hours for countdown
  const packageHoursForCountdown = useMemo(() => {
    const raw = typeof (booking as any)?.pricingBreakdown === 'object' && (booking as any)?.pricingBreakdown
      ? ((booking as any).pricingBreakdown as any).packageHours ?? ((booking as any).pricingBreakdown as any).durationHours
      : undefined;
    const hours = Number(raw);
    return Number.isFinite(hours) && hours > 0 ? hours : 0;
  }, [(booking as any)?.pricingBreakdown]);

  // Real-time countdown timer for round trips
  const [roundTripCountdown, setRoundTripCountdown] = useState<string | null>(null);
  const [roundTripElapsed, setRoundTripElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!isRoundTripStarted) {
      setRoundTripCountdown(null);
      setRoundTripElapsed(null);
      return;
    }

    // Get trip start time from booking
    const startedAtRaw = (booking as any)?.startedAt;
    const startMs = startedAtRaw ? new Date(startedAtRaw).getTime() : Date.now();
    const totalMs = packageHoursForCountdown * 60 * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const elapsedMs = now - startMs;
      const remainingMs = Math.max(0, totalMs - elapsedMs);

      // Format elapsed
      const elH = Math.floor(elapsedMs / 3_600_000);
      const elM = Math.floor((elapsedMs % 3_600_000) / 60_000);
      const elS = Math.floor((elapsedMs % 60_000) / 1000);
      setRoundTripElapsed(
        elH > 0
          ? `${elH}h ${String(elM).padStart(2, '0')}m ${String(elS).padStart(2, '0')}s`
          : `${elM}m ${String(elS).padStart(2, '0')}s`
      );

      // Format remaining
      if (totalMs > 0) {
        if (remainingMs <= 0) {
          const overMs = elapsedMs - totalMs;
          const overH = Math.floor(overMs / 3_600_000);
          const overM = Math.floor((overMs % 3_600_000) / 60_000);
          setRoundTripCountdown(`-${overH > 0 ? `${overH}h ` : ''}${overM}m (overtime)`);
        } else {
          const remH = Math.floor(remainingMs / 3_600_000);
          const remM = Math.floor((remainingMs % 3_600_000) / 60_000);
          const remS = Math.floor((remainingMs % 60_000) / 1000);
          setRoundTripCountdown(
            remH > 0
              ? `${remH}h ${String(remM).padStart(2, '0')}m ${String(remS).padStart(2, '0')}s`
              : `${remM}m ${String(remS).padStart(2, '0')}s`
          );
        }
      } else {
        setRoundTripCountdown(null);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [isRoundTripStarted, (booking as any)?.startedAt, packageHoursForCountdown]);

  const navTarget = useMemo(() => {
    const shouldGoToDrop = Boolean(
      bookingStatus && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(bookingStatus as any)
    );
    if (shouldGoToDrop && effectiveDropLocation) return effectiveDropLocation;
    if (effectivePickupLocation) return effectivePickupLocation;
    return null;
  }, [bookingStatus, effectiveDropLocation, effectivePickupLocation]);

  const openGoogleMaps = async () => {
    if (!navTarget) {
      showAlert('Navigation', 'Location not available');
      return;
    }
    const lat = navTarget.latitude;
    const lng = navTarget.longitude;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    try {
      await Linking.openURL(url);
    } catch {
      showAlert('Navigation', 'Failed to open Google Maps');
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

  // Fix: explicitly require REQUESTED/SEARCHING status — null status no longer matches.
  // Also gate with isCancellingRef to prevent 'Searching' flash during cancel navigation.
  const isWaitingForDriver = Boolean(
    !isCancellingRef.current &&
    !isDriverMode &&
    booking?.status &&
    typeof booking.status === 'string' &&
    [BookingStatus.REQUESTED, BookingStatus.SEARCHING].includes(booking.status as any)
  );

  useEffect(() => {
    const shouldShow = Boolean(!isDriverMode && isWaitingForDriver && effectivePickupLocation);

    if (!shouldShow) {
      if (nearbyDrivers.length > 0) setNearbyDrivers([]);
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
        const res = await getNearbyDrivers(effectivePickupLocation.latitude, effectivePickupLocation.longitude, 20);
        if (!mounted) return;
        setNearbyDrivers(Array.isArray(res) ? res : []);
      } catch {
        // Don't clear on error — keep showing existing markers
      } finally {
        nearbyFetchRef.current.inFlight = false;
      }
    };

    run();
    timer = setInterval(run, 10000); // Poll every 10s — fast enough for real-time feel

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [effectivePickupLocation?.latitude, effectivePickupLocation?.longitude, isDriverMode, isWaitingForDriver]);

  const navigateTargetLabel = useMemo(() => {
    if (bookingStatus && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(bookingStatus as any)) {
      return 'Drop';
    }
    return 'Pickup';
  }, [bookingStatus]);

  // Compute routeStart and routeTarget, store in refs for timer to use
  const routeStart = useMemo(() => {
    const base = isDriverMode ? (currentLocation ?? driverLocation) : driverLocation;
    if (!base) return null;
    if (!Number.isFinite(base.latitude) || !Number.isFinite(base.longitude)) return null;
    return { latitude: base.latitude, longitude: base.longitude };
  }, [currentLocation, driverLocation, isDriverMode]);

  const routeTarget = useMemo(() => {
    if (!effectivePickupLocation) return null;

    // ── Round-trip after STARTED: no route target (no polyline/ETA needed) ──
    const tripType = String((booking as any)?.tripType ?? '').toUpperCase();
    const isTripPhase = bookingStatus && ['STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(bookingStatus as any);
    if (tripType === 'ROUND_TRIP' && isTripPhase) {
      return null; // No route calculation for started round trips
    }

    const shouldGoToDrop = Boolean(
      bookingStatus && [BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(bookingStatus as any)
    );

    if (shouldGoToDrop && effectiveDropLocation) {
      return { latitude: effectiveDropLocation.latitude, longitude: effectiveDropLocation.longitude };
    }

    return { latitude: effectivePickupLocation.latitude, longitude: effectivePickupLocation.longitude };
  }, [bookingStatus, effectiveDropLocation, effectivePickupLocation, (booking as any)?.tripType]);

  // SYNC REFS DURING RENDER (not in useEffect!) — guarantees they're up-to-date
  // before ANY useEffect reads them. useEffect runs AFTER render and has 
  // unpredictable ordering, which caused the entire "map stuck on drop point" bug.
  routeStartRef.current = routeStart;
  routeTargetRef.current = routeTarget;
  bookingStatusRef.current = bookingStatus as string | null;
  routePolylineRef.current = typeof routePolyline === 'string' ? routePolyline : null;

  const distanceText = useMemo(() => {
    if (distance === null || !Number.isFinite(distance)) return '—';
    return `${Number(distance).toFixed(1)} km`;
  }, [distance]);

  const callOtherParty = async () => {
    const phone = normalizePhone(otherParty?.phoneNumber);
    if (!phone) {
      showAlert('Call not available', 'Phone number is not available.');
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
      showAlert('Call', 'Unable to place call from this device.');
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

  const canCustomerCancelAfterAccept = Boolean(
    !isDriverMode &&
    booking?.id &&
    booking?.status &&
    [BookingStatus.ACCEPTED, BookingStatus.DRIVER_ARRIVING, BookingStatus.ARRIVED].includes(booking.status as any)
  );

  const handleDriverStatusUpdate = async (nextStatus: BookingStatus) => {
    const bookingId = booking?.id;
    if (!bookingId) return;
    if (statusUpdating) return; // Prevent double-tap

    if (nextStatus === BookingStatus.COMPLETED) {
      showAlert('Complete trip?', 'Are you sure you want to complete this trip?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, complete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setStatusUpdating(true);
              try {
                await updateBookingStatusApi(bookingId, nextStatus);
                dispatch(updateBookingStatus({ id: bookingId, status: nextStatus }));
              } catch (e: any) {
                showAlert('Update status', e?.message || 'Failed to update booking status');
              } finally {
                setStatusUpdating(false);
              }
            })();
          },
        },
      ]);
      return;
    }
    setStatusUpdating(true);
    try {
      await updateBookingStatusApi(bookingId, nextStatus);
      dispatch(updateBookingStatus({ id: bookingId, status: nextStatus }));
    } catch (e: any) {
      showAlert('Update status', e?.message || 'Failed to update booking status');
    } finally {
      setStatusUpdating(false);
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
      showAlert('Thank you', 'Rating submitted successfully');
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
        showAlert('Submit rating', 'Rating already submitted');
      } else {
        showAlert('Submit rating', e?.message || 'Failed to submit rating');
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
      showAlert('Enter OTP', 'Please enter the OTP from the customer.');
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
      showAlert('Verify OTP', e?.message || 'Failed to verify OTP');
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

  // ── Customer + Cash: poll booking status every 15s while STARTED/IN_PROGRESS ──
  // This catches COMPLETED updates even if the socket event is missed
  useEffect(() => {
    if (isDriverMode) return;
    const status = booking?.status;
    if (status !== BookingStatus.STARTED && (status as any) !== 'IN_PROGRESS') return;
    if (!booking?.id) return;

    let active = true;
    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const raw = await getBookingDetails(String(booking.id));
        if (!active) return;
        const newStatus = String((raw as any)?.status ?? '');
        if (newStatus === 'COMPLETED') {
          dispatch(updateBookingStatus({ id: String(booking.id), status: 'COMPLETED' }));
        }
      } catch {
        // silently ignore
      }
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [booking?.id, booking?.status, dispatch, isDriverMode]);


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
      // ── FULL RESET of all route/camera tracking refs ──
      // This is critical: when the trip starts, the target changes from PICKUP → DROP.
      // Every single ref that cached the old pickup route must be wiped clean
      // so the system immediately fetches a fresh route to the DROP.
      lastRouteKeyRef.current = null;
      lastRouteTsRef.current = 0;
      lastRouteStartRef.current = null;
      lastRouteTargetRef.current = null;
      lastFitTargetKeyRef.current = null;
      lastFollowCameraTsRef.current = 0;
      hasRouteEtaRef.current = false;
      lastDispatchedEtaRef.current = null;
      lastDispatchedDistRef.current = null;

      // BUG 2 FIX: Mark "just started" — first 10s show full route, not 3km truncated
      justStartedRef.current = true;
      setShowFullRouteBtn(true);
      setTimeout(() => { justStartedRef.current = false; }, 10000);

      // Clear the old pickup route from Redux immediately
      dispatch(clearRoute());
    }
  }, [booking?.status, dispatch]);

  const statusInfo = useMemo(() => {
    if (!bookingStatus) return { text: 'Waiting for driver...', color: G.accent, bg: '#eff6ff', icon: 'clock-outline' as const };
    if (bookingStatus === 'SEARCHING') return { text: 'Searching for nearby drivers...', color: G.accent, bg: '#eff6ff', icon: 'radar' as const };
    if (bookingStatus === 'ACCEPTED') return { text: 'Driver accepted • On the way', color: '#f59e0b', bg: '#fffbeb', icon: 'car-side' as const };
    if (bookingStatus === 'DRIVER_ARRIVING') return { text: 'Driver arriving soon', color: '#f59e0b', bg: '#fffbeb', icon: 'car-side' as const };
    if (bookingStatus === 'ARRIVED') return { text: 'Driver arrived at pickup', color: '#10b981', bg: '#f0fdf4', icon: 'map-marker-check' as const };
    if (bookingStatus === 'STARTED' || bookingStatus === 'IN_PROGRESS') return { text: 'Trip in progress', color: G.accent, bg: '#eff6ff', icon: 'navigation-variant' as const };
    if (bookingStatus === 'COMPLETED') return { text: 'Trip completed', color: '#059669', bg: '#f0fdf4', icon: 'check-circle' as const };
    if (bookingStatus === 'CANCELLED') return { text: 'Booking cancelled', color: '#ef4444', bg: '#fef2f2', icon: 'close-circle' as const };
    return { text: `Status: ${bookingStatus}`, color: G.textSecondary, bg: '#f9fafb', icon: 'information' as const };
  }, [bookingStatus]);

  const statusText = statusInfo.text;

  const isCashPayment = (booking as any)?.paymentMethod === 'CASH';
  // Show the final fare card only after the trip is marked COMPLETED by the backend
  const showFinalFare = Boolean(
    booking?.status === BookingStatus.COMPLETED &&
    typeof booking?.totalAmount === 'number'
  );
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
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    const isPending = bookingStatus && ['REQUESTED', 'SEARCHING'].includes(bookingStatus);
    const delta = isPending ? 0.07 : 0.012;

    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [driverLocation, effectiveDropLocation, effectivePickupLocation, bookingStatus]);

  const mapEdgePadding = useMemo(
    () => ({
      top: 60,
      right: 50,
      bottom: 200, // Large bottom padding — Uber-style, keeps markers above the booking card
      left: 50,
    }),
    []
  );

  // ── Production-grade Uber/Ola-style map camera ──
  // Phase-based: different zoom behavior for each trip phase.
  // ACCEPTED → fit driver + pickup (they're usually close)
  // STARTED/IN_PROGRESS → FOLLOW the driver at close zoom (~1km), NOT the distant drop
  // COMPLETED → show summary view fitting driver + drop
  const cameraFitDoneForStatusRef = useRef<string | null>(null);
  const lastCameraDriverRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastCameraTimestampRef = useRef<number>(0);

  // BUG 1 FIX: Phase-based edge padding — trip phase gets extra top padding
  // so the drop pin clears the header (pin anchor is at bottom, icon body extends UP)
  const FIT_PADDING_PRETRIP = { top: 250, bottom: 350, left: 60, right: 60 };
  const FIT_PADDING_TRIP    = { top: 300, bottom: 280, left: 60, right: 60 };
  // Dynamic getter based on current booking status
  const getFitPadding = React.useCallback(() => {
    const status = bookingStatusRef.current;
    const isTripPhase = status && ['STARTED', 'IN_PROGRESS'].includes(status);
    return isTripPhase ? FIT_PADDING_TRIP : FIT_PADDING_PRETRIP;
  }, []);

  // Helper: sample key polyline waypoints for fitToCoordinates
  // (fitting to all 500+ polyline points is wasteful; 10 evenly-spaced samples is enough)
  const getPolylineSamples = React.useCallback(() => {
    const route = decodedRoute;
    if (!route || route.length < 2) return [];
    if (route.length <= 10) return [...route];
    const step = Math.floor(route.length / 10);
    const samples: { latitude: number; longitude: number }[] = [];
    for (let i = 0; i < route.length; i += step) {
      samples.push(route[i]);
    }
    samples.push(route[route.length - 1]); // Always include last point
    return samples;
  }, [decodedRoute]);

  const fitMapToRoute = React.useCallback((
    overrideDriver?: { latitude: number; longitude: number } | null,
    overrideTarget?: { latitude: number; longitude: number } | null,
  ) => {
    const status = bookingStatusRef.current;
    const isActive = Boolean(status && ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status));
    if (!isActive) return;

    // BUG 1 FIX: Debounce competing fit calls — cancel any pending fit, only the
    // latest call within 500ms executes (prevents onMapReady + status-change racing)
    const now = Date.now();
    if (pendingFitTimerRef.current) {
      clearTimeout(pendingFitTimerRef.current);
      pendingFitTimerRef.current = null;
    }
    // If another fit call happened < 500ms ago, schedule this one with a 500ms delay
    // so only the LAST call with the most complete point set wins
    if (now - lastFitCallTsRef.current < 500) {
      pendingFitTimerRef.current = setTimeout(() => {
        pendingFitTimerRef.current = null;
        fitMapToRouteRef.current(overrideDriver, overrideTarget);
      }, 500);
      return;
    }
    lastFitCallTsRef.current = now;

    const FIT_PADDING = getFitPadding();

    const driverFallback = isDriverModeRef.current ? (currentLocation ?? driverLocation) : (driverLocation ?? currentLocation);
    let driverPos = overrideDriver ?? routeStartRef.current ?? driverFallback ?? null;
    const targetPos = overrideTarget ?? routeTargetRef.current ?? null;

    // Safety: if driver coords are > 500 km from target, it's a stale/emulator location — ignore it
    if (driverPos && targetPos) {
      const dLat = Math.abs(driverPos.latitude - targetPos.latitude);
      const dLng = Math.abs(driverPos.longitude - targetPos.longitude);
      const roughKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      if (roughKm > 500) {
        driverPos = null; // treat as unknown until real GPS arrives
      }
    }

    // BUG 1 FIX: Guard — if status just changed and either endpoint is missing,
    // retry up to 5 times every 300ms until both are available
    if (!driverPos || !targetPos) {
      const retryCountKey = `__fitRetry_${status}`;
      const retryCount = (fitMapToRouteRef as any)[retryCountKey] ?? 0;
      if (retryCount < 5) {
        (fitMapToRouteRef as any)[retryCountKey] = retryCount + 1;
        console.log('[MAP-FIT] Missing endpoint, retry', retryCount + 1, '/5 —',
          'driver:', !!driverPos, 'target:', !!targetPos, 'status:', status);
        setTimeout(() => fitMapToRouteRef.current(overrideDriver, overrideTarget), 300);
        return;
      }
      // Exhausted retries — reset counter and fall through with what we have
      (fitMapToRouteRef as any)[retryCountKey] = 0;
    }

    // Reset retry counter on successful call
    if (driverPos && targetPos) {
      (fitMapToRouteRef as any)[`__fitRetry_${status}`] = 0;
    }

    console.log('[MAP-FIT] fitToCoordinates —', {
      status,
      driverPos: driverPos ? `${driverPos.latitude.toFixed(5)},${driverPos.longitude.toFixed(5)}` : null,
      targetPos: targetPos ? `${targetPos.latitude.toFixed(5)},${targetPos.longitude.toFixed(5)}` : null,
      remainingRouteLen: remainingRoute?.length ?? 0,
      decodedRouteLen: decodedRoute?.length ?? 0,
      justStarted: justStartedRef.current,
      edgePadding: FIT_PADDING,
      timestamp: now,
    });

    // Round trips in progress: no target — fit driver + pickup
    if (!targetPos) {
      if (!driverPos) return;
      const pickup = effectivePickupRef.current;
      if (pickup) {
        mapRef.current?.fitToCoordinates(
          [driverPos, pickup],
          { edgePadding: FIT_PADDING, animated: true },
        );
      }
      return;
    }

    if (!driverPos) {
      mapRef.current?.animateToRegion({
        latitude: targetPos.latitude,
        longitude: targetPos.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }, 600);
      return;
    }

    const isTripPhase = status === 'STARTED' || status === 'IN_PROGRESS';

    // ── During trip phase ──
    if (isTripPhase) {
      // BUG 2 FIX: For the first 10s after STARTED, or if remainingRoute is
      // not yet populated (stale/empty), show the FULL route instead of 3km truncated
      const hasValidRemaining = remainingRoute && remainingRoute.length >= 2;
      const remainingIsStale = hasValidRemaining && remainingRoute[0] &&
        distanceApproxMeters(driverPos, remainingRoute[0]) > 500; // >500m away = stale

      if (justStartedRef.current || !hasValidRemaining || remainingIsStale) {
        // First fit after trip start — show EVERYTHING (driver + drop + full polyline)
        const polySamples = getPolylineSamples();
        const fallbackRoute = (decodedRoute && decodedRoute.length >= 2) ? decodedRoute : [];
        const routePoints = polySamples.length > 0 ? polySamples : fallbackRoute;
        console.log('[MAP-FIT] Full route view (justStarted or stale remaining) —',
          'justStarted:', justStartedRef.current, 'hasRemaining:', hasValidRemaining,
          'remainingStale:', remainingIsStale, 'routePoints:', routePoints.length);
        mapRef.current?.fitToCoordinates(
          [driverPos, targetPos, ...routePoints],
          { edgePadding: FIT_PADDING, animated: true },
        );
        return;
      }

      // Normal 3km lookahead for subsequent updates
      const lookaheadKm = 3;
      let accDist = 0;
      const aheadPoints: { latitude: number; longitude: number }[] = [driverPos];
      for (let i = 1; i < remainingRoute.length; i++) {
        const prev = remainingRoute[i - 1];
        const curr = remainingRoute[i];
        const segKm = distanceApproxMeters(prev, curr) / 1000;
        accDist += segKm;
        aheadPoints.push(curr);
        if (accDist >= lookaheadKm) break;
      }
      // Always include target if it's close enough (< 4km)
      const distToTarget = distanceApproxMeters(driverPos, targetPos) / 1000;
      if (distToTarget <= lookaheadKm + 1) {
        aheadPoints.push(targetPos);
        setShowFullRouteBtn(false); // Close enough to see both — hide button
      }
      mapRef.current?.fitToCoordinates(
        aheadPoints,
        { edgePadding: FIT_PADDING, animated: true },
      );
      return;
    }

    // ── Pre-trip or no remaining route: fit full route ──
    const polySamples = getPolylineSamples();
    const pointsToFit: { latitude: number; longitude: number }[] = [driverPos, targetPos, ...polySamples];
    mapRef.current?.fitToCoordinates(
      pointsToFit,
      { edgePadding: FIT_PADDING, animated: true },
    );
  }, [driverLocation, getPolylineSamples, remainingRoute, decodedRoute, getFitPadding]);
  // Store fitMapToRoute in a ref so effects don't depend on it
  // (fitMapToRoute changes every time driverLocation updates, which was killing the timeouts!)
  const fitMapToRouteRef = useRef(fitMapToRoute);
  fitMapToRouteRef.current = fitMapToRoute;

  // Keep live coordinate values in refs (sync during render, not useEffect)
  const driverLocationRef = useRef(driverLocation);
  driverLocationRef.current = driverLocation;
  const currentLocationRef = useRef(currentLocation);
  currentLocationRef.current = currentLocation;
  const effectiveDropRef = useRef(effectiveDropLocation);
  effectiveDropRef.current = effectiveDropLocation;
  const effectivePickupRef = useRef(effectivePickupLocation);
  effectivePickupRef.current = effectivePickupLocation;

  // Helper: compute the two map endpoints from current state (reads from refs = always fresh)
  const getMapEndpoints = React.useCallback(() => {
    const status = bookingStatusRef.current;
    const isTripPhase = status && ['STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);

    const drop = effectiveDropRef.current;
    const pickup = effectivePickupRef.current;
    // In driver mode, prefer GPS (currentLocation) over socket (driverLocation)
    // In customer mode, prefer socket (driverLocation) since that's the remote driver
    const driver = isDriverModeRef.current
      ? (currentLocationRef.current ?? driverLocationRef.current)
      : (driverLocationRef.current ?? currentLocationRef.current);

    const target = (isTripPhase && drop)
      ? { latitude: drop.latitude, longitude: drop.longitude }
      : pickup
        ? { latitude: pickup.latitude, longitude: pickup.longitude }
        : null;

    const driverPos = driver
      ? { latitude: driver.latitude, longitude: driver.longitude }
      : null;

    return { driverPos, target };
  }, []);

  // 1) Initial fit when status changes (ACCEPTED, STARTED, etc.)
  //    ONLY depends on bookingStatus — nothing else. This prevents the effect from
  //    re-running due to driverLocation changes, which was clearing our scheduled timeouts.
  useEffect(() => {
    const status = bookingStatus;
    if (!status) return;
    const isActive = ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);
    if (!isActive) return;

    // Only re-fit when status actually changes
    if (cameraFitDoneForStatusRef.current === status) return;
    cameraFitDoneForStatusRef.current = status;
    lastCameraDriverRef.current = null;
    lastCameraTimestampRef.current = 0;

    // GENERAL FIX: On STARTED, bypass throttle so first fit is immediate
    if (status === 'STARTED') {
      lastFitCallTsRef.current = 0;
    }

    console.log('[MAP-FIT] Status changed to:', status);

    // Step 1: Immediately fit map to show both driver + target
    // 600ms delay ensures route target refs have updated after status-change resets
    const t1 = setTimeout(() => {
      const { driverPos, target } = getMapEndpoints();
      console.log('[MAP-FIT] Step1 fit — driver:', driverPos, 'target:', target, 'status:', status);
      setIsMapPanned(false);
      if (pannedTimerRef.current) clearTimeout(pannedTimerRef.current);
      lastFitCallTsRef.current = 0; // bypass debounce for status-change fit
      fitMapToRouteRef.current(driverPos, target);
    }, 600);

    // Step 2: Fetch fresh route for new target
    const t2 = setTimeout(() => {
      const { driverPos, target } = getMapEndpoints();
      console.log('[MAP-FIT] Step2 route fetch — driver:', driverPos, 'target:', target);
      if (!driverPos || !target) return;

      calculateRoute(driverPos, target)
        .then((res) => {
          const poly = String((res as any)?.polyline ?? '');
          if (!poly) return;
          const decoded = decodePolyline(poly);
          dispatch(setRoute({ polyline: poly, decodedRoute: decoded }));

          const durationSeconds = typeof (res as any)?.duration === 'number' ? Number((res as any).duration) : NaN;
          const distanceMeters = typeof (res as any)?.distance === 'number' ? Number((res as any).distance) : NaN;
          if (Number.isFinite(durationSeconds) && Number.isFinite(distanceMeters)) {
            const newEta = Math.max(1, Math.round(durationSeconds / 60));
            const newDist = Math.round((distanceMeters / 1000) * 10) / 10;
            lastDispatchedEtaRef.current = newEta;
            lastDispatchedDistRef.current = newDist;
            lastEtaDispatchTsRef.current = Date.now();
            dispatch(updateETA({ eta: newEta, distance: newDist }));
            console.log('[MAP-FIT] Step2 ETA:', newEta, 'min, dist:', newDist, 'km');
          }

          // Step 3: Refit with polyline in view
          setTimeout(() => {
            const pts = getMapEndpoints();
            lastFitCallTsRef.current = 0; // bypass debounce
            fitMapToRouteRef.current(pts.driverPos, pts.target);
          }, 500);
        })
        .catch((e) => console.warn('[MAP-FIT] Route fetch failed:', e));
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStatus]);

  // 2) Re-fit when decoded route (polyline) arrives or changes
  useEffect(() => {
    if (!decodedRoute || decodedRoute.length < 2) return;
    const status = bookingStatusRef.current;
    const isActive = Boolean(status && ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status));
    if (!isActive) return;

    // Fit to show the full polyline
    const t = setTimeout(() => fitMapToRouteRef.current(), 300);
    return () => clearTimeout(t);
  // Only on polyline change — use routePolyline string as dependency (stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePolyline]);

  // 2b) First-driver-location trigger — fit map when driver location first becomes available
  const hadDriverLocRef = useRef(false);
  useEffect(() => {
    if (!driverLocation) {
      hadDriverLocRef.current = false;
      return;
    }
    if (hadDriverLocRef.current) return; // Only fire once per session
    hadDriverLocRef.current = true;

    const status = bookingStatusRef.current;
    const isActive = status && ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);
    if (!isActive) return;

    // Driver location just appeared — fit map to show driver + target + polyline
    setTimeout(() => {
      fitMapToRouteRef.current();
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation]);

  // 3) Continuous camera following — reacts to location changes (like Uber)
  // Uses driverLocation as dependency so camera follows in real-time, not on a timer
  useEffect(() => {
    const status = bookingStatusRef.current;
    if (!status) return;
    const isActive = ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);
    if (!isActive) return;
    if (isMapPannedRef.current) return;

    const driverPos = routeStartRef.current;
    if (!driverPos) return;

    const now = Date.now();
    const prev = lastCameraDriverRef.current;
    const movedMeters = prev ? distanceApproxMeters(prev, driverPos) : Number.POSITIVE_INFINITY;

    // Recenter when driver moves >10m or every 3s — smooth continuous tracking
    if (movedMeters >= 10 || now - lastCameraTimestampRef.current >= 3000) {
      lastCameraTimestampRef.current = now;
      lastCameraDriverRef.current = { latitude: driverPos.latitude, longitude: driverPos.longitude };
      fitMapToRouteRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, currentLocation, bookingStatus]);

  // ── Route calculation — timer-based (checks every 15s during trip, 20s before) ──
  // SINGLE source of truth: Google Route API provides ETA and distance
  // No approx fallback — eliminates flip-flopping between two different values
  const lastDispatchedEtaRef = useRef<number | null>(null);
  const lastDispatchedDistRef = useRef<number | null>(null);

  useEffect(() => {
    const status = bookingStatusRef.current;
    if (!status || status === 'CANCELLED') {
      dispatch(clearRoute());
      lastRouteKeyRef.current = null;
      lastFitTargetKeyRef.current = null;
      lastDispatchedEtaRef.current = null;
      lastDispatchedDistRef.current = null;
      return;
    }

    const tick = () => {
      const start = routeStartRef.current;
      const target = routeTargetRef.current;
      const curStatus = bookingStatusRef.current;

      if (!start || !target || !curStatus || curStatus === 'CANCELLED') return;

      const now = Date.now();

      // Check if route API call is needed
      const prevStart = lastRouteStartRef.current;
      const prevTarget = lastRouteTargetRef.current;
      const startMovedMeters = prevStart ? distanceApproxMeters(prevStart, start) : Number.POSITIVE_INFINITY;
      const targetKey = `${target.latitude.toFixed(5)},${target.longitude.toFixed(5)}`;
      const prevTargetKey = prevTarget ? `${prevTarget.latitude.toFixed(5)},${prevTarget.longitude.toFixed(5)}` : null;
      const targetChanged = prevTargetKey !== targetKey;

      const tripStarted = ['STARTED', 'IN_PROGRESS'].includes(curStatus);
      const minIntervalMs = tripStarted ? 15000 : 20000;
      const shouldSkip =
        !targetChanged &&
        now - lastRouteTsRef.current < minIntervalMs &&
        Number.isFinite(startMovedMeters) &&
        startMovedMeters < 50;

      if (shouldSkip) return;

      lastRouteKeyRef.current = `${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}->${targetKey}`;
      lastRouteTsRef.current = now;
      lastRouteStartRef.current = start;
      lastRouteTargetRef.current = target;

      calculateRoute(start, target)
        .then((res) => {
          const poly = String((res as any)?.polyline ?? '');
          if (!poly) return;
          if (routePolylineRef.current && poly === routePolylineRef.current) return;
          const decoded = decodePolyline(poly);
          dispatch(setRoute({ polyline: poly, decodedRoute: decoded }));

          const durationSeconds = typeof (res as any)?.duration === 'number' ? Number((res as any).duration) : NaN;
          const distanceMeters = typeof (res as any)?.distance === 'number' ? Number((res as any).distance) : NaN;
          if (Number.isFinite(durationSeconds) && Number.isFinite(distanceMeters)) {
            const newEta = Math.max(1, Math.round(durationSeconds / 60));
            const newDist = Math.round((distanceMeters / 1000) * 10) / 10; // 1 decimal
            const prevEta = lastDispatchedEtaRef.current;
            const prevDist = lastDispatchedDistRef.current;

            // Skip if values haven't actually changed
            if (newEta === prevEta && newDist === prevDist) return;

            // Monotonic guard: during active trip, ETA should only decrease
            // Allow increase of max 2 min (for re-routing). Prevents wild jumps
            const isTripActive = ['STARTED', 'IN_PROGRESS'].includes(bookingStatusRef.current ?? '');
            const shouldUpdate = !isTripActive || prevEta === null || newEta <= prevEta + 2;

            if (shouldUpdate) {
              lastDispatchedEtaRef.current = newEta;
              lastDispatchedDistRef.current = newDist;
              lastEtaDispatchTsRef.current = Date.now();
              dispatch(updateETA({ eta: newEta, distance: newDist }));
            }
          }
        })
        .catch(() => {});
    };

    tick(); // Initial
    const timer = setInterval(tick, 15000); // Poll every 15s — stable numbers
    return () => clearInterval(timer);
  }, [bookingStatus, dispatch]); // Only re-setup when booking status transitions

  // ── Immediately refetch route when driverLocation first becomes available ──
  // The initial tick() above runs before driverLocation arrives (it's null on mount),
  // so no route is fetched. This effect watches for the first valid driverLocation
  // and resets the cache key so the next tick fires immediately.
  const prevDriverLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    if (!driverLocation) return;
    const prev = prevDriverLocationRef.current;
    prevDriverLocationRef.current = driverLocation;

    // Only act on the FIRST location update (prev was null)
    if (prev !== null) return;

    // Reset cached keys so tick() sees a "new" start and fetches immediately
    lastRouteKeyRef.current = null;
    lastRouteTsRef.current = 0;
    lastRouteStartRef.current = null;

    // Directly trigger an immediate route fetch with the new driverLocation as start
    const target = routeTargetRef.current;
    if (!target) return;

    const start = { latitude: driverLocation.latitude, longitude: driverLocation.longitude };
    lastRouteKeyRef.current = `${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}->${target.latitude.toFixed(5)},${target.longitude.toFixed(5)}`;
    lastRouteTsRef.current = Date.now();
    lastRouteStartRef.current = start;
    lastRouteTargetRef.current = target;

    calculateRoute(start, target)
      .then((res) => {
        const poly = String((res as any)?.polyline ?? '');
        if (!poly) return;
        const decoded = decodePolyline(poly);
        dispatch(setRoute({ polyline: poly, decodedRoute: decoded }));
        const durationSeconds = typeof (res as any)?.duration === 'number' ? Number((res as any).duration) : NaN;
        const distanceMeters = typeof (res as any)?.distance === 'number' ? Number((res as any).distance) : NaN;
        if (Number.isFinite(durationSeconds) && Number.isFinite(distanceMeters)) {
          const newEta = Math.max(1, Math.round(durationSeconds / 60));
          const newDist = Math.round((distanceMeters / 1000) * 10) / 10;
          lastDispatchedEtaRef.current = newEta;
          lastDispatchedDistRef.current = newDist;
          dispatch(updateETA({ eta: newEta, distance: newDist }));
        }
      })
      .catch(() => {});
  }, [driverLocation, dispatch]);



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
          onPanDrag={handleMapPan}
          onMapReady={() => {
            // Center map based on current booking phase
            setTimeout(() => {
              const status = bookingStatusRef.current;
              const pickup = effectivePickupRef.current;
              const isActive = status && ['ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status);

              if (isActive) {
                // Active trip — fit to driver + target + polyline
                const { driverPos, target } = getMapEndpoints();
                if (driverPos && target) {
                  const polySamples = getPolylineSamples();
                  mapRef.current?.fitToCoordinates([driverPos, target, ...polySamples], {
                    edgePadding: getFitPadding(),
                    animated: true,
                  });
                } else if (target) {
                  mapRef.current?.animateToRegion({
                    latitude: target.latitude,
                    longitude: target.longitude,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }, 300);
                }
              } else if (pickup) {
                // SEARCHING / REQUESTED — center on pickup, zoomed out to see nearby drivers
                mapRef.current?.animateToRegion({
                  latitude: pickup.latitude,
                  longitude: pickup.longitude,
                  latitudeDelta: 0.07,
                  longitudeDelta: 0.07,
                }, 300);
              }
            }, 500);
          }}
        >
          {/* Polyline: ONLY after driver accepts (ACCEPTED+), never during SEARCHING */}
          {(() => {
            const isActive = bookingStatus && ['ACCEPTED','DRIVER_ARRIVING','ARRIVED','STARTED','IN_PROGRESS','COMPLETED'].includes(bookingStatus as string);
            if (!isActive || isRoundTripStarted) return null;
            const isTrip = ['STARTED', 'IN_PROGRESS'].includes(bookingStatus as string);
            const coords = (isTrip && remainingRoute && remainingRoute.length > 1)
              ? remainingRoute
              : (decodedRoute && decodedRoute.length > 1 ? decodedRoute : null);
            return coords ? <RoutePolyline coordinates={coords} strokeWidth={5} strokeColor="#4285F4" animated /> : null;
          })()}
          {stablePickupCoord ? (
            <Marker
              coordinate={stablePickupCoord}
              tracksViewChanges={false}
              zIndex={5}
              title="Pickup"
              pinColor="green"
              anchor={{ x: 0.5, y: 1 }}
            />
          ) : null}
          {stableDropCoord && !isRoundTripStarted ? (
            <Marker
              coordinate={stableDropCoord}
              tracksViewChanges={false}
              zIndex={5}
              title="Drop"
              pinColor="red"
              anchor={{ x: 0.5, y: 1 }}
            />
          ) : null}
          {!isDriverMode && isWaitingForDriver
            ? nearbyDrivers.map((d) => {
              const lat = Number((d as any)?.location?.latitude);
              const lng = Number((d as any)?.location?.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return (
                <Marker
                  key={String((d as any)?.id)}
                  coordinate={{ latitude: lat, longitude: lng }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  flat
                  zIndex={3}
                  image={CAR_IMAGE}
                  style={{ width: 22, height: 22 }}
                />
              );
            })
            : null}
          {/* Assigned driver marker: ONLY after ACCEPTED, not during SEARCHING */}
          {driverLocation && bookingStatus && ['ACCEPTED','DRIVER_ARRIVING','ARRIVED','STARTED','IN_PROGRESS','COMPLETED'].includes(bookingStatus as string) ? (
            <DriverMarker
              latitude={driverLocation.latitude}
              longitude={driverLocation.longitude}
              heading={(driverLocation as any)?.heading}
              routeCoordinates={decodedRoute}
              onRemainingRoute={setRemainingRoute}
            />
          ) : null}
        </MapView>

        {/* Single unified map action button — Recenter (when panned) or Full Route (during trip) */}
        {(() => {
          const isTripActive = bookingStatus && ['STARTED', 'IN_PROGRESS'].includes(bookingStatus);
          // Priority 1: Recenter when user has panned the map
          if (isMapPanned) {
            return (
              <TouchableOpacity
                style={[styles.recenterBtn, { bottom: mapEdgePadding.bottom + 20 }]}
                onPress={() => {
                  if (pannedTimerRef.current) clearTimeout(pannedTimerRef.current);
                  setIsMapPanned(false);
                  lastFitCallTsRef.current = 0;
                  fitMapToRoute();
                }}
              >
                <Icon name="crosshairs-gps" size={24} color="#C9A84C" />
              </TouchableOpacity>
            );
          }
          // Priority 2: Show full route during active trip (3km lookahead hides drop)
          if (showFullRouteBtn && isTripActive) {
            return (
              <TouchableOpacity
                style={[styles.recenterBtn, { bottom: mapEdgePadding.bottom + 20 }]}
                onPress={() => {
                  const { driverPos, target } = getMapEndpoints();
                  if (driverPos && target) {
                    const polySamples = getPolylineSamples();
                    console.log('[MAP-FIT] Show full route pressed — fitting all points');
                    lastFitCallTsRef.current = 0;
                    mapRef.current?.fitToCoordinates(
                      [driverPos, target, ...polySamples],
                      { edgePadding: getFitPadding(), animated: true },
                    );
                  }
                  setShowFullRouteBtn(false);
                  // Auto-re-show after 15s so the user can tap again later
                  setTimeout(() => {
                    if (['STARTED', 'IN_PROGRESS'].includes(bookingStatusRef.current ?? '')) {
                      setShowFullRouteBtn(true);
                    }
                  }, 15000);
                }}
              >
                <Icon name="map-marker-path" size={22} color="#C9A84C" />
              </TouchableOpacity>
            );
          }
          return null;
        })()}
      </View>

      {/* Status transition overlay — shows spinner during Arrived/Start Trip/Complete */}
      {statusUpdating ? (
        <View style={styles.statusOverlay}>
          <ActivityIndicator size="large" color="#C9A84C" />
          <Text style={styles.statusOverlayText}>Updating...</Text>
        </View>
      ) : null}

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
                (booking as any)?.driver?.driverProfile?.currentVehicle
                  ? `${(booking as any).driver.driverProfile.currentVehicle.make ?? ''} ${(booking as any).driver.driverProfile.currentVehicle.model ?? ''}`.trim() || null
                  : null
              }
              licensePlate={(booking as any)?.driver?.driverProfile?.currentVehicle?.registrationNumber ?? null}
              etaMinutes={eta}
              status={String(booking.status)}
              phoneNumber={normalizePhone(
                (booking as any)?.driver?.phoneNumber ??
                (booking as any)?.driver?.phone ??
                (booking as any)?.driver?.mobileNumber ??
                (booking as any)?.driver?.mobile ??
                (booking as any)?.driver?.contactNumber
              )}
              maskedPhone={formatMaskedPhone(normalizePhone(
                (booking as any)?.driver?.phoneNumber ??
                (booking as any)?.driver?.phone ??
                (booking as any)?.driver?.mobileNumber ??
                (booking as any)?.driver?.mobile ??
                (booking as any)?.driver?.contactNumber
              ))}
              shareUrl={shareUrl}
              onCall={callOtherParty}
              onChat={() => {
                if (booking?.id) {
                  setUnreadChatCount(0);
                  navigation.navigate('Chat', { bookingId: booking.id });
                }
              }}
              onDriverPress={!isDriverMode ? () => setShowDriverStatsModal(true) : undefined}
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
                  const dName = (booking as any)?.driver?.firstName
                    ? `${(booking as any).driver.firstName} ${(booking as any).driver.lastName || ''}`.trim()
                    : null;
                  const pickAddr = (booking as any)?.pickupAddress || '';
                  const dAddr = (booking as any)?.dropAddress || '';

                  let msg = `🚗 Track my Drively ride live!\n`;
                  if (dName) msg += `\nDriver: ${dName}`;
                  if (pickAddr) msg += `\nFrom: ${pickAddr}`;
                  if (dAddr) msg += `\nTo: ${dAddr}`;
                  msg += `\n\n${url}`;

                  await Share.share({ message: msg });
                } catch (e: any) {
                  if (e?.message !== 'User did not share') {
                    showAlert('Share', 'Failed to create share link');
                  }
                } finally {
                  setIsSharing(false);
                }
              }}
            />

            {/* Favorite driver button */}
            {(booking as any)?.driver?.id && !isDriverMode ? (
              <TouchableOpacity
                style={[styles.favDriverBtn, isFavDriver && { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)' }]}
                onPress={async () => {
                  const driverId = String((booking as any).driver.id);
                  if (isFavDriver) {
                    // Remove from favorites
                    try {
                      await removeFavoriteDriver(driverId);
                      setIsFavDriver(false);
                      showAlert('Removed', 'Driver removed from your favorites.');
                    } catch (e: any) {
                      showAlert('Error', e?.message || 'Failed to remove favorite driver');
                    }
                  } else {
                    // Add to favorites
                    try {
                      await addFavoriteDriver(driverId);
                      setIsFavDriver(true);
                      showAlert('Favorite Driver ⭐', 'Driver added to your favorites! They will get priority notification on your future bookings.');
                    } catch (e: any) {
                      if (e?.message?.includes('already')) {
                        setIsFavDriver(true);
                        showAlert('Favorite Driver', 'This driver is already in your favorites!');
                      } else {
                        showAlert('Error', e?.message || 'Failed to add favorite driver');
                      }
                    }
                  }
                }}
              >
                <Icon name={isFavDriver ? 'star' : 'star-outline'} size={16} color={isFavDriver ? '#10b981' : '#C9A84C'} />
                <Text style={[styles.favDriverText, isFavDriver && { color: '#10b981' }]}>
                  {isFavDriver ? 'In Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Cancel ride button for customer after driver accepted */}
            {canCustomerCancelAfterAccept ? (
              <TouchableOpacity
                style={styles.customerCancelBtn}
                onPress={() => {
                  if (!booking?.id) return;
                  showAlert('Cancel ride?', 'Are you sure you want to cancel this ride? Cancellation fees may apply if the driver has already started traveling.', [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Yes, cancel',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          isCancellingRef.current = true;
                          await cancelBooking(booking.id, 'Cancelled by customer', 'CUSTOMER');
                          dispatch(updateBookingStatus({ id: booking.id, status: 'CANCELLED' }));
                          dispatch(clearCurrentBooking());
                          navigation.navigate('Tabs');
                        } catch (e: any) {
                          isCancellingRef.current = false;
                          showAlert('Cancel ride', e?.message || 'Failed to cancel ride');
                        }
                      },
                    },
                  ]);
                }}
              >
                <Icon name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.customerCancelText}>Cancel Ride</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isWaitingForDriver ? (
          <SearchingForDriverCard
            pickupAddress={(booking as any)?.pickupAddress}
            dropAddress={(booking as any)?.dropAddress}
            fare={typeof booking?.totalAmount === 'number' ? booking.totalAmount : undefined}
            vehicleType={(booking as any)?.vehicleType}
            createdAt={(booking as any)?.createdAt}
            scheduledTime={(booking as any)?.scheduledTime}
            onCancel={canCustomerCancelSearching ? () => {
              if (!booking?.id) return;
              showAlert('Cancel booking?', 'Do you want to cancel this booking request?', [
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
                      showAlert('Cancel booking', e?.message || 'Failed to cancel booking');
                    }
                  },
                },
              ]);
            } : undefined}
          />
        ) : null}

        {/* ── Driver Stats Modal ── */}
        <Modal
          visible={showDriverStatsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDriverStatsModal(false)}
        >
          <View style={styles.otpModalOverlay}>
            <View style={[styles.otpModalCard, { maxHeight: '70%' }]}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
                onPress={() => setShowDriverStatsModal(false)}
              >
                <Icon name="close" size={22} color="#8A8A8A" />
              </TouchableOpacity>

              <Text style={[styles.otpModalTitle, { marginBottom: 16 }]}>Driver Profile</Text>

              {/* Photo + Name + Rating */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                {(booking as any)?.driver?.profileImage ? (
                  <Image
                    source={{ uri: (booking as any).driver.profileImage }}
                    style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 8, borderWidth: 2, borderColor: '#C9A84C' }}
                  />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2A2A3E', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Icon name="account" size={36} color="#8A8A8A" />
                  </View>
                )}
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                  {`${(booking as any)?.driver?.firstName ?? ''} ${(booking as any)?.driver?.lastName ?? ''}`.trim() || 'Driver'}
                </Text>
                {(() => {
                  const r = parseFloat(String((booking as any)?.driver?.rating ?? (booking as any)?.driver?.avgRating ?? 0));
                  return r > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Icon name="star" size={16} color="#f59e0b" />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#f59e0b' }}>{r.toFixed(1)}</Text>
                    </View>
                  ) : null;
                })()}
              </View>

              {/* Stats Grid */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, paddingVertical: 12, backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>
                    {(booking as any)?.driver?.driverProfile?.totalTrips ?? 0}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginTop: 2 }}>Trips</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>
                    {(() => {
                      const r = parseFloat(String((booking as any)?.driver?.rating ?? 0));
                      return r > 0 ? r.toFixed(1) : '—';
                    })()}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginTop: 2 }}>Rating</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>
                    {(() => {
                      const created = (booking as any)?.driver?.createdAt ?? (booking as any)?.driver?.driverProfile?.createdAt;
                      if (!created) return '—';
                      const y = new Date(created).getFullYear();
                      return isNaN(y) ? '—' : String(y);
                    })()}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginTop: 2 }}>Since</Text>
                </View>
              </View>

              {/* Quiz-Earned Skill Badges — top 3 earned by driver */}
              {(() => {
                const earnedBadges = (booking as any)?.driver?.driverBadges;
                const hasEarned = Array.isArray(earnedBadges) && earnedBadges.length > 0;
                return (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#CCCCCC', marginBottom: 8 }}>
                      🏅 Earned Badges
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {hasEarned ? (
                        earnedBadges.slice(0, 3).map((eb: any, i: number) => {
                          const b = eb?.badge;
                          if (!b) return null;
                          const badgeColor = b.color || '#C9A84C';
                          return (
                            <View
                              key={i}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 6,
                                backgroundColor: badgeColor + '18',
                                borderWidth: 1, borderColor: badgeColor + '55',
                                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
                              }}
                            >
                              <Icon name={(b.icon || 'shield-star') as any} size={15} color={badgeColor} />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: badgeColor }}>{b.title}</Text>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={{ fontSize: 12, color: '#666' }}>No badges earned yet</Text>
                      )}
                      {/* Always show Verified badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                        <Icon name="check-decagram" size={14} color="#22c55e" />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#22c55e' }}>Verified</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

            </View>
          </View>
        </Modal>

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
            {/* Name and trip info — full width */}
            <Text style={styles.contactTitle} numberOfLines={1}>{otherParty.name || 'Customer'}</Text>
            <Text style={styles.tripMetaStrong} numberOfLines={1}>
              {tripTypeHoursLabel}
            </Text>
            <Text style={styles.contactSubTitle} numberOfLines={1}>
              {isRoundTripStarted
                ? `Elapsed: ${roundTripElapsed ?? '—'}${roundTripCountdown ? `  •  Remaining: ${roundTripCountdown}` : ''}`
                : `${etaTargetLabel}: ${etaText}  •  Distance: ${distanceText}`}
            </Text>

            {/* Actions row — below the info */}
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
        ) : null}



        {canDriverCancelPreStart ? (
          <TouchableOpacity
            style={styles.driverCancelButton}
            onPress={() => {
              if (!booking?.id) return;
              showAlert('Cancel ride?', 'Do you want to cancel this ride?', [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Yes, cancel',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      isCancellingRef.current = true; // Prevent 'searching' flash
                      const bId = booking.id;
                      await cancelBooking(bId, 'Cancelled by driver', 'DRIVER');
                      // Leave the booking socket room so we don't get stale events
                      try { socketService.emit('booking:leave', bId); } catch {}
                      dispatch(clearCurrentBooking());
                      dispatch(clearLocations());
                      dispatch(clearRoute());
                      dispatch(setDriverLocation(null as any));
                      isCancellingRef.current = false;
                      navigation.navigate('Tabs');
                    } catch (e: any) {
                      isCancellingRef.current = false;
                      showAlert('Cancel ride', e?.message || 'Failed to cancel ride');
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
              showAlert('Cancel booking?', 'Do you want to cancel this booking request?', [
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
                      showAlert('Cancel booking', e?.message || 'Failed to cancel booking');
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
                      showAlert('Payment', 'Already paid!');
                      return;
                    }
                    // Check if driver hasn't set up their UPI ID
                    if ((order as any).driverHasNoUpi || !order.upiQrLink) {
                      showAlert(
                        'UPI Not Set Up',
                        'The driver has not configured their UPI ID yet. Please collect cash payment instead.',
                      );
                      return;
                    }
                    setQrPayUrl(order.upiQrLink);
                    setQrOrderId(order.orderId ?? null);
                    setQrDriverUpiId((order as any).driverUpiId ?? null);
                    setShowQrModal(true);
                  } catch (e: any) {
                    showAlert('QR Code', e?.message || 'Could not generate QR code');
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

            {/* DRIVER: Collect Cash button */}
            {isDriverMode && !paymentDone && (booking as any)?.paymentStatus !== 'PAID' ? (
              <TouchableOpacity
                style={[styles.finalFareDone, { backgroundColor: G.accent, marginBottom: 12 }]}
                onPress={() => {
                  if (!booking?.id) return;
                  const amount = Number(booking?.totalAmount || 0).toFixed(0);
                  showAlert(
                    'Collect Cash',
                    `Did you collect ₹${amount} in cash from the customer?`,
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Yes, Collected',
                        onPress: async () => {
                          try {
                            const result = await collectCashPayment(booking.id);
                            if (result.alreadyPaid) {
                              setPaymentDone(true);
                              showAlert('Payment', 'Already marked as paid!');
                              return;
                            }
                            setPaymentDone(true);
                            showAlert('Cash Collected ✅', `₹${amount} cash payment recorded successfully!`);
                          } catch (e: any) {
                            showAlert('Error', e?.message || 'Could not record cash payment');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.finalFareDoneText}>💵 Collect Cash</Text>
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
                style={[styles.finalFareDone, { backgroundColor: '#7c3aed', marginBottom: 8 }]}
                disabled={paymentProcessing}
                onPress={async () => {
                  if (!booking?.id) return;
                  setPaymentProcessing(true);
                  try {
                    const order = await createBookingPaymentOrder(booking.id);
                    if (order.alreadyPaid) {
                      setPaymentDone(true);
                      showAlert('Payment', 'Already paid!');
                      return;
                    }
                    // Use Cashfree in-app SDK — NOT browser Linking (which crashes)
                    const { openCashfreeCheckout } = await import('../../services/cashfreeService');
                    const result = await openCashfreeCheckout({
                      orderId: order.orderId ?? '',
                      paymentSessionId: order.paymentSessionId ?? '',
                    });
                    // Verify with backend after SDK confirms
                    await verifyBookingPayment({ bookingId: booking.id, cf_order_id: result.orderId });
                    setPaymentDone(true);
                    showAlert('Payment Successful ✅', 'Your payment has been confirmed!');
                  } catch (e: any) {
                    const msg = e?.message || '';
                    if (msg.toLowerCase().includes('cancel')) {
                      showAlert('Payment Cancelled', 'Payment was not completed. Please try again.');
                    } else {
                      showAlert('Payment Failed', msg || 'Could not complete payment. Try wallet below.');
                    }
                  } finally {
                    setPaymentProcessing(false);
                  }
                }}
              >
                {paymentProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.finalFareDoneText}>Pay ₹{Number(booking?.totalAmount || 0).toFixed(0)} via {(booking as any)?.paymentMethod === 'CARD' ? 'Card' : 'UPI'}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {/* Wallet fallback for UPI/CARD — in case SDK fails or user prefers wallet */}
            {!isDriverMode && !paymentDone && (booking as any)?.paymentStatus !== 'PAID' &&
              ((booking as any)?.paymentMethod === 'UPI' || (booking as any)?.paymentMethod === 'CARD') ? (
              <TouchableOpacity
                style={[styles.finalFareDone, { backgroundColor: 'transparent', borderWidth: 1, borderColor: G.accent, marginBottom: 12 }]}
                disabled={paymentProcessing}
                onPress={() => {
                  if (!booking?.id) return;
                  showAlert(
                    'Pay from Wallet?',
                    `Switch to wallet payment ₹${Number(booking?.totalAmount || 0).toFixed(0)} for this ride?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Pay from Wallet',
                        onPress: async () => {
                          setPaymentProcessing(true);
                          try {
                            const result = await payBookingWithWallet(booking.id);
                            setPaymentDone(true);
                            showAlert('Payment Successful ✅', result.alreadyPaid ? 'Already paid!' : `Paid ₹${Number(booking?.totalAmount || 0).toFixed(0)} from wallet!`);
                          } catch (e: any) {
                            showAlert('Wallet Failed', e?.message || 'Insufficient balance. Please top up your wallet.');
                          } finally {
                            setPaymentProcessing(false);
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={[styles.finalFareDoneText, { color: G.accent }]}>💳 Pay from Wallet instead</Text>
              </TouchableOpacity>
            ) : null}

            {/* WALLET: Auto-pay button */}
            {!isDriverMode && (booking as any)?.paymentMethod === 'WALLET' && !paymentDone && (booking as any)?.paymentStatus !== 'PAID' ? (
              <TouchableOpacity
                style={[styles.finalFareDone, { backgroundColor: G.accent, marginBottom: 12 }]}
                disabled={paymentProcessing}
                onPress={async () => {
                  if (!booking?.id) return;
                  setPaymentProcessing(true);
                  try {
                    const result = await payBookingWithWallet(booking.id);
                    if (result.alreadyPaid) {
                      setPaymentDone(true);
                      showAlert('Payment', 'Already paid!');
                    } else {
                      setPaymentDone(true);
                      showAlert('Payment', `Paid from wallet! Remaining balance: ₹${result.balance?.toFixed(0) ?? '—'}`);
                    }
                  } catch (e: any) {
                    showAlert('Payment Failed', e?.message || 'Could not pay from wallet');
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

            {/* Payment confirmed banner — shown to both driver and customer */}
            {(paymentDone || (booking as any)?.paymentStatus === 'PAID') ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: 'rgba(5,150,105,0.12)', borderRadius: 12, paddingVertical: 10,
                paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(5,150,105,0.3)' }}>
                <Icon name="check-circle" size={18} color="#059669" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>Payment Confirmed ✓</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.finalFareDone, { backgroundColor: G.glass3, marginBottom: 12 }]}
              onPress={() => {
                if (booking) {
                  navigation.navigate('RideReceipt', { booking });
                }
              }}
            >
              <Text style={styles.finalFareDoneText}>View Receipt</Text>
            </TouchableOpacity>

            {/* Done button — gated for BOTH driver and customer until payment is confirmed */}
            {/* For CASH: driver must press 'Collect Cash' first, which fires payment_confirmed */}
            {/* For non-CASH: customer must complete online payment via Cashfree/UPI */}
            <TouchableOpacity
              style={[
                styles.finalFareDone,
                !paymentDone && (booking as any)?.paymentStatus !== 'PAID'
                  ? { opacity: 0.4 }
                  : {},
              ]}
              disabled={!paymentDone && (booking as any)?.paymentStatus !== 'PAID'}
              onPress={() => {
                dispatch(clearCurrentBooking());
                dispatch(clearLocations());
                dispatch(clearRoute());
                navigation.navigate('Tabs');
              }}
            >
              <Text style={styles.finalFareDoneText}>
                {!paymentDone && (booking as any)?.paymentStatus !== 'PAID'
                  ? isDriverMode
                    ? (booking as any)?.paymentMethod === 'CASH'
                      ? 'Collect cash first'
                      : 'Awaiting customer payment...'
                    : (booking as any)?.paymentMethod === 'CASH'
                      ? 'Awaiting cash collection...'
                      : 'Pay to proceed'
                  : 'Done'}
              </Text>
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
              <Icon name={isRoundTripStarted ? 'timer-sand' : 'clock-outline'} size={20} color={isRoundTripStarted ? '#C9A84C' : '#8A8A8A'} />
              <Text style={styles.etaText}>
                {isRoundTripStarted
                  ? `Elapsed: ${roundTripElapsed ?? '—'}${roundTripCountdown ? `  •  Remaining: ${roundTripCountdown}` : ''}`
                  : `${etaTargetLabel}: ${etaText}  •  Distance: ${distanceText}`}
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
          <View style={{ backgroundColor: G.textPrimary, borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 }}>Scan to Pay</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Customer, scan this QR with any UPI app</Text>

            {/* QR Code — only show if we have a proper UPI deep link */}
            {qrPayUrl && qrPayUrl.startsWith('upi://') ? (
              <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E5E5E5' }}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayUrl)}` }}
                  style={{ width: 220, height: 220 }}
                  resizeMode="contain"
                />
              </View>
            ) : qrPayUrl ? (
              // Non-UPI URL (checkout page) — show as QR but note it needs browser
              <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E5E5E5' }}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayUrl)}` }}
                  style={{ width: 220, height: 220 }}
                  resizeMode="contain"
                />
                <Text style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>Open in browser if UPI app doesn't work</Text>
              </View>
            ) : (
              <ActivityIndicator size="large" color="#C9A84C" />
            )}

            <Text style={{ fontSize: 28, fontWeight: '900', color: '#111', marginTop: 20 }}>₹{Number(booking?.totalAmount || 0).toFixed(0)}</Text>

            {/* Driver UPI ID as text fallback — customer can also type this manually */}
            {qrDriverUpiId && (
              <View style={{ marginTop: 14, backgroundColor: '#f8f8f8', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>Or pay directly to UPI ID</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111', letterSpacing: 0.5 }}>{qrDriverUpiId}</Text>
              </View>
            )}

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
    backgroundColor: G.bgAlt,
  },
  pickupMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: G.textPrimary,
  },
  dropMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: G.textPrimary,
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: G.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: G.textPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: G.bg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: G.textPrimary,
  },
  mapWrap: {
    height: Dimensions.get('window').height * 0.45,
    backgroundColor: G.glass2,
  },
  bottomScrollView: {
    flex: 1,
    backgroundColor: G.bg,
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
    backgroundColor: G.glass2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    marginBottom: 16,
  },
  finalFareTitle: { color: '#065f46', fontWeight: '800', fontSize: 14 },
  finalFareValue: { marginTop: 6, color: G.textPrimary, fontWeight: '900', fontSize: 24 },
  finalFareHint: { marginTop: 4, color: '#065f46', fontWeight: '700' },
  finalFareDone: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalFareDoneText: { color: G.textPrimary, fontWeight: '900' },
  liveFareCard: {
    backgroundColor: G.glass2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    marginBottom: 16,
  },
  liveFareTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 14 },
  liveFareValue: { marginTop: 6, color: G.textPrimary, fontWeight: '900', fontSize: 22 },
  otpCard: {
    backgroundColor: '#1a1400',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: G.accent,
    padding: 16,
    marginBottom: 16,
  },
  otpTitle: { color: G.accent, fontWeight: '800', fontSize: 14 },
  otpValue: { marginTop: 8, color: G.textPrimary, fontWeight: '900', fontSize: 36, letterSpacing: 6, textAlign: 'center' },
  otpHint: { marginTop: 6, color: G.accent, fontWeight: '700', fontSize: 13, textAlign: 'center' },
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
    color: G.textPrimary,
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
    color: G.textPrimary,
    fontWeight: '800',
  },
  contactCard: {
    backgroundColor: G.bgAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  contactTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: G.textPrimary,
  },
  contactSubTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: G.textSecondary,
  },
  tripMetaStrong: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '900',
    color: G.accent,
  },
  contactActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  navigateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    backgroundColor: G.glass3,
    borderWidth: 1,
    borderColor: G.textPrimary,
  },
  navigateBtnTitle: {
    color: G.textPrimary,
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
    backgroundColor: G.bg,
    borderWidth: 1,
    borderColor: G.border3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: G.bgAlt,
    borderRadius: 12,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: G.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: G.textPrimary,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: G.textPrimary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: G.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: G.bg,
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
    backgroundColor: G.bgAlt,
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
    color: G.textPrimary,
  },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    backgroundColor: G.glass2,
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
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: G.border3,
  },
  otpModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: G.textPrimary,
  },
  otpModalSubTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: G.textSecondary,
  },
  otpInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: G.border3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '800',
    color: G.textPrimary,
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
    backgroundColor: G.glass2,
  },
  otpModalBtnPrimary: {
    backgroundColor: G.accent,
  },
  otpModalBtnDisabled: {
    opacity: 0.6,
  },
  otpModalBtnSecondaryText: {
    fontWeight: '800',
    color: G.textPrimary,
  },
  otpModalBtnPrimaryText: {
    fontWeight: '800',
    color: G.textPrimary,
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
    backgroundColor: G.accent,
  },
  tripActionDanger: {
    backgroundColor: '#16a34a',
  },
  tripActionTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: G.textPrimary,
  },
  driverChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: G.glass2,
    marginBottom: 16,
  },
  driverChatText: {
    fontSize: 15,
    fontWeight: '700',
    color: G.accent,
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
    color: G.textPrimary,
    fontSize: 10,
    fontWeight: '900',
  },
  favDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  favDriverText: {
    fontSize: 12,
    fontWeight: '700',
    color: G.accent,
  },
  customerCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  customerCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  recenterBtn: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOverlayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
});

// (markerStyles removed — pickup/drop now use native pinColor markers)


export default TrackingScreen;