import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { sendPushNotification } from "../lib/push-notifications";
import { canCreatePayment } from "../lib/payment-gates";
import {
  decodeGrowProcessRef,
  encodeGrowProcessRef,
  extractGrowPaymentUrl,
  extractGrowProcessMeta,
  getGrowApiBase,
  growApiErrorMessage,
  isGrowPaidStatus,
  normalizeGrowFullName,
  normalizeGrowPhone,
  parseGrowWebhookPayload,
  readGrowWebhookBody,
} from "../lib/grow";
import {
  createMockToken,
  encodeMockRef,
  getActivePaymentProvider,
  isMockPaymentsMode,
  mockCheckoutUrl,
  renderMockCheckoutPage,
} from "../lib/mock-payments";
import {
  buildTranzilaIframeFields,
  createTranzilaCheckoutToken,
  createTranzilaHandshakeToken,
  decodeTranzilaRef,
  encodeTranzilaRef,
  getTranzilaIframeUrl,
  isTranzilaConfigured,
  isTranzilaSuccessResponse,
  parseTranzilaPayload,
  readTranzilaWebhookBody,
  renderTranzilaBridgePage,
  tranzilaCheckoutUrl,
  type TranzilaPaymentKind,
} from "../lib/tranzila";
import { formatJobReference } from "../lib/job-reference";

type HonoEnv = { Variables: { user: any; session: any } };

const paymentsRouter = new Hono<HonoEnv>();

// B27 FIX: validate commission rate at startup
const RAW_COMMISSION = Number(process.env.COMMISSION_RATE ?? "0.10");
if (Number.isNaN(RAW_COMMISSION) || RAW_COMMISSION < 0 || RAW_COMMISSION >= 1) {
  throw new Error(`Invalid COMMISSION_RATE: ${process.env.COMMISSION_RATE}`);
}
const COMMISSION_RATE = RAW_COMMISSION;

// T07 FIX: hard caps for withdrawals
const MIN_WITHDRAWAL = 50;
const MAX_WITHDRAWAL = 10000;

