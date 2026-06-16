import "./auth-polyfill";
import "expo-web-browser"; // Static import so Metro bundles it for @better-auth/expo dynamic import
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";

// Detect the actual registered scheme at runtime.
// In Vibecode sandbox the scheme is "vibecode"; in production builds it's "ebike".
const APP_SCHEME = (() => {
  try {
    const url = Linking.createURL("");
    return url.split("://")[0] || "ebike";
  } catch {
    return "ebike";
  }
})();

// NOTE: @better-auth/expo's client treats `storage.getItem` as SYNCHRONOUS
// (it does not await the result internally). AsyncStorage returns Promises, so
// passing it directly caused JSON.parse(Promise) to throw silently — the cookie
// was stored after sign-in but never read back, so /api/auth/get-session was
// called without a cookie, the session was null, and the user got bounced back
// to /sign-in immediately after a successful login.
//
// SecureStore.getItem is genuinely synchronous and is the storage the
// better-auth Expo plugin is designed for. The 2048-byte per-value cap is
// comfortably above our cookie payload (session token JSON ~150-250 bytes).
const secureStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      return SecureStore.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      // Sync write so the value is readable immediately on the next request.
      SecureStore.setItem(key, value);
    } catch (e) {
      console.warn(`[Auth] Failed to persist ${key}:`, e);
    }
  },
  removeItem: (key: string): void => {
    SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL! as string, // IMPORTANT: Use exactly as is written here
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: "ebike",
      storage: secureStorageAdapter,
      // We cache the session in React Query (useSession) — don't double-store it
      // in SecureStore where a large user.image could exceed the 2048-byte cap.
      disableCache: true,
    }),
  ],
});
