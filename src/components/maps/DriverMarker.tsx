/**
 * DriverMarker — Production-grade car marker.
 *
 * Uses plain `<Marker>` (NOT Marker.Animated/AnimatedRegion) to avoid
 * marker drift during pinch-zoom on Android.
 *
 * Rotation: ALWAYS from polyline segment when available (not GPS compass
 * which is wildly inaccurate on most Android phones). Falls back to
 * movement bearing only when no polyline is provided.
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

const CAR_IMAGE = require('../../../assets/markers/car_top.png');
const MARKER_SIZE = 28;
const ANIM_DURATION_MS = 1000;

// ── Geometry ──

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
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const fastDist = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

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

  // Allow up to 150m snap distance (roads can be offset from GPS)
  if (bestDist > 150) return null;
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
  const [imageReady, setImageReady] = useState(false);
  const [coord, setCoord] = useState({ latitude, longitude });
  const [rotation, setRotation] = useState(0);

  const markerRef = useRef<any>(null);
  const prevCoordRef = useRef({ latitude, longitude });
  const prevRotationRef = useRef(0);

  useEffect(() => {
    const prev = prevCoordRef.current;
    const dLat = Math.abs(latitude - prev.latitude);
    const dLng = Math.abs(longitude - prev.longitude);

    // Skip trivially small updates (GPS jitter)
    if (dLat < 0.000002 && dLng < 0.000002) return;

    const rawTarget = { latitude, longitude };
    let target = rawTarget;
    let targetBearing: number = prevRotationRef.current; // Default: keep current rotation

    // ── PRIORITY 1: Snap to polyline & use road segment bearing ──
    // This gives the cleanest rotation — always pointing along the road.
    // GPS compass heading is wildly inaccurate on most Android phones,
    // so we NEVER use it when we have a polyline.
    const snapResult = routeCoordinates
      ? snapToPolyline(rawTarget, routeCoordinates)
      : null;

    if (snapResult) {
      target = snapResult.coord;
      const seg = routeCoordinates!;
      const nextIdx = Math.min(snapResult.segIndex + 1, seg.length - 1);
      // Use the FORWARD direction of the road segment
      if (snapResult.segIndex !== nextIdx) {
        targetBearing = calcBearing(seg[snapResult.segIndex], seg[nextIdx]);
      }
    } else {
      // ── PRIORITY 2: Use movement bearing (only if moved significantly) ──
      const movedMeters = fastDist(prev, rawTarget);
      if (movedMeters > 5) {
        targetBearing = calcBearing(prev, rawTarget);
      }
      // If moved < 5m, keep previous rotation (prevents jitter)
    }

    // ── Move the marker ──
    if (Platform.OS === 'android' && markerRef.current) {
      markerRef.current.animateMarkerToCoordinate?.(
        { latitude: target.latitude, longitude: target.longitude },
        ANIM_DURATION_MS,
      );
    }
    // Always update coord state (used as fallback on iOS and initial position)
    setCoord({ latitude: target.latitude, longitude: target.longitude });

    // ── Set rotation ──
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
