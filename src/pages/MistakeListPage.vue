<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none text-weight-medium">错题列表</h5>
      </div>
      <div class="col-auto desktop-only">
        <q-btn color="primary" icon="add" label="添加错题" @click="showAddDialog = true" no-caps unelevated />
      </div>
    </div>

    <div class="row q-mb-md">
      <div class="col-12 col-md-3 q-pr-md">
        <q-select v-model="filters.subject" :options="subjects" label="科目" clearable outlined dense />
      </div>
      <div class="col-12 col-md-3 q-pr-md q-mt-sm q-mt-md-none">
        <q-input v-model="filters.tags" label="标签" outlined dense />
      </div>
      <div class="col-12 col-md-3 q-pr-md q-mt-sm q-mt-md-none">
        <q-input v-model="filters.dateRange" label="时间范围" outlined dense>
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer" />
          </template>
        </q-input>
      </div>
      <div class="col-12 col-md-3 q-mt-sm q-mt-md-none">
        <q-btn label="搜索" color="primary" unelevated class="full-width" @click="loadMistakes" />
      </div>
    </div>

    <q-list bordered separator v-if="mistakes.length > 0">
      <q-item v-for="mistake in mistakes" :key="mistake.id" clickable :to="{ name: 'mistake-detail', params: { id: mistake.id } }">
        <q-item-section avatar>
          <q-img v-if="mistake.coverUrl" :src="mistake.coverUrl" style="width: 60px; height: 60px" class="rounded-borders" />
          <div v-else class="bg-grey-3 rounded-borders" style="width: 60px; height: 60px" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ mistake.title }}</q-item-label>
          <q-item-label caption lines="2">{{ mistake.tags?.join(', ') }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round icon="more_vert">
            <q-menu auto-close>
              <q-list>
                <q-item clickable @click="doAiAnalysis(mistake.id)">
                  <q-item-section>AI 解析</q-item-section>
                </q-item>
                <q-item clickable @click="deleteMistake(mistake.id)">
                  <q-item-section class="text-negative">删除</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-icon name="error_outline" size="64px" />
      <p class="q-mt-sm">暂无错题记录</p>
      <q-btn color="primary" label="添加第一道错题" @click="showAddDialog = true" />
    </div>

    <q-dialog v-model="showAddDialog" maximized persistent>
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">添加错题</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="scroll" style="max-height: 80vh">
          <ImageUploader ref="imageUploaderRef" @change="onImagesChanged" />

          <q-select v-model="form.subject" :options="subjects" label="科目" clearable outlined dense class="q-mb-md" />

          <q-input v-model="form.tagInput" label="标签（回车添加）" outlined dense class="q-mb-md" @keydown.enter.prevent="addTag">
            <template v-slot:append>
              <q-btn flat round dense icon="add" @click="addTag" />
            </template>
          </q-input>
          <div class="q-mb-md">
            <q-chip v-for="(tag, idx) in form.tags" :key="idx" removable @remove="form.tags.splice(idx, 1)" color="primary" text-color="white" size="sm">
              {{ tag }}
            </q-chip>
          </div>

          <q-input v-model="form.notes" label="备注" outlined dense autogrow type="textarea" class="q-mb-md" />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="取消" v-close-popup />
          <q-btn color="primary" label="保存错题" :disable="!canSave" :loading="saving" @click="saveMistake" unelevated />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { uid } from 'quasar';
import { useMistakeStore } from '@/stores/mistakeStore';
import ImageUploader from '@/components/ImageUploader.vue';
import { compressImage } from '@/services/ocrService';

const $q = useQuasar();
const mistakeStore = useMistakeStore();

const showAddDialog = ref(false);
const saving = ref(false);
const imageUploaderRef = ref<InstanceType<typeof ImageUploader>>();
const uploadedImages = ref<File[]>([]);
const savedImageUrls = ref<string[]>([]);

const form = reactive({
  subject: null as string | null,
  tagInput: '',
  tags: [] as string[],
  notes: '',
});

const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];

const filters = reactive({
  subject: null as string | null,
  tags: '',
  dateRange: '',
});

interface MistakeItem {
  id: string;
  title: string;
  coverUrl: string;
  tags: string[];
  subject: string;
  createdAt: string;
}

const mistakes = ref<MistakeItem[]>([]);

const canSave = computed(() => uploadedImages.value.length > 0 || savedImageUrls.value.length > 0);

function addTag() {
  const t = form.tagInput.trim();
  if (t && !form.tags.includes(t)) {
    form.tags.push(t);
    form.tagInput = '';
  }
}

function onImagesChanged(files: File[]) {
  uploadedImages.value = files;
}

async function saveMistake() {
  if (!canSave.value) return;
  saving.value = true;

  try {
    const imageUrls: string[] = [];

    for (const file of uploadedImages.value) {
      const blob = await compressImage(file);
      const url = URL.createObjectURL(blob);
      imageUrls.push(url);
    }

    const now = new Date().toISOString();
    const id = uid();

    const record = {
      id,
      title: `未命名错题 ${new Date().toLocaleDateString()}`,
      imageUrls,
      tags: [...form.tags],
      subject: form.subject || '',
      notes: form.notes,
      aiAnalysis: null,
      ocrText: null,
      createdAt: now,
      updatedAt: now,
      reviewCount: 0,
      lastReviewAt: null,
      masteryLevel: null as string | null,
      sm2Data: null,
      linkedNoteIds: [],
      synced: false,
    };

    mistakeStore.addMistake(record as any);
    mistakes.value.unshift({
      id,
      title: record.title,
      coverUrl: imageUrls[0] || '',
      tags: record.tags,
      subject: record.subject,
      createdAt: new Date().toLocaleDateString(),
    });

    showAddDialog.value = false;
    resetForm();

    $q.notify({ type: 'positive', message: '错题已保存', timeout: 2000 });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: `保存失败：${e.message}`, timeout: 3000 });
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.subject = null;
  form.tagInput = '';
  form.tags = [];
  form.notes = '';
  uploadedImages.value = [];
  savedImageUrls.value = [];
}

function loadMistakes() {
  mistakes.value = mistakeStore.mistakes.map((m) => ({
    id: m.id,
    title: m.title,
    coverUrl: m.imageUrls[0] || '',
    tags: m.tags,
    subject: m.subject,
    createdAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '',
  }));
}

function deleteMistake(id: string) {
  $q.dialog({
    title: '确认删除',
    message: '确定要删除这道错题吗？',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    mistakeStore.removeMistake(id);
    loadMistakes();
    $q.notify({ type: 'positive', message: '已删除', timeout: 1500 });
  });
}

function doAiAnalysis(id: string) {
  $q.notify({ type: 'info', message: 'AI 解析功能将在后续版本实现', timeout: 2000 });
}

onMounted(() => {
  loadMistakes();
});
</script>
