/**
 * DriverMarker — Production-grade car marker (Uber/Rapido style).
 *
 * ══ WHY image PROP (NOT child <Image>) ══
 * Using Marker's `image` prop renders via native BitmapDescriptorFactory in Google Maps SDK.
 * Child <Image> views require React Native bitmap capture (tracksViewChanges) which causes:
 *   - Marker clipped/cut on Android — native Marker container clips child view before capture
 *   - Marker invisible if tracksViewChanges=false before image finishes layout
 *   - Bitmap capture timing issues on slow/budget Android devices
 * The `image` prop bypasses all of this — zero clipping, works on every device/density.
 * PNG is 64×64px → correct size at all screen densities (21dp on 3x, 43dp on 1.5x).
 *
 * ══ PIPELINE ══
 * Raw GPS → Snap to polyline → Clamp forward-only → Segment bearing →
 * Lerp bearing (wraparound safe) → RAF lerp coordinate → trim polyline
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Image } from 'react-native';
import { Marker } from 'react-native-maps';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type Coord = { latitude: number; longitude: number };

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  routeCoordinates?: Coord[] | null;
  onRemainingRoute?: (remaining: Coord[]) => void;
  onPress?: () => void;
};

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

const CAR_IMAGE = require('../../../assets/markers/car_top.png');
export { CAR_IMAGE };

const ANIM_MS = 1000;
const SNAP_RADIUS_M = 200;

/**
 * Fixed marker size in dp — guarantees the same visual size on ALL devices
 * regardless of screen density (1x, 2x, 3x, tablet, emulator, Expo Go, dev client).
 * Using the `image` prop renders at native PNG pixel size which varies by DPI.
 */
const MARKER_SIZE_DP = 40;

