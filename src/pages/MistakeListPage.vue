<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">错题列表</h5>
      </div>
      <div class="col-auto q-gutter-xs">
        <q-btn flat dense no-caps icon="select_all" :label="allSelected ? '取消全选' : '全选'" color="grey" @click="toggleSelectAll" />
        <q-btn v-if="selectedIds.length > 0" flat dense icon="file_download" color="primary" :label="`导出所选 (${selectedIds.length})`" @click="exportSelected" no-caps unelevated />
        <q-btn flat dense no-caps icon="filter_list" label="筛选" @click="showFilter = !showFilter" :color="hasActiveFilters ? 'primary' : 'grey'" />
        <q-btn v-if="hasActiveFilters" flat dense no-caps icon="clear" label="重置" color="grey" @click="clearFilters" />
        <q-btn color="primary" icon="add" label="添加错题" @click="showAddDialog = true" no-caps unelevated />
      </div>
    </div>

    <div class="row q-mb-md" v-show="showFilter">
      <div class="col-12 col-md-3 q-pr-md q-mb-sm q-mb-md-none">
        <q-select v-model="filters.subject" :options="subjects" label="科目" clearable outlined dense />
      </div>
      <div class="col-12 col-md-3 q-pr-md q-mb-sm q-mb-md-none">
        <q-input v-model="filters.tags" label="标签" outlined dense />
      </div>
      <div class="col-12 col-md-3 q-pr-md q-mb-sm q-mb-md-none row items-center">
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
      <div class="col-12 col-md-3 q-mb-sm q-mb-md-none">
        <q-btn label="搜索" color="primary" unelevated class="full-width" @click="doSearch" />
        <q-btn v-if="hasActiveFilters" flat label="清除" color="grey" unelevated class="full-width q-mt-xs" @click="clearFilters" />
      </div>
    </div>

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

    <q-list bordered separator v-if="filteredMistakes.length > 0">
      <q-item v-for="mistake in filteredMistakes" :key="mistake.id" :class="{ 'bg-primary-mist': selectedIds.includes(mistake.id) }">
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
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">添加错题</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="scroll" style="max-height: 80vh">
          <div class="text-weight-medium q-mb-sm">题目图片</div>
          <ImageUploader ref="imageUploaderRef" @change="onImagesChanged" />
          <q-select v-model="form.subject" :options="subjects" label="科目" clearable outlined dense class="q-mb-md" />
          <q-input v-model="form.tagInput" label="标签（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addTag">
            <template v-slot:append><q-btn flat round dense icon="add" @click="addTag" /></template>
          </q-input>
          <div class="q-mb-md">
            <q-chip v-for="(tag, idx) in form.tags" :key="idx" removable @remove="form.tags.splice(idx, 1)" color="primary" text-color="white" size="sm">{{ tag }}</q-chip>
          </div>

          <div class="text-weight-medium q-mb-sm">答案</div>
          <q-input v-model="form.answer" label="答案（支持 Markdown）" outlined dense autogrow type="textarea" class="q-mb-md" placeholder="支持 **粗体** *斜体* `代码` - 列表" />
          <ImageUploader ref="answerUploaderRef" @change="onAnswerImagesChanged" />

          <q-select v-model="form.difficulty" :options="difficulties" label="难度" clearable outlined dense class="q-mb-md" />
          <q-input v-model="form.kpInput" label="知识点（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addKp">
            <template v-slot:append><q-btn flat round dense icon="add" @click="addKp" /></template>
          </q-input>
          <div class="q-mb-md">
            <q-chip v-for="(kp, idx) in form.knowledgePoints" :key="idx" removable @remove="form.knowledgePoints.splice(idx, 1)" color="secondary" text-color="white" size="sm">{{ kp }}</q-chip>
          </div>
          <q-input v-model="form.notes" label="备注" outlined dense autogrow type="textarea" class="q-mb-md" />
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="取消" v-close-popup />
          <q-btn color="primary" label="保存错题" :disable="!canSave" :loading="saving" @click="saveMistake" unelevated />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { uid } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import ImageUploader from '@/components/ImageUploader.vue';
