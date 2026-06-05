import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InteractionManager } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { G } from '../../constants/glassStyles';

import api, { getWalletBalance, getDiscountPreview, type DiscountPreview } from '../../services/api';
import PaymentMethodSelector, { type PaymentOption } from '../../components/customer/PaymentMethodSelector';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { BookingStatus, PaymentMethod, TransmissionType, TripType, VehicleType } from '../../types';
import { decodePolyline } from '../../utils/decodePolyline';
import { setCurrentBooking } from '../../redux/slices/bookingSlice';
import { calculateRoute, getNearbyDrivers, type NearbyDriver, validatePromoCode } from '../../services/api';
import {
  setDropAddress,
  setDropLocation,
  setPickupAddress,
  setPickupLocation,
  setUserLocation,
} from '../../redux/slices/locationSlice';
import { showAlert } from '../../components/common/CustomAlert';
import { CAR_IMAGE } from '../../components/maps/DriverMarker';

type Props = {
  navigation: any;
  route?: any;
};

const distanceApproxMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

const HYDERABAD_ORR_POLYGON: Array<{ lat: number; lng: number }> = [
  { lat: 17.4269, lng: 78.3425 },
  { lat: 17.485, lng: 78.285 },
  { lat: 17.534, lng: 78.265 },
  { lat: 17.58, lng: 78.31 },
  { lat: 17.61, lng: 78.38 },
  { lat: 17.625, lng: 78.48 },
  { lat: 17.61, lng: 78.56 },
  { lat: 17.56, lng: 78.64 },
  { lat: 17.49, lng: 78.68 },
  { lat: 17.42, lng: 78.69 },
  { lat: 17.35, lng: 78.67 },
  { lat: 17.29, lng: 78.63 },
  { lat: 17.24, lng: 78.57 },
  { lat: 17.21, lng: 78.49 },
  { lat: 17.2, lng: 78.42 },
  { lat: 17.24, lng: 78.38 },
  { lat: 17.3233, lng: 78.376 },
  { lat: 17.39, lng: 78.35 },
  { lat: 17.42, lng: 78.35 },
];

