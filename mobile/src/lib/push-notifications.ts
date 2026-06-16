/**
 * Push Notifications - Expo Push Token Registration
 * Requires a published build (expo-notifications needs native rebuild to work)
 * Falls back silently in dev builds
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { authClient } from './auth/auth-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// How to display notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers the device for push notifications and saves the token to the backend.
 * Safe to call at any time - silently skips if running on a simulator or if permission is denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'התראות',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.easConfig as any)?.projectId;

    if (!projectId) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await saveTokenToBackend(tokenData.data);
    return tokenData.data;
  } catch {
    return null;
  }
}

async function saveTokenToBackend(token: string): Promise<void> {
  try {
    const session = await authClient.getSession();
    if (!session?.data?.session?.token) return;

    await fetch(`${BACKEND_URL}/api/users/push-token`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.data.session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Silently fail
  }
}
