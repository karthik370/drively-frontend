import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  updateBookingStatus,
  updateBookingFare,
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
  uploadTripPhoto,
  getTripPhotoStatus,
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
  const [photoModalVisible, setPhotoModalVisible] = React.useState(false);
  const [currentPhotoStep, setCurrentPhotoStep] = React.useState(0);
  const PHOTO_LABELS = ['front', 'back', 'left', 'right', 'selfie'] as const;
  const PHOTO_TITLES = ['Front of Car', 'Back of Car', 'Left Side', 'Right Side', 'Driver Selfie'] as const;
  const [capturedPhotos, setCapturedPhotos] = React.useState<Record<string, { uri: string; uploaded: boolean }>>({});
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoVerificationComplete, setPhotoVerificationComplete] = React.useState(false);
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
  const [driverProfileData, setDriverProfileData] = React.useState<any>(null);
  const [driverProfileLoading, setDriverProfileLoading] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false); // Loading overlay for status transitions
  const statusUpdatingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Safety auto-clear
  // Live fare from backend socket — updated every ~30s during active trips
  const [liveFare, setLiveFare] = React.useState<number | null>(null);
  const [liveFareDriver, setLiveFareDriver] = React.useState<number | null>(null);
  const [liveFareDistanceKm, setLiveFareDistanceKm] = React.useState<number | null>(null);

  // Wrapped setter: every time we set true, arm a 8s safety auto-clear so the overlay
  // can never get permanently stuck even if a code path forgets to call setStatusUpdating(false).
  const safeSetStatusUpdating = React.useCallback((val: boolean) => {
    setStatusUpdating(val);
    if (val) {
      if (statusUpdatingTimeoutRef.current) clearTimeout(statusUpdatingTimeoutRef.current);
      statusUpdatingTimeoutRef.current = setTimeout(() => {
        setStatusUpdating(false);
        statusUpdatingTimeoutRef.current = null;
      }, 8000); // 8s safety timeout (was 15s — shorter to avoid long freezes)
    } else {
      if (statusUpdatingTimeoutRef.current) {
        clearTimeout(statusUpdatingTimeoutRef.current);
        statusUpdatingTimeoutRef.current = null;
      }
    }
  }, []);
  const [isMapPanned, setIsMapPanned] = React.useState(false); // Suspends auto-camera when user moves map
  const isMapPannedRef = useRef(false);
  const pannedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { isMapPannedRef.current = isMapPanned; }, [isMapPanned]);
  // Auto-reset panned flag after 10s so camera resumes following driver
  const handleMapPan = React.useCallback(() => {
    setIsMapPanned(true);
    isMapPannedRef.current = true;
    if (pannedTimerRef.current) clearTimeout(pannedTimerRef.current);
    pannedTimerRef.current = setTimeout(() => {
      setIsMapPanned(false);
      isMapPannedRef.current = false;
    }, 10000);
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

  // booking:fare-updated — emitted when a normal driver accepts an experienced-driver booking.
  // Platform immediately removes the ₹75 experienced driver fee from the total.
  // Customer sees the updated (lower) fare instantly.
  useEffect(() => {
    const socket = (socketService as any)?.socket ?? (socketService as any)?.getSocket?.();
    if (!socket) return;
    const onFareUpdated = (data: any) => {
      if (data?.bookingId !== booking?.id) return;
      if (typeof data?.totalAmount === 'number') {
        dispatch(updateBookingFare({
          id: booking!.id,
          totalAmount: data.totalAmount,
          discountAmount: typeof data.discountAmount === 'number' ? data.discountAmount : undefined,
        }));
      }
      if (data?.reason === 'experienced_driver_unavailable' && data?.fareReduced > 0) {
        showAlert(
          '💰 Fare Updated',
          data?.message ||
            `An experienced driver was not available. ₹${data.fareReduced} experienced driver fee removed. New fare: ₹${data.totalAmount}.`,
        );
      }
    };
    socket.on('booking:fare-updated', onFareUpdated);
    return () => { socket.off('booking:fare-updated', onFareUpdated); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  // fare:live-update — live fare pushed by backend every ~30s during STARTED/IN_PROGRESS.
  // Updates the "Current price" card in real time for both driver and customer.
  useEffect(() => {
    const socket = (socketService as any)?.socket ?? (socketService as any)?.getSocket?.();
    if (!socket) return;
    const onLiveFare = (data: any) => {
      if (data?.bookingId !== booking?.id) return;
      if (typeof data?.liveFare === 'number') {
        setLiveFare(data.liveFare);
      }
      if (typeof data?.driverLiveFare === 'number') {
        setLiveFareDriver(data.driverLiveFare);
      }
      if (typeof data?.actualDistanceKm === 'number') {
        setLiveFareDistanceKm(data.actualDistanceKm);
      }
    };
    socket.on('fare:live-update', onLiveFare);
    return () => { socket.off('fare:live-update', onLiveFare); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  // Reset live fare when trip status leaves STARTED/IN_PROGRESS
  useEffect(() => {
    const status = booking?.status;
    if (status && !['STARTED', 'IN_PROGRESS'].includes(status as string)) {
      setLiveFare(null);
      setLiveFareDriver(null);
      setLiveFareDistanceKm(null);
    }
  }, [booking?.status]);

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

  // Fetch fresh driver profile data when modal opens.
  // Uses booking.driver from Redux as immediate fallback, then enriches with fresh API data.
  useEffect(() => {
    const fetchId = booking?.id ? String(booking.id) : trackingBookingId;
    if (!showDriverStatsModal) return;

    // Step 1: Immediately seed the modal with whatever we already have in Redux
    // so the user never sees 0/0/— while the API loads.
    const reduxDriver = (booking as any)?.driver;
    if (reduxDriver && !driverProfileData) {
      setDriverProfileData(reduxDriver);
    }

    if (!fetchId) return;

    setDriverProfileLoading(true);
    void (async () => {
      try {
        const raw = await getBookingDetails(fetchId);
        const freshDriver = (raw as any)?.driver ?? null;
        if (freshDriver) {
          setDriverProfileData(freshDriver);
        } else {
          console.warn('[DriverStats] API returned no driver in booking', { fetchId, keys: Object.keys(raw ?? {}) });
        }
      } catch (err: any) {
        console.warn('[DriverStats] Failed to fetch driver profile — using Redux fallback', err?.message || err);
        // Keep whatever we already seeded from Redux
      } finally {
        setDriverProfileLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDriverStatsModal, booking?.id, trackingBookingId]);

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

  // effectiveUserType: resolves the user's active role (DRIVER roleOverride can switch BOTH/DRIVER → CUSTOMER)
  const effectiveUserType = useMemo(() => {
    if (authedUserType === UserType.DRIVER && roleOverride === UserType.CUSTOMER) return UserType.CUSTOMER;
    if (authedUserType === UserType.BOTH && roleOverride === UserType.CUSTOMER) return UserType.CUSTOMER;
    return authedUserType;
  }, [authedUserType, roleOverride]);

  // isDriverMode: true when the current user is acting as a driver for THIS booking.
  // For BOTH-type users we check booking.driverId (root field) AND booking.driver.id (nested).
  // The root driverId is set as soon as the driver accepts — before the full driver object
  // is hydrated in the Redux store. So we MUST check driverId first.
  const isDriverMode = useMemo(() => {
    if (effectiveUserType === UserType.DRIVER) return true;
    if (effectiveUserType === UserType.BOTH) {
      if (authedUserId) {
        // Root field driverId (available from ACCEPTED state onwards)
        const rootDriverId = (booking as any)?.driverId;
        if (rootDriverId && String(rootDriverId) === String(authedUserId)) return true;
        // Nested driver object (available after full booking hydration)
        const nestedDriverId = (booking as any)?.driver?.id;
        if (nestedDriverId && String(nestedDriverId) === String(authedUserId)) return true;
        // If they are explicitly the customer of this booking → customer mode
        const rootCustomerId = (booking as any)?.customerId;
        const nestedCustomerId = (booking as any)?.customer?.id;
        const isExplicitlyCustomer =
          (rootCustomerId && String(rootCustomerId) === String(authedUserId)) ||
          (nestedCustomerId && String(nestedCustomerId) === String(authedUserId));
        if (isExplicitlyCustomer) return false;
      }
      if (roleOverride === UserType.CUSTOMER) return false;
      return false;
    }
    return false;
  }, [
    effectiveUserType, authedUserId, roleOverride,
    (booking as any)?.driverId,
    (booking as any)?.driver?.id,
    (booking as any)?.customerId,
    (booking as any)?.customer?.id,
  ]);
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

    // Get trip start time from booking — use real server timestamp so elapsed
    // is correct even after app close/reopen (avoids "0s" flash on resume)
    const startedAtRaw = (booking as any)?.startedAt;

    // CRITICAL: If startedAt is not yet loaded (app just resumed, data still fetching),
    // show nothing rather than starting the timer from 0 and confusing the driver/customer.
    // The effect will re-run automatically when startedAt arrives in Redux.
    if (!startedAtRaw) {
      setRoundTripElapsed(null);
      setRoundTripCountdown(null);
      return;
    }

    const startMs = new Date(startedAtRaw).getTime();
    const totalMs = packageHoursForCountdown * 60 * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - startMs);  // clamp to 0 so negatives don't show
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

    // Run immediately so time shows without waiting 1 second
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
    // Round trips in progress have no drop — don't label ETA to Drop
    const tripType = String((booking as any)?.tripType ?? '').toUpperCase();
    if (tripType === 'ROUND_TRIP' && (s === 'STARTED' || s === 'IN_PROGRESS')) {
      return 'Round Trip';
    }
    if ([BookingStatus.STARTED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(s as any)) {
      return 'ETA to Drop';
    }
    return 'ETA to Pickup';
  }, [booking?.status, (booking as any)?.tripType]);

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
    let phone = normalizePhone(otherParty?.phoneNumber);
    if (!phone) {
      showAlert('Call not available', 'Phone number is not available for this booking.');
      return;
    }
    // Strip spaces/dashes that can make tel: fail on some devices
    phone = phone.replace(/[\s\-().]/g, '');
    // If number has no country code and is 10 digits, prepend +91
    if (/^[6-9]\d{9}$/.test(phone)) phone = `+91${phone}`;
    const url = `tel:${phone}`;
    try {
      // Don't use canOpenURL — it requires QUERY_ALL_PACKAGES on Android 11+
      // and returns false even when calling is supported. Just open directly.
      await Linking.openURL(url);
    } catch {
      showAlert('Call', 'Unable to place call. Please dial manually: ' + phone);
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

    // ── Proximity gate: driver must be within 200m of pickup to mark ARRIVED ──
    if (nextStatus === BookingStatus.ARRIVED) {
      const driverPos = currentLocation;
      const pickupPos = pickupLocation;

      if (driverPos && pickupPos &&
          Number.isFinite(driverPos.latitude) && Number.isFinite(driverPos.longitude) &&
          Number.isFinite(pickupPos.latitude) && Number.isFinite(pickupPos.longitude)) {

        const distMeters = distanceApproxMeters(
          { latitude: driverPos.latitude, longitude: driverPos.longitude },
          { latitude: pickupPos.latitude, longitude: pickupPos.longitude }
        );

        if (distMeters > 200) {
          showAlert(
            '📍 Not at pickup yet',
            `You are ${Math.round(distMeters)}m away from the pickup location.\n\nPlease reach within 200 meters of the customer's pickup point first.`,
            [{ text: 'OK' }]
          );
          return; // Block the status update
        }
      }
      // If location data is unavailable (GPS off / loading), allow through without blocking.
    }

    if (nextStatus === BookingStatus.COMPLETED) {
      showAlert('End Trip', 'Are you sure you want to end this trip? The final fare will be calculated.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              safeSetStatusUpdating(true);
              try {
                await updateBookingStatusApi(bookingId, nextStatus);
                dispatch(updateBookingStatus({ id: bookingId, status: nextStatus }));
              } catch (e: any) {
                showAlert('Update status', e?.message || 'Failed to update booking status');
              } finally {
                safeSetStatusUpdating(false);
              }
            })();
          },
        },
      ]);
      return;
    }
    safeSetStatusUpdating(true);
    try {
      await updateBookingStatusApi(bookingId, nextStatus);
      dispatch(updateBookingStatus({ id: bookingId, status: nextStatus }));
    } catch (e: any) {
      showAlert('Update status', e?.message || 'Failed to update booking status');
    } finally {
      safeSetStatusUpdating(false);
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

  // ── Photo Verification Flow (replaces OTP) ──
  const handleOpenPhotoCapture = useCallback(async () => {
    if (!booking?.id) return;

    // Check camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Camera Permission', 'Camera access is required to take verification photos. Please enable it in settings.');
      return;
    }

    // Check what's already uploaded
    try {
      const photoStatus = await getTripPhotoStatus(booking.id);
      if (photoStatus?.complete) {
        setPhotoVerificationComplete(true);
        return;
      }
      // Pre-mark already uploaded photos
      if (photoStatus?.uploaded?.length) {
        const existing: Record<string, { uri: string; uploaded: boolean }> = {};
        for (const label of photoStatus.uploaded) {
          existing[label] = { uri: '', uploaded: true };
        }
        setCapturedPhotos(existing);
        // Start from first missing photo
        const firstMissing = PHOTO_LABELS.findIndex(l => !photoStatus.uploaded.includes(l));
        setCurrentPhotoStep(firstMissing >= 0 ? firstMissing : 0);
      } else {
        setCapturedPhotos({});
        setCurrentPhotoStep(0);
      }
    } catch {
      setCapturedPhotos({});
      setCurrentPhotoStep(0);
    }

    setPhotoModalVisible(true);
  }, [booking?.id]);

  const handleCapturePhoto = useCallback(async () => {
    if (!booking?.id || photoUploading) return;

    const label = PHOTO_LABELS[currentPhotoStep];
    const isSelfie = label === 'selfie';

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
        cameraType: isSelfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      setPhotoUploading(true);

      // Upload to backend
      await uploadTripPhoto(booking.id, {
        base64: asset.base64!,
        mimeType: 'image/jpeg',
        label: label as any,
      });

      // Mark as captured and uploaded
      setCapturedPhotos(prev => ({
        ...prev,
        [label]: { uri: asset.uri, uploaded: true },
      }));

      // Check if all done
      const newUploaded = { ...capturedPhotos, [label]: { uri: asset.uri, uploaded: true } };
      const allDone = PHOTO_LABELS.every(l => newUploaded[l]?.uploaded);

      if (allDone) {
        setPhotoVerificationComplete(true);
        showAlert('Photos Complete', 'All verification photos uploaded! You can now start the trip.');
      } else {
        // Auto-advance to next missing photo
        const nextMissing = PHOTO_LABELS.findIndex((l, i) => i > currentPhotoStep && !newUploaded[l]?.uploaded);
        if (nextMissing >= 0) {
          setCurrentPhotoStep(nextMissing);
        } else {
          // Wrap around to find any remaining
          const anyMissing = PHOTO_LABELS.findIndex(l => !newUploaded[l]?.uploaded);
          if (anyMissing >= 0) setCurrentPhotoStep(anyMissing);
        }
      }
    } catch (e: any) {
      showAlert('Upload Failed', e?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  }, [booking?.id, currentPhotoStep, photoUploading, capturedPhotos]);

  // Tracks which bookingId has already been handled for STARTED transition
  // Prevents the useEffect below from re-running when setCurrentBooking updates booking object
  const startedHandledForIdRef = useRef<string | null>(null);

  const handleStartTripAfterPhotos = useCallback(async () => {
    if (!booking?.id) return;
    // Close the modal immediately so the driver doesn't see a frozen modal while the API call is in-flight.
    // The statusUpdating overlay (semi-transparent with spinner) will cover the screen instead.
    setPhotoModalVisible(false);
    setCapturedPhotos({});
    setCurrentPhotoStep(0);
    setPhotoVerificationComplete(false);
    safeSetStatusUpdating(true);
    const bookingId = String(booking.id);
    try {
      await updateBookingStatusApi(bookingId, BookingStatus.STARTED);
      // Optimistic update — socket will also dispatch this, but we do it here first for instant UI.
      dispatch(updateBookingStatus({ id: bookingId, status: BookingStatus.STARTED }));

      // Re-fetch booking details to get startedAt + current totalAmount for live fare.
      // IMPORTANT: Defer with setTimeout(0) to yield JS event loop BETWEEN the status dispatch
      // above and the setCurrentBooking dispatch below. Without this, both dispatches fire in the
      // same synchronous React batch — MapView + all subscribed components re-render together
      // causing a visible 1-3s freeze on iOS/Expo Go.
      setTimeout(async () => {
        try {
          const raw = await getBookingDetails(bookingId);
          if (raw) dispatch(setCurrentBooking(raw as any));
        } catch {
          // non-critical — socket fare-updated will fill in the amount
        }
      }, 0);
    } catch (e: any) {
      // On failure, restore photo modal state so driver can retry
      setPhotoVerificationComplete(true); // keep verified state so they don't have to retake photos
      showAlert('Start Trip Failed', e?.message || 'Failed to start trip. Please check your connection and try again.');
    } finally {
      safeSetStatusUpdating(false);
    }
  }, [booking?.id, dispatch, safeSetStatusUpdating]);

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
    const id = booking?.id;
    if (!s || !id) return;
    if (s === BookingStatus.STARTED || s === BookingStatus.IN_PROGRESS) {
      // Idempotency guard: only run STARTED setup once per booking.
      // Without this, dispatch(setCurrentBooking) from handleStartTripAfterPhotos
      // updates booking object → re-triggers this effect → infinite loop → iOS freeze.
      if (startedHandledForIdRef.current === id) return;
      startedHandledForIdRef.current = id;

      // ── FULL RESET of all route/camera tracking refs ──
      lastRouteKeyRef.current = null;
      lastRouteTsRef.current = 0;
      lastRouteStartRef.current = null;
      lastRouteTargetRef.current = null;
      lastFitTargetKeyRef.current = null;
      lastFollowCameraTsRef.current = 0;
      hasRouteEtaRef.current = false;
      lastDispatchedEtaRef.current = null;
      lastDispatchedDistRef.current = null;

      // Mark "just started" — first 10s show full route, not 3km truncated
      justStartedRef.current = true;
      setShowFullRouteBtn(true);
      setTimeout(() => { justStartedRef.current = false; }, 10000);

      // Clear the old pickup route from Redux immediately
      dispatch(clearRoute());

      // Round-trip after STARTED has no route target → clear ETA so stale
      // "6 min to pickup" doesn't stay on screen.
      const tripType = String((booking as any)?.tripType ?? '').toUpperCase();
      if (tripType === 'ROUND_TRIP') {
        dispatch(updateETA({ eta: null as any, distance: null as any }));
      }
      // NOTE: getBookingDetails re-fetch is done in handleStartTripAfterPhotos directly
      // to avoid the booking dependency here triggering an infinite re-render loop.
    }
  }, [booking?.status, booking?.id, dispatch]);

  const statusInfo = useMemo(() => {
    if (!bookingStatus) return { text: 'Waiting for driver...', color: G.accent, bg: '#eff6ff', icon: 'clock-outline' as const };
    if (bookingStatus === 'SEARCHING') return { text: 'Searching for nearby drivers...', color: G.accent, bg: '#eff6ff', icon: 'radar' as const };
    if (bookingStatus === 'ACCEPTED') return { text: 'Driver accepted • On the way', color: '#f59e0b', bg: '#fffbeb', icon: 'car-side' as const };
    if (bookingStatus === 'DRIVER_ARRIVING') return { text: 'Driver arriving soon', color: '#f59e0b', bg: '#fffbeb', icon: 'car-side' as const };
    if (bookingStatus === 'ARRIVED') return { text: 'Driver arrived at pickup', color: '#10b981', bg: '#f0fdf4', icon: 'map-marker-check' as const };
    if (bookingStatus === 'STARTED' || bookingStatus === 'IN_PROGRESS') return { text: 'Trip in progress', color: G.accent, bg: '#eff6ff', icon: 'navigation-variant' as const };
    if (bookingStatus === 'COMPLETED') return { text: 'Ride Completed ✓', color: '#059669', bg: '#f0fdf4', icon: 'check-circle' as const };
    if (bookingStatus === 'CANCELLED') return { text: 'Booking cancelled', color: '#ef4444', bg: '#fef2f2', icon: 'close-circle' as const };
    return { text: `Status: ${bookingStatus}`, color: G.textSecondary, bg: '#f9fafb', icon: 'information' as const };
  }, [bookingStatus]);

  const statusText = statusInfo.text;

  const isCashPayment = (booking as any)?.paymentMethod === 'CASH';
  // Show final fare only after COMPLETED
  const showFinalFare = Boolean(
    booking?.status === BookingStatus.COMPLETED &&
    booking?.totalAmount != null   // null check (not type check) handles Prisma Decimal 0
  );
  // Show live fare card as soon as trip is in progress — even if amount=0 initially
  // (avoids the card being hidden during the brief window before fare-updated socket arrives)
  const showLiveFare = Boolean(
    booking?.status &&
    [BookingStatus.STARTED, BookingStatus.IN_PROGRESS].includes(booking.status as any)
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
  // Edge padding: must be LESS than mapWrap height (45% of screen, ~360dp on typical phone).
  // Padding values below leave ~160dp vertical space for fitToCoordinates to work correctly.
  // Previous values (top:300+bottom:280=580dp) EXCEEDED map height, causing tight-zoom bug.
  const FIT_PADDING_PRETRIP = { top: 50, bottom: 50, left: 50, right: 50 };
  const FIT_PADDING_TRIP    = { top: 50, bottom: 50, left: 50, right: 50 };
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

    const driverFallback = isDriverModeRef.current
      ? (currentLocationRef.current ?? driverLocationRef.current)
      : (driverLocationRef.current ?? currentLocationRef.current);
    let driverPos = overrideDriver ?? routeStartRef.current ?? driverFallback ?? null;
    const targetPos = overrideTarget ?? routeTargetRef.current ?? null;

    // Safety: if driver coords are > 500 km from target, it's a stale/emulator location — ignore it
    if (driverPos && targetPos) {
      const dLat = Math.abs(driverPos.latitude - targetPos.latitude);
      const dLng = Math.abs(driverPos.longitude - targetPos.longitude);
      const roughKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      console.log('[fitMapToRoute] stale-check roughKm:', roughKm.toFixed(1),
        'driverPos:', `${driverPos.latitude.toFixed(5)},${driverPos.longitude.toFixed(5)}`,
        'targetPos:', `${targetPos.latitude.toFixed(5)},${targetPos.longitude.toFixed(5)}`);
      if (roughKm > 500) {
        console.warn('[fitMapToRoute] driverPos nulled — stale/emulator coords >500km from target');
        driverPos = null; // treat as unknown until real GPS arrives
      }
    }

    // Guard — if either endpoint is missing, retry up to 5 times
    // BUT: for round trips in STARTED/IN_PROGRESS, targetPos being null is EXPECTED
    // (round trips have no drop location). Skip retries entirely in that case.
    if (!driverPos || !targetPos) {
      const tripType = String((booking as any)?.tripType ?? '').toUpperCase();
      const isRoundTripInProgress = tripType === 'ROUND_TRIP' &&
        Boolean(status && ['STARTED', 'IN_PROGRESS'].includes(status));

      if (!targetPos && isRoundTripInProgress) {
        // Expected: round trip has no drop target. Fall through to the no-target branch.
      } else {
        const retryCountKey = `__fitRetry_${status}`;
        const retryCount = (fitMapToRouteRef as any)[retryCountKey] ?? 0;
        if (retryCount < 5) {
          (fitMapToRouteRef as any)[retryCountKey] = retryCount + 1;
          console.log('[MAP-FIT] Missing endpoint, retry', retryCount + 1, '/5 —',
            'driver:', !!driverPos, 'target:', !!targetPos, 'status:', status);
          setTimeout(() => fitMapToRouteRef.current(overrideDriver, overrideTarget), 300);
          return;
        }
        // Exhausted retries — reset counter and fall through
        (fitMapToRouteRef as any)[retryCountKey] = 0;
      }
    }

    // Reset retry counters on successful call
    if (driverPos && targetPos) {
      (fitMapToRouteRef as any)[`__fitRetry_${status}`] = 0;
      (fitMapToRouteRef as any)['__driverPosRetry'] = 0;
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
      console.log('[fitMapToRoute] BRANCH=no-target (round-trip)', {
        driverPos: driverPos ? `${driverPos.latitude.toFixed(5)},${driverPos.longitude.toFixed(5)}` : null,
        bookingStatus: status, isDriverMode: isDriverModeRef.current, timestamp: Date.now(),
      });
      if (!driverPos) return;
      const pickup = effectivePickupRef.current;
      if (pickup) {
        mapRef.current?.fitToCoordinates(
          [driverPos, pickup],
          { edgePadding: FIT_PADDING, animated: false },
        );
      }
      return;
    }

    if (!driverPos) {
      console.log('[fitMapToRoute] BRANCH=no-driverPos', {
          driverPos: null,
          targetPos: targetPos ? `${targetPos.latitude.toFixed(5)},${targetPos.longitude.toFixed(5)}` : null,
          bookingStatus: status,
          isDriverMode: isDriverModeRef.current,
          driverLocation: driverLocation ? `${driverLocation.latitude.toFixed(5)},${driverLocation.longitude.toFixed(5)}` : null,
          routeStart: routeStartRef.current ? `${routeStartRef.current.latitude.toFixed(5)},${routeStartRef.current.longitude.toFixed(5)}` : null,
          timestamp: Date.now(),
        });
        // RETRY: driverPos temporarily null (driver GPS not yet in Redux).
        // Do NOT tight-zoom — retry every 400ms up to 8 times waiting for real data.
        const driverPosRetryKey = '__driverPosRetry';
        const retryCount = (fitMapToRouteRef as any)[driverPosRetryKey] ?? 0;
        if (retryCount < 8) {
          (fitMapToRouteRef as any)[driverPosRetryKey] = retryCount + 1;
          console.log('[fitMapToRoute] driverPos null — retry', retryCount + 1, '/8');
          setTimeout(() => fitMapToRouteRef.current(overrideDriver, overrideTarget), 400);
          return;
        }
        // After 8 retries (~3.2s) still no driver — show wide view of target + pickup
        (fitMapToRouteRef as any)[driverPosRetryKey] = 0;
        console.log('[fitMapToRoute] driverPos exhausted retries — wide fallback');
        const pickup = effectivePickupRef.current;
        const fallbackPoints = pickup ? [targetPos, pickup] : [targetPos];
        if (fallbackPoints.length > 1) {
          mapRef.current?.fitToCoordinates(fallbackPoints, { edgePadding: FIT_PADDING, animated: false });
        } else {
          mapRef.current?.animateToRegion({
            latitude: targetPos.latitude,
            longitude: targetPos.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }, 600);
        }
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
          { edgePadding: FIT_PADDING, animated: false },
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
        { edgePadding: FIT_PADDING, animated: false },
      );
      return;
    }

    // ── Pre-trip or no remaining route: fit full route ──
    const polySamples = getPolylineSamples();
    const pointsToFit: { latitude: number; longitude: number }[] = [driverPos, targetPos, ...polySamples];
    mapRef.current?.fitToCoordinates(
      pointsToFit,
      { edgePadding: FIT_PADDING, animated: false },
    );
  }, [getPolylineSamples, remainingRoute, decodedRoute, getFitPadding]);
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
      isMapPannedRef.current = false;
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
        <TouchableOpacity onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Tabs');
          }
        }}>
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
                    animated: false,
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

        {/* Single map action button — fixed top-right in the map area */}
        {(() => {
          const isTripActive = bookingStatus && ['STARTED', 'IN_PROGRESS'].includes(bookingStatus);
          // Priority 1: Recentre when user has panned the map
          if (isMapPanned) {
            return (
              <TouchableOpacity
                style={styles.recenterBtn}
                onPress={() => {
                  if (pannedTimerRef.current) clearTimeout(pannedTimerRef.current);
                  // Reset both state and ref immediately — don't wait for the useEffect sync
                  setIsMapPanned(false);
                  isMapPannedRef.current = false;
                  lastFitCallTsRef.current = 0;
                  lastCameraTimestampRef.current = 0;
                  // Animate camera to driver's live position
                  const dl = driverLocation;
                  if (dl && Number.isFinite(dl.latitude) && Number.isFinite(dl.longitude)) {
                    mapRef.current?.animateToRegion({
                      latitude: dl.latitude,
                      longitude: dl.longitude,
                      latitudeDelta: 0.012,
                      longitudeDelta: 0.012,
                    }, 600);
                  } else {
                    fitMapToRoute();
                  }
                }}
              >
                <Icon name="crosshairs-gps" size={22} color="#C9A84C" />
              </TouchableOpacity>
            );
          }
          // Priority 2: Show full route during active trip (driver position + drop)
          if (showFullRouteBtn && isTripActive) {
            return (
              <TouchableOpacity
                style={styles.recenterBtn}
                onPress={() => {
                  const { driverPos, target } = getMapEndpoints();
                  if (driverPos && target) {
                    const polySamples = getPolylineSamples();
                    lastFitCallTsRef.current = 0;
                    mapRef.current?.fitToCoordinates(
                      [driverPos, target, ...polySamples],
                      { edgePadding: getFitPadding(), animated: true },
                    );
                  }
                  setShowFullRouteBtn(false);
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

        {/* ── Driver verifying vehicle — shown to customer when ARRIVED ── */}
        {!isDriverMode && (booking?.status === BookingStatus.ARRIVED) ? (
          <View style={styles.otpCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="camera" size={18} color="#C9A84C" />
              <Text style={styles.otpTitle}>Driver Verifying Vehicle</Text>
            </View>
            <Text style={[styles.otpHint, { marginTop: 8 }]}>Your driver is taking verification photos. Trip will start shortly!</Text>
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
              etaMinutes={isRoundTripStarted ? null : eta}
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

                  let msg = `🚗 Track my DriveGaadi ride live!\n`;
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

              {/* Photo + Name — use booking.driver for name/photo (always in Redux state) */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                {((booking as any)?.driver?.profileImage || driverProfileData?.profileImage) ? (
                  <Image
                    source={{ uri: driverProfileData?.profileImage ?? (booking as any).driver.profileImage }}
                    style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 8, borderWidth: 2, borderColor: '#C9A84C' }}
                  />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2A2A3E', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Icon name="account" size={36} color="#8A8A8A" />
                  </View>
                )}
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
                  {`${driverProfileData?.firstName ?? (booking as any)?.driver?.firstName ?? ''} ${driverProfileData?.lastName ?? (booking as any)?.driver?.lastName ?? ''}`.trim() || 'Driver'}
                </Text>
                {(() => {
                  const r = parseFloat(String(driverProfileData?.rating ?? (booking as any)?.driver?.rating ?? 0));
                  return r > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Icon name="star" size={16} color="#f59e0b" />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#f59e0b' }}>{r.toFixed(1)}</Text>
                    </View>
                  ) : null;
                })()}
              </View>

              {/* Loading spinner while fetching fresh data */}
              {driverProfileLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Icon name="loading" size={28} color="#C9A84C" />
                  <Text style={{ fontSize: 12, color: '#8A8A8A', marginTop: 8 }}>Loading profile…</Text>
                </View>
              ) : (
                <>
                  {/* Stats Grid — Trips, Badges, Since (from fresh API data) */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, paddingVertical: 12, backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: 12 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>
                        {driverProfileData?.driverProfile?.totalTrips ?? 0}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginTop: 2 }}>Trips</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: '#C9A84C' }}>
                        {Array.isArray(driverProfileData?.driverBadges) ? driverProfileData.driverBadges.length : 0}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginTop: 2 }}>Badges</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#C9A84C' }}>
                        {(() => {
                          const raw = driverProfileData?.createdAt;
                          if (!raw) return '—';
                          const d = new Date(String(raw));
                          if (!Number.isFinite(d.getTime())) return '—';
                          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          return `${months[d.getMonth()]} ${d.getFullYear()}`;
                        })()}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#8A8A8A', marginTop: 2 }}>Since</Text>
                    </View>
                  </View>

                  {/* Expertise & Badges */}
                  {(() => {
                    const earnedBadges = driverProfileData?.driverBadges;
                    const hasEarned = Array.isArray(earnedBadges) && earnedBadges.length > 0;
                    const trips = driverProfileData?.driverProfile?.totalTrips ?? 0;
                    const rating = parseFloat(String(driverProfileData?.rating ?? 0));
                    return (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#CCCCCC', marginBottom: 10 }}>
                          Expertise & Badges
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {/* Verified badge */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                            <Icon name="check-decagram" size={14} color="#22c55e" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#22c55e' }}>Verified</Text>
                          </View>
                          {/* Trip milestone badge */}
                          {trips >= 100 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201,168,76,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' }}>
                              <Icon name="trophy" size={14} color="#C9A84C" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#C9A84C' }}>100+ Trips</Text>
                            </View>
                          )}
                          {trips >= 50 && trips < 100 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201,168,76,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' }}>
                              <Icon name="medal" size={14} color="#C9A84C" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#C9A84C' }}>50+ Trips</Text>
                            </View>
                          )}
                          {trips >= 10 && trips < 50 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201,168,76,0.08)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)' }}>
                              <Icon name="star-circle" size={14} color="#C9A84C" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#C9A84C' }}>10+ Trips</Text>
                            </View>
                          )}
                          {/* Top rated badge */}
                          {rating >= 4.5 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                              <Icon name="star" size={14} color="#f59e0b" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>Top Rated</Text>
                            </View>
                          )}
                          {/* Quiz skill badges */}
                          {hasEarned && earnedBadges.slice(0, 3).map((eb: any, i: number) => {
                            const b = eb?.badge;
                            if (!b) return null;
                            const badgeColor = b.color || '#C9A84C';
                            return (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: badgeColor + '15', borderWidth: 1, borderColor: badgeColor + '40', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}>
                                <Icon name={(b.icon || 'shield-star') as any} size={14} color={badgeColor} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: badgeColor }}>{b.title}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}
                </>
              )}



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
                      // Mark this booking as skipped so DriverOnlineScreen's poll won't
                      // re-add it when the driver returns. Booking goes to other drivers.
                      socketService.addSkippedBooking(bId);
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
            <Text style={styles.finalFareTitle}>Trip Summary</Text>

            {/* Driver sees their full earnings; customer sees what they owe */}
            <Text style={styles.finalFareValue}>
              ₹{isDriverMode
                ? Number((booking as any)?.driverEarnings || booking?.totalAmount || 0).toFixed(0)
                : Number(booking?.totalAmount || 0).toFixed(0)}
            </Text>

            {/* Subsidy badge — only visible to driver when platform subsidy > 0 */}
            {(() => {
              if (!isDriverMode) return null;
              const pb = (booking as any)?.pricingBreakdown;
              const subsidy = Number(pb?.platformSubsidy ?? pb?.discounts?.platformSubsidy ?? 0);
              const earnings = Number((booking as any)?.driverEarnings || 0);
              const customerPays = Number(booking?.totalAmount || 0);
              const computedSubsidy = subsidy > 0 ? subsidy : Math.max(0, Math.round((earnings - customerPays) * 100) / 100);
              if (computedSubsidy <= 0) return null;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#d1fae5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#065f46', fontWeight: '700' }}>💚 +₹{computedSubsidy.toFixed(0)} platform subsidy added to wallet</Text>
                </View>
              );
            })()}

            <Text style={styles.finalFareHint}>
              {isDriverMode
                ? (paymentDone || (booking as any)?.paymentStatus === 'PAID') ? 'Ride completed — payment received ✓' : 'Ride completed — collect payment'
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
                  const pb = (booking as any)?.pricingBreakdown;
                  const subsidy = Number(pb?.platformSubsidy ?? pb?.discounts?.platformSubsidy ?? 0);
                  const earnings = Number((booking as any)?.driverEarnings || 0);
                  const customerPays = Number(booking?.totalAmount || 0);
                  const computedSubsidy = subsidy > 0 ? subsidy : Math.max(0, Math.round((earnings - customerPays) * 100) / 100);
                  const cashAmount = customerPays.toFixed(0);

                  const subsidyMsg = computedSubsidy > 0
                    ? `\n\n💚 Platform will add ₹${computedSubsidy.toFixed(0)} to your wallet (discount subsidy).`
                    : '';

                  showAlert(
                    'Collect Cash',
                    `Collect ₹${cashAmount} cash from the customer.${subsidyMsg}`,
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
                            const successMsg = computedSubsidy > 0
                              ? `₹${cashAmount} cash collected! ₹${computedSubsidy.toFixed(0)} platform subsidy added to your wallet.`
                              : `₹${cashAmount} cash payment recorded successfully!`;
                            showAlert('Cash Collected ✅', successMsg);
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
                {(() => {
                  const pb = (booking as any)?.pricingBreakdown;
                  const subsidy = Number(pb?.platformSubsidy ?? pb?.discounts?.platformSubsidy ?? 0);
                  const earnings = Number((booking as any)?.driverEarnings || 0);
                  const customerPays = Number(booking?.totalAmount || 0);
                  const computedSubsidy = subsidy > 0 ? subsidy : Math.max(0, Math.round((earnings - customerPays) * 100) / 100);
                  if (computedSubsidy > 0 && (booking as any)?.paymentMethod === 'CASH') {
                    return (
                      <Text style={styles.finalFareDoneText}>
                        💰 ₹{customerPays.toFixed(0)} cash + ₹{computedSubsidy.toFixed(0)} wallet = ₹{earnings.toFixed(0)} earned
                      </Text>
                    );
                  }
                  return <Text style={styles.finalFareDoneText}>💰 Payment Received</Text>;
                })()}
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
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>Payment Successful ✓</Text>
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
                      ? 'Collect payment to continue'
                      : 'Waiting for payment...'
                    : (booking as any)?.paymentMethod === 'CASH'
                      ? 'Driver will collect payment'
                      : 'Complete payment to continue'
                  : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showLiveFare ? (
          <View style={styles.liveFareCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.liveFareTitle}>Current price</Text>
              {liveFareDistanceKm != null ? (
                <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '600' }}>
                  {liveFareDistanceKm.toFixed(1)} km travelled
                </Text>
              ) : null}
            </View>
            <Text style={styles.liveFareValue}>
              ₹{(() => {
                // Driver sees driverLiveFare (full earnings), customer sees liveFare (discounted)
                const fareToShow = isDriverMode
                  ? (liveFareDriver ?? liveFare ?? Number(booking?.totalAmount || 0))
                  : (liveFare ?? Number(booking?.totalAmount || 0));
                return fareToShow.toFixed(0);
              })()}
            </Text>
            {liveFare != null ? (
              <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Updates every ~30s</Text>
            ) : null}
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
                onPress={photoVerificationComplete ? handleStartTripAfterPhotos : handleOpenPhotoCapture}
              >
                <Icon name={photoVerificationComplete ? 'car' : 'camera'} size={18} color="#ffffff" />
                <Text style={styles.tripActionTextPrimary}>
                  {photoVerificationComplete ? 'Start Trip' : `Take Photos (${Object.keys(capturedPhotos).filter(k => capturedPhotos[k]?.uploaded).length}/5)`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {booking?.status === BookingStatus.STARTED || booking?.status === BookingStatus.IN_PROGRESS ? (
              <TouchableOpacity
                style={[styles.tripActionButton, styles.tripActionDanger]}
                onPress={() => handleDriverStatusUpdate(BookingStatus.COMPLETED)}
              >
                <Icon name="map-marker-check-outline" size={18} color="#ffffff" />
                <Text style={styles.tripActionTextPrimary}>End Trip</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {showDriverSection && booking?.id && !isDriverMode ? (
          // For round trip customer AFTER trip starts: hide ETA card — it’s meaningless.
          // The status badge above already says “Trip in progress”.
          // For all other states: show ETA / countdown timer.
          isRoundTripStarted ? null : (
            <View style={styles.etaCard}>
              <View style={styles.etaInfo}>
                <Icon name="clock-outline" size={20} color="#8A8A8A" />
                <Text style={styles.etaText}>
                  {`${etaTargetLabel}: ${etaText}  •  Distance: ${distanceText}`}
                </Text>
              </View>
            </View>
          )
        ) : null}

        <Modal
          visible={photoModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (photoUploading) return;
            setPhotoModalVisible(false);
          }}
        >
          <View style={styles.otpModalOverlay}>
            <View style={[styles.otpModalCard, { maxHeight: '85%' }]}>
              <Text style={styles.otpModalTitle}>Vehicle Verification Photos</Text>
              <Text style={styles.otpModalSubTitle}>
                Take {5 - Object.keys(capturedPhotos).filter(k => capturedPhotos[k]?.uploaded).length} more photo(s) to start the trip
              </Text>

              {/* Step indicators */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 }}>
                {PHOTO_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => !capturedPhotos[label]?.uploaded && setCurrentPhotoStep(i)}
                    style={{
                      width: 48, height: 48, borderRadius: 8,
                      backgroundColor: capturedPhotos[label]?.uploaded ? '#10b981' : i === currentPhotoStep ? G.accent : '#333',
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: i === currentPhotoStep ? 2 : 0,
                      borderColor: G.accent,
                    }}
                  >
                    {capturedPhotos[label]?.uploaded ? (
                      <Icon name="check" size={20} color="#fff" />
                    ) : (
                      <Icon
                        name={label === 'selfie' ? 'account' : label === 'front' ? 'car' : label === 'back' ? 'car-back' : 'car-side'}
                        size={18}
                        color="#fff"
                      />
                    )}
                    <Text style={{ color: '#fff', fontSize: 8, marginTop: 2 }}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Current capture instruction */}
              {!photoVerificationComplete ? (
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <Icon
                    name={PHOTO_LABELS[currentPhotoStep] === 'selfie' ? 'camera-front' : 'camera'}
                    size={48}
                    color={G.accent}
                  />
                  <Text style={{ color: G.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8 }}>
                    {PHOTO_TITLES[currentPhotoStep]}
                  </Text>
                  <Text style={{ color: G.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                    {PHOTO_LABELS[currentPhotoStep] === 'selfie'
                      ? 'Take a selfie for verification'
                      : `Take a photo of the ${PHOTO_LABELS[currentPhotoStep]} of the car`}
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <Icon name="check-circle" size={48} color="#10b981" />
                  <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '700', marginTop: 8 }}>
                    All Photos Uploaded!
                  </Text>
                  <Text style={{ color: G.textSecondary, fontSize: 13, marginTop: 4 }}>
                    You can now start the trip
                  </Text>
                </View>
              )}

              <View style={styles.otpModalActionsRow}>
                <TouchableOpacity
                  style={[styles.otpModalBtn, styles.otpModalBtnSecondary]}
                  onPress={() => {
                    if (photoUploading) return;
                    setPhotoModalVisible(false);
                  }}
                >
                  <Text style={styles.otpModalBtnSecondaryText}>Close</Text>
                </TouchableOpacity>

                {!photoVerificationComplete ? (
                  <TouchableOpacity
                    style={[styles.otpModalBtn, styles.otpModalBtnPrimary, photoUploading ? { opacity: 0.5 } : {}]}
                    onPress={handleCapturePhoto}
                    disabled={photoUploading}
                  >
                    {photoUploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.otpModalBtnPrimaryText}>
                        📸 Capture {PHOTO_TITLES[currentPhotoStep]}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.otpModalBtn, styles.otpModalBtnPrimary, { backgroundColor: '#10b981' }]}
                    onPress={handleStartTripAfterPhotos}
                  >
                    <Text style={styles.otpModalBtnPrimaryText}>🚀 Start Trip</Text>
                  </TouchableOpacity>
                )}
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
    top: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    zIndex: 10,
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