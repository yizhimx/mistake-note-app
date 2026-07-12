import { defineStore } from 'pinia';
import {
  fetchMistakes,
  fetchMistakeById,
  addMistake as dbAdd,
  addMistakes as dbAddMany,
  updateMistake as dbUpdate,
  deleteMistake as dbDelete,
  searchMistakes,
} from '@/services/mistakeService';
import { preloadFromMarkdown, deleteImage, extractImageRefs } from '@/services/imageStore';

export interface MistakeRecord {
  id: string;
  title: string;
  content: string;
  imageUrls: string[];
  tags: string[];
  subject: string;
  notes: string;
  answer: string;
  answerImages: string[];
  difficulty: number;
  knowledgePoints: string[];
  year: string;
  knowledgeAreas: string[];
  sourcePaperType: string;
  sourcePaperName: string;
  questionNumber: string;
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
  isDeleted?: boolean;
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
        await preloadFromMarkdown(record.content || '');
        await preloadFromMarkdown(record.answer || '');
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
    async addMistakes(records: MistakeRecord[]) {
      await dbAddMany(records);
      this.mistakes.unshift(...records);
    },
    async updateMistake(id: string, data: Partial<MistakeRecord>) {
      await dbUpdate(id, data);
      const idx = this.mistakes.findIndex((m) => m.id === id);
      if (idx !== -1) {
        this.mistakes[idx] = { ...this.mistakes[idx], ...(data as MistakeRecord), updatedAt: new Date().toISOString() } as MistakeRecord;
      }
    },
    async removeMistake(id: string) {
      const removed = this.mistakes.find(m => m.id === id);
      if (removed) {
        const refs = [
          ...extractImageRefs(removed.content || ''),
          ...extractImageRefs(removed.answer || ''),
        ];
        for (const ref of refs) {
          await deleteImage(ref).catch(() => {});
        }
      }
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
