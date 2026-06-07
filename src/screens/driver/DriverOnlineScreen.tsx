import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawerActions } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch, Modal, Platform } from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDriverOnline } from '../../redux/slices/driverSlice';
import { addBookingRequest, clearBookingRequests, removeBookingRequest, setCurrentBooking } from '../../redux/slices/bookingSlice';
import { setDropAddress, setDropLocation, setPickupAddress, setPickupLocation } from '../../redux/slices/locationSlice';
import socketService from '../../services/socketService';
import { acceptBooking, getActiveBooking, getAvailableBookings, goOffline, goOnline } from '../../services/api';
import BookingRequestCard, { type BookingRequest } from '../../components/driver/BookingRequestCard';
import useBookingRequest from '../../hooks/useBookingRequest';
import useRealTimeLocation from '../../hooks/useRealTimeLocation';
import { BookingStatus, PaymentMethod, VehicleType } from '../../types';
import SubscriptionGate from '../../components/driver/SubscriptionGate';
import { getDriverSubscriptionStatus } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

const DriverOnlineScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const isOnline = useAppSelector((s) => s.driver.isOnline);
  const bookingRequests = useAppSelector((s) => s.booking.bookingRequests) as BookingRequest[];
  const currentBooking = useAppSelector((s) => s.booking.currentBooking);
  const driverLocation = useAppSelector((s) => s.location.currentLocation);
  const onlineToggleInFlightRef = useRef<boolean>(false);
  const permissionGrantedRef = useRef<boolean>(false); // Prevents disclosure re-show after grant
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [tripFilter, setTripFilter] = useState<'ALL' | 'ONE_WAY' | 'ROUND_TRIP' | 'OUTSTATION'>('ALL');
  const [showDisclosure, setShowDisclosure] = useState(false);
  const onlineSentRef = useRef<boolean>(false);
  const acceptingRef = useRef<string | null>(null);
  const pollInFlightRef = useRef<boolean>(false);
  const bookingRequestsRef = useRef<BookingRequest[]>([]);

  const [hasSubscription, setHasSubscription] = useState<boolean>(true); // assume true until checked
  const [subLoading, setSubLoading] = useState<boolean>(true);

  const { error: trackingError } = useRealTimeLocation(isOnline, 'foreground', activeBookingId || undefined);

  useBookingRequest();

  const fetchSubscription = useCallback(async () => {
    try {
      setSubLoading(true);
      const res = await getDriverSubscriptionStatus();
      if (res && res.status === 'ACTIVE' && !res.isExpired) {
        setHasSubscription(true);
      } else {
        setHasSubscription(false);
        // Force offline if subscription is inactive
        if (isOnline) {
          dispatch(setDriverOnline(false));
        }
      }
    } catch {
      setHasSubscription(false);
    } finally {
      setSubLoading(false);
    }
  }, [isOnline, dispatch]);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const setOnlineState = useCallback(
    async (nextOnline: boolean) => {
      if (onlineToggleInFlightRef.current) return;
      onlineToggleInFlightRef.current = true;
      // Optimistic: flip the switch IMMEDIATELY so it feels instant
      dispatch(setDriverOnline(nextOnline));
      try {
        if (nextOnline) {
          await goOnline();
        } else {
          await goOffline();
        }
      } catch (e: any) {
        // Revert on failure
        dispatch(setDriverOnline(!nextOnline));
        if (e?.message?.includes('Active subscription required') || e?.response?.status === 403) {
          setHasSubscription(false);
          showAlert('Subscription Required', 'You need an active subscription to go online.');
        } else {
          showAlert('Status', e?.message || 'Failed to update online status');
        }
      } finally {
        onlineToggleInFlightRef.current = false;
      }
    },
    [dispatch]
  );

  const handleGoOnlineWithDisclosure = async () => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        showAlert('Permission Required', 'Location permission is needed to go online.');
        setShowDisclosure(false);
        return;
      }
      
      // Background location is nice-to-have but NOT required (Expo Go doesn't support it)
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch {
        // Silently continue — background location not available in Expo Go
      }

      setShowDisclosure(false);
      permissionGrantedRef.current = true;
      await setOnlineState(true);
    } catch (e) {
      setShowDisclosure(false);
    }
  };

  const handleToggleSwitch = async (v: boolean) => {
    if (v) {
      // Skip disclosure if permissions were already confirmed this session
      if (!permissionGrantedRef.current) {
        const fgStatus = await Location.getForegroundPermissionsAsync();
        if (fgStatus.status !== 'granted') {
          setShowDisclosure(true);
          return;
        }
        permissionGrantedRef.current = true;
      }
    } else {
      // Reset when going offline so next online attempt re-checks
      permissionGrantedRef.current = false;
    }
    void setOnlineState(Boolean(v));
  };

  useEffect(() => {
    if (!isOnline) {
      dispatch(clearBookingRequests());
    }
  }, [dispatch, isOnline]);

  useEffect(() => {
    bookingRequestsRef.current = bookingRequests;
  }, [bookingRequests]);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverLocation) return;
    if (hasActiveTrip) return;

    let active = true;
    void (async () => {
      try {
        const items = await getAvailableBookings({ radiusKm: 10, limit: 25, maxAgeMinutes: 0 });
        if (!active) return;
        if (!Array.isArray(items) || items.length === 0) return;

        for (const it of items) {
          const bookingId = String((it as any)?.bookingId ?? (it as any)?.id ?? '');
          if (!bookingId) continue;
          dispatch(
            addBookingRequest({
              bookingId,
              pickup: (it as any)?.pickup,
              drop: (it as any)?.drop ?? null,
              distanceKm: (it as any)?.distanceKm,
              etaMin: (it as any)?.etaMin,
              fare: (it as any)?.fare,
              vehicleType: (it as any)?.vehicleType,
              transmissionType: (it as any)?.transmissionType,
              tripType: (it as any)?.tripType,
              outstationTripType: (it as any)?.outstationTripType,
              requestedHours: (it as any)?.requestedHours,
              scheduledTime: typeof (it as any)?.scheduledTime === 'string' ? (it as any).scheduledTime : undefined,
            })
          );
        }
      } catch {
      }
    })();

    return () => {
      active = false;
    };
  }, [dispatch, driverLocation, isOnline]);

  useEffect(() => {
    if (!isOnline) {
      onlineSentRef.current = false;
      setActiveBookingId(null);
      void (async () => {
        try {
          await socketService.connect();
          socketService.setDriverOffline();
        } catch {
        }
      })();
      return;
    }

    if (trackingError) {
      showAlert('Location', trackingError);
      void setOnlineState(false);
      return;
    }

    if (onlineSentRef.current) return;
    if (!driverLocation) return;

    void (async () => {
      try {
        await socketService.connect();
        socketService.setDriverOnline(driverLocation.latitude, driverLocation.longitude);
        onlineSentRef.current = true;
      } catch {
      }
    })();
  }, [dispatch, driverLocation, isOnline, trackingError]);

  useEffect(() => {
    if (!isOnline) return;

    let active = true;
    void (async () => {
      try {
        const booking = await getActiveBooking();
        if (!active) return;
        if (!booking || typeof booking !== 'object') return;
        if (!booking.id) return;

        const bookingId = String((booking as any).id);
        if (!bookingId) return;

        setActiveBookingId(bookingId);
        try {
          socketService.joinBooking(bookingId);
        } catch {
        }

        const pickupLat = Number((booking as any)?.pickupLocationLat ?? (booking as any)?.pickup?.latitude);
        const pickupLng = Number((booking as any)?.pickupLocationLng ?? (booking as any)?.pickup?.longitude);
        if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
          dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
        }
        dispatch(setPickupAddress(typeof (booking as any)?.pickupAddress === 'string' ? (booking as any).pickupAddress : null));

        const dropLatRaw = (booking as any)?.dropLocationLat ?? (booking as any)?.drop?.latitude;
        const dropLngRaw = (booking as any)?.dropLocationLng ?? (booking as any)?.drop?.longitude;
        const dropLat = dropLatRaw !== undefined && dropLatRaw !== null ? Number(dropLatRaw) : NaN;
        const dropLng = dropLngRaw !== undefined && dropLngRaw !== null ? Number(dropLngRaw) : NaN;
        if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
          dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
        }
        dispatch(setDropAddress(typeof (booking as any)?.dropAddress === 'string' ? (booking as any).dropAddress : null));

        dispatch(setCurrentBooking(booking as any));
      } catch {
      }
    })();

    return () => {
      active = false;
    };
  }, [dispatch, isOnline]);

  const filteredRequests = useMemo(() => {
    const selected = String(tripFilter || 'ONE_WAY').toUpperCase();
    if (selected === 'ALL') {
      return Array.isArray(bookingRequests) ? bookingRequests : [];
    }
    return (Array.isArray(bookingRequests) ? bookingRequests : []).filter((r) => {
      const t = String((r as any)?.tripType || '').toUpperCase();
      if (selected === 'OUTSTATION') {
        return t === 'OUTSTATION';
      }
      if (selected === 'ROUND_TRIP') {
        return t === 'ROUND_TRIP';
      }
      return !t || t === 'ONE_WAY';
    });
  }, [bookingRequests, tripFilter]);

  const hasRequests = isOnline && filteredRequests.length > 0;

  const scheduledLockInfo = useMemo(() => {
    const status = String((currentBooking as any)?.status ?? '');
    if (
      ![
        BookingStatus.ACCEPTED,
        BookingStatus.DRIVER_ARRIVING,
        BookingStatus.ARRIVED,
        BookingStatus.STARTED,
        BookingStatus.IN_PROGRESS,
      ].includes(status as any)
    ) {
      return null;
    }

    const raw = (currentBooking as any)?.scheduledTime ? String((currentBooking as any).scheduledTime) : null;
    if (!raw) return null;
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return null;
    if (d.getTime() <= Date.now()) return null;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hh = d.getHours();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    const label = `${dd}/${mm}/${yyyy} • ${String(hh).padStart(2, '0')}:${min} ${ampm}`;

    return { label };
  }, [currentBooking]);

  const hasActiveTrip = Boolean(
    currentBooking?.id &&
    currentBooking?.status &&
    [
      BookingStatus.REQUESTED,
      BookingStatus.SEARCHING,
      BookingStatus.ACCEPTED,
      BookingStatus.DRIVER_ARRIVING,
      BookingStatus.ARRIVED,
      BookingStatus.STARTED,
      BookingStatus.IN_PROGRESS,
    ].includes(currentBooking.status as any)
  );

  useEffect(() => {
    if (!isOnline) return;
    if (!driverLocation) return;
    if (hasActiveTrip) return;

    let active = true;
    const pollMs = 8000;

    const tick = async () => {
      if (!active) return;
      if (pollInFlightRef.current) return;

      pollInFlightRef.current = true;
      try {
        const items = await getAvailableBookings({ radiusKm: 10, limit: 25, maxAgeMinutes: 0 });
        if (!active) return;

        if (!Array.isArray(items) || items.length === 0) {
          return;
        }

        const ids = new Set(
          (Array.isArray(items) ? items : [])
            .map((it: any) => String(it?.bookingId ?? it?.id ?? ''))
            .filter((id: string) => Boolean(id))
        );

        if (ids.size === 0) {
          return;
        }

        for (const it of Array.isArray(items) ? items : []) {
          const bookingId = String((it as any)?.bookingId ?? (it as any)?.id ?? '');
          if (!bookingId) continue;
          dispatch(
            addBookingRequest({
              bookingId,
              pickup: (it as any)?.pickup,
              drop: (it as any)?.drop ?? null,
              distanceKm: (it as any)?.distanceKm,
              etaMin: (it as any)?.etaMin,
              fare: (it as any)?.fare,
              vehicleType: (it as any)?.vehicleType,
              transmissionType: (it as any)?.transmissionType,
              tripType: (it as any)?.tripType,
              outstationTripType: (it as any)?.outstationTripType,
              requestedHours: (it as any)?.requestedHours,
              scheduledTime: typeof (it as any)?.scheduledTime === 'string' ? (it as any).scheduledTime : undefined,
            })
          );
        }

        for (const existing of bookingRequestsRef.current) {
          if (!ids.has(String(existing.id))) {
            dispatch(removeBookingRequest(String(existing.id)));
          }
        }
      } catch {
      } finally {
        pollInFlightRef.current = false;
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, pollMs);

    void tick();

    return () => {
      active = false;
      clearInterval(interval);
      pollInFlightRef.current = false;
    };
  }, [dispatch, driverLocation, hasActiveTrip, isOnline]);

  const header = useMemo(() => {
    const requestCount = isOnline ? filteredRequests.length : 0;
    return (
      <View style={[styles.header, { paddingTop: Math.max(10, insets.top + 6) }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              navigation.dispatch(DrawerActions.openDrawer());
            }}
          >
            <Icon name="menu" size={22} color="#C9A84C" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Accept</Text>
          </View>

          <View style={styles.headerRightWrap}>
            {isOnline ? (
              <View style={styles.toggleInlineWrap}>
                <View style={[styles.statusPill, styles.statusPillOnline]}>
                  <Text style={[styles.onlineLabel, styles.onlineLabelOn]}>ONLINE</Text>
                </View>
                <Switch
                  value={isOnline}
                  onValueChange={(v) => void handleToggleSwitch(v)}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
            ) : null}

            {requestCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requestCount}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, tripFilter === 'ALL' ? styles.filterPillActive : null]}
            onPress={() => setTripFilter('ALL')}
          >
            <Text style={[styles.filterPillText, tripFilter === 'ALL' ? styles.filterPillTextActive : null]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, tripFilter === 'ONE_WAY' ? styles.filterPillActive : null]}
            onPress={() => setTripFilter('ONE_WAY')}
          >
            <Text style={[styles.filterPillText, tripFilter === 'ONE_WAY' ? styles.filterPillTextActive : null]}>One Way</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, tripFilter === 'ROUND_TRIP' ? styles.filterPillActive : null]}
            onPress={() => setTripFilter('ROUND_TRIP')}
          >
            <Text style={[styles.filterPillText, tripFilter === 'ROUND_TRIP' ? styles.filterPillTextActive : null]}>
              Round Trip
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, tripFilter === 'OUTSTATION' ? styles.filterPillActive : null]}
            onPress={() => setTripFilter('OUTSTATION')}
          >
            <Text style={[styles.filterPillText, tripFilter === 'OUTSTATION' ? styles.filterPillTextActive : null]}>
              Outstation
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [filteredRequests.length, insets.top, isOnline, navigation, tripFilter]);

  const handleAccept = async (id: string) => {
    try {
      if (acceptingRef.current === id) return;
      acceptingRef.current = id;

      // Accept booking on server — returns { booking: {...} }
      const result = await acceptBooking(id, '');
      const raw = (result as any)?.booking ?? result;

      // Immediately remove from request list and join socket room
      setActiveBookingId(id);
      dispatch(removeBookingRequest(id));
      try { socketService.joinBooking(id); } catch {}

      // Use the accept response directly — no need for a second getBookingDetails() call
      const now = new Date().toISOString();
      const pickupLat = Number((raw as any)?.pickupLocationLat ?? (raw as any)?.pickup?.latitude);
      const pickupLng = Number((raw as any)?.pickupLocationLng ?? (raw as any)?.pickup?.longitude);
      if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
        dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
      }
      dispatch(setPickupAddress(typeof (raw as any)?.pickupAddress === 'string' ? (raw as any).pickupAddress : null));

      const dropLatRaw = (raw as any)?.dropLocationLat ?? (raw as any)?.drop?.latitude;
      const dropLngRaw = (raw as any)?.dropLocationLng ?? (raw as any)?.drop?.longitude;
      const dropLat = dropLatRaw !== undefined && dropLatRaw !== null ? Number(dropLatRaw) : NaN;
      const dropLng = dropLngRaw !== undefined && dropLngRaw !== null ? Number(dropLngRaw) : NaN;
      if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
        dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
      }
      dispatch(setDropAddress(typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : null));

      dispatch(
        setCurrentBooking({
          id: String((raw as any)?.id ?? id),
          bookingNumber: String((raw as any)?.bookingNumber ?? ''),
          status: ((raw as any)?.status ?? BookingStatus.ACCEPTED) as any,
          customer: (raw as any)?.customer as any,
          driver: (raw as any)?.driver as any,
          otp: (raw as any)?.otp ?? null,
          pickupLocation: {
            latitude: Number.isFinite(pickupLat) ? pickupLat : 0,
            longitude: Number.isFinite(pickupLng) ? pickupLng : 0,
          },
          pickupAddress: String((raw as any)?.pickupAddress ?? 'Pickup'),
          dropLocation:
            Number.isFinite(dropLat) && Number.isFinite(dropLng) ? { latitude: dropLat, longitude: dropLng } : undefined,
          dropAddress: typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : undefined,
          scheduledTime: (raw as any)?.scheduledTime ? String((raw as any).scheduledTime) : undefined,
          vehicleType: ((raw as any)?.vehicleType ?? VehicleType.CAR) as any,
          transmissionType: ((raw as any)?.transmissionType ?? undefined) as any,
          tripType: (raw as any)?.tripType as any,
          totalAmount: typeof (raw as any)?.totalAmount === 'number' ? (raw as any).totalAmount : Number((raw as any)?.totalAmount || 0),
          paymentMethod: ((raw as any)?.paymentMethod ?? PaymentMethod.CASH) as any,
          createdAt: (raw as any)?.createdAt ? String((raw as any).createdAt) : now,
          updatedAt: (raw as any)?.updatedAt ? String((raw as any).updatedAt) : now,
        })
      );

      // Navigate IMMEDIATELY with full data already in Redux
      navigation.navigate('Tracking', { bookingId: id });
    } catch (e: any) {
      showAlert('Accept booking', e?.message || 'Failed to accept booking');
    } finally {
      if (acceptingRef.current === id) {
        acceptingRef.current = null;
      }
    }
  };

  const handleReject = (id: string) => {
    try {
      socketService.emit('booking:reject', { bookingId: id });
      dispatch(removeBookingRequest(id));
    } catch {
      showAlert('Error', 'Failed to reject booking');
    }
  };

  const renderItem = ({ item }: { item: BookingRequest }) => (
    <BookingRequestCard
      request={item}
      driverLocation={driverLocation ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude } : null}
      onAccept={(bookingId) => handleAccept(bookingId)}
      onReject={(bookingId) => handleReject(bookingId)}
      showActions={false}
      onPress={(bookingId) => {
        try {
          navigation.navigate('DriverBookingRequestDetails', { bookingId });
        } catch {
        }
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {header}

      {scheduledLockInfo ? (
        <View style={styles.scheduledBanner}>
          <Icon name="calendar-clock" size={26} color="#f59e0b" style={{ marginRight: 12 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.scheduledBannerTitle}>Scheduled booking locked</Text>
            <Text style={styles.scheduledBannerSub} numberOfLines={1}>
              Pickup at {scheduledLockInfo.label}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.scheduledBannerBtn}
            onPress={() => {
              try {
                navigation.navigate('Schedule');
              } catch {
              }
            }}
          >
            <Text style={styles.scheduledBannerBtnText}>View</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {hasActiveTrip ? (
        <View style={styles.activeTripCard}>
          <Icon name="steering" size={26} color="#C9A84C" style={{ marginRight: 12 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.activeTripTitle}>Trip in progress</Text>
            <Text style={styles.activeTripSub} numberOfLines={1}>
              Status: {String(currentBooking?.status)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.activeTripBtn}
            onPress={() => {
              try {
                if (currentBooking?.id) {
                  setActiveBookingId(String(currentBooking.id));
                }
              } catch {
              }
              navigation.navigate('Tracking');
            }}
          >
            <Text style={styles.activeTripBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!hasSubscription && !isOnline ? (
        <SubscriptionGate onSuccess={() => void fetchSubscription()} />
      ) : !isOnline ? (
        <View style={styles.empty}>
          <Icon name="power-off" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>You’re Offline</Text>
          <Text style={styles.emptySub}>Go online to start receiving booking requests</Text>

          <View style={styles.offlineToggleCard}>
            <View style={[styles.statusPill, styles.statusPillOffline, styles.statusPillOfflineDanger]}>
              <Text style={[styles.onlineLabel, styles.onlineLabelOff, styles.onlineLabelOffDanger]}>OFFLINE</Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={(v) => void handleToggleSwitch(v)}
              trackColor={{ false: '#ef4444', true: '#10b981' }}
              thumbColor="#ef4444"
            />
          </View>
        </View>
      ) : hasRequests ? (
        <FlatList<BookingRequest>
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.empty}>
          <Icon name="radar" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Waiting for bookings…</Text>
          <Text style={styles.emptySub}>Stay online to receive requests</Text>
        </View>
      )}

      {/* Prominent Disclosure Modal for Google Play */}
      <Modal visible={showDisclosure} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Icon name="map-marker-radius" size={48} color="#C9A84C" style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Location Tracking</Text>
            <Text style={styles.modalText}>
              DriveMate collects location data to enable live trip tracking, calculate accurate fares, and assign nearby rides even when the app is closed or not in use.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowDisclosure(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnAccept} onPress={handleGoOnlineWithDisclosure}>
                <Text style={styles.modalBtnAcceptText}>I Agree</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bg,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  filterPill: {
    flex: 1,
    backgroundColor: G.glass2,
    borderWidth: 1,
    borderColor: G.border2,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  filterPillActive: {
    backgroundColor: G.glass4,
    borderColor: G.accent,
  },
  filterPillText: {
    color: G.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  filterPillTextActive: {
    color: G.accent,
  },
  scheduledBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: Platform.OS === 'android' ? '#1A1813' : 'rgba(201,168,76,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    ...Platform.select({
      ios: {
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
  },
  scheduledBannerTitle: {
    color: G.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  scheduledBannerSub: {
    marginTop: 3,
    color: G.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  scheduledBannerBtn: {
    marginLeft: 12,
    backgroundColor: G.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: G.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  scheduledBannerBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  activeTripCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Platform.OS === 'android' ? '#151518' : G.glass3,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    ...Platform.select({
      ios: {
        shadowColor: '#C9A84C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
    minHeight: 68,
  },
  activeTripTitle: {
    color: G.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  activeTripSub: {
    marginTop: 3,
    color: G.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  activeTripBtn: {
    marginLeft: 12,
    backgroundColor: G.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: G.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  activeTripBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: G.glass1,
    borderBottomWidth: 1,
    borderBottomColor: G.border2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  toggleInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  offlineToggleCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: G.glass2,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: G.border1,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: G.glass3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: G.border3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: G.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOnline: {
    backgroundColor: G.successSoft,
    borderColor: G.success,
  },
  statusPillOffline: {
    backgroundColor: G.glass2,
    borderColor: G.border3,
  },
  statusPillOfflineDanger: {
    backgroundColor: G.errorSoft,
    borderColor: G.error,
  },
  onlineLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: G.textSecondary,
  },
  onlineLabelOn: {
    color: G.success,
  },
  onlineLabelOff: {
    color: G.textSecondary,
  },
  onlineLabelOffDanger: {
    color: G.error,
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: G.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: G.textPrimary,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: G.textPrimary,
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: G.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 15,
  },
  modalBtnAccept: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnAcceptText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default DriverOnlineScreen;
