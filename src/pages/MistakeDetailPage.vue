<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" />
      <q-space />
      <q-btn flat icon="more_vert" round>
        <q-menu auto-close>
          <q-list dense>
            <q-item clickable @click="startEdit">
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
          <div class="text-weight-medium q-mb-sm">AI 分析</div>
          <div style="white-space: pre-wrap">{{ mistake.aiAnalysis }}</div>
        </div>
      </div>

      <div class="col-12 col-md-5 q-pl-md" v-if="!editing">
        <div class="text-h5">{{ mistake.title }}</div>
        <div class="q-mt-sm">
          <q-chip v-for="tag in mistake.tags" :key="tag" size="sm" color="primary" text-color="white">{{ tag }}</q-chip>
          <span v-if="mistake.tags.length === 0" class="text-grey text-caption">无标签</span>
        </div>

        <q-separator class="q-my-md" />

        <div class="q-mb-md">
          <div class="row text-caption text-grey">
            <div class="col-6" v-if="mistake.year">年份：{{ mistake.year }}</div>
            <div class="col-6" v-if="mistake.knowledgeArea">知识板块：{{ mistake.knowledgeArea }}</div>
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
        <div v-if="mistake.linkedNoteIds.length > 0" class="q-mt-md">
          <div class="text-weight-medium q-mb-sm">关联笔记 ({{ mistake.linkedNoteIds.length }})</div>
          <q-chip v-for="nid in mistake.linkedNoteIds" :key="nid" size="sm" color="secondary" text-color="white" clickable @click="openNote(nid)">
            {{ nid.slice(0, 8) }}
          </q-chip>
        </div>

      </div>

      <div class="col-12 col-md-5 q-pl-md" v-if="editing">
        <q-input v-model="editTitle" label="标题" outlined dense class="q-mb-md" />
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-4">
            <q-select v-model="editYear" :options="yearOptions" label="年份" clearable outlined dense />
          </div>
          <div class="col-4">
            <q-select v-model="editKnowledgeArea" :options="knowledgeAreas" label="知识板块" clearable outlined dense />
          </div>
          <div class="col-4">
            <q-select v-model="editSourcePaperType" :options="paperTypes" label="试卷类型" clearable outlined dense />
          </div>
          <div class="col-6">
            <q-input v-model="editSourcePaperName" label="来源试卷名称" outlined dense />
          </div>
          <div class="col-6">
            <q-input v-model="editQuestionNumber" label="题号" outlined dense />
          </div>
        </div>
        <q-select v-model="editSubject" :options="subjects" label="科目" clearable outlined dense class="q-mb-md" />
        <div class="q-mb-md">
          <span class="text-caption q-mr-sm">难度</span>
          <q-rating v-model="editDifficulty" :max="5" size="1.5em" icon="star_border" icon-selected="star" color="orange" />
        </div>
        <q-input v-model="editTagInput" label="标签（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addEditTag" />
        <div class="q-mb-md">
          <q-chip v-for="(tag, idx) in editTags" :key="idx" removable @remove="editTags.splice(idx, 1)" size="sm" color="primary" text-color="white">{{ tag }}</q-chip>
        </div>

        <div class="text-weight-medium q-mb-sm">题目内容 (Markdown)</div>
        <q-input v-model="editContent" outlined dense autogrow type="textarea" class="q-mb-md font-mono" input-style="min-height: 80px; font-family: monospace; font-size: 13px" />

        <div class="text-weight-medium q-mb-sm">答案 (Markdown)</div>
        <q-input v-model="editAnswer" outlined dense autogrow type="textarea" class="q-mb-md font-mono" input-style="min-height: 80px; font-family: monospace; font-size: 13px" />

        <q-input v-model="editKpInput" label="知识点（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addEditKp" />
        <div class="q-mb-md">
          <q-chip v-for="(kp, idx) in editKnowledgePoints" :key="idx" removable @remove="editKnowledgePoints.splice(idx, 1)" color="secondary" text-color="white" size="sm">{{ kp }}</q-chip>
        </div>
        <q-input v-model="editNotes" label="备注" outlined dense autogrow type="textarea" class="q-mb-md" />
        <div class="row q-gutter-sm">
          <q-btn color="primary" label="保存" @click="saveEdit" unelevated />
          <q-btn flat label="取消" @click="cancelEdit" />
        </div>
      </div>
    </div>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-spinner size="40px" />
      <p class="q-mt-sm">加载中...</p>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import AIAnalysisCard from '@/components/AIAnalysisCard.vue';
