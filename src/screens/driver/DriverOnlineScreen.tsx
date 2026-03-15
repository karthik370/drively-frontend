import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawerActions } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDriverOnline } from '../../redux/slices/driverSlice';
import { addBookingRequest, clearBookingRequests, removeBookingRequest, setCurrentBooking } from '../../redux/slices/bookingSlice';
import { setDropAddress, setDropLocation, setPickupAddress, setPickupLocation } from '../../redux/slices/locationSlice';
import socketService from '../../services/socketService';
import { acceptBooking, getActiveBooking, getAvailableBookings, getBookingDetails, goOffline, goOnline } from '../../services/api';
import BookingRequestCard, { type BookingRequest } from '../../components/driver/BookingRequestCard';
import useBookingRequest from '../../hooks/useBookingRequest';
import useRealTimeLocation from '../../hooks/useRealTimeLocation';
import { BookingStatus, PaymentMethod, VehicleType } from '../../types';
import SubscriptionGate from '../../components/driver/SubscriptionGate';
import { getDriverSubscriptionStatus } from '../../services/api';

const DriverOnlineScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const isOnline = useAppSelector((s) => s.driver.isOnline);
  const bookingRequests = useAppSelector((s) => s.booking.bookingRequests) as BookingRequest[];
  const currentBooking = useAppSelector((s) => s.booking.currentBooking);
  const driverLocation = useAppSelector((s) => s.location.currentLocation);
  const onlineToggleInFlightRef = useRef<boolean>(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [tripFilter, setTripFilter] = useState<'ALL' | 'ONE_WAY' | 'ROUND_TRIP' | 'OUTSTATION'>('ALL');
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
      try {
        if (nextOnline) {
          await goOnline();
        } else {
          await goOffline();
        }
        dispatch(setDriverOnline(nextOnline));
      } catch (e: any) {
        if (e?.message?.includes('Active subscription required') || e?.response?.status === 403) {
          setHasSubscription(false);
          Alert.alert('Subscription Required', 'You need an active subscription to go online.');
        } else {
          Alert.alert('Status', e?.message || 'Failed to update online status');
        }
      } finally {
        onlineToggleInFlightRef.current = false;
      }
    },
    [dispatch]
  );

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
      Alert.alert('Location', trackingError);
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
                  onValueChange={(v) => {
                    void setOnlineState(Boolean(v));
                  }}
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
      if (acceptingRef.current === id) {
        return;
      }
      acceptingRef.current = id;
      await acceptBooking(id, '');

      try {
        socketService.joinBooking(id);
      } catch {
      }

      const raw = await getBookingDetails(id);
      const now = new Date().toISOString();

      setActiveBookingId(id);
      dispatch(removeBookingRequest(id));

      const pickupLat = Number((raw as any)?.pickupLocationLat ?? (raw as any)?.pickupLatitude ?? (raw as any)?.pickup?.latitude);
      const pickupLng = Number((raw as any)?.pickupLocationLng ?? (raw as any)?.pickupLongitude ?? (raw as any)?.pickup?.longitude);
      if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
        dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
      }
      dispatch(setPickupAddress(typeof (raw as any)?.pickupAddress === 'string' ? (raw as any).pickupAddress : null));

      const dropLatRaw = (raw as any)?.dropLocationLat ?? (raw as any)?.dropLatitude ?? (raw as any)?.drop?.latitude;
      const dropLngRaw = (raw as any)?.dropLocationLng ?? (raw as any)?.dropLongitude ?? (raw as any)?.drop?.longitude;
      const dropLat = dropLatRaw !== undefined ? Number(dropLatRaw) : NaN;
      const dropLng = dropLngRaw !== undefined ? Number(dropLngRaw) : NaN;
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
            Number.isFinite(dropLat) && Number.isFinite(dropLng)
              ? { latitude: dropLat, longitude: dropLng }
              : undefined,
          dropAddress: typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : undefined,
          scheduledTime: (raw as any)?.scheduledTime ? String((raw as any).scheduledTime) : undefined,
          vehicleType: ((raw as any)?.vehicleType ?? VehicleType.CAR) as any,
          transmissionType: ((raw as any)?.transmissionType ?? undefined) as any,
          tripType: (raw as any)?.tripType as any,
          totalAmount:
            typeof (raw as any)?.totalAmount === 'number' ? (raw as any).totalAmount : Number((raw as any)?.totalAmount || 0),
          paymentMethod: ((raw as any)?.paymentMethod ?? PaymentMethod.CASH) as any,
          createdAt: (raw as any)?.createdAt ? String((raw as any).createdAt) : now,
          updatedAt: (raw as any)?.updatedAt ? String((raw as any).updatedAt) : now,
        })
      );

      const scheduledRaw = (raw as any)?.scheduledTime ? String((raw as any).scheduledTime) : null;
      const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
      const isFutureScheduled = Boolean(scheduledAt && Number.isFinite(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now());

      if (isFutureScheduled) {
        Alert.alert('Scheduled booking accepted', 'This booking will start at the scheduled time. You cannot accept other rides until it is completed.', [
          {
            text: 'View',
            onPress: () => {
              try {
                navigation.navigate('Schedule');
              } catch {
              }
            },
          },
          { text: 'OK' },
        ]);
        return;
      }

      navigation.navigate('Tracking');
    } catch (e: any) {
      Alert.alert('Accept booking', e?.message || 'Failed to accept booking');
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
      Alert.alert('Error', 'Failed to reject booking');
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
              onValueChange={(v) => {
                void setOnlineState(Boolean(v));
              }}
              trackColor={{ false: '#ef4444', true: '#10b981' }}
              thumbColor="#ef4444"
            />
          </View>
        </View>
      ) : hasRequests ? (
        <FlatList<BookingRequest>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  filterPill: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  filterPillActive: {
    backgroundColor: '#1E1E1E',
    borderColor: '#FFFFFF',
  },
  filterPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  scheduledBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduledBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  scheduledBannerSub: {
    marginTop: 2,
    color: '#92400e',
    fontSize: 12,
    fontWeight: '800',
  },
  scheduledBannerBtn: {
    marginLeft: 12,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scheduledBannerBtnText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  activeTripCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTripTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  activeTripSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTripBtn: {
    marginLeft: 12,
    backgroundColor: '#C9A84C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeTripBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
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
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOnline: {
    backgroundColor: '#141414',
    borderColor: '#a7f3d0',
  },
  statusPillOffline: {
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusPillOfflineDanger: {
    backgroundColor: '#1A1010',
    borderColor: '#fecaca',
  },
  onlineLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8A8A8A',
  },
  onlineLabelOn: {
    color: '#047857',
  },
  onlineLabelOff: {
    color: '#8A8A8A',
  },
  onlineLabelOffDanger: {
    color: '#FF4444',
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#ffffff',
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
    color: '#FFFFFF',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
  },
});

export default DriverOnlineScreen;
