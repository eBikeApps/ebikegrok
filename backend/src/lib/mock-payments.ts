import { randomBytes } from "crypto";

export type PaymentProvider = "mock";

/** Mock checkout when MOCK_PAYMENTS is enabled or no real provider is configured. */
export function isMockPaymentsMode(): boolean {
  const flag = (process.env.MOCK_PAYMENTS ?? "").trim().toLowerCase();
  if (["0", "false", "no"].includes(flag)) return false;
  return true;
}

export function getActivePaymentProvider(): PaymentProvider {
  return "mock";
}

export function createMockToken(): string {
  return randomBytes(24).toString("hex");
}

export function encodeMockRef(token: string, kind: "job" | "extra" = "job"): string {
  return `mock:${kind}:${token}`;
}

export function decodeMockRef(ref: string | null | undefined): { kind: "job" | "extra"; token: string } | null {
  if (!ref?.startsWith("mock:")) return null;
  const parts = ref.split(":");
  if (parts.length < 3) return null;
  const kind = parts[1] === "extra" ? "extra" : "job";
  const token = parts.slice(2).join(":");
  return token ? { kind, token } : null;
}

export function mockCheckoutUrl(backendUrl: string, token: string, kind: "job" | "extra" = "job"): string {
  const base = backendUrl.replace(/\/$/, "");
  return `${base}/api/payments/mock/checkout?token=${encodeURIComponent(token)}&kind=${kind}`;
}

export function renderMockCheckoutPage(params: {
  amount: number;
  description: string;
  token: string;
  kind: "job" | "extra";
  backendUrl: string;
}): string {
  const { amount, description, token, kind, backendUrl } = params;
  const base = backendUrl.replace(/\/$/, "");
  const q = `token=${encodeURIComponent(token)}&kind=${kind}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
  <title>תשלום — Ebikeland</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      min-height: 100vh; padding: 20px;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff; border-radius: 24px; padding: 28px 24px;
      max-width: 400px; width: 100%;
      box-shadow: 0 24px 48px rgba(0,0,0,0.35);
    }
    .badge {
      display: inline-block; background: #FEF3C7; color: #92400E;
      font-size: 11px; font-weight: 700; padding: 4px 10px;
      border-radius: 99px; margin-bottom: 16px;
    }
    .logo { font-size: 22px; font-weight: 800; color: #10b981; margin-bottom: 4px; }
    h1 { font-size: 20px; color: #111827; margin-bottom: 6px; }
    .desc { color: #6b7280; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
    .amount {
      text-align: center; background: #f0fdf4; border-radius: 16px;
      padding: 20px; margin-bottom: 24px; border: 1px solid #bbf7d0;
    }
    .amount-label { color: #6b7280; font-size: 13px; }
    .amount-value { color: #059669; font-size: 42px; font-weight: 900; margin-top: 4px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; text-align: right; }
    input {
      width: 100%; padding: 14px 16px; border: 1.5px solid #e5e7eb;
      border-radius: 12px; font-size: 16px; margin-bottom: 14px;
      direction: ltr; text-align: left; background: #f9fafb;
    }
    input:focus { outline: none; border-color: #10b981; background: #fff; }
    .row { display: flex; gap: 12px; }
    .row input { flex: 1; }
    .btn-pay {
      width: 100%; padding: 16px; border: none; border-radius: 14px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff; font-size: 17px; font-weight: 700; cursor: pointer;
      margin-top: 8px;
    }
    .btn-pay:active { opacity: 0.9; }
    .btn-cancel {
      display: block; text-align: center; margin-top: 14px;
      color: #6b7280; font-size: 14px; text-decoration: none;
    }
    .secure { display: flex; align-items: center; justify-content: center; gap: 6px;
      color: #9ca3af; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">תשלום לדוגמה — לא מחויב כסף אמיתי</div>
    <div class="logo">🚲 Ebikeland</div>
    <h1>אישור תשלום</h1>
    <p class="desc">${escapeHtml(description)}</p>
    <div class="amount">
      <div class="amount-label">סכום לחיוב</div>
      <div class="amount-value">₪${amount.toLocaleString("he-IL")}</div>
    </div>
    <form method="POST" action="${base}/api/payments/mock/complete?${q}">
      <label>מספר כרטיס</label>
      <input type="text" inputmode="numeric" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" readonly />
      <div class="row">
        <div style="flex:1">
          <label>תוקף</label>
          <input type="text" placeholder="MM/YY" value="12/28" readonly />
        </div>
        <div style="flex:1">
          <label>CVV</label>
          <input type="text" placeholder="123" value="123" readonly />
        </div>
      </div>
      <label>שם בעל הכרטיס</label>
      <input type="text" placeholder="שם מלא" value="לקוח בדיקה" readonly />
      <button type="submit" class="btn-pay">שלם ₪${amount.toLocaleString("he-IL")}</button>
    </form>
    <a class="btn-cancel" href="${base}/api/payments/mock/cancel?${q}">ביטול תשלום</a>
    <div class="secure">🔒 תשלום מדומה לבדיקות — אין חיוב אמיתי</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}