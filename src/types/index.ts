export enum UserType {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  BOTH = 'BOTH',
}

export enum BookingStatus {
  REQUESTED = 'REQUESTED',
  SEARCHING = 'SEARCHING',
  ACCEPTED = 'ACCEPTED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  ARRIVED = 'ARRIVED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  WALLET = 'WALLET',
}

export enum VehicleType {
  CAR = 'CAR',
  SUV = 'SUV',
  HATCHBACK = 'HATCHBACK',
  SEDAN = 'SEDAN',
  LUXURY = 'LUXURY',
}

export enum TransmissionType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

export enum TripType {
  ONE_WAY = 'ONE_WAY',
  ROUND_TRIP = 'ROUND_TRIP',
  OUTSTATION = 'OUTSTATION',
}

export interface User {
  id: string;
  phoneNumber: string;
  email?: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  userType: UserType;
  rating: number;
  totalRatings: number;
  isVerified: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Address {
  address: string;
  location: Location;
  label?: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  customer: User;
  driver?: User;
  otp?: string | null;
  pickupLocation: Location;
  pickupAddress: string;
  dropLocation?: Location;
  dropAddress?: string;
  scheduledTime?: string;
  vehicleType: VehicleType;
  transmissionType?: TransmissionType;
  tripType?: TripType;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  roleOverride: UserType | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
