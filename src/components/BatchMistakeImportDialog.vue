<template>
  <q-dialog :model-value="modelValue" @update:model-value="v => emit('update:modelValue', v)" maximized persistent>
    <q-card class="column" style="height: 100vh">
      <q-card-section class="row items-center q-py-sm" style="flex-shrink:0">
        <q-btn v-if="step === 'ocr' || step === 'review'" flat round dense icon="arrow_back" @click="goBack" class="q-mr-sm" />
        <div class="text-h6">批量导入错题</div>
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
              <q-img :src="img.dataUrl" style="width:120px;height:120px" fit="cover" class="rounded-borders" />
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

          <q-btn class="q-mt-md full-width" color="secondary" icon="auto_awesome" label="AI 生成错题" @click="generateMistakes"
            :loading="generating" :disable="!combinedOcrText || generating" no-caps unelevated />

          <q-btn v-if="images.length > 0 && images.every(i => i.ocrDone)" class="q-mt-sm full-width" color="accent" icon="queue" label="加入识别队列（后台分析）"
            @click="addAllToQueue" no-caps :loading="addingToQueue" :disable="addingToQueue" unelevated />

          <q-btn v-if="generatedMistakes.length > 0" class="q-mt-sm full-width" color="primary" icon="rate_review" label="查看并保存错题"
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
          <div class="text-weight-medium">生成错题（{{ generatedMistakes.length }} 条）</div>
          <q-space />
          <q-btn flat dense :icon="allSelected ? 'check_box' : 'check_box_outline_blank'" :label="allSelected ? '取消全选' : '全选'"
            @click="toggleAll(!allSelected)" size="sm" />
          <q-btn color="primary" icon="save" :label="`保存所选（${selectedCount}）`" @click="saveAll"
            :loading="saving" :disable="selectedCount === 0" no-caps unelevated class="q-ml-sm" />
        </div>

        <div v-for="(m, i) in generatedMistakes" :key="m.id" class="q-mb-md">
          <q-card bordered>
            <q-card-section class="q-pa-sm row items-center">
              <q-checkbox v-model="m.selected" dense />
              <q-btn flat dense icon="drag_indicator" class="cursor-move q-mr-sm" size="sm" />
              <q-input v-model="m.title" label="标题" outlined dense class="col" :placeholder="`错题 ${i + 1}`" />
              <q-rating v-model="m.difficulty" :max="5" size="1.2em" icon="star_border" icon-selected="star" color="orange" />
              <q-chip v-if="m.subject" dense size="sm" color="primary" text-color="white" class="q-ml-sm">{{ m.subject }}</q-chip>
              <q-btn flat dense :icon="m._expanded ? 'expand_less' : 'expand_more'" @click="m._expanded = !m._expanded" size="sm" />
            </q-card-section>

            <q-slide-transition>
              <div v-show="m._expanded">
                <q-separator />
                <q-card-section class="q-pt-sm row q-col-gutter-sm">
                  <div class="col-4">
                    <q-select v-model="m.subject" :options="subjects" label="科目" clearable outlined dense />
                  </div>
                  <div class="col-4">
                    <q-select v-model="m.year" :options="yearOptions" label="年份" clearable outlined dense />
                  </div>
                  <div class="col-4">
                    <q-select v-model="m.knowledgeAreas" :options="knowledgeAreas" label="知识板块" clearable outlined dense multiple use-chips :disable="!m.subject" />
                  </div>
                  <div class="col-4">
                    <q-select v-model="m.sourcePaperType" :options="paperTypes" label="试卷类型" clearable outlined dense />
                  </div>
                  <div class="col-4">
                    <q-input v-model="m.sourcePaperName" label="来源试卷名称" outlined dense />
                  </div>
                  <div class="col-4">
                    <q-input v-model="m.questionNumber" label="题号" outlined dense />
                  </div>
                  <div class="col-6">
                    <q-input v-model="m.content" label="题目内容（Markdown）" outlined dense autogrow type="textarea"
                      :input-style="{ minHeight: '100px', fontFamily: 'monospace', fontSize: '13px' }" />
                  </div>
                  <div class="col-6">
                    <q-input v-model="m.answer" label="答案（Markdown）" outlined dense autogrow type="textarea"
                      :input-style="{ minHeight: '100px', fontFamily: 'monospace', fontSize: '13px' }" />
                  </div>
                  <div class="col-6">
                    <q-input v-model="m.tagInput" label="标签" outlined dense placeholder="回车添加"
                      @keydown.enter.prevent="addTag(m)" />
                    <div v-if="m.tags.length" class="q-mt-xs">
                      <q-chip v-for="t in m.tags" :key="t" dense removable size="sm"
                        @remove="m.tags = m.tags.filter(x => x !== t)">{{ t }}</q-chip>
                    </div>
                  </div>
                  <div class="col-6">
                    <q-input v-model="m.kpInput" label="知识点" outlined dense placeholder="回车添加"
                      @keydown.enter.prevent="addKp(m)" />
                    <div v-if="m.knowledgePoints.length" class="q-mt-xs">
                      <q-chip v-for="kp in m.knowledgePoints" :key="kp" dense removable size="sm"
                        @remove="m.knowledgePoints = m.knowledgePoints.filter(x => x !== kp)">{{ kp }}</q-chip>
                    </div>
                  </div>
                  <div class="col-12">
                    <q-input v-model="m.notes" label="备注" outlined dense autogrow type="textarea" />
                  </div>
                </q-card-section>
              </div>
            </q-slide-transition>
          </q-card>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar, uid } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import { useQueueStore } from '@/stores/queueStore';
