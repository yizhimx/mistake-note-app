<template>
  <q-card class="full-height">
    <q-card-section class="row items-center q-pb-none q-pb-sm">
      <div class="text-h6">{{ mode === 'add' ? '添加错题' : '编辑错题' }}</div>
      <q-space />
      <q-btn flat round dense icon="close" @click="emit('cancel')" />
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
              <q-select v-model="form.knowledgeAreas" :options="knowledgeAreas" label="知识板块" clearable outlined dense multiple use-chips :disable="!form.subject" />
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
            <q-btn flat dense no-caps icon="auto_awesome" label="AI 识别" color="primary" size="sm" @click="runAiRecognize" />
          </div>
          <div class="toolbar q-mb-xs q-gutter-xs">
            <q-btn flat dense size="sm" icon="format_bold" @click="insertMarkdown('**', '**')" />
            <q-btn flat dense size="sm" icon="format_italic" @click="insertMarkdown('*', '*')" />
            <q-btn flat dense size="sm" icon="code" @click="insertMarkdown('`', '`')" />
            <q-btn flat dense size="sm" icon="functions" @click="insertMarkdown('$$', '$$')" />
            <q-btn flat dense size="sm" icon="image" @click="insertImage" />
            <q-btn flat dense size="sm" icon="camera_alt" title="拍照" @click="takePhotoAndInsert('content')" />
            <q-btn flat dense size="sm" icon="photo_library" title="相册选取" @click="pickFromGalleryAndInsert('content')" />
            <q-btn flat dense size="sm" icon="crop" @click="cropContentImage" />
            <q-btn flat dense size="sm" icon="content_paste" color="grey" title="粘贴图片 (Ctrl+V)" @click="pasteImageFromClipboard('content')" />
          </div>
          <q-input ref="contentEditorRef" v-model="form.content" outlined dense autogrow type="textarea" class="q-mb-md font-mono content-editor" placeholder="用 Markdown 编写题目内容，支持 LaTeX：$\int_a^b f(x)dx$（Ctrl+V 可粘贴图片）" input-style="min-height: 120px; font-family: monospace; font-size: 13px" @paste="onContentPaste" />

          <div class="row items-center q-mb-sm">
            <div class="text-weight-medium">答案 (Markdown)</div>
            <q-space />
            <q-btn flat dense no-caps icon="auto_awesome" label="AI 解析" color="purple" size="sm" @click="runAiAnalysis" />
          </div>
          <div class="toolbar q-mb-xs q-gutter-xs">
            <q-btn flat dense size="sm" icon="format_bold" @click="insertAnswerMarkdown('**', '**')" />
            <q-btn flat dense size="sm" icon="format_italic" @click="insertAnswerMarkdown('*', '*')" />
            <q-btn flat dense size="sm" icon="code" @click="insertAnswerMarkdown('`', '`')" />
            <q-btn flat dense size="sm" icon="functions" @click="insertAnswerMarkdown('$$', '$$')" />
            <q-btn flat dense size="sm" icon="image" @click="insertAnswerImage" />
            <q-btn flat dense size="sm" icon="camera_alt" title="拍照" @click="takePhotoAndInsert('answer')" />
            <q-btn flat dense size="sm" icon="photo_library" title="相册选取" @click="pickFromGalleryAndInsert('answer')" />
            <q-btn flat dense size="sm" icon="crop" @click="cropAnswerImage" />
            <q-btn flat dense size="sm" icon="content_paste" color="grey" title="粘贴图片 (Ctrl+V)" @click="pasteImageFromClipboard('answer')" />
          </div>
          <q-input ref="answerEditorRef" v-model="form.answer" outlined dense autogrow type="textarea" class="q-mb-md font-mono answer-editor" placeholder="答案内容，支持 Markdown 和 LaTeX（Ctrl+V 可粘贴图片）" input-style="min-height: 100px; font-family: monospace; font-size: 13px" @paste="onAnswerPaste" />
        </div>

        <div class="col-12 col-md-4">
          <div class="text-weight-medium q-mb-sm">实时预览</div>
          <div class="rounded-borders bg-grey-1 q-pa-sm" style="min-height: 200px; max-height: calc(100vh - 300px); overflow-y: auto; border: 1px solid #ddd">
            <div class="markdown-preview" v-html="renderedPreview" />
          </div>
          <q-separator class="q-my-md" />
          <q-btn color="primary" :label="mode === 'add' ? '保存错题' : '保存修改'" :disable="!canSave" :loading="saving" @click="saveForm" unelevated class="full-width" />
        </div>
      </div>
    </q-card-section>
    <ImageCropDialog v-model="showCropDialog" :image-data-url="cropImageDataUrl" @confirm="onCropConfirm" @cancel="onCropCancel" />
  </q-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { compressToDataUrl } from '@/services/ocrService';
