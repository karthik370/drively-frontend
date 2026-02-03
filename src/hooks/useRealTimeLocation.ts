import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import locationService from '../services/locationService';
import socketService from '../services/socketService';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { setLocationError, setLocationPermissions, setTrackingActive, updateLocation } from '../redux/slices/locationSlice';

export type UseRealTimeLocationResult = {
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    timestamp?: string;
  } | null;
  isTracking: boolean;
  error: string | null;
  requestPermissions: () => Promise<boolean>;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
};

const toFinite = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

const distanceApproxMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

export const useRealTimeLocation = (
  isActive: boolean,
  trackingType: 'foreground' | 'background',
  bookingId?: string
): UseRealTimeLocationResult => {
  const dispatch = useAppDispatch();
  const currentLocation = useAppSelector((s) => s.location.currentLocation);
  const isOnline = useAppSelector((s) => (s as any).driver?.isOnline ?? false);
  const user = useAppSelector((s) => s.auth.user);

  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);

  const fgSubRef = useRef<Location.LocationSubscription | null>(null);
  const fgModeRef = useRef<'normal' | 'lowPower'>('normal');
  const stationaryCountRef = useRef<number>(0);
  const lastCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const lastSocketEmitCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastSocketEmitTsRef = useRef<number>(0);

  const clearSubscription = useCallback(() => {
    try {
      fgSubRef.current?.remove();
    } catch {
    }
    fgSubRef.current = null;
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      const hasFg = fg.status === 'granted';

      let hasBg = false;
      const wantsBg = trackingType === 'background' && (user?.userType === 'DRIVER' || user?.userType === 'BOTH');

      if (hasFg && wantsBg) {
        const bg = await Location.requestBackgroundPermissionsAsync();
        hasBg = bg.status === 'granted';
      }

      dispatch(setLocationPermissions({ hasLocationPermission: hasFg, hasBackgroundPermission: hasBg }));

      if (!hasFg) {
        const msg = 'Location permission not granted';
        dispatch(setLocationError(msg));
        setError(msg);
        return false;
      }

      dispatch(setLocationError(''));
      setError(null);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to request location permission';
      dispatch(setLocationError(msg));
      setError(msg);
      return false;
    }
  }, [dispatch, trackingType, user?.userType]);

  const startForeground = useCallback(async () => {
    const ok = await requestPermissions();
    if (!ok) return;

    clearSubscription();
    fgModeRef.current = 'normal';
    stationaryCountRef.current = 0;

    const ensureSocket = async () => {
      if (!socketService.isConnected()) {
        await socketService.connect();
      }
    };

    const startWatch = async (mode: 'normal' | 'lowPower') => {
      const timeInterval = mode === 'normal' ? 2000 : 15000;
      const distanceInterval = mode === 'normal' ? 5 : 25;

      fgSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval,
          distanceInterval,
        },
        async (loc) => {
          const latitude = loc.coords.latitude;
          const longitude = loc.coords.longitude;

          const next = {
            latitude,
            longitude,
            accuracy: toFinite(loc.coords.accuracy) ?? undefined,
            heading: toFinite(loc.coords.heading) ?? undefined,
            speed: toFinite(loc.coords.speed) ?? undefined,
            timestamp: typeof loc.timestamp === 'number' ? new Date(loc.timestamp).toISOString() : undefined,
          };

          dispatch(updateLocation(next));

          const prev = lastCoordRef.current;
          lastCoordRef.current = { latitude, longitude };

          const moved = prev ? distanceApproxMeters(prev, { latitude, longitude }) : 999;
          const speed = typeof loc.coords.speed === 'number' ? loc.coords.speed : null;

          if (moved < 5 && (speed === null || speed < 0.5)) {
            stationaryCountRef.current += 1;
          } else {
            stationaryCountRef.current = 0;
          }

          if (fgModeRef.current === 'normal' && stationaryCountRef.current >= 3) {
            fgModeRef.current = 'lowPower';
            try {
              clearSubscription();
              await startWatch('lowPower');
            } catch {
            }
            return;
          }

          if (fgModeRef.current === 'lowPower' && (moved >= 8 || (speed !== null && speed >= 1))) {
            fgModeRef.current = 'normal';
            stationaryCountRef.current = 0;
            try {
              clearSubscription();
              await startWatch('normal');
            } catch {
            }
          }

          try {
            if (isOnline) {
              await ensureSocket();
              const now = Date.now();
              const prevEmit = lastSocketEmitCoordRef.current;
              const movedSinceEmit = prevEmit ? distanceApproxMeters(prevEmit, { latitude, longitude }) : 999;

              const minEmitIntervalMs = 2500;
              const maxEmitIntervalMs = 8000;
              const shouldEmit =
                now - lastSocketEmitTsRef.current >= maxEmitIntervalMs ||
                (now - lastSocketEmitTsRef.current >= minEmitIntervalMs && movedSinceEmit >= 7);

              if (shouldEmit) {
                lastSocketEmitTsRef.current = now;
                lastSocketEmitCoordRef.current = { latitude, longitude };
                socketService.updateDriverLocation({
                  bookingId,
                  latitude,
                  longitude,
                  speed: typeof loc.coords.speed === 'number' ? loc.coords.speed : undefined,
                  heading: typeof loc.coords.heading === 'number' ? loc.coords.heading : undefined,
                });
              }
            }
          } catch {
          }
        }
      );
    };

    await startWatch('normal');
    setIsTracking(true);
    dispatch(setTrackingActive({ isTracking: true, trackingType: 'foreground' }));
  }, [bookingId, clearSubscription, dispatch, isOnline, requestPermissions]);

  const startBackground = useCallback(async () => {
    const ok = await requestPermissions();
    if (!ok) return;

    clearSubscription();

    const started = await locationService.startBackgroundTracking();
    if (!started) {
      const msg = 'Background tracking is not available on this build';
      setError(msg);
      dispatch(setLocationError(msg));
      setIsTracking(false);
      return;
    }

    setIsTracking(true);
    dispatch(setTrackingActive({ isTracking: true, trackingType: 'background' }));
  }, [clearSubscription, dispatch, requestPermissions]);

  const startTracking = useCallback(async () => {
    try {
      setError(null);
      dispatch(setLocationError(''));

      if (trackingType === 'background') {
        await startBackground();
      } else {
        await startForeground();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start tracking';
      setError(msg);
      dispatch(setLocationError(msg));
      setIsTracking(false);
      dispatch(setTrackingActive({ isTracking: false, trackingType: null }));
    }
  }, [dispatch, startBackground, startForeground, trackingType]);

  const stopTracking = useCallback(async () => {
    try {
      clearSubscription();
      await locationService.stopBackgroundTracking();
    } catch {
    } finally {
      setIsTracking(false);
      dispatch(setTrackingActive({ isTracking: false, trackingType: null }));
    }
  }, [clearSubscription, dispatch]);

  useEffect(() => {
    if (!isActive) {
      stopTracking();
      return;
    }

    startTracking();

    return () => {
      stopTracking();
    };
  }, [isActive, startTracking, stopTracking]);

  useEffect(() => {
    const handler = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (!isActive) return;
      if (!isTracking) return;

      try {
        if (isOnline && !socketService.isConnected()) {
          await socketService.connect();
        }
      } catch {
      }
    };

    const sub = AppState.addEventListener('change', handler);
    return () => {
      sub.remove();
    };
  }, [isActive, isOnline, isTracking]);

  const memo = useMemo(() => {
    return {
      currentLocation,
      isTracking,
      error,
      requestPermissions,
      startTracking,
      stopTracking,
    };
  }, [currentLocation, error, isTracking, requestPermissions, startTracking, stopTracking]);

  return memo;
};

export default useRealTimeLocation;