const withdrawalSchema = z.object({
  amount: z.number().int().min(MIN_WITHDRAWAL).max(MAX_WITHDRAWAL),
  bankName: z.string().min(2).max(100),
  branchNumber: z.string().regex(/^\d{3}$/, "Branch must be 3 digits"),
  accountNumber: z.string().regex(/^\d{4,12}$/, "Account must be 4-12 digits"),
  accountHolder: z.string().min(2).max(80).regex(/^[א-ת a-zA-Z\s'.-]+$/u, "Invalid name"),
});

function getGrowCredentials() {
  const userId = process.env.GROW_USER_ID;
  const pageCode = process.env.GROW_PAGE_CODE;
  if (!userId || !pageCode) throw new Error("GROW_NOT_CONFIGURED");
  return { userId, pageCode };
}

async function createTranzilaPaymentPage(params: {
  amount: number;
  description: string;
  jobId: string;
  entityId: string;
  kind: TranzilaPaymentKind;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
}): Promise<{ paymentUrl: string; checkoutToken: string }> {
  if (!isTranzilaConfigured()) throw new Error("TRANZILA_NOT_CONFIGURED");

  const backendUrl = process.env.BACKEND_URL!;
  const checkoutToken = createTranzilaCheckoutToken();
  await createTranzilaHandshakeToken({
    amount: params.amount,
    entityId: params.entityId,
    kind: params.kind,
  }).catch((err) => {
    console.warn("[Payments] Tranzila handshake skipped:", err?.message ?? err);
    return undefined;
  });

  return {
    paymentUrl: tranzilaCheckoutUrl(backendUrl, checkoutToken),
    checkoutToken,
  };
}

async function resolveTranzilaPendingPayment(checkoutToken: string) {
  const ref = encodeTranzilaRef(checkoutToken, "job");
  const extraRef = encodeTranzilaRef(checkoutToken, "extra");

  const payment = await prisma.payment.findFirst({
    where: { growTransactionCode: ref, status: "pending" },
    include: { job: true },
  });
  if (payment) {
    return {
      kind: "job" as const,
      entityId: payment.jobId,
      jobId: payment.jobId,
      expectedAmount: payment.amount,
      payment,
      extra: null,
    };
  }

  const extra = await prisma.extraRepairRequest.findFirst({
    where: { growTransactionCode: extraRef, status: "pending" },
    include: { job: true },
  });
  if (extra) {
    return {
      kind: "extra" as const,
      entityId: extra.id,
      jobId: extra.jobId,
      expectedAmount: extra.amount,
      payment: null,
      extra,
    };
  }

  return null;
}

async function processTranzilaPaymentSuccess(params: {
  checkoutToken?: string;
  kind?: TranzilaPaymentKind;
  entityId?: string;
  transactionId: string;
  amount?: number;
}): Promise<{ processed: boolean; alreadyProcessed?: boolean }> {
  let kind = params.kind;
  let entityId = params.entityId;
  let expectedAmount = params.amount;

  if (params.checkoutToken) {
    const pending = await resolveTranzilaPendingPayment(params.checkoutToken);
    if (!pending) return { processed: false };
    kind = pending.kind;
    entityId = pending.entityId;
    expectedAmount = pending.expectedAmount;
  }

  if (!kind || !entityId) return { processed: false };

  if (kind === "extra") {
    const extra = await prisma.extraRepairRequest.findUnique({
      where: { id: entityId },
      include: { job: { include: { technician: true } } },
    });
    if (!extra) return { processed: false };
    if (extra.status === "paid") return { processed: true, alreadyProcessed: true };

    if (expectedAmount && Math.abs(expectedAmount - extra.amount) > 0.01) {
      console.error("[Payments] Tranzila extra amount mismatch:", {
        entityId,
        expected: extra.amount,
        actual: expectedAmount,
      });
      return { processed: false };
    }

    const claim = await prisma.extraRepairRequest.updateMany({
      where: { id: entityId, status: "pending" },
      data: {
        status: "paid",
        growTransactionCode: params.transactionId,
        paidAt: new Date(),
      },
    });
    if (claim.count === 0) return { processed: true, alreadyProcessed: true };

    if (extra.job?.technician?.expoPushToken) {
      await sendPushNotification(
        extra.job.technician.expoPushToken,
        "💳 תשלום התקבל",
        `הלקוח שילם ₪${extra.amount} - תוכל להמשיך בתיקון`,
        { screen: "active-job", jobId: extra.jobId }
      );
    }
    return { processed: true };
  }

  const newlyPaid = await markMainJobPaid({
    jobId: entityId,
    transactionId: params.transactionId,
    paymentSum: expectedAmount ?? 0,
  });
  return { processed: newlyPaid, alreadyProcessed: !newlyPaid };
}

async function createGrowPaymentPage(params: {
  amount: number;
  description: string;
  cField1: string;
  cField2: string;
  successJobId: string;
  cancelJobId: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
}): Promise<{ paymentUrl: string; processId?: string; processToken?: string }> {
  const { userId, pageCode } = getGrowCredentials();
  const backendUrl = process.env.BACKEND_URL!;
  const growBase = getGrowApiBase();

  const form = new FormData();
  form.append("pageCode", pageCode);
  form.append("userId", userId);
  form.append("chargeType", "1");
  form.append("sum", String(params.amount));
  form.append("successUrl", `${backendUrl}/api/payments/success?jobId=${params.successJobId}`);
  form.append("cancelUrl", `${backendUrl}/api/payments/cancel?jobId=${params.cancelJobId}`);
  form.append("description", params.description);
  form.append("notifyUrl", `${backendUrl}/api/payments/webhook`);
  form.append("cField1", params.cField1);
  form.append("cField2", params.cField2);
  form.append("paymentNum", "1");
  form.append("pageField[fullName]", normalizeGrowFullName(params.customerName));
  form.append("pageField[phone]", normalizeGrowPhone(params.customerPhone));
  if (params.customerEmail) form.append("pageField[email]", params.customerEmail);

  const resp = await fetch(`${growBase}/createPaymentProcess`, {
    method: "POST",
    body: form,
  });

  const data = (await resp.json()) as any;
  const paymentUrl = extractGrowPaymentUrl(data);
  if (!paymentUrl) {
    const growErr = growApiErrorMessage(data) ?? "Grow did not return payment URL";
    console.error("[Payments] Grow createPaymentProcess error:", data);
    throw new Error(growErr);
  }

  const { processId, processToken } = extractGrowProcessMeta(data);
  return { paymentUrl, processId, processToken };
}

// POST /api/payments/create — customer creates payment page for a job
paymentsRouter.post("/create", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const { jobId } = await c.req.json();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { customer: true },
  });

  if (!job) return c.json({ error: "Job not found" }, 404);
  if (job.customerId !== user.id) return c.json({ error: "Forbidden" }, 403);

  // Slice 1: Enforce "customer pays AFTER technician accepts" at the API boundary (server source of truth).
  // This was only a client/push convention before. Now explicit + returns clear error.
  const createCheck = canCreatePayment({
    id: job.id,
    status: job.status,
    paymentStatus: job.paymentStatus,
  });
  if (!createCheck.ok) {
    return c.json({ error: createCheck.error }, 400);
  }

  // Already paid — return existing URL (defensive, helper already covers but keep for UX)
  if (job.paymentStatus === "paid") {
    const existing = await prisma.payment.findUnique({ where: { jobId } });
    return c.json({ paymentUrl: existing?.paymentUrl ?? null, alreadyPaid: true });
  }

  try {
    const amount = job.finalPrice ?? job.estimatedPriceMin;
    const commission = Math.round(amount * COMMISSION_RATE);
    const backendUrl = process.env.BACKEND_URL!;

    if (isMockPaymentsMode()) {
      const token = createMockToken();
      const paymentUrl = mockCheckoutUrl(backendUrl, token, "job");
      const mockRef = encodeMockRef(token, "job");

      await prisma.payment.upsert({
        where: { jobId },
        update: {
          paymentUrl,
          amount,
          commissionAmount: commission,
          netAmount: amount - commission,
          status: "pending",
          growTransactionCode: mockRef,
        },
        create: {
          jobId,
          amount,
          commissionAmount: commission,
          netAmount: amount - commission,
          paymentUrl,
          status: "pending",
          growTransactionCode: mockRef,
        },
      });

      const jobReference = formatJobReference(job.jobNumber);
      console.log("[Payments] Mock checkout created for job", jobReference);
      return c.json({
        paymentUrl,
        amount,
        mockMode: true,
        jobNumber: job.jobNumber,
        jobReference,
        description: `תיקון אופניים ${jobReference}`,
      });
    }

    const jobReference = formatJobReference(job.jobNumber);
    const provider = getActivePaymentProvider();

    if (provider === "tranzila") {
      const tranzilaPage = await createTranzilaPaymentPage({
        amount,
        description: `תיקון אופניים ${jobReference}`,
        jobId,
        entityId: jobId,
        kind: "job",
        customerEmail: job.customer?.email ?? undefined,
        customerPhone: job.customer?.phone ?? undefined,
        customerName: job.customer?.name ?? undefined,
      });

      await prisma.payment.upsert({
        where: { jobId },
        update: {
          paymentUrl: tranzilaPage.paymentUrl,
          amount,
          commissionAmount: commission,
          netAmount: amount - commission,
          status: "pending",
          growTransactionCode: encodeTranzilaRef(tranzilaPage.checkoutToken, "job"),
        },
        create: {
          jobId,
          amount,
          commissionAmount: commission,
          netAmount: amount - commission,
          paymentUrl: tranzilaPage.paymentUrl,
          status: "pending",
          growTransactionCode: encodeTranzilaRef(tranzilaPage.checkoutToken, "job"),
        },
      });

      return c.json({
        paymentUrl: tranzilaPage.paymentUrl,
        amount,
        mockMode: false,
        provider: "tranzila",
        jobNumber: job.jobNumber,
        jobReference,
        description: `תיקון אופניים ${jobReference}`,
      });
    }

    const growPage = await createGrowPaymentPage({
      amount,
      description: `תיקון אופניים ${jobReference}`,
      cField1: jobId,
      cField2: "job",
      successJobId: jobId,
      cancelJobId: jobId,
      customerEmail: job.customer?.email ?? undefined,
      customerPhone: job.customer?.phone ?? undefined,
      customerName: job.customer?.name ?? undefined,
    });

    await prisma.payment.upsert({
      where: { jobId },
      update: {
        paymentUrl: growPage.paymentUrl,
        amount,
        commissionAmount: commission,
        netAmount: amount - commission,
        status: "pending",
        growTransactionCode: encodeGrowProcessRef(growPage.processId, growPage.processToken),
      },
      create: {
        jobId,
        amount,
        commissionAmount: commission,
        netAmount: amount - commission,
        paymentUrl: growPage.paymentUrl,
        status: "pending",
        growTransactionCode: encodeGrowProcessRef(growPage.processId, growPage.processToken),
      },
    });

    return c.json({
      paymentUrl: growPage.paymentUrl,
      amount,
      mockMode: false,
      provider: "grow",
      jobNumber: job.jobNumber,
      jobReference,
      description: `תיקון אופניים ${jobReference}`,
    });
  } catch (err: any) {
    if (err.message === "GROW_NOT_CONFIGURED" || err.message === "TRANZILA_NOT_CONFIGURED") {
      return c.json({ error: "מערכת התשלומים טרם הוגדרה" }, 503);
    }
    const message = typeof err?.message === "string" && err.message !== "Grow did not return payment URL"
      ? err.message
      : "Internal server error";
    console.error("[Payments] create error:", err);
    return c.json({ error: message }, 500);
  }
});

