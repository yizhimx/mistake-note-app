<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">错题列表</h5>
      </div>
      <div class="col-auto q-gutter-xs">
        <q-btn flat dense no-caps icon="select_all" :label="allSelected ? '取消全选' : '全选'" color="grey" @click="toggleSelectAll" />
        <q-btn v-if="selectedIds.length > 0" flat dense icon="file_download" color="primary" :label="`导出所选 (${selectedIds.length})`" @click="exportSelected" no-caps unelevated />
        <q-btn v-if="selectedIds.length > 0" flat dense icon="auto_awesome" color="secondary" :label="`批量识别 (${selectedIds.length})`" @click="batchRecognitionSelected" no-caps unelevated :loading="batchQueuing" :disable="batchQueuing" />
        <q-btn v-if="selectedIds.length > 0" flat dense icon="delete" color="negative" :label="`删除所选 (${selectedIds.length})`" @click="batchDeleteMistakes" no-caps unelevated />
        <q-btn flat dense no-caps icon="filter_list" label="筛选" @click="showFilter = !showFilter" :color="hasActiveFilters ? 'primary' : 'grey'" />
        <q-btn v-if="hasActiveFilters" flat dense no-caps icon="clear" label="重置" color="grey" @click="clearFilters" />
        <q-btn color="secondary" no-caps unelevated icon="auto_awesome" label="批量导入" @click="showBatchImport = true" class="q-mr-sm" />
        <q-btn color="primary" icon="add" label="添加错题" @click="showAddDialog = true" no-caps unelevated />
      </div>
    </div>

    <q-slide-transition>
      <div v-show="showFilter">
        <div class="row q-col-gutter-sm q-mb-sm">
          <div class="col-12">
            <q-input v-model="filters.content" label="搜索题目内容" outlined dense clearable placeholder="输入关键词搜索..." />
          </div>
        </div>
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-md-3">
            <q-select v-model="filters.subject" :options="subjects" label="科目" clearable outlined dense />
          </div>
          <div class="col-12 col-md-3">
            <q-input v-model="filters.tags" label="标签" outlined dense clearable />
          </div>
          <div class="col-12 col-md-3">
            <q-select v-model="filters.difficulty" :options="difficultyOptions" label="难度" clearable outlined dense multiple emit-value map-options @clear="filters.difficulty = []" />
          </div>
          <div class="col-12 col-md-3 row items-center">
            <q-input v-model="filters.dateFrom" label="起始日期" outlined dense class="col" mask="####-##-##" :rules="[]">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="filters.dateFrom" mask="YYYY-MM-DD" bordered>
                      <div class="row items-center justify-end">
                        <q-btn flat label="确定" color="primary" v-close-popup />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <span class="q-mx-sm text-grey">~</span>
            <q-input v-model="filters.dateTo" label="结束日期" outlined dense class="col" mask="####-##-##" :rules="[]">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="filters.dateTo" mask="YYYY-MM-DD" bordered>
                      <div class="row items-center justify-end">
                        <q-btn flat label="确定" color="primary" v-close-popup />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <div class="col-12 col-md-3 q-mb-sm">
            <q-checkbox v-model="filters.noContent" label="仅显示未添加题目的" dense />
          </div>
          <div class="col-12 col-md-3 q-mb-sm">
            <q-btn v-if="filters.noContent && filteredMistakes.length > 0" icon="auto_awesome" label="全部加入识别队列" no-caps unelevated color="primary"
              @click="batchAddToQueue" :disable="batchQueuing" :loading="batchQueuing" />
          </div>
        </div>
        <div class="row q-mb-md">
          <div class="col-12 col-md-4 q-mb-sm">
            <q-btn v-if="hasActiveFilters" flat no-caps icon="clear" label="清除筛选" color="grey" @click="clearFilters" unelevated />
          </div>
        </div>
      </div>
    </q-slide-transition>

    <div v-if="reviewList.length > 0" class="q-mb-lg">
      <div class="row items-center q-mb-sm">
        <h6 class="q-my-none text-weight-medium">今日复习 ({{ reviewList.length }})</h6>
        <q-space />
        <q-btn flat color="primary" label="开始回顾" :to="{ name: 'review' }" no-caps unelevated />
      </div>
      <q-list bordered separator>
        <q-item v-for="m in reviewList" :key="m.id" clickable :to="{ name: 'mistake-detail', params: { id: m.id } }">
          <q-item-section avatar>
            <div v-if="m.imageUrls[0]" class="rounded-borders" :style="{ width: '50px', height: '50px', backgroundImage: `url(${m.imageUrls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }" />
            <div v-else class="bg-grey-3 rounded-borders" style="width: 50px; height: 50px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ m.title }}</q-item-label>
            <q-item-label caption>{{ m.subject || '未分类' }} · 复习 {{ m.reviewCount }} 次</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <q-separator class="q-my-md" />
    </div>

    <q-list bordered separator v-if="paginatedMistakes.length > 0">
      <q-item v-for="mistake in paginatedMistakes" :key="mistake.id" :class="{ 'bg-primary-mist': selectedIds.includes(mistake.id) }">
        <q-item-section side>
          <q-checkbox :model-value="selectedIds.includes(mistake.id)" @update:model-value="toggleSelect(mistake.id)" dense />
        </q-item-section>
          <q-item-section @click="$router.push({ name: 'mistake-detail', params: { id: mistake.id } })" style="cursor:pointer">
          <q-item-label>{{ mistake.title }}</q-item-label>
          <q-item-label caption lines="1">{{ mistake.tags?.join(', ') }}</q-item-label>
          <q-item-label caption class="text-weight-medium" :class="masteryClass(mistake.masteryLevel)">
            {{ masterLabel(mistake.masteryLevel) }} · 复习 {{ mistake.reviewCount }} 次 · {{ formatDate(mistake.createdAt) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round icon="more_vert">
              <q-menu auto-close>
                <q-list>
                  <q-item clickable @click="deleteMistake(mistake.id)">
                    <q-item-section class="text-negative">删除</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="totalPages > 1" class="row justify-center q-mt-md">
      <q-pagination
        v-model="currentPage"
        :max="totalPages"
        :max-pages="7"
        direction-links
        boundary-links
        icon-first="skip_previous"
        icon-last="skip_next"
        icon-prev="chevron_left"
        icon-next="chevron_right"
      />
    </div>

    <div v-if="mistakeStore.mistakes.length > 0 && filteredMistakes.length === 0" class="text-center q-mt-xl text-grey">
      <q-icon name="search_off" size="64px" />
      <p class="q-mt-sm">没有匹配的错题</p>
      <q-btn flat label="清除筛选" color="primary" @click="clearFilters" no-caps />
    </div>
    <div v-else-if="mistakeStore.mistakes.length === 0" class="text-center q-mt-xl text-grey">
      <q-icon name="error_outline" size="64px" />
      <p class="q-mt-sm">暂无错题记录</p>
      <q-btn color="primary" label="添加第一道错题" @click="showAddDialog = true" />
    </div>

    <q-dialog v-model="showAddDialog" maximized persistent>
      <MistakeForm
        ref="mistakeFormRef"
        mode="add"
        @save="handleAddSave"
        @cancel="showAddDialog = false"
      />
    </q-dialog>

    <BatchMistakeImportDialog v-model="showBatchImport" @imported="onBatchImported" />
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { uid } from 'quasar';
import MistakeForm from '@/components/MistakeForm.vue';
import BatchMistakeImportDialog from '@/components/BatchMistakeImportDialog.vue';
import { useMistakeStore } from '@/stores/mistakeStore';
import { useQueueStore } from '@/stores/queueStore';
import { loadImage } from '@/services/imageStore';
import { buildExportHtml } from '@/utils/markdown';

const $q = useQuasar();
const mistakeStore = useMistakeStore();
const queueStore = useQueueStore();

const showAddDialog = ref(false);
const showBatchImport = ref(false);

const showFilter = ref(true);
const selectedIds = ref<string[]>([]);
const mistakeFormRef = ref<any>(null);
const batchQueuing = ref(false);

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];

const difficultyOptions = [
  { label: '1 星', value: 1 },
  { label: '2 星', value: 2 },
  { label: '3 星', value: 3 },
  { label: '4 星', value: 4 },
  { label: '5 星', value: 5 },
];

const filters = reactive({
  subject: null as string | null,
  tags: '',
  content: '',
  difficulty: [] as number[],
  noContent: false,
  dateFrom: '',
  dateTo: '',
});

const currentPage = ref(1);
const pageSize = 10;

const reviewList = computed(() => mistakeStore.todayReviewMistakes);

onMounted(async () => {
  await mistakeStore.fetchAll();
});

async function handleAddSave(data: Record<string, any>) {
  try {
    const title = data.title?.trim() || (() => {
      const firstLine = (data.content || '').trim().split('\n')[0] || '';
      const stripped = firstLine.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`$]/g, '').trim();
      return stripped.slice(0, 30) || `错题 ${new Date().toLocaleDateString()}`;
    })();

    const now = new Date().toISOString();
    const id = uid();
    const record = {
      id,
      title,
      content: data.content,
      imageUrls: [],
      tags: data.tags || [],
      subject: data.subject || '',
      answer: data.answer || '',
      answerImages: [],
      difficulty: data.difficulty || 0,
      knowledgePoints: data.knowledgePoints || [],
      year: data.year || '',
      knowledgeAreas: data.knowledgeAreas || [],
      sourcePaperType: data.sourcePaperType || '',
      sourcePaperName: data.sourcePaperName || '',
      questionNumber: data.questionNumber || '',
      notes: data.notes || '',
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
    await mistakeStore.addMistake(record as any);
    showAddDialog.value = false;
    mistakeFormRef.value?.resetForm();
    $q.notify({ type: 'positive', message: '错题已保存', timeout: 2000 });
  } catch (e: any) {
    console.error('Save error:', e);
    $q.notify({ type: 'negative', message: `保存失败：${e?.message || String(e) || '未知错误'}`, timeout: 3000 });
  }
}

function onBatchImported(count: number) {
  $q.notify({ type: 'positive', message: `成功导入 ${count} 道错题`, timeout: 2000 });
}

async function resolveImageUrl(url: string): Promise<string> {
  if (url.startsWith('local:')) {
    const resolved = await loadImage(url);
    return resolved || url;
  }
  return url;
}

async function batchAddToQueue() {
  const target = filteredMistakes.value.filter(m => m.imageUrls?.[0]);
  if (target.length === 0) {
    $q.notify({ type: 'warning', message: '筛选结果中没有任何包含图片的题目', timeout: 2500 });
    return;
  }
  batchQueuing.value = true;
  try {
    let count = 0;
    for (const m of target) {
      const dataUrl = await resolveImageUrl(m.imageUrls[0]!);
      await queueStore.addToQueue(dataUrl, m.id);
      count++;
    }
    $q.notify({ type: 'positive', message: `已将 ${count} 道题目加入识别队列（完成后自动填充）`, timeout: 3000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `批量加入队列失败：${e?.message || String(e)}`, timeout: 3500 });
  } finally {
    batchQueuing.value = false;
  }
}

async function batchRecognitionSelected() {
  const targets = mistakeStore.mistakes.filter(m => selectedIds.value.includes(m.id));
  const withImage = targets.filter(m => m.imageUrls?.[0]);
  const skipped = targets.length - withImage.length;
  if (withImage.length === 0) {
    $q.notify({ type: 'warning', message: '所选题目均无图片', timeout: 2500 });
    return;
  }
  batchQueuing.value = true;
  try {
    let count = 0;
    for (const m of withImage) {
      const dataUrl = await resolveImageUrl(m.imageUrls[0]!);
      await queueStore.addToQueue(dataUrl, m.id);
      count++;
    }
    const msg = skipped > 0
      ? `已将 ${count} 道加入识别队列（${skipped} 道无图片已跳过）`
      : `已将 ${count} 道题目加入识别队列`;
    $q.notify({ type: 'positive', message: msg, timeout: 3000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `批量识别失败：${e?.message || String(e)}`, timeout: 3500 });
  } finally {
    batchQueuing.value = false;
  }
}

function deleteMistake(id: string) {
  $q.dialog({
    title: '确认删除',
    message: '确定要删除这道错题吗？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await mistakeStore.removeMistake(id);
    $q.notify({ type: 'positive', message: '已删除', timeout: 1500 });
  });
}

async function batchDeleteMistakes() {
  const ids = [...selectedIds.value];
  $q.dialog({
    title: '确认批量删除',
    message: `确定要删除 ${ids.length} 道错题吗？此操作不可恢复。`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      for (const id of ids) {
        await mistakeStore.removeMistake(id);
      }
      selectedIds.value = [];
      await mistakeStore.fetchAll();
      $q.notify({ type: 'positive', message: `已删除 ${ids.length} 道错题`, timeout: 2000 });
    } catch (e: any) {
      $q.notify({ type: 'negative', message: `删除失败：${e?.message || String(e)}`, timeout: 3000 });
    }
  });
}

const filteredMistakes = computed(() => {
  let result = mistakeStore.mistakes;
  if (filters.subject) {
    result = result.filter(m => m.subject === filters.subject);
  }
  if (filters.tags) {
    const q = filters.tags.toLowerCase();
    result = result.filter(m => m.tags.some(t => t.toLowerCase().includes(q)));
  }
  if (filters.content) {
    const q = filters.content.toLowerCase();
    result = result.filter(m => (m.content || '').toLowerCase().includes(q) || (m.title || '').toLowerCase().includes(q));
  }
  if (filters.difficulty.length > 0) {
    result = result.filter(m => filters.difficulty.includes(m.difficulty || 0));
  }
  if (filters.noContent) {
    result = result.filter(m => !m.content || !m.content.trim());
  }
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
    const to = filters.dateTo ? new Date(filters.dateTo).getTime() + 86400000 : null;
    result = result.filter(m => {
      const d = new Date(m.createdAt).getTime();
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  return result;
});

const paginatedMistakes = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredMistakes.value.slice(start, start + pageSize);
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredMistakes.value.length / pageSize)));

const hasActiveFilters = computed(() =>
  filters.subject !== null || filters.tags !== '' || filters.content !== '' || filters.difficulty.length > 0 || filters.noContent || filters.dateFrom !== '' || filters.dateTo !== ''
);

function masterLabel(level: string | null): string {
  const map: Record<string, string> = { fresh: '生疏', hesitant: '犹豫', smooth: '顺利' };
  return level ? map[level] || '未掌握' : '未掌握';
}

function masteryClass(level: string | null): string {
  const map: Record<string, string> = { fresh: 'text-negative', hesitant: 'text-orange', smooth: 'text-positive' };
  return level ? map[level] || '' : '';
}

function formatDate(d: string): string {
  return d ? d.slice(0, 10) : '';
}

function clearFilters() {
  filters.subject = null;
  filters.tags = '';
  filters.content = '';
  filters.difficulty = [];
  filters.noContent = false;
  filters.dateFrom = '';
  filters.dateTo = '';
  currentPage.value = 1;
  selectedIds.value = [];
}

// 筛选条件变化时重置到第一页
watch([() => filters.subject, () => filters.tags, () => filters.content, () => filters.difficulty, () => filters.noContent, () => filters.dateFrom, () => filters.dateTo], () => {
  currentPage.value = 1;
  selectedIds.value = [];
});

const allSelected = computed(() =>
  filteredMistakes.value.length > 0 && filteredMistakes.value.every(m => selectedIds.value.includes(m.id))
);

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = filteredMistakes.value.map(m => m.id);
  }
}

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) selectedIds.value.splice(idx, 1);
  else selectedIds.value.push(id);
}

async function exportSelected() {
  if (selectedIds.value.length === 0) {
    $q.notify({ type: 'warning', message: '请先选择要导出的错题', timeout: 1500 });
    return;
  }
  const selected = mistakeStore.mistakes.filter(m => selectedIds.value.includes(m.id));
  const html = await buildExportHtml(selected);
  if (window.electronAPI?.exportPdf) {
    window.electronAPI.exportPdf(html).then((saved: boolean) => {
      if (saved) $q.notify({ type: 'positive', message: 'PDF 已导出', timeout: 2000 });
    });
  } else {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  }
}
</script>
