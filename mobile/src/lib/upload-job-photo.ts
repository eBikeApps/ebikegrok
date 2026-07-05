import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/lib/api/api';
import { supabase } from '@/lib/supabase';

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = 'job-photos';

function mimeFromUri(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function readPhotoBase64(localUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/** Upload via backend (service role on server — most reliable). */
async function uploadViaBackend(localUri: string, mimeType: string): Promise<string | null> {
  try {
    const base64 = await readPhotoBase64(localUri);
    const result = await api.post<{ url?: string; error?: string; storage?: string }>('/api/uploads', {
      base64,
      mimeType,
    });
    return result.url ?? null;
  } catch (err) {
    console.error('[upload-job-photo] backend upload failed:', err);
    return null;
  }
}

/** Direct upload to Supabase Storage (anon key + RLS on jobs/ prefix). */
async function uploadViaSupabaseDirect(
  localUri: string,
  userId: string,
  mimeType: string
): Promise<string | null> {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return null;
  }

  try {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `jobs/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const fileRes = await fetch(localUri);
    const blob = await fileRes.blob();

    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      console.error('[upload-job-photo] Supabase direct failed:', error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('[upload-job-photo] Supabase direct error:', err);
    return null;
  }
}

/**
 * Upload customer repair photo — prefers backend (service role), then Supabase direct.
 */
export async function uploadJobPhoto(localUri: string, userId: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) {
    console.error('[upload-job-photo] file not found:', localUri);
    return null;
  }
  if ((info.size ?? 0) > MAX_BYTES) {
    throw new Error('PHOTO_TOO_LARGE');
  }

  const mimeType = mimeFromUri(localUri);

  const backend = await uploadViaBackend(localUri, mimeType);
  if (backend) return backend;

  return uploadViaSupabaseDirect(localUri, userId, mimeType);
}