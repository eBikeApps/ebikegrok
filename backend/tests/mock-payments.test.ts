import { describe, test, expect, afterEach } from "bun:test";
import {
  encodeMockRef,
  decodeMockRef,
  mockCheckoutUrl,
  isMockPaymentsMode,
  getActivePaymentProvider,
} from "../src/lib/mock-payments";

describe("mock payments", () => {
  const origMock = process.env.MOCK_PAYMENTS;

  afterEach(() => {
    process.env.MOCK_PAYMENTS = origMock;
  });

  test("isMockPaymentsMode when MOCK_PAYMENTS=true", () => {
    process.env.MOCK_PAYMENTS = "true";
    expect(isMockPaymentsMode()).toBe(true);
  });

  test("isMockPaymentsMode off when MOCK_PAYMENTS=false", () => {
    process.env.MOCK_PAYMENTS = "false";
    expect(isMockPaymentsMode()).toBe(false);
  });

  test("isMockPaymentsMode defaults to true when unset", () => {
    process.env.MOCK_PAYMENTS = "";
    expect(isMockPaymentsMode()).toBe(true);
  });

  test("getActivePaymentProvider always returns mock", () => {
    expect(getActivePaymentProvider()).toBe("mock");
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