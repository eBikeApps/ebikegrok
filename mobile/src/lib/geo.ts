import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type LatLng = { latitude: number; longitude: number };

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

export function toLatLng(
  lat: unknown,
  lng: unknown
): LatLng | null {
  if (!isValidLatLng(lat, lng)) return null;
  return { latitude: Number(lat), longitude: Number(lng) };
}

export function pickLatLng(
  point?: { latitude?: unknown; longitude?: unknown } | null
): LatLng | null {
  if (!point) return null;
  return toLatLng(point.latitude, point.longitude);
}

export function mapRegionForPoints(a: LatLng, b: LatLng) {
  const latDelta = Math.max(Math.abs(a.latitude - b.latitude) * 2.2, 0.012);
  const lngDelta = Math.max(Math.abs(a.longitude - b.longitude) * 2.2, 0.012);
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export function safeHttpUri(uri?: string | null): string | undefined {
  if (!uri || typeof uri !== 'string') return undefined;
  const trimmed = uri.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
  return undefined;
}

export function firstSearchParam(value?: string | string[]): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function safeImageSource(uri?: string | null): { uri: string } | undefined {
  const safe = safeHttpUri(uri);
  return safe ? { uri: safe } : undefined;
}

export function googleMapsApiKey(): string {
  const androidKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  const iosKey = Constants.expoConfig?.ios?.config?.googleMapsApiKey;
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const key = androidKey || iosKey || envKey;
  return typeof key === 'string' ? key.trim() : '';
}

/** Android Google Maps crashes native without android.config.googleMaps.apiKey. */
export function canMountGoogleMap(): boolean {
  if (Platform.OS !== 'android') return true;
  return googleMapsApiKey().length > 0;
}
