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

    <q-tabs v-model="editorTab" class="q-mb-md">
      <q-tab name="edit" label="编辑" />
      <q-tab name="preview" label="预览" />
    </q-tabs>

      <q-tab-panels v-model="editorTab" animated>
        <q-tab-panel name="edit">
          <q-input v-model="content" type="textarea" label="Markdown 详细内容" outlined autogrow :input-style="{ minHeight: '300px', fontFamily: 'monospace' }" />
        </q-tab-panel>
        <q-tab-panel name="preview">
          <div class="markdown-preview markdown-body" v-html="renderedContent" />
        </q-tab-panel>
      </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { uid } from 'quasar';
import { useNoteStore } from '@/stores/noteStore';
import { renderMarkdown } from '@/utils/markdown';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const noteStore = useNoteStore();

const title = ref('');
const subject = ref<string | null>(null);
const volume = ref('');
const chapter = ref('');
const section = ref('');
const summary = ref('');
const content = ref('');
const editorTab = ref('edit');
const saving = ref(false);

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];

const isNew = route.query.new === 'true';
const noteId = isNew ? null : (route.params.id as string);

const renderedContent = computed(() => {
  return content.value ? renderMarkdown(content.value) : '';
});

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
</script>
