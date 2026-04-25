import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  routeCoordinates?: { latitude: number; longitude: number }[] | null;
  onPress?: () => void;
  /** If true, renders a small circular marker — used for nearby-drivers on search screens */
  isNearby?: boolean;
};

// ── Geometry Helpers ──
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

const calcBearing = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const fastDist = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

const lerpAngle = (from: number, to: number, t: number): number => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

const getPolylineBearing = (
  point: { latitude: number; longitude: number },
  polyline: { latitude: number; longitude: number }[],
): number | null => {
  if (!polyline || polyline.length < 2) return null;
  let bestDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.longitude - a.longitude) * dx + (point.latitude - a.latitude) * dy) / lenSq));
    const proj = { latitude: a.latitude + t * dy, longitude: a.longitude + t * dx };
    const dist = fastDist(point, proj);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  if (bestDist > 100) return null;
  const nextIdx = Math.min(bestIdx + 1, polyline.length - 1);
  return calcBearing(polyline[bestIdx], polyline[nextIdx]);
};

// ── Animation Constants ──
const ANIM_DURATION = 1000;
const FRAME_MS = 16;

const DriverMarker = ({
  latitude,
  longitude,
  heading,
  routeCoordinates,
  onPress,
  isNearby = false,
}: DriverMarkerProps) => {
  const [displayCoord, setDisplayCoord] = useState({ latitude, longitude });
  const [displayRotation, setDisplayRotation] = useState(heading ?? 0);
  // Start true so Android captures the icon in the first bitmap snapshot,
  // then switch to false to stop re-rendering for performance.
  const [trackChanges, setTrackChanges] = useState(true);

  const prevCoordRef = useRef({ latitude, longitude });
  const prevRotationRef = useRef(heading ?? 0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Disable tracksViewChanges after 800ms — enough time for Android to snapshot the icon
  useEffect(() => {
    const t = setTimeout(() => setTrackChanges(false), 800);
    return () => clearTimeout(t);
  }, []);

  // ── Smooth position + rotation animation ──
  useEffect(() => {
    const prev = prevCoordRef.current;
    const dLat = Math.abs(latitude - prev.latitude);
    const dLng = Math.abs(longitude - prev.longitude);
    if (dLat < 0.000002 && dLng < 0.000002) return;

    // Briefly re-enable so Android re-snapshots the marker at its new position
    setTrackChanges(true);

    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }

    let targetBearing: number;
    if (typeof heading === 'number' && Number.isFinite(heading)) {
      targetBearing = heading;
    } else if (routeCoordinates) {
      targetBearing = getPolylineBearing({ latitude, longitude }, routeCoordinates) ?? calcBearing(prev, { latitude, longitude });
    } else {
      targetBearing = calcBearing(prev, { latitude, longitude });
    }

    const startLat = prev.latitude;
    const startLng = prev.longitude;
    const startRot = prevRotationRef.current;
    const startTime = Date.now();

    animRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / ANIM_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayCoord({
        latitude: startLat + (latitude - startLat) * eased,
        longitude: startLng + (longitude - startLng) * eased,
      });
      setDisplayRotation(lerpAngle(startRot, targetBearing, eased));

      if (progress >= 1) {
        if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
        prevCoordRef.current = { latitude, longitude };
        prevRotationRef.current = targetBearing;
        // Disable tracking again after animation
        setTrackChanges(false);
      }
    }, FRAME_MS);

    return () => {
      if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
    };
  }, [latitude, longitude, heading, routeCoordinates]);

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  // ── Nearby driver: gold circle with car icon ──
  if (isNearby) {
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        tracksViewChanges={trackChanges}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={6}
        onPress={onPress}
      >
        <View style={styles.nearbyWrap}>
          <Icon name="car-side" size={16} color="#C9A84C" />
        </View>
      </Marker>
    );
  }

  // ── Active driver: car icon in dark circle, with rotation ──
  return (
    <Marker
      coordinate={displayCoord}
      tracksViewChanges={trackChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={displayRotation}
      zIndex={10}
      onPress={onPress}
    >
      <View style={styles.activeWrap}>
        <Icon name="car-sports" size={26} color="#C9A84C" />
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  activeWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A2E',
    borderWidth: 2.5,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for depth
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  nearbyWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A2E',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});

export default React.memo(DriverMarker);
