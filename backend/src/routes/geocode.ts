import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { buildIsraeliAddress, geocodeAddress } from "../lib/geocode";

const geocodeQuerySchema = z.object({
  address: z.string().min(3).max(300).optional(),
  city: z.string().min(1).max(100).optional(),
  street: z.string().min(1).max(120).optional(),
  houseNumber: z.string().max(20).optional(),
});

const geocodeRouter = new Hono();

geocodeRouter.get("/", zValidator("query", geocodeQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const address =
    query.address?.trim() ||
    (query.city && query.street
      ? buildIsraeliAddress({
          city: query.city,
          street: query.street,
          houseNumber: query.houseNumber,
        })
      : "");

  if (!address) {
    return c.json({ error: "Missing address" }, 400);
  }

  try {
    const result = await geocodeAddress(address);
    if (!result) {
      return c.json({ error: "Address not found", address }, 404);
    }
    return c.json({
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress ?? address,
      address,
    });
  } catch (err) {
    console.error("[Geocode] error:", err);
    return c.json({ error: "Geocoding failed" }, 500);
  }
});

export { geocodeRouter };