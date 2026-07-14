<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">处理队列</h5>
      </div>
      <div class="col-auto q-gutter-xs">
        <q-badge color="info" class="q-px-sm q-py-xs" v-if="pendingCount > 0">
          {{ pendingCount }} 等待中
        </q-badge>
        <q-badge color="warning" class="q-px-sm q-py-xs" v-if="processingCount > 0">
          {{ processingCount }} 处理中
        </q-badge>
        <q-btn flat dense no-caps icon="refresh" label="刷新" color="grey" @click="refresh" />
        <q-btn flat dense no-caps icon="clear_all" label="清除已完成" color="grey" @click="handleClearCompleted" :disable="completedCount === 0" />
      </div>
    </div>

    <q-tabs v-model="queueType" dense align="left" class="q-mb-sm" active-color="primary" indicator-color="primary">
      <q-tab name="recognition" label="识别队列" icon="document_scanner" />
      <q-tab name="analysis" label="解析队列" icon="psychology" />
    </q-tabs>

    <div v-if="filteredItems.length === 0" class="text-center q-mt-xl text-grey">
      <q-icon name="queue" size="64px" />
      <p class="q-mt-sm">暂无待处理项</p>
      <p class="text-caption">{{ queueType === 'recognition' ? '在添加错题页面使用「AI 识别」截图后，任务会出现在这里' : '在编辑错题页面使用「AI 解析」后，任务会出现在这里' }}</p>
    </div>

    <q-list bordered separator v-else>
      <q-item v-for="item in filteredItems" :key="item.id" :class="{ 'bg-grey-2': item.status === 'processing' }">
        <q-item-section avatar v-if="item.type === 'recognition'">
          <img :src="item.imageData" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px;" />
        </q-item-section>
        <q-item-section avatar v-else>
          <q-icon name="psychology" color="primary" size="md" />
        </q-item-section>

        <q-item-section clickable @click="toggleExpand(item.id)">
          <q-item-label>
            <q-badge :color="statusColor(item.status)" class="q-mr-sm">{{ statusLabel(item.status) }}</q-badge>
            <span class="text-caption text-grey">{{ formatDate(item.createdAt) }}</span>
          </q-item-label>
          <q-item-label caption lines="1" v-if="item.status === 'completed' && item.resultContent">
            {{ item.resultContent.slice(0, 80) }}…
          </q-item-label>
          <q-item-label caption class="text-negative" v-else-if="item.status === 'failed' && item.error">
            {{ item.error }}
          </q-item-label>
          <q-item-label caption v-else-if="item.mistakeId">
            关联错题
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="q-gutter-xs">
            <q-btn v-if="item.status === 'pending'" flat dense icon="cancel" color="negative" size="sm" @click="queue.cancelItem(item.id)" />
            <q-btn v-if="item.status === 'failed'" flat dense icon="refresh" color="warning" size="sm" @click="queue.retryItem(item.id)" />
            <q-btn v-if="item.status === 'completed'" flat dense icon="check_circle" color="positive" size="sm" @click="applyResult(item)" />
            <q-btn flat dense icon="delete" color="grey" size="sm" @click="queue.removeItem(item.id)" />
          </div>
        </q-item-section>

        <!-- Expanded detail -->
        <template v-if="expandedId === item.id && item.status === 'completed'">
          <q-item-section>
            <q-separator class="q-my-sm" />
            <div v-if="item.type === 'recognition'" class="q-mb-md">
              <div
                v-for="(q, qi) in (item.resultQuestions && item.resultQuestions.length ? item.resultQuestions : [singleResult(item)])"
                :key="qi"
                class="q-mb-md"
              >
                <div class="text-caption text-grey q-mb-xs" v-if="(item.resultQuestions?.length || 0) > 1">第 {{ qi + 1 }} 题</div>
                <div class="markdown-preview bg-grey-1 q-pa-sm rounded-borders" style="max-height: 200px; overflow-y: auto; font-size: 13px;" v-html="renderMd(q.content || '')" />
                <div class="q-mt-xs q-gutter-xs">
                  <q-chip v-if="q.difficulty" size="sm" icon="star" color="orange">{{ q.difficulty }} 星</q-chip>
                  <q-chip v-if="q.subject" size="sm" color="teal">{{ q.subject }}</q-chip>
                  <q-chip v-for="kp in q.knowledgeAreas" :key="kp" size="sm" color="primary">{{ kp }}</q-chip>
                </div>
              </div>
              <div v-if="(item.resultQuestions?.length || 0) > 1" class="text-caption text-grey q-mt-xs">
                共 {{ item.resultQuestions!.length }} 道题，点击「应用」将一次性创建。
              </div>
            </div>
            <div v-else class="q-mb-md">
              <div class="markdown-preview bg-grey-1 q-pa-sm rounded-borders" style="max-height: 300px; overflow-y: auto; font-size: 13px;" v-html="renderMd(item.resultContent || '')" />
            </div>
          </q-item-section>
        </template>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { uid } from 'quasar';
