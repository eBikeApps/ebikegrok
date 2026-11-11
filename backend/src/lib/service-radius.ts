/** Distance used when a customer looks for a technician. The old platform floor was 40 km. */
export const PLATFORM_SERVICE_RADIUS_KM = 15;
const LEGACY_PLATFORM_RADIUS_KM = 40;

export function discoveryRadiusKm(stored: number | null | undefined): number {
  if (stored == null || stored === LEGACY_PLATFORM_RADIUS_KM) return PLATFORM_SERVICE_RADIUS_KM;
  return Math.max(stored, PLATFORM_SERVICE_RADIUS_KM);
}
