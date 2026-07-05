import { createHmac, randomBytes } from "crypto";

const DEFAULT_TRANZILA_API_BASE = "https://api.tranzila.com/v2";

export type TranzilaPaymentKind = "job" | "extra";

export function isTranzilaConfigured(): boolean {
  return !!process.env.TRANZILA_TERMINAL?.trim();
}

export function getTranzilaTerminal(): string {
  const terminal = process.env.TRANZILA_TERMINAL?.trim();
  if (!terminal) throw new Error("TRANZILA_NOT_CONFIGURED");
  return terminal;
}

export function getTranzilaApiBase(): string {
  const configured = process.env.TRANZILA_API_BASE?.trim();
  return (configured || DEFAULT_TRANZILA_API_BASE).replace(/\/$/, "");
}

export function getTranzilaIframeUrl(): string {
  const terminal = getTranzilaTerminal();
  return `https://directng.tranzila.com/${terminal}/iframenew.php`;
}

export function isTranzilaHandshakeConfigured(): boolean {
  return !!(
    process.env.TRANZILA_APP_KEY?.trim() &&
    process.env.TRANZILA_SECRET?.trim()
  );
}

export function createTranzilaCheckoutToken(): string {
  return randomBytes(24).toString("hex");
}

export function encodeTranzilaRef(token: string, kind: TranzilaPaymentKind = "job"): string {
  return `tz:${kind}:${token}`;
}

export function decodeTranzilaRef(ref: string | null | undefined): {
  kind: TranzilaPaymentKind;
  token: string;
} | null {
  if (!ref?.startsWith("tz:")) return null;
  const parts = ref.split(":");
  if (parts.length < 3) return null;
  const kind = parts[1] === "extra" ? "extra" : "job";
  const token = parts.slice(2).join(":");
  return token ? { kind, token } : null;
}

export function tranzilaCheckoutUrl(backendUrl: string, token: string): string {
  const base = backendUrl.replace(/\/$/, "");
  return `${base}/api/payments/tranzila/checkout?token=${encodeURIComponent(token)}`;
}

export function normalizeTranzilaPhone(phone?: string | null): string {
  if (!phone?.trim()) return "0500000000";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  if (/^05\d{8}$/.test(digits)) return digits;
  return "0500000000";
}

export function normalizeTranzilaContact(name?: string | null): string {
  const trimmed = (name ?? "לקוח אפליקציה").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 4).join(" ");
  const first = parts[0] ?? "לקוח";
  return `${first} משתמש`;
}

export type TranzilaIframeParams = {
  amount: number;
  description: string;
  backendUrl: string;
  jobId: string;
  kind: TranzilaPaymentKind;
  entityId: string;
  checkoutToken: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  handshakeToken?: string;
};

export function buildTranzilaIframeFields(params: TranzilaIframeParams): Record<string, string> {
  const backendUrl = params.backendUrl.replace(/\/$/, "");
  const contact = normalizeTranzilaContact(params.customerName);
  const email = params.customerEmail?.trim() || "customer@ebikeland.app";

  const fields: Record<string, string> = {
    sum: String(params.amount),
    currency: "1",
    tranmode: "A",
    cred_type: "1",
    contact,
    company: "Ebikeland",
    email,
    country: "Israel",
    zip: "0000000",
    address: "ישראל",
    city: "תל אביב",
    phone: normalizeTranzilaPhone(params.customerPhone),
    pdesc: params.description,
    lang: "il",
    DCdisable: params.checkoutToken,
    remarks: `${params.kind}:${params.entityId}`,
    success_url_address: `${backendUrl}/api/payments/success?jobId=${encodeURIComponent(params.jobId)}`,
    fail_url_address: `${backendUrl}/api/payments/cancel?jobId=${encodeURIComponent(params.jobId)}`,
    notify_url_address: `${backendUrl}/api/payments/tranzila/notify`,
  };

  if (params.handshakeToken) {
    fields.thtk = params.handshakeToken;
  }

  return fields;
}

