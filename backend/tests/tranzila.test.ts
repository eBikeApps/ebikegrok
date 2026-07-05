import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  buildTranzilaIframeFields,
  decodeTranzilaRef,
  encodeTranzilaRef,
  isTranzilaConfigured,
  isTranzilaSuccessResponse,
  parseTranzilaPayload,
  tranzilaCheckoutUrl,
} from "../src/lib/tranzila";
import { getActivePaymentProvider } from "../src/lib/mock-payments";

describe("tranzila payments", () => {
  const origTerminal = process.env.TRANZILA_TERMINAL;
  const origMock = process.env.MOCK_PAYMENTS;
  const origGrowUser = process.env.GROW_USER_ID;
  const origGrowPage = process.env.GROW_PAGE_CODE;

  afterEach(() => {
    process.env.TRANZILA_TERMINAL = origTerminal;
    process.env.MOCK_PAYMENTS = origMock;
    process.env.GROW_USER_ID = origGrowUser;
    process.env.GROW_PAGE_CODE = origGrowPage;
  });

  test("isTranzilaConfigured when terminal set", () => {
    process.env.TRANZILA_TERMINAL = "myterminal";
    expect(isTranzilaConfigured()).toBe(true);
  });

  test("encode/decode tranzila ref roundtrip", () => {
    const ref = encodeTranzilaRef("abc123", "job");
    expect(ref).toBe("tz:job:abc123");
    expect(decodeTranzilaRef(ref)).toEqual({ kind: "job", token: "abc123" });
  });

  test("tranzilaCheckoutUrl builds backend bridge link", () => {
    const url = tranzilaCheckoutUrl("http://localhost:3001", "tok99");
    expect(url).toContain("/api/payments/tranzila/checkout");
    expect(url).toContain("token=tok99");
  });

  test("buildTranzilaIframeFields includes notify and success urls", () => {
    const fields = buildTranzilaIframeFields({
      amount: 150,
      description: "תיקון אופניים #123",
      backendUrl: "http://localhost:3001",
      jobId: "job-1",
      kind: "job",
      entityId: "job-1",
      checkoutToken: "tok123",
      customerEmail: "a@abc.com",
      customerName: "Test User",
    });

    expect(fields.sum).toBe("150");
    expect(fields.currency).toBe("1");
    expect(fields.tranmode).toBe("A");
    expect(fields.success_url_address).toContain("/api/payments/success?jobId=job-1");
    expect(fields.fail_url_address).toContain("/api/payments/cancel?jobId=job-1");
    expect(fields.notify_url_address).toContain("/api/payments/tranzila/notify");
    expect(fields.DCdisable).toBe("tok123");
    expect(fields.remarks).toBe("job:job-1");
  });

  test("parseTranzilaPayload reads success response", () => {
    const payload = parseTranzilaPayload({
      Response: "000",
      transaction_id: "41044",
      sum: "150",
      DCdisable: "tok123",
      remarks: "job:job-1",
    });

    expect(payload.responseCode).toBe("000");
    expect(payload.transactionId).toBe("41044");
    expect(payload.amount).toBe(150);
    expect(payload.checkoutToken).toBe("tok123");
    expect(payload.kind).toBe("job");
    expect(payload.entityId).toBe("job-1");
    expect(isTranzilaSuccessResponse(payload.responseCode)).toBe(true);
  });

  test("getActivePaymentProvider prefers tranzila over grow", () => {
    process.env.MOCK_PAYMENTS = "";
    process.env.TRANZILA_TERMINAL = "myterminal";
    process.env.GROW_USER_ID = "123";
    process.env.GROW_PAGE_CODE = "456";
    expect(getActivePaymentProvider()).toBe("tranzila");
  });
});