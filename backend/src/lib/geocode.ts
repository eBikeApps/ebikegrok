export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
};

export function buildIsraeliAddress(params: {
  city: string;
  street: string;
  houseNumber?: string;
}): string {
  const city = params.city.trim();
  const street = params.street.trim();
  const houseNumber = params.houseNumber?.trim();
  const streetLine = houseNumber ? `${street} ${houseNumber}` : street;
  return `${streetLine}, ${city}, Israel`;
}

/** Multiple query strings — improves match rate for Israeli addresses in Google Geocoding. */
export function buildIsraeliAddressVariants(params: {
  city: string;
  street: string;
  houseNumber?: string;
}): string[] {
  const city = params.city.trim();
  const street = params.street.trim();
  const houseNumber = params.houseNumber?.trim();
  const variants = new Set<string>();

  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length >= 3) variants.add(trimmed);
  };

  if (houseNumber) {
    add(`${street} ${houseNumber}, ${city}, Israel`);
    add(`${street} ${houseNumber}, ${city}, ישראל`);
    add(`${houseNumber} ${street}, ${city}, Israel`);
    if (!street.startsWith("רחוב") && !street.startsWith("שדרות")) {
      add(`רחוב ${street} ${houseNumber}, ${city}, ישראל`);
      add(`שדרות ${street} ${houseNumber}, ${city}, ישראל`);
    }
  }

  add(`${street}, ${city}, Israel`);
  add(`${street}, ${city}, ישראל`);

  if (houseNumber) {
    add(`${city}, ${street} ${houseNumber}, ישראל`);
  }

  return [...variants];
}

export function parseGeocodeResponse(data: {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
}): GeocodeResult | null {
  if (data.status !== "OK" || !data.results?.length) return null;
  const first = data.results[0];
  if (!first) return null;
  const lat = first.geometry?.location?.lat;
  const lng = first.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    latitude: lat,
    longitude: lng,
    formattedAddress: first.formatted_address,
  };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[Geocode] GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(trimmed)}` +
    `&region=il` +
    `&language=he` +
    `&key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = (await resp.json()) as Parameters<typeof parseGeocodeResponse>[0];
  return parseGeocodeResponse(data);
}

export async function geocodeStructuredAddress(params: {
  city: string;
  street: string;
  houseNumber?: string;
}): Promise<GeocodeResult | null> {
  for (const address of buildIsraeliAddressVariants(params)) {
    const result = await geocodeAddress(address);
    if (result) return result;
  }
  return null;
}