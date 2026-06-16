import { z } from "zod";

export const createJobSchema = z.object({
  technicianId: z.string().optional(),
  photoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  description: z.string().max(1000).optional(),
  bikeType: z.enum(["regular", "electric"]),
  category: z.string().min(1).max(500),
  estimatedPriceMin: z.number().min(0).max(50000).optional(),
  estimatedPriceMax: z.number().min(0).max(50000).optional(),
  customerLocationLat: z.number().min(-90).max(90),
  customerLocationLng: z.number().min(-180).max(180),
  customerAddress: z.string().max(300).optional(),
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: z.string().min(7).max(20).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;