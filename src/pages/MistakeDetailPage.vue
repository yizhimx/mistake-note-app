<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" />
      <q-space />
      <q-btn color="primary" icon="auto_awesome" label="AI 解析" class="q-mr-sm" @click="runAiAnalysisOnDetail" />
      <q-btn flat icon="more_vert" round>
        <q-menu auto-close>
          <q-list dense>
            <q-item clickable @click="showEditDialog = true">
              <q-item-section>编辑</q-item-section>
            </q-item>
            <q-separator />
            <q-item clickable @click="deleteMistake" class="text-negative">
              <q-item-section>删除</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <div v-if="mistake" class="row">
      <div class="col-12 col-md-7">
        <div v-if="mistake.content" class="q-mt-md markdown-body" v-html="renderedContent" />
        <div v-else class="q-mt-md">
          <div class="text-h5">{{ mistake.title }}</div>
        </div>

        <AIAnalysisCard
          v-if="parsedAnalysis"
          :analysis="parsedAnalysis"
          class="q-mt-md"
        />
        <div v-else-if="mistake.aiAnalysis && !parsedAnalysis" class="q-mt-md q-pa-md bg-grey-2 rounded-borders">
          <div class="row items-center q-mb-sm">
            <div class="text-weight-medium">AI 分析</div>
            <q-space />
            <q-btn flat dense no-caps icon="edit" label="编辑" color="primary" size="sm" @click="openRawAiEditDialog" />
          </div>
          <div style="white-space: pre-wrap">{{ mistake.aiAnalysis }}</div>
        </div>
      </div>

      <div class="col-12 col-md-5 q-pl-md">
        <div class="text-h5">{{ mistake.title }}</div>
        <div class="q-mt-sm">
          <q-chip v-for="tag in mistake.tags" :key="tag" size="sm" color="primary" text-color="white">{{ tag }}</q-chip>
          <span v-if="mistake.tags.length === 0" class="text-grey text-caption">无标签</span>
        </div>

        <q-separator class="q-my-md" />

        <div class="q-mb-md">
          <div class="row text-caption text-grey">
            <div class="col-6" v-if="mistake.year">年份：{{ mistake.year }}</div>
            <div class="col-6" v-if="mistake.knowledgeAreas?.length">
              知识板块：
              <q-chip v-for="ka in mistake.knowledgeAreas" :key="ka" dense size="sm" color="secondary" text-color="white" class="q-mr-xs">{{ ka }}</q-chip>
            </div>
            <div class="col-6" v-if="mistake.sourcePaperType">试卷类型：{{ mistake.sourcePaperType }}</div>
            <div class="col-6" v-if="mistake.sourcePaperName">试卷名称：{{ mistake.sourcePaperName }}</div>
            <div class="col-6" v-if="mistake.questionNumber">题号：{{ mistake.questionNumber }}</div>
            <div class="col-6">科目：{{ mistake.subject || '未分类' }}</div>
          </div>
        </div>

        <div class="q-mb-md">
          <span class="text-grey text-caption">难度：</span>
          <q-rating :model-value="mistake.difficulty" :max="5" size="1em" icon="star_border" icon-selected="star" color="orange" readonly />
        </div>

        <div class="q-mt-md" v-if="mistake.answer">
          <div class="text-weight-medium">答案</div>
          <div class="q-mt-xs markdown-body" v-html="renderedAnswer" />
        </div>

        <div class="q-mt-sm" v-if="mistake.knowledgePoints.length > 0">
          <div class="text-weight-medium q-mb-sm">知识点</div>
          <q-chip v-for="kp in mistake.knowledgePoints" :key="kp" size="sm" color="secondary" text-color="white">{{ kp }}</q-chip>
        </div>
        <div class="q-mt-sm" v-if="mistake.notes">
          <div class="text-weight-medium">备注</div>
          <div class="text-body2">{{ mistake.notes }}</div>
        </div>
        <q-separator class="q-my-md" />
        <div class="row q-gutter-sm q-mb-md">
          <q-chip outline color="primary" icon="autorenew">
            复习 {{ mistake.reviewCount }} 次
          </q-chip>
          <q-chip v-if="mistake.lastReviewAt" outline color="grey" icon="history">
            上次 {{ mistake.lastReviewAt.slice(0, 10) }}
          </q-chip>
          <q-chip outline :color="masteryColor" icon="star">
            {{ masteryLabel }}
          </q-chip>
        </div>
        <div v-if="mistake.sm2Data" class="text-caption text-grey q-mb-md">
          下次复习：{{ nextReviewDate }}
        </div>
        <div class="q-mt-md">
          <div class="row items-center q-mb-sm">
            <div class="text-weight-medium">关联笔记 ({{ linkedNotes.length }})</div>
            <q-space />
            <q-btn flat dense icon="link" label="管理" size="sm" @click="openLinkNoteDialog" />
          </div>
          <div v-if="linkedNotes.length > 0">
            <q-chip v-for="n in linkedNotes" :key="n.id" size="sm" color="secondary" text-color="white" clickable @click="openNote(n.id)" icon="article" :label="n.title" />
          </div>
          <div v-else class="text-grey text-caption">暂无关联笔记</div>
        </div>

      </div>

    </div>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-spinner size="40px" />
      <p class="q-mt-sm">加载中...</p>
    </div>

    <q-dialog v-model="showEditDialog" maximized persistent>
      <MistakeForm
        v-if="mistake"
        mode="edit"
        :initial-data="mistake"
        @save="handleEditSave"
        @cancel="showEditDialog = false"
      />
    </q-dialog>

    <q-dialog v-model="showLinkNoteDialog">
      <q-card style="min-width:450px;max-width:600px">
        <q-card-section>
          <div class="text-h6">管理关联笔记</div>
          <q-input v-model="noteSearch" label="搜索笔记..." outlined dense clearable class="q-mt-sm" />
        </q-card-section>
        <q-card-section class="scroll" style="max-height:50vh;min-height:300px">
          <div v-if="notesLoaded">
            <q-item v-for="n in filteredNotes" :key="n.id" clickable v-ripple @click="toggleNoteLink(n)" class="q-mb-xs">
              <q-item-section side>
                <q-checkbox :model-value="isNoteLinked(n.id)" dense />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ n.title }}</q-item-label>
                <q-item-label caption>{{ n.subject || '未分类' }}{{ n.volume ? ' · ' + n.volume : '' }}{{ n.chapter ? ' · ' + n.chapter : '' }}</q-item-label>
              </q-item-section>
            </q-item>
            <div v-if="filteredNotes.length === 0" class="text-center text-grey q-py-md">没有匹配的笔记</div>
          </div>
          <div v-else class="text-center text-grey q-py-md"><q-spinner size="24px" /> 加载中...</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" color="primary" @click="showLinkNoteDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- AI 原始输出编辑对话框 (JSON 解析失败时使用) -->
    <q-dialog v-model="showRawAiEditDialog" maximized persistent>
      <q-card class="column no-wrap" style="height:100vh">
        <q-card-section class="row items-center q-pb-none">
          <div>
            <div class="text-h6">AI 分析结果编辑</div>
            <div class="text-caption text-grey">AI 返回的内容无法自动解析为结构化数据，请手动编辑后保存。</div>
          </div>
          <q-space />
          <q-btn flat round dense icon="close" @click="showRawAiEditDialog = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="col scroll">
          <div class="q-mb-sm">
            <div class="text-weight-medium q-mb-xs">期望格式参考（JSON Schema）</div>
            <q-input
              :model-value="aiEditSchemaHint"
              type="textarea"
              outlined
              readonly
              dense
              :input-style="{ fontFamily: 'monospace', fontSize: '12px', minHeight: '100px', background: '#f5f5f5' }"
            />
          </div>
          <q-separator class="q-my-sm" />
          <div>
            <div class="text-weight-medium q-mb-xs">AI 原始输出（可编辑）</div>
            <q-input
              v-model="rawAiEditContent"
              type="textarea"
              outlined
              autogrow
              :input-style="{ fontFamily: 'monospace', fontSize: '13px', minHeight: '240px' }"
              placeholder="在此编辑 AI 的输出内容..."
            />
          </div>
          <div v-if="rawAiEditError" class="text-negative text-caption q-mt-sm">
            <q-icon name="error" size="sm" /> {{ rawAiEditError }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section class="row items-center q-py-sm" style="flex-shrink:0">
          <q-btn flat label="取消" color="grey" @click="showRawAiEditDialog = false" />
          <q-space />
          <q-btn flat label="作为 Markdown 存储" color="secondary" @click="saveRawAiAsMarkdown" :loading="savingRawAi" />
          <q-btn unelevated label="尝试重新解析为 JSON" color="primary" @click="retryParseJson" class="q-ml-sm" :loading="savingRawAi" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showAnalysisFixDialog" persistent>
      <q-card style="min-width:500px;max-width:720px">
        <q-card-section>
          <div class="text-h6">AI 返回无法解析，请手动修正</div>
          <div class="text-caption text-grey q-mt-xs">下方为 AI 原始输出，请修正为合法 JSON 后保存。期望结构：</div>
          <pre class="schema-hint q-mt-xs">{{ analysisSchemaHint }}</pre>
        </q-card-section>
        <q-card-section>
          <q-input v-model="fixText" type="textarea" autogrow :input-style="{ minHeight: '220px', fontFamily: 'monospace' }" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" color="primary" @click="showAnalysisFixDialog = false" />
          <q-btn flat label="确认保存" color="primary" :loading="savingFix" @click="confirmFix" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import { useNoteStore, type NoteRecord } from '@/stores/noteStore';
import MistakeForm from '@/components/MistakeForm.vue';
import AIAnalysisCard from '@/components/AIAnalysisCard.vue';
import { renderMarkdown } from '@/utils/markdown';
import { getAiConfig } from '@/services/directAi';
import { analyzeMistake, AnalysisParseError, parseAnalysis } from '@/services/aiService';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const mistakeStore = useMistakeStore();
const noteStore = useNoteStore();

const showEditDialog = ref(false);
const showLinkNoteDialog = ref(false);
const noteSearch = ref('');
const notesLoaded = ref(false);
const showAnalysisFixDialog = ref(false);
const fixText = ref('');
const savingFix = ref(false);
const id = route.params.id as string;

// ── AI 原始输出编辑状态 ──
const showRawAiEditDialog = ref(false);
const rawAiEditContent = ref('');
const rawAiEditError = ref('');
const savingRawAi = ref(false);
const aiEditSchemaHint = `{
  "correctAnswer": "正确答案",
  "steps": ["步骤1", "步骤2"],
  "knowledgePoints": ["知识点1", "知识点2"],
  "commonMistakes": ["常见错误1"],
  "difficulty": 3
}`;

const mistake = computed(() => mistakeStore.getMistakeById(id));

const renderedContent = computed(() => {
  return mistake.value?.content ? renderMarkdown(mistake.value.content) : '';
});

const renderedAnswer = computed(() => {
  return mistake.value?.answer ? renderMarkdown(mistake.value.answer) : '';
});

const parsedAnalysis = computed(() => {
  if (!mistake.value?.aiAnalysis) return null;
  try {
    const parsed = JSON.parse(mistake.value.aiAnalysis);
    if (parsed.correctAnswer && parsed.steps) return parsed;
  } catch { /* not JSON */ }
  return null;
});

async function runAiAnalysisOnDetail() {
  const m = mistake.value;
  if (!m?.content) {
    $q.notify({ type: 'warning', message: '请先填写题目内容', timeout: 2000 });
    return;
  }
  const config = getAiConfig();
  if (!config.aiApiKey) {
    $q.notify({ type: 'warning', message: '请先在设置中填写 AI API Key', timeout: 2500 });
    return;
  }
  const loading = $q.loading.show({ message: 'AI 解析中...' });
  try {
    const { analysis } = await analyzeMistake([], m.content);
    loading();
    await mistakeStore.updateMistake(m.id, { aiAnalysis: JSON.stringify(analysis) });
    await mistakeStore.fetchOne(m.id);
    $q.notify({ type: 'positive', message: 'AI 解析完成', timeout: 2000 });
  } catch (e: any) {
    loading();
    if (e instanceof AnalysisParseError) {
      fixText.value = e.rawText;
      showAnalysisFixDialog.value = true;
    } else {
      $q.notify({ type: 'negative', message: `AI 解析失败：${e?.message || String(e)}`, timeout: 3000 });
    }
  }
}

const masteryLabel = computed(() => {
  const map: Record<string, string> = { fresh: '生疏', hesitant: '犹豫', smooth: '顺利' };
  return mistake.value?.masteryLevel ? map[mistake.value.masteryLevel] || '未掌握' : '未掌握';
});

const masteryColor = computed(() => {
  const map: Record<string, string> = { fresh: 'negative', hesitant: 'orange', smooth: 'positive' };
  return mistake.value?.masteryLevel ? map[mistake.value.masteryLevel] || 'grey' : 'grey';
});

const nextReviewDate = computed(() => {
  if (!mistake.value?.sm2Data) return '';
  try {
    const sm2 = JSON.parse(mistake.value.sm2Data);
    return sm2.nextReviewDate ? sm2.nextReviewDate.slice(0, 10) : '';
  } catch { return ''; }
});

const linkedNotes = computed(() =>
  (mistake.value?.linkedNoteIds || [])
    .map(nid => noteStore.getNoteById(nid))
    .filter(Boolean) as NoteRecord[]
);

const filteredNotes = computed(() => {
  const q = noteSearch.value.trim().toLowerCase();
  const all = noteStore.notes;
  if (!q) return all;
  return all.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.summary.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q)
  );
});