import { directVisionChat, directTextChat } from '@/services/directAi';

const $q = useQuasar();
const mistakeStore = useMistakeStore();
const queueStore = useQueueStore();

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; imported: [count: number] }>();

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const yearOptions = Array.from({ length: 20 }, (_, i) => String(2025 - i));
const paperTypes = ['期中', '期末', '月考', '模拟', '高考真题', '联考', '单元测试', '其他'];
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

interface ImportImage {
  dataUrl: string;
  fileName: string;
  ocrText: string;
  ocrDone: boolean;
}

interface GeneratedMistake {
  id: string;
  selected: boolean;
  _expanded: boolean;
  title: string;
  content: string;
  answer: string;
  subject: string;
  tags: string[];
  difficulty: number;
  year: string;
  knowledgeAreas: string[];
  sourcePaperType: string;
  sourcePaperName: string;
  questionNumber: string;
  knowledgePoints: string[];
  notes: string;
  tagInput: string;
  kpInput: string;
}

const step = ref<'upload' | 'ocr' | 'review'>('upload');
const images = ref<ImportImage[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const ocrProcessingIndex = ref(-1);
const combinedOcrText = ref('');
const generating = ref(false);
const generatedMistakes = ref<GeneratedMistake[]>([]);
const saving = ref(false);
const addingToQueue = ref(false);

const allSelected = computed(() => generatedMistakes.value.length > 0 && generatedMistakes.value.every(m => m.selected));
const selectedCount = computed(() => generatedMistakes.value.filter(m => m.selected).length);

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
      const prompt = '你是 OCR 转写助手。请把图片中的题目内容逐字逐符号转写成 Markdown 文本。只输出文本本身，不要用代码块包裹，不要多余解释。';
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

async function generateMistakes() {
  if (!combinedOcrText.value.trim()) {
    $q.notify({ type: 'warning', message: '请先完成 OCR 识别', timeout: 2000 });
    return;
  }
  generating.value = true;
  try {
    const prompt = `你正在整理错题。以下是从试卷/练习册图片中识别出的文字内容。请将其拆分为若干道独立的错题，每道错题应该是一个完整的题目。

每道错题包含：
- title: 错题标题（简洁概括）
- content: 完整的题目内容（Markdown 格式）
- answer: 答案与解析（Markdown 格式），如果有详细解答过程也一并写下
- subject: 所属科目（${subjects.join('、')}），不确定则为空字符串
- difficulty: 难度评级（1-5，1最简单5最难）
- year: 年份
- knowledgeAreas: 知识板块数组
- sourcePaperType: 试卷类型（期中/期末/月考/模拟/高考真题/联考/单元测试/其他）
- sourcePaperName: 来源试卷名称
- questionNumber: 题号
- tags: 标签数组（如函数、三角函数等）
- knowledgePoints: 知识点数组
- notes: 备注

返回严格 JSON 格式数组（不要包裹 markdown 代码块，不要有任何说明文字）：

[
  {
    "title": "错题标题",
    "content": "题目内容（Markdown 格式）",
    "answer": "答案与解析（Markdown 格式）",
    "subject": "科目",
    "difficulty": 3,
    "year": "2024",
    "knowledgeAreas": ["知识板块"],
    "sourcePaperType": "试卷类型",
    "sourcePaperName": "来源试卷名称",
    "questionNumber": "题号",
    "tags": ["标签1"],
    "knowledgePoints": ["知识点1"],
    "notes": "备注"
  }
]

OCR 文字内容：
${combinedOcrText.value}`;

    const resContent = await directTextChat(prompt, { temperature: 0.3 });
    const parsed = parseJsonResponse(resContent);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI 返回数据格式异常，未能解析为错题数组');
    }

    generatedMistakes.value = parsed.map((item: any, i: number) => ({
      id: uid(),
      selected: true,
      _expanded: true,
      title: item.title || `错题 ${i + 1}`,
      content: item.content || '',
      answer: item.answer || '',
      subject: item.subject || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      difficulty: typeof item.difficulty === 'number' ? Math.max(1, Math.min(5, item.difficulty)) : 3,
      year: item.year || '',
      knowledgeAreas: Array.isArray(item.knowledgeAreas) ? item.knowledgeAreas : [],
      sourcePaperType: item.sourcePaperType || '',
      sourcePaperName: item.sourcePaperName || '',
      questionNumber: item.questionNumber || '',
      knowledgePoints: Array.isArray(item.knowledgePoints) ? item.knowledgePoints : [],
      notes: item.notes || '',
      tagInput: '',
      kpInput: '',
    }));

    step.value = 'review';
    $q.notify({ type: 'positive', message: `AI 生成了 ${generatedMistakes.value.length} 道错题`, timeout: 2000 });
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

async function addAllToQueue() {
  addingToQueue.value = true;
  try {
    let count = 0;
    for (const img of images.value) {
      await queueStore.addToQueue(img.dataUrl);
      count++;
    }
    $q.notify({ type: 'positive', message: `已将 ${count} 张图片加入识别队列，识别完成后可到队列页查看`, timeout: 3000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `加入队列失败：${e?.message || String(e)}`, timeout: 3500 });
  } finally {
    addingToQueue.value = false;
  }
}

function toggleAll(checked: boolean) {
  generatedMistakes.value.forEach(m => { m.selected = checked; });
}

function addTag(m: GeneratedMistake) {
  const v = m.tagInput.trim();
  if (v && !m.tags.includes(v)) {
    m.tags.push(v);
    m.tagInput = '';
  }
}

function addKp(m: GeneratedMistake) {
  const v = m.kpInput.trim();
  if (v && !m.knowledgePoints.includes(v)) {
    m.knowledgePoints.push(v);
    m.kpInput = '';
  }
}

async function saveAll() {
  const toSave = generatedMistakes.value.filter(m => m.selected);
  if (toSave.length === 0) return;
  saving.value = true;
  try {
    const now = new Date().toISOString();
    const records = toSave.map(m => ({
      id: uid(),
      title: m.title,
      content: m.content,
      imageUrls: [],
      tags: m.tags,
      subject: m.subject,
      notes: m.notes,
      answer: m.answer,
      answerImages: [],
      difficulty: m.difficulty || 0,
      knowledgePoints: m.knowledgePoints,
      year: m.year,
      knowledgeAreas: m.knowledgeAreas,
      sourcePaperType: m.sourcePaperType,
      sourcePaperName: m.sourcePaperName,
      questionNumber: m.questionNumber,
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
    } as any));
    await mistakeStore.addMistakes(records);
    $q.notify({ type: 'positive', message: `已保存 ${records.length} 道错题`, timeout: 2000 });
    emit('imported', records.length);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}
</script>
