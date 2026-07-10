<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">笔记列表</h5>
      </div>
      <div class="col-auto desktop-only">
        <q-btn color="primary" icon="add" label="新增笔记" @click="addNote" no-caps unelevated />
      </div>
    </div>

    <q-input v-model="search" label="搜索笔记..." outlined dense class="q-mb-md">
      <template v-slot:append>
        <q-icon name="search" />
      </template>
    </q-input>

    <q-list bordered separator v-if="notes.length > 0">
      <q-item v-for="note in notes" :key="note.id" clickable :to="{ name: 'note-detail', params: { id: note.id } }">
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ note.title }}</q-item-label>
          <q-item-label caption lines="2">{{ note.summary }}</q-item-label>
          <div class="q-mt-xs">
            <q-chip v-for="tag in note.tags" :key="tag" size="xs" color="secondary" text-color="white">{{ tag }}</q-chip>
          </div>
        </q-item-section>
        <q-item-section side top>
          <div class="text-caption text-grey">{{ note.updatedAt }}</div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-icon name="note_alt" size="64px" />
      <p class="q-mt-sm">暂无笔记</p>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const search = ref('');

interface Note {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  updatedAt: string;
}

const notes = ref<Note[]>([]);

function addNote() {
  router.push({ name: 'note-detail', query: { new: 'true' } });
}
</script>