function isNoteLinked(noteId: string): boolean {
  return mistake.value?.linkedNoteIds?.includes(noteId) || false;
}

async function toggleNoteLink(note: NoteRecord) {
  if (!mistake.value) return;
  const linked = mistake.value.linkedNoteIds || [];
  const already = linked.includes(note.id);
  try {
    if (already) {
      await mistakeStore.updateMistake(id, { linkedNoteIds: linked.filter(x => x !== note.id) });
      await noteStore.updateNote(note.id, { linkedMistakeIds: (note.linkedMistakeIds || []).filter(x => x !== id) });
    } else {
      await mistakeStore.updateMistake(id, { linkedNoteIds: [...linked, note.id] });
      await noteStore.updateNote(note.id, { linkedMistakeIds: [...(note.linkedMistakeIds || []), id] });
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `关联失败：${e?.message || String(e)}`, timeout: 3000 });
  }
}

function openLinkNoteDialog() {
  if (noteStore.notes.length === 0) {
    noteStore.fetchAll().then(() => { notesLoaded.value = true; });
  } else {
    notesLoaded.value = true;
  }
  noteSearch.value = '';
  showLinkNoteDialog.value = true;
}

onMounted(async () => {
  await mistakeStore.fetchOne(id);
  if (noteStore.notes.length === 0) {
    await noteStore.fetchAll();
    notesLoaded.value = true;
  } else {
    notesLoaded.value = true;
  }
});

