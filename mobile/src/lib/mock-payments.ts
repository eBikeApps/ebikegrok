/** True when the app is configured for fictitious / demo checkout (no real charge). */
export function isMockPaymentsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_MOCK_PAYMENTS === 'true';
}

/** Ensure mock checkout loads from the same backend the app uses (fixes local dev URL drift). */
export function normalizePaymentUrl(paymentUrl: string): string {
  const appBase = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
  if (!appBase) return paymentUrl;
  try {
    const parsed = new URL(paymentUrl);
    const app = new URL(appBase);
    if (parsed.host !== app.host) {
      return `${appBase}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // keep original
  }
  return paymentUrl;
}