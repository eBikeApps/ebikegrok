import { DevSettings } from 'react-native';

/** Reload the app after RTL/language changes. Works in dev client without expo-updates native module. */
export async function reloadApp(): Promise<boolean> {
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
    return true;
  } catch {
    if (__DEV__ && DevSettings?.reload) {
      DevSettings.reload();
      return true;
    }
    return false;
  }
}