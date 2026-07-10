<template>
  <q-card flat bordered class="q-mb-sm" :class="{ 'cursor-pointer': clickable }" @click="onClick">
    <q-card-section horizontal>
      <q-img v-if="coverUrl" :src="coverUrl" style="width: 100px; min-height: 100px" class="rounded-borders-left" />
      <q-card-section class="q-pt-xs col">
        <div class="text-weight-medium">{{ title }}</div>
        <div class="text-caption text-grey q-mt-xs">
          <span v-for="tag in tags" :key="tag" class="q-mr-xs">
            <q-chip size="xs" color="primary" text-color="white">{{ tag }}</q-chip>
          </span>
        </div>
        <div class="text-caption text-grey">{{ subject || '未分类' }} · {{ createdAt }}</div>
      </q-card-section>
      <q-card-section class="row items-center q-gutter-x-xs">
        <q-btn flat color="primary" icon="lightbulb" label="AI 解析" size="sm" no-caps @click.stop="$emit('ai')" />
        <q-btn flat round icon="more_vert" size="sm" @click.stop>
          <q-menu auto-close>
            <q-list dense>
              <q-item clickable @click="$emit('edit')">
                <q-item-section>编辑标签</q-item-section>
              </q-item>
              <q-item clickable @click="$emit('delete')">
                <q-item-section class="text-negative">删除</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-card-section>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  coverUrl?: string;
  tags?: string[];
  subject?: string;
  createdAt?: string;
  hasLink?: boolean;
  clickable?: boolean;
}>();

const emit = defineEmits<{
  click: [];
  edit: [];
  delete: [];
  ai: [];
}>();

function onClick() {
  if (props.clickable) emit('click');
}
</script>
