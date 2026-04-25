import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

// ── Branding PNG — rendered natively by Google Maps, instant and reliable ──
// This avoids the SVG-inside-Marker black-triangle bug on Android.
const CAR_PNG = require('../../../assets/markers/car_top.png');

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  routeCoordinates?: { latitude: number; longitude: number }[] | null;
  onPress?: () => void;
  /** If true, renders a small circular marker — used for nearby-drivers on HomeScreen */
  isNearby?: boolean;
};

// ── Geometry Helpers ──
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Bearing from A→B in degrees (0 = North) */
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

/** Fast approximate distance in meters */
const fastDist = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

/** Smooth shortest-path angle interpolation */
const lerpAngle = (from: number, to: number, t: number): number => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

/** Find the closest point on a polyline and return the road segment bearing */
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
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  if (bestDist > 100) return null; // Too far from road — don't use road bearing
  const nextIdx = Math.min(bestIdx + 1, polyline.length - 1);
  return calcBearing(polyline[bestIdx], polyline[nextIdx]);
};

// ── Animation Constants (matching Uber's feel) ──
const ANIM_DURATION = 1000; // 1 second smooth slide
const FRAME_MS = 16; // ~60fps

// ── PNG Icon Size ──
// Uber uses ~40×40dp car icons. Slightly wider for top-view cars.
const ICON_W = 44;
const ICON_H = 60;

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

  const prevCoordRef = useRef({ latitude, longitude });
  const prevRotationRef = useRef(heading ?? 0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Smooth position + rotation animation ──
  useEffect(() => {
    const prev = prevCoordRef.current;
    const dLat = Math.abs(latitude - prev.latitude);
    const dLng = Math.abs(longitude - prev.longitude);
    // Skip if movement is sub-meter (noise)
    if (dLat < 0.000002 && dLng < 0.000002) return;

    // Cancel any running animation
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }

    // Determine target bearing
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
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayCoord({
        latitude: startLat + (latitude - startLat) * eased,
        longitude: startLng + (longitude - startLng) * eased,
      });
      setDisplayRotation(lerpAngle(startRot, targetBearing, eased));

      if (progress >= 1) {
        if (animRef.current) {
          clearInterval(animRef.current);
          animRef.current = null;
        }
        prevCoordRef.current = { latitude, longitude };
        prevRotationRef.current = targetBearing;
      }
    }, FRAME_MS);

    return () => {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    };
  }, [latitude, longitude, heading, routeCoordinates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, []);

  if (isNearby) {
    // ── Nearby-driver indicator: simple pulsing circle with car icon ──
    // Used on HomeScreen / RideConfirmScreen when searching for a driver
    return (
      <Marker
        coordinate={displayCoord}
        tracksViewChanges={false}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={6}
        onPress={onPress}
      >
        <View style={styles.nearbyWrapper}>
          <Image
            source={CAR_PNG}
            style={styles.nearbyIcon}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>
      </Marker>
    );
  }

  // ── Active driver marker: full-size PNG with rotation ──
  // We use the `image` prop directly where possible (most reliable on Android),
  // but we need rotation — so we use a View wrapper with tracksViewChanges managed carefully.
  return (
    <Marker
      coordinate={displayCoord}
      // tracksViewChanges={false} keeps the bitmap stable; we force a brief true when position changes
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={displayRotation}
      zIndex={10}
      onPress={onPress}
    >
      <Image
        source={CAR_PNG}
        style={styles.carIcon}
        resizeMode="contain"
        fadeDuration={0}
      />
    </Marker>
  );
};

const styles = StyleSheet.create({
  // Active driver car icon
  carIcon: {
    width: ICON_W,
    height: ICON_H,
  },

  // Nearby (searching) driver marker
  nearbyWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,15,0.82)',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  nearbyIcon: {
    width: 24,
    height: 24,
    tintColor: '#C9A84C',
  },
});

export default React.memo(DriverMarker);
