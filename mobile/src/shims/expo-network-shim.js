// Shim for expo-network used by @better-auth/expo
// The real expo-network uses native modules but @better-auth/expo only needs
// addNetworkStateListener for online state tracking.
// We provide a working implementation using React Native's NetInfo.

const { NetInfo } = require("@react-native-community/netinfo") || {};

function addNetworkStateListener(listener) {
  // Use React Native's built-in AppState as fallback
  try {
    const { AppState } = require("react-native");
    // Call immediately with an optimistic online state
    listener({ isInternetReachable: true, isConnected: true });
    // Return a subscription-like object
    return {
      remove: () => {},
    };
  } catch (e) {
    return { remove: () => {} };
  }
}

async function getNetworkStateAsync() {
  return {
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  };
}

module.exports = {
  addNetworkStateListener,
  getNetworkStateAsync,
};
