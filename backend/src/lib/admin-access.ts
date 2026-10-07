import { timingSafeEqual } from "crypto";
import { env } from "../env";

const ADMIN_EMAILS = env.ADMIN_EMAILS
  ? env.ADMIN_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  : [];

export function isAdminUser(
  user: { role?: string | null; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  return user.role === "admin" || ADMIN_EMAILS.includes((user.email || "").toLowerCase());
}

function secretsMatch(provided: string, configured: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/** Legacy HTML page and the native admin app send this header. */
export function isDashboardAdmin(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  const provided = c.req.header("x-admin-secret") || "";
  const configured = env.ADMIN_DASHBOARD_SECRET || "";
  return secretsMatch(provided, configured);
}

/** 401/403 response, or null when the caller may continue. */
export function adminDenied(c: any): Response | null {
  const requestingUser = c.get("user");
  const dashboard = isDashboardAdmin(c);
  if (!requestingUser && !dashboard) return c.body(null, 401);
  if (!dashboard && !isAdminUser(requestingUser)) {
    return c.json({ message: "Forbidden" }, 403);
  }
  return null;
}
