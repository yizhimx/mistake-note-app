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

const $q = useQuasar();
const router = useRouter();
const route = useRoute();

const leftDrawerOpen = ref(false);
const currentTab = ref('mistake-list');
const showAddActions = ref(false);

const isDark = computed(() => $q.dark.isActive);

function toggleDarkMode() {
  $q.dark.toggle();
  $q.localStorage.set('darkMode', $q.dark.isActive);
}

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
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
