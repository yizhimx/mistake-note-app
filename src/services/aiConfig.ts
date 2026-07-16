import { LocalStorage } from 'quasar';

// ── Public types ──────────────────────────────────────────

export interface AiConfigProfile {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  /** Plaintext API key — only stored in memory; encrypted on disk */
  apiKey: string;
}

export interface AiConfig {
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
}

// ── Storage keys ──────────────────────────────────────────

const PROFILES_KEY = 'aiProfiles_v2';
const ACTIVE_PROFILE_KEY = 'aiActiveProfile_v2';

// Legacy single-config keys (for migration)
const LEGACY_ENDPOINT_KEY = 'aiEndpoint';
const LEGACY_MODEL_KEY = 'aiModel';
const LEGACY_API_KEY_KEY = 'aiApiKey';

// ── In-memory cache ───────────────────────────────────────

let profilesCache: AiConfigProfile[] | null = null;
let activeProfileId: string | null = null;

// ── Web Crypto (AES-GCM + PBKDF2) helpers ─────────────────

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
    ['encrypt', 'decrypt'],
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

// ── Internal storage helpers ──────────────────────────────

interface StoredProfile {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  encryptedKey: string;
}

async function saveProfilesToStorage(profiles: AiConfigProfile[]): Promise<void> {
  const stored: StoredProfile[] = await Promise.all(
    profiles.map(async (p) => ({
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      model: p.model,
      encryptedKey: p.apiKey ? await encryptKey(p.apiKey) : '',
    })),
  );
  LocalStorage.set(PROFILES_KEY, stored);
}

async function loadProfilesFromStorage(): Promise<AiConfigProfile[]> {
  const stored = LocalStorage.getItem(PROFILES_KEY) as StoredProfile[] | null;
  if (!stored || !Array.isArray(stored)) return [];

  const profiles: AiConfigProfile[] = [];
  for (const s of stored) {
    let apiKey = '';
    if (s.encryptedKey) {
      try {
        apiKey = await decryptKey(s.encryptedKey);
      } catch {
        // corrupted entry — keep empty key
      }
    }
    profiles.push({
      id: s.id,
      name: s.name,
      endpoint: s.endpoint,
      model: s.model,
      apiKey,
    });
  }
  return profiles;
}

// ── Migration from legacy single-config format ────────────

async function migrateLegacyConfig(): Promise<void> {
  const oldEndpoint = LocalStorage.getItem(LEGACY_ENDPOINT_KEY) as string | null;
  const oldModel = LocalStorage.getItem(LEGACY_MODEL_KEY) as string | null;
  const oldEncryptedKey = LocalStorage.getItem(LEGACY_API_KEY_KEY) as string | null;

  if (!oldEndpoint && !oldModel && !oldEncryptedKey) {
    // No legacy data — create a default empty profile
    profilesCache = [
      {
        id: 'default',
        name: '默认',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-vl-plus',
        apiKey: '',
      },
    ];
    activeProfileId = 'default';
    await saveProfilesToStorage(profilesCache);
    LocalStorage.set(ACTIVE_PROFILE_KEY, 'default');
    return;
  }

  let apiKey = '';
  if (oldEncryptedKey) {
    try {
      apiKey = await decryptKey(oldEncryptedKey);
    } catch {
      // migration: key corrupted, start fresh
    }
  }

  const profile: AiConfigProfile = {
    id: 'default',
    name: '默认',
    endpoint: oldEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: oldModel || 'qwen-vl-plus',
    apiKey,
  };

  profilesCache = [profile];
  activeProfileId = 'default';
  await saveProfilesToStorage(profilesCache);
  LocalStorage.set(ACTIVE_PROFILE_KEY, 'default');

  // Clean up legacy keys
  LocalStorage.remove(LEGACY_ENDPOINT_KEY);
  LocalStorage.remove(LEGACY_MODEL_KEY);
  LocalStorage.remove(LEGACY_API_KEY_KEY);
}

// ── Exported API ──────────────────────────────────────────

/**
 * Initialise the in-memory profile cache from localStorage.
 * Must be called once at app startup (in App.vue onMounted).
 * Also handles migration from the legacy single-config format.
 */
