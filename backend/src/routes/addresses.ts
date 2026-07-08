import { Hono } from "hono";
import { prisma } from "../prisma";
import { randomUUID } from "crypto";

type AddressEnv = {
  Variables: {
    user: { id: string } | null;
  };
};

export type SavedAddressRecord = {
  id: string;
  label: string;
  city: string;
  street: string;
  houseNumber: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
};

function parseAddresses(raw: unknown): SavedAddressRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof (a as SavedAddressRecord).id === "string" &&
      typeof (a as SavedAddressRecord).city === "string" &&
      typeof (a as SavedAddressRecord).street === "string"
  ) as SavedAddressRecord[];
}

export const addressesRouter = new Hono<AddressEnv>();

addressesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { savedAddresses: true },
  });
  return c.json({ addresses: parseAddresses(row?.savedAddresses) });
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

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { savedAddresses: true },
  });
  const existing = parseAddresses(row?.savedAddresses);
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

  await prisma.user.update({
    where: { id: user.id },
    data: { savedAddresses: updated },
  });

  return c.json({ address: newAddr, addresses: updated });
});

addressesRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");
  const body = await c.req.json();

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { savedAddresses: true },
  });
  const existing = parseAddresses(row?.savedAddresses);
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

  await prisma.user.update({
    where: { id: user.id },
    data: { savedAddresses: updated },
  });

  return c.json({ address: merged, addresses: updated });
});

addressesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);

  const id = c.req.param("id");
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { savedAddresses: true },
  });
  const existing = parseAddresses(row?.savedAddresses);
  const updated = existing.filter((a) => a.id !== id);
  if (updated.length === existing.length) {
    return c.json({ message: "Address not found" }, 404);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { savedAddresses: updated },
  });

  return c.json({ addresses: updated });
});