/**
 * DriverMarker — Production-grade Uber/Ola-style animated car marker.
 *
 * Design decisions based on industry best-practices:
 *
 * 1. **PNG image (`car_top.png`) instead of inline SVG**
 *    SVG-inside-Marker is notoriously unreliable on Android — the native bridge
 *    must snapshot the React view as a bitmap on every `tracksViewChanges` tick,
 *    which causes blank/flickering markers.  Uber, Ola, and Grab all use
 *    pre-rendered PNG/WebP assets for their vehicle markers.
 *
 * 2. **`Marker.Animated` + `AnimatedRegion`**
 *    On Android, `animateMarkerToCoordinate()` delegates interpolation to the
 *    native Google Maps SDK, giving buttery-smooth 60 fps movement without JS
 *    thread pressure.  On iOS, we fall back to `Animated.timing` on the
 *    `AnimatedRegion` which is equally smooth.
 *
 * 3. **`tracksViewChanges` strategy**
 *    We start with `tracksViewChanges={true}` so the PNG bitmap is captured
 *    once on first render, then flip to `false` after the image's `onLoad`
 *    fires. After that, only `coordinate` and `rotation` props change — both
 *    handled natively without bitmap re-capture.
 *
 * 4. **Rotation**
 *    Calculated from successive GPS points (bearing formula) or from the road
 *    segment when snapping to a polyline.  Applied via the `rotation` Marker
 *    prop (native) rather than a JS `transform` — avoids extra bitmap renders.
 *
 * 5. **Marker size**
 *    38 × 38 dp — large enough to be clearly visible on high-DPI screens,
 *    small enough not to obscure the map.  Matches Uber's vehicle icon sizing.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Image, StyleSheet, Platform, Animated } from 'react-native';
import { Marker, AnimatedRegion } from 'react-native-maps';

// Create AnimatedMarker component — this is more type-safe than the
// exported MarkerAnimated which has incomplete JSX typings.
const AnimatedMarker = Animated.createAnimatedComponent(Marker);

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  /** Decoded polyline coords — used to snap position & derive road-bearing */
  routeCoordinates?: { latitude: number; longitude: number }[] | null;
  onPress?: () => void;
};

// ── Pre-require at module level — cached by Metro, available on first render ──
const CAR_IMAGE = require('../../../assets/markers/car_top.png');

// Marker rendered size (dp). 38 is the sweet-spot: visible but not obstructive.
const MARKER_SIZE = 38;

// Animation duration for the slide between two GPS points.
// Should be slightly longer than the GPS/socket update interval (~3-5 s)
// so the car appears to move continuously rather than jumping.
const ANIM_DURATION_MS = 1000;

// ── Geometry Helpers ──

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Bearing from point A → B in degrees (0 = North, 90 = East). */
const calcBearing = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/** Fast approximate distance in meters (Pythagoras on lat/lng). */
const fastDist = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

/**
 * Snap a GPS point to the nearest segment on a polyline.
 * Returns the projected coordinate and the segment index, or null if
 * the point is more than 100 m away from the polyline.
 */
const snapToPolyline = (
  point: { latitude: number; longitude: number },
  polyline: { latitude: number; longitude: number }[],
): { coord: { latitude: number; longitude: number }; segIndex: number } | null => {
  if (!polyline || polyline.length < 2) return null;

  let bestDist = Infinity;
  let bestCoord = polyline[0];
  let bestIdx = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];

    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    let t =
      ((point.longitude - a.longitude) * dx +
        (point.latitude - a.latitude) * dy) /
      lenSq;
    t = Math.max(0, Math.min(1, t));

    const proj = {
      latitude: a.latitude + t * dy,
      longitude: a.longitude + t * dx,
    };

    const dist = fastDist(point, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestCoord = proj;
      bestIdx = i;
    }
  }

  if (bestDist > 100) return null;
  return { coord: bestCoord, segIndex: bestIdx };
};

/** Shortest-path angle interpolation (handles 359° → 1° correctly). */
const lerpAngle = (from: number, to: number, t: number): number => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

// ══════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════

