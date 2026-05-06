/**
 * DriverMarker — Production-grade car marker that does NOT move during zoom.
 *
 * KEY FIX: Uses a plain `<Marker>` (NOT `Marker.Animated` / `AnimatedRegion`).
 * AnimatedRegion caused the marker to visually drift during pinch-zoom on
 * Android because the animation interpolation fights with the map's own
 * coordinate projection during the zoom gesture.
 *
 * Movement: `animateMarkerToCoordinate()` on Android (native SDK handles it).
 * Rotation: Set instantly via the `rotation` prop (no JS-side animation timer).
 * Image: Uses `<Image>` child with `tracksViewChanges={false}` after first render.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Platform } from 'react-native';
import { Marker } from 'react-native-maps';

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  /** Decoded polyline coords — used to snap position & derive road-bearing */
  routeCoordinates?: { latitude: number; longitude: number }[] | null;
  onPress?: () => void;
};

// Pre-require at module level — cached by Metro, available on first render
const CAR_IMAGE = require('../../../assets/markers/car_top.png');

// Marker rendered size (dp). 28 matches Uber's compact vehicle icon.
const MARKER_SIZE = 28;

// Animation duration for the slide between two GPS points.
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
  // Image-ready flag: flip to false after initial bitmap capture
  const [imageReady, setImageReady] = useState(false);

  // Current marker coordinate (state — only updated when GPS changes, NOT during zoom)
  const [coord, setCoord] = useState({ latitude, longitude });
  const [rotation, setRotation] = useState(0);

  // Ref for the native marker (Android's `animateMarkerToCoordinate`)
  const markerRef = useRef<any>(null);
  const prevCoordRef = useRef({ latitude, longitude });
  const prevRotationRef = useRef(0);

  // ── Core effect: fires every time the incoming coordinate changes ──
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

    // ─ Move the marker ─
    if (Platform.OS === 'android' && markerRef.current) {
      // Native Android SDK handles the interpolation on the GPU — no drift during zoom
      markerRef.current.animateMarkerToCoordinate?.(
        { latitude: target.latitude, longitude: target.longitude },
        ANIM_DURATION_MS,
      );
    } else {
      // iOS or fallback: set coordinate directly (instant move)
      setCoord({ latitude: target.latitude, longitude: target.longitude });
    }

    // ─ Set rotation instantly ─
    setRotation(targetBearing);
    prevRotationRef.current = targetBearing;
    prevCoordRef.current = target;
  }, [latitude, longitude, heading, routeCoordinates]);

  return (
    <Marker
      ref={markerRef}
      coordinate={coord}
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
          setTimeout(() => setImageReady(true), 300);
        }}
      />
    </Marker>
  );
};

const styles = StyleSheet.create({
  carImage: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
  },
});

export default React.memo(DriverMarker);
