import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let currentUser: User | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
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