async function handleEditSave(data: Record<string, any>) {
  if (!mistake.value) return;
  try {
    const title = data.title?.trim() || mistake.value.title;
    await mistakeStore.updateMistake(id, {
      title,
      content: data.content,
      answer: data.answer || '',
      tags: data.tags || [],
      subject: data.subject || '',
      difficulty: data.difficulty || 0,
      knowledgePoints: data.knowledgePoints || [],
      notes: data.notes || '',
      year: data.year || '',
      knowledgeAreas: data.knowledgeAreas || [],
      sourcePaperType: data.sourcePaperType || '',
      sourcePaperName: data.sourcePaperName || '',
      questionNumber: data.questionNumber || '',
    });
    showEditDialog.value = false;
    $q.notify({ type: 'positive', message: '已更新', timeout: 1500 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `更新失败：${e?.message || String(e)}`, timeout: 3000 });
  }
}

async function deleteMistake() {
  $q.dialog({
    title: '确认删除',
    message: '确定删除这道错题吗？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await mistakeStore.removeMistake(id);
    $q.notify({ type: 'positive', message: '已删除', timeout: 1500 });
    router.back();
  });
}

function openRawAiEditDialog() {
  rawAiEditContent.value = mistake.value?.aiAnalysis || '';
  rawAiEditError.value = '';
  showRawAiEditDialog.value = true;
}

