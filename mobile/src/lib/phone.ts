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

/** Normalize phone for wa.me links (digits only, Israeli 0-prefix → 972). */
export function phoneToWhatsAppId(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

export type OpenWhatsAppResult = 'ok' | 'no_phone' | 'invalid' | 'failed';

export async function openWhatsAppChat(
  phone?: string | null,
  text?: string
): Promise<OpenWhatsAppResult> {
  if (!phone?.trim()) return 'no_phone';
  const waId = phoneToWhatsAppId(phone);
  if (!waId) return 'invalid';
  const url = text
    ? `https://wa.me/${waId}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${waId}`;
  try {
    await Linking.openURL(url);
    return 'ok';
  } catch {
    return 'failed';
  }
}