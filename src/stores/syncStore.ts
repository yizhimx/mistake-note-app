import { defineStore } from 'pinia';
import { getDb } from '@/services/db';

const LS_KEY = 'sync_lastSyncAt';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    isOnline: navigator.onLine,
    lastSyncAt: (localStorage.getItem(LS_KEY) || null) as string | null,
    syncState: 'idle' as 'idle' | 'syncing' | 'synced' | 'error',
    userEmail: null as string | null,
    lastError: null as string | null,
    conflictCount: 0,
  }),

  actions: {
    setOnline(status: boolean) {
      this.isOnline = status;
    },
    setLastSyncAt(date: string) {
      this.lastSyncAt = date;
      localStorage.setItem(LS_KEY, date);
    },
    addConflict() {
      this.conflictCount += 1;
    },
    setConflictCount(n: number) {
      this.conflictCount = n;
    },
    async loadConflictCount() {
      const db = await getDb();
      const row = await db.get('SELECT COUNT(*) as c FROM sync_conflicts WHERE resolved = 0');
      this.conflictCount = (row?.c as number) ?? 0;
    },
  },
});
