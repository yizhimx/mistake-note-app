import { defineStore } from 'pinia';
import {
  fetchNotes,
  fetchNoteById,
  addNote as dbAdd,
  updateNote as dbUpdate,
  deleteNote as dbDelete,
} from '@/services/noteService';

export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  plainText: string;
  tags: string[];
  imageUrls: string[];
  linkedMistakeIds: string[];
  createdAt: string;
  updatedAt: string;
  synced: boolean;
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
    async updateNote(id: string, data: Partial<NoteRecord>) {
      await dbUpdate(id, data);
      const idx = this.notes.findIndex((n) => n.id === id);
      if (idx !== -1) {
        this.notes[idx] = { ...this.notes[idx], ...data, updatedAt: new Date().toISOString() };
      }
    },
    async removeNote(id: string) {
      await dbDelete(id);
      this.notes = this.notes.filter((n) => n.id !== id);
    },
    setCurrentNote(note: NoteRecord | null) {
      this.currentNote = note;
    },
  },
});
