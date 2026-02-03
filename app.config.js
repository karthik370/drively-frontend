const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = config && Object.keys(config).length ? config : appJson.expo;

  const androidKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_ANDROID_GOOGLE_MAPS_API_KEY;
  const iosKey = process.env.IOS_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_IOS_GOOGLE_MAPS_API_KEY;

  return {
    ...base,
    ios: {
      ...(base.ios || {}),
      config: {
        ...((base.ios || {}).config || {}),
        googleMapsApiKey: iosKey || ((base.ios || {}).config || {}).googleMapsApiKey,
      },
    },
    android: {
      ...(base.android || {}),
      config: {
        ...((base.android || {}).config || {}),
        googleMaps: {
          ...(((base.android || {}).config || {}).googleMaps || {}),
          apiKey:
            androidKey ||
            ((((base.android || {}).config || {}).googleMaps || {}) || {}).apiKey,
        },
      },
    },
  };
};
