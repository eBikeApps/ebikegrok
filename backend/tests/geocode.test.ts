import { describe, test, expect } from "bun:test";
import {
  buildIsraeliAddress,
  buildIsraeliAddressVariants,
  parseGeocodeResponse,
} from "../src/lib/geocode";

describe("geocode helpers", () => {
  test("buildIsraeliAddress combines street, house number and city", () => {
    expect(
      buildIsraeliAddress({
        city: "תל אביב - יפו",
        street: "דיזנגוף",
        houseNumber: "12",
      })
    ).toBe("דיזנגוף 12, תל אביב - יפו, Israel");
  });

  test("parseGeocodeResponse reads first Google result", () => {
    const result = parseGeocodeResponse({
      status: "OK",
      results: [
        {
          formatted_address: "Dizengoff St 12, Tel Aviv",
          geometry: { location: { lat: 32.08, lng: 34.78 } },
        },
      ],
    });

    expect(result).toEqual({
      latitude: 32.08,
      longitude: 34.78,
      formattedAddress: "Dizengoff St 12, Tel Aviv",
    });
  });

  test("parseGeocodeResponse returns null for zero results", () => {
    expect(parseGeocodeResponse({ status: "ZERO_RESULTS", results: [] })).toBeNull();
  });

  test("buildIsraeliAddressVariants includes Hebrew and street-prefix fallbacks", () => {
    const variants = buildIsraeliAddressVariants({
      city: "רמת גן",
      street: "ביאליק",
      houseNumber: "12",
    });
    expect(variants).toContain("ביאליק 12, רמת גן, Israel");
    expect(variants.some((v) => v.includes("ישראל"))).toBe(true);
    expect(variants.some((v) => v.startsWith("רחוב"))).toBe(true);
  });
});