import { Hono } from "hono";
import { prisma } from "../prisma";
import { adminDenied } from "../lib/admin-access";
import {
  isExpoPushToken,
  notifyAdmins,
  registerAdminPushToken,
  removeAdminPushToken,
} from "../lib/admin-push";
import { fetchUserSavedAddresses } from "../lib/saved-addresses-db";

const ACTIVE_JOB_STATUSES = ["accepted", "on_way", "arrived", "in_progress"] as const;

function startOfTodayInJerusalem(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  if (![year, month, day, hour, minute, second].every((n) => Number.isFinite(n))) {
    const fallback = new Date(now);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = wallAsUtc - now.getTime();
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offset);
}

const adminPanelRouter = new Hono();

adminPanelRouter.use("*", async (c, next) => {
  const denied = adminDenied(c);
  if (denied) return denied;
  await next();
});

adminPanelRouter.get("/overview", async (c) => {
  const today = startOfTodayInJerusalem();
  const [
    pendingTechnicians,
    approvedTechnicians,
    availableTechnicians,
    totalTechnicians,
    pendingJobs,
    activeJobs,
    waitingForPayment,
    completedToday,
    paidToday,
    pendingWithdrawals,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "technician", isApproved: false } }),
    prisma.user.count({ where: { role: "technician", isApproved: true } }),
    prisma.user.count({
      where: { role: "technician", isApproved: true, isAvailable: true },
    }),
    prisma.user.count({ where: { role: "technician" } }),
    prisma.job.count({ where: { status: "pending" } }),
    prisma.job.count({ where: { status: { in: [...ACTIVE_JOB_STATUSES] } } }),
    prisma.job.count({
      where: { status: "accepted", paymentStatus: { not: "paid" } },
    }),
    prisma.job.count({
      where: { status: "completed", completedAt: { gte: today } },
    }),
    prisma.payment.aggregate({
      where: { status: "completed", paidAt: { gte: today } },
      _sum: { amount: true, commissionAmount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: "withdrawal", status: "pending" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return c.json({
    technicians: {
      pending: pendingTechnicians,
      approved: approvedTechnicians,
      available: availableTechnicians,
      total: totalTechnicians,
    },
    jobs: {
      pending: pendingJobs,
      active: activeJobs,
      waitingForPayment,
      completedToday,
    },
    money: {
      paidToday: paidToday._sum.amount ?? 0,
      commissionToday: paidToday._sum.commissionAmount ?? 0,
      paymentsToday: paidToday._count,
      pendingWithdrawals: pendingWithdrawals._sum.amount ?? 0,
      pendingWithdrawalCount: pendingWithdrawals._count,
    },
  });
});

adminPanelRouter.get("/jobs", async (c) => {
  const status = c.req.query("status") || "all";
  const takeRaw = Number(c.req.query("take") || "40");
  const take = Number.isFinite(takeRaw) ? Math.min(80, Math.max(1, Math.floor(takeRaw))) : 40;

  const where =
    status === "active"
      ? { status: { in: [...ACTIVE_JOB_STATUSES] } }
      : status === "pending" || status === "completed" || status === "cancelled"
        ? { status }
        : {};

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      jobNumber: true,
      status: true,
      paymentStatus: true,
      category: true,
      bikeType: true,
      estimatedPriceMax: true,
      finalPrice: true,
      customerAddress: true,
      createdAt: true,
      completedAt: true,
      customer: { select: { name: true, phone: true } },
      technician: { select: { name: true, phone: true } },
      payment: {
        select: {
          amount: true,
          commissionAmount: true,
          netAmount: true,
          status: true,
        },
      },
    },
  });

  return c.json({ jobs });
});

adminPanelRouter.get("/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      paymentStatus: true,
      category: true,
      bikeType: true,
      description: true,
      photoUrl: true,
      estimatedPriceMin: true,
      estimatedPriceMax: true,
      finalPrice: true,
      customerAddress: true,
      customerLocationLat: true,
      customerLocationLng: true,
      technicianLocationLat: true,
      technicianLocationLng: true,
      createdAt: true,
      acceptedAt: true,
      onWayAt: true,
      arrivedAt: true,
      inProgressAt: true,
      completedAt: true,
      cancelledAt: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
      technician: { select: { id: true, name: true, phone: true, email: true } },
      secondaryTechnician: { select: { id: true, name: true, phone: true, email: true } },
      payment: {
        select: {
          amount: true,
          commissionAmount: true,
          netAmount: true,
          status: true,
          createdAt: true,
          paidAt: true,
        },
      },
      extraRepairRequests: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          createdAt: true,
          paidAt: true,
          technicianId: true,
        },
      },
      review: { select: { rating: true, comment: true, createdAt: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 80,
        select: {
          id: true,
          text: true,
          createdAt: true,
          sender: { select: { id: true, name: true, role: true } },
        },
      },
      invitations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          invitee: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });

  if (!job) return c.json({ message: "ההזמנה לא נמצאה" }, 404);
  return c.json({ job });
});

adminPanelRouter.get("/withdrawals", async (c) => {
  const status = c.req.query("status") || "pending";
  const where =
    status === "all"
      ? { type: "withdrawal" }
      : { type: "withdrawal", status: status === "completed" || status === "failed" ? status : "pending" };

  const withdrawals = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amount: true,
      status: true,
      bankName: true,
      branchNumber: true,
      accountNumber: true,
      accountHolder: true,
      createdAt: true,
      technician: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  return c.json({ withdrawals });
});

