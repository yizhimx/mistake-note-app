<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" />
      <q-space />
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
          <div class="text-weight-medium q-mb-sm">AI 分析</div>
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
        <div v-if="mistake.linkedNoteIds.length > 0" class="q-mt-md">
          <div class="text-weight-medium q-mb-sm">关联笔记 ({{ mistake.linkedNoteIds.length }})</div>
          <q-chip v-for="nid in mistake.linkedNoteIds" :key="nid" size="sm" color="secondary" text-color="white" clickable @click="openNote(nid)">
            {{ nid.slice(0, 8) }}
          </q-chip>
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
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import MistakeForm from '@/components/MistakeForm.vue';
import AIAnalysisCard from '@/components/AIAnalysisCard.vue';
import { renderMarkdown } from '@/utils/markdown';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const mistakeStore = useMistakeStore();

const showEditDialog = ref(false);
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

if (!mistake.value) {
  mistakeStore.fetchOne(id);
}

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
