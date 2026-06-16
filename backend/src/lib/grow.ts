const DEFAULT_GROW_API_BASE = "https://secure.meshulam.co.il/api/light/server/1.0";

export function getGrowApiBase(): string {
  const configured = process.env.GROW_API_BASE?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return DEFAULT_GROW_API_BASE;
}

/** Grow requires a valid Israeli mobile: 0500000000 */
export function normalizeGrowPhone(phone?: string | null): string {
  if (!phone?.trim()) return "0500000000";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  if (/^05\d{8}$/.test(digits)) return digits;
  return "0500000000";
}

/** Grow requires at least two name parts */
export function normalizeGrowFullName(name?: string | null): string {
  const trimmed = (name ?? "לקוח אפליקציה").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 4).join(" ");
  const first = parts[0] ?? "לקוח";
  return `${first} משתמש`;
}

export type GrowApiResponse = {
  status?: number | string;
  err?: { id?: number; message?: string };
  data?: unknown;
  url?: string;
};

export function growApiErrorMessage(payload: GrowApiResponse): string | null {
  if (payload.status === 0 || payload.status === "0") {
    return payload.err?.message ?? "Grow API error";
  }
  return null;
}

export function extractGrowPaymentUrl(payload: GrowApiResponse): string | null {
  const err = growApiErrorMessage(payload);
  if (err) return null;

  const data = payload.data;
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.url === "string" && record.url) return record.url;
    if (typeof record.paymentUrl === "string" && record.paymentUrl) return record.paymentUrl;
  }
  if (typeof payload.url === "string" && payload.url) return payload.url;
  return null;
}

export function extractGrowProcessMeta(payload: GrowApiResponse): {
  processId?: string;
  processToken?: string;
} {
  const data = payload.data;
  if (typeof data !== "object" || data === null) return {};
  const record = data as Record<string, unknown>;
  return {
    processId: record.processId != null ? String(record.processId) : undefined,
    processToken: record.processToken != null ? String(record.processToken) : undefined,
  };
}

export type GrowWebhookPayload = {
  cField1?: string;
  cField2?: string;
  transactionCode?: string;
  transactionId?: string;
  paymentSum?: number;
  processId?: string;
  processToken?: string;
  raw: Record<string, unknown>;
};

export function parseGrowWebhookPayload(input: Record<string, unknown>): GrowWebhookPayload {
  const str = (key: string) => {
    const value = input[key];
    return value != null && value !== "" ? String(value) : undefined;
  };
  const num = (key: string) => {
    const value = input[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const nested =
    typeof input.data === "object" && input.data !== null
      ? (input.data as Record<string, unknown>)
      : {};

  const purchaseCustomField =
    typeof input.purchaseCustomField === "object" && input.purchaseCustomField !== null
      ? (input.purchaseCustomField as Record<string, unknown>)
      : undefined;

  const cField1 =
    str("cField1") ??
    str("cfield1") ??
    (nested.cField1 != null ? String(nested.cField1) : undefined) ??
    (purchaseCustomField?.field1 != null ? String(purchaseCustomField.field1) : undefined);

  const cField2 = str("cField2") ?? str("cfield2") ?? (nested.cField2 != null ? String(nested.cField2) : undefined) ?? "job";

  const transactionId = str("transactionId") ?? str("transactionCode");
  const paymentSum = num("paymentSum") ?? num("sum") ?? num("firstPaymentSum");

  return {
    cField1,
    cField2,
    transactionCode: str("transactionCode") ?? transactionId,
    transactionId,
    paymentSum,
    processId: str("processId") ?? (nested.processId != null ? String(nested.processId) : undefined),
    processToken: str("processToken") ?? (nested.processToken != null ? String(nested.processToken) : undefined),
    raw: input,
  };
}

export function encodeGrowProcessRef(processId?: string, processToken?: string): string | undefined {
  if (!processId) return undefined;
  if (processToken) return `${processId}|${processToken}`;
  return processId;
}

export function decodeGrowProcessRef(stored?: string | null): {
  processId?: string;
  processToken?: string;
  transactionId?: string;
} {
  if (!stored) return {};
  if (stored.includes("|")) {
    const [processId, processToken] = stored.split("|", 2);
    return { processId, processToken };
  }
  if (/^\d+$/.test(stored)) return { processId: stored };
  return { transactionId: stored };
}

export function isGrowPaidStatus(status: unknown): boolean {
  if (status == null) return false;
  const normalized = String(status).toLowerCase();
  return (
    normalized === "1" ||
    normalized === "2" ||
    normalized === "paid" ||
    normalized === "approved" ||
    normalized === "שולם" ||
    normalized === "success"
  );
}

export async function readGrowWebhookBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await req.json();
    if (typeof json === "object" && json !== null) return json as Record<string, unknown>;
    return {};
  }

  const body = await req.parseBody();
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    out[key] = typeof value === "string" ? value : value;
  }
  return out;
}