export async function initAiConfigCache(): Promise<void> {
  const hasV2Profiles = LocalStorage.getItem(PROFILES_KEY) !== null;

  if (!hasV2Profiles) {
    await migrateLegacyConfig();
    return;
  }

  profilesCache = await loadProfilesFromStorage();
  activeProfileId = LocalStorage.getItem(ACTIVE_PROFILE_KEY) as string | null;

  // If active profile doesn't exist or is null, fall back to first
  if (!activeProfileId || !profilesCache.find((p) => p.id === activeProfileId)) {
    activeProfileId = profilesCache[0]?.id ?? null;
  }
}

/** Return all saved profiles (plaintext apiKey in memory). */
export async function getProfiles(): Promise<AiConfigProfile[]> {
  if (!profilesCache) {
    await initAiConfigCache();
  }
  return profilesCache ?? [];
}

/** Return the active profile's ID. */
export function getActiveProfileId(): string | null {
  return activeProfileId;
}

/** Return the currently active profile, or the first one if none set. */
export async function getActiveProfile(): Promise<AiConfigProfile | null> {
  const profiles = await getProfiles();
  if (!activeProfileId) return profiles[0] ?? null;
  return profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;
}

/**
 * Synchronous accessor for the active AI config.
 * Used by all AI service callers (directAi, ocrService, aiService, queueStore).
 * Assumes initAiConfigCache() has already been called at startup.
 */
export function getAiConfig(): AiConfig {
  const profile = profilesCache?.find((p) => p.id === activeProfileId) ?? profilesCache?.[0];
  return {
    aiApiKey: profile?.apiKey ?? '',
    aiEndpoint: profile?.endpoint ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    aiModel: profile?.model ?? 'qwen-vl-plus',
  };
}

/** Add a new profile and persist. Returns the created profile. */
export async function addProfile(
  name: string,
  endpoint: string,
  model: string,
  apiKey: string,
): Promise<AiConfigProfile> {
  const profiles = await getProfiles();
  const id = `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const profile: AiConfigProfile = { id, name, endpoint, model, apiKey };
  profiles.push(profile);
  profilesCache = profiles;
  await saveProfilesToStorage(profiles);
  return profile;
}

/** Update fields of an existing profile and persist. */
export async function updateProfile(
  id: string,
  data: Partial<Pick<AiConfigProfile, 'name' | 'endpoint' | 'model' | 'apiKey'>>,
): Promise<void> {
  const profiles = await getProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Profile "${id}" not found`);

  if (data.name !== undefined) profiles[idx]!.name = data.name;
  if (data.endpoint !== undefined) profiles[idx]!.endpoint = data.endpoint;
  if (data.model !== undefined) profiles[idx]!.model = data.model;
  if (data.apiKey !== undefined) profiles[idx]!.apiKey = data.apiKey;

  profilesCache = profiles;
  await saveProfilesToStorage(profiles);
}

/** Delete a profile. Refuses to delete the last remaining profile. */
export async function deleteProfile(id: string): Promise<void> {
  const profiles = await getProfiles();
  if (profiles.length <= 1) throw new Error('至少保留一个配置');

  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;

  profiles.splice(idx, 1);
  profilesCache = profiles;
  await saveProfilesToStorage(profiles);

  // If the deleted profile was active, switch to the first remaining
  if (activeProfileId === id) {
    activeProfileId = profiles[0]?.id ?? null;
    if (activeProfileId) {
      LocalStorage.set(ACTIVE_PROFILE_KEY, activeProfileId);
    } else {
      LocalStorage.remove(ACTIVE_PROFILE_KEY);
    }
  }
}

/** Set the active profile by ID and persist the choice. */
export async function setActiveProfile(id: string): Promise<void> {
  const profiles = await getProfiles();
  if (!profiles.find((p) => p.id === id)) throw new Error(`Profile "${id}" not found`);
  activeProfileId = id;
  LocalStorage.set(ACTIVE_PROFILE_KEY, id);
}

// ── Backward-compatible aliases ───────────────────────────

/** @deprecated Use getActiveProfile() instead. */
export async function loadAiApiKey(): Promise<string> {
  const profile = await getActiveProfile();
  return profile?.apiKey ?? '';
}

/** @deprecated Use updateProfile() instead. */
export async function storeAiApiKey(plain: string): Promise<void> {
  const profile = await getActiveProfile();
  if (profile) {
    await updateProfile(profile.id, { apiKey: plain });
  }
}
