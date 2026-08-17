import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client — critical with bun --hot / multiple imports.
 * Without this, each reload opens new connections and Supabase session pooler
 * hits: FATAL max clients reached (pool_size: 15).
 */
const globalForPrisma = globalThis as unknown as { __ebikePrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__ebikePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

globalForPrisma.__ebikePrisma = prisma;
