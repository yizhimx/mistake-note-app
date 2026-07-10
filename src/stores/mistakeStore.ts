import { defineStore } from 'pinia';

export interface MistakeRecord {
  id: string;
  title: string;
  imageUrls: string[];
  tags: string[];
  subject: string;
  notes: string;
  aiAnalysis: string | null;
  ocrText: string | null;
  createdAt: string;
  updatedAt: string;
  reviewCount: number;
  lastReviewAt: string | null;
  masteryLevel: 'fresh' | 'hesitant' | 'smooth' | null;
  sm2Data: string | null;
  linkedNoteIds: string[];
  synced: boolean;
}

export const useMistakeStore = defineStore('mistake', {
  state: () => ({
    mistakes: [] as MistakeRecord[],
    currentMistake: null as MistakeRecord | null,
    loading: false,
  }),

  getters: {
    getMistakeById: (state) => {
      return (id: string) => state.mistakes.find((m) => m.id === id);
    },
    todayReviewMistakes: (state) => {
      return state.mistakes.filter((m) => {
        if (!m.sm2Data) return false;
        try {
          const sm2 = JSON.parse(m.sm2Data);
          const nextReview = new Date(sm2.nextReviewDate);
          return nextReview <= new Date();
        } catch {
          return false;
        }
      });
    },
  },

  actions: {
    addMistake(record: MistakeRecord) {
      this.mistakes.unshift(record);
    },
    updateMistake(id: string, data: Partial<MistakeRecord>) {
      const idx = this.mistakes.findIndex((m) => m.id === id);
      if (idx !== -1) {
        this.mistakes[idx] = { ...this.mistakes[idx], ...data };
      }
    },
    removeMistake(id: string) {
      this.mistakes = this.mistakes.filter((m) => m.id !== id);
    },
    setCurrentMistake(mistake: MistakeRecord | null) {
      this.currentMistake = mistake;
    },
  },
});
