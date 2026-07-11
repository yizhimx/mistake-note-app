<template>
  <q-page class="review-page">
    <div v-if="!inReview" class="q-pa-md">
      <div class="row items-center q-mb-md">
        <div class="col">
          <h5 class="q-my-none text-weight-medium">错题回顾</h5>
        </div>
      </div>

      <div v-if="savedProgress" class="bg-primary text-white q-pa-md rounded-borders q-mb-md row items-center">
        <q-icon name="history" class="q-mr-sm" />
        <span>上次回顾到第 {{ savedProgress.index + 1 }}/{{ savedProgress.total || '?' }} 题</span>
        <q-space />
        <q-btn flat label="继续" @click="resumeReview" no-caps unelevated />
        <q-btn flat label="丢弃" @click="clearProgress" no-caps unelevated dense />
      </div>

      <div class="row items-center q-mb-md text-grey">
        <q-icon name="info" size="sm" class="q-mr-sm" />
        <span>共 <strong>{{ reviewItems.length }}</strong> 道错题需学习</span>
        <q-space />
        <q-btn color="primary" icon="play_arrow" label="开始回顾" :disable="reviewItems.length === 0" @click="startReview" unelevated no-caps />
      </div>

      <q-list bordered separator v-if="reviewItems.length > 0">
        <q-item v-for="m in reviewItems" :key="m.id">
          <q-item-section avatar>
            <div v-if="m.imageUrls[0]" class="rounded-borders" :style="{ width: '50px', height: '50px', backgroundImage: `url(${m.imageUrls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }" />
            <div v-else class="bg-grey-3 rounded-borders" style="width: 50px; height: 50px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ m.title }}</q-item-label>
            <q-item-label caption>
              {{ m.subject || '未分类' }}
              <q-chip v-if="!m.sm2Data" size="xs" color="info" text-color="white" class="q-ml-xs">新题</q-chip>
              <span v-else> · 复习 {{ m.reviewCount }} 次</span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <div v-if="reviewItems.length === 0" class="text-center q-mt-xl text-grey">
        <q-icon name="celebration" size="64px" />
        <p class="q-mt-sm">今日无需复习</p>
        <q-btn color="primary" label="去添加错题" :to="{ name: 'mistake-list' }" />
      </div>
    </div>

    <div v-if="inReview" class="review-card-container">
      <div class="review-header">
        <div class="row items-center">
          <q-btn flat round dense icon="arrow_back" @click="exitReview" />
          <div class="text-caption text-grey q-ml-sm">
            {{ currentIndex + 1 }} / {{ reviewQueue.length }}
          </div>
          <q-space />
          <q-chip v-if="currentReview && !currentReview.sm2Data" size="xs" color="info" text-color="white">新题</q-chip>
          <q-btn flat round dense icon="close" @click="exitReview" />
        </div>
        <q-linear-progress :value="reviewQueue.length > 0 ? (currentIndex + 1) / reviewQueue.length : 0" color="primary" class="q-mt-xs" rounded size="6px" />
      </div>

      <div class="review-card" v-if="currentReview">
        <div class="card-scroll">
          <!-- Question side: only the question content -->
          <div v-if="showQuestion">
            <div v-if="currentReview.content" class="q-pa-md text-center markdown-body" v-html="renderedReviewContent" />
            <div v-else class="q-pa-md text-center">
              <div class="text-h5">{{ currentReview.title }}</div>
            </div>
          </div>

          <!-- Answer side: only the answer content -->
          <div v-else>
            <div v-if="currentReview.answer" class="q-pa-md markdown-body" v-html="renderedAnswer" />
            <div v-else class="text-grey text-center q-pa-lg">暂无答案内容</div>
          </div>
        </div>
      </div>

      <div v-if="!currentReview" class="flex flex-center text-grey" style="flex:1">
        <div class="text-center">
          <q-icon name="check_circle" size="64px" color="positive" />
          <p class="q-mt-sm">本轮回顾完成！</p>
          <q-btn color="primary" label="返回" @click="exitReview" unelevated />
        </div>
      </div>

      <div v-if="currentReview" class="action-bar">
        <div class="row q-gutter-sm">
          <q-btn class="col" unelevated no-caps outline color="grey" icon="skip_previous" label="上一题" :disable="currentIndex === 0" @click="prevCard" />
          <q-btn class="col" unelevated no-caps :color="isLast ? 'positive' : 'grey'" :icon="isLast ? 'check' : 'skip_next'" :label="isLast ? '完成复习' : '下一题'" @click="skip" />
          <q-btn class="col" unelevated no-caps :color="showQuestion ? 'orange' : 'primary'" :icon="showQuestion ? 'visibility_off' : 'visibility'" :label="showQuestion ? '看答案' : '看题目'" @click="toggleView" />
          <q-btn class="col" unelevated no-caps color="positive" icon="thumb_up" label="评价" @click="showRating = true" />
        </div>

        <q-slide-transition>
          <div v-if="showRating" class="q-mt-md">
            <div class="row q-gutter-sm justify-center">
              <q-btn class="rating-btn col-3" unelevated no-caps color="negative" push @click="rate('fresh')">
                <div class="column items-center">
                  <span class="text-weight-bold">重来</span>
                  <span class="text-caption">1</span>
                </div>
              </q-btn>
              <q-btn class="rating-btn col-3" unelevated no-caps color="deep-orange" push @click="rate('hesitant')">
                <div class="column items-center">
                  <span class="text-weight-bold">困难</span>
                  <span class="text-caption">2</span>
                </div>
              </q-btn>
              <q-btn class="rating-btn col-3" unelevated no-caps color="positive" push @click="rate('smooth')">
                <div class="column items-center">
                  <span class="text-weight-bold">良好</span>
                  <span class="text-caption">3</span>
                </div>
              </q-btn>
              <q-btn class="rating-btn col-3" unelevated no-caps color="primary" push @click="rate('easy')">
                <div class="column items-center">
                  <span class="text-weight-bold">简单</span>
                  <span class="text-caption">4</span>
                </div>
              </q-btn>
            </div>
          </div>
        </q-slide-transition>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useMistakeStore, type MistakeRecord } from '@/stores/mistakeStore';