const DriverMarker = ({
  latitude,
  longitude,
  heading,
  routeCoordinates,
  onPress,
}: DriverMarkerProps) => {
  // ── Image-ready flag: starts true because require() is sync in Metro ──
  // On Android, the native Marker still needs one render pass to capture
  // the bitmap. We flip to false 200 ms after onLoad to be safe.
  const [imageReady, setImageReady] = useState(false);

  // ── Rotation state (not animated — we update it in JS and pass as prop) ──
  const [rotation, setRotation] = useState(0);
  const prevRotationRef = useRef(0);

  // ── AnimatedRegion for smooth coordinate interpolation ──
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude,
      longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }),
  ).current;

  // Ref for the native marker (Android's `animateMarkerToCoordinate`)
  const markerRef = useRef<any>(null);
  const prevCoordRef = useRef({ latitude, longitude });

  // Rotation animation timer
  const rotAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Core animation effect: fires every time the incoming coordinate changes ──
  useEffect(() => {
    const prev = prevCoordRef.current;
    const dLat = Math.abs(latitude - prev.latitude);
    const dLng = Math.abs(longitude - prev.longitude);

    // Skip trivially small updates (GPS jitter)
    if (dLat < 0.000002 && dLng < 0.000002) return;

    // ─ Calculate target position (optionally snapped to road) ─
    const rawTarget = { latitude, longitude };
    let target = rawTarget;
    let targetBearing: number;

    const snapResult = routeCoordinates
      ? snapToPolyline(rawTarget, routeCoordinates)
      : null;

    if (snapResult) {
      target = snapResult.coord;
      const seg = routeCoordinates!;
      const nextIdx = Math.min(snapResult.segIndex + 1, seg.length - 1);
      targetBearing = calcBearing(seg[snapResult.segIndex], seg[nextIdx]);
    } else {
      targetBearing = calcBearing(prev, rawTarget);
    }

    // Override with hardware heading when available
    if (typeof heading === 'number' && Number.isFinite(heading)) {
      targetBearing = heading;
    }

    // ─ Animate coordinate (platform-specific for best performance) ─
    const newCoord = {
      latitude: target.latitude,
      longitude: target.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };

    if (Platform.OS === 'android') {
      // Native Android SDK handles the interpolation on the GPU
      markerRef.current?.animateMarkerToCoordinate?.(
        { latitude: target.latitude, longitude: target.longitude },
        ANIM_DURATION_MS,
      );
    } else {
      // iOS: use Animated.timing on AnimatedRegion
      animatedCoord
        .timing({
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
          duration: ANIM_DURATION_MS,
          useNativeDriver: false,
          toValue: 0, // Required by TimingAnimationConfig but unused by AnimatedRegion
        } as any)
        .start();
    }

    // ─ Smooth rotation interpolation (JS-side, updates via setState) ─
    if (rotAnimRef.current) {
      clearInterval(rotAnimRef.current);
      rotAnimRef.current = null;
    }

    const startRot = prevRotationRef.current;
    const startTime = Date.now();

    rotAnimRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / ANIM_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out

      setRotation(lerpAngle(startRot, targetBearing, eased));

      if (progress >= 1) {
        if (rotAnimRef.current) {
          clearInterval(rotAnimRef.current);
          rotAnimRef.current = null;
        }
        prevRotationRef.current = targetBearing;
      }
    }, 16);

    prevCoordRef.current = target;

    return () => {
      if (rotAnimRef.current) {
        clearInterval(rotAnimRef.current);
        rotAnimRef.current = null;
      }
    };
  }, [latitude, longitude, heading, routeCoordinates, animatedCoord]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rotAnimRef.current) clearInterval(rotAnimRef.current);
    };
  }, []);

  return (
    <AnimatedMarker
      ref={markerRef}
      coordinate={animatedCoord as any}
      rotation={rotation}
      flat
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={!imageReady}
      zIndex={10}
      onPress={onPress}
    >
      <Image
        source={CAR_IMAGE}
        style={styles.carImage}
        resizeMode="contain"
        onLoad={() => {
          // Small delay to guarantee Android has captured the bitmap
          setTimeout(() => setImageReady(true), 200);
        }}
      />
    </AnimatedMarker>
  );
};

const styles = StyleSheet.create({
  carImage: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
  },
});

export default React.memo(DriverMarker);
