<template>
  <q-layout view="hHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title class="text-weight-medium">
          错题助手
        </q-toolbar-title>

        <q-btn flat round dense :icon="isDark ? 'dark_mode' : 'light_mode'" @click="toggleDarkMode">
          <q-tooltip>{{ isDark ? '切换亮色模式' : '切换暗色模式' }}</q-tooltip>
        </q-btn>

        <q-btn flat round dense :icon="syncIcon" :color="syncColor" @click="handleSyncClick">
          <q-tooltip>{{ syncTooltip }}</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered :breakpoint="768">
      <q-scroll-area class="fit">
        <q-list padding>
          <q-item-label header class="text-weight-bold text-grey-8">
            导航菜单
          </q-item-label>

          <q-item
            v-for="link in navLinks"
            :key="link.label"
            clickable
            v-ripple
            :to="link.to"
            :active="isActive(link.to)"
            active-class="bg-primary text-white"
          >
            <q-item-section avatar>
              <q-icon :name="link.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ link.label }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="q-my-md" />

          <q-item clickable v-ripple :to="{ name: 'settings' }" :active="isActive({ name: 'settings' })" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="settings" />
            </q-item-section>
            <q-item-section>
              <q-item-label>设置</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer class="mobile-only bg-white">
      <q-tabs
        v-model="currentTab"
        active-color="primary"
        indicator-color="primary"
        class="shadow-2"
        @update:model-value="onTabChange"
      >
        <q-tab v-for="tab in bottomTabs" :key="tab.name" :name="tab.name" :icon="tab.icon" :label="tab.label" />
      </q-tabs>
    </q-footer>

    <q-page-sticky position="bottom-right" :offset="[18, 18]" class="mobile-only">
      <q-btn
        fab
        icon="add"
        color="primary"
        @click="showAddActions = !showAddActions"
      >
        <q-menu auto-close>
          <q-list>
            <q-item clickable @click="addMistake">
              <q-item-section avatar>
                <q-icon name="error_outline" color="negative" />
              </q-item-section>
              <q-item-section>添加错题</q-item-section>
            </q-item>
            <q-item clickable @click="addNote">
              <q-item-section avatar>
                <q-icon name="note_add" color="primary" />
              </q-item-section>
              <q-item-section>添加笔记</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-page-sticky>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter, useRoute } from 'vue-router';
import { useQueueStore } from '@/stores/queueStore';
import { useSyncStore } from '@/stores/syncStore';
import { triggerSync } from '@/services/syncService';
import { getSupabaseClient } from '@/services/supabase';

const $q = useQuasar();
const router = useRouter();
const route = useRoute();

const leftDrawerOpen = ref(false);
const currentTab = ref('mistake-list');
const showAddActions = ref(false);
const syncStore = useSyncStore();

const isDark = computed(() => $q.dark.isActive);

function toggleDarkMode() {
  $q.dark.toggle();
  $q.localStorage.set('darkMode', $q.dark.isActive);
}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

const syncIcon = computed(() => {
  if (!syncStore.isOnline) return 'cloud_off';
  if (syncStore.syncState === 'syncing') return 'sync';
  if (syncStore.syncState === 'error') return 'sync_problem';
  if (syncStore.lastSyncAt) return 'cloud_done';
  return 'cloud_queue';
});

const syncColor = computed(() => {
  if (!syncStore.isOnline) return 'grey';
  if (syncStore.syncState === 'syncing') return 'amber';
  if (syncStore.syncState === 'error') return 'negative';
  return 'positive';
});

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

const syncTooltip = computed(() => {
  const parts: string[] = [];
  if (syncStore.userEmail) parts.push(syncStore.userEmail);
  if (!syncStore.isOnline) {
    parts.push('离线');
  } else if (syncStore.syncState === 'syncing') {
    parts.push('同步中...');
  } else if (syncStore.syncState === 'error') {
    parts.push('同步失败');
    if (syncStore.lastError) parts.push(syncStore.lastError);
  } else if (syncStore.lastSyncAt) {
    parts.push(`上次同步：${formatRelativeTime(syncStore.lastSyncAt)}`);
  } else {
    parts.push('尚未同步');
  }
  return parts.join(' · ');
});

function handleSyncClick() {
  if (syncStore.syncState === 'syncing') return;
  if (!syncStore.isOnline) return;
  if (!getSupabaseClient()) { router.push({ name: 'settings' }); return; }
  triggerSync();
}

onMounted(() => {
  const queue = useQueueStore();
  queue.startPolling();
});

const navLinks = [
  { label: '错题列表', icon: 'error_outline', to: { name: 'mistake-list' } },
  { label: '错题回顾', icon: 'autorenew', to: { name: 'review' } },
  { label: '识别队列', icon: 'queue', to: { name: 'queue-list' } },
  { label: '笔记列表', icon: 'note_alt', to: { name: 'note-list' } },
  { label: '日历统计', icon: 'calendar_month', to: { name: 'calendar' } },
];

const bottomTabs = [
  { name: 'mistake-list', label: '错题', icon: 'error_outline' },
  { name: 'review', label: '回顾', icon: 'autorenew' },
  { name: 'note-list', label: '笔记', icon: 'note_alt' },
  { name: 'calendar', label: '统计', icon: 'calendar_month' },
  { name: 'settings', label: '设置', icon: 'settings' },
];

function isActive(target: { name: string }) {
  return route.name === target.name;
}

function onTabChange(name: string) {
  router.push({ name });
}

function addMistake() {
  router.push({ name: 'mistake-list', query: { add: 'true' } });
}

function addNote() {
  router.push({ name: 'note-detail', query: { new: 'true' } });
}
</script>

<style lang="scss">
.desktop-only {
  display: none;
}
.mobile-only {
  display: flex;
}

@media (min-width: 768px) {
  .desktop-only {
    display: flex;
  }
  .mobile-only {
    display: none;
  }
}
</style>