function retryParseJson() {
  rawAiEditError.value = '';
  const text = rawAiEditContent.value.trim();
  if (!text) {
    rawAiEditError.value = '内容为空';
    return;
  }

  // Try to extract JSON from the text
  let cleaned = text;
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch && jsonMatch[1]) {
    cleaned = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.correctAnswer && parsed.steps) {
      saveParsedAnalysis(parsed);
      return;
    }
    rawAiEditError.value = 'JSON 已解析，但缺少必要字段（需要 correctAnswer 和 steps）';
  } catch {
    const braceStart = cleaned.indexOf('{');
    const braceEnd = cleaned.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1) {
      try {
        const parsed = JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
        if (parsed.correctAnswer && parsed.steps) {
          saveParsedAnalysis(parsed);
          return;
        }
        rawAiEditError.value = 'JSON 已解析，但缺少必要字段（需要 correctAnswer 和 steps）';
      } catch {
        rawAiEditError.value = '无法解析为 JSON，请检查格式后重试，或选择"作为 Markdown 存储"';
      }
    } else {
      rawAiEditError.value = '未找到 JSON 对象，请确保内容包含 { ... } 结构';
    }
  }
}

async function saveParsedAnalysis(parsed: any) {
  savingRawAi.value = true;
  try {
    await mistakeStore.updateMistake(id, { aiAnalysis: JSON.stringify(parsed) });
    await mistakeStore.fetchOne(id);
    showRawAiEditDialog.value = false;
    $q.notify({ type: 'positive', message: 'AI 分析已保存为结构化数据', timeout: 2000 });
  } catch (e: any) {
    rawAiEditError.value = `保存失败：${e?.message || String(e)}`;
  } finally {
    savingRawAi.value = false;
  }
}

