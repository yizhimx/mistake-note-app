<template>
  <q-card flat bordered class="q-mt-md">
    <q-card-section class="bg-primary text-white">
      <div class="row items-center">
        <q-icon name="lightbulb" size="24px" class="q-mr-sm" />
        <span class="text-weight-medium">AI 解析结果</span>
        <q-space />
        <q-btn flat round dense icon="unfold_less" @click="expanded = !expanded" />
      </div>
    </q-card-section>

    <q-slide-transition>
      <div v-show="expanded">
        <q-card-section>
          <div class="text-weight-medium text-positive">正确答案</div>
          <div class="q-mt-xs">{{ analysis.correctAnswer }}</div>
          <q-btn flat round dense icon="content_copy" size="sm" class="absolute-top-right" @click="copyText(analysis.correctAnswer)" />
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-weight-medium">解题步骤</div>
          <ol class="q-mt-xs q-mb-none">
            <li v-for="(step, idx) in analysis.steps" :key="idx">{{ step }}</li>
          </ol>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-weight-medium">知识点背景</div>
          <div class="q-mt-xs">
            <q-chip v-for="kp in analysis.knowledgePoints" :key="kp" size="sm" color="secondary" text-color="white">{{ kp }}</q-chip>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-weight-medium text-warning">
            <q-icon name="warning" size="sm" /> 常见错误
          </div>
          <ul class="q-mt-xs q-mb-none">
            <li v-for="(err, idx) in analysis.commonMistakes" :key="idx">{{ err }}</li>
          </ul>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-weight-medium">难度评级</div>
          <div class="q-mt-xs">
            <q-rating v-model="difficulty" :max="5" size="sm" color="orange" readonly />
            <span class="q-ml-sm text-caption">{{ difficultyLabel }}</span>
          </div>
        </q-card-section>
      </div>
    </q-slide-transition>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

const props = defineProps<{
  analysis: {
    correctAnswer: string;
    steps: string[];
    knowledgePoints: string[];
    commonMistakes: string[];
    difficulty: number;
  };
}>();

const expanded = ref(true);
const difficulty = ref(props.analysis.difficulty);

const difficultyLabel = computed(() => {
  const labels = ['非常简单', '简单', '中等', '困难', '非常困难'];
  return labels[Math.min(difficulty.value - 1, 4)];
});

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  $q.notify({ type: 'positive', message: '已复制到剪贴板', timeout: 1500 });
}
</script>
