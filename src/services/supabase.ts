import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let currentUser: User | null = null;

/** Direct fetch for Supabase (no IPC proxy — Chromium network stack works, Node.js doesn't). */
async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawInput = (typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url);
  // ── URL-correction workaround for supabase-js v2.110.2 ──────────────────────
  // Root cause: a known bug in supabase-js v2.110.2 URL construction — the
  // `createClient()` internals sometimes prepend /rest/v1/ onto URLs that already
  // contain /auth/v1/, /rest/v1/, or /storage/v1/, producing malformed paths like:
  //   /rest/v1/auth/v1/…  → corrected by first .replaceAll()
  //   /rest/v1/rest/v1/…  → corrected by second .replaceAll()
  //   /rest/v1/storage/v1/ → corrected by third .replaceAll()
  //
  // WARNING: The supabase-js dependency version is effectively PINNED to 2.110.2.
  // Do NOT upgrade supabase-js without re-verifying these corrections — if the
  // bug is fixed upstream the replacements become no-ops (safe) but if it is
  // replaced by a different URL format all Supabase API calls will fail with 404
  // "Invalid path specified in request URL" / "Object not found".
  const url = rawInput
    .replaceAll('/rest/v1/auth/v1/', '/auth/v1/')
    .replaceAll('/rest/v1/rest/v1/', '/rest/v1/')
    .replaceAll('/rest/v1/storage/v1/', '/storage/v1/');
  console.log('[supabaseFetch] URL:', url, 'method:', init?.method);
  if (typeof init?.body === 'string') {
    console.log('[supabaseFetch] BODY:', init.body.substring(0, 1000));
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.clone().text();
    console.error('[supabaseFetch] ERROR:', response.status, body.substring(0, 500));
  }
  return response;
}

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  // Normalize URL: add https:// if missing, strip trailing slash
  let cleanUrl = (url || '').trim();
  if (!cleanUrl) {
    throw new Error('Supabase URL 不能为空');
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  // Validate URL has a host
  try {
    const parsed = new URL(cleanUrl);
    if (!parsed.hostname || parsed.hostname === 'null' || parsed.hostname === 'undefined') {
      throw new Error('无效的 Supabase URL');
    }
  } catch {
    throw new Error(`Supabase URL 格式无效: ${cleanUrl}`);
  }
  client = createClient(cleanUrl, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { fetch: supabaseFetch },
  });
  return client;
}

export function destroySupabaseClient(): void {
  client = null;
  currentUser = null;
}

export async function restoreSession(): Promise<User | null> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  currentUser = data?.session?.user ?? null;
  return currentUser;
}

export async function signIn(email: string, password: string): Promise<User | null> {
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user ?? null;
  return currentUser;
}

export async function signUp(email: string, password: string): Promise<User | null> {
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  currentUser = data.user ?? null;
  return currentUser;
}

export async function signOut(): Promise<void> {
  if (!client) return;
  await client.auth.signOut();
  currentUser = null;
  localStorage.removeItem('sync_lastSyncAt');
}

/** Try to restore Supabase session from saved config in localStorage. Call on app boot. */
export function initSupabaseFromStorage(): void {
  // Quasar's $q.localStorage stores values with type prefix markers (__q_strn|, etc.)
  // Use raw localStorage.getItem and strip the prefix manually.
  const rawUrl = localStorage.getItem('supabaseUrl');
  const url = rawUrl ? (rawUrl.startsWith('__q_strn|') ? rawUrl.slice(9) : rawUrl) : null;
  const rawKey = localStorage.getItem('supabaseAnonKey');
  const key = rawKey ? (rawKey.startsWith('__q_strn|') ? rawKey.slice(9) : rawKey) : null;
  if (url && key) {
    createSupabaseClient(url, key);
  }
}