async function queryGrowPaymentProcess(processId: string, processToken?: string): Promise<{
  valid: boolean;
  amount?: number;
  status?: string;
}> {
  try {
    const { pageCode } = getGrowCredentials();
    const growBase = getGrowApiBase();
    const form = new FormData();
    form.append("pageCode", pageCode);
    form.append("processId", processId);
    if (processToken) form.append("processToken", processToken);

    const resp = await fetch(`${growBase}/getPaymentProcessInfo`, {
      method: "POST",
      body: form,
    });
    const data = (await resp.json()) as any;
    const tx = data?.data ?? data;
    const status = tx?.status ?? tx?.statusCode;
    const amount = Number(tx?.paymentSum ?? tx?.sum ?? 0);
    if (data?.status === 1 || data?.status === "1" || isGrowPaidStatus(status)) {
      return { valid: true, amount, status: String(status ?? "paid") };
    }
    return { valid: false };
  } catch (err) {
    console.error("[Payments] queryGrowPaymentProcess error:", err);
    return { valid: false };
  }
}

// Verify webhook authenticity by calling Grow's API to confirm transaction
async function verifyGrowTransaction(
  transactionId: string,
  opts?: { processId?: string; processToken?: string }
): Promise<{
  valid: boolean;
  amount?: number;
  status?: string;
}> {
  const { userId, pageCode } = getGrowCredentials();
  const growBase = getGrowApiBase();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const form = new FormData();
      form.append("pageCode", pageCode);
      form.append("userId", userId);
      form.append("transactionId", transactionId);

      const resp = await fetch(`${growBase}/getTransactionInfo`, {
        method: "POST",
        body: form,
      });
      const data = (await resp.json()) as any;

      if (data?.status === 1 || data?.status === "1" || data?.success === true) {
        const tx = data.data ?? data;
        const amount = Number(tx?.paymentSum ?? tx?.sum ?? 0);
        return { valid: true, amount, status: tx?.status ?? "approved" };
      }
    } catch (err) {
      console.error("[Payments] verifyGrowTransaction attempt error:", err);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
  }

  if (opts?.processId) {
    return queryGrowPaymentProcess(opts.processId, opts.processToken);
  }
  return { valid: false };
}

