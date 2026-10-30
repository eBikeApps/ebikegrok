export const CLASSIFIED_LIMITS = {
  maxActive: 5,
  maxPerDay: 3,
  minGapMs: 10 * 60 * 1000,
  maxPerIpPerHour: 6,
  maxGlobalPerHour: 30,
  maxDetailPerUserPerHour: 20,
  maxMessagesPerUserPerHour: 40,
  pageSize: 20,
  minPrice: 100,
  maxPrice: 60_000,
} as const;

export type ClassifiedCategory = "electric_bike" | "electric_scooter";

export type ListingErrorCode =
  | "sign_in_required"
  | "customers_only"
  | "own_listing"
  | "bad_message"
  | "too_many_active"
  | "daily_limit"
  | "slow_down"
  | "network_busy"
  | "board_full"
  | "duplicate"
  | "bad_title"
  | "bad_description"
  | "bad_price"
  | "bad_city"
  | "bad_phone"
  | "bad_photo"
  | "links_forbidden";

const URL_RE = /(?:https?:\/\/|www\.)/i;
const SUPABASE_PHOTO_RE =
  /^https:\/\/[a-z0-9]{8,40}\.supabase\.co\/storage\/v1\/object\/public\/[a-z0-9_-]{1,40}\/[A-Za-z0-9/_-]{8,240}\.(?:jpe?g|png|webp)$/i;
const OWN_UPLOAD_RE =
  /^https:\/\/ebikel-backend\.onrender\.com\/api\/uploads\/[A-Za-z0-9-]{8,80}\.(?:jpe?g|png|webp)$/i;
