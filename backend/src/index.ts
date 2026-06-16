import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { sampleRouter } from "./routes/sample";
import { techniciansRouter } from "./routes/technicians";
import { contactRouter } from "./routes/contact";
import { jobsRouter } from "./routes/jobs";
import { reviewsRouter } from "./routes/reviews";
import { uploadsRouter } from "./routes/uploads";
import { paymentsRouter } from "./routes/payments";
import { messagesRouter } from "./routes/messages";
import { streetsRouter } from "./routes/streets";
import { logger } from "hono/logger";
import { auth } from "./auth";

// Type the Hono app with user/session variables
type HonoEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

const app = new Hono<HonoEnv>();

// Auth middleware - populates user/session for all routes
app.use("*", async (c, next) => {
  // Try to get session from headers (cookie-based auth)
  let session = await auth.api.getSession({ headers: c.req.raw.headers });

  // If no session found, try Bearer token auth by looking up directly in database
  if (!session) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const { prisma } = await import("./prisma");
        const dbSession = await prisma.session.findUnique({
          where: { token },
          include: { user: true },
        });

        if (dbSession && dbSession.expiresAt > new Date()) {
          // Create a session-like object that matches what Better Auth returns
          session = {
            session: {
              id: dbSession.id,
              token: dbSession.token,
              userId: dbSession.userId,
              expiresAt: dbSession.expiresAt,
              createdAt: dbSession.createdAt,
              updatedAt: dbSession.updatedAt,
              ipAddress: dbSession.ipAddress,
              userAgent: dbSession.userAgent,
            },
            user: dbSession.user as any,
          };
        }
      } catch (error) {
        console.error("[Auth Middleware] Error looking up session by token:", error);
      }
    }
  }

  console.log("[Auth Middleware] Path:", c.req.path, "Session:", session ? "found" : "null");
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  // Enrich user with custom fields from database
  try {
    const { prisma } = await import("./prisma");
    const fullUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    c.set("user", fullUser ?? null);
    c.set("session", fullUser ? session.session : null);
  } catch (error) {
    console.error("Error enriching user session:", error);
    c.set("user", session.user);
    c.set("session", session.session);
  }

  await next();
});

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Diagnostic endpoint — shows which auth providers are active AND the exact redirect URIs being used
app.get("/api/auth/providers-check", (c) => {
  const resolvedBase = (process.env.OAUTH_BASE_URL || process.env.BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return c.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
    BACKEND_URL: process.env.BACKEND_URL || "(not set)",
    OAUTH_BASE_URL: process.env.OAUTH_BASE_URL || "(not set)",
    resolvedBaseURL: resolvedBase,
    googleRedirectURI: `${resolvedBase}/api/auth/callback/google`,
    appleRedirectURI: `${resolvedBase}/api/auth/callback/apple`,
  });
});

// Email/password sign-up is enabled (public registration allowed).
// The three manual blocking routes below were removed so the normal
// Better Auth handler can process /api/auth/sign-up/email etc.



// Admin emails - loaded from environment variables
const ADMIN_EMAILS = env.ADMIN_EMAILS
  ? env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  : [];

function isAdminUser(user: any): boolean {
  if (!user) return false;
  return user.role === "admin" || ADMIN_EMAILS.includes((user.email || "").toLowerCase());
}

// Support for the standalone HTML admin dashboard (outside the mobile app)
// Owner accesses /admin?secret=... or the page prompts for it; JS then sends this header for API calls.
function isDashboardAdmin(c: any): boolean {
  const secretHeader = c.req.header("x-admin-secret");
  const configured = (env as any).ADMIN_DASHBOARD_SECRET || process.env.ADMIN_DASHBOARD_SECRET || "";
  return !!configured && secretHeader === configured;
}

// Auth handler
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  console.log("[Auth Handler] Processing:", c.req.method, c.req.path);
  const res = await auth.handler(c.req.raw);
  if (c.req.path === "/api/auth/expo-authorization-proxy") {
    const loc = res.headers.get("location") || "(no location header)";
    console.log("[OAuth] Full redirect location:", loc);
    try {
      const redirectUri = new URL(loc).searchParams.get("redirect_uri");
      console.log("[OAuth] redirect_uri param:", redirectUri);
    } catch (e) {
      console.log("[OAuth] Could not parse location as URL:", e);
    }
  }
  return res;
});

