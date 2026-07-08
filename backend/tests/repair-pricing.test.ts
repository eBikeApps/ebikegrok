import { describe, test, expect } from "bun:test";
import {
  computeJobPricing,
  parseCategoryList,
  FIXED_REPAIR_PRICES,
} from "../src/lib/repair-pricing";

describe("repair pricing", () => {
  test("single category fixed price", () => {
    const result = computeJobPricing("electric", ["brake_issue"]);
    expect(result.estimatedPriceMin).toBe(250);
    expect(result.estimatedPriceMax).toBe(250);
  });

  test("multiple categories sum into one total", () => {
    const result = computeJobPricing("regular", [
      "brake_issue",
      "general_service",
    ]);
    expect(result.estimatedPriceMin).toBe(
      FIXED_REPAIR_PRICES.brake_issue.regular + FIXED_REPAIR_PRICES.general_service.regular
    );
    expect(result.estimatedPriceMin).toBe(result.estimatedPriceMax);
  });

  test("parseCategoryList from categories array", () => {
    expect(
      parseCategoryList({ categories: ["brake_issue", "general_service"] })
    ).toEqual(["brake_issue", "general_service"]);
  });

  test("parseCategoryList rejects unknown keys", () => {
    expect(parseCategoryList({ categories: ["brake_issue", "fake_hack"] })).toEqual([
      "brake_issue",
    ]);
  });

  test("ignores client price tampering path — only keys matter", () => {
    const keys = parseCategoryList({ category: "brake_issue, general_service" });
    const priced = computeJobPricing("electric", keys);
    expect(priced.estimatedPriceMin).toBe(600);
  });
});