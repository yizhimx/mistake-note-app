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
  if (window.electronAPI) {
    const name = await window.electronAPI.saveImage(dataUrl);
    if (name) {
      const ref = `${IMAGE_PREFIX}${name}`;
      cache.set(ref, dataUrl);
      trimCache();
      return ref;
    }
  }
  return dataUrl;
}

export async function loadImage(ref: string): Promise<string | null> {
  if (cache.has(ref)) return cache.get(ref)!;
  if (ref.startsWith(IMAGE_PREFIX) && window.electronAPI) {
    const name = ref.slice(IMAGE_PREFIX.length);
    const dataUrl = await window.electronAPI.loadImage(name);
    if (dataUrl) {
      cache.set(ref, dataUrl);
      trimCache();
      return dataUrl;
    }
  }
  return null;
}

export async function deleteImage(ref: string): Promise<void> {
  cache.delete(ref);
  if (ref.startsWith(IMAGE_PREFIX) && window.electronAPI) {
    const name = ref.slice(IMAGE_PREFIX.length);
    await window.electronAPI.deleteImage(name);
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
