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
      <q-card class="full-height">
        <q-card-section class="row items-center q-pb-none q-pb-sm">
          <div class="text-h6">添加错题</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section class="scroll" style="height: calc(100vh - 100px)">
          <div class="row q-gutter-sm" style="min-height: 100%">
            <div class="col-12 col-md-8">
              <div class="text-weight-medium q-mb-sm">单题详情</div>
              <div class="row q-col-gutter-sm q-mb-md">
                <div class="col-12">
                  <q-input v-model="form.title" label="标题" outlined dense placeholder="给这道错题起个标题（可选，留空则从题目内容自动提取）" />
                </div>
                <div class="col-4">
                  <q-select v-model="form.subject" :options="subjects" label="科目" clearable outlined dense @update:model-value="onSubjectChange" />
                </div>
                <div class="col-4">
                  <q-select v-model="form.year" :options="yearOptions" label="年份" clearable outlined dense />
                </div>
                <div class="col-4">
                  <q-select v-model="form.knowledgeArea" :options="knowledgeAreas" label="知识板块" clearable outlined dense :disable="!form.subject" />
                </div>
                <div class="col-4">
                  <q-select v-model="form.sourcePaperType" :options="paperTypes" label="试卷类型" clearable outlined dense />
                </div>
                <div class="col-4">
                  <q-input v-model="form.sourcePaperName" label="来源试卷名称" outlined dense />
                </div>
                <div class="col-4">
                  <q-input v-model="form.questionNumber" label="题号" outlined dense />
                </div>
              </div>

              <q-separator class="q-mb-md" />

              <div class="text-weight-medium q-mb-sm">附加属性</div>
              <div class="row q-col-gutter-sm q-mb-md">
                <div class="col-4">
                  <div class="text-caption q-mb-xs">难度</div>
                  <q-rating v-model="form.difficulty" :max="5" size="1.5em" icon="star_border" icon-selected="star" color="orange" />
                </div>
                <div class="col-8">
                  <q-input v-model="form.tagInput" label="标签（回车添加）" outlined dense @keydown.enter.prevent="addTag">
                    <template v-slot:append><q-btn flat round dense icon="add" @click="addTag" /></template>
                  </q-input>
                </div>
              </div>
              <div class="q-mb-md">
                <q-chip v-for="(tag, idx) in form.tags" :key="idx" removable @remove="form.tags.splice(idx, 1)" color="primary" text-color="white" size="sm">{{ tag }}</q-chip>
              </div>
              <q-input v-model="form.notes" label="备注" outlined dense autogrow type="textarea" class="q-mb-md" />

              <q-separator class="q-mb-md" />

              <div class="row items-center q-mb-sm">
                <div class="text-weight-medium">题目内容 (Markdown)</div>
                <q-space />
                <q-btn flat dense no-caps icon="auto_awesome" label="文字识别" color="primary" size="sm" @click="runOcr" />
              </div>
              <div class="toolbar q-mb-xs q-gutter-xs">
                <q-btn flat dense size="sm" icon="format_bold" @click="insertMarkdown('**', '**')" />
                <q-btn flat dense size="sm" icon="format_italic" @click="insertMarkdown('*', '*')" />
                <q-btn flat dense size="sm" icon="code" @click="insertMarkdown('`', '`')" />
                <q-btn flat dense size="sm" icon="functions" @click="insertMarkdown('$$', '$$')" />
                <q-btn flat dense size="sm" icon="image" @click="insertImage" />
                <q-btn flat dense size="sm" icon="content_paste" color="grey" title="粘贴图片 (Ctrl+V)" @click="pasteImageFromClipboard('content')" />
              </div>
              <q-input ref="contentEditorRef" v-model="form.content" outlined dense autogrow type="textarea" class="q-mb-md font-mono content-editor" placeholder="用 Markdown 编写题目内容，支持 LaTeX：$\int_a^b f(x)dx$（Ctrl+V 可粘贴图片）" input-style="min-height: 120px; font-family: monospace; font-size: 13px" @paste="onContentPaste" />

              <div class="text-weight-medium q-mb-sm">答案 (Markdown)</div>
              <div class="toolbar q-mb-xs q-gutter-xs">
                <q-btn flat dense size="sm" icon="format_bold" @click="insertAnswerMarkdown('**', '**')" />
                <q-btn flat dense size="sm" icon="format_italic" @click="insertAnswerMarkdown('*', '*')" />
                <q-btn flat dense size="sm" icon="code" @click="insertAnswerMarkdown('`', '`')" />
                <q-btn flat dense size="sm" icon="functions" @click="insertAnswerMarkdown('$$', '$$')" />
                <q-btn flat dense size="sm" icon="image" @click="insertAnswerImage" />
                <q-btn flat dense size="sm" icon="content_paste" color="grey" title="粘贴图片 (Ctrl+V)" @click="pasteImageFromClipboard('answer')" />
              </div>
              <q-input ref="answerEditorRef" v-model="form.answer" outlined dense autogrow type="textarea" class="q-mb-md font-mono answer-editor" placeholder="答案内容，支持 Markdown 和 LaTeX（Ctrl+V 可粘贴图片）" input-style="min-height: 100px; font-family: monospace; font-size: 13px" @paste="onAnswerPaste" />
            </div>

            <!-- Right: Preview + Save -->
            <div class="col-12 col-md-4">
              <div class="text-weight-medium q-mb-sm">实时预览</div>
              <div class="rounded-borders bg-grey-1 q-pa-sm" style="min-height: 200px; max-height: calc(100vh - 300px); overflow-y: auto; border: 1px solid #ddd">
                <div class="markdown-preview" v-html="renderedPreview" />
              </div>
              <q-separator class="q-my-md" />
              <q-btn color="primary" label="保存错题" :disable="!canSave" :loading="saving" @click="saveMistake" unelevated class="full-width" />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { uid } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import { compressToDataUrl } from '@/services/ocrService';