import { saveImage, extractImageRefs, loadImage, getCachedImage } from '@/services/imageStore';
import { renderMarkdown } from '@/utils/markdown';
import ImageCropDialog from '@/components/ImageCropDialog.vue';
import { getAiConfig } from '@/services/aiConfig';
import { directTextChat } from '@/services/directAi';
import { useQueueStore } from '@/stores/queueStore';
import type { MistakeRecord } from '@/stores/mistakeStore';

const props = defineProps<{
  mode: 'add' | 'edit';
  initialData?: MistakeRecord | null;
}>();

const emit = defineEmits<{
  save: [data: Record<string, any>];
  cancel: [];
}>();

const $q = useQuasar();
const router = useRouter();
const queueStore = useQueueStore();

const saving = ref(false);
const contentEditorRef = ref<any>(null);
const answerEditorRef = ref<any>(null);
const showCropDialog = ref(false);
const cropImageDataUrl = ref('');
const cropFieldTarget = ref<'content' | 'answer'>('content');
const cropOldRef = ref('');

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
  knowledgeAreas: [] as string[],
  sourcePaperType: null as string | null,
  sourcePaperName: '',
  questionNumber: '',
  aiAnalysis: null as string | null,
});

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const yearOptions = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));
const paperTypes = ['月考', '期中', '期末', '模拟', '高考真题', '竞赛', '单元测试', '其他'];

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

const canSave = computed(() => form.content.trim().length > 0);

const renderedPreview = computed(() => {
  return form.content ? renderMarkdown(form.content) : '<span class="text-grey">输入题目内容后预览</span>';
});

// Edit mode: populate form from initialData
watch(() => props.initialData, (data) => {
  if (data && props.mode === 'edit') {
    form.title = data.title || '';
    form.subject = data.subject || null;
    form.tags = [...(data.tags || [])];
    form.content = data.content || '';
    form.answer = data.answer || '';
    form.difficulty = data.difficulty || 0;
    form.knowledgePoints = [...(data.knowledgePoints || [])];
    form.notes = data.notes || '';
    form.year = data.year || null;
    form.knowledgeAreas = [...(data.knowledgeAreas || [])];
    form.sourcePaperType = data.sourcePaperType || null;
    form.sourcePaperName = data.sourcePaperName || '';
    form.questionNumber = data.questionNumber || '';
  }
}, { immediate: true });

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

async function pasteImageFromClipboard(target: 'content' | 'answer') {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const file = new File([blob], 'clipboard.png', { type });
          const ref = await compressAndSaveImage(file);
          insertImageRef(ref, target);
          return;
        }
      }
    }
    $q.notify({ type: 'warning', message: '剪贴板中没有图片', timeout: 1500 });
  } catch {
    $q.notify({ type: 'negative', message: '无法读取剪贴板', timeout: 1500 });
  }
}

async function takePhotoAndInsert(target: 'content' | 'answer') {
  try {
    const { takePhoto } = await import('@/utils/camera');
    const result = await takePhoto();
    if (result) {
      const ref = await compressAndSaveImage(result.file);
      insertImageRef(ref, target);
    }
  } catch {
    $q.notify({ type: 'negative', message: '拍照失败', timeout: 1500 });
  }
}

