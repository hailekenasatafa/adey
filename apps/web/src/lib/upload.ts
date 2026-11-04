'use client';
import { validateUpload } from '@adey/shared';
import { api } from '@/lib/supabase/client';

const ext = (m: string) => (m === 'image/png' ? 'png' : m === 'image/webp' ? 'webp' : m === 'application/pdf' ? 'pdf' : m === 'video/quicktime' ? 'mov' : m === 'video/mp4' ? 'mp4' : 'jpg');

/** Validate against shared limits and upload to `<prefix>/<uuid>.<ext>`. */
export async function uploadFile(bucket: string, prefix: string, file: File, kind: 'image' | 'video' | 'document') {
  const problem = validateUpload(kind, { size: file.size, mimeType: file.type });
  if (problem) throw new Error(problem);
  return api.storage.upload(bucket, `${prefix}/${crypto.randomUUID()}.${ext(file.type)}`, file, file.type, true);
}

export const dollarsToCents = (s: string) => { const n = Number(s.replace(/[^0-9.]/g, '')); return Number.isFinite(n) && s.trim() ? Math.round(n * 100) : null; };
export const centsToDollars = (c: number | null | undefined) => (c == null ? '' : (c / 100).toString());
