/**
 * PayMe integration for real card clearing (hosted payment page).
 * Uses Partner API with the provided keys.
 *
 * Docs: https://docs.payme.io/
 */

const PARTNER_KEY = process.env.PAYME_PARTNER_KEY || "";
const API_ID = process.env.PAYME_API_ID || "";
const BASE_URL = (process.env.PAYME_BASE_URL || "https://sandbox.payme.io").replace(/\/$/, "");

export function isPaymeConfigured(): boolean {
  return !!PARTNER_KEY && !!API_ID;
}

export interface CreateSaleParams {
  amount: number; // in ILS (will be converted to agorot)
  description: string;
  reference: string; // jobId or similar
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PaymeSaleResult {
  paymentUrl: string;
  saleId: string;
}

/**
 * Create a hosted payment sale via PayMe.
 * Amount is sent in agorot (smallest unit for ILS).
 */
export async function createPaymeSale(params: CreateSaleParams): Promise<PaymeSaleResult> {
  if (!isPaymeConfigured()) {
    throw new Error("PayMe is not configured (missing PAYME_PARTNER_KEY or PAYME_API_ID)");
  }

  // PayMe usually expects amount in agorot (minor units) for ILS.
  // If your tests show wrong amount, change to `amount: params.amount`
  const amountAgorot = Math.round(params.amount * 100);

  const payload = {
    key: PARTNER_KEY,
    api_id: API_ID,
    amount: amountAgorot,
    currency: "ILS",
    description: params.description,
    reference: params.reference,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    // Optional: add buyer info if you have name/phone
  };

  // PayMe endpoint for generating hosted sale/payment page.
  // Common paths: /api/sale or /api/generate-sale (see https://docs.payme.io/)
  const endpoint = `${BASE_URL}/api/generate-sale`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok || data.status === "error" || !data.payment_url) {
    console.error("[PayMe] create sale failed", res.status, data);
    const msg = data?.message || data?.error || "PayMe create sale failed";
    throw new Error(msg);
  }

  return {
    paymentUrl: data.payment_url,
    saleId: data.sale_id || data.id || params.reference,
  };
}

/**
 * Basic verification for PayMe notify webhook.
 * PayMe usually sends the sale details; you can add signature check if they provide one.
 */
export function verifyPaymeNotify(body: any): boolean {
  // For now, basic presence check. Enhance with HMAC if PayMe provides secret.
  return !!(body && (body.sale_id || body.id || body.reference));
}

export type PaymeNotifyBody = {
  sale_id?: string;
  id?: string;
  reference?: string;
  status?: string;
  paid?: boolean;
  success?: boolean;
  amount?: number;
  currency?: string;
  // more fields possible from PayMe
};