async function markMainJobPaid(params: {
  jobId: string;
  transactionId: string;
  paymentSum: number;
}): Promise<boolean> {
  const claim = await prisma.job.updateMany({
    where: { id: params.jobId, paymentStatus: { not: "paid" } },
    data: { paymentStatus: "paid" },
  });
  if (claim.count === 0) return false;

  await prisma.payment.updateMany({
    where: { jobId: params.jobId, status: { not: "completed" } },
    data: {
      status: "completed",
      growTransactionCode: params.transactionId,
      paidAt: new Date(),
    },
  });

  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: { technician: true },
  });

  if (job?.technician?.expoPushToken) {
    await sendPushNotification(
      job.technician.expoPushToken,
      "💳 תשלום התקבל!",
      `הלקוח שילם ₪${params.paymentSum} — ניתן לצאת לעבודה`,
      { screen: "active-job", jobId: params.jobId }
    );
  }
  return true;
}

async function syncJobPaymentFromGrow(jobId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { jobId } });
  if (!payment || payment.status === "completed") return false;

  const { processId, processToken } = decodeGrowProcessRef(payment.growTransactionCode);
  if (!processId) return false;

  const growStatus = await queryGrowPaymentProcess(processId, processToken);
  if (!growStatus.valid) return false;

  if (growStatus.amount && Math.abs(growStatus.amount - payment.amount) > 0.01) {
    console.error("[Payments] Success-sync amount mismatch:", {
      jobId,
      expected: payment.amount,
      actual: growStatus.amount,
    });
    return false;
  }

  return markMainJobPaid({
    jobId,
    transactionId: processId,
    paymentSum: growStatus.amount ?? payment.amount,
  });
}

