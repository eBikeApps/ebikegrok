import { Location } from './types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

export type GeocodeErrorReason = 'not_found' | 'service_unavailable' | 'network';

export type GeocodeLookupResult =
  | { ok: true; location: Location; formattedAddress?: string }
  | { ok: false; reason: GeocodeErrorReason };

export async function geocodeCustomerAddress(params: {
  address?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
}): Promise<GeocodeLookupResult> {
  const search = new URLSearchParams();
  if (params.address?.trim()) {
    search.set('address', params.address.trim());
  } else if (params.city?.trim() && params.street?.trim()) {
    search.set('city', params.city.trim());
    search.set('street', params.street.trim());
    if (params.houseNumber?.trim()) {
      search.set('houseNumber', params.houseNumber.trim());
    }
  } else {
    return { ok: false, reason: 'not_found' };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/geocode?${search.toString()}`);
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    const data = isJson
      ? ((await res.json()) as {
          latitude?: number;
          longitude?: number;
          formattedAddress?: string;
          code?: string;
          error?: string;
        })
      : null;

    if (!res.ok) {
      if (res.status === 404 && data?.code === 'NOT_FOUND') {
        return { ok: false, reason: 'not_found' };
      }
      if (res.status === 503 || data?.code === 'SERVICE_UNAVAILABLE') {
        return { ok: false, reason: 'service_unavailable' };
      }
      // Missing /api/geocode on outdated backend returns plain-text 404
      if (res.status === 404) {
        return { ok: false, reason: 'service_unavailable' };
      }
      return { ok: false, reason: 'service_unavailable' };
    }

    if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return { ok: false, reason: 'not_found' };
    }

    return {
      ok: true,
      location: { latitude: data.latitude, longitude: data.longitude },
      formattedAddress: data.formattedAddress,
    };
  } catch {
    return { ok: false, reason: 'network' };
  }
}