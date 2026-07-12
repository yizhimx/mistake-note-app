import { defineStore } from 'pinia';

const LS_KEY = 'sync_lastSyncAt';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    isOnline: navigator.onLine,
    lastSyncAt: (localStorage.getItem(LS_KEY) || null) as string | null,
    syncState: 'idle' as 'idle' | 'syncing' | 'synced' | 'error',
    userEmail: null as string | null,
    lastError: null as string | null,
  }),

  actions: {
    setOnline(status: boolean) {
      this.isOnline = status;
    },
    setLastSyncAt(date: string) {
      this.lastSyncAt = date;
      localStorage.setItem(LS_KEY, date);
    },
  },
});
