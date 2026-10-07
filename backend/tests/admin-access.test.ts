import { describe, expect, test } from "bun:test";
import { isAdminUser } from "../src/lib/admin-access";

describe("isAdminUser", () => {
  test("role admin is an admin", () => {
    expect(isAdminUser({ role: "admin", email: "owner@ebikel.com" })).toBe(true);
  });

  test("customer and technician are not admins by role", () => {
    expect(isAdminUser({ role: "customer", email: "a@b.com" })).toBe(false);
    expect(isAdminUser({ role: "technician", email: "a@b.com" })).toBe(false);
  });

  test("missing user is not an admin", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});
