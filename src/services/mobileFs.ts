import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const IMAGES_DIR = 'mistake-note-images';
const DB_FILE = 'mistake-note.db';
let _isNative: boolean | null = null;

function isNative(): boolean {
  if (_isNative === null) {
    try { _isNative = Capacitor.isNativePlatform(); } catch { _isNative = false; }
  }
  return _isNative;
}

export async function initMobileFs(): Promise<void> {
  if (!isNative()) return;
  try {
    await Filesystem.mkdir({ path: IMAGES_DIR, directory: Directory.Documents, recursive: true });
  } catch (e: any) {
    if (!String(e?.message || e).includes('EXIST')) throw e;
  }
}

export function isMobileNative(): boolean {
  return isNative();
}

/** Save an image (data URL) to Capacitor Filesystem. No encoding = base64. */
export async function saveMobileImage(filename: string, dataUrl: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    await Filesystem.writeFile({
      path: `${IMAGES_DIR}/${filename}`,
      data: base64,
      directory: Directory.Documents,
    });
    return true;
  } catch (e) {
    console.error('[mobileFs] saveImage failed:', e);
    return false;
  }
}

/** Read an image from Capacitor Filesystem (returns data URL, or null). */
export async function loadMobileImage(filename: string): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const result = await Filesystem.readFile({
      path: `${IMAGES_DIR}/${filename}`,
      directory: Directory.Documents,
    });
    const b64 = typeof result.data === 'string' ? result.data : null;
    if (!b64) return null;
    return `data:image/jpeg;base64,${b64}`;
  } catch { return null; }
}

export async function deleteMobileImage(filename: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await Filesystem.deleteFile({ path: `${IMAGES_DIR}/${filename}`, directory: Directory.Documents });
    return true;
  } catch { return false; }
}

/** Read the sql.js database file from Capacitor Filesystem. */
export async function readMobileDb(): Promise<Uint8Array | null> {
  if (!isNative()) return null;
  try {
    const result = await Filesystem.readFile({ path: DB_FILE, directory: Directory.Documents });
    const b64 = typeof result.data === 'string' ? result.data : null;
    if (!b64) return null;
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

/** Write the sql.js database file to Capacitor Filesystem (base64). */
export async function writeMobileDb(data: Uint8Array): Promise<boolean> {
  if (!isNative()) return false;
  try {
    let binary = '';
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]!);
    await Filesystem.writeFile({ path: DB_FILE, data: btoa(binary), directory: Directory.Documents });
    return true;
  } catch (e) {
    console.error('[mobileFs] writeDb failed:', e);
    return false;
  }
}
