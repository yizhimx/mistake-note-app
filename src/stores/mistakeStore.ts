import { defineStore } from 'pinia';
import {
  fetchMistakes,
  fetchMistakeById,
  addMistake as dbAdd,
  updateMistake as dbUpdate,
  deleteMistake as dbDelete,
  searchMistakes,
} from '@/services/mistakeService';

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
    async fetchAll() {
      this.loading = true;
      try {
        this.mistakes = await fetchMistakes();
      } catch (e) {
        console.error('Failed to fetch mistakes:', e);
        this.mistakes = [];
      } finally {
        this.loading = false;
      }
    },
    async fetchOne(id: string) {
      const record = await fetchMistakeById(id);
      if (record) {
        const idx = this.mistakes.findIndex((m) => m.id === id);
        if (idx !== -1) this.mistakes[idx] = record;
        else this.mistakes.unshift(record);
      }
      return record;
    },
    async addMistake(record: MistakeRecord) {
      await dbAdd(record);
      this.mistakes.unshift(record);
    },
    async updateMistake(id: string, data: Partial<MistakeRecord>) {
      await dbUpdate(id, data);
      const idx = this.mistakes.findIndex((m) => m.id === id);
      if (idx !== -1) {
        this.mistakes[idx] = { ...this.mistakes[idx], ...data, updatedAt: new Date().toISOString() };
      }
    },
    async removeMistake(id: string) {
      await dbDelete(id);
      this.mistakes = this.mistakes.filter((m) => m.id !== id);
    },
    async search(params: { subject?: string; tags?: string; dateFrom?: string; dateTo?: string }) {
      this.loading = true;
      try {
        this.mistakes = await searchMistakes(params);
      } finally {
        this.loading = false;
      }
    },
    setCurrentMistake(mistake: MistakeRecord | null) {
      this.currentMistake = mistake;
    },
  },
});
