import { describe, test, expect } from "bun:test";
import { formatJobReference, parseJobReference, withJobReference } from "../src/lib/job-reference";

describe("job reference", () => {
  test("formatJobReference pads to 6 digits", () => {
    expect(formatJobReference(1006)).toBe("EB-001006");
    expect(formatJobReference(42)).toBe("EB-000042");
  });

  test("parseJobReference accepts EB- prefix variants", () => {
    expect(parseJobReference("EB-001006")).toBe(1006);
    expect(parseJobReference("eb001006")).toBe(1006);
    expect(parseJobReference("invalid")).toBeNull();
  });

  test("withJobReference adds jobReference field", () => {
    const job = { id: "x", jobNumber: 7, status: "pending" };
    expect(withJobReference(job).jobReference).toBe("EB-000007");
  });
});