import { calculateSM2 } from '@/services/sm2';
import { renderMarkdown } from '@/utils/markdown';
import { preloadFromMarkdown } from '@/services/imageStore';

const SAVE_KEY = 'review_progress';

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const inReview = ref(false);
const showAnswer = ref(false);
const showRating = ref(false);
const showQuestion = ref(true);
const slide = ref(0);
const currentReview = ref<MistakeRecord | null>(null);
const reviewQueue = ref<MistakeRecord[]>([]);
const currentIndex = ref(0);

const renderedAnswer = computed(() => {
  return currentReview.value?.answer ? renderMarkdown(currentReview.value.answer) : '';
});

const renderedReviewContent = computed(() => {
  return currentReview.value?.content ? renderMarkdown(currentReview.value.content) : '';
});

const reviewItems = computed(() => {
  return mistakeStore.mistakes.filter(m => {
    if (!m.sm2Data) return true;
    try {
      const sm2 = JSON.parse(m.sm2Data);
      return new Date(sm2.nextReviewDate) <= new Date();
    } catch { return true; }
  });
});

interface SavedProgress {
  queue: string[];
  index: number;
  total: number;
}

const isLast = computed(() => currentReview.value !== null && currentIndex.value >= reviewQueue.value.length - 1);

const savedProgress = ref<SavedProgress | null>(null);

