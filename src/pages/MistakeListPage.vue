<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">错题列表</h5>
      </div>
      <div class="col-auto">
        <q-btn flat round dense icon="filter_list" class="lt-md q-mr-sm" @click="showMobileFilter = !showMobileFilter" />
        <q-btn color="primary" icon="add" label="添加错题" @click="showAddDialog = true" no-caps unelevated />
      </div>
    </div>

    <div class="row q-mb-md" :class="{ 'lt-md': !showMobileFilter }">
      <div class="col-12 col-md-3 q-pr-md q-mb-sm q-mb-md-none">
        <q-select v-model="filters.subject" :options="subjects" label="科目" clearable outlined dense />
      </div>
      <div class="col-12 col-md-3 q-pr-md q-mb-sm q-mb-md-none">
        <q-input v-model="filters.tags" label="标签" outlined dense />
      </div>
      <div class="col-12 col-md-3 q-pr-md q-mb-sm q-mb-md-none">
        <q-input v-model="filters.dateRange" label="时间范围 (YYYY-MM-DD~YYYY-MM-DD)" outlined dense>
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer" />
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
      <q-item v-for="mistake in filteredMistakes" :key="mistake.id" clickable :to="{ name: 'mistake-detail', params: { id: mistake.id } }">
        <q-item-section avatar>
          <div v-if="mistake.imageUrls[0]" class="rounded-borders" :style="{ width: '60px', height: '60px', backgroundImage: `url(${mistake.imageUrls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }" />
          <div v-else class="bg-grey-3 rounded-borders" style="width: 60px; height: 60px" />
        </q-item-section>
        <q-item-section>
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
          <ImageUploader ref="imageUploaderRef" @change="onImagesChanged" />
          <q-select v-model="form.subject" :options="subjects" label="科目" clearable outlined dense class="q-mb-md" />
          <q-input v-model="form.tagInput" label="标签（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addTag">
            <template v-slot:append><q-btn flat round dense icon="add" @click="addTag" /></template>
          </q-input>
          <div class="q-mb-md">
            <q-chip v-for="(tag, idx) in form.tags" :key="idx" removable @remove="form.tags.splice(idx, 1)" color="primary" text-color="white" size="sm">{{ tag }}</q-chip>
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

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const showAddDialog = ref(false);
const saving = ref(false);
const imageUploaderRef = ref<InstanceType<typeof ImageUploader>>();
const uploadedImages = ref<File[]>([]);
const savedImageUrls = ref<string[]>([]);
const showMobileFilter = ref(false);

const form = reactive({
  subject: null as string | null,
  tagInput: '',
  tags: [] as string[],
  notes: '',
});

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];

const filters = reactive({
  subject: null as string | null,
  tags: '',
  dateRange: '',
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

function onImagesChanged(files: File[]) {
  uploadedImages.value = files;
}

async function saveMistake() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const imageUrls: string[] = [];
    for (const file of uploadedImages.value) {
      const dataUrl = await compressToDataUrl(file);
      imageUrls.push(dataUrl);
    }
    const now = new Date().toISOString();
    const id = uid();
    const record = {
      id,
      title: `未命名错题 ${new Date().toLocaleDateString()}`,
      imageUrls,
      tags: [...form.tags],
      subject: form.subject || '',
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
  form.notes = '';
  uploadedImages.value = [];
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
    result = result.filter(m =>
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  if (filters.dateRange) {
    const parts = filters.dateRange.split(/[~\-\/]/).map(s => s.trim()).filter(Boolean);
    const from = parts[0] ? new Date(parts[0]).getTime() : null;
    const to = parts[1] ? new Date(parts[1]).getTime() + 86400000 : null;
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
  filters.subject !== null || filters.tags !== '' || filters.dateRange !== ''
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

async function doSearch() {
  $q.notify({ type: 'info', message: `找到 ${filteredMistakes.value.length} 条结果`, timeout: 1500 });
}

function clearFilters() {
  filters.subject = null;
  filters.tags = '';
  filters.dateRange = '';
}

onMounted(async () => {
  await mistakeStore.fetchAll();
});
</script>
