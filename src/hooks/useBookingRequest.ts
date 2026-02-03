import { useCallback, useEffect, useMemo } from 'react';
import socketService from '../services/socketService';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { addBookingRequest, removeBookingRequest } from '../redux/slices/bookingSlice';
import { addNotification } from '../redux/slices/notificationSlice';

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

export const useBookingRequest = (): UseBookingRequestResult => {
  const dispatch = useAppDispatch();
  const pendingRequests = useAppSelector((s) => s.booking.bookingRequests);

  useEffect(() => {
    let active = true;

    const onOffer = (data: any) => {
      if (!active) return;
      dispatch(addBookingRequest(data));
      dispatch(
        addNotification({
          type: 'booking_request',
          message: 'New booking request received',
          bookingId: String(data?.bookingId ?? data?.id ?? ''),
        })
      );
    };

    const onOfferRemoved = (data: any) => {
      if (!active) return;
      const bookingId = String(data?.bookingId || '');
      if (bookingId) {
        dispatch(removeBookingRequest(bookingId));
      }
    };

    const onBookingCancelled = (data: any) => {
      if (!active) return;
      const bookingId = String(data?.bookingId || '');
      if (bookingId) {
        dispatch(removeBookingRequest(bookingId));
      }
    };

    const ensure = async () => {
      try {
        await socketService.connect();
      } catch {
      }

      socketService.on('booking:offer', onOffer);
      socketService.on('booking:new-request', onOffer);
      socketService.on('booking:offer-removed', onOfferRemoved);
      socketService.on('booking:cancelled', onBookingCancelled);
    };

    ensure();

    return () => {
      active = false;
      socketService.off('booking:offer', onOffer);
      socketService.off('booking:new-request', onOffer);
      socketService.off('booking:offer-removed', onOfferRemoved);
      socketService.off('booking:cancelled', onBookingCancelled);
    };
  }, [dispatch]);

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
