module.exports = ({ config }) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...(config.ios && config.ios.config),
        ...(apiKey ? { googleMapsApiKey: apiKey } : {}),
      },
    },
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        ...(apiKey ? { googleMaps: { apiKey } } : {}),
      },
    },
  };
};
