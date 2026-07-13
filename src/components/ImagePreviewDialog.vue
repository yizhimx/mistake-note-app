<template>
  <q-dialog v-model="visible" fullscreen transition-show="fade" transition-hide="fade">
    <q-card class="bg-black column full-height" style="background: rgba(0,0,0,0.92)">
      <!-- 顶部工具栏 -->
      <div class="row items-center q-pa-sm" style="z-index:10">
        <q-btn flat round dense icon="close" color="white" @click="close" />
        <q-space />
        <div class="text-white text-caption">{{ currentIndex + 1 }} / {{ images.length }}</div>
      </div>

      <!-- 图片轮播 -->
      <q-carousel
        v-model="currentIndex"
        :navigation="false"
        :arrows="images.length > 1"
        animated
        swipeable
        transition-prev="fade"
        transition-next="fade"
        class="col-grow bg-black"
        control-color="white"
        control-type="flat"
        control-text-color="white"
      >
        <q-carousel-slide
          v-for="(img, idx) in images"
          :key="idx"
          :name="idx"
          class="flex flex-center"
        >
          <q-img
            :src="img"
            :ratio="16/9"
            fit="contain"
            class="full-width full-height"
            style="max-width: 100vw; max-height: 90vh"
          />
        </q-carousel-slide>
      </q-carousel>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  images: string[];
  initialIndex?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const visible = ref(false);
const currentIndex = ref(0);

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val && props.initialIndex !== undefined) {
    currentIndex.value = props.initialIndex;
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

function close() {
  visible.value = false;
}
</script>
