<template>
  <q-page class="q-pa-md">
    <h5 class="q-my-none q-mb-md text-weight-medium">学习统计</h5>

    <div class="row items-center q-mb-md">
      <div class="col">
        <q-btn flat dense no-caps icon="filter_list" label="筛选" @click="showFilter = !showFilter" :color="hasFilter ? 'primary' : 'grey'" />
        <q-btn v-if="hasFilter" flat dense no-caps icon="clear" label="重置" color="grey" @click="clearFilters" />
      </div>
    </div>

    <div class="row q-mb-md" v-show="showFilter">
      <div class="col-12 col-md-4 q-pr-md q-mb-sm q-mb-md-none">
        <q-select v-model="filters.subject" :options="subjects" label="科目" multiple use-chips clearable outlined dense @clear="filters.subject = []" />
      </div>
      <div class="col-12 col-md-4 q-pr-md q-mb-sm q-mb-md-none">
        <q-select v-model="filters.difficulty" :options="difficulties" label="难度" multiple use-chips clearable outlined dense @clear="filters.difficulty = []" />
      </div>
      <div class="col-12 col-md-4 q-mb-sm q-mb-md-none">
        <q-btn label="应用" color="primary" unelevated class="full-width" @click="$q.notify({ type: 'info', message: '已应用筛选', timeout: 1000 })" />
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-6 col-md-3">
        <q-card flat bordered>
          <q-card-section class="text-center">
            <div class="text-h5 text-primary">{{ stats.total }}</div>
            <div class="text-caption text-grey">错题总数</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card flat bordered>
          <q-card-section class="text-center">
            <div class="text-h5 text-positive">{{ stats.reviewed }}</div>
            <div class="text-caption text-grey">已复习</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card flat bordered>
          <q-card-section class="text-center">
            <div class="text-h5 text-orange">{{ stats.today }}</div>
            <div class="text-caption text-grey">今日需复习</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card flat bordered>
          <q-card-section class="text-center">
            <div class="text-h5" :class="smoothRateColor">{{ stats.smoothRate }}%</div>
            <div class="text-caption text-grey">掌握率</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">掌握程度分布</div>
            <StatsChart v-if="masteryData.length > 0" type="ring" :data="masteryData" />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">难度分布</div>
            <StatsChart v-if="difficultyData.length > 0" type="pie" :data="difficultyData" />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">科目分布</div>
            <StatsChart v-if="subjectLabels.length > 0" type="bar" :data="{ labels: subjectLabels, values: subjectValues }" />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">近期复习趋势</div>
            <StatsChart v-if="trendLabels.length > 0" type="line" :data="{ labels: trendLabels, values: trendValues }" />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import StatsChart from '@/components/StatsChart.vue';

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const difficulties = ['简单', '中等', '困难'];

const showFilter = ref(true);

const filters = reactive({
  subject: [] as string[],
  difficulty: [] as string[],
});

const hasFilter = computed(() => filters.subject.length > 0 || filters.difficulty.length > 0);

const filtered = computed(() => {
  let items = mistakeStore.mistakes;
  if (filters.subject.length > 0) {
    items = items.filter(m => filters.subject.includes(m.subject));
  }
  if (filters.difficulty.length > 0) {
    items = items.filter(m => filters.difficulty.includes(m.difficulty));
  }
  return items;
});

const stats = computed(() => {
  const total = filtered.value.length;
  const reviewed = filtered.value.filter(m => m.reviewCount > 0).length;
  const today = filtered.value.filter(m => {
    if (!m.sm2Data) return true;
    try { return new Date(JSON.parse(m.sm2Data).nextReviewDate) <= new Date(); }
    catch { return true; }
  }).length;
  const smooth = filtered.value.filter(m => m.masteryLevel === 'smooth').length;
  const smoothRate = total > 0 ? Math.round((smooth / total) * 100) : 0;
  return { total, reviewed, today, smoothRate };
});

const smoothRateColor = computed(() => {
  const r = stats.value.smoothRate;
  if (r >= 70) return 'text-positive';
  if (r >= 40) return 'text-orange';
  return 'text-negative';
});

const masteryData = computed(() => {
  const counts: Record<string, number> = { 生疏: 0, 犹豫: 0, 顺利: 0, 未掌握: 0 };
  for (const m of filtered.value) {
    if (!m.masteryLevel) counts['未掌握']++;
    else if (m.masteryLevel === 'fresh') counts['生疏']++;
    else if (m.masteryLevel === 'hesitant') counts['犹豫']++;
    else if (m.masteryLevel === 'smooth') counts['顺利']++;
  }
  return Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
});

const difficultyData = computed(() => {
  const counts: Record<string, number> = {};
  for (const m of filtered.value) {
    const key = m.difficulty || '未设置';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).map(([k, v]) => ({ name: k, value: v }));
});

const subjectLabels = computed(() => {
  const map = subjectCounts.value;
  return Object.keys(map);
});

const subjectValues = computed(() => {
  const map = subjectCounts.value;
  return Object.values(map);
});

const subjectCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const m of filtered.value) {
    const key = m.subject || '未分类';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
});

const trendLabels = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
});

const trendValues = computed(() => {
  return trendLabels.value.map(date => {
    return filtered.value.filter(m => {
      if (!m.lastReviewAt) return false;
      return m.lastReviewAt.slice(0, 10) === date;
    }).length;
  });
});

function clearFilters() {
  filters.subject = [];
  filters.difficulty = [];
}

onMounted(async () => {
  await mistakeStore.fetchAll();
});
</script>
