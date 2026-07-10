import { defineStore } from 'pinia';

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
    addNote(record: NoteRecord) {
      this.notes.unshift(record);
    },
    updateNote(id: string, data: Partial<NoteRecord>) {
      const idx = this.notes.findIndex((n) => n.id === id);
      if (idx !== -1) {
        this.notes[idx] = { ...this.notes[idx], ...data };
      }
    },
    removeNote(id: string) {
      this.notes = this.notes.filter((n) => n.id !== id);
    },
    setCurrentNote(note: NoteRecord | null) {
      this.currentNote = note;
    },
  },
});