adminPanelRouter.post("/withdrawals/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const action = body?.action;
  if (action !== "complete" && action !== "fail") {
    return c.json({ message: "פעולה לא מוכרת" }, 400);
  }

  const nextStatus = action === "complete" ? "completed" : "failed";
  const updated = await prisma.transaction.updateMany({
    where: { id, type: "withdrawal", status: "pending" },
    data: { status: nextStatus },
  });

  if (updated.count === 0) {
    return c.json({ message: "הבקשה כבר טופלה" }, 409);
  }

  return c.json({
    message: action === "complete" ? "סומן שהכסף הועבר" : "הבקשה נדחתה והיתרה חזרה לטכנאי",
  });
});

adminPanelRouter.get("/users", async (c) => {
  const q = (c.req.query("q") || "").trim();
  if (q.length < 2) {
    return c.json({ message: "צריך לפחות שתי אותיות" }, 400);
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isApproved: true,
      createdAt: true,
    },
  });

  return c.json({ users });
});

adminPanelRouter.post("/users/:id/role", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const role = body?.role;
  if (role !== "technician" && role !== "customer") {
    return c.json({ message: "תפקיד לא מוכר" }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isApproved: true },
  });
  if (!user) return c.json({ message: "המשתמש לא נמצא" }, 404);
  if (user.role === "admin") {
    return c.json({ message: "אי אפשר לשנות תפקיד של מנהל" }, 400);
  }

  if (role === "technician" && user.role === "technician") {
    return c.json({ user, unchanged: true });
  }
  if (role === "customer" && user.role === "customer") {
    return c.json({ user, unchanged: true });
  }

  const updated = await prisma.user.update({
    where: { id },
    data:
      role === "technician"
        ? { role: "technician", isApproved: false, isAvailable: false }
        : { role: "customer", isApproved: true, isAvailable: false },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isApproved: true,
    },
  });

  if (role === "technician") {
    await notifyAdmins("טכנאי ממתין לאישור", `${updated.name?.trim() || "טכנאי חדש"} ממתין לאישור`, {
      screen: "technicians",
    });
  }

  return c.json({
    user: updated,
    message:
      role === "technician"
        ? "החשבון הפך לטכנאי וממתין לאישור"
        : "החשבון חזר ללקוח",
  });
});

const customerFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  emailVerified: true,
  createdAt: true,
} as const;

function trimmed(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

adminPanelRouter.get("/customers", async (c) => {
  const q = (c.req.query("q") || "").trim();
  const where = {
    role: "customer" as const,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where: { role: "customer" } }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        ...customerFields,
        _count: { select: { customerJobs: true } },
      },
    }),
  ]);
  const ids = users.map((user) => user.id);
  const openGroups = ids.length
    ? await prisma.job.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: ids },
          status: { in: [...ACTIVE_JOB_STATUSES, "pending"] },
        },
        _count: { _all: true },
      })
    : [];
  const openById = new Map(openGroups.map((row) => [row.customerId, row._count._all]));
  return c.json({
    total,
    customers: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      jobs: user._count.customerJobs,
      openJobs: openById.get(user.id) ?? 0,
    })),
  });
});

adminPanelRouter.get("/customers/:id", async (c) => {
  const id = c.req.param("id");
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...customerFields, role: true },
  });
  if (!user || user.role !== "customer") return c.json({ message: "הלקוח לא נמצא" }, 404);
  const [jobs, savedAddresses] = await Promise.all([
    prisma.job.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        paymentStatus: true,
        category: true,
        customerAddress: true,
        finalPrice: true,
        estimatedPriceMax: true,
        createdAt: true,
        technician: { select: { name: true } },
      },
    }),
    fetchUserSavedAddresses(id),
  ]);
  return c.json({
    customer: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      savedAddresses,
    },
    jobs,
  });
});

adminPanelRouter.patch("/customers/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "customer") return c.json({ message: "הלקוח לא נמצא" }, 404);

  const data: { name?: string; phone?: string | null; address?: string | null; email?: string } = {};
  if (body && typeof body === "object" && "name" in body) {
    const name = trimmed((body as { name?: unknown }).name, 80);
    if (!name) return c.json({ message: "צריך שם" }, 400);
    data.name = name;
  }
  if (body && typeof body === "object" && "phone" in body) {
    data.phone = trimmed((body as { phone?: unknown }).phone, 20);
  }
  if (body && typeof body === "object" && "address" in body) {
    data.address = trimmed((body as { address?: unknown }).address, 200);
  }
  if (body && typeof body === "object" && "email" in body) {
    const email = trimmed((body as { email?: unknown }).email, 120);
    if (!email || !email.includes("@")) return c.json({ message: "אימייל לא תקין" }, 400);
    const taken = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, NOT: { id } },
      select: { id: true },
    });
    if (taken) return c.json({ message: "האימייל כבר בשימוש" }, 409);
    data.email = email;
  }
  if (!Object.keys(data).length) return c.json({ message: "אין מה לעדכן" }, 400);

  const customer = await prisma.user.update({
    where: { id },
    data,
    select: customerFields,
  });
  return c.json({ customer });
});

adminPanelRouter.delete("/customers/:id", async (c) => {
  const id = c.req.param("id");
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "customer") return c.json({ message: "הלקוח לא נמצא" }, 404);
  await prisma.user.delete({ where: { id } });
  return c.json({ message: "הלקוח נמחק" });
});

adminPanelRouter.put("/push-token", async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = body?.token;
  if (!isExpoPushToken(token)) {
    return c.json({ message: "טוקן לא תקין" }, 400);
  }
  await registerAdminPushToken(token);
  return c.json({ ok: true });
});

adminPanelRouter.delete("/push-token", async (c) => {
  const token = c.req.query("token") || "";
  if (isExpoPushToken(token)) await removeAdminPushToken(token);
  return c.json({ ok: true });
});

export { adminPanelRouter };
