import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import socketService from '../services/socketService';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { setDriverLocation, updateETA } from '../redux/slices/locationSlice';
import { updateBookingStatus } from '../redux/slices/bookingSlice';

const distanceApproxMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
};

export type UseDriverTrackingResult = {
  driverLocation: { latitude: number; longitude: number } | null;
  eta: number | null;
  isTracking: boolean;
  error: string | null;
};

export const useDriverTracking = (bookingId: string): UseDriverTrackingResult => {
  const dispatch = useAppDispatch();
  const driverLocation = useAppSelector((s) => s.location.driverLocation);
  const eta = useAppSelector((s) => s.location.eta);

  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const locationHandlerRef = useRef<((data: any) => void) | null>(null);
  const etaHandlerRef = useRef<((data: any) => void) | null>(null);
  const statusHandlerRef = useRef<((data: any) => void) | null>(null);

  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastLocationDispatchTsRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    const start = async () => {
      try {
        await socketService.connect();
        if (!active) return;

        socketService.joinBooking(bookingId);

        locationHandlerRef.current = (data: any) => {
          if (data?.bookingId && String(data.bookingId) !== bookingId) return;
          const latitude = Number(data?.latitude);
          const longitude = Number(data?.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

          const now = Date.now();
          const next: any = { latitude, longitude };
          const prev = lastLocationRef.current;

          // Pass heading through for directional arrow on marker
          const heading = Number(data?.heading);
          if (Number.isFinite(heading)) next.heading = heading;

          const movedMeters = prev ? distanceApproxMeters(prev, next) : Number.POSITIVE_INFINITY;
          // Reduced from 3m to 1m for smoother movement — AnimatedRegion interpolates visually
          if (Number.isFinite(movedMeters) && movedMeters < 1) {
            return;
          }

          // Reduced from 450ms to 200ms — smoother like Uber/Ola
          if (now - lastLocationDispatchTsRef.current < 200 && movedMeters < 15) {
            return;
          }

          lastLocationRef.current = { latitude, longitude };
          lastLocationDispatchTsRef.current = now;
          dispatch(setDriverLocation(next));
        };

        etaHandlerRef.current = (data: any) => {
          if (data?.bookingId && String(data.bookingId) !== bookingId) return;
          const etaVal = Number(data?.eta);
          const distKm = Number(data?.distanceKm);
          // DISABLED: Socket eta:update competes with frontend's own route-based ETA
          // The backend uses Distance Matrix API which gives different values than
          // the Directions API used by frontend, causing flip-flopping
          // if (!Number.isFinite(etaVal)) return;
          // dispatch(updateETA({ eta: etaVal, distance: Number.isFinite(distKm) ? distKm : undefined }));
        };

        statusHandlerRef.current = (data: any) => {
          if (String(data?.bookingId) !== bookingId) return;
          if (typeof data?.status === 'string') {
            dispatch(updateBookingStatus({ id: bookingId, status: data.status }));
          }
        };

        socketService.on('driver:location-update', locationHandlerRef.current);
        // socketService.on('eta:update', etaHandlerRef.current); // Disabled — single source is frontend route calc
        socketService.on('booking:status', statusHandlerRef.current);

        setIsTracking(true);
        setError(null);
      } catch (e) {
        setIsTracking(false);
        setError(e instanceof Error ? e.message : 'Failed to start tracking');
      }
    };

    start();

    return () => {
      active = false;
      try {
        if (bookingId) {
          socketService.leaveBooking(bookingId);
        }
      } catch {
      }

      if (locationHandlerRef.current) {
        socketService.off('driver:location-update', locationHandlerRef.current);
      }

      if (etaHandlerRef.current) {
        socketService.off('eta:update', etaHandlerRef.current);
      }

      if (statusHandlerRef.current) {
        socketService.off('booking:status', statusHandlerRef.current);
      }

      locationHandlerRef.current = null;
      etaHandlerRef.current = null;
      statusHandlerRef.current = null;

      setIsTracking(false);
    };
  }, [bookingId, dispatch]);

  useEffect(() => {
    const handler = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (!bookingId) return;

      try {
        await socketService.connect();
        socketService.joinBooking(bookingId);
      } catch {
      }
    };

    const sub = AppState.addEventListener('change', handler);
    return () => {
      sub.remove();
    };
  }, [bookingId]);

  return useMemo(
    () => ({
      driverLocation,
      eta,
      isTracking,
      error,
    }),
    [driverLocation, error, eta, isTracking]
  );
};

export default useDriverTracking;
