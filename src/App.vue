<template>
  <router-view />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted } from 'vue';
// [CLOUD DISABLED] import { initSupabaseFromStorage, restoreSession } from '@/services/supabase';
// [CLOUD DISABLED] import { startSync } from '@/services/syncService';
import { getDb } from '@/services/db';
import { initMobileFs } from '@/services/mobileFs';
// [CLOUD DISABLED] import { initCloudStoreFromStorage } from '@/services/cloudStore';
import { initAiConfigCache } from '@/services/aiConfig';

const $q = useQuasar();

onMounted(async () => {
  const saved = $q.localStorage.getItem('darkMode');
  if (saved !== null) {
    $q.dark.set(saved as boolean);
  }

  initMobileFs(); // Initialize Capacitor Filesystem (no-op on non-mobile)
  await initAiConfigCache(); // Populate in-memory decrypted AI API key cache
  // [CLOUD DISABLED] initCloudStoreFromStorage();
  // [CLOUD DISABLED] initSupabaseFromStorage();
  // [CLOUD DISABLED] restoreSession(); // fire-and-forget: session not needed for startup
  // [CLOUD DISABLED] startSync();

  // Pre-warm database worker (parallel with above)
  getDb();
});
</script>
