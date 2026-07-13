<template>
  <q-dialog :model-value="modelValue" @update:model-value="v => emit('update:modelValue', v)" maximized persistent>
    <q-card class="column" style="height: 100vh">
      <q-card-section class="row items-center q-py-sm" style="flex-shrink:0">
        <q-btn v-if="step === 'ocr' || step === 'review'" flat round dense icon="arrow_back" @click="goBack" class="q-mr-sm" />
        <div class="text-h6">批量导入笔记</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <!-- Step 1: Upload -->
      <q-card-section v-if="step === 'upload'" class="col row" style="overflow-y:auto">
        <div class="col">
          <div class="text-weight-medium q-mb-sm">上传图片 <small class="text-grey">（支持多选，图片将依次进行 OCR 识别）</small></div>
          <div class="row items-center q-gutter-sm q-mb-md">
            <q-btn color="primary" icon="add_photo_alternate" label="选择图片" @click="triggerFileInput" no-caps unelevated />
            <q-badge v-if="images.length > 0" color="positive" class="q-px-sm q-py-xs">
              已选 {{ images.length }} 张图片
            </q-badge>
            <q-btn v-if="images.length > 0" flat dense icon="clear" label="清空" size="sm" @click="images = []" />
          </div>
          <input ref="fileInputRef" type="file" multiple accept="image/*" @change="onFilesSelected" style="display:none" />

          <div v-if="images.length > 0" class="row q-gutter-sm q-mb-md">
            <div v-for="(img, i) in images" :key="i" class="relative-position">
              <q-img :src="img.dataUrl" style="width:120px;height:120px" fit="cover" class="rounded-borders cursor-pointer" @click="previewIndex = i; showPreview = true" />
              <q-btn dense flat icon="close" size="xs" class="absolute-top-right bg-white"
                @click="images.splice(i, 1)" style="z-index:1" />
              <div class="text-caption text-center text-grey" style="width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ img.fileName }}
              </div>
            </div>
          </div>

          <div v-if="images.length > 0" class="q-mt-md">
            <q-btn color="primary" icon="text_snippet" label="开始 OCR 识别" @click="step = 'ocr'; startOcr()" :disable="images.length === 0" no-caps unelevated />
          </div>
        </div>
      </q-card-section>

      <!-- Step 2: OCR + AI -->
      <q-card-section v-if="step === 'ocr'" class="col row q-col-gutter-sm" style="overflow-y:auto">
        <div class="col-12 col-md-6">
          <div class="text-weight-medium q-mb-sm">OCR 进度</div>
          <q-list dense bordered separator>
            <q-item v-for="(img, i) in images" :key="i">
              <q-item-section avatar>
                <q-icon :name="img.ocrDone ? 'check_circle' : (ocrProcessingIndex === i ? 'hourglass_top' : 'pending')"
                  :color="img.ocrDone ? 'positive' : (ocrProcessingIndex === i ? 'warning' : 'grey')" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption class="text-caption">{{ img.fileName }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-btn class="q-mt-md full-width" color="secondary" icon="auto_awesome" label="AI 生成笔记" @click="generateNotes"
            :loading="generating" :disable="!combinedOcrText || generating" no-caps unelevated />

          <q-btn v-if="generatedNotes.length > 0" class="q-mt-sm full-width" color="primary" icon="rate_review" label="查看并保存笔记"
            @click="step = 'review'" no-caps unelevated />
        </div>

        <div class="col-12 col-md-6">
          <div class="text-weight-medium q-mb-sm">OCR 识别结果</div>
          <q-input v-model="combinedOcrText" type="textarea" outlined dense
            :input-style="{ minHeight: '300px', fontFamily: 'monospace', fontSize: '13px' }"
            readonly />
        </div>
      </q-card-section>

      <!-- Step 3: Review -->
      <q-card-section v-if="step === 'review'" class="col" style="overflow-y:auto">
        <div class="row items-center q-mb-md">
          <div class="text-weight-medium">生成笔记（{{ generatedNotes.length }} 条）</div>
          <q-space />
          <q-btn flat dense :icon="allSelected ? 'check_box' : 'check_box_outline_blank'" :label="allSelected ? '取消全选' : '全选'"
            @click="toggleAll(!allSelected)" size="sm" />
          <q-btn color="primary" icon="save" :label="`保存所选（${selectedCount}）`" @click="saveAll"
            :loading="saving" :disable="selectedCount === 0" no-caps unelevated class="q-ml-sm" />
        </div>

        <div v-for="(note, i) in generatedNotes" :key="note.id" class="q-mb-md">
          <q-card bordered>
            <q-card-section class="q-pa-sm row items-center">
              <q-checkbox v-model="note.selected" dense />
              <q-btn flat dense icon="drag_indicator" class="cursor-move q-mr-sm" size="sm" />
              <q-input v-model="note.title" label="标题" outlined dense class="col" :placeholder="`笔记 ${i + 1}`" />
              <q-btn flat dense :icon="note._expanded ? 'expand_less' : 'expand_more'" @click="note._expanded = !note._expanded" size="sm" />
            </q-card-section>

            <q-slide-transition>
              <div v-show="note._expanded">
                <q-separator />
                <q-card-section class="q-pt-sm row q-col-gutter-sm">
                  <div class="col-3">
                    <q-select v-model="note.subject" :options="subjects" label="科目" clearable outlined dense />
                  </div>
                  <div class="col-3">
                    <q-input v-model="note.volume" label="册数" outlined dense placeholder="必修一" />
                  </div>
                  <div class="col-3">
                    <q-input v-model="note.chapter" label="章" outlined dense />
                  </div>
                  <div class="col-3">
                    <q-input v-model="note.section" label="节" outlined dense />
                  </div>
                  <div class="col-12">
                    <q-input v-model="note.summary" label="知识点概要" outlined dense autogrow type="textarea" />
                  </div>
                  <div class="col-12">
                    <q-input v-model="note.content" label="详细内容（Markdown）" outlined autogrow type="textarea"
                      :input-style="{ minHeight: '120px', fontFamily: 'monospace', fontSize: '13px' }" />
                  </div>
                  <div class="col-6">
                    <q-input v-model="note.kpInput" label="知识点" outlined dense placeholder="输入后回车添加"
                      @keydown.enter.prevent="addKp(note)" />
                    <div v-if="note.knowledgePoints.length" class="q-mt-xs">
                      <q-chip v-for="kp in note.knowledgePoints" :key="kp" dense removable size="sm"
                        @remove="note.knowledgePoints = note.knowledgePoints.filter(x => x !== kp)">
                        {{ kp }}
                      </q-chip>
                    </div>
                  </div>
                  <div class="col-6">
                    <q-input v-model="note.tagInput" label="标签" outlined dense placeholder="输入后回车添加"
                      @keydown.enter.prevent="addTag(note)" />
                    <div v-if="note.tags.length" class="q-mt-xs">
                      <q-chip v-for="t in note.tags" :key="t" dense removable size="sm"
                        @remove="note.tags = note.tags.filter(x => x !== t)">
                        {{ t }}
                      </q-chip>
                    </div>
                  </div>
                </q-card-section>
              </div>
            </q-slide-transition>
          </q-card>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

  <ImagePreviewDialog v-model="showPreview" :images="previewUrls" :initial-index="previewIndex" />
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import ImagePreviewDialog from '@/components/ImagePreviewDialog.vue';
import { useQuasar, uid } from 'quasar';
import { useNoteStore } from '@/stores/noteStore';
import { directVisionChat, directTextChat } from '@/services/directAi';

const $q = useQuasar();
const noteStore = useNoteStore();

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; imported: [count: number] }>();

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];

