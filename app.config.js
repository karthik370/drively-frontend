const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = config && Object.keys(config).length ? config : appJson.expo;

  // Single key from .env covers both Android and iOS
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.ANDROID_GOOGLE_MAPS_API_KEY ||
    process.env.IOS_GOOGLE_MAPS_API_KEY;

  return {
    ...base,
    ios: {
      ...(base.ios || {}),
      config: {
        ...((base.ios || {}).config || {}),
        googleMapsApiKey: mapsKey || ((base.ios || {}).config || {}).googleMapsApiKey,
      },
    },
    android: {
      ...(base.android || {}),
      config: {
        ...((base.android || {}).config || {}),
        googleMaps: {
          ...(((base.android || {}).config || {}).googleMaps || {}),
          apiKey: mapsKey || (((base.android || {}).config || {}).googleMaps || {}).apiKey,
        },
      },
    },
  };
};
