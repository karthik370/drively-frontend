import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { removeBookingRequest, setCurrentBooking } from '../../redux/slices/bookingSlice';
import { setDropAddress, setDropLocation, setPickupAddress, setPickupLocation } from '../../redux/slices/locationSlice';
import socketService from '../../services/socketService';
import { acceptBooking, calculateRoute } from '../../services/api';
import { BookingStatus, PaymentMethod, VehicleType } from '../../types';
import type { BookingRequest } from '../../components/driver/BookingRequestCard';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const getInitialRegion = (lat: number, lng: number): Region => ({
  latitude: lat,
  longitude: lng,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
});

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


const DriverBookingRequestDetailsScreen = ({ navigation, route }: any) => {
  const dispatch = useAppDispatch();
  const driverLocation = useAppSelector((s) => s.location.currentLocation);
  const bookingRequests = useAppSelector((s) => s.booking.bookingRequests) as BookingRequest[];

  const bookingId = String(route?.params?.bookingId ?? '');
  const request = useMemo(() => bookingRequests.find((r) => String(r.id) === bookingId) || null, [bookingId, bookingRequests]);

  const pickupLat = Number(request?.pickup?.latitude);
  const pickupLng = Number(request?.pickup?.longitude);
  const dropLat = Number(request?.drop?.latitude);
  const dropLng = Number(request?.drop?.longitude);

  const mapRef = useRef<MapView | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [pickupEtaMin, setPickupEtaMin] = useState<number | null>(null);
  const [pickupDistanceKm, setPickupDistanceKm] = useState<number | null>(null);
  const pickupRouteKeyRef = useRef<string>('');

  // Android needs tracksViewChanges=true initially to capture View-based marker bitmaps.
  // After 1s, switch to false to stop per-frame re-rendering (eliminates flickering).
  const [markerReady, setMarkerReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMarkerReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

  // Cache coords in refs so markers persist even after Redux clears the request
  const cachedPickupRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const cachedDropRef = useRef<{ latitude: number; longitude: number } | null>(null);
  if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
    cachedPickupRef.current = { latitude: pickupLat, longitude: pickupLng };
  }
  if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
    cachedDropRef.current = { latitude: dropLat, longitude: dropLng };
  }
  const stablePickup = cachedPickupRef.current;
  const stableDrop = cachedDropRef.current;



  useEffect(() => {
    if (!request) return;
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return;
    try {
      mapRef.current?.animateToRegion(getInitialRegion(pickupLat, pickupLng), 250);
    } catch { }
  }, [pickupLat, pickupLng, request]);

  useEffect(() => {
    if (!request || !driverLocation) return;
    if (!Number.isFinite(driverLocation.latitude) || !Number.isFinite(driverLocation.longitude)) return;
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return;

    const key = `${driverLocation.latitude.toFixed(5)},${driverLocation.longitude.toFixed(5)}->${pickupLat.toFixed(5)},${pickupLng.toFixed(5)}`;
    if (pickupRouteKeyRef.current === key) return;
    pickupRouteKeyRef.current = key;

    let active = true;
    void (async () => {
      try {
        const res = await calculateRoute(
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: pickupLat, longitude: pickupLng }
        );
        if (!active) return;
        const durationSeconds = typeof (res as any)?.duration === 'number' ? Number((res as any).duration) : NaN;
        const distanceMeters = typeof (res as any)?.distance === 'number' ? Number((res as any).distance) : NaN;
        setPickupEtaMin(Number.isFinite(durationSeconds) ? Math.max(1, Math.round(durationSeconds / 60)) : null);
        setPickupDistanceKm(Number.isFinite(distanceMeters) ? Math.max(0, Math.round((distanceMeters / 1000) * 10) / 10) : null);
      } catch {
        if (!active) return;
        setPickupEtaMin(null);
        setPickupDistanceKm(null);
      }
    })();
    return () => { active = false; };
  }, [driverLocation, pickupLat, pickupLng, request]);

  const meta = useMemo(() => {
    const t = String(request?.tripType || '').toUpperCase();
    const sub = String(request?.outstationTripType || '').toUpperCase();
    const tripTypeLabel = (() => {
      if (t === 'ROUND_TRIP') return 'Round Trip';
      if (t === 'OUTSTATION') {
        if (sub === 'ONE_WAY') return 'Outstation • One Way';
        if (sub === 'ROUND_TRIP') return 'Outstation • Round Trip';
        return 'Outstation';
      }
      return 'One Way';
    })();
    const h = Number((request as any)?.requestedHours);
    const hoursLabel = Number.isFinite(h) && h > 0 ? `${Math.round(h)} hr` : null;
    return {
      tripTypeLabel,
      hoursLabel,
      vehicle: `${String(request?.vehicleType || 'CAR')}${request?.transmissionType ? ` • ${String(request.transmissionType)}` : ''}`,
    };
  }, [request]);

  const pickupMetrics = useMemo(() => {
    if (!request || !driverLocation) return { distanceKm: null as number | null, etaMin: null as number | null };
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return { distanceKm: null as number | null, etaMin: null as number | null };
    const distanceKm = haversineKm(
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      { latitude: pickupLat, longitude: pickupLng }
    );
    const etaFromRoute = typeof pickupEtaMin === 'number' ? pickupEtaMin : null;
    const distFromRoute = typeof pickupDistanceKm === 'number' ? pickupDistanceKm : null;
    const etaMin = etaFromRoute !== null ? etaFromRoute : Math.max(1, Math.round((distanceKm / 30) * 60));
    const distKm = distFromRoute !== null ? distFromRoute : distanceKm;
    return { distanceKm: distKm, etaMin };
  }, [driverLocation, pickupDistanceKm, pickupEtaMin, pickupLat, pickupLng, request]);

  const onAccept = async () => {
    if (!bookingId || accepting) return;
    try {
      setAccepting(true);
      // acceptBooking returns { booking: {...} } — unwrap it
      const result = await acceptBooking(bookingId, '');
      const raw = (result as any)?.booking ?? result;
      try { socketService.joinBooking(bookingId); } catch { }
      const now = new Date().toISOString();
      dispatch(removeBookingRequest(bookingId));

      const pLat = Number((raw as any)?.pickupLocationLat ?? (raw as any)?.pickupLatitude ?? (raw as any)?.pickup?.latitude);
      const pLng = Number((raw as any)?.pickupLocationLng ?? (raw as any)?.pickupLongitude ?? (raw as any)?.pickup?.longitude);
      if (Number.isFinite(pLat) && Number.isFinite(pLng)) dispatch(setPickupLocation({ latitude: pLat, longitude: pLng }));
      dispatch(setPickupAddress(typeof (raw as any)?.pickupAddress === 'string' ? (raw as any).pickupAddress : null));

      const dLatRaw = (raw as any)?.dropLocationLat ?? (raw as any)?.dropLatitude ?? (raw as any)?.drop?.latitude;
      const dLngRaw = (raw as any)?.dropLocationLng ?? (raw as any)?.dropLongitude ?? (raw as any)?.drop?.longitude;
      const dLat = dLatRaw !== undefined && dLatRaw !== null ? Number(dLatRaw) : NaN;
      const dLng = dLngRaw !== undefined && dLngRaw !== null ? Number(dLngRaw) : NaN;
      if (Number.isFinite(dLat) && Number.isFinite(dLng)) dispatch(setDropLocation({ latitude: dLat, longitude: dLng }));
      dispatch(setDropAddress(typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : null));

      dispatch(setCurrentBooking({
        id: String((raw as any)?.id ?? bookingId),
        bookingNumber: String((raw as any)?.bookingNumber ?? ''),
        status: ((raw as any)?.status ?? BookingStatus.ACCEPTED) as any,
        customer: (raw as any)?.customer as any,
        driver: (raw as any)?.driver as any,
        otp: (raw as any)?.otp ?? null,
        pickupLocation: { latitude: Number.isFinite(pLat) ? pLat : 0, longitude: Number.isFinite(pLng) ? pLng : 0 },
        pickupAddress: String((raw as any)?.pickupAddress ?? 'Pickup'),
        dropLocation: Number.isFinite(dLat) && Number.isFinite(dLng) ? { latitude: dLat, longitude: dLng } : undefined,
        dropAddress: typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : undefined,
        scheduledTime: (raw as any)?.scheduledTime ? String((raw as any).scheduledTime) : undefined,
        vehicleType: ((raw as any)?.vehicleType ?? VehicleType.CAR) as any,
        transmissionType: ((raw as any)?.transmissionType ?? undefined) as any,
        tripType: (raw as any)?.tripType as any,
        totalAmount: typeof (raw as any)?.totalAmount === 'number' ? (raw as any).totalAmount : Number((raw as any)?.totalAmount || 0),
        paymentMethod: ((raw as any)?.paymentMethod ?? PaymentMethod.CASH) as any,
        createdAt: (raw as any)?.createdAt ? String((raw as any).createdAt) : now,
        updatedAt: (raw as any)?.updatedAt ? String((raw as any).updatedAt) : now,
      }));

      // Navigate to Tracking IMMEDIATELY for ALL bookings (including scheduled)
      navigation.navigate('Tracking', { bookingId });
    } catch (e: any) {
      showAlert('Accept booking', e?.message || 'Failed to accept booking');
    } finally {
      setAccepting(false);
    }
  };

  const onReject = () => {
    if (!bookingId) return;
    showAlert('Reject booking?', 'Do you want to reject this booking request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          try {
            socketService.emit('booking:reject', { bookingId });
            dispatch(removeBookingRequest(bookingId));
            navigation.goBack();
          } catch {
            showAlert('Error', 'Failed to reject booking');
          }
        },
      },
    ]);
  };

  const initialRegion = useMemo(() => {
    if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) return getInitialRegion(pickupLat, pickupLng);
    if (driverLocation && Number.isFinite(driverLocation.latitude) && Number.isFinite(driverLocation.longitude))
      return getInitialRegion(driverLocation.latitude, driverLocation.longitude);
    return getInitialRegion(20.5937, 78.9629);
  }, [driverLocation, pickupLat, pickupLng]);

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#C9A84C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.empty}>
          <Icon name="car-off" size={40} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Map section */}
      <View style={styles.mapWrap}>
        <MapView
          ref={(r) => { mapRef.current = r; }}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onMapReady={() => {
            // Fit map to show all markers after map is ready
            const points: { latitude: number; longitude: number }[] = [];
            if (stablePickup) points.push(stablePickup);
            if (stableDrop) points.push(stableDrop);
            if (driverLocation && Number.isFinite(driverLocation.latitude) && Number.isFinite(driverLocation.longitude)) {
              points.push({ latitude: driverLocation.latitude, longitude: driverLocation.longitude });
            }
            if (points.length >= 2) {
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(points, {
                  edgePadding: { top: 60, bottom: 80, left: 40, right: 40 },
                  animated: true,
                });
              }, 300);
            }
          }}
        >
          {/* Pickup marker */}
          {stablePickup ? (
            <Marker
              coordinate={stablePickup}
              tracksViewChanges={false}
              zIndex={5}
              title="Pickup"
              pinColor="green"
            />
          ) : null}
          {/* Drop marker */}
          {stableDrop ? (
            <Marker
              coordinate={stableDrop}
              tracksViewChanges={false}
              zIndex={5}
              title="Drop"
              pinColor="red"
            />
          ) : null}
          {/* Driver location marker — pure View, no image load delay */}
          {driverLocation && Number.isFinite(driverLocation.latitude) && Number.isFinite(driverLocation.longitude) ? (
            <Marker
              coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={10}
              title="You"
              pinColor="#4285F4"
            />
          ) : null}
      </MapView>
      </View>

      {/* Details card */}
      <View style={styles.detailsWrap}>
        {/* Fare badge */}
        <View style={styles.fareRow}>
          <View style={styles.fareChip}>
            <Icon name="currency-inr" size={18} color="#16a34a" />
            <Text style={styles.fareValue}>₹{request?.fare ? Math.round(request.fare) : '—'}</Text>
          </View>
          <View style={styles.tripChip}>
            <Text style={styles.tripChipText}>{meta.tripTypeLabel}</Text>
          </View>
          {meta.hoursLabel ? (
            <View style={styles.hourChip}>
              <Icon name="clock-outline" size={13} color="#6366f1" />
              <Text style={styles.hourChipText}>{meta.hoursLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Route summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <Text style={styles.routeText} numberOfLines={2}>{request?.pickup?.address || '—'}</Text>
          </View>
          <View style={styles.routeLineVert} />
          <View style={styles.routeRow}>
            <View style={styles.routeDotRed} />
            <Text style={styles.routeText} numberOfLines={2}>{request?.drop?.address || '—'}</Text>
          </View>
        </View>

        {/* Metrics row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Icon name="map-marker-distance" size={18} color="#8A8A8A" />
            <Text style={styles.metricValue}>
              {typeof pickupMetrics.distanceKm === 'number' ? `${pickupMetrics.distanceKm.toFixed(1)} km` : '—'}
            </Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metricItem}>
            <Icon name="clock-fast" size={18} color="#8A8A8A" />
            <Text style={styles.metricValue}>
              {typeof pickupMetrics.etaMin === 'number' ? `${pickupMetrics.etaMin} min` : '—'}
            </Text>
            <Text style={styles.metricLabel}>ETA to pickup</Text>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metricItem}>
            <Icon name="car" size={18} color="#8A8A8A" />
            <Text style={styles.metricValue}>{meta.vehicle}</Text>
            <Text style={styles.metricLabel}>Vehicle</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.7}>
            <Icon name="close" size={18} color="#ef4444" />
            <Text style={styles.rejectText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, accepting ? styles.btnDisabled : null]}
            disabled={accepting}
            onPress={onAccept}
            activeOpacity={0.7}
          >
            <Icon name="check" size={18} color="#ffffff" />
            <Text style={styles.acceptText}>{accepting ? 'Accepting…' : 'Accept Ride'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Full-screen accepting overlay */}
      {accepting ? (
        <View style={styles.acceptingOverlay}>
          <ActivityIndicator size="large" color="#C9A84C" />
          <Text style={styles.acceptingText}>Accepting Ride...</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: G.bg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: G.glass2,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: G.textPrimary },

  // Map
  mapWrap: { flex: 1, backgroundColor: G.glass2 },

  // Custom markers
  markerWrap: { alignItems: 'center' },
  markerDot: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#ffffff',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  markerTriangle: {
    width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2,
  },
  driverMarker: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: G.accent,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: G.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6,
  },

  // Timer
  timerBarWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  timerBar: { height: '100%', borderRadius: 2 },
  countdownBadge: {
    position: 'absolute', top: 12, right: 12, backgroundColor: G.bg,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  countdownText: { fontSize: 16, fontWeight: '900', color: G.textPrimary },

  // Details
  detailsWrap: {
    padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', backgroundColor: G.bg,
    marginTop: -16,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12,
  },

  // Fare row
  fareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  fareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: G.glass2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  fareValue: { fontSize: 22, fontWeight: '900', color: '#16a34a' },
  tripChip: {
    backgroundColor: G.glass2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  tripChipText: { fontSize: 11, fontWeight: '800', color: G.accent },
  hourChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  hourChipText: { fontSize: 11, fontWeight: '800', color: '#6366f1' },

  // Route card
  routeCard: {
    backgroundColor: G.bgAlt, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDotGreen: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginTop: 4,
  },
  routeDotRed: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginTop: 4,
  },
  routeLineVert: {
    width: 2, height: 14, backgroundColor: G.glass3, marginLeft: 4, marginVertical: 2,
  },
  routeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#CCCCCC' },

  // Metrics
  metricsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: G.bgAlt, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricSep: { width: 1, height: 30, backgroundColor: G.glass3 },
  metricValue: { fontSize: 14, fontWeight: '800', color: G.textPrimary, marginTop: 4 },
  metricLabel: { fontSize: 10, fontWeight: '600', color: G.textMuted, marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1.5, borderColor: '#fecaca', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  rejectText: { color: '#ef4444', fontWeight: '900', fontSize: 14 },
  acceptBtn: {
    flex: 2, height: 50, borderRadius: 14, backgroundColor: '#16a34a',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    elevation: 4, shadowColor: '#16a34a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  acceptText: { color: G.textPrimary, fontWeight: '900', fontSize: 15 },
  btnDisabled: { opacity: 0.7 },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: G.textSecondary, fontWeight: '800', fontSize: 16 },

  // Accepting overlay
  acceptingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptingText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 14,
  },
});

export default DriverBookingRequestDetailsScreen;