async function saveRawAiAsMarkdown() {
  savingRawAi.value = true;
  try {
    await mistakeStore.updateMistake(id, { aiAnalysis: rawAiEditContent.value });
    await mistakeStore.fetchOne(id);
    showRawAiEditDialog.value = false;
    $q.notify({ type: 'positive', message: 'AI 分析已保存为文本', timeout: 2000 });
  } catch (e: any) {
    rawAiEditError.value = `保存失败：${e?.message || String(e)}`;
  } finally {
    savingRawAi.value = false;
  }
}

function openNote(noteId: string) {
  router.push({ name: 'note-detail', params: { id: noteId } });
}

const analysisSchemaHint = `{
  "correctAnswer": "正确答案",
  "steps": ["步骤1", "步骤2"],
  "knowledgePoints": ["知识点1", "知识点2"],
  "commonMistakes": ["常见错误1"],
  "difficulty": 3
}`;

async function confirmFix() {
  if (!mistake.value) return;
  savingFix.value = true;
  try {
    const analysis = parseAnalysis(fixText.value);
    await mistakeStore.updateMistake(mistake.value.id, { aiAnalysis: JSON.stringify(analysis) });
    await mistakeStore.fetchOne(mistake.value.id);
    showAnalysisFixDialog.value = false;
    $q.notify({ type: 'positive', message: '已保存修正后的分析', timeout: 2000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `仍无法解析：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    savingFix.value = false;
  }
}
</script>

<style scoped>
.markdown-body img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 8px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.schema-hint {
  white-space: pre-wrap;
  word-break: break-all;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 12px;
  max-height: 180px;
  overflow: auto;
}
</style>
