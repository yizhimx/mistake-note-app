<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">回收站</h5>
      </div>
      <div class="col-auto q-gutter-xs">
        <q-btn
          v-if="deletedItems.length > 0"
          flat
          dense
          no-caps
          icon="restore_from_trash"
          color="positive"
          label="全部恢复"
          @click="restoreAll"
          :disable="busy"
        />
        <q-btn
          v-if="deletedItems.length > 0"
          flat
          dense
          no-caps
          icon="delete_forever"
          color="negative"
          label="清空回收站"
          @click="purgeAll"
          :disable="busy"
        />
      </div>
    </div>

    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-md-4">
        <q-select
          v-model="typeFilter"
          :options="typeOptions"
          label="类型"
          outlined
          dense
          emit-value
          map-options
        />
      </div>
      <div class="col-12 col-md-8">
        <q-input v-model="keyword" label="搜索标题" outlined dense clearable placeholder="输入关键词搜索..." />
      </div>
    </div>

    <q-list bordered separator v-if="filteredItems.length > 0">
      <q-item v-for="item in filteredItems" :key="item.type + ':' + item.id">
        <q-item-section avatar>
          <q-icon :name="item.type === 'mistake' ? 'error_outline' : 'note_alt'" :color="item.type === 'mistake' ? 'negative' : 'primary'" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ item.title || '(无标题)' }}</q-item-label>
          <q-item-label caption lines="1">
            {{ item.type === 'mistake' ? '错题' : '笔记' }} · {{ item.subject || '未分类' }} · 删除于 {{ formatDate(item.updatedAt) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row q-gutter-xs">
            <q-btn flat dense no-caps icon="restore_from_trash" color="positive" label="恢复" @click="restoreOne(item)" :disable="busy" />
            <q-btn flat dense no-caps icon="delete_forever" color="negative" label="彻底删除" @click="purgeOne(item)" :disable="busy" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-icon name="delete_outline" size="64px" />
      <p class="q-mt-sm">回收站为空</p>
    </div>

    <q-inner-loading :showing="loading" />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import { useNoteStore } from '@/stores/noteStore';
import type { MistakeRecord } from '@/stores/mistakeStore';
import type { NoteRecord } from '@/stores/noteStore';

const $q = useQuasar();
const mistakeStore = useMistakeStore();
const noteStore = useNoteStore();

interface DeletedItem {
  type: 'mistake' | 'note';
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
}

const loading = ref(false);
const busy = ref(false);
const typeFilter = ref<'all' | 'mistake' | 'note'>('all');
const keyword = ref('');

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: '错题', value: 'mistake' },
  { label: '笔记', value: 'note' },
];

const deletedItems = ref<DeletedItem[]>([]);

function toItem(type: 'mistake' | 'note', r: MistakeRecord | NoteRecord): DeletedItem {
  return {
    type,
    id: r.id,
    title: r.title || '',
    subject: r.subject || '',
    updatedAt: r.updatedAt,
  };
}

async function loadDeleted() {
  loading.value = true;
  try {
    const [mistakes, notes] = await Promise.all([
      mistakeStore.fetchDeletedMistakes(),
      noteStore.fetchDeletedNotes(),
    ]);
    deletedItems.value = [
      ...mistakes.map((m) => toItem('mistake', m)),
      ...notes.map((n) => toItem('note', n)),
    ];
  } catch (e: any) {
    console.error('Failed to load deleted items:', e);
    $q.notify({ type: 'negative', message: `加载回收站失败：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    loading.value = false;
  }
}

onMounted(loadDeleted);

const filteredItems = computed(() => {
  let result = deletedItems.value;
  if (typeFilter.value !== 'all') {
    result = result.filter((i) => i.type === typeFilter.value);
  }
  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();
    result = result.filter((i) => (i.title || '').toLowerCase().includes(q));
  }
  return result;
});

function formatDate(d: string): string {
  return d ? d.slice(0, 10) : '';
}

async function restoreOne(item: DeletedItem) {
  busy.value = true;
  try {
    if (item.type === 'mistake') await mistakeStore.restoreMistake(item.id);
    else await noteStore.restoreNote(item.id);
    deletedItems.value = deletedItems.value.filter((i) => !(i.type === item.type && i.id === item.id));
    $q.notify({ type: 'positive', message: '已恢复', timeout: 1500 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `恢复失败：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    busy.value = false;
  }
}

async function purgeOne(item: DeletedItem) {
  $q.dialog({
    title: '确认彻底删除',
    message: '此操作不可恢复，关联的图片与链接将一并清除。确定要彻底删除吗？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    busy.value = true;
    try {
      if (item.type === 'mistake') await mistakeStore.purgeMistake(item.id);
      else await noteStore.purgeNote(item.id);
      deletedItems.value = deletedItems.value.filter((i) => !(i.type === item.type && i.id === item.id));
      $q.notify({ type: 'positive', message: '已彻底删除', timeout: 1500 });
    } catch (e: any) {
      $q.notify({ type: 'negative', message: `删除失败：${e?.message || String(e)}`, timeout: 3000 });
    } finally {
      busy.value = false;
    }
  });
}

async function restoreAll() {
  busy.value = true;
  try {
    const results = await Promise.allSettled([
      mistakeStore.restoreAllMistakes(),
      noteStore.restoreAllNotes(),
    ]);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      deletedItems.value = [];
      $q.notify({ type: 'positive', message: '已恢复全部', timeout: 1500 });
    } else {
      await loadDeleted();
      $q.notify({ type: 'warning', message: '部分恢复失败，已刷新列表', timeout: 3000 });
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `恢复失败：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    busy.value = false;
  }
}

async function purgeAll() {
  $q.dialog({
    title: '确认清空回收站',
    message: '此操作不可恢复，所有已删除的错题与笔记（含关联图片）将永久清除。确定要继续吗？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    busy.value = true;
    try {
      const results = await Promise.allSettled([
        mistakeStore.purgeAllMistakes(),
        noteStore.purgeAllNotes(),
      ]);
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === 0) {
        deletedItems.value = [];
        $q.notify({ type: 'positive', message: '回收站已清空', timeout: 1500 });
      } else {
        await loadDeleted();
        $q.notify({ type: 'warning', message: '部分清除失败，已刷新列表', timeout: 3000 });
      }
    } catch (e: any) {
      $q.notify({ type: 'negative', message: `清空失败：${e?.message || String(e)}`, timeout: 3000 });
    } finally {
      busy.value = false;
    }
  });
}
</script>
