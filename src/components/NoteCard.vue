<template>
  <q-card flat bordered class="q-mb-sm cursor-pointer" @click="$emit('click')">
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
    <q-card-actions align="right">
      <q-btn flat round icon="more_vert" size="sm" @click.stop>
        <q-menu auto-close>
          <q-list dense>
            <q-item clickable @click="$emit('edit')">
              <q-item-section>编辑</q-item-section>
            </q-item>
            <q-item clickable @click="$emit('delete')">
              <q-item-section class="text-negative">删除</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-card-actions>
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

defineEmits<{
  click: [];
  edit: [];
  delete: [];
}>();
</script>
