<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" />
      <q-space />
      <q-btn color="primary" label="保存" unelevated />
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
        <div class="markdown-preview">{{ content }}</div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const title = ref('');
const content = ref('');
const editorTab = ref('edit');

const isNew = route.query.new === 'true';
if (!isNew) {
  // TODO: load note from store/db
  title.value = '笔记标题';
  content.value = '# 笔记内容';
}
</script>
