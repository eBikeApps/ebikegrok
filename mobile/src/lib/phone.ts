import { Linking } from 'react-native';

export function sanitizePhoneNumber(phone: string): string | null {
  const sanitized = String(phone).replace(/[^\d+]/g, '');
  return sanitized || null;
}

export type DialPhoneResult = 'ok' | 'no_phone' | 'invalid' | 'failed';

export async function dialPhoneNumber(phone?: string | null): Promise<DialPhoneResult> {
  if (!phone?.trim()) return 'no_phone';
  const sanitized = sanitizePhoneNumber(phone);
  if (!sanitized) return 'invalid';
  try {
    await Linking.openURL(`tel:${sanitized}`);
    return 'ok';
  } catch {
    return 'failed';
  }
}