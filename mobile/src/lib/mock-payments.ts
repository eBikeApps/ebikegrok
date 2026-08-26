/** True when the app is configured for fictitious / demo checkout (no real charge). */
export function isMockPaymentsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_MOCK_PAYMENTS === 'true';
}

/**
 * Rewrite only *our* mock checkout URLs to match the app's backend host
 * (local vs production drift). Never rewrite external PayMe / provider URLs —
 * that produced 404: http://127.0.0.1:3001/sale/generate/...
 */
export function normalizePaymentUrl(paymentUrl: string): string {
  if (!paymentUrl) return paymentUrl;

  const appBase = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
  if (!appBase) return paymentUrl;

  try {
    const parsed = new URL(paymentUrl);
    // External payment providers (PayMe sandbox/production) must stay as-is
    if (
      parsed.hostname.includes('payme.io') ||
      parsed.hostname.includes('payme.com') ||
      !parsed.pathname.includes('/api/payments/')
    ) {
      return paymentUrl;
    }

    const app = new URL(appBase);
    if (parsed.host !== app.host) {
      return `${appBase}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // keep original
  }
  return paymentUrl;
}