// Protected route example - returns full user data including role and isApproved
app.get("/api/me", async (c) => {
  const sessionUser = c.get("user"); // Basic user from Better Auth
  if (!sessionUser) return c.body(null, 401);

  // Fetch full user data from database to include role and isApproved
  try {
    const { prisma } = await import("./prisma");
    const fullUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fullUser) {
      return c.body(null, 404);
    }

    const isAdmin = isAdminUser(fullUser);
    return c.json({ user: { ...fullUser, isAdmin } });
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Admin routes - approve technician
app.post("/api/admin/approve-technician/:userId", async (c) => {
  const requestingUser = c.get("user");
  const isDash = isDashboardAdmin(c);
  if (!requestingUser && !isDash) return c.body(null, 401);
  if (!isDash && !isAdminUser(requestingUser)) return c.json({ message: "Forbidden" }, 403);

  const userId = c.req.param("userId");

  try {
    const { prisma } = await import("./prisma");

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    if (user.role !== "technician") {
      return c.json({ message: "User is not a technician" }, 400);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
    });

    return c.json({ message: "Technician approved successfully", user: updatedUser });
  } catch (error) {
    console.error("Approve technician error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get pending technicians
app.get("/api/admin/pending-technicians", async (c) => {
  const requestingUser = c.get("user");
  const isDash = isDashboardAdmin(c);
  if (!requestingUser && !isDash) return c.body(null, 401);
  if (!isDash && !isAdminUser(requestingUser)) return c.json({ message: "Forbidden" }, 403);

  try {
    const { prisma } = await import("./prisma");

    const pendingTechnicians = await prisma.user.findMany({
      where: {
        role: "technician",
        isApproved: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return c.json({ technicians: pendingTechnicians });
  } catch (error) {
    console.error("Get pending technicians error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Get all technicians (for admin)
app.get("/api/admin/technicians", async (c) => {
  const requestingUser = c.get("user");
  const isDash = isDashboardAdmin(c);
  if (!requestingUser && !isDash) return c.body(null, 401);
  if (!isDash && !isAdminUser(requestingUser)) return c.json({ message: "Forbidden" }, 403);

  try {
    const { prisma } = await import("./prisma");

    const technicians = await prisma.user.findMany({
      where: {
        role: "technician",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isApproved: true,
        isAvailable: true,
        rating: true,
        totalReviews: true,
        vehicleType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ technicians });
  } catch (error) {
    console.error("Get all technicians error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Remove/delete technician (for admin)
app.delete("/api/admin/technician/:userId", async (c) => {
  const requestingUser = c.get("user");
  const isDash = isDashboardAdmin(c);
  if (!requestingUser && !isDash) return c.body(null, 401);
  if (!isDash && !isAdminUser(requestingUser)) return c.json({ message: "Forbidden" }, 403);

  const userId = c.req.param("userId");

  try {
    const { prisma } = await import("./prisma");

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    if (user.role !== "technician") {
      return c.json({ message: "User is not a technician" }, 400);
    }

    // Delete the technician
    await prisma.user.delete({
      where: { id: userId },
    });

    return c.json({ message: "Technician removed successfully" });
  } catch (error) {
    console.error("Remove technician error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Revoke technician approval (for admin)
app.post("/api/admin/revoke-technician/:userId", async (c) => {
  const requestingUser = c.get("user");
  const isDash = isDashboardAdmin(c);
  if (!requestingUser && !isDash) return c.body(null, 401);
  if (!isDash && !isAdminUser(requestingUser)) return c.json({ message: "Forbidden" }, 403);

  const userId = c.req.param("userId");

  try {
    const { prisma } = await import("./prisma");

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    if (user.role !== "technician") {
      return c.json({ message: "User is not a technician" }, 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isApproved: false },
    });

    return c.json({ message: "Technician approval revoked", user });
  } catch (error) {
    console.error("Revoke technician error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Technician stats endpoint
app.get("/api/technician/stats", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  try {
    const { prisma } = await import("./prisma");

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this week's date range
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Today's jobs count
    const todaysJobs = await prisma.job.count({
      where: {
        technicianId: user.id,
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Today's earnings
    const todaysJobsData = await prisma.job.findMany({
      where: {
        technicianId: user.id,
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
        finalPrice: { not: null },
      },
      select: { finalPrice: true },
    });
    const todaysEarnings = todaysJobsData.reduce((sum, job) => sum + (job.finalPrice || 0), 0);

    // This week's jobs count
    const weeklyJobs = await prisma.job.count({
      where: {
        technicianId: user.id,
        completedAt: {
          gte: startOfWeek,
        },
      },
    });

    const reviewData = await prisma.review.aggregate({
      where: { technicianId: user.id },
      _avg: { rating: true },
    });
    const rating = Math.round((reviewData._avg.rating ?? 0) * 10) / 10;

    return c.json({
      todaysJobs,
      todaysEarnings,
      weeklyJobs,
      rating,
    });
  } catch (error) {
    console.error("Error fetching technician stats:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Technician balance endpoint
app.get("/api/technician/balance", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  try {
    const { prisma } = await import("./prisma");

    // Calculate balance from all completed jobs minus withdrawals
    const earnings = await prisma.transaction.aggregate({
      where: {
        technicianId: user.id,
        type: "earning",
        status: "completed",
      },
      _sum: {
        amount: true,
      },
    });

    const withdrawals = await prisma.transaction.aggregate({
      where: {
        technicianId: user.id,
        type: "withdrawal",
        status: "completed",
      },
      _sum: {
        amount: true,
      },
    });

    const balance = (earnings._sum.amount || 0) - (withdrawals._sum.amount || 0);

    return c.json({ balance });
  } catch (error) {
    console.error("Error fetching technician balance:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Technician transactions endpoint
app.get("/api/technician/transactions", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  if (user.role !== "technician") {
    return c.json({ message: "Not authorized" }, 403);
  }

  try {
    const { prisma } = await import("./prisma");

    const transactions = await prisma.transaction.findMany({
      where: {
        technicianId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to last 50 transactions
    });

    return c.json({ transactions });
  } catch (error) {
    console.error("Error fetching technician transactions:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Reset password web page - called from email link, handles the full reset flow in browser
app.get("/reset-password", (c) => {
  const token = c.req.query("token") || "";
  const backendUrl = env.BACKEND_URL;
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>איפוס סיסמה - Ebikeland</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Arial, sans-serif; background: linear-gradient(160deg, #052e16 0%, #14532d 50%, #166534 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: rgba(255,255,255,0.97); border-radius: 28px; padding: 40px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .logo { width: 64px; height: 64px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 18px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; }
    h1 { color: #111827; font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
    .field { margin-bottom: 16px; text-align: right; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input { width: 100%; padding: 14px 16px; border: 1.5px solid #e5e7eb; border-radius: 14px; font-size: 16px; outline: none; transition: border-color 0.2s; background: #f9fafb; direction: ltr; text-align: left; }
    input:focus { border-color: #10b981; background: white; }
    .btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: opacity 0.2s; }
    .btn:active { opacity: 0.85; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ef4444; font-size: 13px; margin-top: 12px; }
    .success { text-align: center; }
    .success-icon { font-size: 56px; margin-bottom: 16px; }
    .success h2 { color: #111827; font-size: 20px; margin-bottom: 8px; }
    .success p { color: #6b7280; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🚲</div>
    <h1>Ebikeland</h1>
    <p class="subtitle">הכנס סיסמה חדשה לחשבון שלך</p>

    <div id="form-view">
      <div class="field">
        <label>סיסמה חדשה</label>
        <input type="password" id="password" placeholder="לפחות 6 תווים" autocomplete="new-password" />
      </div>
      <div class="field">
        <label>אימות סיסמה</label>
        <input type="password" id="confirm" placeholder="הכנס שוב את הסיסמה" autocomplete="new-password" />
      </div>
      <button class="btn" id="submit-btn" onclick="submitReset()">אפס סיסמה</button>
      <div class="error" id="error-msg"></div>
    </div>

    <div id="success-view" class="success" style="display:none">
      <div class="success-icon">✅</div>
      <h2>הסיסמה אופסה בהצלחה!</h2>
      <p>כעת תוכל להיכנס לאפליקציה עם הסיסמה החדשה שלך.</p>
    </div>
  </div>

  <script>
    const TOKEN = "${token}";
    const BACKEND = "${backendUrl}";

    async function submitReset() {
      const password = document.getElementById("password").value;
      const confirm = document.getElementById("confirm").value;
      const errorEl = document.getElementById("error-msg");
      const btn = document.getElementById("submit-btn");

      errorEl.textContent = "";

      if (!password || password.length < 6) {
        errorEl.textContent = "הסיסמה חייבת להכיל לפחות 6 תווים";
        return;
      }
      if (password !== confirm) {
        errorEl.textContent = "הסיסמאות אינן תואמות";
        return;
      }

      btn.disabled = true;
      btn.textContent = "מאפס...";

      try {
        const res = await fetch(BACKEND + "/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: TOKEN, newPassword: password }),
        });

        if (res.ok) {
          document.getElementById("form-view").style.display = "none";
          document.getElementById("success-view").style.display = "block";
        } else {
          const data = await res.json().catch(() => ({}));
          errorEl.textContent = data.message || "שגיאה באיפוס הסיסמה. ייתכן שהקישור פג תוקף.";
          btn.disabled = false;
          btn.textContent = "אפס סיסמה";
        }
      } catch (e) {
        errorEl.textContent = "שגיאת חיבור. נסה שוב.";
        btn.disabled = false;
        btn.textContent = "אפס סיסמה";
      }
    }

    // Allow Enter key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitReset();
    });
  </script>
</body>
</html>`;
  return c.html(html);
});

// ============================================================================
// Standalone Admin Dashboard (HTML, completely outside the mobile app)
// Owner opens /admin (with secret in query or via in-page prompt).
// The page calls the existing /api/admin/* endpoints using x-admin-secret header.
// ============================================================================
app.get("/admin", async (c) => {
  const configuredSecret = (env as any).ADMIN_DASHBOARD_SECRET || process.env.ADMIN_DASHBOARD_SECRET || "";
  const querySecret = c.req.query("secret") || "";

  // If secret provided in URL and correct, serve immediately.
  // Otherwise serve the page (the JS inside will show a secret prompt if needed).
  const initialUnlocked = !!configuredSecret && querySecret === configuredSecret;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ניהול טכנאים • Ebikeland</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .rtl { direction: rtl; text-align: right; }
    .card { transition: transform .1s ease, box-shadow .1s ease; }
    .card:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
    .status-pill { font-size: 12px; padding: 2px 10px; border-radius: 9999px; font-weight: 600; }
  </style>
</head>
<body class="bg-gray-50 rtl">
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-3xl">🚲</div>
        <div>
          <div class="text-3xl font-bold text-gray-900">Ebikeland</div>
          <div class="text-emerald-600 -mt-1 text-sm font-medium">לוח ניהול טכנאים</div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button onclick="refreshAll()" 
                class="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm">
          <span>🔄</span>
          <span>רענן</span>
        </button>
        <a href="/" class="text-sm text-gray-500 hover:text-gray-700 px-3">חזרה לאפליקציה</a>
      </div>
    </div>

    <!-- Secret Gate (shown when no secret in URL or storage) -->
    <div id="secret-gate" class="max-w-md mx-auto mt-12 hidden">
      <div class="bg-white border border-gray-200 shadow-xl rounded-3xl p-8">
        <div class="text-center mb-6">
          <div class="mx-auto w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-4">🔐</div>
          <h1 class="text-2xl font-bold text-gray-900">גישה ללוח הניהול</h1>
          <p class="text-gray-500 mt-1 text-sm">הזן את סיסמת הניהול (ADMIN_DASHBOARD_SECRET)</p>
        </div>
        <input id="secret-input" type="password" placeholder="סיסמת ניהול" 
               class="w-full border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl px-4 py-3 text-lg outline-none" />
        <button onclick="unlockWithSecret()" 
                class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition text-white font-bold py-3.5 rounded-2xl text-lg">
          פתח לוח ניהול
        </button>
        <div class="text-[11px] text-center text-gray-400 mt-4">
          הסיסמה נשמרת רק בדפדפן שלך (sessionStorage)
        </div>
      </div>
    </div>

    <!-- Main Dashboard Content -->
    <div id="dashboard-content" class="${initialUnlocked ? '' : 'hidden'}">
      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div class="text-emerald-600 text-sm font-semibold">ממתינים לאישור</div>
          <div id="stat-pending" class="text-4xl font-bold text-gray-900 mt-1">—</div>
        </div>
        <div class="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div class="text-emerald-600 text-sm font-semibold">טכנאים מאושרים</div>
          <div id="stat-approved" class="text-4xl font-bold text-gray-900 mt-1">—</div>
        </div>
        <div class="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div class="text-emerald-600 text-sm font-semibold">פעילים כעת</div>
          <div id="stat-active" class="text-4xl font-bold text-gray-900 mt-1">—</div>
        </div>
        <div class="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div class="text-emerald-600 text-sm font-semibold">סה"כ טכנאים</div>
          <div id="stat-total" class="text-4xl font-bold text-gray-900 mt-1">—</div>
        </div>
      </div>

      <!-- Technicians Section -->
      <div class="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b flex items-center justify-between">
          <div class="font-bold text-xl text-gray-900">טכנאים</div>
          <div class="flex gap-2 text-sm">
            <button onclick="filterTechnicians('pending')" class="px-4 py-1.5 rounded-2xl border bg-amber-50 text-amber-700 border-amber-200 font-medium active-tab" id="tab-pending">ממתינים <span id="count-pending" class="font-mono text-xs bg-white/70 px-1.5 rounded">(0)</span></button>
            <button onclick="filterTechnicians('approved')" class="px-4 py-1.5 rounded-2xl border bg-white hover:bg-gray-50 text-gray-700 border-gray-200 font-medium" id="tab-approved">מאושרים <span id="count-approved" class="font-mono text-xs bg-white/70 px-1.5 rounded">(0)</span></button>
            <button onclick="filterTechnicians('all')" class="px-4 py-1.5 rounded-2xl border bg-white hover:bg-gray-50 text-gray-700 border-gray-200 font-medium" id="tab-all">הכל <span id="count-all" class="font-mono text-xs bg-white/70 px-1.5 rounded">(0)</span></button>
          </div>
        </div>

        <div class="p-2">
          <div id="tech-list" class="divide-y"></div>
          <div id="tech-empty" class="hidden px-6 py-12 text-center text-gray-400">אין טכנאים להצגה</div>
        </div>
      </div>

      <div class="mt-4 text-[11px] text-gray-400 px-1">
        לוח זה פועל דרך ה-API הקיים. שינויים משפיעים מיד על האפליקציה.
      </div>
    </div>
  </div>

<script>
  const BACKEND = window.location.origin;
  let DASH_SECRET = "";
  let ALL_TECHS = [];
  let CURRENT_FILTER = "pending";

  function getSecretFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("secret") || "";
  }

  function unlockWithSecret() {
    const input = document.getElementById("secret-input");
    const val = (input && input.value || "").trim();
    if (!val) return;
    sessionStorage.setItem("admin_secret", val);
    DASH_SECRET = val;
    document.getElementById("secret-gate").classList.add("hidden");
    document.getElementById("dashboard-content").classList.remove("hidden");
    loadTechnicians();
  }

  function ensureSecret() {
    // 1. URL param
    const urlSecret = getSecretFromUrl();
    if (urlSecret) {
      sessionStorage.setItem("admin_secret", urlSecret);
      DASH_SECRET = urlSecret;
      return true;
    }
    // 2. sessionStorage
    const stored = sessionStorage.getItem("admin_secret");
    if (stored) {
      DASH_SECRET = stored;
      return true;
    }
    return false;
  }

  async function apiCall(path, options = {}) {
    const headers = options.headers || {};
    if (DASH_SECRET) {
      headers["x-admin-secret"] = DASH_SECRET;
    }
    const res = await fetch(BACKEND + path, {
      ...options,
      headers,
      credentials: "include"
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Request failed: " + res.status);
    }
    return res.json();
  }

  async function loadTechnicians() {
    try {
      const [pendingRes, allRes] = await Promise.all([
        apiCall("/api/admin/pending-technicians"),
        apiCall("/api/admin/technicians")
      ]);

      const pending = pendingRes.technicians || [];
      const all = allRes.technicians || [];

      ALL_TECHS = all.map(t => ({ ...t, _isPending: pending.some(p => p.id === t.id) }));

      // stats
      document.getElementById("stat-pending").textContent = pending.length;
      const approved = all.filter(t => t.isApproved);
      document.getElementById("stat-approved").textContent = approved.length;
      const active = approved.filter(t => t.isAvailable);
      document.getElementById("stat-active").textContent = active.length;
      document.getElementById("stat-total").textContent = all.length;

      // counts on tabs
      document.getElementById("count-pending").textContent = "(" + pending.length + ")";
      document.getElementById("count-approved").textContent = "(" + approved.length + ")";
      document.getElementById("count-all").textContent = "(" + all.length + ")";

      renderList(CURRENT_FILTER);
    } catch (e) {
      console.error(e);
      const list = document.getElementById("tech-list");
      list.innerHTML = '<div class="p-8 text-center text-red-500">שגיאה בטעינת הנתונים. ודא שהסיסמה נכונה.</div>';
    }
  }

  function filterTechnicians(filter) {
    CURRENT_FILTER = filter;
    // update tab styles
    ["pending","approved","all"].forEach(f => {
      const el = document.getElementById("tab-" + f);
      if (el) el.className = f === filter 
        ? "px-4 py-1.5 rounded-2xl border bg-emerald-600 text-white border-emerald-600 font-medium"
        : "px-4 py-1.5 rounded-2xl border bg-white hover:bg-gray-50 text-gray-700 border-gray-200 font-medium";
    });
    renderList(filter);
  }

  function renderList(filter) {
    const container = document.getElementById("tech-list");
    container.innerHTML = "";

    let filtered = ALL_TECHS;
    if (filter === "pending") filtered = ALL_TECHS.filter(t => !t.isApproved);
    if (filter === "approved") filtered = ALL_TECHS.filter(t => t.isApproved);

    if (filtered.length === 0) {
      document.getElementById("tech-empty").classList.remove("hidden");
      return;
    } else {
      document.getElementById("tech-empty").classList.add("hidden");
    }

    filtered.forEach(tech => {
      const div = document.createElement("div");
      div.className = "p-5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-50";

      const status = !tech.isApproved 
        ? '<span class="status-pill bg-amber-100 text-amber-700">ממתין לאישור</span>' 
        : (tech.isAvailable 
            ? '<span class="status-pill bg-emerald-100 text-emerald-700">פעיל</span>' 
            : '<span class="status-pill bg-gray-100 text-gray-600">לא פעיל</span>');

      const actions = !tech.isApproved 
        ? '<button onclick="approveTech(\''+tech.id+'\')" class="px-5 py-2 bg-emerald-600 text-white rounded-2xl text-sm font-semibold active:bg-emerald-700">אשר טכנאי</button>' +
          '<button onclick="deleteTech(\''+tech.id+'\')" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-2xl text-sm">מחק</button>'
        : '<button onclick="revokeTech(\''+tech.id+'\')" class="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-sm font-semibold">בטל אישור</button>' +
          '<button onclick="deleteTech(\''+tech.id+'\')" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-2xl text-sm">מחק</button>';

      div.innerHTML = \`
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg flex-shrink-0">
              \${(tech.name || "?").charAt(0)}
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-gray-900">\${tech.name || "ללא שם"}</div>
              <div class="text-xs text-gray-500">\${tech.email || ""}</div>
            </div>
            <div class="ml-auto md:ml-0">\${status}</div>
          </div>
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm text-gray-600">
            \${tech.phone ? '<div>📞 ' + tech.phone + '</div>' : ''}
            \${tech.vehicleType ? '<div>🛠 ' + tech.vehicleType + '</div>' : ''}
            <div class="text-xs text-gray-400">נרשם: ' + new Date(tech.createdAt).toLocaleDateString('he-IL') + '</div>
          </div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          \${actions}
        </div>
      \`;
      container.appendChild(div);
    });
  }

  async function approveTech(id) {
    if (!confirm("לאשר את הטכנאי הזה?")) return;
    try {
      await apiCall("/api/admin/approve-technician/" + id, { method: "POST" });
      await loadTechnicians();
    } catch (e) {
      alert("שגיאה באישור: " + e.message);
    }
  }

  async function revokeTech(id) {
    if (!confirm("לבטל את האישור?")) return;
    try {
      await apiCall("/api/admin/revoke-technician/" + id, { method: "POST" });
      await loadTechnicians();
    } catch (e) {
      alert("שגיאה: " + e.message);
    }
  }

  async function deleteTech(id) {
    if (!confirm("למחוק את הטכנאי לצמיתות? פעולה זו בלתי הפיכה.")) return;
    try {
      await apiCall("/api/admin/technician/" + id, { method: "DELETE" });
      await loadTechnicians();
    } catch (e) {
      alert("שגיאה במחיקה: " + e.message);
    }
  }

  async function refreshAll() {
    await loadTechnicians();
  }

  // Boot
  (function init() {
    const hasSecret = ensureSecret();
    const gate = document.getElementById("secret-gate");
    const content = document.getElementById("dashboard-content");

    if (hasSecret) {
      gate.classList.add("hidden");
      content.classList.remove("hidden");
      loadTechnicians();
    } else {
      gate.classList.remove("hidden");
      content.classList.add("hidden");
    }

    // Allow pressing Enter in the secret input
    const input = document.getElementById("secret-input");
    if (input) {
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") unlockWithSecret();
      });
    }
  })();
</script>
</body>
</html>`;

  // If a valid secret was passed in the URL we can consider the page "unlocked"
  // The JS inside still handles the case gracefully.
  return c.html(html);
});

// Routes
app.route("/api/uploads", uploadsRouter);
app.route("/api/sample", sampleRouter);
app.route("/api/technicians", techniciansRouter);
app.route("/api/contact", contactRouter);
app.route("/api/jobs", jobsRouter);
app.route("/api/reviews", reviewsRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/jobs", messagesRouter);
app.route("/api/streets", streetsRouter);

// Delete own account - permanent, deletes all user data
app.delete("/api/users/me", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  try {
    const { prisma } = await import("./prisma");
    await prisma.user.delete({
      where: { id: user.id },
    });

    console.log(`[Account] Permanently deleted account for user ${user.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Update logged-in user's profile (image, role)
app.patch("/api/users/me", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  try {
    const body = await c.req.json();
    const { image, role } = body;

    const updateData: Record<string, unknown> = {};

    if (typeof image === "string") {
      updateData.image = image;
    }

    if (typeof role === "string") {
      const validRoles = ["customer", "technician"];
      if (!validRoles.includes(role)) {
        return c.json({ message: "Invalid role" }, 400);
      }
      updateData.role = role;
      // Technicians start unapproved, customers are auto-approved
      if (role === "technician") {
        updateData.isApproved = false;
      } else {
        updateData.isApproved = true;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ message: "No valid fields to update" }, 400);
    }

    const { prisma } = await import("./prisma");
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, name: true, email: true, image: true, role: true, isApproved: true },
    });

    return c.json({ user: updated });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Save Expo push token for the logged-in user
app.patch("/api/users/push-token", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  try {
    const { token } = await c.req.json();
    if (!token || typeof token !== "string") {
      return c.json({ message: "Invalid token" }, 400);
    }

    const { prisma } = await import("./prisma");
    await prisma.user.update({
      where: { id: user.id },
      data: { expoPushToken: token },
    });

    console.log(`[Push] Saved push token for user ${user.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving push token:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

// Heartbeat endpoint — mobile calls this when returning to foreground
app.patch("/api/technicians/heartbeat", async (c) => {
  const user = c.get("user");
  if (!user || user.role !== "technician") return c.body(null, 401);
  try {
    const { prisma } = await import("./prisma");
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 500);
  }
});

const port = Number(process.env.PORT) || 3000;

// Auto-unavailability: mark technicians offline after 5 minutes without a ping
const STALE_MS = 5 * 60 * 1000;
setInterval(async () => {
  try {
    const { prisma } = await import("./prisma");
    const cutoff = new Date(Date.now() - STALE_MS);
    const result = await prisma.user.updateMany({
      where: { role: "technician", isAvailable: true, lastSeenAt: { lt: cutoff } },
      data: { isAvailable: false },
    });
    if (result.count > 0) {
      console.log(`[Availability] Marked ${result.count} technician(s) unavailable (no ping 5+ min)`);
    }
  } catch (err) {
    console.error("[Availability] Cleanup error:", err);
  }
}, 60_000);

export default {
  port,
  fetch: app.fetch,
};
