import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Polyline } from 'react-native-maps';

export type RoutePolylineCoordinate = { latitude: number; longitude: number };

export type TrafficSegment = {
  startIndex: number;
  endIndex: number;
  color: string;
};

export type RoutePolylineProps = {
  coordinates: RoutePolylineCoordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  animated?: boolean;
  trafficSegments?: TrafficSegment[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const RoutePolyline = ({
  coordinates,
  strokeColor = '#1E90FF',
  strokeWidth = 5,
  animated = true,
  trafficSegments,
}: RoutePolylineProps) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [visibleCount, setVisibleCount] = useState<number>(coordinates.length);
  const hasAnimatedRef = useRef<boolean>(false);

  const safeCoords = useMemo(() => {
    return Array.isArray(coordinates) ? coordinates.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) : [];
  }, [coordinates]);

  useEffect(() => {
    // Already animated once — show full polyline immediately on recalculations
    if (hasAnimatedRef.current || !animated) {
      setVisibleCount(safeCoords.length);
      return;
    }

    if (safeCoords.length < 2) {
      setVisibleCount(safeCoords.length);
      return;
    }

    // First-time draw-in animation only
    hasAnimatedRef.current = true;

    const id = progress.addListener(({ value }) => {
      const target = clamp(Math.floor(value * safeCoords.length), 2, safeCoords.length);
      setVisibleCount(target);
    });

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      useNativeDriver: false,
    }).start();

    return () => {
      progress.removeListener(id);
    };
  }, [animated, progress, safeCoords.length]);

  const visibleCoords = useMemo(() => {
    if (safeCoords.length <= visibleCount) return safeCoords;
    return safeCoords.slice(0, Math.max(2, visibleCount));
  }, [safeCoords, visibleCount]);

  if (visibleCoords.length < 2) return null;

  const segments = Array.isArray(trafficSegments) && trafficSegments.length ? trafficSegments : null;

  if (!segments) {
    return <Polyline coordinates={visibleCoords} strokeColor={strokeColor} strokeWidth={strokeWidth} />;
  }

  return (
    <>
      {segments.map((s, idx) => {
        const start = clamp(s.startIndex, 0, visibleCoords.length - 1);
        const end = clamp(s.endIndex, start + 1, visibleCoords.length);
        const coords = visibleCoords.slice(start, end);
        if (coords.length < 2) return null;
        return (
          <Polyline
            key={`${idx}-${start}-${end}`}
            coordinates={coords}
            strokeColor={s.color}
            strokeWidth={strokeWidth}
          />
        );
      })}
    </>
  );
};

export default React.memo(RoutePolyline);