interface ImportImage {
  dataUrl: string;
  fileName: string;
  ocrText: string;
  ocrDone: boolean;
}

interface GeneratedNote {
  id: string;
  selected: boolean;
  title: string;
  subject: string;
  volume: string;
  chapter: string;
  section: string;
  summary: string;
  content: string;
  knowledgePoints: string[];
  tags: string[];
  _expanded: boolean;
  kpInput: string;
  tagInput: string;
}

const step = ref<'upload' | 'ocr' | 'review'>('upload');
const images = ref<ImportImage[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const showPreview = ref(false);
const previewIndex = ref(0);
const previewUrls = computed(() => images.value.map(img => img.dataUrl));
const ocrProcessingIndex = ref(-1);
const combinedOcrText = ref('');
const generating = ref(false);
const generatedNotes = ref<GeneratedNote[]>([]);
const saving = ref(false);

const allSelected = computed(() => generatedNotes.value.length > 0 && generatedNotes.value.every(n => n.selected));
const selectedCount = computed(() => generatedNotes.value.filter(n => n.selected).length);

function triggerFileInput() {
  fileInputRef.value?.click();
}

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 10485760) continue;
    const reader = new FileReader();
    reader.onload = (ev) => {
      images.value.push({
        dataUrl: ev.target?.result as string,
        fileName: file.name,
        ocrText: '',
        ocrDone: false,
      });
    };
    reader.readAsDataURL(file);
  }
  input.value = '';
}

function goBack() {
  if (step.value === 'review') {
    step.value = 'ocr';
  } else if (step.value === 'ocr') {
    step.value = 'upload';
  }
}