import { renderMarkdown } from '@/utils/markdown';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const mistakeStore = useMistakeStore();

const editing = ref(false);
const editTitle = ref('');
const editContent = ref('');
const editSubject = ref('');
const editYear = ref('');
const editKnowledgeArea = ref('');
const editSourcePaperType = ref('');
const editSourcePaperName = ref('');
const editQuestionNumber = ref('');
const editTags = ref<string[]>([]);
const editAnswer = ref('');
const editDifficulty = ref(0);
const editKnowledgePoints = ref<string[]>([]);
const editKpInput = ref('');
const editNotes = ref('');
const editTagInput = ref('');

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const yearOptions = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));
const knowledgeAreas = ['代数', '几何', '函数', '概率统计', '数列', '三角', '向量', '解析几何', '立体几何', '其他'];
const paperTypes = ['月考', '期中', '期末', '模拟', '高考真题', '竞赛', '单元测试', '其他'];
const id = route.params.id as string;

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

watch(() => mistake.value, (m) => {
  if (m) {
    editTitle.value = m.title;
    editContent.value = m.content || '';
    editSubject.value = m.subject;
    editYear.value = m.year || '';
    editKnowledgeArea.value = m.knowledgeArea || '';
    editSourcePaperType.value = m.sourcePaperType || '';
    editSourcePaperName.value = m.sourcePaperName || '';
    editQuestionNumber.value = m.questionNumber || '';
    editTags.value = [...m.tags];
    editAnswer.value = m.answer || '';
    editDifficulty.value = m.difficulty || 0;
    editKnowledgePoints.value = [...(m.knowledgePoints || [])];
    editNotes.value = m.notes;
  }
}, { immediate: true });

if (!mistake.value) {
  mistakeStore.fetchOne(id);
}

function addEditTag() {
  const t = editTagInput.value.trim();
  if (t && !editTags.value.includes(t)) {
    editTags.value.push(t);
    editTagInput.value = '';
  }
}

function addEditKp() {
  const k = editKpInput.value.trim();
  if (k && !editKnowledgePoints.value.includes(k)) {
    editKnowledgePoints.value.push(k);
    editKpInput.value = '';
  }
}

function startEdit() {
  if (!mistake.value) return;
  editTitle.value = mistake.value.title;
  editContent.value = mistake.value.content || '';
  editSubject.value = mistake.value.subject;
  editYear.value = mistake.value.year || '';
  editKnowledgeArea.value = mistake.value.knowledgeArea || '';
  editSourcePaperType.value = mistake.value.sourcePaperType || '';
  editSourcePaperName.value = mistake.value.sourcePaperName || '';
  editQuestionNumber.value = mistake.value.questionNumber || '';
  editTags.value = [...mistake.value.tags];
  editAnswer.value = mistake.value.answer || '';
  editDifficulty.value = mistake.value.difficulty || 0;
  editKnowledgePoints.value = [...(mistake.value.knowledgePoints || [])];
  editNotes.value = mistake.value.notes;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

async function saveEdit() {
  if (!mistake.value) return;
  await mistakeStore.updateMistake(id, {
    title: editTitle.value,
    content: editContent.value,
    subject: editSubject.value,
    year: editYear.value,
    knowledgeArea: editKnowledgeArea.value,
    sourcePaperType: editSourcePaperType.value,
    sourcePaperName: editSourcePaperName.value,
    questionNumber: editQuestionNumber.value,
    tags: editTags.value,
    answer: editAnswer.value,
    difficulty: editDifficulty.value,
    knowledgePoints: editKnowledgePoints.value,
    notes: editNotes.value,
  });
  editing.value = false;
  $q.notify({ type: 'positive', message: '已更新', timeout: 1500 });
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

function openNote(noteId: string) {
  router.push({ name: 'note-detail', params: { id: noteId } });
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
</style>
