import { z } from "zod";
import { REPAIR_CATEGORY_KEYS } from "./repair-pricing";

const createJobBaseSchema = z.object({
  technicianId: z.string().optional(),
  photoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  description: z.string().max(1000).optional(),
  problemDescription: z.string().max(500).optional(),
  bikeType: z.enum(["regular", "electric"]),
  /** Comma-separated legacy field — server also accepts `categories` array */
  category: z.string().max(500).optional(),
  categories: z.array(z.enum(REPAIR_CATEGORY_KEYS)).min(1).max(10).optional(),
  /** Ignored if sent — server computes authoritative pricing */
  estimatedPriceMin: z.number().min(0).max(50000).optional(),
  estimatedPriceMax: z.number().min(0).max(50000).optional(),
  customerLocationLat: z.number().min(-90).max(90),
  customerLocationLng: z.number().min(-180).max(180),
  customerAddress: z.string().max(300).optional(),
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: z.string().min(7).max(20).optional(),
});

export const createJobSchema = createJobBaseSchema.refine(
  (data) => (data.categories?.length ?? 0) > 0 || !!data.category?.trim(),
  { message: "At least one repair category is required" }
);

export type CreateJobInput = z.infer<typeof createJobBaseSchema>;