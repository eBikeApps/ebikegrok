/**
 * PayMe Partner / Marketplace integration.
 *
 * Flow (as confirmed on sandbox):
 * 1) Partner authenticates with payme_client_key
 * 2) Create Seller (once) → seller_payme_id
 * 3) Generate Sale with seller_payme_id → sale_url (hosted checkout)
 *
 * Docs: create-seller, generate-sale — https://docs.payme.io/
 */

const CLIENT_KEY = process.env.PAYME_PARTNER_KEY || process.env.PAYME_CLIENT_KEY || "";
const BASE_URL = (process.env.PAYME_BASE_URL || "https://sandbox.payme.io").replace(/\/$/, "");
/** Optional: pin a known seller; otherwise we list/create one */
const CONFIGURED_SELLER_ID = process.env.PAYME_SELLER_PAYME_ID || "";

/** In-memory cache so we don't create a seller on every payment */
let cachedSellerPaymeId: string | null = CONFIGURED_SELLER_ID || null;

export function isPaymeConfigured(): boolean {
  return !!CLIENT_KEY;
}

export interface CreateSaleParams {
  amount: number; // ILS (shekels)
  description: string;
  reference: string; // jobId
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PaymeSaleResult {
  paymentUrl: string;
  saleId: string;
}

async function paymePost(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text, status_code: 1, status_error_details: text.slice(0, 200) };
  }
  if (!res.ok && data.status_code === undefined) {
    data.status_code = 1;
    data.status_error_details = data.message || data.raw || `HTTP ${res.status}`;
  }
  return data;
}

/** List sellers for this partner; prefer active ones. */
export async function listPaymeSellers(): Promise<Array<{ seller_payme_id: string; seller_active?: boolean; seller_approved?: boolean }>> {
  const data = await paymePost("/api/get-sellers", {
    payme_client_key: CLIENT_KEY,
  });
  if (data.status_code !== 0 && data.status_code !== undefined) {
    console.warn("[PayMe] get-sellers failed:", data);
    return [];
  }
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * Create a sandbox/platform seller under the partner account.
 * Phone must be international digits without + (e.g. 9725...).
 */
export async function createPaymeSeller(params?: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<string> {
  if (!CLIENT_KEY) throw new Error("PayMe payme_client_key missing");

  const body = {
    payme_client_key: CLIENT_KEY,
    seller_first_name: params?.firstName || "eBike",
    seller_last_name: params?.lastName || "Land",
    seller_email: params?.email || process.env.PAYME_SELLER_EMAIL || "electricbikeland@gmail.com",
    // Sandbox accepted: 972525858586 (not 05x local format)
    seller_phone: params?.phone || process.env.PAYME_SELLER_PHONE || "972525858586",
    seller_social_id: process.env.PAYME_SELLER_SOCIAL_ID || "000000018",
    market_fee: Number(process.env.PAYME_MARKET_FEE ?? "0"),
    language: "he",
  };

  const data = await paymePost("/api/create-seller", body);
  if (data.status_code !== 0 || !data.seller_payme_id) {
    const msg =
      data.status_error_details ||
      data.status_additional_info ||
      "PayMe create-seller failed";
    console.error("[PayMe] create-seller failed:", data);
    throw new Error(String(msg));
  }

  cachedSellerPaymeId = String(data.seller_payme_id);
  console.log("[PayMe] create-seller ok:", cachedSellerPaymeId);
  return cachedSellerPaymeId;
}

/** Resolve seller_payme_id: env → cache → list → create */
export async function resolvePaymeSellerId(): Promise<string> {
  if (CONFIGURED_SELLER_ID) {
    cachedSellerPaymeId = CONFIGURED_SELLER_ID;
    return CONFIGURED_SELLER_ID;
  }
  if (cachedSellerPaymeId) return cachedSellerPaymeId;

  const sellers = await listPaymeSellers();
  const preferred =
    sellers.find((s) => s.seller_active !== false && s.seller_payme_id) ||
    sellers.find((s) => s.seller_payme_id);

  if (preferred?.seller_payme_id) {
    cachedSellerPaymeId = preferred.seller_payme_id;
    console.log("[PayMe] using existing seller:", cachedSellerPaymeId);
    return cachedSellerPaymeId;
  }

  return createPaymeSeller();
}

/**
 * Create a hosted payment sale via PayMe (Partner flow).
 * Amount is converted to agorot (sale_price).
 */
export async function createPaymeSale(params: CreateSaleParams): Promise<PaymeSaleResult> {
  if (!isPaymeConfigured()) {
    throw new Error("PayMe is not configured (missing PAYME_PARTNER_KEY / payme_client_key)");
  }

  const sellerPaymeId = await resolvePaymeSellerId();
  const salePriceAgorot = Math.round(params.amount * 100);

  const data = await paymePost("/api/generate-sale", {
    payme_client_key: CLIENT_KEY,
    seller_payme_id: sellerPaymeId,
    sale_price: salePriceAgorot,
    currency: "ILS",
    product_name: params.description.slice(0, 120) || "eBike repair",
    installments: "1",
    sale_return_url: params.successUrl,
    sale_callback_url: params.notifyUrl,
    sale_send_notification: false,
    sale_payment_method: "credit-card",
    // optional: pass our job id for reconciliation
    transaction_id: params.reference,
  });

  if (data.status_code !== 0) {
    console.error("[PayMe] generate-sale failed:", data);
    const msg =
      data.status_error_details ||
      data.status_additional_info ||
      "PayMe generate-sale failed";
    throw new Error(String(msg));
  }

  const paymentUrl = data.sale_url || data.payment_url;
  if (!paymentUrl) {
    console.error("[PayMe] generate-sale missing sale_url:", data);
    throw new Error("PayMe response missing sale_url");
  }

  return {
    paymentUrl,
    saleId: String(data.payme_sale_id || data.payme_sale_code || params.reference),
  };
}

export function verifyPaymeNotify(body: any): boolean {
  return !!(
    body &&
    (body.payme_sale_id ||
      body.sale_id ||
      body.payme_sale_code ||
      body.sale_payme_code ||
      body.transaction_id ||
      body.reference)
  );
}

export type PaymeNotifyBody = {
  payme_sale_id?: string;
  sale_id?: string;
  payme_sale_code?: string | number;
  sale_status?: string;
  status?: string;
  sale_paid?: boolean | string | number;
  paid?: boolean;
  success?: boolean;
  price?: number;
  amount?: number;
  currency?: string;
  transaction_id?: string;
  reference?: string;
};