const isPointInPolygon = (lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

type RouteInfo = {
  polyline: { latitude: number; longitude: number }[];
  distanceMeters: number;
  durationSeconds: number;
  oneWayCharge?: number | null;
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
  });

  try {
    return (await Promise.race([promise, timeout])) as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const RideConfirmScreen = ({ navigation, route }: Props) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { pickupLocation, pickupAddress, dropLocation, dropAddress } = useAppSelector((s) => s.location);

  const LOCAL_PACKAGES = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);

  // ── Screen-ready gate: defer heavy work until navigation transition completes ──
  const [screenReady, setScreenReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setScreenReady(true);
    });
    return () => handle.cancel();
  }, []);

  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [outstationTripType, setOutstationTripType] = useState<'ROUND_TRIP' | 'ONE_WAY'>('ROUND_TRIP');
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [transmissionType, setTransmissionType] = useState<TransmissionType>(TransmissionType.MANUAL);
  const [requestedHours, setRequestedHours] = useState<number>(1);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoInfo, setPromoInfo] = useState<{ code: string; discountAmount: number; finalAmount: number } | null>(null);
  const [requireExperienced, setRequireExperienced] = useState(false);
  const [mapSelectTarget, setMapSelectTarget] = useState<'pickup' | 'drop'>('pickup');
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const nearbyFetchRef = useRef<{ inFlight: boolean }>({ inFlight: false });

  const [paymentMethod, setPaymentMethod] = useState<PaymentOption>('CASH');
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);

  const [timingMode, setTimingMode] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [pendingScheduleTime, setPendingScheduleTime] = useState<Date | null>(null);
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    let alive = true;
    getWalletBalance()
      .then((b) => { if (alive) setWalletBalance(Number(b?.balance || 0)); })
      .catch(() => { });
    return () => { alive = false; };
  }, []);

  const minScheduledTime = useMemo(() => new Date(Date.now() + 90 * 60 * 1000), [showScheduleModal, timingMode]);

  useEffect(() => {
    if (!pickupLocation) {
      setNearbyDrivers([]);
      return;
    }

    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      if (!mounted) return;
      if (!pickupLocation) return;
      if (nearbyFetchRef.current.inFlight) return;

      nearbyFetchRef.current.inFlight = true;
      try {
        const res = await getNearbyDrivers(pickupLocation.latitude, pickupLocation.longitude, 6);
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
  }, [pickupLocation?.latitude, pickupLocation?.longitude]);

  const formatDateTime = useCallback((d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hh = d.getHours();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} • ${String(hh).padStart(2, '0')}:${min} ${ampm}`;
  }, []);

  const schedulePickerDate = useMemo(() => {
    if (pendingScheduleTime) return pendingScheduleTime;
    if (scheduledTime) return scheduledTime;
    return new Date(minScheduledTime.getTime());
  }, [minScheduledTime, pendingScheduleTime, scheduledTime]);

  const isScheduleSelectionValid = useMemo(() => {
    // 60s tolerance to prevent race condition when modal opens and minScheduledTime recalculates
    return schedulePickerDate.getTime() >= minScheduledTime.getTime() - 60_000;
  }, [minScheduledTime, schedulePickerDate]);

  const formatScheduleButtonTime = useCallback((d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()] ?? '';
    let hh = d.getHours();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd} ${mon}, ${String(hh).padStart(2, '0')}:${min} ${ampm}`;
  }, []);

  useEffect(() => {
    const initial = route?.params?.serviceType as any;
    if (String(initial).toUpperCase() === 'SCHEDULE') {
      setTimingMode('SCHEDULED');
    }
  }, [route?.params?.serviceType]);

  useEffect(() => {
    if (timingMode === 'NOW') {
      setScheduledTime(null);
      return;
    }

    const current = scheduledTime;
    if (!current || current.getTime() < minScheduledTime.getTime()) {
      setScheduledTime(new Date(minScheduledTime.getTime()));
    }
  }, [minScheduledTime, scheduledTime, timingMode]);

  const mapRef = useRef<MapView | null>(null);
  const lastCameraKeyRef = useRef<string | null>(null);
  const lastCameraTsRef = useRef<number>(0);
  const lastCameraCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastServiceAlertKeyRef = useRef<string | null>(null);

  const isSingleLocationRoundTrip = tripType === TripType.ROUND_TRIP;

  const canConfirm =
    Boolean(tripType) && (isSingleLocationRoundTrip ? Boolean(pickupLocation) : Boolean(pickupLocation && dropLocation));

  const effectiveDropLocation = isSingleLocationRoundTrip ? pickupLocation : dropLocation;
  const effectiveDropAddress = isSingleLocationRoundTrip ? pickupAddress : dropAddress;

  const pickupInsideServiceArea = useMemo(() => {
    if (tripType !== TripType.ONE_WAY) return true;
    if (!pickupLocation) return true;
    return isPointInPolygon(pickupLocation.latitude, pickupLocation.longitude, HYDERABAD_ORR_POLYGON);
  }, [pickupLocation, tripType]);

  const dropInsideServiceArea = useMemo(() => {
    if (tripType !== TripType.ONE_WAY) return true;
    if (!dropLocation) return true;
    return isPointInPolygon(dropLocation.latitude, dropLocation.longitude, HYDERABAD_ORR_POLYGON);
  }, [dropLocation, tripType]);

  const isServiceable = useMemo(() => {
    if (tripType !== TripType.ONE_WAY) return true;
    if (!pickupLocation || !dropLocation) return true;
    return pickupInsideServiceArea && dropInsideServiceArea;
  }, [dropInsideServiceArea, dropLocation, pickupInsideServiceArea, pickupLocation, tripType]);

  useEffect(() => {
    if (tripType !== TripType.ONE_WAY) {
      lastServiceAlertKeyRef.current = null;
      return;
    }

    const pickupKey = pickupLocation
      ? `${pickupLocation.latitude.toFixed(5)},${pickupLocation.longitude.toFixed(5)}`
      : 'none';
    const dropKey = dropLocation ? `${dropLocation.latitude.toFixed(5)},${dropLocation.longitude.toFixed(5)}` : 'none';
    const alertKey = `${pickupKey}|${dropKey}|${pickupInsideServiceArea ? 'in' : 'out'}|${dropInsideServiceArea ? 'in' : 'out'}`;

    if (lastServiceAlertKeyRef.current === alertKey) return;

    if ((pickupLocation && !pickupInsideServiceArea) || (dropLocation && !dropInsideServiceArea)) {
      lastServiceAlertKeyRef.current = alertKey;
      showAlert('Not serviceable area', 'We will be available soon. Please choose locations within Hyderabad (ORR).');
    }
  }, [dropInsideServiceArea, dropLocation, pickupInsideServiceArea, pickupLocation, tripType]);

  useEffect(() => {
    const initial = route?.params?.serviceType as TripType | undefined;
    if (initial && Object.values(TripType).includes(initial)) {
      setTripType(initial);
    }
  }, [route?.params?.serviceType]);

  // ── Airport transfer handling ──
  useEffect(() => {
    const at = route?.params?.airportTransfer;
    if (!at) return;

    // Airport GPS coordinates
    const AIRPORT_COORDS: Record<string, { latitude: number; longitude: number }> = {
      HYD: { latitude: 17.2403, longitude: 78.4294 },
      BLR: { latitude: 13.1986, longitude: 77.7066 },
      DEL: { latitude: 28.5562, longitude: 77.1000 },
      BOM: { latitude: 19.0896, longitude: 72.8656 },
      MAA: { latitude: 12.9941, longitude: 80.1709 },
    };

    const coords = AIRPORT_COORDS[at.airportCode] || AIRPORT_COORDS.HYD;
    const label = at.addressLabel || `${at.airportCode} Airport`;

    setTripType(TripType.ONE_WAY);

    if (at.type === 'PICKUP') {
      // Airport pickup  → airport is pickup, user selects drop
      dispatch(setPickupLocation(coords));
      dispatch(setPickupAddress(label));
    } else {
      // Airport drop → user selects pickup, airport is drop
      dispatch(setDropLocation(coords));
      dispatch(setDropAddress(label));
    }
  }, [route?.params?.airportTransfer, dispatch]);

  useEffect(() => {
    if (!tripType) return;

    if (tripType === TripType.ONE_WAY) {
      if (!LOCAL_PACKAGES.includes(requestedHours)) setRequestedHours(1);
      return;
    }

    if (tripType === TripType.OUTSTATION) {
      if (requestedHours < 12) setRequestedHours(12);
      return;
    }

    if (requestedHours < 1) setRequestedHours(1);
  }, [LOCAL_PACKAGES, requestedHours, tripType]);

  useEffect(() => {
    if (tripType !== TripType.OUTSTATION) return;
    setRequestedHours(12);
  }, [outstationTripType, tripType]);

  useEffect(() => {
    if (isSingleLocationRoundTrip && mapSelectTarget !== 'pickup') {
      setMapSelectTarget('pickup');
    }
  }, [isSingleLocationRoundTrip, mapSelectTarget]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (isPicking) return;

    if (isSingleLocationRoundTrip && pickupLocation) {
      const key = `one:${pickupLocation.latitude.toFixed(5)},${pickupLocation.longitude.toFixed(5)}`;
      const now = Date.now();
      const prev = lastCameraCenterRef.current;
      const movedMeters = prev ? distanceApproxMeters(prev, pickupLocation) : Number.POSITIVE_INFINITY;
      if (lastCameraKeyRef.current === key && now - lastCameraTsRef.current < 900) {
        return;
      }
      if (now - lastCameraTsRef.current < 900 && Number.isFinite(movedMeters) && movedMeters < 30) {
        return;
      }
      lastCameraKeyRef.current = key;
      lastCameraTsRef.current = now;
      lastCameraCenterRef.current = { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude };
      mapRef.current.animateToRegion(
        {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        650
      );
      return;
    }

    if (pickupLocation && effectiveDropLocation) {
      const key = `fit:${pickupLocation.latitude.toFixed(5)},${pickupLocation.longitude.toFixed(5)}->${effectiveDropLocation.latitude.toFixed(
        5
      )},${effectiveDropLocation.longitude.toFixed(5)}`;
      const now = Date.now();
      if (lastCameraKeyRef.current === key && now - lastCameraTsRef.current < 900) {
        return;
      }
      lastCameraKeyRef.current = key;
      lastCameraTsRef.current = now;
      mapRef.current.fitToCoordinates([pickupLocation, effectiveDropLocation], {
        edgePadding: { top: 90, right: 70, bottom: 90, left: 70 },
        animated: true,
      });
      return;
    }

    const base = pickupLocation ?? effectiveDropLocation;
    if (!base) return;

    const key = `base:${base.latitude.toFixed(5)},${base.longitude.toFixed(5)}`;
    const now = Date.now();
    const prev = lastCameraCenterRef.current;
    const movedMeters = prev ? distanceApproxMeters(prev, base) : Number.POSITIVE_INFINITY;
    if (lastCameraKeyRef.current === key && now - lastCameraTsRef.current < 900) {
      return;
    }
    if (now - lastCameraTsRef.current < 900 && Number.isFinite(movedMeters) && movedMeters < 30) {
      return;
    }
    lastCameraKeyRef.current = key;
    lastCameraTsRef.current = now;
    lastCameraCenterRef.current = { latitude: base.latitude, longitude: base.longitude };

    mapRef.current.animateToRegion(
      {
        latitude: base.latitude,
        longitude: base.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      650
    );
  }, [effectiveDropLocation, isPicking, isSingleLocationRoundTrip, pickupLocation]);

  const setTargetFromCoords = useCallback(
    async (target: 'pickup' | 'drop', coords: { latitude: number; longitude: number }) => {
      if (target === 'pickup') {
        dispatch(setPickupLocation(coords));
      } else {
        dispatch(setDropLocation(coords));
      }

      const items = await Location.reverseGeocodeAsync(coords);
      const a = items?.[0];
      const formatted = [a?.name, a?.street, a?.subregion, a?.city].filter(Boolean).join(', ');
      const text = formatted || 'Selected location';

      if (target === 'pickup') {
        dispatch(setPickupAddress(text));
      } else {
        dispatch(setDropAddress(text));
      }
    },
    [dispatch]
  );

  const onMapPress = useCallback(
    async (e: any) => {
      const coordinate = e?.nativeEvent?.coordinate;
      if (typeof coordinate?.latitude !== 'number' || typeof coordinate?.longitude !== 'number') return;

      setIsPicking(true);
      try {
        const target = isSingleLocationRoundTrip ? 'pickup' : mapSelectTarget;
        await setTargetFromCoords(target, {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      } catch {
        showAlert('Map', 'Could not fetch address for that point.');
      } finally {
        setIsPicking(false);
      }
    },
    [isSingleLocationRoundTrip, mapSelectTarget, setTargetFromCoords]
  );

  const useCurrentLocation = useCallback(async () => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        showAlert('Location services', 'Turn on GPS/location services to detect your current location');
        return;
      }

      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status !== 'granted') {
        showAlert('Location permission', 'Enable location permission to detect your current location');
        return;
      }

      const last = await Location.getLastKnownPositionAsync();
      const lastCoords = last?.coords
        ? { latitude: last.coords.latitude, longitude: last.coords.longitude }
        : null;

      let coords: { latitude: number; longitude: number };
      if (lastCoords) {
        coords = lastCoords;
      } else {
        const pos = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          12000
        );
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }

      dispatch(setUserLocation(coords));

      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        650
      );

      const target = isSingleLocationRoundTrip ? 'pickup' : mapSelectTarget;
      await setTargetFromCoords(target, coords);
    } catch {
      showAlert('Location', 'Could not detect current location.');
    } finally {
      setIsPicking(false);
    }
  }, [dispatch, isPicking, isSingleLocationRoundTrip, mapSelectTarget, setTargetFromCoords]);

  const estimate = useMemo(() => {
    const km = routeInfo ? Math.max(0, routeInfo.distanceMeters / 1000) : 0;
    const min = routeInfo ? Math.max(0, routeInfo.durationSeconds / 60) : 0;
    const hours = Math.max(1, Math.round(requestedHours || 1));
    const taxesFee = 50;

    const isNightTime = (d: Date) => {
      const h = d.getHours();
      return h >= 22 || h < 6;
    };

    const overlapsNightWindow = (startTime: Date, durationHours: number) => {
      const startMs = startTime.getTime();
      const endMs = startMs + Math.max(1, durationHours) * 60 * 60 * 1000;
      const stepMs = 30 * 60 * 1000;
      for (let t = startMs; t <= endMs; t += stepMs) {
        if (isNightTime(new Date(t))) return true;
      }
      return false;
    };

    const startTime = timingMode === 'SCHEDULED' && scheduledTime ? scheduledTime : new Date();
    const routeSeconds = routeInfo ? Math.max(0, routeInfo.durationSeconds) : 0;

    const endSeconds = Math.max(routeSeconds, Math.round(hours * 3600));
    const endTime = new Date(startTime.getTime() + endSeconds * 1000);
    const nightChargeRaw = isNightTime(endTime) ? 200 : 0;
    const nightCharge = tripType === TripType.OUTSTATION ? 0 : nightChargeRaw;

    const EXPERIENCED_FEE = requireExperienced ? 75 : 0;

    if (!tripType) {
      return {
        distanceKm: km,
        durationMin: min,
        durationHours: hours,
        subtotal: 0,
        nightCharge,
        taxesFee,
        experiencedFee: EXPERIENCED_FEE,
        total: 0,
        label: '—',
      };
    }

    if (tripType === TripType.OUTSTATION) {
      if (outstationTripType === 'ROUND_TRIP') {
        const taxesFee = 89;
        const extraHourRate = 60;
        const allowed = [12, 16, 20, 24, 48, 72, 96, 120];
        const priceByHour: Record<number, number> = {
          12: 1199,
          16: 1439,
          20: 1679,
          24: 1919,
          48: 3359,
          72: 4799,
          96: 6239,
          120: 7679,
        };

        const chosen = allowed.reduce((best, h) => (Math.abs(h - hours) < Math.abs(best - hours) ? h : best), allowed[0]);
        const packageHours = chosen;
        const packagePrice = priceByHour[packageHours] ?? 1199;

        const extraHours = Math.max(0, hours - packageHours);
        const extraHourCharge = extraHours * extraHourRate;

        const extras = extraHourCharge;
        const subtotal = packagePrice + extras;
        const total = Math.round(subtotal + nightCharge + taxesFee);

        return {
          distanceKm: km,
          durationMin: min,
          durationHours: hours,
          packageHours,
          packagePrice,
          extras: Math.round(extras),
          subtotal: Math.round(subtotal),
          nightCharge,
          taxesFee,
          experiencedFee: EXPERIENCED_FEE,
          total: total + EXPERIENCED_FEE,
          label: 'Outstation Round Trip',
        };
      }

      const taxesFee = 109;
      const allowed = [12, 14, 16, 18];
      const priceByHour: Record<number, number> = { 12: 1800, 14: 1999, 16: 2199, 18: 2399 };
      const chosen = allowed.reduce((best, h) => (Math.abs(h - hours) < Math.abs(best - hours) ? h : best), allowed[0]);
      const packageHours = chosen;
      const packagePrice = priceByHour[packageHours] ?? 1800;

      const distanceFromPickupKm = km;
      const overThresholdKm = Math.max(0, distanceFromPickupKm - 200);
      const oneWayCharge = Math.round(overThresholdKm * 6);
      const extras = 0;
      const subtotal = packagePrice + oneWayCharge + extras;
      const baseTotal = Math.round(subtotal + nightCharge + taxesFee);
      const total = baseTotal + EXPERIENCED_FEE;

      return {
        distanceKm: km,
        durationMin: min,
        durationHours: hours,
        packageHours,
        packagePrice,
        oneWayCharge,
        extras,
        subtotal: Math.round(subtotal),
        nightCharge,
        taxesFee,
        experiencedFee: EXPERIENCED_FEE,
        total,
        label: 'Outstation One Way',
      };
    }

    if (tripType === TripType.ROUND_TRIP) {
      const getRoundTripPackagePrice = (hrs: number) => {
        const h = Math.max(1, Math.round(hrs));
        const points = [
          { h: 1, p: 279 },
          { h: 2, p: 299 },
          { h: 4, p: 489 },
          { h: 6, p: 699 },
          { h: 8, p: 889 },
          { h: 12, p: 1239 },
        ];
        const exact = points.find((pt) => pt.h === h);
        if (exact) return { hours: h, price: exact.p };
        const lower = [...points].reverse().find((pt) => pt.h < h) ?? points[0];
        const upper = points.find((pt) => pt.h > h) ?? points[points.length - 1];
        if (lower.h === upper.h) return { hours: h, price: upper.p };
        const t = (h - lower.h) / (upper.h - lower.h);
        const price = lower.p + t * (upper.p - lower.p);
        return { hours: h, price: Math.round(price) };
      };

      const pkg = getRoundTripPackagePrice(hours);
      const packageHours = pkg.hours;
      const packagePrice = pkg.price;

      const timeBufferMinutes = packageHours === 1 ? 30 : 0;
      const includedMinutesLimit = packageHours * 60 + timeBufferMinutes;
      const extraMinuteRate = 2.15;
      const extraMinutes = Math.max(0, Math.ceil(min - includedMinutesLimit));
      const extraMinuteCharge = extraMinutes * extraMinuteRate;

      const extras = extraMinuteCharge;
      const subtotal = packagePrice + extras;
      const total = Math.round(subtotal + nightCharge + taxesFee);

      return {
        distanceKm: km,
        durationMin: min,
        durationHours: hours,
        packageHours,
        packagePrice,
        subtotal: Math.round(subtotal),
        nightCharge,
        timeBufferMinutes,
        includedMinutesLimit,
        extraMinuteRate,
        extraMinutes,
        extraMinuteCharge: Math.round(extraMinuteCharge * 100) / 100,
        extras: Math.round(extras * 100) / 100,
        taxesFee,
        experiencedFee: EXPERIENCED_FEE,
        total: total + EXPERIENCED_FEE,
        label: 'Pay as you go',
      };
    }

    const effectiveHours = Math.min(8, Math.max(1, Math.round(hours)));
    const packagePrice =
      effectiveHours === 1
        ? 309
        : effectiveHours === 2
          ? 374
          : effectiveHours === 3
            ? 502
            : effectiveHours === 4
              ? 631
              : effectiveHours === 5
                ? 759
                : effectiveHours === 6
                  ? 899
                  : effectiveHours === 7
                    ? 1019
                    : 1149;

    const distanceBufferKm = 0;
    const includedKmLimit = Math.max(0, km);
    const extraKmRate = 7.5;

    const timeBufferMinutes = effectiveHours === 1 ? 30 : 0;
    const includedMinutesLimit = effectiveHours * 60 + timeBufferMinutes;
    const extraMinuteRate = 2.15;

    const extraMinutes = Math.max(0, Math.ceil(min - includedMinutesLimit));
    const extraKm = Math.max(0, km - includedKmLimit);
    const extraMinuteCharge = extraMinutes * extraMinuteRate;
    const extraKmCharge = extraKm * extraKmRate;
    const extras = extraMinuteCharge + extraKmCharge;

    const oneWayCharge = routeInfo && typeof routeInfo.oneWayCharge === 'number' ? routeInfo.oneWayCharge : 0;
    const subtotal = packagePrice + oneWayCharge + extras;
    const total = Math.round(subtotal + nightCharge + taxesFee);

    return {
      distanceKm: km,
      durationMin: min,
      durationHours: hours,
      subtotal: Math.round(subtotal),
      nightCharge,
      packageHours: effectiveHours,
      packagePrice,
      oneWayCharge,
      distanceBufferKm,
      timeBufferMinutes,
      includedKmLimit,
      includedMinutesLimit,
      extraMinuteRate,
      extraKmRate,
      extraMinutes,
      extraKm: Math.round(extraKm * 100) / 100,
      extraMinuteCharge: Math.round(extraMinuteCharge * 100) / 100,
      extraKmCharge: Math.round(extraKmCharge * 100) / 100,
      extras: Math.round(extras * 100) / 100,
      taxesFee,
      experiencedFee: EXPERIENCED_FEE,
      total: total + EXPERIENCED_FEE,
      label: 'Local',
    };
  }, [LOCAL_PACKAGES, outstationTripType, routeInfo, requestedHours, scheduledTime, timingMode, tripType, requireExperienced]);

  useEffect(() => {
    if (!promoInfo) return;
    setPromoInfo(null);
  }, [estimate.total, promoInfo]);

  // Fetch discount preview when fare changes
  useEffect(() => {
    if (!estimate.total || estimate.total <= 0) {
      setDiscountPreview(null);
      return;
    }

    let alive = true;
    const fetchDiscounts = async () => {
      try {
        const preview = await getDiscountPreview(estimate.total);
        if (!alive) return;
        setDiscountPreview(preview);
        // Auto-enable experienced driver for Premium members
        if (preview.isPremium && preview.requireExperienced) {
          setRequireExperienced(true);
        }
      } catch {
        if (alive) setDiscountPreview(null);
      }
    };

    void fetchDiscounts();
    return () => { alive = false; };
  }, [estimate.total]);

  useEffect(() => {
    let alive = true;

    const fetchDirections = async () => {
      if (!pickupLocation || !effectiveDropLocation) {
        setRouteInfo(null);
        if (alive) setIsLoadingRoute(false);
        return;
      }

      if (isSingleLocationRoundTrip) {
        setRouteInfo(null);
        if (alive) setIsLoadingRoute(false);
        return;
      }

      setIsLoadingRoute(true);

      try {
        const r = await withTimeout(calculateRoute(pickupLocation, effectiveDropLocation), 12000);
        if (!alive) return;

        const distanceMeters = typeof r?.distance === 'number' ? r.distance : 0;
        const durationSeconds = typeof r?.duration === 'number' ? r.duration : 0;
        const polyline = typeof r?.polyline === 'string' && r.polyline ? decodePolyline(r.polyline) : [];

        setRouteInfo({ polyline, distanceMeters, durationSeconds, oneWayCharge: r?.oneWayCharge ?? null });
      } catch {
        if (!alive) return;
        setRouteInfo(null);
      } finally {
        if (!alive) return;
        setIsLoadingRoute(false);
      }
    };

    fetchDirections();
    return () => {
      alive = false;
    };
  }, [effectiveDropLocation, isSingleLocationRoundTrip, pickupLocation]);

  useEffect(() => {
    if (tripType !== TripType.OUTSTATION) return;
    if (outstationTripType !== 'ONE_WAY') return;
    if (dropLocation) return;
    setMapSelectTarget('drop');
  }, [dropLocation, outstationTripType, tripType]);

  useEffect(() => {
    if (tripType !== TripType.OUTSTATION) return;
    if (outstationTripType !== 'ROUND_TRIP') return;
    if (!pickupLocation) return;
    if (dropLocation) return;
    setMapSelectTarget('drop');
  }, [dropLocation, outstationTripType, pickupLocation, tripType]);

  const requestDriver = async () => {
    if (!user) {
      showAlert('Error', 'User not loaded');
      return;
    }

    if (!pickupLocation) {
      showAlert('Missing pickup', 'Please select pickup location');
      return;
    }

    if (!isSingleLocationRoundTrip && !dropLocation) {
      showAlert('Missing destination', 'Please select destination');
      return;
    }

    if (!tripType) {
      showAlert('Select trip type', 'Please select One Way, Round Trip or Outstation');
      return;
    }

    if (tripType === TripType.ONE_WAY && pickupLocation && dropLocation) {
      const pickupInside = isPointInPolygon(pickupLocation.latitude, pickupLocation.longitude, HYDERABAD_ORR_POLYGON);
      const dropInside = isPointInPolygon(dropLocation.latitude, dropLocation.longitude, HYDERABAD_ORR_POLYGON);
      if (!pickupInside || !dropInside) {
        showAlert('Not serviceable area', 'We will be available soon. Please choose locations within Hyderabad (ORR).');
        return;
      }
    }

    if (timingMode === 'SCHEDULED') {
      if (!scheduledTime) {
        showAlert('Schedule time', 'Please select a scheduled time');
        return;
      }
      if (scheduledTime.getTime() < Date.now() + 90 * 60 * 1000) {
        showAlert('Schedule time', 'Scheduled time must be at least 1 hour 30 minutes from now');
        return;
      }
    }

    if (paymentMethod === 'WALLET' && walletBalance < estimate.total) {
      showAlert(
        'Insufficient Wallet Balance',
        `Your wallet balance (₹${walletBalance.toFixed(0)}) is less than the estimated fare (₹${estimate.total}). Please top up your wallet or choose a different payment method.`,
      );
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        pickup: {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          address: pickupAddress ?? 'Pickup location',
        },
        drop: {
          latitude: (effectiveDropLocation ?? pickupLocation).latitude,
          longitude: (effectiveDropLocation ?? pickupLocation).longitude,
          address: effectiveDropAddress ?? pickupAddress ?? 'Destination',
        },
        vehicleType,
        transmissionType,
        paymentMethod: paymentMethod === 'WALLET' ? PaymentMethod.WALLET
          : paymentMethod === 'UPI' ? PaymentMethod.UPI
            : paymentMethod === 'CARD' ? PaymentMethod.CARD
              : PaymentMethod.CASH,
        tripType,
        outstationTripType: tripType === TripType.OUTSTATION ? outstationTripType : undefined,
        requestedHours,
        scheduledTime: timingMode === 'SCHEDULED' && scheduledTime ? scheduledTime.toISOString() : undefined,
        promoCode: promoCode.trim() ? promoCode.trim() : undefined,
        requireExperienced,
      };

      const res = await api.post('/bookings', payload);
      const created = (res.data?.data ?? res.data) as any;

      const now = new Date().toISOString();

      dispatch(
        setCurrentBooking({
          id: String(created?.id ?? created?.bookingId ?? ''),
          bookingNumber: String(created?.bookingNumber ?? ''),
          status: (created?.status ?? BookingStatus.SEARCHING) as any,
          customer: user,
          pickupLocation,
          pickupAddress: pickupAddress ?? 'Pickup location',
          dropLocation: effectiveDropLocation ?? pickupLocation,
          dropAddress: effectiveDropAddress ?? pickupAddress ?? 'Destination',
          scheduledTime: created?.scheduledTime ? String(created.scheduledTime) : payload.scheduledTime,
          vehicleType,
          transmissionType: (created?.transmissionType ?? transmissionType) as any,
          tripType,
          totalAmount:
            typeof created?.totalAmount === 'number'
              ? created.totalAmount
              : Number(created?.totalAmount || estimate.total || 0),
          paymentMethod: paymentMethod === 'WALLET' ? PaymentMethod.WALLET
            : paymentMethod === 'UPI' ? PaymentMethod.UPI
              : paymentMethod === 'CARD' ? PaymentMethod.CARD
                : PaymentMethod.CASH,
          createdAt: created?.createdAt ? String(created.createdAt) : now,
          updatedAt: created?.updatedAt ? String(created.updatedAt) : now,
        })
      );

      const bookingId = String(created?.id ?? created?.bookingId ?? '');
      if (!bookingId) {
        throw new Error('Booking created but bookingId missing');
      }

      navigation.navigate('Tracking', { bookingId });
    } catch (e: any) {
      showAlert('Booking', e?.response?.data?.message || e?.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialRegion = useMemo(() => {
    const base = pickupLocation ?? dropLocation;
    if (!base) {
      return {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
  }, [pickupLocation, dropLocation]);

  // Show minimal loading UI during navigation transition
  if (!screenReady) {
    return (
      <SafeAreaView edges={['top','bottom']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#C9A84C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Ride</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#C9A84C" />
          <Text style={{ color: '#8A8A8A', marginTop: 12, fontSize: 14, fontWeight: '600' }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onPress={onMapPress}
          onMapReady={() => {
            // Fit map to show pickup + drop with proper padding
            const pts: { latitude: number; longitude: number }[] = [];
            if (pickupLocation) pts.push(pickupLocation);
            if (effectiveDropLocation && !isSingleLocationRoundTrip) pts.push(effectiveDropLocation);
            if (pts.length >= 2) {
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(pts, {
                  edgePadding: { top: 40, bottom: 40, left: 40, right: 40 },
                  animated: true,
                });
              }, 400);
            }
          }}
        >
          {pickupLocation ? (
            <Marker coordinate={pickupLocation} pinColor="#10b981" title="Pickup" zIndex={10} />
          ) : null}
          {effectiveDropLocation && !isSingleLocationRoundTrip ? (
            <Marker coordinate={effectiveDropLocation} pinColor="#ef4444" title="Drop" zIndex={10} />
          ) : null}
          {routeInfo?.polyline?.length ? (
            <Polyline coordinates={routeInfo.polyline} strokeColor="#C9A84C" strokeWidth={4} />
          ) : null}
          {nearbyDrivers.map((d) => {
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
              >
                <Image
                  source={CAR_IMAGE}
                  style={{ width: 22, height: 22 }}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              </Marker>
            );
          })}
        </MapView>
        <View style={styles.mapTopBar}>
          <Text style={styles.mapHint} numberOfLines={1}>
            Tap map to set {isSingleLocationRoundTrip ? 'Pickup' : mapSelectTarget === 'pickup' ? 'Pickup' : 'Drop'}
          </Text>
          <TouchableOpacity style={styles.mapLocateIcon} onPress={useCurrentLocation}>
            <Icon name="crosshairs-gps" size={18} color="#C9A84C" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapSelectRow}>
          <TouchableOpacity
            style={[styles.mapSelectChip, styles.mapSelectChipLeft, mapSelectTarget === 'pickup' ? styles.mapSelectChipActive : null]}
            onPress={() => setMapSelectTarget('pickup')}
          >
            <Text style={[styles.mapSelectChipText, mapSelectTarget === 'pickup' ? styles.mapSelectChipTextActive : null]}>
              Pickup
            </Text>
          </TouchableOpacity>
          {!isSingleLocationRoundTrip ? (
            <TouchableOpacity
              style={[styles.mapSelectChip, mapSelectTarget === 'drop' ? styles.mapSelectChipActive : null]}
              onPress={() => setMapSelectTarget('drop')}
            >
              <Text style={[styles.mapSelectChipText, mapSelectTarget === 'drop' ? styles.mapSelectChipTextActive : null]}>
                Drop
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isLoadingRoute || isPicking ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="small" color="#C9A84C" />
            <Text style={styles.mapLoadingText}>{isPicking ? 'Updating...' : 'Loading route...'}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sheetWrap}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          {/* ── Pickup & Drop locations (top for easy access) ── */}
          <View style={styles.addressCard}>
            <TouchableOpacity
              style={styles.addressRow}
              onPress={() => {
                setMapSelectTarget('pickup');
                navigation.navigate('LocationSearch', { target: 'pickup', initialValue: pickupAddress ?? '' });
              }}
            >
              <Icon name="circle" size={12} color="#10b981" />
              <Text style={styles.addressText} numberOfLines={1}>
                {pickupAddress ?? 'Search pickup location'}
              </Text>
              <Icon name="magnify" size={18} color={G.accent} />
            </TouchableOpacity>
            {!isSingleLocationRoundTrip ? (
              <>
                <View style={styles.addressDivider} />
                <TouchableOpacity
                  style={styles.addressRow}
                  onPress={() => {
                    setMapSelectTarget('drop');
                    navigation.navigate('LocationSearch', { target: 'drop', initialValue: dropAddress ?? '' });
                  }}
                >
                  <Icon name="map-marker" size={12} color="#ef4444" />
                  <Text style={[styles.addressText, !dropAddress && { color: G.accent }]} numberOfLines={1}>
                    {dropAddress ?? 'Search drop location'}
                  </Text>
                  <Icon name="magnify" size={18} color={G.accent} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="map-marker-distance" size={18} color="#8A8A8A" />
              <Text style={styles.metaText}>{routeInfo ? `${estimate.distanceKm.toFixed(1)} km` : '—'}</Text>
            </View>
            <View style={[styles.metaItem, styles.metaItemMid]}>
              <Icon name="clock-outline" size={18} color="#8A8A8A" />
              <Text style={styles.metaText}>{routeInfo ? `${Math.round(estimate.durationMin)} min` : '—'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="cash" size={18} color="#8A8A8A" />
              <Text style={styles.metaText}>₹{estimate.total}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>When</Text>
          <View style={styles.tripRow}>
            <TouchableOpacity
              onPress={() => setTimingMode('NOW')}
              style={[styles.tripPill, timingMode === 'NOW' ? styles.tripPillActive : styles.tripPillInactive]}
            >
              <Text style={[styles.tripText, timingMode === 'NOW' ? styles.tripTextActive : styles.tripTextInactive]}>Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setTimingMode('SCHEDULED');
                setPendingScheduleTime(scheduledTime ?? new Date(minScheduledTime.getTime()));
                setShowScheduleModal(true);
              }}
              style={[styles.tripPill, timingMode === 'SCHEDULED' ? styles.tripPillActive : styles.tripPillInactive]}
            >
              <Text style={[styles.tripText, timingMode === 'SCHEDULED' ? styles.tripTextActive : styles.tripTextInactive]}>Schedule</Text>
            </TouchableOpacity>
          </View>

          {timingMode === 'SCHEDULED' ? (
            <TouchableOpacity
              style={[styles.promoBtn, { marginTop: 8 }]}
              onPress={() => {
                setPendingScheduleTime(scheduledTime ?? new Date(minScheduledTime.getTime()));
                setShowScheduleModal(true);
              }}
            >
              <Icon name="clock-outline" size={18} color="#C9A84C" />
              <Text style={styles.promoBtnText}>
                {scheduledTime ? formatDateTime(scheduledTime) : 'Select scheduled time'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Promo</Text>
          <View style={styles.promoRow}>
            <TouchableOpacity
              style={styles.promoBtn}
              onPress={() =>
                navigation.navigate('PromoCodes', {
                  onSelect: (code: string) => {
                    setPromoCode(code);
                    setPromoInfo(null);
                  },
                })
              }
            >
              <Icon name="ticket-percent" size={18} color="#C9A84C" />
              <Text style={styles.promoBtnText}>{promoCode ? promoCode : 'Select promo code'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.promoApply}
              onPress={async () => {
                const code = promoCode.trim();
                if (!code) {
                  showAlert('Promo', 'Select a promo code first');
                  return;
                }
                try {
                  const res = await validatePromoCode(code, estimate.total);
                  setPromoInfo({ code: res.code, discountAmount: res.discountAmount, finalAmount: res.finalAmount });
                  showAlert('Promo', `Applied. Discount: ₹${res.discountAmount}`);
                } catch (e: any) {
                  setPromoInfo(null);
                  showAlert('Promo', e?.message || 'Invalid promo code');
                }
              }}
            >
              <Text style={styles.promoApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {promoInfo ? (
            <View style={styles.promoInfoCard}>
              <Text style={styles.promoInfoText}>Discount: ₹{promoInfo.discountAmount.toFixed(0)}</Text>
              <Text style={styles.promoInfoText}>Payable: ₹{promoInfo.finalAmount.toFixed(0)}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Car Type</Text>
          <View style={styles.tripRow}>
            {([VehicleType.CAR, VehicleType.SEDAN, VehicleType.HATCHBACK, VehicleType.SUV, VehicleType.LUXURY] as const).map((t) => {
              const active = vehicleType === t;
              const label =
                t === VehicleType.CAR
                  ? 'Car'
                  : t === VehicleType.SEDAN
                    ? 'Sedan'
                    : t === VehicleType.HATCHBACK
                      ? 'Hatch'
                      : t === VehicleType.SUV
                        ? 'SUV'
                        : 'Luxury';
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setVehicleType(t)}
                  style={[styles.tripPill, active ? styles.tripPillActive : styles.tripPillInactive]}
                >
                  <Text style={[styles.tripText, active ? styles.tripTextActive : styles.tripTextInactive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Transmission</Text>
          <View style={styles.tripRow}>
            {[TransmissionType.MANUAL, TransmissionType.AUTOMATIC].map((t) => {
              const active = transmissionType === t;
              const label = t === TransmissionType.MANUAL ? 'Manual' : 'Automatic';
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTransmissionType(t)}
                  style={[styles.tripPill, active ? styles.tripPillActive : styles.tripPillInactive]}
                >
                  <Text style={[styles.tripText, active ? styles.tripTextActive : styles.tripTextInactive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Trip Type</Text>
          <View style={styles.tripRow}>
            {[TripType.ONE_WAY, TripType.ROUND_TRIP, TripType.OUTSTATION].map((t) => {
              const active = tripType === t;
              const label = t === TripType.ONE_WAY ? 'One Way' : t === TripType.ROUND_TRIP ? 'Round Trip' : 'Outstation';
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    setTripType(t);
                    if (t === TripType.OUTSTATION) {
                      setRequestedHours(12);
                    }
                  }}
                  style={[styles.tripPill, active ? styles.tripPillActive : styles.tripPillInactive]}
                >
                  <Text style={[styles.tripText, active ? styles.tripTextActive : styles.tripTextInactive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tripType === TripType.OUTSTATION ? (
            <View style={styles.tripRow}>
              {([
                { key: 'ROUND_TRIP', label: 'Round Trip' },
                { key: 'ONE_WAY', label: 'One Way Trip' },
              ] as const).map((opt) => {
                const active = outstationTripType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      setOutstationTripType(opt.key);
                      setRequestedHours(12);
                      if (opt.key === 'ROUND_TRIP') setMapSelectTarget('pickup');
                    }}
                    style={[styles.tripPill, active ? styles.tripPillActive : styles.tripPillInactive]}
                  >
                    <Text style={[styles.tripText, active ? styles.tripTextActive : styles.tripTextInactive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{tripType === TripType.OUTSTATION ? 'Estimated Usage' : 'Hours'}</Text>
          {tripType === TripType.OUTSTATION ? (
            <View style={styles.tripRow}>
              {(outstationTripType === 'ROUND_TRIP'
                ? [
                  { h: 12, label: '12\nHrs' },
                  { h: 16, label: '16\nHrs' },
                  { h: 20, label: '20\nHrs' },
                  { h: 24, label: '1\nDay' },
                  { h: 48, label: '2\nDays' },
                  { h: 72, label: '3\nDays' },
                  { h: 96, label: '4\nDays' },
                  { h: 120, label: '5\nDays' },
                ]
                : [
                  { h: 12, label: '12\nHrs' },
                  { h: 14, label: '14\nHrs' },
                  { h: 16, label: '16\nHrs' },
                  { h: 18, label: '18\nHrs' },
                ]
              ).map((opt) => {
                const active = Math.round(requestedHours || 12) === opt.h;
                return (
                  <TouchableOpacity
                    key={String(opt.h)}
                    onPress={() => setRequestedHours(opt.h)}
                    style={[styles.tripPill, active ? styles.tripPillActive : styles.tripPillInactive]}
                  >
                    <Text style={[styles.tripText, active ? styles.tripTextActive : styles.tripTextInactive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.hoursRow}>
              <TouchableOpacity
                style={styles.hoursBtn}
                onPress={() => {
                  if (tripType === TripType.ONE_WAY) {
                    const idx = LOCAL_PACKAGES.indexOf(Math.max(1, Math.round(requestedHours || 1)));
                    const next = idx <= 0 ? LOCAL_PACKAGES[0] : LOCAL_PACKAGES[idx - 1];
                    setRequestedHours(next);
                    return;
                  }
                  setRequestedHours((h) => Math.max(1, Number(h || 1) - 1));
                }}
              >
                <Text style={styles.hoursBtnText}>-</Text>
              </TouchableOpacity>
              <View style={styles.hoursValue}>
                <Text style={styles.hoursValueText}>
                  {tripType === TripType.ONE_WAY
                    ? `${(estimate as any).packageHours || 1} hr package`
                    : `${Math.max(1, Math.round(requestedHours || 1))} hr`}
                </Text>
                <Text style={styles.hoursHintText}>{estimate.label}</Text>
              </View>
              <TouchableOpacity
                style={styles.hoursBtn}
                onPress={() => {
                  if (tripType === TripType.ONE_WAY) {
                    const idx = LOCAL_PACKAGES.indexOf(Math.max(1, Math.round(requestedHours || 1)));
                    const next =
                      idx >= LOCAL_PACKAGES.length - 1 ? LOCAL_PACKAGES[LOCAL_PACKAGES.length - 1] : LOCAL_PACKAGES[idx + 1];
                    setRequestedHours(next);
                    return;
                  }
                  setRequestedHours((h) => Math.min(12, Number(h || 1) + 1));
                }}
              >
                <Text style={styles.hoursBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}

          {tripType === TripType.OUTSTATION ? (
            <Text style={[styles.promoBtnText, { marginTop: 6, color: '#CCCCCC' }]}>
              Food and accommodation must be provided for driver
            </Text>
          ) : null}

          {tripType === TripType.OUTSTATION ? (
            <TouchableOpacity
              onPress={() => {
                if (outstationTripType === 'ROUND_TRIP') {
                  showAlert('Outstation Charges', 'Extra time is charged at ₹60/hr only if trip exceeds the selected package hours.');
                  return;
                }
                showAlert(
                  'Outstation Charges',
                  'One-way charge applies only after 200 km from pickup: ₹6/km above 200 km. Extra time is charged at ₹99/hr only if trip exceeds the selected package hours.'
                );
              }}
              style={{ marginTop: 8 }}
            >
              <Text style={[styles.promoBtnText, { color: G.accent, fontWeight: '700' }]}>View charges details</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.toggleRow, requireExperienced && styles.toggleRowActive]}
            onPress={() => setRequireExperienced((prev) => !prev)}
          >
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleMainText}>Hire Experienced Driver</Text>
              <Text style={styles.toggleSubText}>Top-rated drivers for your journey (+₹75)</Text>
            </View>
            <View style={[styles.checkboxContainer, requireExperienced && styles.checkboxActive]}>
              {requireExperienced && <Icon name="check" size={14} color="#ffffff" />}
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Payment</Text>
          <PaymentMethodSelector
            selected={paymentMethod}
            onSelect={setPaymentMethod}
            walletBalance={walletBalance}
          />

          <View style={styles.fareCardPro}>
            <View style={styles.fareHeaderPro}>
              <View>
                <Text style={styles.fareHeaderLabel}>Estimated Fare</Text>
                <Text style={styles.fareHeaderTotal}>
                  ₹{(() => {
                    let total = estimate.total;
                    if (promoInfo) total = promoInfo.finalAmount;
                    if (discountPreview && discountPreview.totalDiscount > 0) {
                      total = Math.max(0, total - discountPreview.totalDiscount);
                    }
                    return Math.round(total);
                  })()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={styles.fareHeaderBadge}>
                  <Icon name="shield-check" size={14} color="#10b981" />
                  <Text style={styles.fareHeaderBadgeText}>No surge pricing</Text>
                </View>
                {discountPreview?.isPremium ? (
                  <View style={[styles.fareHeaderBadge, { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: G.accent }]}>
                    <Icon name="star" size={14} color="#C9A84C" />
                    <Text style={[styles.fareHeaderBadgeText, { color: G.accent }]}>Premium Member</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.fareBreakdownPro}>
              {tripType === TripType.ONE_WAY ? (
                <>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Package</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).packagePrice || 0}</Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>One-way charge</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).oneWayCharge || 0}</Text>
                  </View>
                  {(estimate as any).extras ? (
                    <>
                      <View style={styles.fareRow}>
                        <Text style={styles.fareLabel}>Extra minutes (after limit)</Text>
                        <Text style={styles.fareValue}>₹{(estimate as any).extraMinuteCharge || 0}</Text>
                      </View>
                      <View style={styles.fareRow}>
                        <Text style={styles.fareLabel}>Extra distance (after limit)</Text>
                        <Text style={styles.fareValue}>₹{(estimate as any).extraKmCharge || 0}</Text>
                      </View>
                    </>
                  ) : null}
                </>
              ) : tripType === TripType.ROUND_TRIP ? (
                <>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Package</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).packagePrice || 0}</Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Extras</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).extras || 0}</Text>
                  </View>
                </>
              ) : tripType === TripType.OUTSTATION ? (
                <>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Package</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).packagePrice || 0}</Text>
                  </View>
                  {outstationTripType === 'ONE_WAY' && Number((estimate as any).oneWayCharge || 0) > 0 ? (
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>One-way charge</Text>
                      <Text style={styles.fareValue}>₹{(estimate as any).oneWayCharge || 0}</Text>
                    </View>
                  ) : null}
                  {Number((estimate as any).extras || 0) > 0 ? (
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>Extras</Text>
                      <Text style={styles.fareValue}>₹{(estimate as any).extras || 0}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Base</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).baseFare || 0}</Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Extras</Text>
                    <Text style={styles.fareValue}>₹{(estimate as any).extras || 0}</Text>
                  </View>
                </>
              )}
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Subtotal</Text>
                <Text style={styles.fareValue}>₹{estimate.subtotal}</Text>
              </View>
              {Number((estimate as any).experiencedFee || 0) > 0 ? (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Experienced Driver Fee</Text>
                  <Text style={styles.fareValue}>₹{(estimate as any).experiencedFee}</Text>
                </View>
              ) : null}
              {Number((estimate as any).nightCharge || 0) > 0 ? (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Night Charge (10pm-6am)</Text>
                  <Text style={styles.fareValue}>₹{(estimate as any).nightCharge || 0}</Text>
                </View>
              ) : null}
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Taxes & Fee</Text>
                <Text style={styles.fareValue}>₹{(estimate as any).taxesFee || 0}</Text>
              </View>
              {promoInfo ? (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Promo Discount</Text>
                  <Text style={[styles.fareValue, { color: '#10b981' }]}>-₹{promoInfo.discountAmount.toFixed(0)}</Text>
                </View>
              ) : null}
              {discountPreview && discountPreview.membershipDiscount > 0 ? (
                <View style={styles.fareRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                    <Icon name="crown" size={14} color="#C9A84C" />
                    <Text style={styles.fareLabel}>{discountPreview.membershipLabel}</Text>
                  </View>
                  <Text style={[styles.fareValue, { color: '#10b981' }]}>-₹{discountPreview.membershipDiscount}</Text>
                </View>
              ) : null}
              {discountPreview && discountPreview.streakDiscount > 0 ? (
                <View style={styles.fareRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                    <Icon name="fire" size={14} color="#f59e0b" />
                    <Text style={styles.fareLabel}>{discountPreview.streakLabel}</Text>
                  </View>
                  <Text style={[styles.fareValue, { color: '#10b981' }]}>-₹{discountPreview.streakDiscount}</Text>
                </View>
              ) : null}
              {discountPreview?.isPremium && requireExperienced ? (
                <View style={[styles.fareRow, { backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 8, padding: 8, marginVertical: 4 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                    <Icon name="star-circle" size={14} color="#C9A84C" />
                    <Text style={[styles.fareLabel, { color: G.accent, fontWeight: '700' }]}>Experienced driver included</Text>
                  </View>
                  <Text style={[styles.fareValue, { color: G.accent }]}>FREE</Text>
                </View>
              ) : null}
              <View style={[styles.fareRow, styles.fareRowTotal]}>
                <Text style={styles.fareTotalLabel}>Total</Text>
                <Text style={styles.fareTotalValue}>₹{(() => {
                    let total = estimate.total;
                    if (promoInfo) total = promoInfo.finalAmount;
                    if (discountPreview && discountPreview.totalDiscount > 0) {
                      total = Math.max(0, total - discountPreview.totalDiscount);
                    }
                    return Math.round(total);
                  })()}</Text>
              </View>
            </View>
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, !canConfirm || !isServiceable ? styles.ctaDisabled : null]}
            disabled={!canConfirm || !isServiceable || isSubmitting}
            onPress={requestDriver}
          >
            <Text style={styles.ctaText}>{isSubmitting ? 'Requesting…' : 'Request Driver'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.scheduleOverlay}>
          <View style={styles.scheduleModal}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleTitle}>When do you need driver?</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={styles.scheduleClose}>
                <Icon name="close" size={18} color="#C9A84C" />
              </TouchableOpacity>
            </View>

            <Text style={styles.schedulePickupTime}>Pickup Time: {formatScheduleButtonTime(schedulePickerDate)}</Text>

            <View style={styles.schedulePickerWrap}>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={schedulePickerDate}
                  onChange={(_event: DateTimePickerEvent, date?: Date) => {
                    if (date) setPendingScheduleTime(date);
                  }}
                  mode="datetime"
                  display="spinner"
                  minimumDate={minScheduledTime}
                  minuteInterval={5}
                  themeVariant="dark"
                  textColor="#FFFFFF"
                />
              ) : (
                <>
                  <View style={styles.scheduleAndroidRow}>
                    <TouchableOpacity
                      style={styles.scheduleAndroidBtn}
                      onPress={() => setAndroidPickerMode(androidPickerMode === 'date' ? null : 'date')}
                    >
                      <Icon name="calendar" size={18} color="#C9A84C" />
                      <Text style={styles.scheduleAndroidBtnText}>
                        {schedulePickerDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.scheduleAndroidBtn}
                      onPress={() => setAndroidPickerMode(androidPickerMode === 'time' ? null : 'time')}
                    >
                      <Icon name="clock-outline" size={18} color="#C9A84C" />
                      <Text style={styles.scheduleAndroidBtnText}>
                        {schedulePickerDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {androidPickerMode ? (
                    <DateTimePicker
                      value={schedulePickerDate}
                      mode={androidPickerMode}
                      display="spinner"
                      minimumDate={minScheduledTime}
                      minuteInterval={5}
                      is24Hour={false}
                      themeVariant="dark"
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        if ((event as any)?.type === 'dismissed') {
                          setAndroidPickerMode(null);
                          return;
                        }

                        if (!date) {
                          setAndroidPickerMode(null);
                          return;
                        }

                        if (androidPickerMode === 'date') {
                          const next = new Date(schedulePickerDate.getTime());
                          next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                          setPendingScheduleTime(next);
                        } else {
                          const next = new Date(schedulePickerDate.getTime());
                          next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                          setPendingScheduleTime(next);
                        }

                        setAndroidPickerMode(null);
                      }}
                    />
                  ) : null}
                </>
              )}
            </View>

            {!isScheduleSelectionValid ? (
              <Text style={styles.scheduleError}>Select a time at least 1 hour 30 minutes from now</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.cta, { marginTop: 12 }, !isScheduleSelectionValid ? styles.ctaDisabled : null]}
              disabled={!isScheduleSelectionValid}
              onPress={() => {
                if (!isScheduleSelectionValid) return;
                setScheduledTime(schedulePickerDate);
                setTimingMode('SCHEDULED');
                setShowScheduleModal(false);
              }}
            >
              <Text style={styles.ctaText}>Schedule for {formatScheduleButtonTime(schedulePickerDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: G.glass1,
    borderBottomWidth: 1,
    borderBottomColor: G.border2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: G.glass2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: G.textPrimary },
  mapWrap: { height: 260, backgroundColor: G.glass2 },
  nearbyDriverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },
  mapTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapHint: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: G.textPrimary,
    fontWeight: '700',
  },
  mapLocateIcon: {
    marginLeft: 10,
    backgroundColor: 'rgba(10,10,10,0.85)',
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSelectRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
  },
  mapSelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center',
  },
  mapSelectChipLeft: { marginRight: 8 },
  mapSelectChipActive: { backgroundColor: G.accent, borderColor: G.accent },
  mapSelectChipText: { color: G.textPrimary, fontWeight: '800' },
  mapSelectChipTextActive: { color: G.textOnAccent },
  mapLoading: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapLoadingText: { marginLeft: 8, color: G.textPrimary, fontWeight: '600' },
  sheet: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sheetContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetWrap: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: G.glass1,
    borderTopWidth: 1,
    borderTopColor: G.border2,
  },
  addressCard: {
    backgroundColor: G.glass3,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: G.border3,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  addressText: { flex: 1, marginLeft: 10, color: G.textPrimary, fontWeight: '600', fontSize: 14 },
  addressDivider: { height: 1, backgroundColor: G.border2, marginVertical: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: G.glass2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border2,
  },
  metaItemMid: { marginHorizontal: 10 },
  metaText: { marginLeft: 8, color: G.textPrimary, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: G.textPrimary, marginLeft: 4 },
  tripRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  tripPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 12,
  },
  tripPillActive: { backgroundColor: G.glass3, borderColor: G.borderAccent },
  tripPillInactive: { backgroundColor: G.glass1, borderColor: G.border2 },
  tripText: { fontWeight: '700', fontSize: 12 },
  tripTextActive: { color: G.accent },
  tripTextInactive: { color: G.textSecondary },
  cta: {
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: G.textPrimary, fontWeight: '800', fontSize: 16 },
  promoRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 12 },
  promoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border3,
    backgroundColor: G.bg,
  },
  promoBtnText: { color: G.textPrimary, fontWeight: '800' },
  promoApply: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: G.glass3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyText: { color: G.textPrimary, fontWeight: '900' },
  promoInfoCard: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    padding: 14,
    marginBottom: 12,
  },
  promoInfoText: { color: '#10b981', fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: G.glass1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border2,
    marginTop: 12,
    marginBottom: 12,
  },
  toggleRowActive: {
    borderColor: G.borderAccent,
    backgroundColor: G.glass2,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 10,
  },
  toggleMainText: {
    color: G.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  toggleSubText: {
    color: G.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: G.border3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.bg,
  },
  checkboxActive: {
    backgroundColor: G.glass3,
    borderColor: G.textPrimary,
  },

  scheduleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  scheduleModal: {
    width: '100%',
    backgroundColor: G.bg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: G.border3,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleTitle: { fontSize: 16, fontWeight: '900', color: G.textPrimary },
  scheduleClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.border3,
  },
  schedulePickupTime: {
    marginTop: 10,
    color: G.textSecondary,
    fontWeight: '800',
    textAlign: 'center',
  },
  schedulePickerWrap: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border3,
    paddingVertical: 6,
  },
  scheduleAndroidRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  scheduleAndroidBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.border3,
  },
  scheduleAndroidBtnText: {
    color: G.textPrimary,
    fontWeight: '900',
  },
  scheduleError: {
    marginTop: 10,
    textAlign: 'center',
    color: '#FF4444',
    fontWeight: '800',
  },

  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: G.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border3,
    padding: 10,
  },
  hoursBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: G.glass3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursBtnText: { color: G.textPrimary, fontWeight: '900', fontSize: 18 },
  hoursValue: { flex: 1, alignItems: 'center' },
  hoursValueText: { color: G.textPrimary, fontWeight: '900', fontSize: 16 },
  hoursHintText: { marginTop: 2, color: G.textSecondary, fontWeight: '700', fontSize: 12 },

  fareCardPro: {
    backgroundColor: G.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border3,
    marginTop: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  fareHeaderPro: {
    backgroundColor: G.glass3,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareHeaderLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  fareHeaderTotal: {
    fontSize: 28,
    fontWeight: '900',
    color: G.textPrimary,
    marginTop: 2,
  },
  fareHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  fareHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  fareBreakdownPro: {
    padding: 16,
  },
  fareCard: {
    backgroundColor: G.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border3,
    padding: 12,
    marginBottom: 10,
  },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  fareRowTotal: { paddingTop: 12, marginTop: 8, borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.3)' },
  fareLabel: { color: G.textSecondary, fontWeight: '600', fontSize: 13 },
  fareValue: { color: G.textPrimary, fontWeight: '700', fontSize: 13 },
  fareTotalLabel: { color: G.textPrimary, fontWeight: '800', fontSize: 15 },
  fareTotalValue: { color: G.accent, fontWeight: '900', fontSize: 18 },
});

export default RideConfirmScreen;
