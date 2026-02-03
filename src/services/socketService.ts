import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, SOCKET_URL } from '../constants/config';
import { store } from '../redux/store';
import {
  clearLocations,
  clearDriverLocation,
  clearRoute,
  setDropAddress,
  setDropLocation,
  setDriverLocation,
  setPickupAddress,
  setPickupLocation,
  updateETA,
} from '../redux/slices/locationSlice';
import {
  addBookingRequest,
  clearCurrentBooking,
  removeBookingRequest,
  setCurrentBooking,
  updateBookingFare,
  updateBookingOtp,
  updateBookingStatus,
} from '../redux/slices/bookingSlice';
import { updateUser } from '../redux/slices/authSlice';
import { setDriverVerification } from '../redux/slices/driverSlice';
import { addNotification } from '../redux/slices/notificationSlice';
import { getBookingDetails } from './api';
import { BookingStatus, PaymentMethod, VehicleType } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private isReauthInProgress = false;
  private globalHandlersRegistered = false;
  private lastLocationUpdateTs = 0;
  private lastLocation: { latitude: number; longitude: number } | null = null;

  private distanceApproxMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const dLat = a.latitude - b.latitude;
    const dLng = a.longitude - b.longitude;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await axios.post(`${API_URL}/auth/refresh-token`, {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data?.data || {};
    if (!accessToken || !newRefreshToken) {
      throw new Error('Refresh token failed');
    }

    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', newRefreshToken);

    return accessToken;
  }

  private registerGlobalHandlers() {
    if (!this.socket) return;

    this.socket.on('booking:offer', (data: any) => {
      const current = store.getState().booking.currentBooking;
      const status = String((current as any)?.status ?? '');
      const hasActive = Boolean(
        (current as any)?.id &&
          [
            BookingStatus.REQUESTED,
            BookingStatus.SEARCHING,
            BookingStatus.ACCEPTED,
            BookingStatus.DRIVER_ARRIVING,
            BookingStatus.ARRIVED,
            BookingStatus.STARTED,
            BookingStatus.IN_PROGRESS,
          ].includes(status as any)
      );
      if (hasActive) {
        return;
      }

      store.dispatch(addBookingRequest(data));
      store.dispatch(
        addNotification({
          type: 'booking_request',
          message: 'New booking request received',
          bookingId: String(data?.bookingId ?? data?.id ?? ''),
        })
      );
    });

    this.socket.on('booking:error', (data: any) => {
      const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : undefined;
      const message = typeof data?.message === 'string' ? data.message : 'Booking error';
      store.dispatch(
        addNotification({
          type: 'error',
          message,
          bookingId,
        })
      );
    });

    this.socket.on('booking:status', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      const status = typeof data?.status === 'string' ? data.status : null;
      if (!bookingId || !status) return;
      store.dispatch(updateBookingStatus({ id: bookingId, status }));

      if (status === 'SEARCHING' || status === 'REQUESTED') {
        const current = store.getState().booking.currentBooking;
        if (!current || String(current.id) !== bookingId) return;
        store.dispatch(clearDriverLocation());
        store.dispatch(clearRoute());
        store.dispatch(
          setCurrentBooking({
            ...(current as any),
            status: status as any,
            driver: null,
            otp: null,
          })
        );
      }

      if (status === 'CANCELLED') {
        const currentId = store.getState().booking.currentBooking?.id;
        if (!currentId || String(currentId) !== bookingId) return;
        store.dispatch(clearCurrentBooking());
        store.dispatch(clearLocations());
        store.dispatch(clearRoute());
      }
    });

    this.socket.on('booking:fare-updated', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;

      const totalAmount = typeof data?.totalAmount === 'number' ? data.totalAmount : Number(data?.totalAmount);
      const discountAmount = typeof data?.discountAmount === 'number' ? data.discountAmount : Number(data?.discountAmount);
      const hasTotal = Number.isFinite(totalAmount);
      const hasDiscount = Number.isFinite(discountAmount);

      store.dispatch(
        updateBookingFare({
          id: bookingId,
          totalAmount: hasTotal ? Number(totalAmount) : undefined,
          discountAmount: hasDiscount ? Number(discountAmount) : undefined,
          pricingBreakdown: data?.pricingBreakdown,
        })
      );
    });

    this.socket.on('booking:otp-verified', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      store.dispatch(updateBookingOtp({ id: bookingId, otp: null }));
    });

    this.socket.on('booking:accepted', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      store.dispatch(updateBookingStatus({ id: bookingId, status: 'ACCEPTED' }));

      try {
        this.joinBooking(bookingId);
      } catch {
      }

      void (async () => {
        try {
          const current = store.getState().booking.currentBooking;
          if (current && String(current.id) !== bookingId) {
            return;
          }

          const raw = await getBookingDetails(bookingId);
          const now = new Date().toISOString();

          const pickupLat = Number((raw as any)?.pickupLocationLat);
          const pickupLng = Number((raw as any)?.pickupLocationLng);
          if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
            store.dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
          }
          store.dispatch(setPickupAddress(typeof (raw as any)?.pickupAddress === 'string' ? (raw as any).pickupAddress : null));

          const dropLatRaw = (raw as any)?.dropLocationLat;
          const dropLngRaw = (raw as any)?.dropLocationLng;
          const dropLat = dropLatRaw !== null && dropLatRaw !== undefined ? Number(dropLatRaw) : NaN;
          const dropLng = dropLngRaw !== null && dropLngRaw !== undefined ? Number(dropLngRaw) : NaN;
          if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
            store.dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
          }
          store.dispatch(setDropAddress(typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : null));

          store.dispatch(
            setCurrentBooking({
              id: String((raw as any)?.id ?? bookingId),
              bookingNumber: String((raw as any)?.bookingNumber ?? ''),
              status: ((raw as any)?.status ?? BookingStatus.ACCEPTED) as any,
              customer: (raw as any)?.customer as any,
              driver: (raw as any)?.driver as any,
              otp: (raw as any)?.otp ?? null,
              pickupLocation: {
                latitude: Number.isFinite(pickupLat) ? pickupLat : 0,
                longitude: Number.isFinite(pickupLng) ? pickupLng : 0,
              },
              pickupAddress: String((raw as any)?.pickupAddress ?? 'Pickup'),
              dropLocation:
                Number.isFinite(dropLat) && Number.isFinite(dropLng)
                  ? { latitude: dropLat, longitude: dropLng }
                  : undefined,
              dropAddress: typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : undefined,
              scheduledTime: (raw as any)?.scheduledTime ? String((raw as any).scheduledTime) : undefined,
              vehicleType: ((raw as any)?.vehicleType ?? VehicleType.CAR) as any,
              tripType: (raw as any)?.tripType as any,
              totalAmount:
                typeof (raw as any)?.totalAmount === 'number'
                  ? (raw as any).totalAmount
                  : Number((raw as any)?.totalAmount || 0),
              paymentMethod: ((raw as any)?.paymentMethod ?? PaymentMethod.CASH) as any,
              createdAt: (raw as any)?.createdAt ? String((raw as any).createdAt) : now,
              updatedAt: (raw as any)?.updatedAt ? String((raw as any).updatedAt) : now,
            })
          );
        } catch {
        }
      })();
    });

    this.socket.on('booking:cancelled', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      store.dispatch(updateBookingStatus({ id: bookingId, status: 'CANCELLED' }));
      store.dispatch(removeBookingRequest(bookingId));

      const currentId = store.getState().booking.currentBooking?.id;
      if (currentId && String(currentId) === bookingId) {
        const currentStatus = String(store.getState().booking.currentBooking?.status ?? '');
        if (currentStatus === 'SEARCHING' || currentStatus === 'REQUESTED') {
          store.dispatch(clearRoute());
          store.dispatch(setDriverLocation(null as any));
        } else {
          store.dispatch(clearCurrentBooking());
          store.dispatch(clearLocations());
          store.dispatch(clearRoute());
        }
      }

      store.dispatch(
        addNotification({
          type: 'warning',
          message: 'Booking cancelled',
          bookingId,
        })
      );
    });

    this.socket.on('booking:offer-removed', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      store.dispatch(removeBookingRequest(bookingId));
    });

    this.socket.on('support:message', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      const threadUserId = String(data?.threadUserId ?? '');
      const message = String(data?.message ?? '').trim();
      const senderId = typeof data?.senderId === 'string' ? String(data.senderId) : '';
      if (!bookingId || !threadUserId || !message) return;

      const currentUserId = String((store.getState().auth.user as any)?.id ?? '');
      if (senderId && currentUserId && senderId === currentUserId) {
        return;
      }

      store.dispatch(
        addNotification({
          type: 'support_chat',
          message: `Need Help: ${message}`,
          bookingId,
          supportThreadUserId: threadUserId,
        })
      );
    });

    this.socket.on('driver:refund-created', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      const amount = Number(data?.amount ?? 30);
      if (!bookingId) return;
      store.dispatch(
        addNotification({
          type: 'info',
          message: `You will be refunded with ₹${Number.isFinite(amount) ? amount : 30}`,
          bookingId,
        })
      );
    });

    this.socket.on('driver:refund-paid', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      const amount = Number(data?.amount ?? 30);
      if (!bookingId) return;
      store.dispatch(
        addNotification({
          type: 'success',
          message: `Refund of ₹${Number.isFinite(amount) ? amount : 30} paid for this trip`,
          bookingId,
        })
      );
    });

    this.socket.on('user:profile-updated', (data: any) => {
      const userId = String(data?.userId ?? '');
      if (!userId) return;

      const currentUser = store.getState().auth.user as any;
      if (!currentUser || String(currentUser.id) !== userId) return;

      const ratingRaw = (data as any)?.rating;
      const totalRaw = (data as any)?.totalRatings;
      const rating = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw);
      const totalRatings = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw);

      store.dispatch(
        updateUser({
          ...(currentUser as any),
          rating: Number.isFinite(rating) ? rating : (currentUser as any).rating,
          totalRatings: Number.isFinite(totalRatings) ? totalRatings : (currentUser as any).totalRatings,
        })
      );
    });

    this.socket.on('driver:verification-updated', (data: any) => {
      const driverId = String(data?.driverId ?? '');
      if (!driverId) return;

      const currentUser = store.getState().auth.user as any;
      if (!currentUser || String(currentUser.id) !== driverId) return;

      store.dispatch(
        setDriverVerification({
          documentsVerified: Boolean(data?.documentsVerified),
          backgroundCheckStatus: String(data?.backgroundCheckStatus || 'PENDING') as any,
          submitted: true,
          updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
          reason: typeof data?.reason === 'string' ? data.reason : null,
        })
      );
    });

    this.socket.on('eta:update', (data: any) => {
      const currentBookingId = store.getState().booking.currentBooking?.id;
      const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : null;
      if (!bookingId) return;
      if (!currentBookingId) return;
      if (bookingId !== currentBookingId) return;
      const eta = Number(data?.eta);
      const distanceKm = Number(data?.distanceKm);
      if (!Number.isFinite(eta)) return;
      store.dispatch(updateETA({ eta, distance: Number.isFinite(distanceKm) ? distanceKm : undefined }));
    });

    const handleLocation = (data: any) => {
      const currentBookingId = store.getState().booking.currentBooking?.id;
      const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : null;
      if (!bookingId) return;
      if (!currentBookingId) return;
      if (bookingId !== currentBookingId) return;
      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const now = Date.now();
      const next = { latitude, longitude };
      const prev = this.lastLocation;
      const movedMeters = prev ? this.distanceApproxMeters(prev, next) : Number.POSITIVE_INFINITY;
      if (Number.isFinite(movedMeters) && movedMeters < 3) {
        return;
      }

      if (now - this.lastLocationUpdateTs < 450 && movedMeters < 20) {
        return;
      }

      this.lastLocationUpdateTs = now;
      this.lastLocation = next;
      store.dispatch(setDriverLocation(next));
    };

    this.socket.on('location:update', handleLocation);
    this.socket.on('driver:location-update', handleLocation);
  }

  async connect() {
    if (this.socket?.connected) {
      return;
    }

    const token = await SecureStore.getItemAsync('accessToken');
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    if (!this.globalHandlersRegistered) {
      this.registerGlobalHandlers();
      this.globalHandlersRegistered = true;
    }

    this.socket.on('connect', () => {
      if (__DEV__) {
        console.log('Socket connected');
      }
    });

    this.socket.on('disconnect', () => {
      if (__DEV__) {
        console.log('Socket disconnected');
      }
    });

    this.socket.on('error', (error: any) => {
      if (__DEV__) {
        console.error('Socket error:', error);
      }
    });

    this.socket.on('connect_error', async (err: any) => {
      const message = String(err?.message || '');
      if (__DEV__) {
        console.error('Socket connect_error:', message);
      }

      if (this.isReauthInProgress) {
        return;
      }

      const looksAuthRelated =
        message.toLowerCase().includes('auth') ||
        message.toLowerCase().includes('jwt') ||
        message.toLowerCase().includes('token') ||
        message.toLowerCase().includes('expired');

      if (!looksAuthRelated) {
        return;
      }

      this.isReauthInProgress = true;
      try {
        await this.refreshAccessToken();
        this.disconnect();
        await this.connect();
      } catch (e) {
        if (__DEV__) {
          console.error('Socket re-auth failed:', e);
        }
        this.disconnect();
      } finally {
        this.isReauthInProgress = false;
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  joinBooking(bookingId: string) {
    this.emit('booking:join', bookingId);
  }

  leaveBooking(bookingId: string) {
    this.emit('booking:leave', bookingId);
  }

  joinSupportChat(bookingId: string, threadUserId?: string) {
    this.emit('support:join', { bookingId, threadUserId });
  }

  leaveSupportChat(bookingId: string, threadUserId?: string) {
    this.emit('support:leave', { bookingId, threadUserId });
  }

  sendSupportMessage(bookingId: string, message: string, clientMessageId?: string, threadUserId?: string) {
    this.emit('support:message', { bookingId, message, clientMessageId, threadUserId });
  }

  joinRoom(roomName: string) {
    if (roomName.startsWith('booking:')) {
      this.joinBooking(roomName.replace('booking:', ''));
      return;
    }
    this.emit('join:room', { room: roomName });
  }

  leaveRoom(roomName: string) {
    if (roomName.startsWith('booking:')) {
      this.leaveBooking(roomName.replace('booking:', ''));
      return;
    }
    this.emit('leave:room', { room: roomName });
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  updateDriverLocation(data: {
    bookingId?: string;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
  }) {
    this.emit('driver:location-update', data);
  }

  setDriverOnline(latitude: number, longitude: number) {
    this.emit('driver:online', { latitude, longitude });
  }

  setDriverOffline() {
    this.emit('driver:offline', {});
  }

  sendMessage(bookingId: string, message: string, clientMessageId?: string) {
    this.emit('chat:message', { bookingId, message, clientMessageId });
  }
}

export default new SocketService();