const PHONE_RE = /^05\d{8}$/;
const CITY_RE = /^[\p{L}][\p{L}\s'’.-]{1,39}$/u;
const REPEAT_RE = /(.)\1{6,}/u;

export type NormalizedListing = {
  category: ClassifiedCategory;
  title: string;
  description: string;
  priceIls: number;
  city: string;
  contactPhone: string | null;
};

export function cleanListingText(value: string): string {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

export function publicSellerName(name: string | null | undefined): string | null {
  const first = cleanListingText(name ?? "").split(" ")[0] ?? "";
  if (!first || first.includes("@") || first.length > 24) return null;
  return first;
}

function textProblem(value: string): ListingErrorCode | null {
  if (URL_RE.test(value)) return "links_forbidden";
  if (REPEAT_RE.test(value)) return "bad_description";
  return null;
}

export function validateListingFields(input: {
  category: string;
  title: string;
  description: string;
  priceIls: number;
  city: string;
  contactPhone?: string | null;
}): { ok: true; value: NormalizedListing } | { ok: false; error: ListingErrorCode } {
  if (input.category !== "electric_bike" && input.category !== "electric_scooter") {
    return { ok: false, error: "bad_title" };
  }
  const title = cleanListingText(input.title);
  const description = cleanListingText(input.description);
  const city = cleanListingText(input.city);
  const titleIssue = textProblem(title);
  if (titleIssue === "links_forbidden") return { ok: false, error: "links_forbidden" };
  if (title.length < 4 || title.length > 70 || !/\p{L}/u.test(title) || REPEAT_RE.test(title)) {
    return { ok: false, error: "bad_title" };
  }
  const descriptionIssue = textProblem(description);
  if (descriptionIssue === "links_forbidden") return { ok: false, error: "links_forbidden" };
  if (description.length < 9 || description.length > 600 || descriptionIssue) {
    return { ok: false, error: "bad_description" };
  }
  if (description.toLowerCase() === title.toLowerCase()) {
    return { ok: false, error: "bad_description" };
  }
  if (!Number.isInteger(input.priceIls) || input.priceIls < CLASSIFIED_LIMITS.minPrice || input.priceIls > CLASSIFIED_LIMITS.maxPrice) {
    return { ok: false, error: "bad_price" };
  }
  if (!CITY_RE.test(city)) return { ok: false, error: "bad_city" };
  const phoneRaw = cleanListingText(input.contactPhone ?? "").replace(/[\s-]/g, "");
  if (phoneRaw && !PHONE_RE.test(phoneRaw)) return { ok: false, error: "bad_phone" };
  return {
    ok: true,
    value: {
      category: input.category,
      title,
      description,
      priceIls: input.priceIls,
      city,
      contactPhone: phoneRaw || null,
    },
  };
}

export function assessNewListing(input: {
  role: string | null | undefined;
  activeCount: number;
  createdLast24h: number;
  msSinceLast: number | null;
  ipCreatesLastHour: number;
  globalCreatesLastHour: number;
  duplicate: boolean;
}): { ok: true } | { ok: false; status: 401 | 403 | 409 | 429; error: ListingErrorCode } {
  if (!input.role) return { ok: false, status: 401, error: "sign_in_required" };
  if (input.duplicate) return { ok: false, status: 409, error: "duplicate" };
  if (input.activeCount >= CLASSIFIED_LIMITS.maxActive) {
    return { ok: false, status: 429, error: "too_many_active" };
  }
  if (input.createdLast24h >= CLASSIFIED_LIMITS.maxPerDay) {
    return { ok: false, status: 429, error: "daily_limit" };
  }
  if (input.msSinceLast != null && input.msSinceLast < CLASSIFIED_LIMITS.minGapMs) {
    return { ok: false, status: 429, error: "slow_down" };
  }
  if (input.ipCreatesLastHour >= CLASSIFIED_LIMITS.maxPerIpPerHour) {
    return { ok: false, status: 429, error: "network_busy" };
  }
  if (input.globalCreatesLastHour >= CLASSIFIED_LIMITS.maxGlobalPerHour) {
    return { ok: false, status: 429, error: "board_full" };
  }
  return { ok: true };
}

/** A listing photo is optional. A supplied address must be a picture we stored. */
export function validateListingPhoto(
  value: string | null | undefined
): { ok: true; value: string | null } | { ok: false; error: "bad_photo" } {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > 400 || raw.includes("..") || raw.includes("\\") || raw.includes("?")) {
    return { ok: false, error: "bad_photo" };
  }
  if (SUPABASE_PHOTO_RE.test(raw) || OWN_UPLOAD_RE.test(raw)) return { ok: true, value: raw };
  return { ok: false, error: "bad_photo" };
}

export function validateClassifiedMessage(
  text: string
): { ok: true; value: string } | { ok: false; error: "bad_message" | "links_forbidden" } {
  const value = cleanListingText(text);
  if (!value || value.length > 500 || REPEAT_RE.test(value)) return { ok: false, error: "bad_message" };
  if (URL_RE.test(value)) return { ok: false, error: "links_forbidden" };
  return { ok: true, value };
}

export type ClassifiedMessagePush = {
  recipientId: string;
  title: string;
  body: string;
  data: {
    screen: "marketplace-chat";
    listingId: string;
    buyerId: string;
    role: "buyer" | "seller";
    listingTitle: string;
    peerName: string;
    thread: "1";
    open: "1";
  };
};

/** Lock-screen alert for the other person in a second-hand thread. Never the sender. */
export function classifiedMessagePush(input: {
  senderId: string;
  senderName: string | null;
  sellerId: string;
  buyerId: string;
  listingId: string;
  listingTitle: string;
  body: string;
}): ClassifiedMessagePush | null {
  if (!input.senderId || !input.buyerId || !input.sellerId || !input.listingId) return null;
  if (input.senderId !== input.sellerId && input.senderId !== input.buyerId) return null;
  const recipientId = input.senderId === input.sellerId ? input.buyerId : input.sellerId;
  if (!recipientId || recipientId === input.senderId) return null;
  const peer = publicSellerName(input.senderName);
  const title = peer ?? "הודעה חדשה";
  const listingTitle = cleanListingText(input.listingTitle).slice(0, 70);
  const body = cleanListingText(input.body).slice(0, 80) || listingTitle || title;
  return {
    recipientId,
    title,
    body,
    data: {
      screen: "marketplace-chat",
      listingId: input.listingId,
      buyerId: input.buyerId,
      role: recipientId === input.sellerId ? "seller" : "buyer",
      listingTitle,
      peerName: peer ?? "",
      thread: "1",
      open: "1",
    },
  };
}

export type ClassifiedConversationView = {
  listingId: string;
  listingTitle: string;
  buyerId: string;
  peerName: string | null;
  role: "buyer" | "seller";
  status: string;
  body: string;
  createdAt: Date | string;
  mine: boolean;
};

/** One inbox row. The signed-in person sees the other party's first name. */
export function presentConversation(input: {
  userId: string;
  listingId: string;
  listingTitle: string;
  status: string;
  sellerId: string;
  sellerName: string | null;
  buyerId: string;
  buyerName: string | null;
  body: string;
  senderId: string;
  createdAt: Date | string;
}): ClassifiedConversationView | null {
  const role = input.userId === input.sellerId ? "seller" : input.userId === input.buyerId ? "buyer" : null;
  if (!role) return null;
  return {
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    buyerId: input.buyerId,
    status: input.status,
    peerName: publicSellerName(role === "seller" ? input.buyerName : input.sellerName),
    role,
    body: input.body,
    createdAt: input.createdAt,
    mine: input.senderId === input.userId,
  };
}

/** A signed-in person messages the seller. The seller replies only inside that thread. */
export function classifyMessageParty(input: {
  userId: string | null;
  sellerId: string;
  buyerId: string | null;
}): "guest" | "buyer" | "seller" | "refuse" {
  if (!input.userId) return "guest";
  if (input.userId === input.sellerId) {
    if (!input.buyerId || input.buyerId === input.sellerId) return "refuse";
    return "seller";
  }
  if (input.buyerId && input.buyerId !== input.userId) return "refuse";
  return "buyer";
}
