import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let currentUser: User | null = null;

/** Custom fetch that routes through Electron IPC proxy when available (bypass CORS). */
async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawInput = (typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url);
  // Fix: supabase-js v2.110.2 sometimes inserts /rest/v1 into auth URLs
  // e.g., "/rest/v1/auth/v1/signup" → "/auth/v1/signup"
  const url = rawInput.replaceAll('/rest/v1/auth/v1/', '/auth/v1/');
  console.log('[supabaseFetch] RAW URL:', rawInput, '→ FIXED URL:', rawInput !== url ? url : '(unchanged)');
  if (window.electronAPI?.aiRequest) {
    try {
      const payload: { url: string; method?: string; headers?: Record<string, string>; body?: string } = {
        url,
        method: init?.method ?? 'GET',
        headers: (init?.headers as Record<string, string>) ?? {},
      };
      if (typeof init?.body === 'string') payload.body = init.body;
      const res = await window.electronAPI.aiRequest(payload);
      return new Response(res.body, { status: res.status, statusText: res.statusText });
    } catch (err: any) {
      console.error('[supabase] IPC proxy failed, falling back to direct fetch:', url, err?.message || err);
    }
  }
  console.warn('[supabase] fallback fetch to:', url);
  try {
    const method = init?.method ?? 'GET';
    const headers = (init?.headers as Record<string, string>) ?? {};
    const body = typeof init?.body === 'string' ? init.body : undefined;
    const initOpts: RequestInit = { method, headers };
    if (body !== undefined) initOpts.body = body;
    return await fetch(url, initOpts);
  } catch (e: any) {
    throw new Error(`Failed to fetch Supabase (${url}): ${e?.message || e}`);
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  const cleanUrl = url.replace(/\/+$/, '');
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
  const url = localStorage.getItem('supabaseUrl');
  const key = localStorage.getItem('supabaseAnonKey');
  if (url && key) {
    createSupabaseClient(url, key);
  }
}
