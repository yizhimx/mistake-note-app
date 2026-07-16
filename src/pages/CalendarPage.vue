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
        <q-select v-model="filters.difficulty" :options="difficultyOptions" label="难度" multiple use-chips clearable outlined dense emit-value map-options @clear="filters.difficulty = []" />
      </div>
      <div class="col-12 col-md-4 q-mb-sm q-mb-md-none">
        <q-select
          v-model="filters.knowledgePoint"
          :options="knowledgePointOptions"
          label="知识点"
          clearable
          outlined
          dense
          @clear="filters.knowledgePoint = ''"
          option-value="value"
          option-label="label"
        />
      </div>
      <div class="col-12 col-md-4 q-mb-sm q-mb-md-none">
        <q-btn label="应用" color="primary" unelevated class="full-width" @click="$q.notify({ type: 'info', message: '已应用筛选', timeout: 1000 })" />
      </div>
    </div>

    <!-- 日历视图 -->
    <div class="row items-center q-mb-sm">
      <div class="col text-weight-medium">日历</div>
      <div class="col-auto">
        <q-btn-toggle
          v-model="viewMode"
          spread
          no-caps
          dense
          rounded
          unelevated
          toggle-color="primary"
          :options="[
            { label: '月', value: 'month' },
            { label: '周', value: 'week' },
            { label: '日', value: 'day' },
          ]"
        />
      </div>
    </div>

    <!-- 月视图 -->
    <q-card flat bordered v-if="viewMode === 'month'" class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-btn flat dense icon="chevron_left" @click="prevMonth" />
          <div class="col text-center text-subtitle1">{{ viewYear }} 年 {{ viewMonth + 1 }} 月</div>
          <q-btn flat dense icon="chevron_right" @click="nextMonth" />
          <q-btn flat dense no-caps label="今天" class="q-ml-sm" @click="goToday" />
        </div>
        <div class="cal-grid cal-header">
          <div v-for="w in weekdays" :key="w" class="text-center text-caption text-grey">{{ w }}</div>
        </div>
        <div class="cal-grid">
          <div
            v-for="cell in monthGrid"
            :key="cell.date"
            class="cal-cell"
            :class="{ 'cal-today': cell.date === todayStr, 'cal-muted': !cell.isCurrentMonth }"
            @click="openDay(cell.date)"
          >
            <div class="cal-daynum">{{ cell.day }}</div>
            <div class="cal-dots">
              <span v-if="dayEvents(cell.date).created.length" class="cal-dot bg-blue" />
              <span v-if="dayEvents(cell.date).reviewed.length" class="cal-dot bg-green" />
            </div>
          </div>
        </div>
        <div class="row items-center q-mt-sm text-caption text-grey">
          <span class="cal-dot bg-blue q-mr-xs" /> 新增
          <span class="cal-dot bg-green q-ml-md q-mr-xs" /> 复习
        </div>
      </q-card-section>
    </q-card>

    <!-- 周视图 -->
    <q-card flat bordered v-else-if="viewMode === 'week'" class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-btn flat dense icon="chevron_left" @click="prevWeek" />
          <div class="col text-center text-subtitle1">{{ weekRangeLabel }}</div>
          <q-btn flat dense icon="chevron_right" @click="nextWeek" />
          <q-btn flat dense no-caps label="今天" class="q-ml-sm" @click="goToday" />
        </div>
        <div class="cal-grid cal-header">
          <div v-for="w in weekdays" :key="w" class="text-center text-caption text-grey">{{ w }}</div>
        </div>
        <div class="cal-grid">
          <div
            v-for="day in weekDays"
            :key="day"
            class="cal-cell cal-week"
            :class="{ 'cal-today': day === todayStr }"
            @click="openDay(day)"
          >
            <div class="cal-daynum">{{ Number(day.slice(8, 10)) }}</div>
            <div class="cal-dots">
              <span v-if="dayEvents(day).created.length" class="cal-dot bg-blue" />
              <span v-if="dayEvents(day).reviewed.length" class="cal-dot bg-green" />
            </div>
            <div class="cal-chips">
              <div
                v-for="e in dayEvents(day).created.slice(0, 2)"
                :key="'c' + e.id"
                class="cal-chip bg-blue-1 text-blue"
              >{{ e.title || '(无标题)' }}</div>
              <div
                v-for="e in dayEvents(day).reviewed.slice(0, 2)"
                :key="'r' + e.id"
                class="cal-chip bg-green-1 text-green"
              >{{ e.title || '(无标题)' }}</div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- 日视图 -->
    <q-card flat bordered v-else class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-btn flat dense icon="chevron_left" @click="prevDay" />
          <div class="col text-center text-subtitle1">{{ selectedDate }}</div>
          <q-btn flat dense icon="chevron_right" @click="nextDay" />
          <q-btn flat dense no-caps label="今天" class="q-ml-sm" @click="goToday" />
        </div>
        <q-list separator>
          <q-item
            v-for="e in dayTimeline"
            :key="e.id + e.action"
            clickable
            @click="goToDetail(e)"
          >
            <q-item-section avatar style="min-width: 48px">
              <div class="text-caption text-grey">{{ timeLabel(e.time) }}</div>
            </q-item-section>
            <q-item-section>
              <div :class="e.action === 'created' ? 'text-blue' : 'text-green'">
                {{ e.title || '(无标题)' }}
              </div>
              <div class="text-caption text-grey">
                {{ e.kind === 'mistake' ? '错题' : '笔记' }} · {{ e.action === 'created' ? '新增' : '复习' }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-icon :name="e.action === 'created' ? 'add' : 'check'" :color="e.action === 'created' ? 'blue' : 'green'" />
            </q-item-section>
          </q-item>
          <div v-if="dayTimeline.length === 0" class="text-center text-grey q-pa-lg">当日无学习记录</div>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- 当日详情弹窗 -->
    <q-dialog v-model="showDayDialog">
      <q-card style="min-width: 320px; max-width: 92vw;">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ selectedDate }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <div class="text-subtitle2 text-blue q-mb-xs">新增 ({{ dialogEvents.created.length }})</div>
          <q-list dense>
            <q-item
              v-for="e in dialogEvents.created"
              :key="e.id"
              clickable
              @click="goToDetail(e)"
            >
              <q-item-section avatar><q-icon name="add" color="blue" /></q-item-section>
              <q-item-section>{{ e.title || '(无标题)' }}</q-item-section>
              <q-item-section side class="text-caption text-grey">{{ e.kind === 'mistake' ? '错题' : '笔记' }}</q-item-section>
            </q-item>
          </q-list>
          <div v-if="dialogEvents.created.length === 0" class="text-grey q-pa-xs">无</div>

          <div class="text-subtitle2 text-green q-mt-sm q-mb-xs">复习 ({{ dialogEvents.reviewed.length }})</div>
          <q-list dense>
            <q-item
              v-for="e in dialogEvents.reviewed"
              :key="e.id"
              clickable
              @click="goToDetail(e)"
            >
              <q-item-section avatar><q-icon name="check" color="green" /></q-item-section>
              <q-item-section>{{ e.title || '(无标题)' }}</q-item-section>
              <q-item-section side class="text-caption text-grey">{{ e.kind === 'mistake' ? '错题' : '笔记' }}</q-item-section>
            </q-item>
          </q-list>
          <div v-if="dialogEvents.reviewed.length === 0" class="text-grey q-pa-xs">无</div>

          <div
            v-if="dialogEvents.created.length === 0 && dialogEvents.reviewed.length === 0"
            class="text-center text-grey q-pa-md"
          >当日无学习记录</div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- 统计（保留在下方） -->
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
            <div class="text-weight-medium q-mb-sm">复习完成率</div>
            <StatsChart
              v-if="reviewCompletionRate.percent !== undefined"
              type="ring"
              :data="[{ name: '已复习', value: reviewCompletionRate.reviewed }, { name: '未复习', value: reviewCompletionRate.pending }]"
              :centerLabel="reviewCompletionRate.percent + '%'"
            />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">知识点分布</div>
            <StatsChart
              v-if="knowledgePointData.length > 0"
              type="pie"
              :data="knowledgePointData"
              @sector-click="onKnowledgePointClick"
            />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">掌握度分布</div>
            <StatsChart
              v-if="masteryBarData.values.some(v => v > 0)"
              type="bar"
              :data="masteryBarData"
              :colors="masteryColors"
            />
            <div v-else class="text-center q-pa-lg text-grey">暂无数据</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-weight-medium q-mb-sm">每周新增趋势</div>
            <StatsChart
              v-if="weeklyNewTrendData.values.some(v => v > 0)"
              type="line"
              :data="weeklyNewTrendData"
            />
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
import { useRouter } from 'vue-router';
import { useMistakeStore } from '@/stores/mistakeStore';
import { useNoteStore } from '@/stores/noteStore';
import StatsChart from '@/components/StatsChart.vue';

