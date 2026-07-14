import { LocalStorage } from 'quasar';

export interface AiConfig {
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
}

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-vl-plus';

/**
 * In-memory decrypted cache for the AI API key, populated at app startup
 * via initAiConfigCache(). This keeps getAiConfig() synchronous so no
 * callers need to change.
 */
let cachedAiKey: string | null = null;

// ── Web Crypto (AES-GCM + PBKDF2) helpers ──────────────────────────
// The passphrase lives in the bundle, so this is defense-in-depth:
// it protects against passive localStorage inspection and trivial XSS
// key theft, but a determined attacker with the bundle can still derive
// the key. The real protection is not shipping the key and (for multi-user)
// moving signing to a backend proxy.

const APP_SECRET = 'mistake-note-app::ai-key-v1';

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = Uint8Array.from(enc.encode(APP_SECRET));
  const baseKey = await crypto.subtle.importKey('raw', rawKey, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptKey(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);
  const plainEncoded = Uint8Array.from(new TextEncoder().encode(plain));
  const ivBuf = Uint8Array.from(iv);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBuf }, key, plainEncoded);
  return [bufToB64(salt), bufToB64(iv), bufToB64(new Uint8Array(ct))].join(':');
}

async function decryptKey(cipher: string): Promise<string> {
  const [s, i, c] = cipher.split(':');
  if (!s || !i || !c) return '';
  const key = await deriveKey(b64ToBuf(s));
  const ivBuf = b64ToBuf(i);
  const dataBuf = b64ToBuf(c);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, dataBuf);
  return new TextDecoder().decode(pt);
}

// ── Exported async helpers ─────────────────────────────────────────

/**
 * Initialise the in-memory decrypted key cache from encrypted localStorage.
 * Must be called once at app startup (in App.vue onMounted) before any
 * AI calls are made.
 */
export async function initAiConfigCache(): Promise<void> {
  const stored = (LocalStorage.getItem('aiApiKey') as string) || '';
  if (!stored) {
    cachedAiKey = '';
    return;
  }
  try {
    cachedAiKey = await decryptKey(stored);
  } catch (e) {
    console.warn('[aiConfig] Failed to decrypt stored AI API key, resetting cache.', e);
    cachedAiKey = '';
  }
}

/**
 * Load the plaintext AI API key from encrypted localStorage.
 * Used by the settings form to populate the input field.
 */
export async function loadAiApiKey(): Promise<string> {
  const stored = (LocalStorage.getItem('aiApiKey') as string) || '';
  if (!stored) return '';
  try {
    return await decryptKey(stored);
  } catch {
    return '';
  }
}

/**
 * Encrypt and persist the AI API key to localStorage, then update the
 * in-memory cache.
 */
export async function storeAiApiKey(plain: string): Promise<void> {
  const cipher = await encryptKey(plain);
  LocalStorage.setItem('aiApiKey', cipher);
  cachedAiKey = plain;
}

/**
 * Read AI configuration from localStorage + the in-memory decrypted cache.
 * This function remains **synchronous** so that all 7 existing callers
 * continue to work without modification.
 */
export function getAiConfig(): AiConfig {
  return {
    aiApiKey: cachedAiKey ?? '',
    aiEndpoint: (LocalStorage.getItem('aiEndpoint') as string) || DEFAULT_ENDPOINT,
    aiModel: (LocalStorage.getItem('aiModel') as string) || DEFAULT_MODEL,
  };
}
