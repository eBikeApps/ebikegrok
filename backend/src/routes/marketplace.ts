import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import {
  CLASSIFIED_LIMITS,
  assessNewListing,
  classifyMessageParty,
  presentConversation,
  publicSellerName,
  validateClassifiedMessage,
  validateListingFields,
} from "../lib/classifieds";

type Env = {
  Variables: {
    user: { id: string; role?: string | null; name?: string | null } | null;
  };
};

const hits = new Map<string, number[]>();

function recentCount(key: string, windowMs: number, now: number): number {
  const kept = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (kept.length === 0) hits.delete(key);
  else hits.set(key, kept);
  return kept.length;
}

function markHit(key: string, now: number) {
  const kept = hits.get(key) ?? [];
  kept.push(now);
  hits.set(key, kept.slice(-80));
}

function clientIp(header: string | undefined): string {
  const ip = (header ?? "").split(",")[0]?.trim() || "local";
  return ip.slice(0, 64);
}

let tableReady: Promise<void> | null = null;

function ensureClassifiedTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClassifiedListing" (
          "id" TEXT PRIMARY KEY,
          "sellerId" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "priceIls" INTEGER NOT NULL,
          "city" TEXT NOT NULL,
          "contactPhone" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassifiedListing_status_createdAt_idx"
        ON "ClassifiedListing" ("status", "createdAt")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassifiedListing_sellerId_createdAt_idx"
        ON "ClassifiedListing" ("sellerId", "createdAt")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClassifiedMessage" (
          "id" TEXT PRIMARY KEY,
          "listingId" TEXT NOT NULL,
          "buyerId" TEXT NOT NULL,
          "senderId" TEXT NOT NULL,
          "body" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassifiedMessage_listing_buyer_created_idx"
        ON "ClassifiedMessage" ("listingId", "buyerId", "createdAt")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClassifiedMessage_buyerId_createdAt_idx"
        ON "ClassifiedMessage" ("buyerId", "createdAt")
      `);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

type ListingRow = {
  id: string;
  sellerId: string;
  category: string;
  title: string;
  description: string;
  priceIls: number;
  city: string;
  status: string;
  createdAt: Date;
  sellerName: string | null;
  contactPhone?: string | null;
};

function present(row: ListingRow, includePhone: boolean) {
  return {
    id: row.id,
    sellerId: row.sellerId,
    category: row.category,
    title: row.title,
    description: row.description,
    priceIls: row.priceIls,
    city: row.city,
    status: row.status,
    createdAt: row.createdAt,
    sellerName: publicSellerName(row.sellerName),
    ...(includePhone ? { contactPhone: row.contactPhone ?? null } : {}),
  };
}

const createSchema = z.object({
  category: z.enum(["electric_bike", "electric_scooter"]),
  title: z.string().max(80),
  description: z.string().max(700),
  priceIls: z.number().int(),
  city: z.string().max(50),
  contactPhone: z.string().max(20).optional(),
  website: z.string().max(200).optional(),
});

const statusSchema = z.object({
  status: z.enum(["sold", "removed"]),
});

export const marketplaceRouter = new Hono<Env>();

marketplaceRouter.get("/listings", async (c) => {
  const now = Date.now();
  const ip = clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"));
  if (recentCount(`list:${ip}`, 60_000, now) >= 90) {
    return c.json({ error: "network_busy" }, 429);
  }
  markHit(`list:${ip}`, now);
  const category = c.req.query("category") ?? "";
  if (category && category !== "electric_bike" && category !== "electric_scooter") {
    return c.json({ error: "bad_title" }, 400);
  }
  try {
    await ensureClassifiedTable();
    const rows = await prisma.$queryRaw<ListingRow[]>`
      SELECT l.id, l."sellerId", l.category, l.title, l.description, l."priceIls", l.city, l.status, l."createdAt",
             u.name AS "sellerName"
      FROM "ClassifiedListing" l
      JOIN "User" u ON u.id = l."sellerId"
      WHERE l.status = 'active'
        AND (${category} = '' OR l.category = ${category})
      ORDER BY l."createdAt" DESC
      LIMIT ${CLASSIFIED_LIMITS.pageSize}
    `;
    return c.json({ listings: rows.map((row) => present(row, false)) });
  } catch (error) {
    console.error("[marketplace] list failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

marketplaceRouter.get("/listings/:id", async (c) => {
  const user = c.get("user");
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  const now = Date.now();
  if (recentCount(`detail:${user.id}`, 60 * 60 * 1000, now) >= CLASSIFIED_LIMITS.maxDetailPerUserPerHour) {
    return c.json({ error: "slow_down" }, 429);
  }
  markHit(`detail:${user.id}`, now);
  try {
    await ensureClassifiedTable();
    const rows = await prisma.$queryRaw<ListingRow[]>`
      SELECT l.id, l."sellerId", l.category, l.title, l.description, l."priceIls", l.city, l.status, l."createdAt",
             l."contactPhone", u.name AS "sellerName"
      FROM "ClassifiedListing" l
      JOIN "User" u ON u.id = l."sellerId"
      WHERE l.id = ${c.req.param("id")} AND l.status = 'active'
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json({ listing: present(row, true) });
  } catch (error) {
    console.error("[marketplace] detail failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

marketplaceRouter.get("/mine", async (c) => {
  const user = c.get("user");
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  try {
    await ensureClassifiedTable();
    const rows = await prisma.$queryRaw<ListingRow[]>`
      SELECT id, "sellerId", category, title, description, "priceIls", city, status, "createdAt", "contactPhone",
             NULL::text AS "sellerName"
      FROM "ClassifiedListing"
      WHERE "sellerId" = ${user.id} AND status IN ('active', 'sold')
      ORDER BY "createdAt" DESC
      LIMIT 20
    `;
    return c.json({ listings: rows.map((row) => present(row, true)) });
  } catch (error) {
    console.error("[marketplace] mine failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

marketplaceRouter.post("/listings", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  if (cleanHoneypot(body.website)) {
    return c.json({ id: "accepted" }, 201);
  }
  const user = c.get("user");
  const checked = validateListingFields(body);
  if (!checked.ok) return c.json({ error: checked.error }, 400);
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  const now = Date.now();
  const ip = clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"));
  try {
    await ensureClassifiedTable();
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const [counts] = await prisma.$queryRaw<Array<{ active: number; day: number; last: Date | null }>>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE "createdAt" > ${since})::int AS day,
        MAX("createdAt") AS last
      FROM "ClassifiedListing"
      WHERE "sellerId" = ${user.id}
    `;
    const dupes = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ClassifiedListing"
      WHERE "createdAt" > ${weekAgo}
        AND (
          ("sellerId" = ${user.id} AND lower(title) = lower(${checked.value.title}))
          OR (
            lower(title) = lower(${checked.value.title})
            AND "priceIls" = ${checked.value.priceIls}
            AND lower(city) = lower(${checked.value.city})
            AND "createdAt" > ${since}
          )
        )
      LIMIT 1
    `;
    const last = counts?.last ? new Date(counts.last).getTime() : null;
    const decision = assessNewListing({
      role: user?.role,
      activeCount: counts?.active ?? 0,
      createdLast24h: counts?.day ?? 0,
      msSinceLast: last == null ? null : now - last,
      ipCreatesLastHour: recentCount(`create-ip:${ip}`, 60 * 60 * 1000, now),
      globalCreatesLastHour: recentCount("create-global", 60 * 60 * 1000, now),
      duplicate: dupes.length > 0,
    });
    if (!decision.ok) return c.json({ error: decision.error }, decision.status);
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ClassifiedListing"
        (id, "sellerId", category, title, description, "priceIls", city, "contactPhone", status, "createdAt", "updatedAt")
      VALUES
        (${id}, ${user!.id}, ${checked.value.category}, ${checked.value.title}, ${checked.value.description},
         ${checked.value.priceIls}, ${checked.value.city}, ${checked.value.contactPhone}, 'active', NOW(), NOW())
    `;
    markHit(`create-ip:${ip}`, now);
    markHit("create-global", now);
    return c.json({ id }, 201);
  } catch (error) {
    console.error("[marketplace] create failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

marketplaceRouter.patch("/listings/:id", zValidator("json", statusSchema), async (c) => {
  const user = c.get("user");
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  const status = c.req.valid("json").status;
  try {
    await ensureClassifiedTable();
    const updated = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "ClassifiedListing"
      SET status = ${status}, "updatedAt" = NOW()
      WHERE id = ${c.req.param("id")} AND "sellerId" = ${user.id} AND status = 'active'
      RETURNING id
    `;
    if (!updated[0]) return c.json({ error: "not_found" }, 404);
    return c.json({ id: updated[0].id, status });
  } catch (error) {
    console.error("[marketplace] update failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

const messageSchema = z.object({
  text: z.string().max(600),
  buyerId: z.string().max(64).optional(),
});

const USER_ID_RE = /^[A-Za-z0-9]{8,64}$/;
const LISTING_ID_RE = /^[A-Za-z0-9-]{8,80}$/;

marketplaceRouter.get("/conversations", async (c) => {
  const user = c.get("user");
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  const requestedListing = c.req.query("listingId") ?? "";
  if (requestedListing && !LISTING_ID_RE.test(requestedListing)) return c.json({ error: "not_found" }, 404);
  try {
    await ensureClassifiedTable();
    const rows = await prisma.$queryRaw<
      Array<{
        listingId: string;
        listingTitle: string;
        status: string;
        sellerId: string;
        sellerName: string | null;
        buyerId: string;
        buyerName: string | null;
        body: string;
        senderId: string;
        createdAt: Date;
      }>
    >`
      SELECT DISTINCT ON (m."listingId", m."buyerId")
        m."listingId" AS "listingId",
        l.title AS "listingTitle",
        l.status AS "status",
        l."sellerId" AS "sellerId",
        seller.name AS "sellerName",
        m."buyerId" AS "buyerId",
        buyer.name AS "buyerName",
        m.body,
        m."senderId" AS "senderId",
        m."createdAt" AS "createdAt"
      FROM "ClassifiedMessage" m
      JOIN "ClassifiedListing" l ON l.id = m."listingId"
      JOIN "User" seller ON seller.id = l."sellerId"
      JOIN "User" buyer ON buyer.id = m."buyerId"
      WHERE l."sellerId" = ${user.id} OR m."buyerId" = ${user.id}
      ORDER BY m."listingId", m."buyerId", m."createdAt" DESC
    `;
    const conversations = rows
      .map((row) => presentConversation({ userId: user.id, ...row }))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .filter((row) => !requestedListing || row.listingId === requestedListing)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 80);
    return c.json({ conversations });
  } catch (error) {
    console.error("[marketplace] conversations failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

async function loadListingParty(id: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; sellerId: string; status: string }>>`
    SELECT id, "sellerId", status
    FROM "ClassifiedListing"
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

marketplaceRouter.get("/listings/:id/inbox", async (c) => {
  const user = c.get("user");
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  try {
    await ensureClassifiedTable();
    const listing = await loadListingParty(c.req.param("id"));
    if (!listing || listing.sellerId !== user.id) return c.json({ error: "not_found" }, 404);
    const rows = await prisma.$queryRaw<Array<{ buyerId: string; buyerName: string | null; body: string; createdAt: Date }>>`
      SELECT DISTINCT ON (m."buyerId")
        m."buyerId" AS "buyerId",
        u.name AS "buyerName",
        m.body,
        m."createdAt" AS "createdAt"
      FROM "ClassifiedMessage" m
      JOIN "User" u ON u.id = m."buyerId"
      WHERE m."listingId" = ${listing.id}
      ORDER BY m."buyerId", m."createdAt" DESC
    `;
    const threads = rows
      .map((row) => ({
        buyerId: row.buyerId,
        buyerName: publicSellerName(row.buyerName),
        body: row.body,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ threads });
  } catch (error) {
    console.error("[marketplace] inbox failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

marketplaceRouter.get("/listings/:id/messages", async (c) => {
  const user = c.get("user");
  if (!user?.id) return c.json({ error: "sign_in_required" }, 401);
  const requestedBuyer = c.req.query("buyerId") ?? null;
  if (requestedBuyer && !USER_ID_RE.test(requestedBuyer)) return c.json({ error: "not_found" }, 404);
  try {
    await ensureClassifiedTable();
    const listing = await loadListingParty(c.req.param("id"));
    if (!listing) return c.json({ error: "not_found" }, 404);
    const party = classifyMessageParty({
      userId: user.id,
      sellerId: listing.sellerId,
      buyerId: user.id === listing.sellerId ? requestedBuyer : user.id,
    });
    if (party === "guest") return c.json({ error: "sign_in_required" }, 401);
    if (party !== "buyer" && party !== "seller") return c.json({ error: "own_listing" }, 403);
    const buyerId = party === "seller" ? requestedBuyer : user.id;
    if (!buyerId) return c.json({ error: "own_listing" }, 403);
    const rows = await prisma.$queryRaw<Array<{ id: string; body: string; senderId: string; senderName: string | null; createdAt: Date }>>`
      SELECT m.id, m.body, m."senderId", u.name AS "senderName", m."createdAt"
      FROM "ClassifiedMessage" m
      JOIN "User" u ON u.id = m."senderId"
      WHERE m."listingId" = ${listing.id} AND m."buyerId" = ${buyerId}
      ORDER BY m."createdAt" ASC
      LIMIT 100
    `;
    return c.json({
      messages: rows.map((row) => ({
        id: row.id,
        body: row.body,
        senderName: publicSellerName(row.senderName),
        createdAt: row.createdAt,
        mine: row.senderId === user.id,
      })),
    });
  } catch (error) {
    console.error("[marketplace] messages failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

marketplaceRouter.post("/listings/:id/messages", zValidator("json", messageSchema), async (c) => {
  const user = c.get("user");
  if (!user?.id || !user.role) return c.json({ error: "sign_in_required" }, 401);
  const body = c.req.valid("json");
  const checked = validateClassifiedMessage(body.text);
  if (!checked.ok) return c.json({ error: checked.error }, 400);
  const now = Date.now();
  if (recentCount(`msg:${user.id}`, 60 * 60 * 1000, now) >= CLASSIFIED_LIMITS.maxMessagesPerUserPerHour) {
    return c.json({ error: "slow_down" }, 429);
  }
  try {
    await ensureClassifiedTable();
    const listing = await loadListingParty(c.req.param("id"));
    if (!listing || listing.status !== "active") return c.json({ error: "not_found" }, 404);
    const requestedBuyer = body.buyerId && USER_ID_RE.test(body.buyerId) ? body.buyerId : null;
    const party = classifyMessageParty({
      userId: user.id,
      sellerId: listing.sellerId,
      buyerId: user.id === listing.sellerId ? requestedBuyer : user.id,
    });
    if (party !== "buyer" && party !== "seller") return c.json({ error: "own_listing" }, 403);
    const buyerId = party === "seller" ? requestedBuyer : user.id;
    if (!buyerId) return c.json({ error: "own_listing" }, 403);
    if (party === "seller") {
      const prior = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "ClassifiedMessage"
        WHERE "listingId" = ${listing.id} AND "buyerId" = ${buyerId}
        LIMIT 1
      `;
      if (!prior[0]) return c.json({ error: "not_found" }, 404);
    }
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ClassifiedMessage" (id, "listingId", "buyerId", "senderId", body, "createdAt")
      VALUES (${id}, ${listing.id}, ${buyerId}, ${user.id}, ${checked.value}, NOW())
    `;
    markHit(`msg:${user.id}`, now);
    return c.json({ id }, 201);
  } catch (error) {
    console.error("[marketplace] send message failed", error);
    return c.json({ error: "unavailable" }, 503);
  }
});

function cleanHoneypot(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}
