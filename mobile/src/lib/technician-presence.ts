import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';

export const TECHNICIAN_LOCATION_TASK = 'technician-presence-location';

const PRESENCE_TOKEN_KEY = 'technician_presence_token';

async function pingLocation(lat: number, lng: number): Promise<void> {
  const token = await SecureStore.getItemAsync(PRESENCE_TOKEN_KEY);
  const base = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!token || !base) return;

  try {
    await fetch(`${base}/api/technicians/location`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    });
  } catch {
    // non-blocking — next update will retry
  }
}

async function pingHeartbeat(): Promise<void> {
  const token = await SecureStore.getItemAsync(PRESENCE_TOKEN_KEY);
  const base = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!token || !base) return;

  try {
    await fetch(`${base}/api/technicians/heartbeat`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // non-blocking
  }
}

TaskManager.defineTask(TECHNICIAN_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;
  await pingLocation(latest.coords.latitude, latest.coords.longitude);
});

export async function setPresenceAuthToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(PRESENCE_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(PRESENCE_TOKEN_KEY).catch(() => {});
  }
}

export async function startBackgroundPresence(): Promise<boolean> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK);
  if (hasStarted) return true;

  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') return false;

  try {
    await Location.startLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'eBike — זמין לקריאות',
        notificationBody: 'המיקום שלך משותף עם לקוחות בזמן שאתה זמין',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundPresence(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK);
  }
}

export { pingHeartbeat, pingLocation };