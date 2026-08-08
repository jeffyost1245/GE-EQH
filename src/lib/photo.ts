// Checkout sheet photos.
//
// Nothing uploads any more: the safety officer took the digital sheet, so
// crews fill the form instead of photographing the paper. What stays is
// everything needed to keep showing the photos already taken — those are
// safety records and don't stop existing because the way in changed.
//
// The upload path is kept rather than deleted. Phone cameras produce 3-5
// MB images, and the resizing here is the part that took the fiddling; if
// photographs are ever wanted again it should not have to be rediscovered.

import { getSupabase } from "./supabase";

export const SHEET_BUCKET = "checkout-sheets";

const MAX_EDGE = 1800; // long edge in pixels; keeps handwriting readable
const QUALITY = 0.72;

/**
 * Downscale and re-encode a camera photo as JPEG. Falls back to the
 * original file if the browser can't decode it.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    // If compression somehow made it bigger, keep the original.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Upload a photo and return its storage path. */
export async function uploadSheetPhoto(file: File): Promise<string> {
  const blob = await compressPhoto(file);
  const now = new Date();
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}/${crypto.randomUUID()}.jpg`;

  const { error } = await getSupabase()
    .storage.from(SHEET_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function deleteSheetPhoto(path: string): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(SHEET_BUCKET)
    .remove([path]);
  if (error) throw error;
}

/**
 * Signed URL for displaying a photo. The bucket is private, so every view
 * goes through one of these; an hour is plenty for a page visit.
 */
export async function sheetPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(SHEET_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Signed URLs for many photos at once, keyed by storage path. */
export async function sheetPhotoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await getSupabase()
    .storage.from(SHEET_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
