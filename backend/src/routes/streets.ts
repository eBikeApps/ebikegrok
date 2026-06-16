import { Hono } from "hono";

const streetsRouter = new Hono();

// In-memory cache: city -> streets[], expires after 24h
const cache = new Map<string, { streets: string[]; expiresAt: number }>();

// Normalize city name: trim + collapse spaces around dashes
function normalize(s: string) {
  return s.trim().replace(/\s*[-–]\s*/g, "-");
}

streetsRouter.get("/", async (c) => {
  const city = c.req.query("city");
  if (!city) return c.json({ streets: [] });

  const now = Date.now();
  const cached = cache.get(city);
  if (cached && cached.expiresAt > now) {
    return c.json({ streets: cached.streets });
  }

  try {
    const normalizedCity = normalize(city);
    // Use first word of city for q search, then filter on backend
    const searchWord = city.split(" ")[0] ?? city;
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=a7296d1a-f8c9-4b70-96c2-6ebb4352f8e3&q=${encodeURIComponent(searchWord)}&limit=5000`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json() as any;

    if (data.result?.records?.length) {
      const streets = [...new Set<string>(
        data.result.records
          .filter((r: Record<string, string>) => normalize(r["שם_ישוב"] ?? "") === normalizedCity)
          .filter((r: Record<string, string>) => r["שם_רחוב"])
          .map((r: Record<string, string>) => r["שם_רחוב"]?.trim())
          .filter(Boolean)
      )].sort() as string[];

      const ttl = streets.length > 0 ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
      cache.set(city, { streets, expiresAt: now + ttl });
      return c.json({ streets });
    }

    cache.set(city, { streets: [], expiresAt: now + 60 * 60 * 1000 });
    return c.json({ streets: [] });
  } catch (err) {
    console.error("[Streets] Fetch error:", err);
    return c.json({ streets: [] });
  }
});

export { streetsRouter };
