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
import { MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from './src/constants/config';
import { OTPWidget } from '@msg91comm/sendotp-react-native';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync(MaterialCommunityIcons.font);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
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
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <ReduxProvider store={store}>
      <PaperProvider theme={theme}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <NotificationToast />
          <AppNavigator />
        </SafeAreaProvider>
      </PaperProvider>
    </ReduxProvider>
  );
}
