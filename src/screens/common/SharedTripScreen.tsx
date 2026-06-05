import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { G, glass } from '../../constants/glassStyles';
import { getPublicTracking } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const POLL_INTERVAL = 5000;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  REQUESTED: { label: 'Finding a driver…', color: '#f59e0b', icon: 'magnify' },
  SEARCHING: { label: 'Finding a driver…', color: '#f59e0b', icon: 'magnify' },
  ACCEPTED: { label: 'Driver assigned', color: '#f59e0b', icon: 'check-circle' },
  DRIVER_ARRIVING: { label: 'Driver is on the way', color: '#f59e0b', icon: 'car-clock' },
  ARRIVED: { label: 'Driver has arrived', color: '#10b981', icon: 'check-circle' },
  STARTED: { label: 'Trip in progress', color: '#3b82f6', icon: 'car' },
  IN_PROGRESS: { label: 'Trip in progress', color: '#3b82f6', icon: 'car' },
  COMPLETED: { label: 'Trip completed', color: '#10b981', icon: 'check-circle' },
  CANCELLED: { label: 'Trip cancelled', color: '#ef4444', icon: 'close-circle' },
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

interface SharedTripScreenProps {
  route: any;
  navigation: any;
}

const SharedTripScreen: React.FC<SharedTripScreenProps> = ({ route, navigation }) => {
  const shareToken = route?.params?.shareToken || '';
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripData, setTripData] = useState<any>(null);
  const [tripEnded, setTripEnded] = useState(false);
  const autoCloseRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTripData = useCallback(async () => {
    if (!shareToken) return;
    try {
      const data = await getPublicTracking(shareToken);
      setTripData(data);
      setError(null);

      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        setTripEnded(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        // Auto-close after 8 seconds
        autoCloseRef.current = setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 8000);
      }
    } catch (e: any) {
      if (loading) {
        setError(e?.message || 'Tracking link not found or expired');
      }
    } finally {
      setLoading(false);
    }
  }, [shareToken, loading, navigation]);

  // Initial fetch and polling
  useEffect(() => {
    void fetchTripData();
    pollRef.current = setInterval(fetchTripData, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [fetchTripData]);

  // Pulse animation for active statuses
  useEffect(() => {
    if (tripData && !tripEnded) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [tripData, tripEnded, pulseAnim]);

  // Fit map to markers when data changes
  useEffect(() => {
    if (!tripData || !mapRef.current) return;

    const coords: Array<{ latitude: number; longitude: number }> = [];
    if (tripData.pickup?.latitude && tripData.pickup?.longitude) {
      coords.push({ latitude: tripData.pickup.latitude, longitude: tripData.pickup.longitude });
    }
    if (tripData.drop?.latitude && tripData.drop?.longitude) {
      coords.push({ latitude: tripData.drop.latitude, longitude: tripData.drop.longitude });
    }
    if (tripData.driver?.currentLocation?.latitude && tripData.driver?.currentLocation?.longitude) {
      coords.push({
        latitude: tripData.driver.currentLocation.latitude,
        longitude: tripData.driver.currentLocation.longitude,
      });
    }

    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [tripData?.driver?.currentLocation?.latitude, tripData?.pickup?.latitude]);

  const statusConfig = STATUS_CONFIG[tripData?.status] || STATUS_CONFIG.REQUESTED;

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={G.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={G.accent} />
          <Text style={styles.loadingText}>Loading trip…</Text>
        </View>
      </View>
    );
  }

  if (error || !tripData) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={G.bg} />
        <View style={styles.errorContainer}>
          <Icon name="link-variant-off" size={56} color={G.textMuted} />
          <Text style={styles.errorTitle}>Tracking Unavailable</Text>
          <Text style={styles.errorSub}>
            This tracking link may have expired or the trip has ended.
          </Text>
          <TouchableOpacity style={glass.buttonPrimary} onPress={() => navigation.goBack()}>
            <Text style={{ color: G.textOnAccent, fontWeight: '700', fontSize: 15 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const driverName = tripData.driver
    ? `${tripData.driver.firstName} ${tripData.driver.lastName || ''}`.trim()
    : null;
  const vehicleInfo = tripData.driver?.vehicle
    ? `${tripData.driver.vehicle.color || ''} ${tripData.driver.vehicle.make || ''} ${tripData.driver.vehicle.model || ''}`.trim()
    : null;
  const licensePlate = tripData.driver?.vehicle?.licensePlate || null;
  const driverPhoto = tripData.driver?.profileImage || null;
  const eta = tripData.driverETA;

  const pickupCoord = tripData.pickup?.latitude && tripData.pickup?.longitude
    ? { latitude: tripData.pickup.latitude, longitude: tripData.pickup.longitude }
    : null;
  const dropCoord = tripData.drop?.latitude && tripData.drop?.longitude
    ? { latitude: tripData.drop.latitude, longitude: tripData.drop.longitude }
    : null;
  const driverCoord = tripData.driver?.currentLocation?.latitude && tripData.driver?.currentLocation?.longitude
    ? { latitude: tripData.driver.currentLocation.latitude, longitude: tripData.driver.currentLocation.longitude }
    : null;

  const mapCenter = driverCoord || pickupCoord || { latitude: 17.385, longitude: 78.4867 };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={G.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={G.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <Text style={styles.headerSub}>
            {tripData.customerName}'s ride
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {/* Pickup Marker */}
          {pickupCoord && (
            <Marker coordinate={pickupCoord} title="Pickup" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.markerDot, { backgroundColor: '#10b981' }]} />
            </Marker>
          )}

          {/* Drop Marker */}
          {dropCoord && (
            <Marker coordinate={dropCoord} title="Drop-off" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.markerDot, { backgroundColor: '#ef4444' }]} />
            </Marker>
          )}

          {/* Driver Marker */}
          {driverCoord && (
            <Marker coordinate={driverCoord} title="Driver" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarker}>
                <Icon name="car" size={18} color={G.textOnAccent} />
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      {/* Status Banner */}
      <Animated.View style={[styles.statusBanner, { backgroundColor: statusConfig.color }]}>
        <View style={styles.statusRow}>
          <Icon name={statusConfig.icon as any} size={18} color="#fff" />
          <Text style={styles.statusText}>{statusConfig.label}</Text>
        </View>
        {eta != null && eta > 0 && !tripEnded && (
          <Animated.View style={[styles.etaBadge, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.etaNumber}>{eta}</Text>
            <Text style={styles.etaUnit}>MIN</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {/* Driver Card */}
        {driverName ? (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              {driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={styles.driverPhoto} />
              ) : (
                <Text style={styles.driverInitial}>
                  {driverName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverName}</Text>
              {vehicleInfo ? <Text style={styles.vehicleInfo}>{vehicleInfo}</Text> : null}
              {licensePlate ? (
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{licensePlate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={[styles.driverCard, { justifyContent: 'center' }]}>
            <ActivityIndicator size="small" color={G.accent} />
            <Text style={[styles.vehicleInfo, { marginLeft: 10 }]}>
              Searching for a driver…
            </Text>
          </View>
        )}

        {/* Route Card */}
        <View style={styles.routeCard}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: '#10b981' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {tripData.pickupAddress || 'Pickup location'}
              </Text>
            </View>
          </View>
          {tripData.dropAddress ? (
            <>
              <View style={styles.routeDivider} />
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, { backgroundColor: '#ef4444' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>DROP-OFF</Text>
                  <Text style={styles.routeAddress} numberOfLines={2}>
                    {tripData.dropAddress}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {/* Trip Ended Overlay */}
      {tripEnded && (
        <View style={styles.endedOverlay}>
          <View style={styles.endedContent}>
            <Icon
              name={tripData.status === 'COMPLETED' ? 'check-circle' : 'close-circle'}
              size={64}
              color={tripData.status === 'COMPLETED' ? '#10b981' : '#ef4444'}
            />
            <Text style={styles.endedTitle}>
              {tripData.status === 'COMPLETED' ? 'Trip Completed! 🎉' : 'Trip Cancelled'}
            </Text>
            <Text style={styles.endedSub}>
              {tripData.status === 'COMPLETED'
                ? `${tripData.customerName}'s ride has been completed safely.`
                : 'This ride has been cancelled.'}
            </Text>
            <TouchableOpacity
              style={[glass.buttonPrimary, { marginTop: 20, paddingHorizontal: 40 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ color: G.textOnAccent, fontWeight: '700', fontSize: 15 }}>
                Close
              </Text>
            </TouchableOpacity>
            <Text style={styles.autoCloseText}>Auto-closing in a few seconds…</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: G.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: G.textSecondary,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 14,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: G.textPrimary,
    marginTop: 8,
  },
  errorSub: {
    fontSize: 14,
    color: G.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
    marginBottom: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: G.bg,
    borderBottomWidth: 1,
    borderBottomColor: G.border1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: G.glass2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: G.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: G.accent,
    fontWeight: '600',
    marginTop: 1,
  },

  // Map
  mapContainer: {
    height: '40%',
    minHeight: 220,
  },
  map: {
    flex: 1,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: G.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    elevation: 8,
    shadowColor: G.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  etaBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaNumber: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  etaUnit: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    fontSize: 11,
  },

  // Content
  content: {
    flex: 1,
    padding: 14,
    gap: 12,
  },

  // Driver Card
  driverCard: {
    backgroundColor: G.glass2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: G.accentSoft,
    borderWidth: 2,
    borderColor: G.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  driverPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  driverInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: G.accent,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '800',
    color: G.textPrimary,
  },
  vehicleInfo: {
    fontSize: 13,
    color: G.textSecondary,
    marginTop: 2,
  },
  plateBadge: {
    marginTop: 5,
    alignSelf: 'flex-start',
    backgroundColor: G.glass3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  plateText: {
    color: G.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Route Card
  routeCard: {
    backgroundColor: G.glass2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border1,
    padding: 14,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: G.textMuted,
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: G.textPrimary,
    marginTop: 2,
    lineHeight: 20,
  },
  routeDivider: {
    height: 1,
    backgroundColor: G.border1,
    marginVertical: 12,
    marginLeft: 24,
  },

  // Trip Ended Overlay
  endedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  endedContent: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  endedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: G.textPrimary,
    marginTop: 8,
  },
  endedSub: {
    fontSize: 14,
    color: G.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  autoCloseText: {
    fontSize: 12,
    color: G.textMuted,
    marginTop: 12,
  },
});

export default SharedTripScreen;
