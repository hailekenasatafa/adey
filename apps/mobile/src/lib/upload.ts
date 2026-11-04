import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { validateUpload } from '@adey/shared';
import { api } from './supabase';

export type PickedFile = { uri: string; mimeType: string; size: number; name: string; width?: number; height?: number; duration?: number };

export async function pickImages(opts: { multiple?: boolean; camera?: boolean } = {}): Promise<PickedFile[]> {
  const perm = opts.camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(opts.camera ? 'Camera permission is required' : 'Photo library permission is required');
  const result = opts.camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: !!opts.multiple, quality: 0.85, selectionLimit: opts.multiple ? 10 : 1 });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    mimeType: a.mimeType ?? 'image/jpeg',
    size: a.fileSize ?? 0,
    name: a.fileName ?? `image-${Date.now()}.jpg`,
    width: a.width,
    height: a.height,
  }));
}

export async function pickVideo(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission is required');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false, videoMaxDuration: 60 });
  if (result.canceled) return null;
  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'video/mp4', size: a.fileSize ?? 0, name: a.fileName ?? `video-${Date.now()}.mp4`, duration: a.duration ?? undefined };
}

export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size ?? 0, name: a.name };
}

function extFor(mime: string) {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'application/pdf' ? 'pdf' : mime === 'video/quicktime' ? 'mov' : mime === 'video/mp4' ? 'mp4' : 'jpg';
}

/**
 * Upload a picked file to a bucket under `<prefix>/<random>.<ext>`.
 * Validates against shared limits first; retries once on transient failure.
 */
export async function uploadFile(bucket: string, prefix: string, file: PickedFile, kind: 'image' | 'video' | 'document'): Promise<string> {
  const problem = validateUpload(kind, { size: file.size, mimeType: file.mimeType });
  if (problem) throw new Error(problem);
  const path = `${prefix}/${Crypto.randomUUID()}.${extFor(file.mimeType)}`;
  const body = await fetch(file.uri).then((r) => r.arrayBuffer());
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await api.storage.upload(bucket, path, body, file.mimeType, true);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
}
