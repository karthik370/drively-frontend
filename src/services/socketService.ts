import { io, Socket } from 'socket.io-client';
import { Alert } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
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
  addChatMessage,
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
  private lastAcceptedBookingId = ''; // Dedup for booking:accepted — reset on SEARCHING/cancel
  // Dedup guard: prevent duplicate in-app notifications for the same booking offer.
  // Cleared when offer is removed/accepted/cancelled so fresh offers always get through.
  private seenOfferIds = new Set<string>();

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

      const offerId = String(data?.bookingId ?? data?.id ?? '');

      // Dedup: addBookingRequest is idempotent (Redux ignores duplicates by id),
      // but addNotification is NOT — guard it so the bell only rings once per offer.
      const isNew = offerId && !this.seenOfferIds.has(offerId);
      if (isNew) this.seenOfferIds.add(offerId);

      store.dispatch(addBookingRequest(data));
      if (isNew) {
        store.dispatch(
          addNotification({
            type: 'booking_request',
            message: 'New booking request received',
            bookingId: offerId,
          })
        );
      }
      // NOTE: No local push here — backend already sends Expo push notification.
      // Scheduling one here too would cause a double notification for drivers.
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

      // NOTE: No local push for ARRIVED/DRIVER_ARRIVING — backend already sends Expo push.
      // Scheduling one here too would cause a double notification for customers.

      if (status === 'SEARCHING' || status === 'REQUESTED') {
        // Reset accepted-dedup so a new driver can accept the same bookingId
        this.lastAcceptedBookingId = '';
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

      // Re-fetch full booking on STARTED so startedAt is available for round-trip countdown
      if (status === 'STARTED') {
        void (async () => {
          try {
            const current = store.getState().booking.currentBooking;
            if (!current || String(current.id) !== bookingId) return;
            const raw = await getBookingDetails(bookingId);
            if (raw) {
              store.dispatch(
                setCurrentBooking({
                  ...(current as any),
                  ...(raw as any),
                  status: 'STARTED' as any,
                })
              );
            }
          } catch {}
        })();
      }

      // Streak tracking is now server-side (DiscountService counts completed bookings from DB)
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

    // ── Global chat message handler — always active ──
    this.socket.on('chat:message', (payload: any) => {
      const bookingId = String(payload?.bookingId ?? '');
      if (!bookingId) return;
      const senderId = typeof payload?.senderId === 'string' ? payload.senderId : null;
      const clientMessageId = typeof payload?.clientMessageId === 'string' ? payload.clientMessageId : null;
      const msgText = String(payload?.message ?? '');
      if (!msgText) return;

      const ts = payload?.timestamp instanceof Date
        ? payload.timestamp.toISOString()
        : typeof payload?.timestamp === 'string'
          ? payload.timestamp
          : new Date().toISOString();
      const stableId = clientMessageId
        ? clientMessageId
        : `${senderId || 'unknown'}-${ts}-${msgText.slice(0, 12)}`;

      // Persist to Redux
      store.dispatch(addChatMessage({
        bookingId,
        id: stableId,
        senderId,
        message: msgText,
        timestamp: ts,
      }));

      // NOTE: No local notification here — the backend already sends an Expo push
      // notification for chat messages (see bookingHandlers.ts chat:message handler).
      // Scheduling a local one too would cause a double notification.
    });

    // Dedup: customer receives booking:accepted from both user: room and booking: room
    this.socket.on('booking:accepted', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      // Skip duplicate events for the same booking (but allow re-accepts after cancel)
      if (this.lastAcceptedBookingId === bookingId) return;
      this.lastAcceptedBookingId = bookingId;

      store.dispatch(updateBookingStatus({ id: bookingId, status: 'ACCEPTED' }));

      // Immediately update OTP from socket event (for customer)
      if (data?.otp) {
        store.dispatch(updateBookingOtp({ id: bookingId, otp: String(data.otp) }));
      }

      // No local notification here — the backend already sends a push notification
      // to avoid double alerts.

      try {
        this.joinBooking(bookingId);
      } catch {
      }

      // PERF: If socket payload includes full driver + booking data, use it directly
      // This eliminates a 300-800ms REST API call to getBookingDetails()
      const raw = data?.booking;
      const driverData = data?.driver;
      const current = store.getState().booking.currentBooking;

      if (raw && (raw.id || raw.bookingId)) {
        // We have full data from socket — use directly, no REST call needed
        const now = new Date().toISOString();
        const pickupLat = Number(raw.pickupLocationLat);
        const pickupLng = Number(raw.pickupLocationLng);
        if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
          store.dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
        }
        store.dispatch(setPickupAddress(typeof raw.pickupAddress === 'string' ? raw.pickupAddress : null));

        const dropLat = raw.dropLocationLat !== null && raw.dropLocationLat !== undefined ? Number(raw.dropLocationLat) : NaN;
        const dropLng = raw.dropLocationLng !== null && raw.dropLocationLng !== undefined ? Number(raw.dropLocationLng) : NaN;
        if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
          store.dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
        }
        store.dispatch(setDropAddress(typeof raw.dropAddress === 'string' ? raw.dropAddress : null));

        store.dispatch(
          setCurrentBooking({
            id: String(raw.id ?? bookingId),
            bookingNumber: String(raw.bookingNumber ?? ''),
            status: (raw.status ?? BookingStatus.ACCEPTED) as any,
            customer: raw.customer ?? (current as any)?.customer ?? undefined,
            driver: driverData ?? raw.driver ?? undefined,
            otp: raw.otp ?? data?.otp ?? null,
            pickupLocation: {
              latitude: Number.isFinite(pickupLat) ? pickupLat : 0,
              longitude: Number.isFinite(pickupLng) ? pickupLng : 0,
            },
            pickupAddress: String(raw.pickupAddress ?? 'Pickup'),
            dropLocation:
              Number.isFinite(dropLat) && Number.isFinite(dropLng)
                ? { latitude: dropLat, longitude: dropLng }
                : undefined,
            dropAddress: typeof raw.dropAddress === 'string' ? raw.dropAddress : undefined,
            scheduledTime: raw.scheduledTime ? String(raw.scheduledTime) : undefined,
            vehicleType: (raw.vehicleType ?? VehicleType.CAR) as any,
            tripType: raw.tripType as any,
            totalAmount:
              typeof raw.totalAmount === 'number'
                ? raw.totalAmount
                : Number(raw.totalAmount || 0),
            paymentMethod: (raw.paymentMethod ?? PaymentMethod.CASH) as any,
            createdAt: raw.createdAt ? String(raw.createdAt) : now,
            updatedAt: raw.updatedAt ? String(raw.updatedAt) : now,
          })
        );
      } else {
        // Fallback: socket didn't include full data — fetch via REST (legacy path)
        if (current && String(current.id) !== bookingId) return;
        void (async () => {
          try {
            const fetched = await getBookingDetails(bookingId);
            const now = new Date().toISOString();
            const pickupLat = Number((fetched as any)?.pickupLocationLat);
            const pickupLng = Number((fetched as any)?.pickupLocationLng);
            if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
              store.dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
            }
            store.dispatch(setPickupAddress(typeof (fetched as any)?.pickupAddress === 'string' ? (fetched as any).pickupAddress : null));
            const dropLat = (fetched as any)?.dropLocationLat != null ? Number((fetched as any).dropLocationLat) : NaN;
            const dropLng = (fetched as any)?.dropLocationLng != null ? Number((fetched as any).dropLocationLng) : NaN;
            if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
              store.dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
            }
            store.dispatch(setDropAddress(typeof (fetched as any)?.dropAddress === 'string' ? (fetched as any).dropAddress : null));
            store.dispatch(
              setCurrentBooking({
                id: String((fetched as any)?.id ?? bookingId),
                bookingNumber: String((fetched as any)?.bookingNumber ?? ''),
                status: ((fetched as any)?.status ?? BookingStatus.ACCEPTED) as any,
                customer: (fetched as any)?.customer as any,
                driver: (fetched as any)?.driver as any,
                otp: (fetched as any)?.otp ?? null,
                pickupLocation: {
                  latitude: Number.isFinite(pickupLat) ? pickupLat : 0,
                  longitude: Number.isFinite(pickupLng) ? pickupLng : 0,
                },
                pickupAddress: String((fetched as any)?.pickupAddress ?? 'Pickup'),
                dropLocation:
                  Number.isFinite(dropLat) && Number.isFinite(dropLng)
                    ? { latitude: dropLat, longitude: dropLng }
                    : undefined,
                dropAddress: typeof (fetched as any)?.dropAddress === 'string' ? (fetched as any).dropAddress : undefined,
                scheduledTime: (fetched as any)?.scheduledTime ? String((fetched as any).scheduledTime) : undefined,
                vehicleType: ((fetched as any)?.vehicleType ?? VehicleType.CAR) as any,
                tripType: (fetched as any)?.tripType as any,
                totalAmount:
                  typeof (fetched as any)?.totalAmount === 'number'
                    ? (fetched as any).totalAmount
                    : Number((fetched as any)?.totalAmount || 0),
                paymentMethod: ((fetched as any)?.paymentMethod ?? PaymentMethod.CASH) as any,
                createdAt: (fetched as any)?.createdAt ? String((fetched as any).createdAt) : now,
                updatedAt: (fetched as any)?.updatedAt ? String((fetched as any).updatedAt) : now,
              })
            );
          } catch {}
        })();
      }
    });

    this.socket.on('booking:cancelled', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      const cancelledBy = String(data?.cancelledBy ?? '').toUpperCase();

      // Clear seenOfferIds so the same booking can trigger a fresh notification if re-offered
      this.seenOfferIds.delete(bookingId);

      const currentId = store.getState().booking.currentBooking?.id;
      const isMyBooking = currentId && String(currentId) === bookingId;
      const userType = String((store.getState().auth.user as any)?.userType ?? '').toUpperCase();
      const isCustomer = userType === 'CUSTOMER' || userType === 'BOTH';

      // If driver cancelled and this is the customer's active booking,
      // reset to SEARCHING so the "Finding driver" screen shows again
      if (isMyBooking && cancelledBy === 'DRIVER' && isCustomer) {
        // Reset accepted-dedup so a new driver can accept the same bookingId
        this.lastAcceptedBookingId = '';
        store.dispatch(updateBookingStatus({ id: bookingId, status: 'SEARCHING' }));
        store.dispatch(clearRoute());
        store.dispatch(setDriverLocation(null as any));

        Alert.alert(
          'Driver Cancelled',
          'Your driver cancelled the ride. Finding a new driver for you...',
          [{ text: 'OK' }],
        );

        store.dispatch(
          addNotification({
            type: 'warning',
            message: 'Driver cancelled. Finding a new driver...',
            bookingId,
          })
        );
        return;
      }

      store.dispatch(updateBookingStatus({ id: bookingId, status: 'CANCELLED' }));
      store.dispatch(removeBookingRequest(bookingId));

      if (isMyBooking) {
        // Always fully clean up on cancel — prevents stale data in any state
        store.dispatch(clearCurrentBooking());
        store.dispatch(clearLocations());
        store.dispatch(clearRoute());
        store.dispatch(setDriverLocation(null as any));
      }

      store.dispatch(
        addNotification({
          type: 'warning',
          message: 'Booking cancelled',
          bookingId,
        })
      );
    });

    // Handle booking:status from backend (e.g. driver pre-start cancel resets to SEARCHING)
    this.socket.on('booking:status', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      const newStatus = String(data?.status ?? '');
      if (!bookingId || !newStatus) return;

      const currentId = store.getState().booking.currentBooking?.id;
      if (!currentId || String(currentId) !== bookingId) return;

      const prevStatus = String(store.getState().booking.currentBooking?.status ?? '');
      const userType = String((store.getState().auth.user as any)?.userType ?? '').toUpperCase();
      const isCustomer = userType === 'CUSTOMER' || userType === 'BOTH';

      // Driver cancelled pre-start → backend reset to SEARCHING
      if (isCustomer && newStatus === 'SEARCHING' && prevStatus !== 'SEARCHING' && prevStatus !== 'REQUESTED') {
        store.dispatch(updateBookingStatus({ id: bookingId, status: 'SEARCHING' }));
        store.dispatch(clearRoute());
        store.dispatch(setDriverLocation(null as any));

        // Immediate visible alert (works even when app is in foreground)
        Alert.alert(
          'Driver Cancelled',
          'Your driver cancelled the ride. Finding a new driver for you...',
          [{ text: 'OK' }],
        );

        try {
          void Notifications.scheduleNotificationAsync({
            content: {
              title: 'Driver cancelled',
              body: 'Your driver cancelled the ride. Finding a new driver for you...',
              sound: 'default',
            },
            trigger: null,
          });
        } catch {}

        store.dispatch(
          addNotification({
            type: 'warning',
            message: 'Driver cancelled. Finding a new driver...',
            bookingId,
          })
        );
        return;
      }

      // Generic status update — but ignore SEARCHING for drivers
      // (drivers get booking:cancelled separately, processing SEARCHING causes stale data)
      if (!isCustomer && newStatus === 'SEARCHING') return;
      store.dispatch(updateBookingStatus({ id: bookingId, status: newStatus }));
    });

    this.socket.on('booking:offer-removed', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      if (!bookingId) return;
      // Allow this booking to trigger a fresh notification if re-offered
      this.seenOfferIds.delete(bookingId);
      store.dispatch(removeBookingRequest(bookingId));
    });

    this.socket.on('support:message', (data: any) => {
      const bookingId = String(data?.bookingId ?? '');
      const threadUserId = String(data?.threadUserId ?? '');
      const message = String(data?.message ?? '').trim();
      const senderId = typeof data?.senderId === 'string' ? String(data.senderId) : '';
      const senderName = typeof data?.senderName === 'string' ? String(data.senderName).trim() : '';
      const senderRole = typeof data?.senderRole === 'string' ? String(data.senderRole).trim() : '';
      if (!bookingId || !threadUserId || !message) return;

      const currentUserId = String((store.getState().auth.user as any)?.id ?? '');
      if (senderId && currentUserId && senderId === currentUserId) {
        return;
      }

      store.dispatch(
        addNotification({
          type: 'support_chat',
          message: `${senderName ? `${senderName}${senderRole ? ` (${senderRole})` : ''}: ` : 'Need Help: '}${message}`,
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

    // DISABLED: Socket eta:update competes with frontend's route-based ETA (single source of truth).
    // Backend uses Distance Matrix API which returns different values than Directions API causing flicker.
    // this.socket.on('eta:update', (data: any) => {
    //   const currentBookingId = store.getState().booking.currentBooking?.id;
    //   const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : null;
    //   if (!bookingId) return;
    //   if (!currentBookingId) return;
    //   if (bookingId !== currentBookingId) return;
    //   const eta = Number(data?.eta);
    //   const distanceKm = Number(data?.distanceKm);
    //   if (!Number.isFinite(eta)) return;
    //   store.dispatch(updateETA({ eta, distance: Number.isFinite(distanceKm) ? distanceKm : undefined }));
    // });

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
    });

    this.socket.on('disconnect', () => {
    });

    this.socket.on('error', (error: any) => {
    });

    this.socket.on('connect_error', async (err: any) => {
      const message = String(err?.message || '');

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
    // Clear room tracking so fresh joins work after reconnect
    this.joinedBookingRooms.clear();
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

  // Dedup guard: prevent emitting booking:join multiple times for the same bookingId.
  // Cleared on leaveBooking/disconnect so re-joining after cancel works.
  private joinedBookingRooms = new Set<string>();

  joinBooking(bookingId: string) {
    if (!bookingId) return;
    if (this.joinedBookingRooms.has(bookingId)) return; // already joined — skip
    this.joinedBookingRooms.add(bookingId);
    this.emit('booking:join', bookingId);
  }

  leaveBooking(bookingId: string) {
    this.joinedBookingRooms.delete(bookingId);
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