import { compressToDataUrl } from '@/services/ocrService';
import { buildExportHtml } from '@/utils/markdown';

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const showAddDialog = ref(false);
const saving = ref(false);
const imageUploaderRef = ref<InstanceType<typeof ImageUploader>>();
const answerUploaderRef = ref<InstanceType<typeof ImageUploader>>();
const uploadedImages = ref<File[]>([]);
const uploadedAnswerImages = ref<File[]>([]);
const savedImageUrls = ref<string[]>([]);
const showFilter = ref(true);
const selectedIds = ref<string[]>([]);

const form = reactive({
  subject: null as string | null,
  tagInput: '',
  tags: [] as string[],
  answer: '',
  difficulty: null as string | null,
  kpInput: '',
  knowledgePoints: [] as string[],
  notes: '',
});

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const difficulties = ['简单', '中等', '困难'];

const filters = reactive({
  subject: null as string | null,
  tags: '',
  dateFrom: '',
  dateTo: '',
});

const reviewList = computed(() => mistakeStore.todayReviewMistakes);

const canSave = computed(() => uploadedImages.value.length > 0 || savedImageUrls.value.length > 0);

function addTag() {
  const t = form.tagInput.trim();
  if (t && !form.tags.includes(t)) {
    form.tags.push(t);
    form.tagInput = '';
  }
}

function addKp() {
  const k = form.kpInput.trim();
  if (k && !form.knowledgePoints.includes(k)) {
    form.knowledgePoints.push(k);
    form.kpInput = '';
  }
}

function onImagesChanged(files: File[]) {
  uploadedImages.value = files;
}

function onAnswerImagesChanged(files: File[]) {
  uploadedAnswerImages.value = files;
}

async function saveMistake() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const imageUrls: string[] = [];
    for (const file of uploadedImages.value) {
      imageUrls.push(await compressToDataUrl(file));
    }
    const answerImages: string[] = [];
    for (const file of uploadedAnswerImages.value) {
      answerImages.push(await compressToDataUrl(file));
    }
    const now = new Date().toISOString();
    const id = uid();
    const record = {
      id,
      title: `未命名错题 ${new Date().toLocaleDateString()}`,
      imageUrls,
      tags: [...form.tags],
      subject: form.subject || '',
      answer: form.answer,
      answerImages,
      difficulty: form.difficulty || '',
      knowledgePoints: [...form.knowledgePoints],
      notes: form.notes,
      aiAnalysis: null,
      ocrText: null,
      createdAt: now,
      updatedAt: now,
      reviewCount: 0,
      lastReviewAt: null,
      masteryLevel: null as string | null,
      sm2Data: null,
      linkedNoteIds: [],
      synced: false,
    };
    await mistakeStore.addMistake(record as any);
    showAddDialog.value = false;
    resetForm();
    $q.notify({ type: 'positive', message: '错题已保存', timeout: 2000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e.message}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.subject = null;
  form.tagInput = '';
  form.tags = [];
  form.answer = '';
  form.difficulty = null;
  form.kpInput = '';
  form.knowledgePoints = [];
  form.notes = '';
  uploadedImages.value = [];
  uploadedAnswerImages.value = [];
  savedImageUrls.value = [];
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

const filteredMistakes = computed(() => {
  let result = mistakeStore.mistakes;
  if (filters.subject) {
    result = result.filter(m => m.subject === filters.subject);
  }
  if (filters.tags) {
    const q = filters.tags.toLowerCase();
    result = result.filter(m => m.tags.some(t => t.toLowerCase().includes(q)));
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

const hasActiveFilters = computed(() =>
  filters.subject !== null || filters.tags !== '' || filters.dateFrom !== '' || filters.dateTo !== ''
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

function doSearch() {
  $q.notify({ type: 'info', message: `找到 ${filteredMistakes.value.length} 条结果`, timeout: 1500 });
}

function clearFilters() {
  filters.subject = null;
  filters.tags = '';
  filters.dateFrom = '';
  filters.dateTo = '';
  selectedIds.value = [];
}

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

function exportSelected() {
  if (selectedIds.value.length === 0) {
    $q.notify({ type: 'warning', message: '请先选择要导出的错题', timeout: 1500 });
    return;
  }
  const selected = mistakeStore.mistakes.filter(m => selectedIds.value.includes(m.id));
  const html = buildExportHtml(selected);
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

onMounted(async () => {
  await mistakeStore.fetchAll();
});
</script>
