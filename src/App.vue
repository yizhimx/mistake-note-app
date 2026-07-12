<template>
  <router-view />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted } from 'vue';
import { initSupabaseFromStorage, restoreSession } from '@/services/supabase';
import { startSync } from '@/services/syncService';
import { getDb } from '@/services/db';

const $q = useQuasar();

onMounted(async () => {
  const saved = $q.localStorage.getItem('darkMode');
  if (saved !== null) {
    $q.dark.set(saved as boolean);
  }

  initSupabaseFromStorage();
  restoreSession(); // fire-and-forget: session not needed for startup
  startSync();

  // Pre-warm database worker (parallel with above)
  getDb();
});
</script>