function saveProgress() {
  if (reviewQueue.value.length === 0) return;
  const originalTotal = reviewQueue.value.length;
  const data: SavedProgress = { queue: reviewQueue.value.map(m => m.id), index: currentIndex.value, total: originalTotal };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearProgress() {
  localStorage.removeItem(SAVE_KEY);
  savedProgress.value = null;
}

async function resumeReview() {
  const prog = savedProgress.value;
  if (!prog) return;
  const ids = new Set(prog.queue);
  const items = mistakeStore.mistakes.filter(m => ids.has(m.id));
  const ordered = prog.queue.map(id => items.find(m => m.id === id)).filter(Boolean) as MistakeRecord[];
  if (ordered.length === 0) { clearProgress(); return; }
  reviewQueue.value = ordered;
  const targetIndex = Math.min(prog.index, ordered.length - 1);
  currentIndex.value = targetIndex;
  showAnswer.value = false;
  showRating.value = false;
  showQuestion.value = true;
  const next = reviewQueue.value[targetIndex];
  await Promise.all([preloadFromMarkdown(next.content || ''), preloadFromMarkdown(next.answer || '')]);
  currentReview.value = next;
  inReview.value = true;
  clearProgress();
}

async function startReview() {
  reviewQueue.value = [...reviewItems.value];
  currentIndex.value = 0;
  showAnswer.value = false;
  showRating.value = false;
  showQuestion.value = true;
  if (reviewQueue.value.length > 0) {
    const next = reviewQueue.value[0];
    await Promise.all([preloadFromMarkdown(next.content || ''), preloadFromMarkdown(next.answer || '')]);
    currentReview.value = next;
    inReview.value = true;
  }
}

function toggleView() {
  showQuestion.value = !showQuestion.value;
}

async function nextCard() {
  currentIndex.value++;
  showQuestion.value = true;
  showRating.value = false;
  if (currentIndex.value < reviewQueue.value.length) {
    const next = reviewQueue.value[currentIndex.value];
    await Promise.all([preloadFromMarkdown(next.content || ''), preloadFromMarkdown(next.answer || '')]);
    currentReview.value = next;
  } else {
    currentReview.value = null;
    $q.notify({ type: 'positive', message: '本轮回顾完成！', timeout: 2000 });
  }
}

async function prevCard() {
  if (currentIndex.value <= 0) return;
  currentIndex.value--;
  const prev = reviewQueue.value[currentIndex.value];
  await Promise.all([preloadFromMarkdown(prev.content || ''), preloadFromMarkdown(prev.answer || '')]);
  currentReview.value = prev;
  showQuestion.value = true;
  showRating.value = false;
}

function exitReview() {
  saveProgress();
  inReview.value = false;
  currentReview.value = null;
}

function qualityMap(label: string): number {
  switch (label) {
    case 'fresh': return 1;
    case 'hesitant': return 2;
    case 'smooth': return 3;
    case 'easy': return 5;
    default: return 3;
  }
}

function masteryMap(label: string): string {
  return label === 'fresh' ? 'fresh' : label === 'hesitant' ? 'hesitant' : 'smooth';
}

async function rate(label: string) {
  if (!currentReview.value) return;
  const m = currentReview.value;
  const quality = qualityMap(label);
  const mastery = masteryMap(label);
  const prevData = m.sm2Data ? JSON.parse(m.sm2Data) : null;
  const sm2 = calculateSM2(quality, prevData);
  await mistakeStore.updateMistake(m.id, {
    sm2Data: JSON.stringify(sm2),
    masteryLevel: mastery,
    reviewCount: m.reviewCount + 1,
    lastReviewAt: new Date().toISOString(),
  });
  $q.notify({ type: 'positive', message: '已评价', timeout: 1000 });
  showRating.value = false;
}

function skip() {
  nextCard();
}

function onKeydown(e: KeyboardEvent) {
  if (!inReview.value || !currentReview.value) return;
  if (e.key === 'Escape') { exitReview(); return; }
  if (e.key === ' ' || e.key === 'Space') {
    e.preventDefault();
    toggleView();
  }
  if (showRating.value) {
    switch (e.key) {
      case '1': rate('fresh'); break;
      case '2': rate('hesitant'); break;
      case '3': rate('smooth'); break;
      case '4': rate('easy'); break;
    }
  }
}

onMounted(async () => {
  await mistakeStore.fetchAll();
  savedProgress.value = loadProgress();
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style lang="scss" scoped>
.review-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.review-card-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.review-header {
  margin-bottom: 12px;
}

.review-card {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  overflow: hidden;
  min-height: 200px;
}

.card-scroll {
  padding: 20px;
  overflow-y: auto;
  max-height: calc(100vh - 280px);
}

.action-bar {
  padding: 12px 0;
}

.rating-btn {
  border-radius: 10px;
  padding: 10px 0;
  min-width: 0;
}

.slide-up-enter-active {
  transition: all 0.3s ease-out;
}
.slide-up-leave-active {
  transition: all 0.2s ease-in;
}
.slide-up-enter-from {
  transform: translateY(20px);
  opacity: 0;
}
.slide-up-leave-to {
  opacity: 0;
}

.body--dark {
  .review-card {
    background: #1d1d1d;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }
}
</style>
