import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawerActions } from '@react-navigation/native';
import { ActivityIndicator, Alert, ScrollView, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setDropAddress, setDropLocation, setPickupAddress, setPickupLocation, setUserLocation } from '../../redux/slices/locationSlice';
import { BookingStatus } from '../../types';
import { getNearbyDrivers, type NearbyDriver } from '../../services/api';
import DriverMarker from '../../components/maps/DriverMarker';
import { FadeIn, SlideUp, StaggerItem, PressableScale } from '../../components/premium/AnimatedComponents';

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

const distanceApproxMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

const HomeScreen = ({ navigation }: any) => {
  const dispatch = useAppDispatch();
  const { userLocation, pickupLocation, pickupAddress, dropLocation, dropAddress } = useAppSelector((s) => s.location);
  const currentBooking = useAppSelector((s) => s.booking.currentBooking);

  const [isBootstrappingLocation, setIsBootstrappingLocation] = useState(false);
  const [mapSelectTarget, setMapSelectTarget] = useState<'pickup' | 'drop'>('pickup');
  const [isMapPicking, setIsMapPicking] = useState(false);

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);

  const mapRef = useRef<MapView | null>(null);
  const lastCameraCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastCameraTsRef = useRef<number>(0);
  const nearbyFetchRef = useRef<{ inFlight: boolean; lastKey: string | null }>({ inFlight: false, lastKey: null });

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

  const bootstrapLocation = useCallback(async () => {
    if (isBootstrappingLocation) return null;

    if (userLocation) {
      if (!pickupLocation) {
        dispatch(setPickupLocation(userLocation));
      }
      return userLocation;
    }

    setIsBootstrappingLocation(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location services', 'Turn on GPS/location services to detect your current location');
        return null;
      }

      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status !== 'granted') {
        Alert.alert('Location permission', 'Enable location permission to auto-detect pickup location');
        return null;
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
        coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
      }

      dispatch(setUserLocation(coords));

      if (!pickupLocation) {
        dispatch(setPickupLocation(coords));
        const items = await Location.reverseGeocodeAsync(coords);
        const a = items?.[0];
        const formatted = [a?.name, a?.street, a?.subregion, a?.city].filter(Boolean).join(', ');
        dispatch(setPickupAddress(formatted || 'Current location'));
      }

      return coords;
    } catch {
      Alert.alert('Location', 'Could not detect current location. You can select pickup manually.');
      return null;
    } finally {
      setIsBootstrappingLocation(false);
    }
  }, [dispatch, isBootstrappingLocation, pickupLocation, userLocation]);

  const centerOnCurrentLocation = useCallback(async () => {
    const coords = (await bootstrapLocation()) ?? userLocation;
    if (!coords) return;

    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      650
    );

    setIsMapPicking(true);
    try {
      await setTargetFromCoords(mapSelectTarget, coords);
    } catch {
      Alert.alert('Location', 'Could not fetch address for your current location.');
    } finally {
      setIsMapPicking(false);
    }
  }, [bootstrapLocation, mapSelectTarget, setTargetFromCoords, userLocation]);

  useEffect(() => {
    bootstrapLocation();
  }, [bootstrapLocation]);

  useEffect(() => {
    const base = pickupLocation ?? userLocation;
    if (!base) return;

    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      if (!mounted) return;
      if (nearbyFetchRef.current.inFlight) return;

      const key = `${base.latitude.toFixed(4)},${base.longitude.toFixed(4)}`;
      const now = Date.now();
      const shouldSkip = nearbyFetchRef.current.lastKey === key && now - lastCameraTsRef.current < 1200;
      if (shouldSkip) return;

      nearbyFetchRef.current.inFlight = true;
      nearbyFetchRef.current.lastKey = key;
      try {
        const res = await getNearbyDrivers(base.latitude, base.longitude, 6);
        if (!mounted) return;
        const arr = Array.isArray(res) ? res : [];
        setNearbyDrivers(arr);


      } catch (e) {
        if (!mounted) return;
        setNearbyDrivers([]);
        if (__DEV__) {
          console.log('Nearby drivers poll failed', {
            lat: base.latitude,
            lng: base.longitude,
            error: String((e as any)?.message || e),
          });
        }
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
  }, [pickupLocation, userLocation]);

  useEffect(() => {
    if (isMapPicking) return;
    const target = mapSelectTarget === 'drop' ? dropLocation : pickupLocation;
    const base = target ?? pickupLocation;
    if (!base) return;

    const now = Date.now();
    const prev = lastCameraCenterRef.current;
    const movedMeters = prev ? distanceApproxMeters(prev, base) : Number.POSITIVE_INFINITY;
    const tooSoon = now - lastCameraTsRef.current < 900;
    if (tooSoon && Number.isFinite(movedMeters) && movedMeters < 30) {
      return;
    }

    lastCameraCenterRef.current = { latitude: base.latitude, longitude: base.longitude };
    lastCameraTsRef.current = now;

    mapRef.current?.animateToRegion(
      {
        latitude: base.latitude,
        longitude: base.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      650
    );
  }, [dropLocation, isMapPicking, mapSelectTarget, pickupLocation]);

  const initialRegion = useMemo(() => {
    const base = pickupLocation ?? userLocation;
    if (!base) {
      return {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [pickupLocation, userLocation]);

  const canContinue = Boolean(pickupLocation);

  const hasActiveTrip = Boolean(
    currentBooking?.id &&
    currentBooking?.status &&
    [
      BookingStatus.REQUESTED,
      BookingStatus.SEARCHING,
      BookingStatus.ACCEPTED,
      BookingStatus.ARRIVED,
      BookingStatus.STARTED,
      BookingStatus.IN_PROGRESS,
    ].includes(currentBooking.status as any)
  );

  const goToRideConfirm = useCallback(
    (serviceType: 'ONE_WAY' | 'OUTSTATION' | 'ROUND_TRIP' | 'SCHEDULE') => {
      if (hasActiveTrip) {
        Alert.alert('Trip in progress', 'You already have an active trip. Please complete or cancel it before booking a new ride.');
        return;
      }
      if (!pickupLocation) {
        Alert.alert('Select pickup', 'Please select pickup location first (tap the map or use the crosshair).');
        return;
      }
      navigation.navigate('RideConfirm', { serviceType });
    },
    [navigation, pickupLocation, hasActiveTrip]
  );

  const onMapPress = useCallback(
    async (e: any) => {
      const coordinate = e?.nativeEvent?.coordinate;
      if (typeof coordinate?.latitude !== 'number' || typeof coordinate?.longitude !== 'number') return;

      setIsMapPicking(true);
      try {
        const coords = { latitude: coordinate.latitude, longitude: coordinate.longitude };

        await setTargetFromCoords(mapSelectTarget, coords);
      } catch {
        Alert.alert('Map', 'Could not fetch address for that point.');
      } finally {
        setIsMapPicking(false);
      }
    },
    [mapSelectTarget, setTargetFromCoords]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <FadeIn delay={100}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => {
                  navigation.dispatch(DrawerActions.openDrawer());
                }}
              >
                <Icon name="menu" size={24} color="#C9A84C" />
              </TouchableOpacity>

              <View style={styles.headerTopRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.greeting}>Welcome! 👋</Text>

                </View>
              </View>
            </View>
          </View>
        </FadeIn>

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
                navigation.navigate('Tracking');
              }}
            >
              <Text style={styles.activeTripBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <SlideUp delay={200} distance={40}>
          <View style={styles.mapContainer}>
            <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={initialRegion} onPress={onMapPress}>
              {pickupLocation ? <Marker coordinate={pickupLocation} pinColor="#10b981" title="Pickup" /> : null}
              {dropLocation ? <Marker coordinate={dropLocation} pinColor="#ef4444" title="Drop" /> : null}
              {nearbyDrivers.map((d) => {
                const lat = Number((d as any)?.location?.latitude);
                const lng = Number((d as any)?.location?.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return <DriverMarker key={String(d.id)} latitude={lat} longitude={lng} />;
              })}
            </MapView>

            <View style={styles.mapTopBar}>
              <Text style={styles.mapHint} numberOfLines={1}>
                Tap map to set {mapSelectTarget === 'pickup' ? 'Pickup' : 'Drop'}
              </Text>
              <TouchableOpacity style={styles.mapLocateIcon} onPress={centerOnCurrentLocation}>
                <Icon name="crosshairs-gps" size={18} color="#C9A84C" />
              </TouchableOpacity>
            </View>

            <View style={styles.mapSelectRow}>
              <TouchableOpacity
                style={[
                  styles.mapSelectChip,
                  styles.mapSelectChipLeft,
                  mapSelectTarget === 'pickup' ? styles.mapSelectChipActive : null,
                ]}
                onPress={() => setMapSelectTarget('pickup')}
              >
                <Text style={[styles.mapSelectChipText, mapSelectTarget === 'pickup' ? styles.mapSelectChipTextActive : null]}>
                  Pickup
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapSelectChip, mapSelectTarget === 'drop' ? styles.mapSelectChipActive : null]}
                onPress={() => setMapSelectTarget('drop')}
              >
                <Text style={[styles.mapSelectChipText, mapSelectTarget === 'drop' ? styles.mapSelectChipTextActive : null]}>
                  Drop
                </Text>
              </TouchableOpacity>
            </View>

            {isBootstrappingLocation || isMapPicking ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="small" color="#C9A84C" />
                <Text style={styles.mapLoadingText}>
                  {isBootstrappingLocation ? 'Detecting location...' : 'Getting address...'}
                </Text>
              </View>
            ) : null}
          </View>
        </SlideUp>

        {!hasActiveTrip ? (
        <SlideUp delay={350} distance={30}>
          <View style={styles.bookingCard}>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                setMapSelectTarget('pickup');
                navigation.navigate('LocationSearch', {
                  target: 'pickup',
                  initialValue: pickupAddress ?? '',
                });
              }}
            >
              <Icon name="map-marker" size={24} color="#C9A84C" />
              <Text style={[styles.inputText, pickupAddress ? styles.inputTextFilled : null]} numberOfLines={1}>
                {pickupAddress ?? 'Enter pickup location'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                setMapSelectTarget('drop');
                navigation.navigate('LocationSearch', {
                  target: 'drop',
                  initialValue: dropAddress ?? '',
                });
              }}
            >
              <Icon name="map-marker-outline" size={24} color="#8A8A8A" />
              <Text style={[styles.inputText, dropAddress ? styles.inputTextFilled : null]} numberOfLines={1}>
                {dropAddress ?? 'Enter destination'}
              </Text>
            </TouchableOpacity>

            <PressableScale
              onPress={() => navigation.navigate('RideConfirm')}
              disabled={!canContinue}
              style={[styles.continueButton, !canContinue ? styles.continueButtonDisabled : null]}
            >
              <Text style={styles.continueText}>Continue</Text>
            </PressableScale>
          </View>
        </SlideUp>
        ) : null}

        {!hasActiveTrip ? (
        <View style={styles.servicesContainer}>
          <Text style={styles.sectionTitle}>Our Services</Text>

          <View style={styles.serviceGrid}>
            <ServiceCard
              icon="arrow-right"
              title="One Way"
              description="Point to point"
              color="#C9A84C"
              index={0}
              onPress={() => goToRideConfirm('ONE_WAY')}
            />
            <ServiceCard
              icon="car-multiple"
              title="Outstation"
              description="Long distance trips"
              color="#10b981"
              index={1}
              onPress={() => goToRideConfirm('OUTSTATION')}
            />
            <ServiceCard
              icon="repeat"
              title="Round Trip"
              description="Return journey"
              color="#f59e0b"
              index={2}
              onPress={() => goToRideConfirm('ROUND_TRIP')}
            />
            <ServiceCard
              icon="calendar"
              title="Schedule"
              description="Book in advance"
              color="#8b5cf6"
              index={3}
              onPress={() => goToRideConfirm('SCHEDULE')}
            />
          </View>
        </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const ServiceCard = ({ icon, title, description, color, onPress, index }: any) => (
  <StaggerItem index={index ?? 0} style={styles.serviceCardWrapper}>
    <PressableScale onPress={onPress} style={styles.serviceCardInner} scaleTo={0.94}>
      <View style={[styles.serviceIcon, { backgroundColor: `${color}15` }]}>
        <Icon name={icon} size={28} color={color} />
      </View>
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceDescription}>{description}</Text>
    </PressableScale>
  </StaggerItem>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    padding: 16,
    backgroundColor: '#0A0A0A',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTopRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginLeft: 12,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 16,
    color: '#8A8A8A',
    marginTop: 10,
  },
  activeTripCard: {
    marginHorizontal: 16,
    marginBottom: 12,
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mapContainer: {
    height: 260,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#141414',
  },
  mapTopBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapHint: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mapLocateIcon: {
    marginLeft: 10,
    backgroundColor: 'rgba(10,10,10,0.85)',
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mapSelectRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
  },
  mapSelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mapSelectChipLeft: {
    marginRight: 8,
  },
  mapSelectChipActive: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  mapSelectChipText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mapSelectChipTextActive: {
    color: '#0A0A0A',
    fontWeight: '800',
  },
  nearbyDriverMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoading: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mapLoadingText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bookingCard: {
    margin: 16,
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  inputText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#8A8A8A',
    flex: 1,
  },
  inputTextFilled: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 8,
  },
  continueButton: {
    marginTop: 12,
    backgroundColor: '#C9A84C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
  },
  servicesContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  serviceCardInner: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#8A8A8A',
  },
});

export default HomeScreen;
