import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { sendPushNotification } from "../lib/push-notifications";
import { canCreatePayment } from "../lib/payment-gates";
import {
  createMockToken,
  encodeMockRef,
  isMockPaymentsMode,
  mockCheckoutUrl,
  renderMockCheckoutPage,
} from "../lib/mock-payments";
import { formatJobReference } from "../lib/job-reference";

type HonoEnv = { Variables: { user: any; session: any } };

const paymentsRouter = new Hono<HonoEnv>();

/** Public URL for checkout redirects — matches the host the app actually calls when BACKEND_URL drifts. */
function resolvePublicBackendUrl(c: { req: { header: (name: string) => string | undefined } }): string {
  const configured = (process.env.BACKEND_URL ?? "").replace(/\/$/, "");
  if (configured) return configured;
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
  const proto = c.req.header("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://127.0.0.1:3001";
}

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
    const backendUrl = resolvePublicBackendUrl(c);

    if (!isMockPaymentsMode()) {
      return c.json({ error: "מערכת התשלומים טרם הוגדרה" }, 503);
    }

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
      provider: "mock",
      jobNumber: job.jobNumber,
      jobReference,
      description: `תיקון אופניים ${jobReference}`,
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Internal server error";
    console.error("[Payments] create error:", err);
    return c.json({ error: message }, 500);
  }
});

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

// ─── Mock payment checkout (no real charge) ──────────────────────────────────
paymentsRouter.get("/mock/checkout", async (c) => {
  const token = c.req.query("token") ?? "";
  const kind = (c.req.query("kind") === "extra" ? "extra" : "job") as "job" | "extra";
  if (!token) return c.text("Invalid token", 400);

  const ref = encodeMockRef(token, kind);
  const backendUrl = resolvePublicBackendUrl(c);

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
  const backendUrl = resolvePublicBackendUrl(c);

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
  const backendUrl = resolvePublicBackendUrl(c);
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

async function syncJobPaymentOnSuccess(jobId: string) {
  const payment = await prisma.payment.findUnique({ where: { jobId } });
  if (!payment) return;

  if (payment.growTransactionCode?.startsWith("mock:") && payment.status === "pending") {
    await markMainJobPaid({
      jobId,
      transactionId: payment.growTransactionCode,
      paymentSum: payment.amount,
    });
  }
}

// GET /api/payments/success — browser redirect after payment provider success
paymentsRouter.get("/success", async (c) => {
  const jobId = c.req.query("jobId") ?? "";
  if (jobId) {
    try {
      await syncJobPaymentOnSuccess(jobId);
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

// GET /api/payments/cancel — browser redirect after payment cancel
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

// Dev-only simulate paid (for testing the full flow in mock payment mode)
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

    // Mark paid (same as real payment completion path)
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
