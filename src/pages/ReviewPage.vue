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
        <span>上次回顾到第 {{ savedProgress.index + 1 }}/{{ savedProgress.total }} 题</span>
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
            {{ currentIndex + 1 }} / {{ totalCount }}
          </div>
          <q-space />
          <q-btn flat round dense icon="close" @click="exitReview" />
        </div>
        <q-linear-progress :value="currentIndex / totalCount" color="primary" class="q-mt-xs" rounded size="6px" />
      </div>

      <div class="review-card" :class="{ flipped: showAnswer }" @click="showAnswer = true" v-if="currentReview">
        <div class="card-face card-front">
          <div class="card-content">
            <img v-if="currentReview.imageUrls[0]" :src="currentReview.imageUrls[0]" class="card-image" />
            <div class="card-title">{{ currentReview.title }}</div>
            <div class="card-subtitle" v-if="currentReview.subject">
              <q-chip size="xs" color="primary" text-color="white">{{ currentReview.subject }}</q-chip>
              <q-chip v-if="!currentReview.sm2Data" size="xs" color="info" text-color="white">新题</q-chip>
            </div>
          </div>
          <div class="card-hint text-grey">
            <q-icon name="touch_app" size="sm" class="q-mr-xs" />
            点击或按空格显示答案
          </div>
        </div>

        <div class="card-face card-back">
          <div class="card-content">
            <img v-if="currentReview.imageUrls[0]" :src="currentReview.imageUrls[0]" class="card-image" />
            <div class="card-title">{{ currentReview.title }}</div>
            <div class="card-tags q-my-sm">
              <q-chip v-for="t in currentReview.tags" :key="t" size="xs" color="secondary" text-color="white">{{ t }}</q-chip>
            </div>
            <q-separator class="q-my-md" />
            <div v-if="currentReview.notes" class="card-notes">
              <div class="text-weight-medium text-grey-8">备注</div>
              <div class="text-body1 q-mt-xs" style="white-space: pre-wrap">{{ currentReview.notes }}</div>
            </div>
            <div v-else class="text-grey text-center">无额外备注</div>
            <div class="card-stats q-mt-md text-caption text-grey">
              已复习 {{ currentReview.reviewCount }} 次
              <span v-if="currentReview.lastReviewAt"> · 上次 {{ currentReview.lastReviewAt.slice(0, 10) }}</span>
            </div>
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

      <transition name="slide-up">
        <div v-if="showAnswer" class="rating-bar">
          <div class="rating-label text-caption text-grey-7 q-mb-xs text-center">掌握程度</div>
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
      </transition>

      <q-btn v-if="!showAnswer" flat icon="skip_next" label="跳过" class="skip-btn" @click="skip" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useMistakeStore, type MistakeRecord } from '@/stores/mistakeStore';
import { calculateSM2 } from '@/services/sm2';

const SAVE_KEY = 'review_progress';

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const inReview = ref(false);
const showAnswer = ref(false);
const currentReview = ref<MistakeRecord | null>(null);
const reviewQueue = ref<MistakeRecord[]>([]);
const currentIndex = ref(0);
const totalCount = ref(0);

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

const savedProgress = ref<SavedProgress | null>(null);

function saveProgress() {
  const ids = reviewQueue.value.slice(currentIndex.value).map(m => m.id);
  if (ids.length === 0) return;
  const data: SavedProgress = { queue: ids, index: currentIndex.value, total: totalCount.value };
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

function resumeReview() {
  const prog = savedProgress.value;
  if (!prog) return;
  const ids = new Set(prog.queue);
  const items = mistakeStore.mistakes.filter(m => ids.has(m.id));
  const ordered = prog.queue.map(id => items.find(m => m.id === id)).filter(Boolean) as MistakeRecord[];
  if (ordered.length === 0) { clearProgress(); return; }
  reviewQueue.value = ordered;
  totalCount.value = prog.total;
  currentIndex.value = 0;
  showAnswer.value = false;
  currentReview.value = reviewQueue.value[0];
  inReview.value = true;
  clearProgress();
}

function startReview() {
  reviewQueue.value = [...reviewItems.value];
  totalCount.value = reviewQueue.value.length;
  currentIndex.value = 0;
  showAnswer.value = false;
  if (reviewQueue.value.length > 0) {
    currentReview.value = reviewQueue.value[currentIndex.value];
    inReview.value = true;
  }
}

function nextCard() {
  currentIndex.value++;
  if (currentIndex.value < reviewQueue.value.length) {
    currentReview.value = reviewQueue.value[currentIndex.value];
    showAnswer.value = false;
  } else {
    currentReview.value = null;
    $q.notify({ type: 'positive', message: '本轮回顾完成！', timeout: 2000 });
  }
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
  nextCard();
}

function skip() {
  if (currentReview.value) {
    reviewQueue.value.push(currentReview.value);
  }
  nextCard();
}

function onKeydown(e: KeyboardEvent) {
  if (!inReview.value) return;
  if (e.key === 'Escape') { exitReview(); return; }
  if (!showAnswer.value) {
    if (e.key === ' ' || e.key === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      showAnswer.value = true;
    }
  } else {
    switch (e.key) {
      case '1': rate('fresh'); break;
      case '2': rate('hesitant'); break;
      case '3': rate('smooth'); break;
      case '4': rate('easy'); break;
      case ' ':
      case 'Space':
      case 'Enter':
        e.preventDefault();
        rate('smooth');
        break;
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
  position: relative;
  min-height: 300px;
  cursor: pointer;
  user-select: none;
}

.card-face {
  position: absolute;
  inset: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backface-visibility: hidden;
}

.review-card.flipped .card-front {
  display: none;
}

.card-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.card-image {
  max-height: 240px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 8px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 500;
  text-align: center;
  word-break: break-word;
}

.card-subtitle {
  margin-top: 8px;
}

.card-hint {
  text-align: center;
  padding: 16px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.card-notes {
  width: 100%;
  text-align: left;
}

.card-stats {
  text-align: center;
}

.rating-bar {
  padding: 16px 0;
}

.rating-btn {
  border-radius: 10px;
  padding: 10px 0;
  min-width: 0;
}

.skip-btn {
  align-self: center;
  margin-top: 4px;
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
  .card-face {
    background: #1d1d1d;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }
  .card-title {
    color: #e0e0e0;
  }
  .card-hint {
    color: #888;
  }
}
</style>
