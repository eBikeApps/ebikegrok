import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";

const DEFAULT_BUCKET = "job-photos";

export function getSupabaseProjectUrl(): string | null {
  const explicit = process.env.SUPABASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const db = process.env.DATABASE_URL ?? "";
  const match = db.match(/postgres\.([a-z0-9]+)/i);
  return match ? `https://${match[1]}.supabase.co` : null;
}

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function isSupabaseStorageConfigured(): boolean {
  return !!(getSupabaseProjectUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (!isSupabaseStorageConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(
      getSupabaseProjectUrl()!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return adminClient;
}

/** Ensure public bucket exists (idempotent). Uses Postgres — works without service role key. */
export async function ensureJobPhotosBucket(): Promise<void> {
  const bucket = getStorageBucket().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!bucket) return;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       VALUES ('${bucket}', '${bucket}', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']::text[])
       ON CONFLICT (id) DO UPDATE SET
         public = EXCLUDED.public,
         file_size_limit = EXCLUDED.file_size_limit,
         allowed_mime_types = EXCLUDED.allowed_mime_types`
    );
  } catch (err) {
    console.warn("[Supabase Storage] ensureJobPhotosBucket:", err);
  }
}

export function mimeToExt(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function buildJobPhotoPath(userId: string, mimeType: string): string {
  return `jobs/${userId}/${randomUUID()}.${mimeToExt(mimeType)}`;
}

export function publicStorageUrl(objectPath: string): string | null {
  const base = getSupabaseProjectUrl();
  if (!base) return null;
  return `${base}/storage/v1/object/public/${getStorageBucket()}/${objectPath}`;
}

/** Upload via service role — persistent public URL for job.photoUrl */
export async function uploadJobPhotoToSupabase(params: {
  buffer: Buffer;
  mimeType: string;
  userId: string;
}): Promise<string | null> {
  const client = getAdminClient();
  if (!client) return null;

  await ensureJobPhotosBucket();

  const path = buildJobPhotoPath(params.userId, params.mimeType);
  const { error } = await client.storage.from(getStorageBucket()).upload(path, params.buffer, {
    contentType: params.mimeType,
    upsert: false,
    cacheControl: "31536000",
  });

  if (error) {
    console.error("[Supabase Storage] upload failed:", error.message);
    return null;
  }

  const { data } = client.storage.from(getStorageBucket()).getPublicUrl(path);
  return data.publicUrl || publicStorageUrl(path);
}