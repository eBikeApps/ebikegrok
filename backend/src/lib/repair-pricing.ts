/** Server-side repair pricing — single source of truth (must match mobile PRICE_RANGES). */

export const REPAIR_CATEGORY_KEYS = [
  "front_tire_puncture",
  "rear_tire_puncture",
  "tire_tube_replacement",
  "brake_issue",
  "starts_no_drive",
  "general_electrical",
  "general_service",
] as const;

export type RepairCategoryKey = (typeof REPAIR_CATEGORY_KEYS)[number];

export type BikeType = "regular" | "electric";

/** Fixed agreed price per category (ILS). */
export const FIXED_REPAIR_PRICES: Record<
  RepairCategoryKey,
  { regular: number; electric: number }
> = {
  front_tire_puncture: { regular: 250, electric: 250 },
  rear_tire_puncture: { regular: 250, electric: 250 },
  tire_tube_replacement: { regular: 400, electric: 400 },
  brake_issue: { regular: 250, electric: 250 },
  starts_no_drive: { regular: 300, electric: 300 },
  general_electrical: { regular: 300, electric: 300 },
  general_service: { regular: 350, electric: 350 },
};

const CATEGORY_LABELS_HE: Record<RepairCategoryKey, string> = {
  front_tire_puncture: "פנצ'ר בגלגל קדמי",
  rear_tire_puncture: "פנצ'ר בגלגל אחורי",
  tire_tube_replacement: "החלפת צמיג+פנימית",
  brake_issue: "ברקסים לא עובדים",
  starts_no_drive: "נדלק ולא נוסע",
  general_electrical: "תקלת חשמל כללית",
  general_service: "טיפול כללי",
};

export function isRepairCategoryKey(value: string): value is RepairCategoryKey {
  return (REPAIR_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function parseCategoryList(input: {
  categories?: string[];
  category?: string;
}): RepairCategoryKey[] {
  const raw: string[] = [];
  if (input.categories?.length) {
    raw.push(...input.categories);
  } else if (input.category?.trim()) {
    raw.push(
      ...input.category
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  const parsed: RepairCategoryKey[] = [];
  for (const item of raw) {
    if (isRepairCategoryKey(item)) {
      if (!parsed.includes(item)) parsed.push(item);
      continue;
    }
    const byLabel = Object.entries(CATEGORY_LABELS_HE).find(([, label]) => label === item);
    if (byLabel && isRepairCategoryKey(byLabel[0]) && !parsed.includes(byLabel[0])) {
      parsed.push(byLabel[0]);
    }
  }
  return parsed;
}

/** Sum fixed prices for all selected repairs (2+ categories = combined total). */
export function computeJobPricing(
  bikeType: BikeType,
  categories: RepairCategoryKey[]
): {
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  categoryKeys: RepairCategoryKey[];
  description: string;
  category: string;
} {
  if (categories.length === 0) {
    throw new Error("INVALID_CATEGORIES");
  }

  let total = 0;
  for (const key of categories) {
    total += FIXED_REPAIR_PRICES[key][bikeType];
  }

  const labels = categories.map((k) => CATEGORY_LABELS_HE[k]);
  return {
    estimatedPriceMin: total,
    estimatedPriceMax: total,
    categoryKeys: categories,
    description: labels.join(", "),
    category: categories.join(", "),
  };
}