import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Booking } from '../../types';
import { logout, loadUser } from './authSlice';

interface BookingState {
  currentBooking: Booking | null;
  bookingHistory: Booking[];
  bookingRequests: Array<{
    id: string;
    pickup?: { address?: string; latitude?: number; longitude?: number };
    drop?: { address?: string; latitude?: number; longitude?: number } | null;
    distanceKm?: number;
    etaMin?: number;
    fare?: number;
    vehicleType?: string;
    transmissionType?: string;
    tripType?: string;
    outstationTripType?: string;
    requestedHours?: number;
    scheduledTime?: string;
    createdAt: string;
  }>;
  isLoading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  currentBooking: null,
  bookingHistory: [],
  bookingRequests: [],
  isLoading: false,
  error: null,
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setCurrentBooking: (state, action: PayloadAction<Booking>) => {
      state.currentBooking = action.payload;
    },
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
    },
    updateBookingStatus: (state, action: PayloadAction<{ id: string; status: string }>) => {
      if (state.currentBooking && state.currentBooking.id === action.payload.id) {
        state.currentBooking.status = action.payload.status as any;
      }
    },
    updateBookingOtp: (state, action: PayloadAction<{ id: string; otp: string | null }>) => {
      if (state.currentBooking && state.currentBooking.id === action.payload.id) {
        (state.currentBooking as any).otp = action.payload.otp;
      }
    },
    updateBookingCustomerRating: (state, action: PayloadAction<{ id: string; rating: number; review?: string | null }>) => {
      if (state.currentBooking && state.currentBooking.id === action.payload.id) {
        (state.currentBooking as any).customerRating = action.payload.rating;
        (state.currentBooking as any).customerReview = action.payload.review ?? null;
      }
    },
    updateBookingFare: (
      state,
      action: PayloadAction<{ id: string; totalAmount?: number; discountAmount?: number; pricingBreakdown?: any }>
    ) => {
      if (!state.currentBooking) return;
      if (state.currentBooking.id !== action.payload.id) return;

      if (typeof action.payload.totalAmount === 'number') {
        state.currentBooking.totalAmount = action.payload.totalAmount;
      }
      if (typeof action.payload.discountAmount === 'number') {
        (state.currentBooking as any).discountAmount = action.payload.discountAmount;
      }
      if (action.payload.pricingBreakdown !== undefined) {
        (state.currentBooking as any).pricingBreakdown = action.payload.pricingBreakdown;
      }
    },
    setDriverInfo: (state, action: PayloadAction<{ bookingId: string; driver: any }>) => {
      if (state.currentBooking && state.currentBooking.id === action.payload.bookingId) {
        (state.currentBooking as any).driver = action.payload.driver;
      }
    },
    addBookingRequest: (state, action: PayloadAction<any>) => {
      const bookingId = String(action.payload?.bookingId ?? action.payload?.id ?? '');
      if (!bookingId) return;
      if (state.bookingRequests.some((r) => r.id === bookingId)) return;
      state.bookingRequests.unshift({
        id: bookingId,
        pickup: action.payload?.pickup,
        drop: action.payload?.drop ?? null,
        distanceKm: typeof action.payload?.distanceKm === 'number' ? action.payload.distanceKm : undefined,
        etaMin: typeof action.payload?.etaMin === 'number' ? action.payload.etaMin : undefined,
        fare: typeof action.payload?.fare === 'number' ? action.payload.fare : undefined,
        vehicleType: typeof action.payload?.vehicleType === 'string' ? action.payload.vehicleType : undefined,
        transmissionType: typeof action.payload?.transmissionType === 'string' ? action.payload.transmissionType : undefined,
        tripType: typeof action.payload?.tripType === 'string' ? action.payload.tripType : undefined,
        outstationTripType: typeof action.payload?.outstationTripType === 'string' ? action.payload.outstationTripType : undefined,
        requestedHours: typeof action.payload?.requestedHours === 'number' ? action.payload.requestedHours : undefined,
        scheduledTime: typeof action.payload?.scheduledTime === 'string' ? action.payload.scheduledTime : undefined,
        createdAt: new Date().toISOString(),
      });
      state.bookingRequests = state.bookingRequests.slice(0, 30);
    },
    removeBookingRequest: (state, action: PayloadAction<string>) => {
      state.bookingRequests = state.bookingRequests.filter((r) => r.id !== action.payload);
    },
    clearBookingRequests: (state) => {
      state.bookingRequests = [];
    },
    setBookingHistory: (state, action: PayloadAction<Booking[]>) => {
      state.bookingHistory = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.pending, (state) => {
        state.currentBooking = null;
        state.bookingRequests = [];
      })
      .addCase(logout.fulfilled, (state) => {
        state.currentBooking = null;
        state.bookingRequests = [];
      })
      .addCase(logout.rejected, (state) => {
        state.currentBooking = null;
        state.bookingRequests = [];
      })
      .addCase(loadUser.rejected, (state) => {
        state.currentBooking = null;
        state.bookingRequests = [];
      });
  },
});

export const {
  setCurrentBooking,
  clearCurrentBooking,
  updateBookingStatus,
  updateBookingOtp,
  updateBookingCustomerRating,
  updateBookingFare,
  setDriverInfo,
  addBookingRequest,
  removeBookingRequest,
  clearBookingRequests,
  setBookingHistory,
  setLoading,
  setError,
} = bookingSlice.actions;

export default bookingSlice.reducer;
