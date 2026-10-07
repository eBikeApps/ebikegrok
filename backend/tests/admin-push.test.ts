import { describe, expect, test } from "bun:test";
import { isExpoPushToken } from "../src/lib/admin-push";

describe("admin push token", () => {
  test("accepts an Expo token", () => {
    expect(isExpoPushToken("ExponentPushToken[abcdef123456]")).toBe(true);
  });

  test("rejects empty, short, and foreign tokens", () => {
    expect(isExpoPushToken("")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
    expect(isExpoPushToken("not-a-token")).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
  });
});
