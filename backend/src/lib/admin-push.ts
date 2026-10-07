import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { sendPushNotificationToMany } from "./push-notifications";

export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("ExponentPushToken[") &&
    value.endsWith("]") &&
    value.length >= 24 &&
    value.length <= 200
  );
}

async function ensureAdminPushTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminPushDevice" (
      "id" TEXT PRIMARY KEY,
      "expoPushToken" TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function registerAdminPushToken(token: string): Promise<void> {
  await ensureAdminPushTable();
  await prisma.$executeRaw`
    INSERT INTO "AdminPushDevice" ("id", "expoPushToken", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${token}, NOW(), NOW())
    ON CONFLICT ("expoPushToken") DO NOTHING
  `;
}

export async function removeAdminPushToken(token: string): Promise<void> {
  await ensureAdminPushTable();
  await prisma.$executeRaw`
    DELETE FROM "AdminPushDevice" WHERE "expoPushToken" = ${token}
  `;
}

/** Lock-screen alert for every phone that registered from the admin app. */
export async function notifyAdmins(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    await ensureAdminPushTable();
    const devices = await prisma.$queryRaw<Array<{ expoPushToken: string }>>`
      SELECT "expoPushToken" FROM "AdminPushDevice"
    `;
    await sendPushNotificationToMany(
      devices.map((device) => device.expoPushToken),
      title,
      body,
      data,
    );
  } catch (error) {
    console.error("[Push] admin notify failed", error);
  }
}
