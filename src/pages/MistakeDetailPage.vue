<template>
  <q-page class="q-pa-md">
    <q-btn flat icon="arrow_back" label="返回" @click="$router.back()" class="q-mb-md" />

    <div v-if="mistake" class="row">
      <div class="col-12 col-md-7">
        <q-carousel v-model="slide" animated arrows navigation infinite class="rounded-borders" style="max-height: 400px">
          <q-carousel-slide v-for="(url, idx) in mistake.imageUrls" :key="idx" :name="idx" :img-src="url" />
        </q-carousel>

        <div class="q-mt-md text-caption text-grey">
          共 {{ mistake.imageUrls.length }} 张图片
        </div>
      </div>

      <div class="col-12 col-md-5 q-pl-md">
        <div class="text-h5">{{ mistake.title }}</div>
        <div class="q-mt-sm">
          <q-chip v-for="tag in mistake.tags" :key="tag" size="sm" color="primary" text-color="white">{{ tag }}</q-chip>
        </div>
        <div class="q-mt-sm text-grey">科目：{{ mistake.subject || '未分类' }}</div>
        <div class="text-grey">创建时间：{{ mistake.createdAt }}</div>

        <q-separator class="q-my-md" />

        <q-btn color="primary" icon="lightbulb" label="开始 AI 解析" unelevated class="full-width q-mb-sm" />
        <q-btn flat color="primary" icon="link" label="关联笔记" class="full-width" />
      </div>
    </div>

    <div v-else class="text-center q-mt-xl text-grey">
      <q-spinner size="40px" />
      <p class="q-mt-sm">加载中...</p>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const slide = ref(0);

interface MistakeDetail {
  id: string;
  title: string;
  imageUrls: string[];
  tags: string[];
  subject: string;
  createdAt: string;
}

const mistake = ref<MistakeDetail | null>(null);

onMounted(() => {
  const id = route.params.id as string;
  // TODO: load from store/db
  mistake.value = {
    id,
    title: '未命名错题',
    imageUrls: [],
    tags: ['待解析'],
    subject: '数学',
    createdAt: new Date().toLocaleDateString(),
  };
});
</script>
