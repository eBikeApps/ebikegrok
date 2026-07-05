import { Location } from './types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

export async function geocodeCustomerAddress(params: {
  address?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
}): Promise<Location | null> {
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
    return null;
  }

  const res = await fetch(`${BACKEND_URL}/api/geocode?${search.toString()}`);
  if (!res.ok) return null;

  const data = (await res.json()) as { latitude?: number; longitude?: number };
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    return null;
  }

  return { latitude: data.latitude, longitude: data.longitude };
}