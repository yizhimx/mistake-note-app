import { defineStore } from 'pinia';
import {
  fetchNotes,
  fetchNoteById,
  addNote as dbAdd,
  addNotes as dbAddMany,
  updateNote as dbUpdate,
  deleteNote as dbDelete,
  fetchDeletedNotes as dbFetchDeletedNotes,
  restoreNote as dbRestore,
  restoreAllNotes as dbRestoreAll,
  purgeNote as dbPurge,
  purgeAllNotes as dbPurgeAll,
} from '@/services/noteService';
import { deleteImage, extractImageRefs } from '@/services/imageStore';

export interface NoteRecord {
  id: string;
  title: string;
  subject: string;
  volume: string;
  chapter: string;
  section: string;
  summary: string;
  isFolder: boolean;
  content: string;
  plainText: string;
  tags: string[];
  knowledgePoints: string[];
  tips: string[];
  imageUrls: string[];
  linkedMistakeIds: string[];
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  isDeleted?: boolean;
}

export const useNoteStore = defineStore('note', {
  state: () => ({
    notes: [] as NoteRecord[],
    currentNote: null as NoteRecord | null,
    loading: false,
  }),

  getters: {
    getNoteById: (state) => {
      return (id: string) => state.notes.find((n) => n.id === id);
    },
  },

  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.notes = await fetchNotes();
      } catch (e) {
        console.error('Failed to fetch notes:', e);
        this.notes = [];
      } finally {
        this.loading = false;
      }
    },
    async fetchOne(id: string) {
      const record = await fetchNoteById(id);
      if (record) {
        const idx = this.notes.findIndex((n) => n.id === id);
        if (idx !== -1) this.notes[idx] = record;
        else this.notes.unshift(record);
      }
      return record;
    },
    async addNote(record: NoteRecord) {
      await dbAdd(record);
      this.notes.unshift(record);
    },
    async addNotes(records: NoteRecord[]) {
      await dbAddMany(records);
      this.notes.unshift(...records);
    },
    async updateNote(id: string, data: Partial<NoteRecord>) {
      await dbUpdate(id, data);
      const idx = this.notes.findIndex((n) => n.id === id);
      if (idx !== -1) {
        this.notes[idx] = { ...this.notes[idx], ...data, updatedAt: new Date().toISOString() } as NoteRecord;
      }
    },
    async removeNote(id: string) {
      await dbDelete(id);
      this.notes = this.notes.filter((n) => n.id !== id);
    },
    async fetchDeletedNotes() {
      return await dbFetchDeletedNotes();
    },
    async restoreNote(id: string) {
      await dbRestore(id);
      const record = await fetchNoteById(id);
      if (record) this.notes.unshift(record);
    },
    async restoreAllNotes() {
      const restored = await dbRestoreAll();
      this.notes.unshift(...restored);
    },
    async purgeNote(id: string) {
      const removed = this.notes.find(n => n.id === id);
      if (removed) {
        for (const ref of removed.imageUrls) {
          await deleteImage(ref).catch(() => {});
        }
      }
      await dbPurge(id);
      this.notes = this.notes.filter((n) => n.id !== id);
    },
    async purgeAllNotes() {
      const purged = await dbPurgeAll();
      const ids = new Set(purged.map(p => p.id));
      const deletePromises: Promise<void>[] = [];
      for (const p of purged) {
        for (const ref of p.imageUrls) {
          deletePromises.push(deleteImage(ref).catch(() => {}));
        }
      }
      await Promise.all(deletePromises);
      this.notes = this.notes.filter((n) => !ids.has(n.id));
    },
    setCurrentNote(note: NoteRecord | null) {
      this.currentNote = note;
    },
  },
});
