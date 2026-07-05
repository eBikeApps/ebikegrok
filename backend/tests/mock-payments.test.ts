import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  encodeMockRef,
  decodeMockRef,
  mockCheckoutUrl,
  isMockPaymentsMode,
} from "../src/lib/mock-payments";

describe("mock payments", () => {
  const origGrowUser = process.env.GROW_USER_ID;
  const origGrowPage = process.env.GROW_PAGE_CODE;
  const origMock = process.env.MOCK_PAYMENTS;
  const origTerminal = process.env.TRANZILA_TERMINAL;

  afterEach(() => {
    process.env.GROW_USER_ID = origGrowUser;
    process.env.GROW_PAGE_CODE = origGrowPage;
    process.env.MOCK_PAYMENTS = origMock;
    process.env.TRANZILA_TERMINAL = origTerminal;
  });

  test("isMockPaymentsMode when MOCK_PAYMENTS=true even if Grow keys set", () => {
    process.env.MOCK_PAYMENTS = "true";
    process.env.GROW_USER_ID = "123";
    process.env.GROW_PAGE_CODE = "456";
    expect(isMockPaymentsMode()).toBe(true);
  });

  test("isMockPaymentsMode auto when Grow not configured", () => {
    process.env.MOCK_PAYMENTS = "";
    process.env.GROW_USER_ID = "";
    process.env.GROW_PAGE_CODE = "";
    expect(isMockPaymentsMode()).toBe(true);
  });

  test("isMockPaymentsMode off when Grow configured and flag off", () => {
    process.env.MOCK_PAYMENTS = "";
    process.env.TRANZILA_TERMINAL = "";
    process.env.GROW_USER_ID = "123";
    process.env.GROW_PAGE_CODE = "456";
    expect(isMockPaymentsMode()).toBe(false);
  });

  test("isMockPaymentsMode off when Tranzila configured and flag off", () => {
    process.env.MOCK_PAYMENTS = "";
    process.env.TRANZILA_TERMINAL = "myterminal";
    process.env.GROW_USER_ID = "";
    process.env.GROW_PAGE_CODE = "";
    expect(isMockPaymentsMode()).toBe(false);
  });

  test("encode/decode mock ref roundtrip", () => {
    const ref = encodeMockRef("abc123", "job");
    expect(ref).toBe("mock:job:abc123");
    expect(decodeMockRef(ref)).toEqual({ kind: "job", token: "abc123" });
  });

  test("mockCheckoutUrl builds backend checkout link", () => {
    const url = mockCheckoutUrl("http://localhost:3001", "tok99", "job");
    expect(url).toContain("/api/payments/mock/checkout");
    expect(url).toContain("token=tok99");
    expect(url).toContain("kind=job");
  });
});