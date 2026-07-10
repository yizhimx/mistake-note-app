import { api } from './api';

export async function recognizeText(imageUrl: string): Promise<string> {
  try {
    const result = await api.ocrRecognize(imageUrl);
    return result.text;
  } catch (e) {
    console.error('OCR recognition failed:', e);
    throw e;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function drawToCanvas(img: HTMLImageElement | ImageBitmap, maxWidth: number, quality: number): string {
  const canvas = document.createElement('canvas');
  let { width, height } = img;
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function compressToDataUrl(
  file: File,
  maxWidth = 800,
  quality = 0.6,
): Promise<string> {
  const rawDataUrl = await fileToDataUrl(file);

  // Try createImageBitmap first (works on File/Blob directly in Electron/Chrome)
  try {
    const bitmap = await createImageBitmap(file);
    const result = drawToCanvas(bitmap, maxWidth, quality);
    bitmap.close();
    return result;
  } catch {
    // createImageBitmap failed, ignore
  }

  // Try new Image() with data URL
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to load image'));
      i.src = rawDataUrl;
    });
    return drawToCanvas(img, maxWidth, quality);
  } catch {
    // Both compression approaches failed, return raw data URL
    return rawDataUrl;
  }
}

export async function uploadImage(
  file: File,
  compress = true,
): Promise<string> {
  return compress ? compressToDataUrl(file) : fileToDataUrl(file);
}
