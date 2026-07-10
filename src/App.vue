<template>
  <router-view />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted } from 'vue';

const $q = useQuasar();

onMounted(() => {
  const saved = $q.localStorage.getItem('darkMode');
  if (saved !== null) {
    $q.dark.set(saved as boolean);
  }
});
</script>
