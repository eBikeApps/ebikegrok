import { describe, expect, test } from "bun:test";
import { reviewGate, type ReviewJobSnapshot } from "../src/lib/review-rules";

const completed: ReviewJobSnapshot = {
  customerId: "customer-1",
  technicianId: "tech-1",
  status: "completed",
};

const base = {
  role: "customer" as const,
  userId: "customer-1",
  job: completed,
  alreadyReviewed: false,
};

describe("review only after a completed repair", () => {
  test("customer can review their completed job once", () => {
    const gate = reviewGate(base);
    expect(gate.ok).toBe(true);
    if (gate.ok) expect(gate.technicianId).toBe("tech-1");
  });

  test.each([
    "pending",
    "accepted",
    "on_way",
    "arrived",
    "in_progress",
    "cancelled",
  ])("refuses status %s", (status) => {
    const gate = reviewGate({ ...base, job: { ...completed, status } });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe(400);
      expect(gate.message).toContain("אחרי שהתיקון הושלם");
    }
  });

  test("refuses a second review of the same job", () => {
    const gate = reviewGate({ ...base, alreadyReviewed: true });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.status).toBe(409);
  });

  test("refuses technicians and other customers", () => {
    expect(reviewGate({ ...base, role: "technician" }).ok).toBe(false);
    expect(reviewGate({ ...base, userId: "someone-else" }).ok).toBe(false);
    const other = reviewGate({ ...base, userId: "someone-else" });
    if (!other.ok) expect(other.status).toBe(403);
  });

  test("refuses a missing job or a completed job with no technician", () => {
    const missing = reviewGate({ ...base, job: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(404);

    const noTech = reviewGate({ ...base, job: { ...completed, technicianId: null } });
    expect(noTech.ok).toBe(false);
    if (!noTech.ok) expect(noTech.status).toBe(400);
  });
});
