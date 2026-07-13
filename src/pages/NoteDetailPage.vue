<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" />
      <q-space />
      <q-btn color="primary" label="保存" unelevated :loading="saving" @click="saveNote" />
    </div>

    <q-input v-model="title" label="笔记标题" outlined class="q-mb-md" />

    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-3">
        <q-select v-model="subject" :options="subjects" label="科目" clearable outlined dense />
      </div>
      <div class="col-3">
        <q-input v-model="volume" label="册数" outlined dense placeholder="例如：必修一" />
      </div>
      <div class="col-3">
        <q-input v-model="chapter" label="章" outlined dense placeholder="例如：第一章 集合" />
      </div>
      <div class="col-3">
        <q-input v-model="section" label="节" outlined dense placeholder="例如：1.1 集合的概念" />
      </div>
    </div>

    <div class="text-weight-medium q-mb-sm">知识点概要</div>
    <q-input v-model="summary" outlined dense autogrow type="textarea" placeholder="简要概述本笔记的核心知识点..." class="q-mb-md" />

    <div class="row q-col-gutter-sm" style="min-height:400px">
      <div class="col-12 col-md-6">
        <div class="text-caption text-grey q-mb-xs">编辑</div>
        <q-input v-model="content" type="textarea" label="Markdown 详细内容" outlined autogrow :input-style="{ minHeight: '380px', fontFamily: 'monospace' }" class="fit" />
      </div>
      <div class="col-12 col-md-6">
        <div class="text-caption text-grey q-mb-xs">预览</div>
        <div class="markdown-preview markdown-body" v-html="renderedContent" style="min-height:380px;border:1px solid #ddd;border-radius:4px;padding:12px;overflow-y:auto" />
      </div>
    </div>

    <q-separator class="q-my-md" />

    <div>
      <div class="row items-center q-mb-sm">
        <div class="text-weight-medium">关联错题 ({{ linkedMistakes.length }})</div>
        <q-space />
        <q-btn flat dense icon="link" label="管理" size="sm" @click="openLinkMistakeDialog" />
      </div>
      <div v-if="linkedMistakes.length > 0">
        <q-chip v-for="m in linkedMistakes" :key="m.id" size="sm" color="secondary" text-color="white" clickable @click="openMistake(m.id)" icon="error_outline" :label="`${m.title} · ${m.subject || '未分类'}${m.difficulty ? ' ★'.repeat(m.difficulty) : ''}`" />
      </div>
      <div v-else class="text-grey text-caption">暂无关联错题</div>
    </div>

    <q-dialog v-model="showLinkMistakeDialog">
      <q-card style="min-width:450px;max-width:600px">
        <q-card-section>
          <div class="text-h6">管理关联错题</div>
          <q-input v-model="mistakeSearch" label="搜索错题..." outlined dense clearable class="q-mt-sm" />
        </q-card-section>
        <q-card-section class="scroll" style="max-height:50vh;min-height:300px">
          <div v-if="mistakesLoaded">
            <q-item v-for="m in filteredMistakes" :key="m.id" clickable v-ripple @click="toggleMistakeLink(m)" class="q-mb-xs">
              <q-item-section side>
                <q-checkbox :model-value="isMistakeLinked(m.id)" dense />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ m.title }}</q-item-label>
                <q-item-label caption>{{ m.subject || '未分类' }} · 难度 {{ m.difficulty }}/5 · {{ m.knowledgeAreas?.join(', ') || '无知识板块' }}</q-item-label>
              </q-item-section>
            </q-item>
            <div v-if="filteredMistakes.length === 0" class="text-center text-grey q-py-md">没有匹配的错题</div>
          </div>
          <div v-else class="text-center text-grey q-py-md"><q-spinner size="24px" /> 加载中...</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" color="primary" @click="showLinkMistakeDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { uid } from 'quasar';
import { useNoteStore } from '@/stores/noteStore';
import { useMistakeStore, type MistakeRecord } from '@/stores/mistakeStore';
import { renderMarkdown } from '@/utils/markdown';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const noteStore = useNoteStore();
const mistakeStore = useMistakeStore();

const title = ref('');
const subject = ref<string | null>(null);
const volume = ref('');
const chapter = ref('');
const section = ref('');
const summary = ref('');
const content = ref('');
const saving = ref(false);
const showLinkMistakeDialog = ref(false);
const mistakeSearch = ref('');
const mistakesLoaded = ref(false);

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];

