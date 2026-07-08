import AsyncStorage from '@react-native-async-storage/async-storage';

const WELCOME_KEY = 'ebike_welcome_seen_v1';

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WELCOME_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(WELCOME_KEY, '1');
  } catch {
    // non-blocking
  }
}