import { describe, expect, test } from "bun:test";
import { discoveryRadiusKm } from "./service-radius";

describe("discoveryRadiusKm", () => {
  test("replaces the old 40 km floor with 15 km", () => {
    expect(discoveryRadiusKm(null)).toBe(15);
    expect(discoveryRadiusKm(undefined)).toBe(15);
    expect(discoveryRadiusKm(40)).toBe(15);
    expect(discoveryRadiusKm(0)).toBe(15);
    expect(discoveryRadiusKm(8)).toBe(15);
  });

  test("keeps a radius the technician set above 15 km", () => {
    expect(discoveryRadiusKm(15)).toBe(15);
    expect(discoveryRadiusKm(25)).toBe(25);
  });
});