const isNew = route.query.new === 'true';
const noteId = isNew ? null : (route.params.id as string);

const renderedContent = computed(() => {
  return content.value ? renderMarkdown(content.value) : '';
});

const linkedMistakes = computed(() => {
  if (!noteId) return [];
  const ids = noteStore.getNoteById(noteId)?.linkedMistakeIds || [];
  return ids
    .map(mid => mistakeStore.getMistakeById(mid))
    .filter(Boolean) as MistakeRecord[];
});

const filteredMistakes = computed(() => {
  const q = mistakeSearch.value.trim().toLowerCase();
  const all = mistakeStore.mistakes;
  if (!q) return all;
  return all.filter(m =>
    m.title.toLowerCase().includes(q) ||
    m.content.toLowerCase().includes(q) ||
    m.subject.toLowerCase().includes(q) ||
    m.knowledgeAreas?.some(k => k.toLowerCase().includes(q))
  );
});

function isMistakeLinked(mistakeId: string): boolean {
  if (!noteId) return false;
  return noteStore.getNoteById(noteId)?.linkedMistakeIds?.includes(mistakeId) || false;
}

async function toggleMistakeLink(m: MistakeRecord) {
  if (!noteId) return;
  const note = noteStore.getNoteById(noteId);
  if (!note) return;
  const linked = note.linkedMistakeIds || [];
  const already = linked.includes(m.id);
  try {
    if (already) {
      await mistakeStore.updateMistake(m.id, { linkedNoteIds: (m.linkedNoteIds || []).filter(x => x !== noteId) });
      await noteStore.updateNote(noteId, { linkedMistakeIds: linked.filter(x => x !== m.id) });
    } else {
      await mistakeStore.updateMistake(m.id, { linkedNoteIds: [...(m.linkedNoteIds || []), noteId] });
      await noteStore.updateNote(noteId, { linkedMistakeIds: [...linked, m.id] });
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `关联失败：${e?.message || String(e)}`, timeout: 3000 });
  }
}

function openMistake(id: string) {
  router.push({ name: 'mistake-detail', params: { id } });
}

function openLinkMistakeDialog() {
  if (mistakeStore.mistakes.length === 0) {
    mistakeStore.fetchAll().then(() => { mistakesLoaded.value = true; });
  } else {
    mistakesLoaded.value = true;
  }
  mistakeSearch.value = '';
  showLinkMistakeDialog.value = true;
}

async function saveNote() {
  if (!title.value.trim()) {
    $q.notify({ type: 'warning', message: '请输入笔记标题', timeout: 2000 });
    return;
  }
  saving.value = true;
  try {
    const now = new Date().toISOString();
    const recordData = {
      subject: subject.value || '',
      volume: volume.value,
      chapter: chapter.value,
      section: section.value,
      summary: summary.value,
      isFolder: false,
      content: content.value,
      plainText: (summary.value + ' ' + content.value).replace(/[#*`\n]/g, ' ').trim(),
      tags: [] as string[],
      knowledgePoints: [] as string[],
      tips: [] as string[],
      imageUrls: [] as string[],
      linkedMistakeIds: [] as string[],
    };

    if (isNew) {
      await noteStore.addNote({
        id: uid(),
        title: title.value,
        ...recordData,
        createdAt: now,
        updatedAt: now,
        synced: false,
      });
    } else if (noteId) {
      await noteStore.updateNote(noteId, {
        title: title.value,
        ...recordData,
      });
    }
    $q.notify({ type: 'positive', message: '笔记已保存', timeout: 2000 });
    router.back();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e?.message || String(e)}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}

if (!isNew && noteId) {
  noteStore.fetchOne(noteId).then((note) => {
    if (note) {
      title.value = note.title;
      subject.value = note.subject || null;
      volume.value = note.volume;
      chapter.value = note.chapter;
      section.value = note.section;
      summary.value = note.summary;
      content.value = note.content;
    }
  });
}

onMounted(() => {
  if (mistakeStore.mistakes.length === 0) {
    mistakeStore.fetchAll().then(() => { mistakesLoaded.value = true; });
  } else {
    mistakesLoaded.value = true;
  }
});
</script>
