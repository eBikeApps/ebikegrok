import * as Location from 'expo-location';
import { pingHeartbeat, pingLocation, setPresenceAuthToken } from './technician-presence';

/**
 * When the technician toggle is ON, push availability + fresh location to the server.
 * Fixes drift where local/persisted state says "available" but the server marked offline
 * (e.g. after driving with the app in background and no heartbeat).
 */
export async function reassertTechnicianAvailability(token: string): Promise<boolean> {
  const base = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!base || !token) return false;

  try {
    await setPresenceAuthToken(token);

    const availabilityRes = await fetch(`${base}/api/technicians/availability`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isAvailable: true }),
    });
    if (!availabilityRes.ok) return false;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await pingLocation(location.coords.latitude, location.coords.longitude);
    } catch {
      // Location is best-effort; availability flag still matters for discovery
    }

    await pingHeartbeat();
    return true;
  } catch {
    return false;
  }
}