import 'react-native-gesture-handler';
// ⚠️ This import MUST be at the top level before registerRootComponent.
// It causes TaskManager.defineTask() to run at app startup, which is
// required for background location tasks to work in expo-task-manager.
import './src/services/locationService';

import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider, useSelector } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { store, RootState } from './src/redux/store';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/constants/theme';
import NotificationToast from './src/components/NotificationToast';
import { CustomAlertProvider, AlertBridge } from './src/components/common/CustomAlert';
import AnimatedSplash from './src/components/common/AnimatedSplash';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from './src/constants/config';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import { registerExpoPushToken } from './src/services/api';

// ── Push Token Registrar ──────────────────────────────────────────────────────
// Watches Redux auth state. On first login, gets the Expo push token and saves
// it to the backend. Without this, the expo_push_tokens table stays empty and
// push notifications are NEVER delivered (booking offers, status updates, etc.).
// Must be rendered INSIDE the ReduxProvider.
function PushTokenRegistrar() {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || registeredRef.current) return;
    registeredRef.current = true;

    void (async () => {
      try {
        // Physical device required — emulators can't get real push tokens
        if (!Device.isDevice) return;

        // Check notification permission
        const perm = await Notifications.getPermissionsAsync();
        const granted = perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!granted) return;

        // Get the Expo push token (uses the EAS projectId from app.json)
        const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId as string | undefined;
        if (!projectId) return;

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const platform = Platform.OS; // 'android' | 'ios'

        // Save to backend → expoPushToken table → enables push notifications
        await registerExpoPushToken({ token: tokenData.data, platform });
      } catch {
        // Non-fatal: app works without push token, driver just won't get background pushes
      }
    })();
  }, [isAuthenticated]);

  return null;
}

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync(MaterialCommunityIcons.font);
      } catch (e) {
        console.warn(e);
      } finally {
        setFontsLoaded(true);
        // Hide the native splash immediately — our animated one takes over
        SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    const widgetId = String(MSG91_WIDGET_ID || '').trim();
    const tokenAuth = String(MSG91_TOKEN_AUTH || '').trim();
    if (widgetId && tokenAuth) {
      try {
        OTPWidget.initializeWidget(widgetId, tokenAuth);
      } catch (e) {
        console.warn(e);
      }
    }
  }, []);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as any;
        const kind = data?.kind as string | undefined;
        const isBookingOffer = kind === 'booking_offer' || kind === 'favorite_booking_offer';

        if (isBookingOffer) {
          const state = store.getState() as any;
          const isDriverOnline = Boolean(state?.driver?.isOnline);

          // Driver is offline → suppress all booking offer pushes
          if (!isDriverOnline) {
            return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
          }

          // Socket events arrive in ~ms; push notifications arrive 1-5s later via Expo→FCM/APNs.
          // If the booking is already in Redux (added by the socket before push arrived),
          // it means this is a pre-existing booking from kickoff matching — suppress the push banner.
          // Brand-new bookings (driver didn't receive socket yet) are NOT in Redux → push shown.
          const bookingId = data?.bookingId as string | undefined;
          if (bookingId) {
            const existingRequests = (state?.booking?.bookingRequests || []) as Array<{ id: string }>;
            const alreadyInList = existingRequests.some((r) => r.id === bookingId);
            if (alreadyInList) {
              // Already visible in the list via socket → no need for OS banner
              return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
            }
          }
        }

        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });

    void (async () => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
          await Notifications.requestPermissionsAsync();
        }

        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        });
      } catch {
      }
    })();
  }, []);

  // Show nothing until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <ReduxProvider store={store}>
      <PaperProvider theme={theme}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <CustomAlertProvider>
              {/* Registers Expo push token with backend on first login */}
              <PushTokenRegistrar />
              <AlertBridge />
              <StatusBar style="light" />
              <NotificationToast />
              <AppNavigator />
              {/* Animated splash overlays everything until its animation finishes */}
              {!splashDone && (
                <AnimatedSplash onFinish={() => setSplashDone(true)} />
              )}
            </CustomAlertProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </PaperProvider>
    </ReduxProvider>
  );
}
