<template>
  <div>
    <div
      class="drop-zone row flex-center q-pa-lg q-mb-md"
      @dragenter.prevent="dragOver = true"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
      :class="{ 'drop-zone-active': dragOver }"
    >
      <div class="text-center text-grey">
        <q-icon name="cloud_upload" size="48px" />
        <p class="q-mt-sm">将图片拖拽到此处</p>
        <q-btn label="选择文件" color="primary" outline @click="triggerFileInput" />
        <input ref="fileInput" type="file" multiple accept="image/*" @change="onFileSelect" hidden />
      </div>
    </div>

    <div class="row q-gutter-sm q-mb-sm">
      <div v-for="(img, idx) in images" :key="idx" class="col-3 col-md-2 relative-position">
        <q-img :src="img.url" style="height: 80px" class="rounded-borders" />
        <q-btn
          flat round dense size="sm"
          icon="close"
          class="absolute-top-right bg-white"
          @click="removeImage(idx)"
        />
      </div>
    </div>

    <div class="text-caption text-grey q-mb-md">
      已选 {{ images.length }} 张
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface ImageItem {
  file: File;
  url: string;
}

const images = ref<ImageItem[]>([]);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const emit = defineEmits<{
  change: [files: File[]];
}>();

function triggerFileInput() {
  fileInput.value?.click();
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    addFiles(Array.from(input.files));
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  if (e.dataTransfer?.files) {
    addFiles(Array.from(e.dataTransfer.files));
  }
}

function addFiles(files: File[]) {
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      images.value.push({
        file,
        url: URL.createObjectURL(file),
      });
    }
  }
  emit('change', files);
}

function removeImage(idx: number) {
  URL.revokeObjectURL(images.value[idx].url);
  images.value.splice(idx, 1);
}
</script>

<style lang="scss" scoped>
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  transition: all 0.2s;
  cursor: pointer;
}
.drop-zone-active {
  border-color: var(--q-primary);
  background: rgba(var(--q-primary-rgb), 0.05);
}
</style>