async function startOcr() {
  for (let i = 0; i < images.value.length; i++) {
    const img = images.value[i];
    if (img.ocrDone) continue;
    ocrProcessingIndex.value = i;
    try {
      const prompt = '你是 OCR 转写助手。请把图片中的内容逐字逐符号转写成 Markdown 文本。只输出文本本身，不要用代码块包裹，不要多余解释。';
      const text = await directVisionChat(prompt, img.dataUrl, { temperature: 0.2 });
      img.ocrText = text || '';
      img.ocrDone = true;
      combinedOcrText.value += (combinedOcrText.value ? '\n---\n' : '') + `[${img.fileName}]\n${img.ocrText}`;
    } catch (e: any) {
      $q.notify({ type: 'negative', message: `OCR 失败：${img.fileName} - ${e?.message || String(e)}`, timeout: 3000 });
      img.ocrDone = false;
    }
  }
  ocrProcessingIndex.value = -1;
  if (images.value.every(i => i.ocrDone)) {
    $q.notify({ type: 'positive', message: 'OCR 完成', timeout: 1500 });
  }
}

async function generateNotes() {
  if (!combinedOcrText.value.trim()) {
    $q.notify({ type: 'warning', message: '请先完成 OCR 识别', timeout: 2000 });
    return;
  }
  generating.value = true;
  try {
    const prompt = `你正在整理学习笔记。以下是从课本/笔记图片中识别出的文字内容。请将其拆分为若干条独立的知识笔记，每条笔记应该是一个完整的知识点或主题。

要求：
- 内容用 Markdown 格式编写
- 尽量推测所属科目（${subjects.join('、')}），不确定则为空字符串
- 册数、章、节不确定则为空字符串
- 每条笔记的 title 要简洁概括

返回严格 JSON 格式数组（不要包裹 markdown 代码块，不要有任何说明文字）：

[
  {
    "title": "笔记标题",
    "subject": "科目",
    "volume": "教材册数",
    "chapter": "章",
    "section": "节",
    "summary": "知识点概要（一两句话概括）",
    "content": "详细内容（Markdown 格式）",
    "knowledgePoints": ["知识点1"],
    "tags": ["标签1"]
  }
]

OCR 文字内容：
${combinedOcrText.value}`;

    const resContent = await directTextChat(prompt, { temperature: 0.3 });
    const parsed = parseJsonResponse(resContent);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI 返回数据格式异常，未能解析为笔记数组');
    }

    generatedNotes.value = parsed.map((item: any, i: number) => ({
      id: uid(),
      selected: true,
      title: item.title || `笔记 ${i + 1}`,
      subject: item.subject || '',
      volume: item.volume || '',
      chapter: item.chapter || '',
      section: item.section || '',
      summary: item.summary || '',
      content: item.content || '',
      knowledgePoints: Array.isArray(item.knowledgePoints) ? item.knowledgePoints : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      _expanded: true,
      kpInput: '',
      tagInput: '',
    }));

    step.value = 'review';
    $q.notify({ type: 'positive', message: `AI 生成了 ${generatedNotes.value.length} 条笔记`, timeout: 2000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `AI 生成失败：${e?.message || String(e)}`, timeout: 5000 });
  } finally {
    generating.value = false;
  }
}

function parseJsonResponse(text: string): any {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const braceStart = cleaned.indexOf('[');
    const braceEnd = cleaned.lastIndexOf(']');
    if (braceStart !== -1 && braceEnd !== -1) {
      try {
        return JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
      } catch {
        throw new Error(`无法解析 AI 返回结果为 JSON。原始内容：\n${text}`);
      }
    }
    throw new Error(`无法解析 AI 返回结果为 JSON。原始内容：\n${text}`);
  }
}

function toggleAll(checked: boolean) {
  generatedNotes.value.forEach(n => { n.selected = checked; });
}

function addKp(note: GeneratedNote) {
  const v = note.kpInput.trim();
  if (v && !note.knowledgePoints.includes(v)) {
    note.knowledgePoints.push(v);
    note.kpInput = '';
  }
}

function addTag(note: GeneratedNote) {
  const v = note.tagInput.trim();
  if (v && !note.tags.includes(v)) {
    note.tags.push(v);
    note.tagInput = '';
  }
}

async function saveAll() {
  const toSave = generatedNotes.value.filter(n => n.selected);
  if (toSave.length === 0) return;
  saving.value = true;
  try {
    const now = new Date().toISOString();
    const records = toSave.map(n => ({
      id: uid(),
      title: n.title,
      subject: n.subject,
      volume: n.volume,
      chapter: n.chapter,
      section: n.section,
      summary: n.summary,
      isFolder: false,
      content: n.content,
      plainText: n.content.replace(/[#*`\n]/g, ' ').trim(),
      tags: n.tags,
      knowledgePoints: n.knowledgePoints,
      tips: [],
      imageUrls: [],
      linkedMistakeIds: [],
      createdAt: now,
      updatedAt: now,
      synced: false,
    }));
    await noteStore.addNotes(records);
    $q.notify({ type: 'positive', message: `已保存 ${records.length} 条笔记`, timeout: 2000 });
    emit('imported', records.length);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}
</script>