// POST /api/payments/webhook — Grow calls this after payment (no auth required)
paymentsRouter.post("/webhook", async (c) => {
  const rawBody = await readGrowWebhookBody(c.req.raw);
  const payload = parseGrowWebhookPayload(rawBody);

  let cField1 = payload.cField1;
  const cField2 = payload.cField2 ?? "job";
  const transactionId = payload.transactionId ?? payload.transactionCode;
  const paymentSum = Number(payload.paymentSum ?? 0);

  console.log("[Payments] Webhook:", {
    cField1,
    cField2,
    transactionId,
    paymentSum,
    processId: payload.processId,
  });

  // Fallback: match pending payment by Grow process id when custom fields are absent
  if (!cField1 && payload.processId) {
    const pending = await prisma.payment.findFirst({
      where: {
        status: "pending",
        OR: [
          { growTransactionCode: payload.processId },
          { growTransactionCode: { startsWith: `${payload.processId}|` } },
        ],
      },
      select: { jobId: true },
    });
    cField1 = pending?.jobId;
  }

  if (!cField1 || !transactionId) {
    return c.json({ error: "Missing fields" }, 400);
  }

  // S05 FIX: Verify webhook authenticity by querying Grow's API
  // This prevents attackers from forging webhook calls to mark jobs as paid
  const verification = await verifyGrowTransaction(transactionId, {
    processId: payload.processId,
    processToken: payload.processToken,
  });
  if (!verification.valid) {
    console.error("[Payments] Webhook verification FAILED for txn:", transactionId);
    return c.json({ error: "Invalid transaction" }, 401);
  }

  // Verify amount matches what was expected (anti-tampering)
  if (verification.amount && Math.abs(verification.amount - paymentSum) > 0.01) {
    console.error("[Payments] Amount mismatch:", { reported: paymentSum, actual: verification.amount });
    return c.json({ error: "Amount mismatch" }, 400);
  }

  try {
    if (cField2 === "extra") {
      // B02 FIX: atomic claim via updateMany; only the first concurrent webhook
      // moves status pending → paid. Subsequent calls see count=0 and exit.
      const claim = await prisma.extraRepairRequest.updateMany({
        where: { id: cField1, status: "pending" },
        data: { status: "paid", growTransactionCode: transactionId, paidAt: new Date() },
      });
      if (claim.count === 0) {
        // Either not found, or already processed → idempotent success
        return c.json({ success: true, alreadyProcessed: true });
      }

      const req = await prisma.extraRepairRequest.findUnique({
        where: { id: cField1 },
        include: { job: { include: { technician: true } } },
      });
      if (!req) return c.json({ error: "Not found" }, 404);

      // Verify expected amount matches (post-claim, since claim was already atomic)
      if (Math.abs(Number(req.amount) - paymentSum) > 0.01) {
        console.error("[Payments] Extra repair amount mismatch");
        // Don't roll back - the payment did happen, just log discrepancy
      }

      if (req?.job?.technician?.expoPushToken) {
        await sendPushNotification(
          req.job.technician.expoPushToken,
          "💳 תשלום התקבל",
          `הלקוח שילם ₪${paymentSum} - תוכל להמשיך בתיקון`,
          // B19 FIX: minimal data payload
          { screen: "active-job", jobId: req.jobId }
        );
      }
    } else {
      const newlyPaid = await markMainJobPaid({
        jobId: cField1,
        transactionId,
        paymentSum,
      });
      if (!newlyPaid) {
        return c.json({ success: true, alreadyProcessed: true });
      }
    }

    // Approve transaction with Grow (mandatory to close the payment loop)
    try {
      const { userId, pageCode } = getGrowCredentials();
      const growBase = getGrowApiBase();
      const approveForm = new FormData();
      approveForm.append("pageCode", pageCode);
      approveForm.append("userId", userId);
      approveForm.append("transactionId", transactionId);
      if (payload.processToken) approveForm.append("processToken", payload.processToken);
      await fetch(`${growBase}/approveTransaction`, { method: "POST", body: approveForm });
    } catch (err) {
      console.error("[Payments] approveTransaction failed (non-fatal):", err);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("[Payments] Webhook error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ─── Tranzila DirectNG bridge (POST form → iframe) ─────────────────────────
paymentsRouter.get("/tranzila/checkout", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.text("Invalid token", 400);

  const pending = await resolveTranzilaPendingPayment(token);
  if (!pending) return c.text("תשלום לא נמצא או שכבר בוצע", 404);

  const backendUrl = process.env.BACKEND_URL!;
  let description = "תשלום Ebikeland";
  let customerEmail: string | undefined;
  let customerPhone: string | undefined;
  let customerName: string | undefined;

  if (pending.kind === "job" && pending.payment?.job) {
    description = `תיקון אופניים ${formatJobReference(pending.payment.job.jobNumber)}`;
    const customer = await prisma.user.findUnique({ where: { id: pending.payment.job.customerId } });
    customerEmail = customer?.email ?? undefined;
    customerPhone = customer?.phone ?? undefined;
    customerName = customer?.name ?? undefined;
  } else if (pending.kind === "extra" && pending.extra) {
    description = pending.extra.description || "תיקון נוסף";
    const customer = await prisma.user.findUnique({ where: { id: pending.extra.job.customerId } });
    customerEmail = customer?.email ?? undefined;
    customerPhone = customer?.phone ?? undefined;
    customerName = customer?.name ?? undefined;
  }

  const handshakeToken = await createTranzilaHandshakeToken({
    amount: pending.expectedAmount,
    entityId: pending.entityId,
    kind: pending.kind,
  }).catch((err) => {
    console.warn("[Payments] Tranzila checkout handshake skipped:", err?.message ?? err);
    return undefined;
  });

  const fields = buildTranzilaIframeFields({
    amount: pending.expectedAmount,
    description,
    backendUrl,
    jobId: pending.jobId,
    kind: pending.kind,
    entityId: pending.entityId,
    checkoutToken: token,
    customerEmail,
    customerPhone,
    customerName,
    handshakeToken,
  });

  return c.html(
    renderTranzilaBridgePage({
      iframeUrl: getTranzilaIframeUrl(),
      fields,
      amount: pending.expectedAmount,
      description,
    })
  );
});

paymentsRouter.post("/tranzila/notify", async (c) => {
  const rawBody = await readTranzilaWebhookBody(c.req.raw);
  const payload = parseTranzilaPayload(rawBody);

  console.log("[Payments] Tranzila notify:", {
    responseCode: payload.responseCode,
    transactionId: payload.transactionId,
    amount: payload.amount,
    checkoutToken: payload.checkoutToken,
    kind: payload.kind,
    entityId: payload.entityId,
  });

  if (!isTranzilaSuccessResponse(payload.responseCode)) {
    return c.json({ success: false, message: "Not a successful transaction" });
  }
  if (!payload.transactionId) {
    return c.json({ error: "Missing transaction id" }, 400);
  }

  try {
    const result = await processTranzilaPaymentSuccess({
      checkoutToken: payload.checkoutToken,
      kind: payload.kind,
      entityId: payload.entityId,
      transactionId: payload.transactionId,
      amount: payload.amount,
    });
    if (!result.processed && !result.alreadyProcessed) {
      return c.json({ error: "Payment not found" }, 404);
    }
    return c.json({ success: true, alreadyProcessed: result.alreadyProcessed ?? false });
  } catch (err) {
    console.error("[Payments] Tranzila notify error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ─── Mock payment checkout (no real Grow charge) ───────────────────────────
paymentsRouter.get("/mock/checkout", async (c) => {
  const token = c.req.query("token") ?? "";
  const kind = (c.req.query("kind") === "extra" ? "extra" : "job") as "job" | "extra";
  if (!token) return c.text("Invalid token", 400);

  const ref = encodeMockRef(token, kind);
  const backendUrl = process.env.BACKEND_URL!;

  if (kind === "extra") {
    const extra = await prisma.extraRepairRequest.findFirst({
      where: { growTransactionCode: ref, status: "pending" },
      include: { job: true },
    });
    if (!extra) return c.text("תשלום לא נמצא או שכבר בוצע", 404);
    return c.html(
      renderMockCheckoutPage({
        amount: extra.amount,
        description: extra.description || "תיקון נוסף",
        token,
        kind: "extra",
        backendUrl,
      })
    );
  }

  const payment = await prisma.payment.findFirst({
    where: { growTransactionCode: ref, status: "pending" },
    include: { job: true },
  });
  if (!payment) return c.text("תשלום לא נמצא או שכבר בוצע", 404);

  const jobReference = formatJobReference(payment.job.jobNumber);
  return c.html(
    renderMockCheckoutPage({
      amount: payment.amount,
      description: `תיקון אופניים ${jobReference}`,
      token,
      kind: "job",
      backendUrl,
    })
  );
});

paymentsRouter.post("/mock/complete", async (c) => {
  const token = c.req.query("token") ?? "";
  const kind = (c.req.query("kind") === "extra" ? "extra" : "job") as "job" | "extra";
  if (!token) return c.text("Invalid token", 400);

  const ref = encodeMockRef(token, kind);
  const backendUrl = process.env.BACKEND_URL!;

  try {
    if (kind === "extra") {
      const extra = await prisma.extraRepairRequest.findFirst({
        where: { growTransactionCode: ref, status: "pending" },
        include: { job: { include: { technician: true } } },
      });
      if (!extra) return c.text("תשלום לא נמצא או שכבר בוצע", 404);

      const claim = await prisma.extraRepairRequest.updateMany({
        where: { id: extra.id, status: "pending" },
        data: { status: "paid", paidAt: new Date(), growTransactionCode: `mock-paid:${token}` },
      });
      if (claim.count > 0 && extra.job?.technician?.expoPushToken) {
        await sendPushNotification(
          extra.job.technician.expoPushToken,
          "💳 תשלום התקבל (דמו)",
          `הלקוח שילם ₪${extra.amount} — תוכל להמשיך בתיקון`,
          { screen: "active-job", jobId: extra.jobId }
        );
      }
      return c.redirect(`${backendUrl}/api/payments/success?jobId=${extra.jobId}`);
    }

    const payment = await prisma.payment.findFirst({
      where: { growTransactionCode: ref, status: "pending" },
    });
    if (!payment) {
      const job = await prisma.job.findFirst({
        where: { paymentStatus: "paid" },
        orderBy: { createdAt: "desc" },
      });
      return c.redirect(`${backendUrl}/api/payments/success?jobId=${job?.id ?? ""}`);
    }

    await markMainJobPaid({
      jobId: payment.jobId,
      transactionId: `mock-${token}`,
      paymentSum: payment.amount,
    });

    return c.redirect(`${backendUrl}/api/payments/success?jobId=${payment.jobId}`);
  } catch (err) {
    console.error("[Payments] mock/complete error:", err);
    return c.text("שגיאה בעיבוד תשלום", 500);
  }
});

paymentsRouter.get("/mock/cancel", async (c) => {
  const token = c.req.query("token") ?? "";
  const kind = (c.req.query("kind") === "extra" ? "extra" : "job") as "job" | "extra";
  const backendUrl = process.env.BACKEND_URL!;
  let jobId = "";

  if (token) {
    const ref = encodeMockRef(token, kind);
    if (kind === "extra") {
      const extra = await prisma.extraRepairRequest.findFirst({ where: { growTransactionCode: ref } });
      jobId = extra?.jobId ?? "";
    } else {
      const payment = await prisma.payment.findFirst({ where: { growTransactionCode: ref } });
      jobId = payment?.jobId ?? "";
    }
  }

  return c.redirect(
    jobId ? `${backendUrl}/api/payments/cancel?jobId=${jobId}` : `${backendUrl}/api/payments/cancel`
  );
});

async function syncJobPaymentOnSuccess(c: { req: { query: (key: string) => string | undefined } }, jobId: string) {
  const payment = await prisma.payment.findUnique({ where: { jobId } });
  if (!payment) return;

  if (payment.growTransactionCode?.startsWith("mock:") && payment.status === "pending") {
    await markMainJobPaid({
      jobId,
      transactionId: payment.growTransactionCode,
      paymentSum: payment.amount,
    });
    return;
  }

  const tranzilaRef = decodeTranzilaRef(payment.growTransactionCode);
  if (tranzilaRef) {
    const responseCode = c.req.query("Response") ?? c.req.query("response");
    const transactionId =
      c.req.query("transaction_id") ??
      c.req.query("index") ??
      c.req.query("ConfirmationCode");
    const amount = Number(c.req.query("sum") ?? payment.amount);

    if (isTranzilaSuccessResponse(responseCode) && transactionId) {
      await processTranzilaPaymentSuccess({
        checkoutToken: tranzilaRef.token,
        kind: "job",
        entityId: jobId,
        transactionId,
        amount,
      });
    }
    return;
  }

  await syncJobPaymentFromGrow(jobId);
}

// GET /api/payments/success — browser redirect after payment provider success
paymentsRouter.get("/success", async (c) => {
  const jobId = c.req.query("jobId") ?? "";
  if (jobId) {
    try {
      await syncJobPaymentOnSuccess(c, jobId);
    } catch (err) {
      console.error("[Payments] success-sync error:", err);
    }
  }
  return c.html(`<!DOCTYPE html>
<html dir="rtl"><head><meta charset="UTF-8"><title>תשלום הושלם</title>
<style>body{font-family:-apple-system,Arial,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:20px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h2{color:#166534;font-size:24px}p{color:#4b5563;font-size:15px}</style></head>
<body><div class="card"><div style="font-size:52px">✅</div>
<h2>התשלום הושלם בהצלחה!</h2>
<p>ניתן לסגור חלון זה וחזור לאפליקציה.</p></div>
<script>setTimeout(()=>{try{window.close()}catch(e){}},3000)</script>
</body></html>`);
});

// GET /api/payments/cancel — browser redirect after Grow cancel
paymentsRouter.get("/cancel", (c) => {
  return c.html(`<!DOCTYPE html>
<html dir="rtl"><head><meta charset="UTF-8"><title>תשלום בוטל</title>
<style>body{font-family:-apple-system,Arial,sans-serif;background:#fef2f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:20px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h2{color:#991b1b;font-size:22px}p{color:#4b5563;font-size:15px}</style></head>
<body><div class="card"><div style="font-size:52px">❌</div>
<h2>התשלום בוטל</h2>
<p>ניתן לסגור חלון זה וחזור לאפליקציה.</p></div></body></html>`);
});

// GET /api/payments/status/:jobId — check payment status
paymentsRouter.get("/status/:jobId", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const jobId = c.req.param("jobId");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { paymentStatus: true, customerId: true, technicianId: true },
  });

  if (!job) return c.json({ error: "Not found" }, 404);
  if (job.customerId !== user.id && job.technicianId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const payment = await prisma.payment.findUnique({ where: { jobId } });
  return c.json({ paymentStatus: job.paymentStatus, payment });
});

// POST /api/payments/withdrawal-request — technician requests bank withdrawal
// B10 FIX: zValidator. T07/T08 FIX: strict bank format + min/max bounds.
paymentsRouter.post("/withdrawal-request", zValidator("json", withdrawalSchema), async (c) => {
  const user = c.get("user");
  if (!user || user.role !== "technician") return c.body(null, 401);

  const { amount, bankName, branchNumber, accountNumber, accountHolder } = c.req.valid("json");
  const amountNum = amount;

  // B06 FIX: Atomic balance check + withdrawal creation in a serializable
  // transaction. Without this, two concurrent withdrawal requests can each
  // read the same balance and both pass the check, allowing over-withdrawal.
  try {
    await prisma.$transaction(async (tx) => {
      const [earned, withdrawn] = await Promise.all([
        tx.transaction.aggregate({
          where: { technicianId: user.id, type: "earning", status: "completed" },
          _sum: { amount: true },
        }),
        tx.transaction.aggregate({
          where: {
            technicianId: user.id,
            type: "withdrawal",
            status: { in: ["completed", "pending"] },
          },
          _sum: { amount: true },
        }),
      ]);

      const balance = (earned._sum.amount ?? 0) - (withdrawn._sum.amount ?? 0);
      if (amountNum > balance) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.transaction.create({
        data: {
          technicianId: user.id,
          type: "withdrawal",
          amount: amountNum,
          status: "pending",
          bankName,
          branchNumber,
          accountNumber,
          accountHolder,
        },
      });
    }, { isolationLevel: "Serializable" });

    return c.json({ success: true });
  } catch (err: any) {
    if (err?.message === "INSUFFICIENT_BALANCE") {
      return c.json({ error: "Insufficient balance" }, 400);
    }
    // Serialization conflict — client should retry
    if (err?.code === "P2034" || /serializ/i.test(err?.message ?? "")) {
      return c.json({ error: "Please retry" }, 409);
    }
    console.error("[Payments] withdrawal-request error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Dev-only simulate paid (for testing the full flow when GROW keys are not configured in this environment)
// NEVER enabled when real GROW is set. Marked clearly in UI as DEV ONLY.
paymentsRouter.post("/simulate-paid/:jobId", async (c) => {
  if (!isMockPaymentsMode()) {
    return c.json({ error: "Simulate not available when real payment provider is configured" }, 400);
  }
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const jobId = c.req.param("jobId");

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true, technician: true },
    });

    if (!job) return c.json({ error: "Job not found" }, 404);
    if (job.customerId !== user.id) return c.json({ error: "Forbidden" }, 403);
    if (job.status !== "accepted") return c.json({ error: "Can only simulate after accept" }, 400);
    if (job.paymentStatus === "paid") return c.json({ error: "Already paid" }, 400);

    // Mark paid (same as webhook path, without Grow)
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: { paymentStatus: "paid" },
      }),
      prisma.payment.updateMany({
        where: { jobId, status: { not: "completed" } },
        data: { status: "completed", paidAt: new Date() },
      }),
    ]);

    // Notify technician like real webhook
    if (job.technician?.expoPushToken) {
      await sendPushNotification(
        job.technician.expoPushToken,
        "💳 תשלום התקבל! (DEV SIMULATE)",
        `הלקוח שילם — ניתן לצאת לעבודה`,
        { screen: "active-job", jobId }
      ).catch(console.error);
    }

    return c.json({ success: true, message: "Payment simulated for dev testing" });
  } catch (err) {
    console.error("[Payments] simulate-paid error:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

// Technician reports issue not fixed → trigger refund for customer
paymentsRouter.post("/refund/:jobId", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  if (user.role !== "technician") return c.json({ message: "רק טכנאים יכולים לבקש החזר כספי" }, 403);

  const jobId = c.req.param("jobId");

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, technicianId: true, paymentStatus: true, finalPrice: true, estimatedPriceMax: true, status: true },
    });

    if (!job) return c.json({ message: "הזמנה לא נמצאה" }, 404);
    if (job.technicianId !== user.id) return c.json({ message: "לא מורשה" }, 403);
    if (job.paymentStatus !== "paid") return c.json({ message: "לא בוצע תשלום עבור הזמנה זו" }, 400);
    if (job.status === "completed" || job.status === "cancelled") {
      return c.json({ message: "לא ניתן לבקש החזר על הזמנה שהסתיימה" }, 400);
    }

    const refundAmount = job.finalPrice ?? job.estimatedPriceMax;

    // Mark job as cancelled with refund requested, create pending refund transaction
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: { status: "cancelled", cancelledAt: new Date(), paymentStatus: "refund_requested" },
      }),
      prisma.transaction.create({
        data: {
          technicianId: user.id,
          jobId,
          type: "refund",
          amount: refundAmount,
          status: "pending",
        },
      }),
    ]);

    // Notify customer
    try {
      const jobWithCustomer = await prisma.job.findUnique({
        where: { id: jobId },
        select: { customer: { select: { expoPushToken: true } } },
      });
      if (jobWithCustomer?.customer?.expoPushToken) {
        await sendPushNotification(
          jobWithCustomer.customer.expoPushToken,
          "💰 החזר כספי בדרך",
          "הטכנאי דיווח שהתקלה לא תוקנה. תקבל החזר כספי בקרוב.",
          { jobId, screen: "/(customer)/(tabs)" }
        );
      }
    } catch (pushErr) {
      console.error("[Push] refund notification error:", pushErr);
    }

    return c.json({ success: true, message: "בקשת ההחזר הכספי נשלחה. הלקוח יקבל החזר בקרוב." });
  } catch (err) {
    console.error("[Payments] refund error:", err);
    return c.json({ error: "שגיאה פנימית" }, 500);
  }
});

export { paymentsRouter };
