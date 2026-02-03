import { Platform } from 'react-native';

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:5000/api/v1`;
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || `http://${DEFAULT_HOST}:5000`;
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_ANDROID_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_IOS_GOOGLE_MAPS_API_KEY ||
  '';
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '';
export const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '';

export const APP_CONFIG = {
  name: 'DriveMate',
  version: '1.0.0',
  supportEmail: 'support@drivemate.com',
  supportPhone: '+1234567890',
};

export const LOCATION_CONFIG = {
  accuracy: 6,
  distanceInterval: 10,
  timeInterval: 5000,
};

export const NOTIFICATION_CONFIG = {
  channelId: 'drivemate-default',
  channelName: 'DriveMate Notifications',
};
