import { Platform } from 'react-native';

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

const normalizeAwsAlbUrl = (raw: string): string => {
  const s = String(raw || '').trim();
  if (!s) return '';

  const forceHttps = String(process.env.EXPO_PUBLIC_FORCE_HTTPS || '').trim().toLowerCase() === 'true';

  const lower = s.toLowerCase();
  const isHttp = lower.startsWith('http://');
  if (!isHttp) return s;

  if (!forceHttps) return s;

  const isLocal = lower.includes('10.0.2.2') || lower.includes('localhost') || lower.includes('127.0.0.1');
  if (isLocal) return s;

  const isAws = lower.includes('elb.amazonaws.com') || lower.includes('.amazonaws.com');
  if (!isAws) return s;

  return `https://${s.slice('http://'.length)}`;
};

const API_URL_RAW = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_HOST}:5000/api/v1`;
const SOCKET_URL_RAW = process.env.EXPO_PUBLIC_SOCKET_URL || `http://${DEFAULT_HOST}:5000`;

export const API_URL = normalizeAwsAlbUrl(API_URL_RAW);
export const SOCKET_URL = normalizeAwsAlbUrl(SOCKET_URL_RAW);
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_ANDROID_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_IOS_GOOGLE_MAPS_API_KEY ||
  '';
export const CASHFREE_APP_ID = process.env.EXPO_PUBLIC_CASHFREE_APP_ID || '';
export const CASHFREE_ENV = process.env.EXPO_PUBLIC_CASHFREE_ENV || 'SANDBOX';
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '';
export const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '';

export const APP_CONFIG = {
  name: 'Drively',
  version: '1.0.0',
  supportEmail: 'support@drively.in',
  supportPhone: '+916304767391',
};

export const LOCATION_CONFIG = {
  accuracy: 6,
  distanceInterval: 10,
  timeInterval: 5000,
};

export const NOTIFICATION_CONFIG = {
  channelId: 'drively-default',
  channelName: 'Drively Notifications',
};
