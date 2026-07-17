import { defineStore } from 'pinia';
import { uid } from 'quasar';
import { recognizeText } from '@/services/ocrService';
import { getAiConfig } from '@/services/aiConfig';
import { directTextChat } from '@/services/directAi';
import {
  fetchQueueItems,
  addQueueItem,
  updateQueueItem,
  deleteQueueItem as dbDelete,
  clearCompletedQueueItems as dbClearCompleted,
  deleteQueueItems,
} from '@/services/aiQueueService';
import type { AiQueueItem, SplitQuestion } from '@/services/aiQueueService';
import { buildTagsPrompt, parseTagsJson } from '@/utils/aiParsing';

// Map to track AbortControllers for in-flight queue items
const abortControllers = new Map<string, AbortController>();

function parseQuestionsJson(text: string): SplitQuestion[] {
  let cleaned = (text || '').trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m && m[1]) cleaned = m[1].trim();
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1) cleaned = cleaned.slice(arrStart, arrEnd + 1);
  let arr: any[];
  try {
    arr = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item: any) => ({
      content: String(item?.content || '').trim(),
      subject: String(item?.subject || '').trim(),
      difficulty: Math.min(5, Math.max(1, Math.round(Number(item?.difficulty) || 3))),
      knowledgeAreas: Array.isArray(item?.knowledgeAreas)
        ? item.knowledgeAreas.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 6)
        : String(item?.knowledgeAreas || '')
            .split(/[，,]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6),
    }))
    .filter((q) => q.content);
}

/** Split OCR output by the --- delimiter into individual question texts */
function splitOcrText(text: string): string[] {
  const parts = text.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

async function splitIntoQuestions(ocrText: string, signal?: AbortSignal): Promise<SplitQuestion[]> {
  const prompt = `你正在整理错题。以下是从一张试卷或练习册页面识别出的文字内容，该页面可能包含多道独立题目。请将整页内容拆分为若干道独立的错题，每道错题应是一个完整的题目。

每道错题包含：
- content: 完整的题目内容（Markdown 格式，保留公式与换行）
- subject: 所属科目（数学、物理、化学、英语、语文、生物、历史、地理、政治），不确定则为空字符串
- difficulty: 难度评级（1-5，1 最简单 5 最难）
- knowledgeAreas: 知识板块数组（2-4 个核心考点）

返回严格 JSON 格式数组（不要包裹 markdown 代码块，不要有任何说明文字）：

[
  {
    "content": "题目1内容",
    "subject": "数学",
    "difficulty": 3,
    "knowledgeAreas": ["函数", "导数"]
  }
]

OCR 文字内容：
${ocrText}`;

  const resContent = await directTextChat(prompt, { temperature: 0.3, systemPrompt: 'You are a teaching expert.', signal: signal ?? null });
  const parsed = parseQuestionsJson(resContent);
  if (parsed.length === 0) {
    return [{ content: ocrText, subject: '', difficulty: 3, knowledgeAreas: [] }];
  }
  return parsed;
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('已取消');
    err.name = 'AbortError';
    throw err;
  }
}

