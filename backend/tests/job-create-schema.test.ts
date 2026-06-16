import { describe, test, expect } from "bun:test";
import { createJobSchema } from "../src/lib/job-create-schema";

const basePayload = {
  bikeType: "electric" as const,
  category: "brake_issue",
  customerLocationLat: 32.0853,
  customerLocationLng: 34.7818,
};

describe("createJobSchema", () => {
  test("accepts null photoUrl (client sends null when upload skipped/failed)", () => {
    const res = createJobSchema.safeParse({ ...basePayload, photoUrl: null });
    expect(res.success).toBe(true);
  });

  test("accepts missing photoUrl", () => {
    const res = createJobSchema.safeParse(basePayload);
    expect(res.success).toBe(true);
  });

  test("accepts valid photo URL", () => {
    const res = createJobSchema.safeParse({
      ...basePayload,
      photoUrl: "https://ebikel-backend.onrender.com/api/uploads/abc.jpg",
    });
    expect(res.success).toBe(true);
  });

  test("accepts multiple repair categories joined (up to 500 chars)", () => {
    const category =
      "front_tire_puncture, rear_tire_puncture, tire_tube_replacement, brake_issue, starts_no_drive, general_electrical, general_service";
    const res = createJobSchema.safeParse({ ...basePayload, category });
    expect(res.success).toBe(true);
  });
});