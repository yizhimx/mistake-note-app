import { defineStore } from 'pinia';
import { uid } from 'quasar';
import { recognizeText } from '@/services/ocrService';
import { api } from '@/services/api';
import { getAiConfig } from '@/services/aiConfig';
import {
  fetchQueueItems,
  addQueueItem,
  updateQueueItem,
  deleteQueueItem as dbDelete,
  clearCompletedQueueItems as dbClearCompleted,
  deleteQueueItems,
} from '@/services/aiQueueService';
import type { AiQueueItem } from '@/services/aiQueueService';

function buildTagsPrompt(content: string): string {
  return `你是一个专业的教研专家。请分析以下题目内容，给出难度星级和知识点标签。

要求：
1. 难度星级：1 到 5 的整数（1 最简单，5 最难）。
2. 知识点标签：提取 2-4 个最核心的考点标签（中文，用中文逗号“，”分隔）。
3. 必须严格以 JSON 格式输出，不要输出任何额外解释文本。

格式如下：
{
  "difficulty": 3,
  "tags": "标签1，标签2，标签3"
}

题目内容：
${content}`;
}

function parseTagsJson(text: string): { difficulty: number; knowledgePoints: string[] } {
  let cleaned = (text || '').trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m && m[1]) cleaned = m[1].trim();
  const braceStart = cleaned.indexOf('{');
  const braceEnd = cleaned.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1) cleaned = cleaned.slice(braceStart, braceEnd + 1);
  const data = JSON.parse(cleaned) as { difficulty?: number; tags?: string };
  const difficulty = Math.min(5, Math.max(1, Math.round(Number(data.difficulty) || 3)));
  const knowledgePoints = String(data.tags || '')
    .split(/[，,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return { difficulty, knowledgePoints };
}

async function processQueueItem(item: AiQueueItem): Promise<void> {
  const config = getAiConfig();
  if (!config.aiApiKey) {
    await updateQueueItem(item.id, {
      status: 'failed',
      error: '未配置 AI API Key，请先在设置中填写',
      processedAt: new Date().toISOString(),
    });
    return;
  }

  await updateQueueItem(item.id, { status: 'processing' });
  try {
    // Step 1: OCR image → markdown
    const content = await recognizeText(item.imageData);
    if (!content.trim()) {
      throw new Error('OCR 未识别到题目内容，请确认图片清晰度');
    }

    // Step 2: Tags + difficulty
    const res = await api.aiAnalyze(buildTagsPrompt(content), config);
    let difficulty = 3;
    let knowledgePoints: string[] = [];
    try {
      const tags = parseTagsJson(res.content);
      difficulty = tags.difficulty;
      knowledgePoints = tags.knowledgePoints;
    } catch {
      // fallback defaults
    }

    await updateQueueItem(item.id, {
      status: 'completed',
      resultContent: content,
      resultDifficulty: difficulty,
      resultKnowledgePoints: knowledgePoints,
      processedAt: new Date().toISOString(),
    });

    // If linked to a mistake, auto-apply results
    if (item.mistakeId) {
      try {
        const { updateMistake } = await import('@/services/mistakeService');
        await updateMistake(item.mistakeId, {
          content,
          difficulty,
          knowledgePoints,
        });
      } catch {
        // silent
      }
    }
  } catch (e: any) {
    await updateQueueItem(item.id, {
      status: 'failed',
      error: e?.message || '处理失败',
      processedAt: new Date().toISOString(),
    });
  }
}

export const useQueueStore = defineStore('queue', {
  state: () => ({
    items: [] as AiQueueItem[],
    loading: false,
    processing: false,
    pollTimer: null as ReturnType<typeof setInterval> | null,
  }),

  getters: {
    pendingCount: (state) => state.items.filter((i) => i.status === 'pending').length,
    completedItems: (state) => state.items.filter((i) => i.status === 'completed'),
    failedItems: (state) => state.items.filter((i) => i.status === 'failed'),
    processingItems: (state) => state.items.filter((i) => i.status === 'processing'),
  },

  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.items = await fetchQueueItems();
      } finally {
        this.loading = false;
      }
    },

    async addToQueue(imageData: string, mistakeId?: string): Promise<string> {
      const id = uid();
      const now = new Date().toISOString();
      const item: AiQueueItem = {
        id,
        mistakeId: mistakeId || null,
        imageData,
        status: 'pending',
        resultContent: null,
        resultDifficulty: null,
        resultKnowledgePoints: [],
        error: null,
        createdAt: now,
        processedAt: null,
      };
      await addQueueItem(item);
      this.items.unshift(item);
      this.tryProcessNext();
      return id;
    },

    async cancelItem(id: string) {
      await updateQueueItem(id, { status: 'cancelled' });
      const item = this.items.find((i) => i.id === id);
      if (item) item.status = 'cancelled';
    },

    async removeItem(id: string) {
      await dbDelete(id);
      this.items = this.items.filter((i) => i.id !== id);
    },

    async clearCompleted() {
      const toRemove = this.items.filter((i) =>
        ['completed', 'failed', 'cancelled'].includes(i.status),
      );
      if (toRemove.length === 0) return;
      await deleteQueueItems(toRemove.map((i) => i.id));
      this.items = this.items.filter((i) => !['completed', 'failed', 'cancelled'].includes(i.status));
    },

    async retryItem(id: string) {
      await updateQueueItem(id, { status: 'pending', error: null, processedAt: null });
      const item = this.items.find((i) => i.id === id);
      if (item) {
        item.status = 'pending';
        item.error = null;
        item.processedAt = null;
      }
      this.tryProcessNext();
    },

    async tryProcessNext() {
      if (this.processing) return;
      const pending = this.items.find((i) => i.status === 'pending');
      if (!pending) return;
      this.processing = true;
      try {
        await processQueueItem(pending);
        const idx = this.items.findIndex((i) => i.id === pending.id);
        if (idx !== -1) {
          const fresh = await fetchQueueItems();
          const updated = fresh.find((i) => i.id === pending.id);
          if (updated) this.items[idx] = updated;
        }
      } finally {
        this.processing = false;
        // check for more pending after a short delay
        setTimeout(() => this.tryProcessNext(), 1000);
      }
    },

    startPolling() {
      if (this.pollTimer) return;
      // Poll the database periodically to pick up items left from last session
      this.pollTimer = setInterval(async () => {
        if (this.processing) return;
        const fresh = await fetchQueueItems();
        // Check if there are new pending items not yet in our list
        const hasNewPending = fresh.some(
          (f) => f.status === 'pending' && !this.items.some((i) => i.id === f.id),
        );
        const hasUnprocessed = fresh.some(
          (f) => f.status === 'pending' && !this.processing,
        );
        this.items = fresh;
        if (hasUnprocessed) {
          this.tryProcessNext();
        }
      }, 5000);
    },

    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
  },
});
