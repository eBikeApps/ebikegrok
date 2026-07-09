import { prisma } from "../prisma";

export type SavedAddressRow = {
  id: string;
  label: string;
  city: string;
  street: string;
  houseNumber: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
};

function parseJsonAddresses(value: unknown): SavedAddressRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as SavedAddressRow[];
}

/** Read saved addresses via raw SQL — works even when Prisma client is out of sync. */
export async function fetchUserSavedAddresses(userId: string): Promise<SavedAddressRow[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ savedAddresses: unknown }>>`
      SELECT "savedAddresses" FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    return parseJsonAddresses(rows[0]?.savedAddresses);
  } catch (err) {
    console.warn("[SavedAddresses] fetch fallback (column may be missing):", err);
    return [];
  }
}

export async function writeUserSavedAddresses(
  userId: string,
  addresses: SavedAddressRow[]
): Promise<void> {
  const json = JSON.stringify(addresses);
  await prisma.$executeRaw`
    UPDATE "User" SET "savedAddresses" = ${json}::jsonb, "updatedAt" = NOW() WHERE id = ${userId}
  `;
}