const $q = useQuasar();
const router = useRouter();
const mistakeStore = useMistakeStore();
const noteStore = useNoteStore();

// ── 日期工具（使用本地时区，避免 .slice(0,10) 的 UTC 偏移 bug）──
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toDateKey(iso: string): string {
  return toLocalDateStr(new Date(iso));
}
function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface CalEvent {
  id: string;
  title: string;
  kind: 'mistake' | 'note';
  action: 'created' | 'reviewed';
  time: string;
}

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const todayStr = toLocalDateStr(new Date());

// 视图状态
const viewMode = ref<'month' | 'week' | 'day'>('month');
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth()); // 0-11
const selectedDate = ref(todayStr);
const showDayDialog = ref(false);

// ── 现有筛选（统计沿用）──
const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const difficultyOptions = [
  { label: '1 星', value: 1 },
  { label: '2 星', value: 2 },
  { label: '3 星', value: 3 },
  { label: '4 星', value: 4 },
  { label: '5 星', value: 5 },
];

const knowledgePointOptions = computed(() => {
  const set = new Set<string>();
  for (const m of mistakeStore.mistakes) {
    (m.knowledgePoints || []).forEach(k => set.add(k));
    (m.knowledgeAreas || []).forEach(k => set.add(k));
  }
  return Array.from(set).map(v => ({ label: v, value: v }));
});