import { saveImage } from '@/services/imageStore';
import { renderMarkdown, buildExportHtml } from '@/utils/markdown';

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const showAddDialog = ref(false);
const saving = ref(false);

const showFilter = ref(true);
const selectedIds = ref<string[]>([]);

const form = reactive({
  title: '',
  subject: null as string | null,
  tagInput: '',
  tags: [] as string[],
  content: '',
  answer: '',
  difficulty: 0,
  kpInput: '',
  knowledgePoints: [] as string[],
  notes: '',
  year: null as string | null,
  knowledgeArea: null as string | null,
  sourcePaperType: null as string | null,
  sourcePaperName: '',
  questionNumber: '',
});

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const yearOptions = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));
const paperTypes = ['月考', '期中', '期末', '模拟', '高考真题', '竞赛', '单元测试', '其他'];

// 知识板块按科目分类
const subjectKnowledgeAreas: Record<string, string[]> = {
  '数学': ['代数', '几何', '函数', '概率统计', '数列', '三角', '向量', '解析几何', '立体几何', '其他'],
  '物理': ['力学', '热学', '电磁学', '光学', '原子物理', '其他'],
  '化学': ['无机化学', '有机化学', '物理化学', '分析化学', '其他'],
  '英语': ['语法', '词汇', '阅读', '完形填空', '写作', '听力', '其他'],
  '语文': ['现代文阅读', '古诗文', '作文', '语言运用', '其他'],
  '生物': ['细胞生物学', '遗传学', '生态学', '进化', '其他'],
  '历史': ['中国古代史', '中国近现代史', '世界史', '其他'],
  '地理': ['自然地理', '人文地理', '区域地理', '其他'],
  '政治': ['经济生活', '政治生活', '文化生活', '哲学', '其他'],
};

const knowledgeAreas = computed(() => {
  if (!form.subject) return [];
  return subjectKnowledgeAreas[form.subject] || [];
});

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
  dateFrom: '',
  dateTo: '',
});

const currentPage = ref(1);
const pageSize = 10;

const reviewList = computed(() => mistakeStore.todayReviewMistakes);

const canSave = computed(() => form.content.trim().length > 0);

const renderedPreview = computed(() => {
  return form.content ? renderMarkdown(form.content) : '<span class="text-grey">输入题目内容后预览</span>';
});

const contentEditorRef = ref<any>(null);
const answerEditorRef = ref<any>(null);

onMounted(async () => {
  await mistakeStore.fetchAll();
});

function getContentTextarea(): HTMLTextAreaElement | null {
  return contentEditorRef.value?.$el?.querySelector('textarea') || null;
}

function getAnswerTextarea(): HTMLTextAreaElement | null {
  return answerEditorRef.value?.$el?.querySelector('textarea') || null;
}

async function compressAndSaveImage(file: File): Promise<string> {
  const dataUrl = await compressToDataUrl(file);
  return await saveImage(dataUrl);
}

function insertImageRef(ref: string, target: 'content' | 'answer') {
  const setText = (v: string) => {
    if (target === 'content') form.content = v;
    else form.answer = v;
  };
  const text = target === 'content' ? form.content : form.answer;
  const el = target === 'content' ? getContentTextarea() : getAnswerTextarea();
  if (el) {
    const start = el.selectionStart;
    const tag = `![图片](${ref})`;
    setText(text.slice(0, start) + tag + text.slice(start));
    nextTick(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); });
  } else {
    setText(text + `\n![图片](${ref})\n`);
  }
}

function onContentPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      e.preventDefault();
      const file = items[i].getAsFile();
      if (!file) continue;
      compressAndSaveImage(file).then(ref => insertImageRef(ref, 'content'));
      break;
    }
  }
}

function onAnswerPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      e.preventDefault();
      const file = items[i].getAsFile();
      if (!file) continue;
      compressAndSaveImage(file).then(ref => insertImageRef(ref, 'answer'));
      break;
    }
  }
}

function insertMarkdown(before: string, after: string) {
  const el = getContentTextarea();
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = form.content;
  form.content = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
  nextTick(() => { el.focus(); el.setSelectionRange(start + before.length, end + before.length); });
}

async function insertImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const ref = await compressAndSaveImage(file);
    insertImageRef(ref, 'content');
  };
  input.click();
}

function insertAnswerMarkdown(before: string, after: string) {
  const el = getAnswerTextarea();
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = form.answer;
  form.answer = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
  nextTick(() => { el.focus(); el.setSelectionRange(start + before.length, end + before.length); });
}

async function insertAnswerImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const ref = await compressAndSaveImage(file);
    insertImageRef(ref, 'answer');
  };
  input.click();
}

function runOcr() {
  $q.notify({ type: 'info', message: 'OCR 功能将在后续版本接入', timeout: 2000 });
}

function addTag() {
  const t = form.tagInput.trim();
  if (t && !form.tags.includes(t)) {
    form.tags.push(t);
    form.tagInput = '';
  }
}

function onSubjectChange() {
  // 切换科目时清空知识板块（因为不同科目对应不同知识板块）
  form.knowledgeArea = null;
}

function addKp() {
  const k = form.kpInput.trim();
  if (k && !form.knowledgePoints.includes(k)) {
    form.knowledgePoints.push(k);
    form.kpInput = '';
  }
}

async function saveMistake() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const title = form.title.trim() || (() => {
      const firstLine = form.content.trim().split('\n')[0] || '';
      const stripped = firstLine.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`$]/g, '').trim();
      return stripped.slice(0, 30) || `错题 ${new Date().toLocaleDateString()}`;
    })();

    const now = new Date().toISOString();
    const id = uid();
    const record = {
      id,
      title,
      content: form.content,
      imageUrls: [],
      tags: [...form.tags],
      subject: form.subject || '',
      answer: form.answer,
      answerImages: [],
      difficulty: form.difficulty,
      knowledgePoints: [...form.knowledgePoints],
      year: form.year || '',
      knowledgeArea: form.knowledgeArea || '',
      sourcePaperType: form.sourcePaperType || '',
      sourcePaperName: form.sourcePaperName,
      questionNumber: form.questionNumber,
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
    await mistakeStore.addMistake(record as MistakeRecord);
    showAddDialog.value = false;
    resetForm();
    $q.notify({ type: 'positive', message: '错题已保存', timeout: 2000 });
  } catch (e: any) {
    console.error('Save error:', e);
    $q.notify({ type: 'negative', message: `保存失败：${e?.message || String(e) || '未知错误'}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.subject = null;
  form.tagInput = '';
  form.tags = [];
  form.content = '';
  form.answer = '';
  form.difficulty = 0;
  form.kpInput = '';
  form.knowledgePoints = [];
  form.notes = '';
  form.year = null;
  form.knowledgeArea = null;
  form.sourcePaperType = null;
  form.sourcePaperName = '';
  form.questionNumber = '';
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
  if (filters.content) {
    const q = filters.content.toLowerCase();
    result = result.filter(m => (m.content || '').toLowerCase().includes(q) || (m.title || '').toLowerCase().includes(q));
  }
  if (filters.difficulty.length > 0) {
    result = result.filter(m => filters.difficulty.includes(m.difficulty || 0));
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
  filters.subject !== null || filters.tags !== '' || filters.content !== '' || filters.difficulty.length > 0 || filters.dateFrom !== '' || filters.dateTo !== ''
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
  filters.content = '';
  filters.difficulty = [];
  filters.dateFrom = '';
  filters.dateTo = '';
  currentPage.value = 1;
  selectedIds.value = [];
}

// 筛选条件变化时重置到第一页
watch([() => filters.subject, () => filters.tags, () => filters.content, () => filters.difficulty, () => filters.dateFrom, () => filters.dateTo], () => {
  currentPage.value = 1;
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
