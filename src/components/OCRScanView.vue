<template>
  <div>
    <div class="row q-gutter-sm q-mb-md">
      <q-btn icon="camera_alt" label="拍照" color="primary" outline @click="capturePhoto" />
      <q-btn icon="photo_library" label="从相册选择" color="primary" outline @click="selectFromGallery" />
    </div>

    <div v-if="imageUrl" class="q-mb-md">
      <q-img :src="imageUrl" style="max-height: 300px" class="rounded-borders" />
    </div>

    <div v-if="scanning" class="q-mb-md">
      <q-linear-progress indeterminate color="primary" class="q-mb-sm" />
      <div class="text-caption text-grey">正在扫描识别...</div>
    </div>

    <div v-if="recognizedText">
      <div class="text-weight-medium q-mb-xs">识别结果：</div>
      <q-input v-model="recognizedText" type="textarea" outlined autogrow />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const imageUrl = ref('');
const scanning = ref(false);
const recognizedText = ref('');

const emit = defineEmits<{
  scanComplete: [text: string];
}>();

async function capturePhoto() {
  // TODO: implement @capacitor/camera
  scanning.value = true;
  await new Promise((r) => setTimeout(r, 1000));
  scanning.value = false;
}

async function selectFromGallery() {
  // TODO: implement file selection
  scanning.value = true;
  await new Promise((r) => setTimeout(r, 1000));
  scanning.value = false;
}
</script>