export function renderTranzilaBridgePage(params: {
  iframeUrl: string;
  fields: Record<string, string>;
  amount: number;
  description: string;
}): string {
  const hiddenInputs = Object.entries(params.fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`
    )
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
  <title>תשלום מאובטח — Ebikeland</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 20px;
      text-align: center;
    }
    .logo { color: #10b981; font-size: 18px; font-weight: 800; }
    .desc { color: #64748b; font-size: 13px; margin-top: 4px; }
    .amount { color: #0f172a; font-size: 28px; font-weight: 900; margin-top: 8px; }
    .loader {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #64748b;
      font-size: 14px;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    iframe { flex: 1; width: 100%; border: 0; min-height: 70vh; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🚲 Ebikeland</div>
    <div class="desc">${escapeHtml(params.description)}</div>
    <div class="amount">₪${params.amount.toLocaleString("he-IL")}</div>
  </div>
  <div class="loader" id="loader">
    <div class="spinner"></div>
    <div>מעביר לדף תשלום מאובטח…</div>
  </div>
  <form id="payment-form" action="${escapeHtml(params.iframeUrl)}" method="POST" target="tranzila-iframe" style="display:none">
    ${hiddenInputs}
  </form>
  <iframe name="tranzila-iframe" title="Tranzila payment" style="display:none" onload="document.getElementById('loader').style.display='none'; this.style.display='block'"></iframe>
  <script>
    document.getElementById('payment-form').submit();
  </script>
</body>
</html>`;
}

export type TranzilaNotifyPayload = {
  responseCode?: string;
  transactionId?: string;
  amount?: number;
  checkoutToken?: string;
  kind?: TranzilaPaymentKind;
  entityId?: string;
  raw: Record<string, unknown>;
};

export function parseTranzilaPayload(input: Record<string, unknown>): TranzilaNotifyPayload {
  const str = (key: string) => {
    const value = input[key];
    return value != null && value !== "" ? String(value) : undefined;
  };
  const num = (key: string) => {
    const value = input[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const responseCode = str("Response") ?? str("response");
  const transactionId = str("transaction_id") ?? str("index") ?? str("ConfirmationCode");
  const amount = num("sum") ?? num("amount");
  const checkoutToken = str("DCdisable");

  let kind: TranzilaPaymentKind | undefined;
  let entityId: string | undefined;
  const remarks = str("remarks");
  if (remarks?.includes(":")) {
    const [remarkKind, remarkId] = remarks.split(":", 2);
    kind = remarkKind === "extra" ? "extra" : "job";
    entityId = remarkId;
  }

  return {
    responseCode,
    transactionId,
    amount,
    checkoutToken,
    kind,
    entityId,
    raw: input,
  };
}

export function isTranzilaSuccessResponse(responseCode?: string): boolean {
  if (!responseCode) return false;
  const normalized = responseCode.trim();
  return normalized === "000" || normalized === "0";
}

export async function readTranzilaWebhookBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await req.json();
    if (typeof json === "object" && json !== null) return json as Record<string, unknown>;
    return {};
  }

  const form = await req.formData();
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    out[key] = value;
  }
  return out;
}

function buildTranzilaAuthHeaders(): Record<string, string> {
  const appKey = process.env.TRANZILA_APP_KEY?.trim();
  const secret = process.env.TRANZILA_SECRET?.trim();
  if (!appKey || !secret) throw new Error("TRANZILA_HANDSHAKE_NOT_CONFIGURED");

  const requestTime = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(40).toString("hex");
  const accessToken = createHmac("sha256", secret)
    .update(appKey + requestTime + nonce)
    .digest("hex");

  return {
    "X-tranzila-api-app-key": appKey,
    "X-tranzila-api-request-time": requestTime,
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": accessToken,
    "Content-Type": "application/json",
  };
}

export async function createTranzilaHandshakeToken(params: {
  amount: number;
  entityId: string;
  kind: TranzilaPaymentKind;
}): Promise<string | undefined> {
  if (!isTranzilaHandshakeConfigured()) return undefined;

  const apiBase = getTranzilaApiBase();
  const terminal = getTranzilaTerminal();

  const resp = await fetch(`${apiBase}/handshake/create`, {
    method: "POST",
    headers: buildTranzilaAuthHeaders(),
    body: JSON.stringify({
      terminal_name: terminal,
      sum: params.amount,
      request_params: {
        kind: params.kind,
        entity_id: params.entityId,
      },
    }),
  });

  const data = (await resp.json()) as {
    error_code?: number;
    message?: string;
    thtk?: string;
  };

  if (data.error_code !== 0 || !data.thtk) {
    const msg = data.message || "Tranzila handshake failed";
    console.error("[Tranzila] handshake error:", data);
    throw new Error(msg);
  }

  return data.thtk;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}