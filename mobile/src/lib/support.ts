import { Linking } from 'react-native';

/** Support phone as configured (e.g. 972585858586). Always normalized without +. */
export function getSupportPhoneDigits(): string {
  const raw = (process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '972585858586').replace(/\D/g, '');
  return raw.startsWith('0') ? `972${raw.slice(1)}` : raw;
}

/** Display form: +972-58-585-8586 style when possible */
export function getSupportPhoneDisplay(): string {
  const d = getSupportPhoneDigits();
  if (d.startsWith('972') && d.length >= 12) {
    return `+${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}

export function openSupportWhatsApp(prefillMessage?: string): void {
  const phone = getSupportPhoneDigits();
  const text = encodeURIComponent(
    prefillMessage ??
      'שלום, אני צריך עזרה לגבי הזמנה באפליקציית eBike.'
  );
  void Linking.openURL(`https://wa.me/${phone}?text=${text}`);
}
