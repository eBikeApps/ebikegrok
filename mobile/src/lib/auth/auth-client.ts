import "./auth-polyfill";
import * as WebBrowser from "expo-web-browser";
import { createAuthClient } from "better-auth/react";
import { expoClient, getSetCookie } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

// Lets iOS complete ASWebAuthenticationSession when the app is opened via deep link
WebBrowser.maybeCompleteAuthSession();

// Always the App Store / standalone scheme. Expo Dev Client would report
// "exp+ebike", which production Better Auth does not treat as a trusted origin.
const APP_SCHEME = "ebike";

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

export const AUTH_COOKIE_KEY = "ebike_cookie";

/** Pull the session cookie better-auth appends to the OAuth redirect URL. */
export function extractOAuthCookieFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const marker = "cookie=";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const raw = url.slice(idx + marker.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Persist the Set-Cookie header the same way @better-auth/expo does. */
export function persistOAuthCookie(setCookieHeader: string): void {
  if (!setCookieHeader.trim()) return;
  try {
    const prev = SecureStore.getItem(AUTH_COOKIE_KEY);
    const next = getSetCookie(setCookieHeader, prev ?? undefined);
    SecureStore.setItem(AUTH_COOKIE_KEY, next);
  } catch (e) {
    console.warn("[Auth] Failed to persist OAuth cookie:", e);
  }
}

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
