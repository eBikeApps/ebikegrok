import { Location } from './types';

/** Tel Aviv — default for simulator when GPS is outside Israel */
export const DEFAULT_CUSTOMER_LOCATION: Location = {
  latitude: 32.0853,
  longitude: 34.7818,
};

/** Rough Israel bounding box (includes TLV, Jerusalem, Haifa, Beer Sheva) */
export function isInIsrael(location: Location): boolean {
  const { latitude: lat, longitude: lng } = location;
  return lat >= 29.4 && lat <= 33.6 && lng >= 34.2 && lng <= 35.95;
}

/**
 * iOS Simulator reports Cupertino (37°, -122°) by default — that filters out
 * all Israeli technicians. In dev, fall back to Tel Aviv when GPS is abroad.
 */
export function getEffectiveCustomerLocation(
  location: Location | null | undefined
): Location {
  if (!location) {
    return DEFAULT_CUSTOMER_LOCATION;
  }
  if (__DEV__ && !isInIsrael(location)) {
    return DEFAULT_CUSTOMER_LOCATION;
  }
  return location;
}