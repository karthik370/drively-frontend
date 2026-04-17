import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { store } from './src/redux/store';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/constants/theme';
import NotificationToast from './src/components/NotificationToast';
import { CustomAlertProvider, AlertBridge } from './src/components/common/CustomAlert';
import AnimatedSplash from './src/components/common/AnimatedSplash';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from './src/constants/config';
import { OTPWidget } from '@msg91comm/sendotp-react-native';
import * as Notifications from 'expo-notifications';

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
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
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
