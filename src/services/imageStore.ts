import { isMobileNative, saveMobileImage, loadMobileImage, deleteMobileImage } from './mobileFs';
import { getRefUrl, isCloudStoreConfigured, uploadImage, deleteImage as deleteCloudImage } from './cloudStore';

const IMAGE_PREFIX = 'local:';
const CLOUD_PREFIX = 'cloud:';
const MAX_CACHE = 200;
const cache = new Map<string, string>();
const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function trimCache() {
  while (cache.size > MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

/** Compress an image data URL to roughly targetBytes (~1MB default). */
async function compressToTarget(dataUrl: string, targetBytes = 1 * 1024 * 1024): Promise<string> {
  const rawSize = Math.round((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75);
  if (rawSize <= targetBytes * 1.5) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  const maxWidth = 2500;
  if (width > maxWidth) {
    height = Math.round(height * maxWidth / width);
    width = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  let quality = 0.85;
  for (let attempt = 0; attempt < 3; attempt++) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
    if (!blob) break;
    if (blob.size <= targetBytes) return blobToDataUrl(blob);
    quality -= 0.2;
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.3));
  if (blob) return blobToDataUrl(blob);
  return dataUrl;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function saveImage(dataUrl: string): Promise<string> {
  // Compress to ~1MB target
  let finalUrl: string;
  try {
    finalUrl = await compressToTarget(dataUrl);
  } catch {
    finalUrl = dataUrl;
  }

  // Upload to cloud if configured (returns "cloud:uuid.jpg")
  if (isCloudStoreConfigured()) {
    try {
      const ref = await uploadImage(finalUrl);
      cache.set(ref, finalUrl);
      trimCache();
      return ref;
    } catch (e) {
      console.warn('[imageStore] cloud upload failed, falling back:', e);
    }
  }

  // Try Electron (desktop)
  if (window.electronAPI) {
    const name = await window.electronAPI.saveImage(finalUrl);
    if (name) {
      const ref = `${IMAGE_PREFIX}${name}`;
      cache.set(ref, finalUrl);
      trimCache();
      return ref;
    }
  }
  // Try Capacitor Filesystem (mobile)
  if (isMobileNative()) {
    const filename = crypto.randomUUID().slice(0, 8) + '.jpg';
    const ok = await saveMobileImage(filename, finalUrl);
    if (ok) {
      const ref = `${IMAGE_PREFIX}${filename}`;
      cache.set(ref, finalUrl);
      trimCache();
      return ref;
    }
  }
  // Fallback: return compressed data URL as-is
  return finalUrl;
}

export async function saveImageData(ref: string, dataUrl: string): Promise<void> {
  cache.set(ref, dataUrl);
  trimCache();
  if (ref.startsWith(CLOUD_PREFIX)) {
    // Cloud refs are already in cloud — nothing extra to persist
    return;
  }
  if (ref.startsWith(IMAGE_PREFIX)) {
    const name = ref.slice(IMAGE_PREFIX.length);
    if (window.electronAPI?.saveImageAs) {
      await window.electronAPI.saveImageAs(dataUrl, name);
    } else if (isMobileNative()) {
      await saveMobileImage(name, dataUrl);
    }
  }
}

export async function loadImage(ref: string): Promise<string | null> {
  if (cache.has(ref)) return cache.get(ref)!;

  // Cloud ref — download from public URL
  if (ref.startsWith(CLOUD_PREFIX)) {
    if (isCloudStoreConfigured()) {
      try {
        const publicUrl = getRefUrl(ref);
        const resp = await fetch(publicUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const dataUrl = await blobToDataUrl(blob);
          cache.set(ref, dataUrl);
          trimCache();
          return dataUrl;
        }
      } catch (e) {
        console.warn('[imageStore] cloud load failed:', e);
      }
    }
    return null;
  }

  // Local ref — existing behavior
  if (ref.startsWith(IMAGE_PREFIX)) {
    const name = ref.slice(IMAGE_PREFIX.length);
    if (window.electronAPI) {
      const dataUrl = await window.electronAPI.loadImage(name);
      if (dataUrl) {
        cache.set(ref, dataUrl);
        trimCache();
        return dataUrl;
      }
    }
    if (isMobileNative()) {
      const dataUrl = await loadMobileImage(name);
      if (dataUrl) {
        cache.set(ref, dataUrl);
        trimCache();
        return dataUrl;
      }
    }
  }
  return null;
}

export async function deleteImage(ref: string): Promise<void> {
  cache.delete(ref);
  if (ref.startsWith(CLOUD_PREFIX)) {
    if (isCloudStoreConfigured()) {
      try { await deleteCloudImage(ref); } catch { /* ignore */ }
    }
    return;
  }
  if (ref.startsWith(IMAGE_PREFIX)) {
    const name = ref.slice(IMAGE_PREFIX.length);
    if (window.electronAPI) {
      await window.electronAPI.deleteImage(name);
    } else if (isMobileNative()) {
      await deleteMobileImage(name);
    }
  }
}

export function extractImageRefs(markdown: string): string[] {
  const refs: string[] = [];
  const re = /!\[.*?\]\(((local|cloud):[^)]+)\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    if (m[1]) refs.push(m[1]);
  }
  return refs;
}

export function isImageRef(s: string): boolean {
  return s.startsWith(IMAGE_PREFIX) || s.startsWith(CLOUD_PREFIX);
}

/**
 * Resolve an image ref to a displayable URL.
 * - `local:` refs → cached data URL or placeholder
 * - `cloud:` refs → cached data URL, public cloud URL, or placeholder
 */
export function resolveImageRef(ref: string): string {
  if (ref.startsWith(IMAGE_PREFIX)) {
    return getCachedImage(ref) || PLACEHOLDER;
  }
  if (ref.startsWith(CLOUD_PREFIX)) {
    const cached = getCachedImage(ref);
    if (cached) return cached;
    if (isCloudStoreConfigured()) {
      try {
        return getRefUrl(ref);
      } catch { /* fall through to placeholder */ }
    }
  }
  return PLACEHOLDER;
}

export function getCachedImage(ref: string): string | undefined {
  return cache.get(ref);
}

export async function preloadFromMarkdown(markdown: string) {
  const refs = extractImageRefs(markdown);
  for (const ref of refs) {
    if (!cache.has(ref)) {
      await loadImage(ref);
    }
  }
}
