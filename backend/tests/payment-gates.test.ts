import { describe, test, expect } from "bun:test";
import { canCreatePayment, canTransitionToOnWay, type JobLikeForPayment } from "../src/lib/payment-gates";

// TDD: These tests were written *before* the real guards in routes + helpers.
// They exercise the pure decision functions + will be supplemented by route-level checks.
// Run `bun test` after changes to go green.

describe("Payment after accept + on_way gate (core spec)", () => {
  test("cannot create payment for a pending job (must be after technician accepts)", () => {
    const job: JobLikeForPayment = { id: "j1", status: "pending", paymentStatus: "pending" };
    const res = canCreatePayment(job);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("accept");
  });

  test("cannot create payment for already paid job", () => {
    const job: JobLikeForPayment = { id: "j2", status: "accepted", paymentStatus: "paid" };
    const res = canCreatePayment(job);
    expect(res.ok).toBe(false);
  });

  test("can create payment only for accepted + unpaid job", () => {
    const job: JobLikeForPayment = { id: "j3", status: "accepted", paymentStatus: "pending" };
    const res = canCreatePayment(job);
    expect(res.ok).toBe(true);
  });

  test("technician cannot set on_way if customer has not paid (pay after accept, before drive)", () => {
    const job: JobLikeForPayment = { id: "j4", status: "accepted", paymentStatus: "pending" };
    const res = canTransitionToOnWay(job);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("pay");
    expect(res.error).toContain("drive");
  });

  test("technician can set on_way only after paid (atomic gate)", () => {
    const job: JobLikeForPayment = { id: "j5", status: "accepted", paymentStatus: "paid" };
    const res = canTransitionToOnWay(job);
    expect(res.ok).toBe(true);
  });

  test("on_way blocked for non-accepted states even if paid", () => {
    const job: JobLikeForPayment = { id: "j6", status: "pending", paymentStatus: "paid" };
    const res = canTransitionToOnWay(job);
    expect(res.ok).toBe(false);
  });
});

// Note: Real route tests would call the Hono app with test DB. These pure helpers + the route guards
// will make the integration behavior match. Run `bun test` to see red until impl.