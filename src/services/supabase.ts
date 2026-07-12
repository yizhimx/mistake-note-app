import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let currentUser: User | null = null;

/** Direct fetch for Supabase (no IPC proxy — Chromium network stack works, Node.js doesn't). */
async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawInput = (typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url);
  // Fix: supabase-js v2.110.2 URL construction bugs — inserts /rest/v1 into auth, REST, or Storage URLs
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
