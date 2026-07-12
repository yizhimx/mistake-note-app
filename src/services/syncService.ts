import { getSetting } from './db';
import { useSyncStore } from '@/stores/syncStore';
import { uid } from 'quasar';

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL = 30000;

async function syncRequest<T>(method: string, path: string, body?: any): Promise<T> {
  const baseUrl = (await getSetting('syncUrl')) || 'http://localhost:3001';
  const token = (await getSetting('syncToken')) || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, init);
  if (!res.ok) {
    let detail = `Sync API Error: ${res.status} ${res.statusText}`;
    try {
      const b = await res.json();
      if (b?.error) detail = b.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as T;
}

export function startSync() {
  if (syncTimer) return;
  syncTimer = setInterval(doSync, SYNC_INTERVAL);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

export function stopSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
}

function handleOnline() {
  const store = useSyncStore();
  store.setOnline(true);
  doSync();
}

function handleOffline() {
  const store = useSyncStore();
  store.setOnline(false);
}

async function doSync() {
  const store = useSyncStore();
  if (!store.isOnline || !store.syncUrl) return;

  try {
    const unsynced = store.operationQueue.filter((o) => !o.synced);
    if (unsynced.length > 0) {
      await syncRequest('POST', '/sync/push', { operations: unsynced });
      unsynced.forEach((op) => {
        store.dequeue(op.id);
      });
    }

    const result = await syncRequest('POST', '/sync/pull', { lastSyncAt: store.lastSyncAt });
    if (result?.operations) {
      store.lastSyncAt = new Date().toISOString();
    }
  } catch (e) {
    console.warn('Sync failed, will retry:', e);
  }
}

export function enqueueOperation(
  action: 'create' | 'update' | 'delete',
  entityType: 'mistake' | 'note',
  entityId: string,
  payload: Record<string, any>,
) {
  const store = useSyncStore();
  store.enqueue({
    id: uid(),
    action,
    entityType,
    entityId,
    payload: JSON.stringify(payload),
    timestamp: new Date().toISOString(),
    deviceId: 'device-' + uid(),
    synced: false,
  });

  if (store.isOnline) {
    doSync();
  }
}