async function processQueueItem(item: AiQueueItem, signal?: AbortSignal): Promise<void> {
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
    if (item.type === 'analysis') {
      // Analysis: generate answer text from content
      const prompt = `你是一位严谨的学科教师，请解析以下错题。返回格式：

## 正确答案
（用 Markdown 写出正确答案）

## 解题步骤
（分步骤详细说明解题过程）

题目内容：
${item.imageData}`;
      const content = await directTextChat(prompt, { temperature: 0.3, systemPrompt: '你是一位严谨的学科教师，返回格式规范的 Markdown。', signal: signal ?? null });
      checkAbort(signal);
      const text = (content || '').trim();

      // Also extract structured info (subject, difficulty, knowledge areas) from the content
      let subject = '';
      let difficulty = 3;
      let knowledgeAreas: string[] = [];
      try {
        const tagsRes = await directTextChat(buildTagsPrompt(item.imageData), { temperature: 0.3, systemPrompt: 'You are a teaching expert.', signal: signal ?? null });
        checkAbort(signal);
        const tags = parseTagsJson(tagsRes);
        subject = tags.subject;
        difficulty = tags.difficulty;
        knowledgeAreas = tags.knowledgeAreas;
      } catch { /* structured info extraction failed, use defaults */ }

      await updateQueueItem(item.id, {
        status: 'completed',
        resultContent: text,
        resultSubject: subject,
        resultDifficulty: difficulty,
        resultKnowledgeAreas: knowledgeAreas,
        processedAt: new Date().toISOString(),
      });
      // Auto-apply to mistake if linked
      if (item.mistakeId) {
        try {
          const { updateMistake } = await import('@/services/mistakeService');
          await updateMistake(item.mistakeId, { answer: text, aiAnalysis: text, subject, difficulty, knowledgeAreas });
        } catch { /* silent */ }
      }
    } else {
      // Recognition: OCR → split → analysis → tags → apply
      const content = await recognizeText(item.imageData, signal);
      checkAbort(signal);
      if (!content.trim()) {
        throw new Error('OCR 未识别到题目内容，请确认图片清晰度');
      }

      // Split OCR output by --- delimiter into individual questions
      const questionTexts = splitOcrText(content);
      const isMultiQuestion = questionTexts.length > 1;

      let questions: SplitQuestion[];

      if (isMultiQuestion) {
        // Multiple questions found — process each one individually
        questions = [];
        for (const qText of questionTexts) {
          checkAbort(signal);
          let difficulty = 3;
          let subject = '';
          let knowledgeAreas: string[] = [];
          let answer = '';

          // Extract structured info (subject, difficulty, knowledge areas)
          for (let attempt = 0; attempt < 2; attempt++) {
            checkAbort(signal);
            const prompt = attempt === 0
              ? buildTagsPrompt(qText)
              : `请严格按以下 JSON 格式输出，不要包含任何其他文字：\n{\n  "subject": "科目",\n  "difficulty": 3,\n  "knowledgeAreas": "考点1，考点2"\n}\n\n题目内容：\n${qText}`;
            try {
              const res = await directTextChat(prompt, { temperature: 0.3, systemPrompt: 'You are a teaching expert.', signal: signal ?? null });
              checkAbort(signal);
              const tags = parseTagsJson(res);
              difficulty = tags.difficulty;
              subject = tags.subject;
              knowledgeAreas = tags.knowledgeAreas;
              break;
            } catch { /* retry with simpler prompt */ }
          }

          // Generate analysis
          try {
            const analysisPrompt = `你是一位严谨的学科教师，请解析以下错题。返回格式：

## 正确答案
（用 Markdown 写出正确答案）

## 解题步骤
（分步骤详细说明解题过程）

题目内容：
${qText}`;
            answer = await directTextChat(analysisPrompt, { temperature: 0.3, systemPrompt: '你是一位严谨的学科教师，返回格式规范的 Markdown。', signal: signal ?? null });
            checkAbort(signal);
          } catch { /* analysis failed */ }

          questions.push({ content: qText, subject, difficulty, knowledgeAreas, answer });
        }
      } else if (item.mistakeId) {
        // Single question linked to a mistake — existing logic
        let difficulty = 3;
        let subject = '';
        let knowledgeAreas: string[] = [];
        let answer = '';
        for (let attempt = 0; attempt < 2; attempt++) {
          checkAbort(signal);
          const prompt = attempt === 0
            ? buildTagsPrompt(content)
            : `请严格按以下 JSON 格式输出，不要包含任何其他文字：\n{\n  "subject": "科目",\n  "difficulty": 3,\n  "knowledgeAreas": "考点1，考点2"\n}\n\n题目内容：\n${content}`;
          try {
            const res = await directTextChat(prompt, { temperature: 0.3, systemPrompt: 'You are a teaching expert.', signal: signal ?? null });
            checkAbort(signal);
            const tags = parseTagsJson(res);
            difficulty = tags.difficulty;
            subject = tags.subject;
            knowledgeAreas = tags.knowledgeAreas;
            break;
          } catch { /* retry */ }
        }
        try {
          const analysisPrompt = `你是一位严谨的学科教师，请解析以下错题。返回格式：

## 正确答案
（用 Markdown 写出正确答案）

## 解题步骤
（分步骤详细说明解题过程）

题目内容：
${content}`;
          answer = await directTextChat(analysisPrompt, { temperature: 0.3, systemPrompt: '你是一位严谨的学科教师，返回格式规范的 Markdown。', signal: signal ?? null });
          checkAbort(signal);
        } catch { /* analysis failed */ }
        questions = [{ content, subject, difficulty, knowledgeAreas, answer }];
      } else {
        // Single question, no linked mistake — use splitIntoQuestions for structured data
        questions = await splitIntoQuestions(content, signal);
        checkAbort(signal);
        // Generate analysis for each question
        for (const q of questions) {
          checkAbort(signal);
          try {
            const analysisPrompt = `你是一位严谨的学科教师，请解析以下错题。返回格式：

## 正确答案
（用 Markdown 写出正确答案）

## 解题步骤
（分步骤详细说明解题过程）

题目内容：
${q.content}`;
            q.answer = await directTextChat(analysisPrompt, { temperature: 0.3, systemPrompt: '你是一位严谨的学科教师，返回格式规范的 Markdown。', signal: signal ?? null });
            checkAbort(signal);
          } catch { /* analysis failed */ }
        }
      }

      const first = questions[0];
      if (!first) {
        throw new Error('未能解析出任何题目');
      }
      await updateQueueItem(item.id, {
        status: 'completed',
        resultContent: first.content,
        resultDifficulty: first.difficulty,
        resultSubject: first.subject,
        resultKnowledgeAreas: first.knowledgeAreas,
        resultQuestions: questions,
        processedAt: new Date().toISOString(),
      });

      // If linked to a mistake, auto-apply the first question
      if (item.mistakeId) {
        try {
          const { updateMistake } = await import('@/services/mistakeService');
          await updateMistake(item.mistakeId, {
            content: first.content,
            answer: first.answer || '',
            difficulty: first.difficulty,
            subject: first.subject,
            knowledgeAreas: first.knowledgeAreas,
          });
        } catch {
          // silent
        }
      }

      // If multiple questions and linked to a mistake, auto-create mistakes for extra questions
      if (isMultiQuestion && item.mistakeId && questions.length > 1) {
        try {
          const { addMistake } = await import('@/services/mistakeService');
          const { uid } = await import('quasar');
          const now = new Date().toISOString();
          // Save the image once and reference it in each extra mistake
          let imageRef = '';
          if (item.imageData) {
            try {
              if (item.imageData.startsWith('local:')) {
                imageRef = `![原始图片](${item.imageData})`;
              } else {
                const { saveImage } = await import('@/services/imageStore');
                const ref = await saveImage(item.imageData);
                imageRef = `![原始图片](${ref})`;
              }
            } catch { /* ignore */ }
          }
          for (let i = 1; i < questions.length; i++) {
            checkAbort(signal);
            const q = questions[i]!;
            const newId = uid();
            const record = {
              id: newId,
              title: (q.content || '').split('\n')[0]?.replace(/[#*`$]/g, '').trim().slice(0, 30) || `错题 ${now.slice(0, 10)}`,
              content: q.content + (imageRef ? `\n\n${imageRef}` : ''),
              imageUrls: [],
              tags: [],
              subject: q.subject || '',
              answer: q.answer || '',
              answerImages: [],
              difficulty: q.difficulty || 0,
              knowledgePoints: [],
              year: '',
              knowledgeAreas: q.knowledgeAreas || [],
              sourcePaperType: '',
              sourcePaperName: '',
              questionNumber: '',
              notes: '',
              aiAnalysis: null,
              ocrText: null,
              createdAt: now,
              updatedAt: now,
              reviewCount: 0,
              lastReviewAt: null,
              masteryLevel: null,
              sm2Data: null,
              linkedNoteIds: [],
              synced: false,
            };
            await addMistake(record as any);
          }
        } catch { /* silent — extra questions failed to auto-create */ }
      }
    }
  } catch (e: any) {
    // Don't mark as failed if aborted
    if (e?.name === 'AbortError' || e?.message === '已取消') {
      await updateQueueItem(item.id, {
        status: 'cancelled',
        error: '已取消',
        processedAt: new Date().toISOString(),
      });
      return;
    }
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

    async addToQueue(imageData: string, mistakeId?: string, type: 'recognition' | 'analysis' = 'recognition'): Promise<string> {
      const id = uid();
      const now = new Date().toISOString();
      const item: AiQueueItem = {
        id,
        type,
        mistakeId: mistakeId || null,
        imageData,
        status: 'pending',
        resultContent: null,
        resultDifficulty: null,
        resultSubject: null,
        resultKnowledgeAreas: [],
        resultQuestions: null,
        error: null,
        createdAt: now,
        processedAt: null,
      };
      await addQueueItem(item);
      this.items.unshift(item);
      this.tryProcessNext();
      return id;
    },

    async addToAnalysisQueue(content: string, mistakeId?: string): Promise<string> {
      return this.addToQueue(content, mistakeId, 'analysis');
    },

    async cancelItem(id: string) {
      // If item is currently processing, abort the in-flight request
      const controller = abortControllers.get(id);
      if (controller) {
        controller.abort();
        abortControllers.delete(id);
      }
      await updateQueueItem(id, { status: 'cancelled' });
      const item = this.items.find((i) => i.id === id);
      if (item) item.status = 'cancelled';
    },

    async removeItem(id: string) {
      // If item is currently processing, cancel it first
      const controller = abortControllers.get(id);
      if (controller) {
        controller.abort();
        abortControllers.delete(id);
      }
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
      const controller = new AbortController();
      abortControllers.set(pending.id, controller);
      try {
        await processQueueItem(pending, controller.signal);
        const idx = this.items.findIndex((i) => i.id === pending.id);
        if (idx !== -1) {
          const fresh = await fetchQueueItems();
          const updated = fresh.find((i) => i.id === pending.id);
          if (updated) this.items[idx] = updated;
        }
      } finally {
        abortControllers.delete(pending.id);
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