// ─────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function distM(a: Coord, b: Coord): number {
  const dLat = (b.latitude - a.latitude) * 111_320;
  const dLng =
    (b.longitude - a.longitude) *
    111_320 *
    Math.cos(toRad((a.latitude + b.latitude) / 2));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function calcBearing(a: Coord, b: Coord): number {
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function lerpBearing(from: number, to: number, t: number): number {
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (from + diff * t + 360) % 360;
}

function closestOnSeg(P: Coord, A: Coord, B: Coord): Coord {
  const dx = B.longitude - A.longitude;
  const dy = B.latitude - A.latitude;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return A;
  let t = ((P.longitude - A.longitude) * dx + (P.latitude - A.latitude) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { latitude: A.latitude + t * dy, longitude: A.longitude + t * dx };
}

function searchSegs(
  raw: Coord, poly: Coord[], from: number, to: number,
): { snapped: Coord; segIdx: number; dist: number } | null {
  let bestDist = Infinity;
  let bestSnapped: Coord = poly[from] ?? poly[0];
  let bestIdx = from;
  const end = Math.min(to, poly.length - 1);
  for (let i = from; i < end; i++) {
    const snapped = closestOnSeg(raw, poly[i], poly[i + 1]);
    const dist = distM(raw, snapped);
    if (dist < bestDist) {
      bestDist = dist;
      bestSnapped = snapped;
      bestIdx = i;
    }
  }
  if (bestDist > SNAP_RADIUS_M) return null;
  return { snapped: bestSnapped, segIdx: bestIdx, dist: bestDist };
}

function snapToPolyline(
  raw: Coord,
  poly: Coord[],
  minSegIdx: number,
): { snapped: Coord; segIdx: number } | null {
  if (!poly || poly.length < 2) return null;

  const fwd = searchSegs(raw, poly, minSegIdx, poly.length);
  if (fwd) return { snapped: fwd.snapped, segIdx: fwd.segIdx };

  if (minSegIdx > 0) {
    const full = searchSegs(raw, poly, 0, poly.length);
    if (full) return { snapped: full.snapped, segIdx: full.segIdx };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

const DriverMarker = React.memo(
  ({
    latitude,
    longitude,
    heading,
    routeCoordinates,
    onRemainingRoute,
    onPress,
  }: DriverMarkerProps) => {
    const [displayCoord, setDisplayCoord] = useState<Coord>({ latitude, longitude });
    const [rotation, setRotation] = useState(0);
    // tracksViewChanges=true initially so React Native captures the child image bitmap.
    // Disabled after 600ms — image is static so it never needs re-capture.
    // This gives consistent size on ALL devices without Android clipping issues.
    const [tracksViewChanges, setTracksViewChanges] = useState(true);

    // ── Persistent refs ──
    const prevCoordRef   = useRef<Coord>({ latitude, longitude });
    const prevBearingRef = useRef(0);
    const lastSegIdxRef  = useRef(0);
    const animFrameRef   = useRef<number | null>(null);
    const isFirstRef     = useRef(true);
    const prevPolyRef    = useRef(routeCoordinates);

    // Reset forward-clamp when polyline changes
    useEffect(() => {
      if (routeCoordinates !== prevPolyRef.current) {
        prevPolyRef.current = routeCoordinates;
        lastSegIdxRef.current = 0;
        isFirstRef.current = true;
      }
    }, [routeCoordinates]);

    // Cleanup animation frame on unmount
    useEffect(
      () => () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      },
      [],
    );

    // Disable view-tracking after first capture (image is static — no re-render needed)
    useEffect(() => {
      const t = setTimeout(() => setTracksViewChanges(false), 600);
      return () => clearTimeout(t);
    }, []);

    // ── Main GPS update ──
    useEffect(() => {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const poly =
        routeCoordinates && routeCoordinates.length >= 2 ? routeCoordinates : null;

      // Skip stale/emulator coords (>50km from route start)
      if (poly && poly[0]) {
        const dLat = Math.abs(latitude - poly[0].latitude);
        const dLng = Math.abs(longitude - poly[0].longitude);
        const roughKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
        if (roughKm > 50) return;
      }

      const rawCoord: Coord = { latitude, longitude };

      let target: Coord = rawCoord;
      let segIdx = lastSegIdxRef.current;
      let targetBearing = prevBearingRef.current;

      if (poly) {
        const snap = snapToPolyline(rawCoord, poly, lastSegIdxRef.current);
        if (snap) {
          target = snap.snapped;
          segIdx = snap.segIdx;
          lastSegIdxRef.current = segIdx;

          const nextIdx = Math.min(segIdx + 1, poly.length - 1);
          targetBearing = calcBearing(poly[segIdx], poly[nextIdx]);

          if (onRemainingRoute) {
            onRemainingRoute([target, ...poly.slice(segIdx + 1)]);
          }
        } else {
          const moved = distM(prevCoordRef.current, rawCoord);
          if (moved > 3) targetBearing = calcBearing(prevCoordRef.current, rawCoord);
        }
      } else {
        if (typeof heading === 'number' && Number.isFinite(heading)) {
          targetBearing = heading;
        } else {
          const moved = distM(prevCoordRef.current, rawCoord);
          if (moved > 3) targetBearing = calcBearing(prevCoordRef.current, rawCoord);
        }
      }

      const movedM = distM(prevCoordRef.current, target);
      if (!isFirstRef.current && movedM < 0.5) return;
      isFirstRef.current = false;

      const from = { ...prevCoordRef.current };
      const fromBearing = prevBearingRef.current;
      prevCoordRef.current = target;
      prevBearingRef.current = targetBearing;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const startTime = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - startTime) / ANIM_MS, 1);
        setDisplayCoord({
          latitude:  lerp(from.latitude,  target.latitude,  t),
          longitude: lerp(from.longitude, target.longitude, t),
        });
        setRotation(lerpBearing(fromBearing, targetBearing, t));
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }, [latitude, longitude, heading, routeCoordinates]);

    return (
      <Marker
        coordinate={displayCoord}
        rotation={rotation}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
        tracksViewChanges={tracksViewChanges}
        zIndex={10}
        onPress={onPress}
      >
        {/* Fixed dp size — same on all screens/densities/emulators */}
        <Image
          source={CAR_IMAGE}
          style={{ width: MARKER_SIZE_DP, height: MARKER_SIZE_DP }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Marker>
    );
  },
);

export default DriverMarker;
