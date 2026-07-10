<template>
  <q-card flat bordered class="q-mb-sm">
    <q-card-section>
      <div class="text-weight-medium">{{ title }}</div>
      <div class="text-caption text-grey q-mt-xs">{{ summary }}</div>
      <div class="q-mt-xs">
        <q-chip v-for="tag in tags" :key="tag" size="xs" color="secondary" text-color="white">{{ tag }}</q-chip>
      </div>
      <div class="text-caption text-grey q-mt-xs">
        <q-icon name="update" size="xs" /> {{ updatedAt }}
        <q-icon v-if="hasAttachment" name="attach_file" size="xs" class="q-ml-sm" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  summary: string;
  tags?: string[];
  updatedAt?: string;
  hasAttachment?: boolean;
}>();
</script>
