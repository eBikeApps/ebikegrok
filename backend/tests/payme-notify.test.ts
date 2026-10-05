import { describe, expect, test } from "bun:test";
import { paymeNotifyIsCaptured } from "../src/lib/payme";

describe("payme notify capture", () => {
  test("sale-complete with a transaction id is a capture", () => {
    expect(
      paymeNotifyIsCaptured({
        notify_type: "sale-complete",
        sale_status: "completed",
        payme_transaction_id: "TX1",
        payme_sale_id: "SALE1",
      })
    ).toBe(true);
  });

  test("completed sale with a transaction id is a capture even without notify_type", () => {
    expect(
      paymeNotifyIsCaptured({
        sale_status: "completed",
        payme_transaction_id: "TX1",
        payme_sale_id: "SALE1",
      })
    ).toBe(true);
  });

  test("opening checkout or a bare success flag is not a capture", () => {
    expect(paymeNotifyIsCaptured({ status: "success", success: true, payme_sale_id: "SALE1" })).toBe(false);
    expect(paymeNotifyIsCaptured({ status_code: 0, payme_sale_id: "SALE1", sale_status: "completed" })).toBe(false);
    expect(paymeNotifyIsCaptured({ notify_type: "sale-failure", payme_transaction_id: "TX1", sale_status: "completed" })).toBe(false);
    expect(paymeNotifyIsCaptured({ notify_type: "sale-complete", sale_status: "completed" })).toBe(false);
    expect(paymeNotifyIsCaptured(null)).toBe(false);
  });
});
