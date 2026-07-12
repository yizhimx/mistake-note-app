import { isMobileNative, saveMobileImage, loadMobileImage, deleteMobileImage } from './mobileFs';

const IMAGE_PREFIX = 'local:';
const MAX_CACHE = 200;
const cache = new Map<string, string>();

function trimCache() {
  while (cache.size > MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

export async function saveImage(dataUrl: string): Promise<string> {
  // Try Electron first (desktop)
  if (window.electronAPI) {
    const name = await window.electronAPI.saveImage(dataUrl);
    if (name) {
      const ref = `${IMAGE_PREFIX}${name}`;
      cache.set(ref, dataUrl);
      trimCache();
      return ref;
    }
  }
  // Try Capacitor Filesystem (mobile)
  if (isMobileNative()) {
    const filename = crypto.randomUUID().slice(0, 8) + '.jpg';
    const ok = await saveMobileImage(filename, dataUrl);
    if (ok) {
      const ref = `${IMAGE_PREFIX}${filename}`;
      cache.set(ref, dataUrl);
      trimCache();
      return ref;
    }
  }
  // Fallback: return data URL as-is
  return dataUrl;
}

export async function saveImageData(ref: string, dataUrl: string): Promise<void> {
  cache.set(ref, dataUrl);
  trimCache();
  const name = ref.startsWith(IMAGE_PREFIX) ? ref.slice(IMAGE_PREFIX.length) : null;
  if (name) {
    if (window.electronAPI?.saveImageAs) {
      await window.electronAPI.saveImageAs(dataUrl, name);
    } else if (isMobileNative()) {
      await saveMobileImage(name, dataUrl);
    }
  }
}

export async function loadImage(ref: string): Promise<string | null> {
  if (cache.has(ref)) return cache.get(ref)!;
  if (ref.startsWith(IMAGE_PREFIX)) {
    const name = ref.slice(IMAGE_PREFIX.length);
    // Try Electron (desktop)
    if (window.electronAPI) {
      const dataUrl = await window.electronAPI.loadImage(name);
      if (dataUrl) {
        cache.set(ref, dataUrl);
        trimCache();
        return dataUrl;
      }
    }
    // Try Capacitor FS (mobile)
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
  const re = /!\[.*?\]\((local:[^)]+)\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    if (m[1]) refs.push(m[1]);
  }
  return refs;
}

export function isImageRef(s: string): boolean {
  return s.startsWith(IMAGE_PREFIX);
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
