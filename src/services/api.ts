import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/config';

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

export class ApiRequestError extends Error {
  status?: number;
  code?: string;
  payload?: unknown;
  response?: { status?: number; data?: unknown };

  constructor(message: string, params?: { status?: number; code?: string; payload?: unknown }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = params?.status;
    this.code = params?.code;
    this.payload = params?.payload;
    if (params?.status) {
      this.response = { status: params.status, data: params.payload };
    }
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Request failed';
};

const unwrap = <T,>(response: { data: ApiResponse<T> }): T => {
  if (!response?.data) {
    throw new ApiRequestError('Empty response from server');
  }

  if (!response.data.success) {
    throw new ApiRequestError(response.data.message || 'Request failed', {
      payload: response.data,
    });
  }

  if (response.data.data === undefined) {
    throw new ApiRequestError('Malformed response from server', {
      payload: response.data,
    });
  }

  return response.data.data;
};

const handleAxiosError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const payload = error.response?.data;
    const messageFromPayload =
      payload && typeof payload === 'object' && 'message' in (payload as any)
        ? String((payload as any).message)
        : undefined;

    throw new ApiRequestError(messageFromPayload || error.message || 'Request failed', {
      status,
      payload,
    });
  }

  throw new ApiRequestError(getErrorMessage(error));
};

type RefreshTokenResponse = { accessToken: string; refreshToken: string };

let refreshInFlight: Promise<RefreshTokenResponse> | null = null;

const refreshTokensSingleFlight = async (): Promise<RefreshTokenResponse> => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) {
      throw new ApiRequestError('No refresh token');
    }

    const res = await axios.post<ApiResponse<RefreshTokenResponse>>(
      `${API_URL}/auth/refresh-token`,
      { refreshToken },
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = res?.data?.data as any;
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken : '';
    const nextRefreshToken = typeof data?.refreshToken === 'string' ? data.refreshToken : '';
    if (!accessToken || !nextRefreshToken) {
      throw new ApiRequestError('Token refresh failed');
    }

    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', nextRefreshToken);

    return { accessToken, refreshToken: nextRefreshToken };
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
};

export type LatLng = { latitude: number; longitude: number };
export type BookingType = 'CITY' | 'OUTSTATION';
export type TripType = 'ONE_WAY' | 'ROUND_TRIP' | 'OUTSTATION';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'NET_BANKING';
export type CancelledBy = 'CUSTOMER' | 'DRIVER';
export type PayoutMethod = 'BANK_TRANSFER' | 'UPI';

export type UpdateMyProfileRequest = {
  firstName: string;
  lastName: string;
  profileImage?: string;
};

export type UpdateMyProfileResponse = {
  id: string;
  phoneNumber: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  profileImage?: string | null;
  userType: string;
  rating: number;
  totalRatings: number;
  isVerified: boolean;
};

