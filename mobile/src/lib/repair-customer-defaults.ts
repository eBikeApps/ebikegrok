import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'repair_customer_defaults_v1';

export type RepairCustomerDefaults = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  customerStreet: string;
  customerHouseNumber: string;
  customerLocationLat: number | null;
  customerLocationLng: number | null;
  problemDescription: string;
  savedAt: string;
};

function storageKey(userId: string): string {
  return `${KEY_PREFIX}_${userId}`;
}

export async function loadRepairCustomerDefaults(
  userId: string
): Promise<RepairCustomerDefaults | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as RepairCustomerDefaults;
  } catch {
    return null;
  }
}

export async function saveRepairCustomerDefaults(
  userId: string,
  data: Omit<RepairCustomerDefaults, 'savedAt'>
): Promise<void> {
  const payload: RepairCustomerDefaults = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(payload));
}