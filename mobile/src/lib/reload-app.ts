import { DevSettings } from 'react-native';

/** Reload the app after RTL/language changes. Production store builds have no expo-updates. */
export async function reloadApp(): Promise<boolean> {
  if (__DEV__ && DevSettings?.reload) {
    DevSettings.reload();
    return true;
  }
  return false;
}
