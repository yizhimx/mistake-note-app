<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" />
      <q-space />
      <q-btn color="primary" label="保存" unelevated :loading="saving" @click="saveNote" />
    </div>

    <q-input v-model="title" label="笔记标题" outlined class="q-mb-md" />

    <q-tabs v-model="editorTab" class="q-mb-md">
      <q-tab name="edit" label="编辑" />
      <q-tab name="preview" label="预览" />
    </q-tabs>

    <q-tab-panels v-model="editorTab" animated>
      <q-tab-panel name="edit">
        <q-input v-model="content" type="textarea" label="Markdown 内容" outlined autogrow :input-style="{ minHeight: '300px', fontFamily: 'monospace' }" />
      </q-tab-panel>
      <q-tab-panel name="preview">
        <div class="markdown-preview" v-html="renderedContent"></div>
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

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const noteStore = useNoteStore();

const title = ref('');
const content = ref('');
const editorTab = ref('edit');
const saving = ref(false);

const isNew = route.query.new === 'true';
const noteId = isNew ? null : (route.params.id as string);

const renderedContent = computed(() => {
  return content.value.replace(/\n/g, '<br>');
});

async function saveNote() {
  if (!title.value.trim()) {
    $q.notify({ type: 'warning', message: '请输入笔记标题', timeout: 2000 });
    return;
  }
  saving.value = true;
  try {
    const now = new Date().toISOString();
    if (isNew) {
      await noteStore.addNote({
        id: uid(),
        title: title.value,
        content: content.value,
        plainText: content.value.replace(/[#*`\n]/g, ' '),
        tags: [],
        imageUrls: [],
        linkedMistakeIds: [],
        createdAt: now,
        updatedAt: now,
        synced: false,
      });
    } else if (noteId) {
      await noteStore.updateNote(noteId, {
        title: title.value,
        content: content.value,
        plainText: content.value.replace(/[#*`\n]/g, ' '),
      });
    }
    $q.notify({ type: 'positive', message: '笔记已保存', timeout: 2000 });
    router.back();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e.message}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}

if (!isNew && noteId) {
  noteStore.fetchOne(noteId).then((note) => {
    if (note) {
      title.value = note.title;
      content.value = note.content;
    }
  });
}
</script>
