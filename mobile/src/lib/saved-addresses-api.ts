import { SavedAddress } from './types';
import { authClient } from './auth/auth-client';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

async function getToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return (result as any)?.data?.session?.token ?? null;
}

export async function fetchSavedAddresses(): Promise<SavedAddress[]> {
  const token = await getToken();
  if (!token) return [];
  const res = await fetch(`${BASE}/api/users/me/addresses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.addresses ?? []).map(mapAddress);
}

function mapAddress(a: any): SavedAddress {
  return {
    id: a.id,
    label: a.label ?? 'בית',
    address: `${a.street} ${a.houseNumber}, ${a.city}`,
    location: {
      latitude: a.latitude,
      longitude: a.longitude,
      address: `${a.street} ${a.houseNumber}, ${a.city}`,
    },
    city: a.city,
    street: a.street,
    houseNumber: a.houseNumber,
    isDefault: a.isDefault,
  } as SavedAddress & { city: string; street: string; houseNumber: string; isDefault?: boolean };
}

export async function createSavedAddress(payload: {
  label: string;
  city: string;
  street: string;
  houseNumber: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}): Promise<SavedAddress[]> {
  const token = await getToken();
  if (!token) throw new Error('No session');
  const res = await fetch(`${BASE}/api/users/me/addresses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return (data.addresses ?? []).map(mapAddress);
}

export async function deleteSavedAddress(id: string): Promise<SavedAddress[]> {
  const token = await getToken();
  if (!token) throw new Error('No session');
  const res = await fetch(`${BASE}/api/users/me/addresses/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return (data.addresses ?? []).map(mapAddress);
}