const showFilter = ref(true);

const filters = reactive({
  subject: [] as string[],
  difficulty: [] as number[],
  knowledgePoint: '' as string,
});

const hasFilter = computed(() => filters.subject.length > 0 || filters.difficulty.length > 0 || !!filters.knowledgePoint);

const filtered = computed(() => {
  let items = mistakeStore.mistakes;
  if (filters.subject.length > 0) {
    items = items.filter(m => filters.subject.includes(m.subject));
  }
  if (filters.difficulty.length > 0) {
    items = items.filter(m => filters.difficulty.includes(Number(m.difficulty) || 0));
  }
  if (filters.knowledgePoint) {
    items = items.filter(m =>
      (m.knowledgePoints || []).includes(filters.knowledgePoint) ||
      (m.knowledgeAreas || []).includes(filters.knowledgePoint)
    );
  }
  return items;
});

// 笔记仅按科目筛选（笔记无难度字段）
const filteredNotes = computed(() => {
  let items = noteStore.notes;
  if (filters.subject.length > 0) {
    items = items.filter(n => filters.subject.includes(n.subject));
  }
  return items;
});

// ── 日历事件聚合：date -> { created, reviewed } ──
// 说明：复习绿点基于 lastReviewAt（单字段，代表最近一次复习日，非完整复习历史）
const calendarEvents = computed(() => {
  const map: Record<string, { created: CalEvent[]; reviewed: CalEvent[] }> = {};
  const ensure = (key: string) => {
    if (!map[key]) map[key] = { created: [], reviewed: [] };
    return map[key];
  };

  for (const m of filtered.value) {
    ensure(toDateKey(m.createdAt)).created.push({
      id: m.id, title: m.title, kind: 'mistake', action: 'created', time: m.createdAt,
    });
    if (m.lastReviewAt) {
      ensure(toDateKey(m.lastReviewAt)).reviewed.push({
        id: m.id, title: m.title, kind: 'mistake', action: 'reviewed', time: m.lastReviewAt,
      });
    }
  }

  for (const n of filteredNotes.value) {
    ensure(toDateKey(n.createdAt)).created.push({
      id: n.id, title: n.title, kind: 'note', action: 'created', time: n.createdAt,
    });
  }

  return map;
});

function dayEvents(date: string): { created: CalEvent[]; reviewed: CalEvent[] } {
  return calendarEvents.value[date] || { created: [], reviewed: [] };
}

const dialogEvents = computed(() => dayEvents(selectedDate.value));

// ── 月视图网格（周一为首，固定 6 周 42 格）──
function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 周一=0
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: toLocalDateStr(d),
      day: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
    };
  });
}
const monthGrid = computed(() => getMonthGrid(viewYear.value, viewMonth.value));

// ── 周视图（所选日期所在周，周一为首）──
const weekDays = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return toLocalDateStr(day);
  });
});
const weekRangeLabel = computed(() => {
  const days = weekDays.value;
  const first = days[0] ?? '';
  const last = days[6] ?? '';
  return `${first.slice(5)} ~ ${last.slice(5)}`;
});

// ── 日视图时间线 ──
const dayTimeline = computed(() => {
  const ev = dayEvents(selectedDate.value);
  const items: CalEvent[] = [
    ...ev.created.map(e => ({ ...e })),
    ...ev.reviewed.map(e => ({ ...e })),
  ];
  items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return items;
});