export const updateMyProfile = async (payload: UpdateMyProfileRequest): Promise<UpdateMyProfileResponse> => {
  try {
    const res = await api.patch<ApiResponse<UpdateMyProfileResponse>>('/users/profile', payload);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type SavedAddress = {
  id: string;
  label?: string;
  address: string;
  location: LatLng;
  createdAt: string;
};

export const getSavedAddresses = async (): Promise<SavedAddress[]> => {
  try {
    const res = await api.get<ApiResponse<SavedAddress[]>>('/users/saved-addresses');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const addSavedAddress = async (payload: {
  label?: string;
  address: string;
  latitude: number;
  longitude: number;
}): Promise<SavedAddress[]> => {
  try {
    const res = await api.post<ApiResponse<SavedAddress[]>>('/users/saved-addresses', payload);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const deleteSavedAddress = async (addressId: string): Promise<SavedAddress[]> => {
  try {
    const res = await api.delete<ApiResponse<SavedAddress[]>>(`/users/saved-addresses/${addressId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const registerExpoPushToken = async (params: { token: string; platform?: string }): Promise<{ ok: boolean }> => {
  try {
    const res = await api.post<ApiResponse<{ ok: boolean }>>('/users/push-token/expo', params);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type SupportThread = {
  bookingId: string;
  threadUserId: string;
  lastMessage: string;
  lastAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    pickupAddress: string | null;
    dropAddress: string | null;
    createdAt: string;
    customer: { id: string; name: string; phoneNumber: string } | null;
    driver: { id: string; name: string; phoneNumber: string } | null;
  } | null;
};

export type SupportMessage = {
  id: string;
  bookingId: string;
  threadUserId: string;
  senderId: string | null;
  message: string;
  timestamp: string;
};

export const listSupportThreads = async (): Promise<SupportThread[]> => {
  try {
    const res = await api.get<ApiResponse<SupportThread[]>>('/support/threads');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const listSupportMessages = async (bookingId: string, threadUserId?: string): Promise<SupportMessage[]> => {
  try {
    const res = await api.get<ApiResponse<SupportMessage[]>>(`/support/threads/${bookingId}/messages`, {
      params: threadUserId ? { threadUserId } : undefined,
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type PendingRefundItem = {
  refundId: string;
  bookingId: string;
  bookingNumber: string;
  bookingStatus: string;
  driverId: string;
  driverName: string;
  driverPhoneNumber: string;
  upiId: string;
  amount: number;
  createdAt: string;
};

export const getPendingRefunds = async (): Promise<PendingRefundItem[]> => {
  try {
    const res = await api.get<ApiResponse<PendingRefundItem[]>>('/admin/refunds/pending');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const markRefundPaid = async (refundId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/admin/refunds/${refundId}/mark-paid`, {});
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type DriverDocumentsStatus = {
  driverId: string;
  documentsVerified: boolean;
  backgroundCheckStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  submitted: boolean;
  updatedAt: string;
};

export type PendingDriverVerificationItem = {
  driverId: string;
  name: string;
  phoneNumber: string;
  submittedAt: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
};

export const getPendingDriverVerifications = async (): Promise<PendingDriverVerificationItem[]> => {
  try {
    const res = await api.get<ApiResponse<PendingDriverVerificationItem[]>>('/admin/driver-verifications/pending');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type DriverVerificationDetails = {
  driverId: string;
  user: { id: string; firstName: string; lastName: string; phoneNumber: string; profileImage?: string | null; createdAt: string };
  documentsVerified: boolean;
  backgroundCheckStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  submitted: boolean;
  licenseNumber: string;
  licenseExpiryDate: string;
  licenseImageUrl: string;
  aadhaarNumber: string;
  aadhaarImageUrl: string;
  panNumber: string;
  panImageUrl: string;
  updatedAt: string;
};

export const getDriverVerificationDetails = async (driverId: string): Promise<DriverVerificationDetails> => {
  try {
    const res = await api.get<ApiResponse<DriverVerificationDetails>>(`/admin/driver-verifications/${driverId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use(
  async (config) => {
    const url = String(config?.url || '');
    const skipAuthHeaderFor = [
      '/auth/login',
      '/auth/signup',
      '/auth/refresh-token',
      '/auth/msg91/verify-access-token',
      '/auth/social-login',
    ];

    if (!skipAuthHeaderFor.some((p) => url.startsWith(p))) {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const url = String(originalRequest?.url || '');
      const skipRefreshFor = [
        '/auth/login',
        '/auth/signup',
        '/auth/refresh-token',
        '/auth/msg91/verify-access-token',
        '/auth/social-login',
      ];

      if (skipRefreshFor.some((p) => url.startsWith(p))) {
        return Promise.reject(error);
      }

      try {
        const { accessToken } = await refreshTokensSingleFlight();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Important: don't blindly delete tokens here.
        // Another concurrent request may have successfully refreshed tokens.
        const maybeNewAccess = await SecureStore.getItemAsync('accessToken');
        if (maybeNewAccess) {
          originalRequest.headers.Authorization = `Bearer ${maybeNewAccess}`;
          return api(originalRequest);
        }

        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// LOCATION ENDPOINTS
export type UpdateDriverLocationRequest = {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  bookingId?: string;
};

export type UpdateDriverLocationResponse = {
  driverId: string;
  latitude: number;
  longitude: number;
};

export const updateDriverLocation = async (
  data: UpdateDriverLocationRequest
): Promise<UpdateDriverLocationResponse> => {
  try {
    const res = await api.post<ApiResponse<UpdateDriverLocationResponse>>('/location/update', data);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type NearbyDriver = {
  id: string;
  name: string;
  photo: string | null;
  rating: number;
  distance: number;
  location: LatLng;
};

export const getNearbyDrivers = async (
  latitude: number,
  longitude: number,
  radius: number = 5
): Promise<NearbyDriver[]> => {
  try {
    const res = await api.get<ApiResponse<NearbyDriver[]>>('/location/nearby-drivers', {
      params: { latitude, longitude, radius },
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type DriverLocationResponse = {
  driverId: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationUpdate: string | null;
};

export const getDriverLocation = async (driverId: string): Promise<DriverLocationResponse> => {
  try {
    const res = await api.get<ApiResponse<DriverLocationResponse>>(`/location/driver/${driverId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverDocumentsStatus = async (): Promise<DriverDocumentsStatus> => {
  try {
    const res = await api.get<ApiResponse<DriverDocumentsStatus>>('/drivers/documents/status');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type SubmitDriverDocumentsRequest = {
  licenseNumber?: string;
  licenseExpiryDate: string;
  licenseImageUrl: string;
  aadhaarNumber?: string;
  aadhaarImageUrl: string;
  panNumber?: string;
  panImageUrl: string;
  profileImage: string;
};

export const submitDriverDocuments = async (payload: SubmitDriverDocumentsRequest): Promise<DriverDocumentsStatus> => {
  try {
    const res = await api.post<ApiResponse<DriverDocumentsStatus>>('/drivers/documents/submit', payload);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type UploadImageRequest = {
  uri: string;
  mimeType: string;
  fileName: string;
  kind: string;
  onProgress?: (progress: number) => void;
};

export type UploadImageResponse = {
  key: string;
  fileUrl: string;
};

export const uploadDriverImage = async (payload: UploadImageRequest): Promise<UploadImageResponse> => {
  const FileSystem = require('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(payload.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });


  const url = `${API_URL}/drivers/uploads/image`;
  const token = await SecureStore.getItemAsync('accessToken');

  return new Promise<UploadImageResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 180000;

    if (xhr.upload && payload.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && payload.onProgress) {
          payload.onProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.success) {
            reject(new Error(data.message || 'Server returned failure'));
          } else if (data?.data?.fileUrl) {
            resolve({ fileUrl: data.data.fileUrl, key: data.data.key || '' });
          } else {
            reject(new Error('Upload success but no fileUrl returned'));
          }
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        const errorMsg = xhr.responseText
          ? `Server returned ${xhr.status}: ${xhr.responseText.slice(0, 200)}`
          : 'Upload failed with no detail (might be 413 Payload Too Large)';
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => { reject(new Error('Network error')); };
    xhr.ontimeout = () => { reject(new Error('Upload timed out')); };

    xhr.send(JSON.stringify({ base64, kind: payload.kind, mimeType: payload.mimeType }));
  });
};
export const verifyDriverDocuments = async (driverId: string, approved: boolean, reason?: string, isExperienced: boolean = false): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/admin/driver-verifications/${driverId}`, {
      approved,
      reason,
      isExperienced,
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type GeocodeResponse = {
  latitude: number;
  longitude: number;
  formatted_address: string;
};

export const geocodeAddress = async (address: string): Promise<GeocodeResponse> => {
  try {
    const res = await api.post<ApiResponse<GeocodeResponse>>('/location/geocode', { address });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type ReverseGeocodeResponse = {
  formatted_address: string;
};

export const reverseGeocodeLocation = async (
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResponse> => {
  try {
    const res = await api.post<ApiResponse<ReverseGeocodeResponse>>('/location/reverse-geocode', {
      latitude,
      longitude,
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type RouteResponse = {
  distance: number;
  duration: number;
  polyline: string;
  estimatedFare: number;
  oneWayCharge?: number | null;
};

export const calculateRoute = async (origin: LatLng, destination: LatLng): Promise<RouteResponse> => {
  try {
    const res = await api.post<ApiResponse<RouteResponse>>('/location/route', { origin, destination });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type TripHistoryPoint = {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed: number | null;
  heading: number | null;
};

export const getTripHistory = async (bookingId: string): Promise<TripHistoryPoint[]> => {
  try {
    const res = await api.get<ApiResponse<TripHistoryPoint[]>>(`/location/trip-history/${bookingId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// BOOKING ENDPOINTS
export type CreateBookingRequest = {
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  dropLatitude?: number;
  dropLongitude?: number;
  dropAddress?: string;
  bookingType: BookingType;
  tripType: TripType;
  outstationTripType?: 'ROUND_TRIP' | 'ONE_WAY';
  requestedHours?: number;
  vehicleType?: string;
  transmissionType?: string;
  scheduledTime?: Date;
  paymentMethod: PaymentMethod;
  specialRequests?: string;
  promoCode?: string;
  requireExperienced?: boolean;
};

export const createBooking = async (bookingData: CreateBookingRequest): Promise<any> => {
  try {
    if (!bookingData.vehicleType) {
      throw new ApiRequestError('vehicleType is required');
    }

    const payload = {
      pickup: {
        latitude: bookingData.pickupLatitude,
        longitude: bookingData.pickupLongitude,
        address: bookingData.pickupAddress,
      },
      drop:
        bookingData.dropLatitude !== undefined &&
          bookingData.dropLongitude !== undefined &&
          bookingData.dropAddress
          ? {
            latitude: bookingData.dropLatitude,
            longitude: bookingData.dropLongitude,
            address: bookingData.dropAddress,
          }
          : undefined,
      vehicleType: bookingData.vehicleType,
      transmissionType: bookingData.transmissionType,
      paymentMethod: bookingData.paymentMethod,
      tripType: bookingData.tripType,
      outstationTripType: bookingData.outstationTripType,
      requestedHours: bookingData.requestedHours,
      scheduledTime: bookingData.scheduledTime ? bookingData.scheduledTime.toISOString() : undefined,
      specialRequests: bookingData.specialRequests,
      promoCode: bookingData.promoCode,
      requireExperienced: bookingData.requireExperienced,
    };

    const res = await api.post<ApiResponse<any>>('/bookings', payload);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const acceptBooking = async (bookingId: string, _driverId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/bookings/${bookingId}/accept`, {});
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const rejectBooking = async (bookingId: string, _driverId: string, reason?: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/bookings/${bookingId}/reject`, { reason });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const updateBookingStatus = async (bookingId: string, newStatus: string): Promise<any> => {
  try {
    const res = await api.patch<ApiResponse<any>>(`/bookings/${bookingId}/status`, { status: newStatus });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const verifyBookingOtp = async (bookingId: string, otp: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/bookings/${bookingId}/verify-otp`, { otp });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const cancelBooking = async (
  bookingId: string,
  reason: string,
  cancelledBy: CancelledBy
): Promise<any> => {
  try {
    void cancelledBy;
    const res = await api.post<ApiResponse<any>>(`/bookings/${bookingId}/cancel`, { reason });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const rateBooking = async (
  bookingId: string,
  rating: number,
  review?: string,
  categories?: {
    punctuality?: number;
    driving?: number;
    behavior?: number;
  }
): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/bookings/${bookingId}/rate`, {
      rating,
      review,
      categories,
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getBookingDetails = async (bookingId: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/bookings/${bookingId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getActiveBooking = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/bookings/active');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getAvailableBookings = async (params?: {
  radiusKm?: number;
  limit?: number;
  maxAgeMinutes?: number;
}): Promise<any[]> => {
  try {
    const res = await api.get<ApiResponse<any[]>>('/bookings/available', {
      params: {
        radiusKm: params?.radiusKm,
        limit: params?.limit,
        maxAgeMinutes: params?.maxAgeMinutes,
      },
    });
    const items = unwrap(res);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type BookingHistoryResponse = {
  page: number;
  limit: number;
  bookings: any[];
};

export const getBookingHistory = async (page: number = 1, limit: number = 20): Promise<BookingHistoryResponse> => {
  try {
    const res = await api.get<ApiResponse<BookingHistoryResponse>>('/bookings/user/history', {
      params: { page, limit },
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// PROMOTIONS
export type Promotion = {
  id: string;
  code: string;
  type: string;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  description: string | null;
  termsConditions: string | null;
  validUntil: string;
};

export type PromoValidationResult = {
  promotionId: string;
  code: string;
  type: string;
  discountAmount: number;
  finalAmount: number;
};

export const listActivePromotions = async (): Promise<Promotion[]> => {
  try {
    const res = await api.get<ApiResponse<Promotion[]>>('/promotions');
    const items = unwrap(res);
    return (items || []).map((p: any) => ({
      ...p,
      value: Number(p?.value || 0),
      maxDiscount: p?.maxDiscount === null || p?.maxDiscount === undefined ? null : Number(p.maxDiscount),
      minOrderValue: Number(p?.minOrderValue || 0),
    }));
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const validatePromoCode = async (code: string, amount: number): Promise<PromoValidationResult> => {
  try {
    const res = await api.post<ApiResponse<PromoValidationResult>>('/promotions/validate', { code, amount });
    const data = unwrap(res);
    return {
      ...data,
      discountAmount: Number((data as any)?.discountAmount || 0),
      finalAmount: Number((data as any)?.finalAmount || 0),
    };
  } catch (error) {
    return handleAxiosError(error);
  }
};

// PAYMENTS (BOOKINGS)
export type CashfreeOrderPayload = {
  alreadyPaid: boolean;
  bookingId: string;
  paymentId?: string;
  orderId?: string;
  paymentSessionId?: string;
  amount?: number;
  currency?: string;
};

export const createBookingPaymentOrder = async (bookingId: string): Promise<CashfreeOrderPayload> => {
  try {
    const res = await api.post<ApiResponse<CashfreeOrderPayload>>('/payments/orders', { bookingId });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const verifyBookingPayment = async (params: {
  bookingId: string;
  cf_order_id: string;
}): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/payments/verify', params);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getBookingPaymentStatus = async (bookingId: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/payments/status/${bookingId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const collectCashPayment = async (bookingId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/payments/collect-cash', { bookingId });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

/** Returns the full URL to download the invoice PDF for a completed booking. */
export const getInvoicePdfUrl = (bookingId: string): string => {
  const baseURL = api.defaults.baseURL || '';
  return `${baseURL}/invoices/${bookingId}/pdf`;
};


// WALLET
export const getWalletBalance = async (): Promise<{ balance: number; currency: string }> => {
  try {
    const res = await api.get<ApiResponse<{ balance: number; currency: string }>>('/wallet/balance');
    const data = unwrap(res);
    return { balance: Number((data as any)?.balance || 0), currency: String((data as any)?.currency || 'INR') };
  } catch (error) {
    return handleAxiosError(error);
  }
};

export type WalletTx = {
  id: string;
  type: string;
  reason: string;
  status: string;
  amount: number;
  balanceAfter: number;
  bookingId: string | null;
  paymentId: string | null;
  createdAt: string;
  meta: any;
};

export const getWalletTransactions = async (limit: number = 50): Promise<WalletTx[]> => {
  try {
    const res = await api.get<ApiResponse<WalletTx[]>>('/wallet/transactions', { params: { limit } });
    const txs = unwrap(res);
    return (txs || []).map((t: any) => ({
      ...t,
      amount: Number(t?.amount || 0),
      balanceAfter: Number(t?.balanceAfter || 0),
    }));
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const createWalletTopupOrder = async (amount: number, paymentMethod?: PaymentMethod): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/wallet/topup/orders', { amount, paymentMethod });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const verifyWalletTopup = async (params: {
  cf_order_id: string;
}): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/wallet/topup/verify', params);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const payBookingWithWallet = async (bookingId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/wallet/pay-booking', { bookingId });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// MEMBERSHIP
export type MembershipPlan = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  price: number;
  durationDays: number;
  isActive: boolean;
};

export const listMembershipPlans = async (): Promise<MembershipPlan[]> => {
  try {
    const res = await api.get<ApiResponse<MembershipPlan[]>>('/membership/plans');
    const plans = unwrap(res);
    return (plans || []).map((p: any) => ({
      ...p,
      price: Number(p?.price || 0),
    }));
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getCurrentMembership = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/membership/current');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const createMembershipOrder = async (membershipType: string, paymentMethod?: PaymentMethod): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/membership/orders', { membershipType, paymentMethod });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const verifyMembershipPurchase = async (params: {
  purchaseId: string;
  cf_order_id: string;
}): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/membership/verify', params);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// DISCOUNT PREVIEW
export type DiscountPreview = {
  membershipType: string;
  membershipDiscount: number;
  membershipLabel: string | null;
  streakRides: number;
  streakPct: number;
  streakDiscount: number;
  streakLabel: string | null;
  nextStreakTier: { rides: number; pct: number } | null;
  totalDiscount: number;
  finalAmount: number;
  requireExperienced: boolean;
  isPremium: boolean;
  favoriteDriverIds: string[];
};

export const getDiscountPreview = async (amount: number): Promise<DiscountPreview> => {
  try {
    const res = await api.get<ApiResponse<DiscountPreview>>('/features/discounts/preview', { params: { amount } });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// FAVORITE DRIVERS
export type FavoriteDriver = {
  id: string;
  name: string;
  phone: string;
  photo: string | null;
  rating: number;
  totalTrips: number;
  isExperienced: boolean;
  vehicleTypes: string[];
};

export const listFavoriteDrivers = async (): Promise<FavoriteDriver[]> => {
  try {
    const res = await api.get<ApiResponse<FavoriteDriver[]>>('/features/favorite-drivers');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const addFavoriteDriver = async (driverId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/features/favorite-drivers/${driverId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const removeFavoriteDriver = async (driverId: string): Promise<any> => {
  try {
    const res = await api.delete<ApiResponse<any>>(`/features/favorite-drivers/${driverId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const checkFavoriteDriver = async (driverId: string): Promise<{ isFavorite: boolean }> => {
  try {
    const res = await api.get<ApiResponse<{ isFavorite: boolean }>>(`/features/favorite-drivers/${driverId}/check`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// TIPS
export const createTip = async (params: { bookingId: string; amount: number; paymentMethod: PaymentMethod }): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/tips', params);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const payTipWithWallet = async (tipId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/tips/wallet/pay', { tipId });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const createTipOrder = async (tipId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/tips/orders', { tipId });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const verifyTipPayment = async (params: {
  tipId: string;
  cf_order_id: string;
}): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/tips/verify', params);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// INVOICES
export const getInvoice = async (bookingId: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/invoices/${bookingId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const downloadInvoicePdf = async (bookingId: string): Promise<ArrayBuffer> => {
  try {
    const res = await api.get(`/invoices/${bookingId}/pdf`, { responseType: 'arraybuffer' });
    return res.data as ArrayBuffer;
  } catch (error) {
    return handleAxiosError(error);
  }
};

// DRIVER ENDPOINTS
export const goOnline = async (): Promise<any> => {
  try {
    const res = await api.patch<ApiResponse<any>>('/drivers/status/online');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const goOffline = async (): Promise<any> => {
  try {
    const res = await api.patch<ApiResponse<any>>('/drivers/status/offline');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverEarnings = async (period: 'today' | 'week' | 'month' = 'today'): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/drivers/earnings', { params: { period } });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getEarningsBreakdown = async (startDate: string, endDate: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/drivers/earnings/breakdown', {
      params: { startDate, endDate },
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const requestPayout = async (amount: number, method: PayoutMethod): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/drivers/payout/request', { amount, method });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getPerformanceMetrics = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/drivers/metrics');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverTripHistory = async (page: number = 1, limit: number = 20): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/drivers/trips', { params: { page, limit } });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const updateDriverAvailability = async (isAvailable: boolean): Promise<any> => {
  try {
    const res = await api.patch<ApiResponse<any>>('/drivers/availability', { isAvailable });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ── Trip Sharing ────────────────────────────────────────────────────

export const createTripShareLink = async (bookingId: string): Promise<{ shareToken: string; shareUrl: string }> => {
  try {
    const res = await api.post<ApiResponse<{ shareToken: string; shareUrl: string }>>(`/bookings/${bookingId}/share`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ── Referrals ───────────────────────────────────────────────────────

export const generateReferralCode = async (type: 'DRIVER' | 'CUSTOMER'): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/features/referral/my-code', { params: { type } });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const applyReferralCode = async (code: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/features/referral/apply', { code });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getReferralStats = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/features/referral/stats');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ── Driver Incentives ───────────────────────────────────────────────

export const getDriverIncentives = async (): Promise<any[]> => {
  try {
    const res = await api.get<ApiResponse<any[]>>('/features/incentives');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverIncentiveProgress = async (): Promise<any[]> => {
  try {
    const res = await api.get<ApiResponse<any[]>>('/features/incentives/progress');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ── Rewards Coins ───────────────────────────────────────────────────

export const getRewardsBalance = async (): Promise<{ balance: number }> => {
  try {
    const res = await api.get<ApiResponse<{ balance: number }>>('/features/rewards/balance');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getRewardsSummary = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/features/rewards/summary');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getRewardsHistory = async (limit = 50): Promise<any[]> => {
  try {
    const res = await api.get<ApiResponse<any[]>>('/features/rewards/history', { params: { limit } });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const redeemRewardsCoins = async (coins: number, bookingId: string): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/features/rewards/redeem', { coins, bookingId });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ── Driver Wallet ───────────────────────────────────────────────────

export const getDriverWalletSummary = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/driver-wallet/summary');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverWalletTransactions = async (limit = 50): Promise<any[]> => {
  try {
    const res = await api.get<ApiResponse<any[]>>('/driver-wallet/transactions', { params: { limit } });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const requestDriverPayout = async (amount: number, method: 'BANK' | 'UPI', details?: any): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/driver-wallet/payout', { amount, method, ...details });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverPayoutHistory = async (): Promise<any[]> => {
  try {
    const res = await api.get<ApiResponse<any[]>>('/driver-wallet/payouts');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// Backwards-compatible aliases
export const updateBookingStatusApi = updateBookingStatus;

// ── Driver Subscription ─────────────────────────────────────────────

export const getDriverSubscriptionStatus = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/driver/subscription');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const createDriverSubscriptionOrder = async (paymentMethod: 'UPI' | 'CARD' | 'WALLET'): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/driver/subscription/create', { paymentMethod });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const verifyDriverSubscriptionPayment = async (
  cfOrderId: string
): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>('/driver/subscription/verify', {
      cfOrderId,
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ─── Trip Photos ───────────────────────────────────────────────────────────────
export const uploadTripPhoto = async (params: {
  bookingId: string;
  base64: string;
  mimeType: string;
  phase: 'BEFORE' | 'AFTER';
  label: string;
  latitude?: number;
  longitude?: number;
}): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/trip-photos/${params.bookingId}/upload`, {
      base64: params.base64,
      mimeType: params.mimeType,
      phase: params.phase,
      label: params.label,
      latitude: params.latitude,
      longitude: params.longitude,
    });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getTripPhotos = async (bookingId: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/trip-photos/${bookingId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getTripPhotoCount = async (bookingId: string, phase: 'BEFORE' | 'AFTER'): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/trip-photos/${bookingId}/count/${phase}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

// ─── Driver Badges ─────────────────────────────────────────────────────────────
export const getAllBadges = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/badges');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getMyBadges = async (): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>('/badges/my');
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getDriverBadgesApi = async (driverId: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/badges/driver/${driverId}`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const getBadgeQuiz = async (badgeId: string): Promise<any> => {
  try {
    const res = await api.get<ApiResponse<any>>(`/badges/${badgeId}/quiz`);
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};

export const submitBadgeQuiz = async (badgeId: string, answers: number[]): Promise<any> => {
  try {
    const res = await api.post<ApiResponse<any>>(`/badges/${badgeId}/quiz`, { answers });
    return unwrap(res);
  } catch (error) {
    return handleAxiosError(error);
  }
};
