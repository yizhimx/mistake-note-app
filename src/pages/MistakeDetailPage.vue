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
        <q-carousel
          v-if="mistake.imageUrls.length > 0"
          v-model="slide" animated arrows navigation infinite
          class="rounded-borders" style="max-height: 400px"
        >
          <q-carousel-slide v-for="(url, idx) in mistake.imageUrls" :key="idx" :name="idx">
            <img :src="url" class="full-height full-width" style="object-fit: contain" />
          </q-carousel-slide>
        </q-carousel>
        <div v-else class="bg-grey-3 rounded-borders flex flex-center" style="height: 200px">
          <span class="text-grey">无图片</span>
        </div>
        <div class="q-mt-xs text-caption text-grey">共 {{ mistake.imageUrls.length }} 张图片</div>

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
        <div class="q-mt-sm text-grey">科目：{{ mistake.subject || '未分类' }}</div>
        <div class="text-grey" v-if="mistake.difficulty">
          <span>难度：{{ difficultyLabel }}</span>
        </div>
        <div class="text-grey text-caption">创建时间：{{ mistake.createdAt }}</div>

        <div class="q-mt-md" v-if="mistake.answer || mistake.answerImages.length > 0">
          <div class="text-weight-medium">答案</div>
          <div v-if="mistake.answer" class="q-mt-xs markdown-body" v-html="renderedAnswer" />
          <div v-if="mistake.answerImages.length > 0" class="row q-gutter-sm q-mt-sm">
            <div v-for="(url, idx) in mistake.answerImages" :key="idx" class="col-6">
              <q-img :src="url" style="max-height: 200px" class="rounded-borders" />
            </div>
          </div>
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
        <div v-if="mistake.sm2Data" class="text-caption text-grey">
          下次复习：{{ nextReviewDate }}
        </div>
        <div v-if="mistake.linkedNoteIds.length > 0" class="q-mt-md">
          <div class="text-weight-medium q-mb-sm">关联笔记 ({{ mistake.linkedNoteIds.length }})</div>
          <q-chip v-for="nid in mistake.linkedNoteIds" :key="nid" size="sm" color="secondary" text-color="white" clickable @click="openNote(nid)">
            {{ nid.slice(0, 8) }}
          </q-chip>
        </div>
        <q-separator class="q-my-md" />
        <div class="q-mb-md">
          <div class="text-weight-medium q-mb-sm">掌握度评价</div>
          <div class="row q-gutter-sm">
            <q-btn color="negative" icon="sentiment_very_dissatisfied" label="生疏" @click="rateMistake('fresh')" unelevated class="col" no-caps />
            <q-btn color="warning" icon="sentiment_neutral" label="犹豫" @click="rateMistake('hesitant')" unelevated class="col" no-caps />
            <q-btn color="positive" icon="sentiment_satisfied" label="顺利" @click="rateMistake('smooth')" unelevated class="col" no-caps />
          </div>
        </div>
      </div>

      <div class="col-12 col-md-5 q-pl-md" v-if="editing">
        <q-input v-model="editTitle" label="标题" outlined dense class="q-mb-md" />
        <q-select v-model="editSubject" :options="subjects" label="科目" clearable outlined dense class="q-mb-md" />
        <q-input v-model="editTagInput" label="标签（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addEditTag" />
        <div class="q-mb-md">
          <q-chip v-for="(tag, idx) in editTags" :key="idx" removable @remove="editTags.splice(idx, 1)" size="sm" color="primary" text-color="white">{{ tag }}</q-chip>
        </div>

        <div class="text-weight-medium q-mb-sm">答案</div>
        <q-input v-model="editAnswer" label="答案（支持 Markdown）" outlined dense autogrow type="textarea" class="q-mb-md" />
        <ImageUploader ref="editAnswerUploaderRef" @change="onEditAnswerImagesChanged" />
        <div v-if="editAnswerImages.length > 0" class="row q-gutter-sm q-mb-md">
          <div v-for="(url, idx) in editAnswerImages" :key="idx" class="col-4 relative-position">
            <q-img :src="url" style="height: 80px" class="rounded-borders" />
            <q-btn flat round dense size="sm" icon="close" class="absolute-top-right bg-white" @click="editAnswerImages.splice(idx, 1)" />
          </div>
        </div>

        <q-select v-model="editDifficulty" :options="difficulties" label="难度" clearable outlined dense class="q-mb-md" />
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
import ImageUploader from '@/components/ImageUploader.vue';
import { calculateSM2 } from '@/services/sm2';
import { compressToDataUrl } from '@/services/ocrService';
import { renderMarkdown } from '@/utils/markdown';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const mistakeStore = useMistakeStore();

const slide = ref(0);
const editing = ref(false);
const editTitle = ref('');
const editSubject = ref('');
const editTags = ref<string[]>([]);
const editAnswer = ref('');
const editAnswerImages = ref<string[]>([]);
const editDifficulty = ref('');
const editKnowledgePoints = ref<string[]>([]);
const editKpInput = ref('');
const editNotes = ref('');
const editTagInput = ref('');

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const difficulties = ['简单', '中等', '困难'];
const id = route.params.id as string;

const mistake = computed(() => mistakeStore.getMistakeById(id));

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

const difficultyLabel = computed(() => {
  const map: Record<string, string> = { '简单': '简单', '中等': '中等', '困难': '困难' };
  return mistake.value?.difficulty ? map[mistake.value.difficulty] || mistake.value.difficulty : '';
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
    editSubject.value = m.subject;
    editTags.value = [...m.tags];
    editAnswer.value = m.answer || '';
    editAnswerImages.value = [...(m.answerImages || [])];
    editDifficulty.value = m.difficulty || '';
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
  editSubject.value = mistake.value.subject;
  editTags.value = [...mistake.value.tags];
  editAnswer.value = mistake.value.answer || '';
  editAnswerImages.value = [...(mistake.value.answerImages || [])];
  editDifficulty.value = mistake.value.difficulty || '';
  editKnowledgePoints.value = [...(mistake.value.knowledgePoints || [])];
  editNotes.value = mistake.value.notes;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  // restore from current mistake
  if (mistake.value) {
    editAnswerImages.value = [...(mistake.value.answerImages || [])];
  }
}

async function onEditAnswerImagesChanged(files: File[]) {
  for (const file of files) {
    const dataUrl = await compressToDataUrl(file);
    editAnswerImages.value.push(dataUrl);
  }
}

async function saveEdit() {
  if (!mistake.value) return;
  await mistakeStore.updateMistake(id, {
    title: editTitle.value,
    subject: editSubject.value,
    tags: editTags.value,
    answer: editAnswer.value,
    answerImages: editAnswerImages.value,
    difficulty: editDifficulty.value,
    knowledgePoints: editKnowledgePoints.value,
    notes: editNotes.value,
  });
  editing.value = false;
  $q.notify({ type: 'positive', message: '已更新', timeout: 1500 });
}

async function rateMistake(label: 'fresh' | 'hesitant' | 'smooth') {
  if (!mistake.value) return;
  const quality = label === 'fresh' ? 1 : label === 'hesitant' ? 3 : 5;
  const prevData = mistake.value.sm2Data ? JSON.parse(mistake.value.sm2Data) : null;
  const sm2 = calculateSM2(quality, prevData);
  await mistakeStore.updateMistake(id, {
    sm2Data: JSON.stringify(sm2),
    masteryLevel: label,
    reviewCount: mistake.value.reviewCount + 1,
    lastReviewAt: new Date().toISOString(),
  });
  $q.notify({ type: 'positive', message: `已评价：${masteryLabel.value}`, timeout: 1500 });
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