// ── 导航 ──
function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; }
  else viewMonth.value--;
  selectedDate.value = toLocalDateStr(new Date(viewYear.value, viewMonth.value, 1));
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; }
  else viewMonth.value++;
  selectedDate.value = toLocalDateStr(new Date(viewYear.value, viewMonth.value, 1));
}
function prevWeek() {
  const d = new Date(selectedDate.value + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  selectedDate.value = toLocalDateStr(d);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
function nextWeek() {
  const d = new Date(selectedDate.value + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  selectedDate.value = toLocalDateStr(d);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
function prevDay() {
  const d = new Date(selectedDate.value + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  selectedDate.value = toLocalDateStr(d);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
function nextDay() {
  const d = new Date(selectedDate.value + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  selectedDate.value = toLocalDateStr(d);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
function goToday() {
  const now = new Date();
  viewYear.value = now.getFullYear();
  viewMonth.value = now.getMonth();
  selectedDate.value = toLocalDateStr(now);
}
function openDay(date: string) {
  selectedDate.value = date;
  showDayDialog.value = true;
}
function goToDetail(e: CalEvent) {
  showDayDialog.value = false;
  router.push({
    name: e.kind === 'mistake' ? 'mistake-detail' : 'note-detail',
    params: { id: e.id },
  });
}

// ── 统计（对齐提示词 3.6）──
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

// 复习完成率进度环：reviewed / total
const reviewCompletionRate = computed(() => {
  const total = filtered.value.length;
  const reviewed = filtered.value.filter(m => m.reviewCount > 0).length;
  const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  return {
    reviewed,
    pending: total - reviewed,
    percent,
  };
});

// 掌握度分布柱状图：生疏/犹豫/顺利/未掌握
const masteryBarData = computed(() => {
  const counts: Record<string, number> = { 生疏: 0, 犹豫: 0, 顺利: 0, 未掌握: 0 };
  for (const m of filtered.value) {
    if (!m.masteryLevel) counts['未掌握'] = (counts['未掌握'] ?? 0) + 1;
    else if (m.masteryLevel === 'fresh') counts['生疏'] = (counts['生疏'] ?? 0) + 1;
    else if (m.masteryLevel === 'hesitant') counts['犹豫'] = (counts['犹豫'] ?? 0) + 1;
    else if (m.masteryLevel === 'smooth') counts['顺利'] = (counts['顺利'] ?? 0) + 1;
  }
  const labels = ['生疏', '犹豫', '顺利', '未掌握'];
  const values = labels.map(k => counts[k] ?? 0);
  return { labels, values };
});

// 知识点分布饼图：优先 knowledgePoints，回退 knowledgeAreas
const knowledgePointData = computed(() => {
  const counts: Record<string, number> = {};
  for (const m of filtered.value) {
    const points = (m.knowledgePoints && m.knowledgePoints.length > 0)
      ? m.knowledgePoints
      : (m.knowledgeAreas || []);
    for (const kp of points) {
      counts[kp] = (counts[kp] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([k, v]) => ({ name: k, value: v }));
});

// 每周新增趋势折线图：最近 7 个 ISO 周，按 createdAt 聚合
const weeklyNewTrendData = computed(() => {
  const weekCounts: Record<string, number> = {};
  const now = new Date();
  // 生成最近 7 个周一的日期键
  const weekKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7 - i * 7); // 本周周一往前推 i 周
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    weekKeys.push(toLocalDateStr(monday));
  }
  weekKeys.forEach(k => { weekCounts[k] = 0; });

  for (const m of filtered.value) {
    const created = new Date(m.createdAt);
    const monday = new Date(created);
    monday.setDate(created.getDate() - ((created.getDay() + 6) % 7));
    const key = toLocalDateStr(monday);
    if (weekCounts[key] !== undefined) {
      weekCounts[key]++;
    }
  }

  const labels = weekKeys.map(k => `${k.slice(5)}周`);
  const values = weekKeys.map(k => weekCounts[k] ?? 0);
  return { labels, values };
});

// 柱状图语义化颜色：生疏=红, 犹豫=橙, 顺利=绿, 未掌握=灰
const masteryColors = ['#E53935', '#FB8C00', '#43A047', '#9E9E9E'];

function clearFilters() {
  filters.subject = [];
  filters.difficulty = [];
  filters.knowledgePoint = '';
}

function onKnowledgePointClick(name: string) {
  filters.knowledgePoint = name;
  $q.notify({ type: 'info', message: `已按知识点筛选: ${name}`, timeout: 1500 });
}

onMounted(async () => {
  await mistakeStore.fetchAll();
  await noteStore.fetchAll();
});
</script>

<style scoped>
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-header {
  padding: 0 2px;
}
.cal-header > div {
  padding: 4px 0;
}
.cal-cell {
  min-height: 56px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  margin: 2px;
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: background 0.15s;
}
.cal-cell:hover {
  background: rgba(0, 0, 0, 0.04);
}
.cal-muted .cal-daynum {
  color: #bbb;
}
.cal-today {
  border-color: var(--q-primary);
  background: rgba(33, 118, 243, 0.08);
}
.cal-daynum {
  font-size: 13px;
  font-weight: 500;
}
.cal-dots {
  margin-top: 2px;
  display: flex;
  gap: 3px;
}
.cal-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}
.cal-week {
  min-height: 84px;
}
.cal-chips {
  margin-top: 3px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.cal-chip {
  font-size: 10px;
  line-height: 1.3;
  padding: 1px 4px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
