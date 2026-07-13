<template>
  <q-dialog :model-value="modelValue" @update:model-value="onClose" maximized persistent>
    <q-card class="column no-wrap" style="height:100vh">
      <q-card-section class="row items-center q-py-sm q-px-md" style="flex-shrink:0">
        <q-btn flat round dense icon="close" @click="onClose(false)" />
        <div class="text-weight-medium q-ml-sm">批量导入错题</div>
        <q-space />
        <q-btn flat dense icon="camera_alt" label="拍照" @click="addPhoto" class="q-ml-sm" />
        <q-btn flat dense icon="photo_library" label="相册" @click="addFromGallery" class="q-ml-sm" />
        <q-btn flat dense icon="content_paste" label="粘贴图片" @click="pasteFromClipboard" />
        <q-btn flat dense icon="upload_file" label="选择文件" @click="pickFiles" class="q-ml-sm" />
        <q-btn flat dense color="primary" :disable="images.length === 0" label="全部加入识别队列" @click="confirm" class="q-ml-sm" />
      </q-card-section>
      <q-separator />
      <q-card-section class="col overflow-auto flex flex-center bg-grey-3" style="min-height:0" @paste.prevent="onPaste">
        <div v-if="images.length === 0" class="column flex-center text-grey-6">
          <q-icon name="image" size="64px" />
          <div class="text-h6 q-mt-md q-mb-sm">粘贴或选择图片</div>
          <div class="text-caption q-mb-md">Ctrl+V 粘贴剪贴板图片，或点击上方「选择文件」</div>
          <q-btn outline color="grey-6" icon="content_paste" label="从剪贴板粘贴" @click="pasteFromClipboard" />
          <q-btn outline color="grey-6" icon="upload_file" label="选择图片文件" @click="pickFiles" class="q-mt-sm" />
        </div>
        <div v-else class="row q-gutter-md q-pa-md full-width">
          <div
            v-for="(img, i) in images"
            :key="i"
            class="relative-position"
            style="width:160px;height:160px"
          >
            <img
              :src="img.dataUrl"
              style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid #ddd;cursor:pointer"
              @click="previewIndex = i; showPreview = true"
            />
            <q-btn
              flat round dense icon="close" color="negative" size="sm"
              style="position:absolute;top:-8px;right:-8px;background:white;z-index:1"
              @click="images.splice(i, 1)"
            />
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="row items-center q-py-sm q-px-md bg-grey-1" style="flex-shrink:0">
        <span class="text-caption text-grey-7" :key="images.length">
          {{ images.length > 0 ? `已选 ${images.length} 张图片` : '暂无图片' }}
        </span>
        <q-space />
        <q-btn
          no-caps unelevated color="primary"
          :disable="images.length === 0" label="全部加入识别队列"
          @click="confirm"
        />
      </q-card-section>
    </q-card>
  </q-dialog>

  <ImagePreviewDialog v-model="showPreview" :images="previewUrls" :initial-index="previewIndex" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ImagePreviewDialog from '@/components/ImagePreviewDialog.vue';
import { useQuasar } from 'quasar';
import { compressToDataUrl } from '@/services/ocrService';
import { useQueueStore } from '@/stores/queueStore';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; imported: [count: number] }>();

const $q = useQuasar();
const queueStore = useQueueStore();

const images = ref<{ dataUrl: string }[]>([]);
const showPreview = ref(false);
const previewIndex = ref(0);
const previewUrls = computed(() => images.value.map(img => img.dataUrl));

function onClose(v: boolean) {
  if (!v) {
    images.value = [];
    emit('update:modelValue', false);
  }
}

async function addFiles(files: File[]) {
  const tasks = files
    .filter(f => f.type.startsWith('image/'))
    .map(async (file) => {
      try {
        const dataUrl = await compressToDataUrl(file);
        images.value.push({ dataUrl });
      } catch {
        $q.notify({ type: 'negative', message: `图片处理失败：${file.name}`, timeout: 2000 });
      }
    });
  await Promise.all(tasks);
}

async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    let count = 0;
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const file = new File([blob], `clipboard-${Date.now()}.jpg`, { type });
          await addFiles([file]);
          count++;
        }
      }
    }
    if (count === 0) {
      $q.notify({ type: 'warning', message: '剪贴板中没有图片', timeout: 2000 });
    }
  } catch {
    $q.notify({ type: 'warning', message: '无法读取剪贴板，请确认已复制图片', timeout: 2500 });
  }
}

async function addPhoto() {
  try {
    const { takePhoto } = await import('@/utils/camera');
    const result = await takePhoto();
    if (result) {
      images.value.push({ dataUrl: result.dataUrl });
    }
  } catch {
    $q.notify({ type: 'negative', message: '拍照失败', timeout: 1500 });
  }
}

async function addFromGallery() {
  try {
    const { pickFromGallery } = await import('@/utils/camera');
    const result = await pickFromGallery();
    if (result) {
      images.value.push({ dataUrl: result.dataUrl });
    }
  } catch {
    $q.notify({ type: 'negative', message: '选取图片失败', timeout: 1500 });
  }
}

function onPaste(e: ClipboardEvent) {
  const cd = e.clipboardData;
  if (!cd) return;
  const files: File[] = [];
  for (let i = 0; i < cd.items.length; i++) {
    const item = cd.items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) addFiles(files);
}

function pickFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => {
    if (input.files) addFiles(Array.from(input.files));
  };
  input.click();
}

async function confirm() {
  if (images.value.length === 0) return;
  const count = images.value.length;
  for (const img of images.value) {
    await queueStore.addToQueue(img.dataUrl);
  }
  $q.notify({ type: 'positive', message: `已将 ${count} 张图片加入识别队列`, timeout: 2000 });
  images.value = [];
  emit('imported', count);
  emit('update:modelValue', false);
}
</script>
