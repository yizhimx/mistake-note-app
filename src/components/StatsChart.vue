<template>
  <div>
    <div ref="chartRef" style="width: 100%; height: 300px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const chartRef = ref<HTMLDivElement | null>(null);

const props = withDefaults(defineProps<{
  type: 'line' | 'pie' | 'ring' | 'bar';
  data: any;
  title?: string;
}>(), {
  title: '',
});

let chart: any = null;

async function initChart() {
  if (!chartRef.value) return;
  const echarts = await import('echarts');
  chart = echarts.init(chartRef.value);
  renderChart();
}

function renderChart() {
  if (!chart) return;
  const isDark = $q.dark.isActive;
  const textColor = isDark ? '#eee' : '#333';

  const baseOption = {
    title: { text: props.title, textStyle: { color: textColor }, left: 'center' },
    tooltip: { trigger: 'axis' as const },
    backgroundColor: 'transparent',
    textStyle: { color: textColor },
  };

  switch (props.type) {
    case 'line':
      chart.setOption({
        ...baseOption,
        xAxis: { type: 'category', data: props.data.labels, axisLabel: { color: textColor } },
        yAxis: { type: 'value', axisLabel: { color: textColor } },
        series: [{ type: 'line', data: props.data.values, smooth: true, lineStyle: { color: '#1976D2' }, itemStyle: { color: '#1976D2' } }],
      });
      break;
    case 'pie':
      chart.setOption({
        ...baseOption,
        series: [{ type: 'pie', data: props.data, radius: '50%', label: { color: textColor } }],
      });
      break;
    case 'ring':
      chart.setOption({
        ...baseOption,
        series: [{
          type: 'pie',
          data: props.data,
          radius: ['40%', '60%'],
          label: { color: textColor, formatter: '{b}\n{d}%' },
        }],
      });
      break;
    case 'bar':
      chart.setOption({
        ...baseOption,
        xAxis: { type: 'category', data: props.data.labels, axisLabel: { color: textColor } },
        yAxis: { type: 'value', axisLabel: { color: textColor } },
        series: [{ type: 'bar', data: props.data.values, itemStyle: { color: '#1976D2' } }],
      });
      break;
  }
}

watch(() => $q.dark.isActive, () => {
  renderChart();
});

watch(() => props.data, () => {
  renderChart();
}, { deep: true });

onMounted(initChart);
onUnmounted(() => {
  chart?.dispose();
});
</script>
