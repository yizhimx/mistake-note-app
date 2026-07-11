<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">笔记</h5>
      </div>
      <div class="col-auto">
        <q-btn color="secondary" icon="auto_awesome" label="批量导入" @click="showBatchImport = true" no-caps unelevated class="q-mr-sm" />
        <q-btn color="primary" icon="add" label="新增笔记" @click="addNote" no-caps unelevated />
      </div>
    </div>

    <q-input v-model="search" label="搜索笔记..." outlined dense class="q-mb-md">
      <template v-slot:append>
        <q-icon name="search" />
      </template>
    </q-input>

    <q-list bordered separator v-if="flatNodes.length > 0">
      <q-item
        v-for="item in flatNodes"
        :key="item.id"
        clickable
        :style="{ paddingLeft: `${item.depth * 24 + 16}px` }"
        :class="{ 'bg-grey-2': item.noteId && isSelected === item.noteId }"
      >
        <q-item-section side v-if="item.children">
          <q-btn
            flat dense round
            :icon="isExpanded(item.id) ? 'expand_more' : 'chevron_right'"
            size="sm"
            @click="toggleExpand(item.id)"
          />
        </q-item-section>
        <q-item-section avatar>
          <q-icon :name="item.icon" :color="item.iconColor || 'grey'" size="20px" />
        </q-item-section>
        <q-item-section @click="handleClick(item)">
          <q-item-label :class="{ 'text-weight-medium': item.isFolder }">
            {{ item.label }}
            <q-badge v-if="item.tipCount > 0" color="orange" floating transparent>{{ item.tipCount }}</q-badge>
          </q-item-label>
          <q-item-label v-if="item.tipPreview" caption class="text-orange">
            💡 {{ item.tipPreview }}
          </q-item-label>
        </q-item-section>
        <q-item-section v-if="item.noteId" side>
          <q-btn flat round dense icon="more_vert" size="sm" @click.stop>
            <q-menu auto-close>
              <q-list dense>
                <q-item clickable @click="deleteNote(item.noteId!)">
                  <q-item-section class="text-negative">删除</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-icon name="note_alt" size="64px" />
      <p class="q-mt-sm">{{ search ? '没有匹配的笔记' : '暂无笔记' }}</p>
    </div>

    <BatchImportDialog v-model="showBatchImport" @imported="onImported" />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useNoteStore, type NoteRecord } from '@/stores/noteStore';
import BatchImportDialog from '@/components/BatchImportDialog.vue';

const $q = useQuasar();
const router = useRouter();
const noteStore = useNoteStore();

const search = ref('');
const expanded = ref(new Set<string>());
const showBatchImport = ref(false);

interface TreeNode {
  id: string;
  label: string;
  icon: string;
  iconColor?: string;
  isFolder: boolean;
  noteId?: string;
  children?: TreeNode[];
  tipCount?: number;
  tipPreview?: string;
}

interface FlatNode {
  id: string;
  label: string;
  icon: string;
  iconColor?: string;
  isFolder: boolean;
  noteId?: string;
  children?: TreeNode[];
  depth: number;
  tipCount: number;
  tipPreview: string;
}

function addNote() {
  router.push({ name: 'note-detail', params: { id: '_new' }, query: { new: 'true' } });
}

function onImported(count: number) {
  showBatchImport.value = false;
}

async function deleteNote(id: string) {
  $q.dialog({
    title: '确认删除',
    message: '确定要删除这条笔记吗？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await noteStore.removeNote(id);
    $q.notify({ type: 'positive', message: '已删除', timeout: 1500 });
  });
}

function insertTree(nodes: TreeNode[], parts: string[], depth: number, note: NoteRecord) {
  if (depth >= parts.length) return;
  const label = parts[depth];

  if (depth === parts.length - 1) {
    const existing = nodes.find(n => n.isFolder && n.label === label && n.children);
    if (existing) {
      existing.children!.push({
        id: 'note_' + note.id,
        label: note.title,
        icon: getNoteIcon(note),
        iconColor: note.tips?.length > 0 ? 'orange' : undefined,
        isFolder: false,
        noteId: note.id,
        tipCount: note.tips?.length || 0,
        tipPreview: note.tips?.[0] || '',
      });
    } else {
      nodes.push({
        id: 'note_' + note.id,
        label: note.title,
        icon: getNoteIcon(note),
        iconColor: note.tips?.length > 0 ? 'orange' : undefined,
        isFolder: false,
        noteId: note.id,
        tipCount: note.tips?.length || 0,
        tipPreview: note.tips?.[0] || '',
      });
    }
    return;
  }

  let node = nodes.find(n => n.isFolder && n.label === label);
  if (!node) {
    node = {
      id: 'folder_' + parts.slice(0, depth + 1).join('/'),
      label,
      icon: 'folder',
      isFolder: true,
      children: [],
    };
    nodes.push(node);
  }
  insertTree(node.children!, parts, depth + 1, note);
}

function getNoteIcon(note: NoteRecord): string {
  if (note.tips?.length > 0 && !note.content) return 'tips_and_updates';
  if (note.isFolder) return note.tips?.length > 0 ? 'tips_and_updates' : 'folder_special';
  return 'article';
}

const filteredNotes = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return noteStore.notes;
  return noteStore.notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.summary.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q) ||
    n.tips.some(t => t.toLowerCase().includes(q)) ||
    n.knowledgePoints.some(k => k.toLowerCase().includes(q))
  );
});

const treeNodes = computed(() => {
  const roots: TreeNode[] = [];
  for (const note of filteredNotes.value) {
    const parts: string[] = [note.subject || '未分类'];
    if (note.volume) parts.push(note.volume);
    if (note.chapter) parts.push(note.chapter);
    if (note.section) parts.push(note.section);
    insertTree(roots, parts, 0, note);
  }
  sortTree(roots);
  return roots;
});

function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => a.label.localeCompare(b.label));
  for (const n of nodes) {
    if (n.children) sortTree(n.children);
  }
}

const isSelected = ref<string | null>(null);

function isExpanded(id: string): boolean {
  return expanded.value.has(id);
}

function toggleExpand(id: string) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id);
  } else {
    expanded.value.add(id);
  }
  expanded.value = new Set(expanded.value);
}

const flatNodes = computed(() => {
  const result: FlatNode[] = [];
  function walk(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      const tipCount = node.children
        ? node.children.reduce((s, c) => s + (c.tipCount || 0), 0)
        : (node.tipCount || 0);
      const tipPreview = node.tipPreview || (node.children && node.children.length > 0 ? node.children[0].tipPreview || '' : '');
      result.push({
        id: node.id,
        label: node.label,
        icon: node.icon,
        iconColor: node.iconColor,
        isFolder: node.isFolder,
        noteId: node.noteId,
        children: node.children,
        depth,
        tipCount,
        tipPreview,
      });
      if (node.children && isExpanded(node.id)) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(treeNodes.value, 0);
  return result;
});

function handleClick(item: FlatNode) {
  if (item.noteId) {
    isSelected.value = item.noteId;
    router.push({ name: 'note-detail', params: { id: item.noteId } });
  } else {
    toggleExpand(item.id);
  }
}

onMounted(async () => {
  await noteStore.fetchAll();
  // Auto-expand all top-level folders
  for (const node of treeNodes.value) {
    expanded.value.add(node.id);
  }
});
</script>
