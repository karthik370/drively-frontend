import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, ActivityIndicator, View, StyleSheet, Linking } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { navigationTheme } from '../theme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { useAppSelector, useAppDispatch } from '../redux/store';
import { loadUser } from '../redux/slices/authSlice';
import { loadDriverVerificationStatus } from '../redux/slices/driverSlice';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';
import { clearCurrentBooking, setCurrentBooking } from '../redux/slices/bookingSlice';
import {
  clearLocations,
  clearRoute,
  setDropAddress,
  setDropLocation,
  setPickupAddress,
  setPickupLocation,
} from '../redux/slices/locationSlice';
import { getActiveBooking, registerExpoPushToken } from '../services/api';
import { BookingStatus } from '../types';
import socketService from '../services/socketService';

const Stack = createNativeStackNavigator();

const navigationRef = createNavigationContainerRef<any>();

// Deep linking configuration for trip sharing
const linking = {
  prefixes: ['drively://', 'https://v2.kurnm.click'],
  config: {
    screens: {
      Main: {
        screens: {
          MainTabs: {
            screens: {
              SharedTrip: {
                path: 'track/:shareToken',
              },
            },
          },
        },
      },
    },
  },
  // Handle URLs that don't match config — manual parsing
  getStateFromPath: (path: string) => {
    const trackMatch = path.match(/^\/?track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
      return {
        routes: [
          {
            name: 'Main',
            state: {
              routes: [
                {
                  name: 'MainTabs',
                  state: {
                    routes: [
                      {
                        name: 'SharedTrip',
                        params: { shareToken: trackMatch[1] },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      };
    }
    return undefined;
  },
};

const EXPO_PUSH_TOKEN_KEY = 'expoPushToken';

const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const booking = useAppSelector((state) => state.booking.currentBooking);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const hydrateRef = useRef(false);
  const hydrateInFlightRef = useRef(false);
  const verificationHydratedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.id) return;

    let active = true;
    void (async () => {
      try {
        if (!Device.isDevice) {
          console.log('[PushToken] Not a physical device, skipping push token registration');
          return;
        }

        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
          const next = await Notifications.requestPermissionsAsync();
          if (!next.granted && next.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
            console.log('[PushToken] Notification permission denied, skipping');
            return;
          }
        }

        const projectId =
          (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
          (Constants as any)?.easConfig?.projectId ||
          'f83fb1ee-b304-4120-bb2d-6d950b6f569a'; // fallback to known project ID

        console.log('[PushToken] Getting push token with projectId:', projectId);
        const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = String(tokenRes?.data || '').trim();
        if (!token) {
          console.log('[PushToken] No token received');
          return;
        }

        console.log('[PushToken] Got token:', token.substring(0, 40) + '...');

        if (!active) return;
        // Always register to backend — deduplicated server-side by upsert
        await registerExpoPushToken({ token, platform: Device.osName ? String(Device.osName).toLowerCase() : undefined });
        console.log('[PushToken] Registered successfully to backend');
        await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, token);
      } catch (err) {
        console.log('[PushToken] Error:', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id]);

  const isActiveTripStatus = (status: any) => {
    return [
      BookingStatus.REQUESTED,
      BookingStatus.SEARCHING,
      BookingStatus.ACCEPTED,
      BookingStatus.DRIVER_ARRIVING,
      BookingStatus.ARRIVED,
      BookingStatus.STARTED,
      BookingStatus.IN_PROGRESS,
    ].includes(status);
  };

  const hydrateActiveTrip = async () => {
    if (hydrateInFlightRef.current) return;
    hydrateInFlightRef.current = true;
    try {
      const raw = await getActiveBooking();
      if (!raw || !raw.id) {
        if (booking?.id && isActiveTripStatus(booking.status)) {
          dispatch(clearCurrentBooking());
          dispatch(clearLocations());
          dispatch(clearRoute());
        }
        return;
      }

      const status = (raw as any)?.status;
      if (!isActiveTripStatus(status)) {
        if (booking?.id && isActiveTripStatus(booking.status)) {
          dispatch(clearCurrentBooking());
          dispatch(clearLocations());
          dispatch(clearRoute());
        }
        return;
      }

      const now = new Date().toISOString();

      const pickupLat = Number((raw as any)?.pickupLocationLat ?? (raw as any)?.pickupLatitude ?? (raw as any)?.pickup?.latitude);
      const pickupLng = Number((raw as any)?.pickupLocationLng ?? (raw as any)?.pickupLongitude ?? (raw as any)?.pickup?.longitude);
      if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
        dispatch(setPickupLocation({ latitude: pickupLat, longitude: pickupLng }));
      }
      dispatch(setPickupAddress(typeof (raw as any)?.pickupAddress === 'string' ? (raw as any).pickupAddress : null));

      const dropLatRaw = (raw as any)?.dropLocationLat ?? (raw as any)?.dropLatitude ?? (raw as any)?.drop?.latitude;
      const dropLngRaw = (raw as any)?.dropLocationLng ?? (raw as any)?.dropLongitude ?? (raw as any)?.drop?.longitude;
      const dropLat = dropLatRaw !== undefined && dropLatRaw !== null ? Number(dropLatRaw) : NaN;
      const dropLng = dropLngRaw !== undefined && dropLngRaw !== null ? Number(dropLngRaw) : NaN;
      if (Number.isFinite(dropLat) && Number.isFinite(dropLng)) {
        dispatch(setDropLocation({ latitude: dropLat, longitude: dropLng }));
      }
      dispatch(setDropAddress(typeof (raw as any)?.dropAddress === 'string' ? (raw as any).dropAddress : null));

      dispatch(
        setCurrentBooking({
          id: String((raw as any)?.id),
          bookingNumber: String((raw as any)?.bookingNumber ?? ''),
          status: status as any,
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
          vehicleType: (raw as any)?.vehicleType as any,
          tripType: (raw as any)?.tripType as any,
          totalAmount: typeof (raw as any)?.totalAmount === 'number' ? (raw as any).totalAmount : Number((raw as any)?.totalAmount || 0),
          paymentMethod: (raw as any)?.paymentMethod as any,
          createdAt: (raw as any)?.createdAt ? String((raw as any).createdAt) : now,
          updatedAt: (raw as any)?.updatedAt ? String((raw as any).updatedAt) : now,
        } as any)
      );

      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Main', {
          screen: 'MainTabs',
          params: { screen: 'Tracking' },
        });
      }
    } catch {
    } finally {
      hydrateInFlightRef.current = false;
    }
  };

  useEffect(() => {
    dispatch(loadUser()).finally(() => {
      setIsBootLoading(false);
    });
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      void socketService.connect();
    } catch {
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    try {
      socketService.disconnect();
    } catch {
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (verificationHydratedRef.current) return;

    const ut = String((user as any)?.userType || '');
    if (ut !== 'DRIVER' && ut !== 'BOTH') return;

    verificationHydratedRef.current = true;
    void dispatch(loadDriverVerificationStatus());
  }, [dispatch, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (hydrateRef.current) return;
    hydrateRef.current = true;
    void hydrateActiveTrip();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    hydrateRef.current = false;
    verificationHydratedRef.current = false;
  }, [isAuthenticated]);

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (!isAuthenticated) return;
      void hydrateActiveTrip();
    };

    const sub = AppState.addEventListener('change', handler);
    return () => {
      sub.remove();
    };
  }, [booking?.id, booking?.status, isAuthenticated]);

  if (isBootLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme as any} linking={linking as any}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={DrawerNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
});

export default AppNavigator;
