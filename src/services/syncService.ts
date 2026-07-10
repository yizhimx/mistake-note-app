import { api } from './api';
import { useSyncStore } from '@/stores/syncStore';
import { uid } from 'quasar';

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL = 30000;

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
      await api.syncPush(unsynced);
      unsynced.forEach((op) => {
        store.dequeue(op.id);
      });
    }

    const result = await api.syncPull(store.lastSyncAt);
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