import { useQueueStore } from '@/stores/queueStore';
import { useMistakeStore } from '@/stores/mistakeStore';
import { renderMarkdown } from '@/utils/markdown';
import { addMistake } from '@/services/mistakeService';
import type { AiQueueItem } from '@/services/aiQueueService';

const $q = useQuasar();
const router = useRouter();
const queue = useQueueStore();
const mistakeStore = useMistakeStore();

const expandedId = ref<string | null>(null);
const queueType = ref<'recognition' | 'analysis'>('recognition');

const filteredItems = computed(() => {
  return queue.items.filter(i => i.type === queueType.value);
});

const pendingCount = computed(() => filteredItems.value.filter(i => i.status === 'pending').length);
const processingCount = computed(() => filteredItems.value.filter(i => i.status === 'processing').length);
const completedCount = computed(() => filteredItems.value.filter(i => i.status === 'completed').length);

onMounted(async () => {
  await queue.fetchAll();
  queue.startPolling();
});

onUnmounted(() => {
  queue.stopPolling();
});

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    pending: 'grey',
    processing: 'warning',
    completed: 'positive',
    failed: 'negative',
    cancelled: 'grey-5',
  };
  return map[s] || 'grey';
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: '等待',
    processing: '处理中',
    completed: '完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[s] || s;
}

function formatDate(d: string): string {
  return d ? d.slice(0, 16).replace('T', ' ') : '';
}

async function refresh() {
  await queue.fetchAll();
}

async function handleClearCompleted() {
  await queue.clearCompleted();
  $q.notify({ type: 'positive', message: '已清除', timeout: 1500 });
}

function renderMd(text: string): string {
  return renderMarkdown(text);
}

function singleResult(item: AiQueueItem) {
  return {
    content: item.resultContent || '',
    subject: item.resultSubject || '',
    difficulty: item.resultDifficulty || 0,
    knowledgeAreas: item.resultKnowledgeAreas || [],
  };
}

async function applyResult(item: AiQueueItem) {
  if (item.type === 'analysis') {
    if (item.mistakeId) {
      await queue.removeItem(item.id);
      router.push({ name: 'mistake-detail', params: { id: item.mistakeId } });
    } else if (item.resultContent) {
      const now = new Date().toISOString();
      const id = uid();
      const record = {
        id,
        title: (item.imageData || '').split('\n')[0]?.replace(/[#*`$]/g, '').trim().slice(0, 30) || `错题 ${now.slice(0, 10)}`,
        content: item.imageData || '',
        imageUrls: [],
        tags: [],
        subject: '',
        answer: item.resultContent,
        answerImages: [],
        difficulty: 0,
        knowledgePoints: [],
        year: '',
        knowledgeAreas: [],
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
      await mistakeStore.fetchAll();
      await queue.removeItem(item.id);
      $q.notify({
        type: 'positive',
        message: '已创建错题',
        timeout: 2000,
        actions: [{ label: '查看', color: 'white', handler: () => router.push({ name: 'mistake-detail', params: { id } }) }],
      });
    }
    return;
  }

  const questions =
    item.resultQuestions && item.resultQuestions.length
      ? item.resultQuestions
      : [singleResult(item)];
  if (!questions.length || !questions[0].content) return;
  try {
    const now = new Date().toISOString();
    // Save the original (pre-recognition) image once and reference it in each generated mistake
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
      } catch {
        // ignore image save failure, still create the mistake
      }
    }
    const created: string[] = [];
    for (const q of questions) {
      const id = uid();
      const record = {
        id,
        title: (q.content || '').split('\n')[0]?.replace(/[#*`$]/g, '').trim().slice(0, 30) || `错题 ${now.slice(0, 10)}`,
        content: q.content + (imageRef ? `\n\n${imageRef}` : ''),
        imageUrls: [],
        tags: [],
        subject: q.subject || '',
        answer: '',
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
      created.push(id);
    }
    await mistakeStore.fetchAll();
    await queue.removeItem(item.id);
    $q.notify({
      type: 'positive',
      message: `已创建 ${created.length} 道错题`,
      timeout: 2000,
      actions: created.length
        ? [{ label: '查看', color: 'white', handler: () => router.push({ name: 'mistake-detail', params: { id: created[0] } }) }]
        : [],
    });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `创建错题失败：${e?.message || String(e)}`, timeout: 3000 });
  }
}
</script>
