import { describe, test, expect } from "bun:test";

function parseJobCategories(
  category?: string | null,
  categories?: string[] | null
): string[] {
  if (Array.isArray(categories) && categories.length > 0) {
    return categories.map((c) => c.trim()).filter(Boolean);
  }
  if (!category?.trim()) return [];
  return category.split(",").map((c) => c.trim()).filter(Boolean);
}

describe("parseJobCategories", () => {
  test("splits comma-separated category string", () => {
    expect(parseJobCategories("front_tire_puncture, brake_issue")).toEqual([
      "front_tire_puncture",
      "brake_issue",
    ]);
  });

  test("prefers categories array when provided", () => {
    expect(parseJobCategories("ignored", ["general_service"])).toEqual(["general_service"]);
  });
});