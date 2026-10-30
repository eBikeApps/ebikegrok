import { describe, expect, test } from "bun:test";
import { classifiedListingAdminAlert, classifiedMessagePush } from "../src/lib/classifieds";

const thread = {
  senderName: "דנה כהן",
  sellerId: "seller",
  buyerId: "buyer",
  listingId: "listing-1",
  listingTitle: "שיאומי",
  body: "  עדיין למכירה?  ",
};

describe("second-hand listing alert for admin", () => {
  test("names the board and nothing about the listing or the person", () => {
    expect(classifiedListingAdminAlert()).toEqual({
      title: "יד שנייה",
      body: "מודעה חדשה עלתה ללוח",
    });
    expect(Object.keys(classifiedListingAdminAlert())).toEqual(["title", "body"]);
  });
});

describe("second-hand message push", () => {
  test("a buyer message notifies the seller and opens that thread", () => {
    const push = classifiedMessagePush({ ...thread, senderId: "buyer" });
    expect(push?.recipientId).toBe("seller");
    expect(push?.title).toBe("דנה");
    expect(push?.body).toBe("עדיין למכירה?");
    expect(push?.data).toMatchObject({
      screen: "marketplace-chat",
      listingId: "listing-1",
      buyerId: "buyer",
      role: "seller",
      peerName: "דנה",
      listingTitle: "שיאומי",
      thread: "1",
      open: "1",
    });
  });

  test("a seller reply notifies the buyer", () => {
    const push = classifiedMessagePush({
      ...thread,
      senderId: "seller",
      senderName: "יוסי לוי",
      body: "כן, אפשר היום",
    });
    expect(push?.recipientId).toBe("buyer");
    expect(push?.title).toBe("יוסי");
    expect(push?.data.role).toBe("buyer");
    expect(push?.data.buyerId).toBe("buyer");
  });

  test("the sender is never notified", () => {
    expect(
      classifiedMessagePush({
        ...thread,
        senderId: "buyer",
        sellerId: "buyer",
        buyerId: "buyer",
      })
    ).toBeNull();
    expect(
      classifiedMessagePush({
        ...thread,
        senderId: "stranger",
      })
    ).toBeNull();
  });

  test("a name that is an email address stays off the banner", () => {
    const push = classifiedMessagePush({
      ...thread,
      senderId: "buyer",
      senderName: "dana@example.com",
    });
    expect(push?.title).toBe("הודעה חדשה");
    expect(push?.data.peerName).toBe("");
  });
});
