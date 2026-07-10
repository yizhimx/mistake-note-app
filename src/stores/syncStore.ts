import { defineStore } from 'pinia';

export interface SyncOperation {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'mistake' | 'note';
  entityId: string;
  payload: string;
  timestamp: string;
  deviceId: string;
  synced: boolean;
}

export const useSyncStore = defineStore('sync', {
  state: () => ({
    syncUrl: '',
    syncToken: '',
    isOnline: navigator.onLine,
    operationQueue: [] as SyncOperation[],
    conflicts: [] as any[],
    lastSyncAt: null as string | null,
  }),

  actions: {
    setOnline(status: boolean) {
      this.isOnline = status;
    },
    enqueue(op: SyncOperation) {
      this.operationQueue.push(op);
    },
    dequeue(id: string) {
      this.operationQueue = this.operationQueue.filter((o) => o.id !== id);
    },
    addConflict(conflict: any) {
      this.conflicts.push(conflict);
    },
    resolveConflict(conflictId: string) {
      this.conflicts = this.conflicts.filter((c) => c.id !== conflictId);
    },
  },
});
