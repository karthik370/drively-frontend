import { useCallback, useMemo } from 'react';
import socketService from '../services/socketService';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { removeBookingRequest } from '../redux/slices/bookingSlice';

export type UseBookingRequestResult = {
  pendingRequests: Array<{
    id: string;
    pickup?: { address?: string; latitude?: number; longitude?: number };
    drop?: { address?: string; latitude?: number; longitude?: number } | null;
    distanceKm?: number;
    etaMin?: number;
    fare?: number;
    vehicleType?: string;
    transmissionType?: string;
    createdAt: string;
  }>;
  acceptBooking: (bookingId: string) => void;
  rejectBooking: (bookingId: string) => void;
};

// NOTE: booking:offer socket events are handled CENTRALLY in socketService.registerGlobalHandlers().
// useBookingRequest only reads Redux state that socketService populates.
// Do NOT add another socket listener here — it would fire addBookingRequest + addNotification twice.
export const useBookingRequest = (): UseBookingRequestResult => {
  const dispatch = useAppDispatch();
  const pendingRequests = useAppSelector((s) => s.booking.bookingRequests);

  const acceptBooking = useCallback(
    (bookingId: string) => {
      socketService.emit('booking:accept', { bookingId });
      dispatch(removeBookingRequest(bookingId));
    },
    [dispatch]
  );

  const rejectBooking = useCallback(
    (bookingId: string) => {
      socketService.emit('booking:reject', { bookingId });
      dispatch(removeBookingRequest(bookingId));
    },
    [dispatch]
  );

  return useMemo(
    () => ({
      pendingRequests,
      acceptBooking,
      rejectBooking,
    }),
    [acceptBooking, pendingRequests, rejectBooking]
  );
};

export default useBookingRequest;