async function pickFromGalleryAndInsert(target: 'content' | 'answer') {
  try {
    const { pickFromGallery } = await import('@/utils/camera');
    const result = await pickFromGallery();
    if (result) {
      const ref = await compressAndSaveImage(result.file);
      insertImageRef(ref, target);
    }
  } catch {
    $q.notify({ type: 'negative', message: '选取图片失败', timeout: 1500 });
  }
}

async function cropContentImage() {
  const refs = extractImageRefs(form.content);
  if (refs.length === 0) {
    $q.notify({ type: 'warning', message: '题目内容中没有可裁剪的图片', timeout: 2000 });
    return;
  }
  const ref = await pickCropRef(refs, 'content');
  if (!ref) return;
  const dataUrl = await loadImage(ref);
  if (!dataUrl) { $q.notify({ type: 'negative', message: '图片加载失败', timeout: 2000 }); return; }
  cropImageDataUrl.value = dataUrl;
  cropOldRef.value = ref;
  cropFieldTarget.value = 'content';
  showCropDialog.value = true;
}

async function cropAnswerImage() {
  const refs = extractImageRefs(form.answer);
  if (refs.length === 0) {
    $q.notify({ type: 'warning', message: '答案中没有可裁剪的图片', timeout: 2000 });
    return;
  }
  const ref = await pickCropRef(refs, 'answer');
  if (!ref) return;
  const dataUrl = await loadImage(ref);
  if (!dataUrl) { $q.notify({ type: 'negative', message: '图片加载失败', timeout: 2000 }); return; }
  cropImageDataUrl.value = dataUrl;
  cropOldRef.value = ref;
  cropFieldTarget.value = 'answer';
  showCropDialog.value = true;
}

async function pickCropRef(refs: string[], field: string): Promise<string | null> {
  if (refs.length === 1) return refs[0] ?? null;
  const names = refs.map((r, i) => ({ label: `图片 ${i + 1}`, value: r }));
  return new Promise(resolve => {
    $q.dialog({
      title: '选择要裁剪的图片',
      options: {
        type: 'radio',
        model: '',
        items: names,
      },
      cancel: true,
      persistent: true,
    }).onOk((selected: string) => {
      resolve(selected);
    }).onCancel(() => {
      resolve(null);
    });
  });
}

async function onCropConfirm(blob: Blob) {
  showCropDialog.value = false;
  try {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
    const dataUrl = await compressToDataUrl(file);
    const newRef = await saveImage(dataUrl);
    const field = cropFieldTarget.value || 'content';
    const oldRef = cropOldRef.value;
    const text = field === 'content' ? form.content : form.answer;
    const before = text;
    const escaped = oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, 'g');
    const updated = text.replace(re, `![图片](${newRef})`);
    const changed = before !== updated;
    if (field === 'content') form.content = updated;
    else if (field === 'answer') form.answer = updated;
    $q.notify({
      type: changed ? 'positive' : 'warning',
      message: changed
        ? '图片裁剪完成'
        : `未替换 field=${field} oldRef=${oldRef}`,
      timeout: 4000,
    });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `裁剪失败：${e?.message || String(e)}`, timeout: 4000 });
  }
}

function onCropCancel() {
  showCropDialog.value = false;
}

async function runAiRecognize() {
  const config = getAiConfig();
  if (!config.aiApiKey) {
    $q.notify({ type: 'warning', message: '请先在设置中填写 AI API Key', timeout: 2500 });
    return;
  }
  const refs = extractImageRefs(form.content);
  if (refs.length > 0) {
    let count = 0;
    for (const ref of refs) {
      try {
        const dataUrl = await loadImage(ref);
        if (dataUrl) {
          await queueStore.addToQueue(dataUrl);
          count++;
        }
      } catch { /* skip failed */ }
    }
    if (count > 0) {
      $q.notify({
        type: 'positive',
        message: `已将 ${count} 张图片加入识别队列`,
        timeout: 2500,
        actions: [{ label: '查看队列', color: 'white', handler: () => router.push({ name: 'queue-list' }) }],
      });
    } else {
      $q.notify({ type: 'warning', message: '无法加载题目内容中的图片', timeout: 2500 });
    }
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressToDataUrl(file);
      await queueStore.addToQueue(dataUrl);
      $q.notify({
        type: 'positive',
        message: '已加入识别队列，处理完成后可查看结果',
        timeout: 2500,
        actions: [{ label: '查看队列', color: 'white', handler: () => router.push({ name: 'queue-list' }) }],
      });
    } catch (e: any) {
      $q.notify({ type: 'negative', message: `加入队列失败：${e?.message || String(e)}`, timeout: 3500 });
    }
  };
  input.click();
}

