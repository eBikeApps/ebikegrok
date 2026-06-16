import { describe, test, expect } from "bun:test";
import {
  decodeGrowProcessRef,
  encodeGrowProcessRef,
  extractGrowPaymentUrl,
  growApiErrorMessage,
  isGrowPaidStatus,
  normalizeGrowFullName,
  normalizeGrowPhone,
  parseGrowWebhookPayload,
} from "../src/lib/grow";

describe("Grow helpers", () => {
  test("normalizeGrowPhone formats Israeli mobile", () => {
    expect(normalizeGrowPhone("050-123-4567")).toBe("0501234567");
    expect(normalizeGrowPhone("+972501234567")).toBe("0501234567");
    expect(normalizeGrowPhone("")).toBe("0500000000");
  });

  test("normalizeGrowFullName ensures two parts", () => {
    expect(normalizeGrowFullName("דוד כהן")).toBe("דוד כהן");
    expect(normalizeGrowFullName("דוד")).toBe("דוד משתמש");
  });

  test("extractGrowPaymentUrl reads nested Grow response", () => {
    expect(
      extractGrowPaymentUrl({
        status: 1,
        data: { url: "https://secure.meshulam.co.il/pay/abc" },
      })
    ).toBe("https://secure.meshulam.co.il/pay/abc");
    expect(extractGrowPaymentUrl({ status: 0, err: { message: "fail" }, data: "" })).toBeNull();
    expect(growApiErrorMessage({ status: 0, err: { message: "fail" }, data: "" })).toBe("fail");
  });

  test("stores and decodes Grow process refs", () => {
    expect(encodeGrowProcessRef("123", "abc")).toBe("123|abc");
    expect(decodeGrowProcessRef("123|abc")).toEqual({ processId: "123", processToken: "abc" });
    expect(isGrowPaidStatus("שולם")).toBe(true);
  });

  test("parseGrowWebhookPayload supports form and JSON shapes", () => {
    const form = parseGrowWebhookPayload({
      cField1: "job123",
      cField2: "job",
      transactionCode: "TX1",
      paymentSum: "150",
    });
    expect(form.cField1).toBe("job123");
    expect(form.paymentSum).toBe(150);

    const json = parseGrowWebhookPayload({
      transactionCode: "TX2",
      paymentSum: 99,
      data: { processId: "55" },
    });
    expect(json.transactionId).toBe("TX2");
    expect(json.processId).toBe("55");
  });
});