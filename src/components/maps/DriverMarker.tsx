import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Path, Rect } from 'react-native-svg';

export type DriverMarkerProps = {
  latitude: number;
  longitude: number;
  heading?: number;
  routeCoordinates?: { latitude: number; longitude: number }[] | null;
  onPress?: () => void;
};

// ── Geometry Helpers ──

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Bearing from A to B in degrees (0 = North, 90 = East) */
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

/** Find the closest point on a polyline to a given coordinate */
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

    // Project point onto segment A→B
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    let t = ((point.longitude - a.longitude) * dx + (point.latitude - a.latitude) * dy) / lenSq;
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

  // Only snap if within 100m of the polyline
  if (bestDist > 100) return null;
  return { coord: bestCoord, segIndex: bestIdx };
};

/** Smooth shortest-path angle interpolation */
const lerpAngle = (from: number, to: number, t: number): number => {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

// ── Animation Constants ──
const ANIM_DURATION = 1200; // Slide duration (ms) — slightly longer than socket interval for smoothness
const FRAME_MS = 16; // ~60fps

// ── SVG sizing: large enough to prevent Android bitmap clipping ──
const SVG_W = 22;
const SVG_H = 32;
const WRAPPER = 48;

const DriverMarker = ({
  latitude,
  longitude,
  heading,
  routeCoordinates,
  onPress,
}: DriverMarkerProps) => {
  const [displayCoord, setDisplayCoord] = useState({ latitude, longitude });
  const [displayRotation, setDisplayRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const prevCoordRef = useRef({ latitude, longitude });
  const prevRotationRef = useRef(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth sliding along road + rotation
  useEffect(() => {
    const prev = prevCoordRef.current;
    const dLat = Math.abs(latitude - prev.latitude);
    const dLng = Math.abs(longitude - prev.longitude);
    if (dLat < 0.000002 && dLng < 0.000002) return;

    // Enable bitmap rendering during animation
    setIsAnimating(true);

    // Safety timeout: force-stop tracksViewChanges after 2s in case animation gets stuck
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => setIsAnimating(false), 2000);

    // Try to snap the new position to the polyline (road-following)
    const rawTarget = { latitude, longitude };
    let target = rawTarget;
    let targetBearing: number;

    const snapResult = routeCoordinates ? snapToPolyline(rawTarget, routeCoordinates) : null;

    if (snapResult) {
      target = snapResult.coord;
      // Use the road segment bearing for rotation (much smoother than point-to-point)
      const seg = routeCoordinates!;
      const nextIdx = Math.min(snapResult.segIndex + 1, seg.length - 1);
      targetBearing = calcBearing(seg[snapResult.segIndex], seg[nextIdx]);
    } else {
      // No polyline or too far from road — use direct point-to-point bearing
      targetBearing = calcBearing(prev, rawTarget);
    }

    // Override with hardware heading if available (GPS compass)
    if (typeof heading === 'number' && Number.isFinite(heading)) {
      targetBearing = heading;
    }

    // Cancel existing animation
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }

    const startLat = prev.latitude;
    const startLng = prev.longitude;
    const startRot = prevRotationRef.current;
    const startTime = Date.now();

    animRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / ANIM_DURATION);
      // Cubic ease-out for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate position
      setDisplayCoord({
        latitude: startLat + (target.latitude - startLat) * eased,
        longitude: startLng + (target.longitude - startLng) * eased,
      });

      // Smoothly interpolate rotation (takes shortest path around 360°)
      setDisplayRotation(lerpAngle(startRot, targetBearing, eased));

      if (progress >= 1) {
        if (animRef.current) {
          clearInterval(animRef.current);
          animRef.current = null;
        }
        prevCoordRef.current = target;
        prevRotationRef.current = targetBearing;
        // Disable bitmap rendering after animation completes — stops Android blinking
        setIsAnimating(false);
      }
    }, FRAME_MS);

    return () => {
      if (animRef.current) {
        clearInterval(animRef.current);
        animRef.current = null;
      }
    };
  }, [latitude, longitude, heading, routeCoordinates]);

  useEffect(() => {
    return () => {
      if (animRef.current) clearInterval(animRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  return (
    <Marker
      coordinate={displayCoord}
      tracksViewChanges={isAnimating}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={displayRotation}
      zIndex={10}
      onPress={onPress}
    >
      <View style={styles.wrapper}>
        <Svg
          width={SVG_W}
          height={SVG_H}
          viewBox="0 0 47 47"
          preserveAspectRatio="xMidYMid meet"
        >
          <Rect x="0" y="0" width="47" height="47" fill="transparent" />
          <Path
            d="M29.395,0H17.636c-3.117,0-5.643,3.467-5.643,6.584v34.804c0,3.116,2.526,5.644,5.643,5.644h11.759 c3.116,0,5.644-2.527,5.644-5.644V6.584C35.037,3.467,32.511,0,29.395,0z M34.05,14.188v11.665l-2.729,0.351v-4.806L34.05,14.188z M32.618,10.773c-1.016,3.9-2.219,8.51-2.219,8.51H16.631l-2.222-8.51C14.41,10.773,23.293,7.755,32.618,10.773z M15.741,21.713 v4.492l-2.73-0.349V14.502L15.741,21.713z M13.011,37.938V27.579l2.73,0.343v8.196L13.011,37.938z M14.568,40.882l2.218-3.336 h13.771l2.219,3.336H14.568z M31.321,35.805v-7.872l2.729-0.355v10.048L31.321,35.805z"
            fill="#C9A84C"
            stroke="#1A1A2E"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: WRAPPER,
    height: WRAPPER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default React.memo(DriverMarker);