async function runAiAnalysis() {
  if (!form.content.trim()) {
    $q.notify({ type: 'warning', message: '请先输入题目内容', timeout: 2000 });
    return;
  }
  const config = getAiConfig();
  if (!config.aiApiKey) {
    $q.notify({ type: 'warning', message: '请先在设置中填写 AI API Key', timeout: 2500 });
    return;
  }
  try {
    const loading = $q.loading.show({ message: 'AI 解析中...' });
    const prompt = `你是一位严谨的学科教师，请解析以下错题。返回格式：

## 正确答案
（用 Markdown 写出正确答案）

## 解题步骤
（分步骤详细说明解题过程）

题目内容：
${form.content}`;
    const content = await directTextChat(prompt, { temperature: 0.3, systemPrompt: '你是一位严谨的学科教师，返回格式规范的 Markdown。' });
    loading();
    form.aiAnalysis = (content || '').trim();

    if (!form.answer.trim()) {
      form.answer = form.aiAnalysis;
    } else {
      const ok = await new Promise<'overwrite' | 'append' | null>(resolve => {
        $q.dialog({
          title: '答案已存在',
          message: '当前答案框已有内容，请选择处理方式：',
          options: {
            type: 'radio',
            model: 'append' as string,
            items: [
              { label: '覆盖现有答案', value: 'overwrite' },
              { label: '追加到末尾', value: 'append' },
            ],
          },
          cancel: true,
        }).onOk((val: string) => resolve(val as 'overwrite' | 'append'))
          .onCancel(() => resolve(null));
      });
      if (ok === 'overwrite') {
        form.answer = form.aiAnalysis;
      } else if (ok === 'append') {
        form.answer = form.answer.trimEnd() + '\n\n---\n\n' + form.aiAnalysis;
      }
    }

    $q.notify({ type: 'positive', message: 'AI 解析完成', timeout: 2000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `AI 解析失败：${e?.message || String(e)}`, timeout: 3000 });
  }
}

function addTag() {
  const t = form.tagInput.trim();
  if (t && !form.tags.includes(t)) {
    form.tags.push(t);
    form.tagInput = '';
  }
}

function onSubjectChange() {
  form.knowledgeAreas = [];
}

function addKp() {
  const k = form.kpInput.trim();
  if (k && !form.knowledgePoints.includes(k)) {
    form.knowledgePoints.push(k);
    form.kpInput = '';
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
  form.knowledgeAreas = [];
  form.sourcePaperType = null;
  form.sourcePaperName = '';
  form.questionNumber = '';
}

function deriveTitle(content: string): string {
  const firstLine = (content || '').split('\n')[0]?.replace(/[#*`$]/g, '').trim() || '';
  return firstLine.slice(0, 30) || `错题 ${new Date().toISOString().slice(0, 10)}`;
}

async function saveForm() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const data = {
      title: form.title.trim() || deriveTitle(form.content),
      content: form.content,
      answer: form.answer,
      tags: [...form.tags],
      subject: form.subject || '',
      difficulty: form.difficulty,
      knowledgePoints: [...form.knowledgePoints],
      notes: form.notes,
      year: form.year || '',
      knowledgeAreas: [...form.knowledgeAreas],
      sourcePaperType: form.sourcePaperType || '',
      sourcePaperName: form.sourcePaperName,
      questionNumber: form.questionNumber,
      aiAnalysis: form.aiAnalysis || null,
    };
    emit('save', data);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e?.message || String(e) || '未知错误'}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}

defineExpose({ resetForm });
</script>
