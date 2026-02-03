import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Location } from '../../types';

interface LocationState {
  userLocation: Location | null;
  driverLocation:
    | (Location & {
        accuracy?: number;
        heading?: number;
        speed?: number;
        timestamp?: string;
      })
    | null;
  pickupLocation: Location | null;
  pickupAddress: string | null;
  dropLocation: Location | null;
  dropAddress: string | null;
  isTracking: boolean;

  currentLocation:
    | {
        latitude: number;
        longitude: number;
        accuracy?: number;
        heading?: number;
        speed?: number;
        timestamp?: string;
      }
    | null;
  trackingType: 'foreground' | 'background' | null;
  eta: number | null;
  distance: number | null;
  routePolyline: string | null;
  decodedRoute: Array<{ latitude: number; longitude: number }> | null;
  hasLocationPermission: boolean;
  hasBackgroundPermission: boolean;
  error: string | null;
}

const initialState: LocationState = {
  userLocation: null,
  driverLocation: null,
  pickupLocation: null,
  pickupAddress: null,
  dropLocation: null,
  dropAddress: null,
  isTracking: false,
  currentLocation: null,
  trackingType: null,
  eta: null,
  distance: null,
  routePolyline: null,
  decodedRoute: null,
  hasLocationPermission: false,
  hasBackgroundPermission: false,
  error: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    updateLocation: (
      state,
      action: PayloadAction<{
        latitude: number;
        longitude: number;
        accuracy?: number;
        heading?: number;
        speed?: number;
        timestamp?: string;
      }>
    ) => {
      state.currentLocation = action.payload;
      state.userLocation = { latitude: action.payload.latitude, longitude: action.payload.longitude };
      state.error = null;
    },
    setUserLocation: (state, action: PayloadAction<Location>) => {
      state.userLocation = action.payload;
      state.currentLocation = {
        latitude: action.payload.latitude,
        longitude: action.payload.longitude,
      };
    },
    setDriverLocation: (state, action: PayloadAction<Location>) => {
      state.driverLocation = action.payload;
    },
    setPickupLocation: (state, action: PayloadAction<Location>) => {
      state.pickupLocation = action.payload;
    },
    setPickupAddress: (state, action: PayloadAction<string | null>) => {
      state.pickupAddress = action.payload;
    },
    setDropLocation: (state, action: PayloadAction<Location>) => {
      state.dropLocation = action.payload;
    },
    setDropAddress: (state, action: PayloadAction<string | null>) => {
      state.dropAddress = action.payload;
    },
    setTracking: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },
    setTrackingActive: (
      state,
      action: PayloadAction<{ isTracking: boolean; trackingType: 'foreground' | 'background' | null }>
    ) => {
      state.isTracking = action.payload.isTracking;
      state.trackingType = action.payload.trackingType;
    },
    updateETA: (state, action: PayloadAction<{ eta: number; distance?: number }>) => {
      state.eta = action.payload.eta;
      if (action.payload.distance !== undefined) {
        state.distance = action.payload.distance;
      }
    },
    setRoute: (
      state,
      action: PayloadAction<{ polyline: string; decodedRoute: Array<{ latitude: number; longitude: number }> }>
    ) => {
      state.routePolyline = action.payload.polyline;
      state.decodedRoute = action.payload.decodedRoute;
    },
    setLocationPermissions: (
      state,
      action: PayloadAction<{ hasLocationPermission: boolean; hasBackgroundPermission: boolean }>
    ) => {
      state.hasLocationPermission = action.payload.hasLocationPermission;
      state.hasBackgroundPermission = action.payload.hasBackgroundPermission;
    },
    setLocationError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearDriverLocation: (state) => {
      state.driverLocation = null;
      state.eta = null;
      state.distance = null;
    },
    clearRoute: (state) => {
      state.routePolyline = null;
      state.decodedRoute = null;
    },
    clearLocations: (state) => {
      state.pickupLocation = null;
      state.pickupAddress = null;
      state.dropLocation = null;
      state.dropAddress = null;
      state.driverLocation = null;
    },
  },
});

export const {
  updateLocation,
  setUserLocation,
  setDriverLocation,
  setPickupLocation,
  setPickupAddress,
  setDropLocation,
  setDropAddress,
  setTracking,
  setTrackingActive,
  updateETA,
  setRoute,
  setLocationPermissions,
  setLocationError,
  clearDriverLocation,
  clearRoute,
  clearLocations,
} = locationSlice.actions;

export default locationSlice.reducer;
