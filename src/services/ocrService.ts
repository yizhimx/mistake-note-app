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

export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadImage(
  file: File,
  compress = true,
): Promise<string> {
  let blob = file;
  if (compress) {
    blob = await compressImage(file);
  }

  const { url, fileUrl } = await api.getUploadUrl(
    `${Date.now()}-${file.name}`,
    blob.type,
  );

  await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type },
  });

  return fileUrl;
}
