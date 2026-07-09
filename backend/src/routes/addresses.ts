import { Hono } from "hono";
import { randomUUID } from "crypto";
import {
  fetchUserSavedAddresses,
  writeUserSavedAddresses,
  type SavedAddressRow,
} from "../lib/saved-addresses-db";

type AddressEnv = {
  Variables: {
    user: { id: string } | null;
  };
};

export type SavedAddressRecord = SavedAddressRow & {
  latitude: number;
  longitude: number;
};

function toRecord(row: SavedAddressRow): SavedAddressRecord | null {
  if (typeof row.latitude !== "number" || typeof row.longitude !== "number") return null;
  return row as SavedAddressRecord;
}

function parseRecords(rows: SavedAddressRow[]): SavedAddressRecord[] {
  return rows.map(toRecord).filter((a): a is SavedAddressRecord => a !== null);
}

export const addressesRouter = new Hono<AddressEnv>();

addressesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const rows = await fetchUserSavedAddresses(user.id);
  return c.json({ addresses: parseRecords(rows) });
});

addressesRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const body = await c.req.json();
  const { label, city, street, houseNumber, latitude, longitude, isDefault } = body;

  if (!city?.trim() || !street?.trim() || !houseNumber?.trim()) {
    return c.json({ message: "city, street and houseNumber are required" }, 400);
  }
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return c.json({ message: "latitude and longitude are required" }, 400);
  }

  const existing = parseRecords(await fetchUserSavedAddresses(user.id));
  const newAddr: SavedAddressRecord = {
    id: randomUUID(),
    label: (label ?? "בית").trim(),
    city: city.trim(),
    street: street.trim(),
    houseNumber: String(houseNumber).trim(),
    latitude,
    longitude,
    isDefault: !!isDefault,
  };

  let updated = [...existing, newAddr];
  if (newAddr.isDefault) {
    updated = updated.map((a) => ({ ...a, isDefault: a.id === newAddr.id }));
  }

  try {
    await writeUserSavedAddresses(user.id, updated);
  } catch (err) {
    console.error("[Addresses] write failed:", err);
    return c.json({ message: "Could not save address" }, 500);
  }

  return c.json({ address: newAddr, addresses: updated });
});

addressesRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = parseRecords(await fetchUserSavedAddresses(user.id));
  const idx = existing.findIndex((a) => a.id === id);
  if (idx < 0) return c.json({ message: "Address not found" }, 404);

  const current = existing[idx]!;
  const merged: SavedAddressRecord = {
    id: current.id,
    label: typeof body.label === "string" ? body.label.trim() : current.label,
    city: typeof body.city === "string" ? body.city.trim() : current.city,
    street: typeof body.street === "string" ? body.street.trim() : current.street,
    houseNumber: body.houseNumber != null ? String(body.houseNumber).trim() : current.houseNumber,
    latitude: typeof body.latitude === "number" ? body.latitude : current.latitude,
    longitude: typeof body.longitude === "number" ? body.longitude : current.longitude,
    isDefault: typeof body.isDefault === "boolean" ? body.isDefault : current.isDefault,
  };

  let updated = existing.map((a, i) => (i === idx ? merged : a));
  if (merged.isDefault) {
    updated = updated.map((a) => ({ ...a, isDefault: a.id === merged.id }));
  }

  try {
    await writeUserSavedAddresses(user.id, updated);
  } catch (err) {
    console.error("[Addresses] update failed:", err);
    return c.json({ message: "Could not update address" }, 500);
  }

  return c.json({ address: merged, addresses: updated });
});

addressesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");
  const existing = parseRecords(await fetchUserSavedAddresses(user.id));
  const updated = existing.filter((a) => a.id !== id);
  if (updated.length === existing.length) {
    return c.json({ message: "Address not found" }, 404);
  }

  try {
    await writeUserSavedAddresses(user.id, updated);
  } catch (err) {
    console.error("[Addresses] delete failed:", err);
    return c.json({ message: "Could not delete address" }, 500);
  }

  return c.json({ addresses: updated });
});