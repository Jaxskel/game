"use client";

/**
 * Downscale/compress a photo to JPEG so requests stay far under Vercel's
 * 4.5MB body limit. Page-text photos use a higher maxDim for readable OCR.
 */
export async function compressImage(
  file: File,
  maxDim = 1024,
  quality = 0.8,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg" };
}
