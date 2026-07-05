import { describe, expect, test } from "bun:test";
import {
  buildJobPhotoPath,
  getSupabaseProjectUrl,
  mimeToExt,
  publicStorageUrl,
} from "../src/lib/supabase-storage";

describe("supabase storage helpers", () => {
  test("getSupabaseProjectUrl derives from DATABASE_URL", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres.gxwcbdphjmrwmrmtqtms:pass@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
    delete process.env.SUPABASE_URL;
    expect(getSupabaseProjectUrl()).toBe("https://gxwcbdphjmrwmrmtqtms.supabase.co");
  });

  test("mimeToExt maps image types", () => {
    expect(mimeToExt("image/png")).toBe("png");
    expect(mimeToExt("image/webp")).toBe("webp");
    expect(mimeToExt("image/jpeg")).toBe("jpg");
  });

  test("buildJobPhotoPath uses jobs/{userId}/ prefix", () => {
    const path = buildJobPhotoPath("user-abc", "image/jpeg");
    expect(path.startsWith("jobs/user-abc/")).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });

  test("publicStorageUrl builds public object URL", () => {
    process.env.SUPABASE_URL = "https://gxwcbdphjmrwmrmtqtms.supabase.co";
    const url = publicStorageUrl("jobs/u1/photo.jpg");
    expect(url).toBe(
      "https://gxwcbdphjmrwmrmtqtms.supabase.co/storage/v1/object/public/job-photos/jobs/u1/photo.jpg"
    );
  });
});