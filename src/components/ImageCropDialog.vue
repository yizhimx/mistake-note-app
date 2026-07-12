<template>
  <q-dialog :model-value="modelValue" maximized persistent @update:model-value="onDialogClose">
    <q-card class="column no-wrap" style="height:100vh">
      <q-card-section class="row items-center q-py-sm q-px-md" style="flex-shrink:0">
        <q-btn flat round dense icon="close" @click="cancel" />
        <q-space />
        <div class="text-weight-medium">裁剪图片</div>
        <q-space />
        <q-btn flat dense color="primary" label="确认裁剪" :disable="!hasSelection" @click="confirm" />
      </q-card-section>
      <q-separator />
      <q-card-section class="col relative-position overflow-hidden flex flex-center" style="background:#222;min-height:0">
        <canvas ref="canvasRef" class="crop-canvas"
          @mousedown.prevent="onMouseDown"
          @mousemove.prevent="onMouseMove"
          @mouseup.prevent="onMouseUp"
          @mouseleave="onMouseLeave"
          style="cursor:crosshair" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  imageDataUrl: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [v: boolean];
  confirm: [blob: Blob];
  cancel: [];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const hasSelection = ref(false);
const sel = ref({ x: 0, y: 0, w: 0, h: 0 });
const isDragging = ref(false);
let startX = 0;
let startY = 0;
let image: HTMLImageElement | null = null;
let displayW = 0;
let displayH = 0;

function onDialogClose(v: boolean) {
  if (!v) cancel();
}

function loadSrc(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = props.imageDataUrl;
  });
}

onMounted(async () => {
  image = await loadSrc();
  layout();
});

function layout() {
  const canvas = canvasRef.value;
  if (!canvas || !image) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const cw = parent.clientWidth;
  const ch = parent.clientHeight;
  const scale = Math.min(cw / image.naturalWidth, ch / image.naturalHeight, 1);
  displayW = Math.round(image.naturalWidth * scale);
  displayH = Math.round(image.naturalHeight * scale);
  canvas.width = displayW;
  canvas.height = displayH;
  redraw();
}

function redraw() {
  const canvas = canvasRef.value;
  if (!canvas || !image) return;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, displayW, displayH);
  if (!hasSelection.value) return;
  const { x, y, w, h } = sel.value;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, displayW, y);
  ctx.fillRect(0, y, x, h);
  ctx.fillRect(x + w, y, displayW - x - w, h);
  ctx.fillRect(0, y + h, displayW, displayH - y - h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function canvasPos(e: MouseEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onMouseDown(e: MouseEvent) {
  const p = canvasPos(e);
  if (!p) return;
  isDragging.value = true;
  startX = Math.max(0, Math.min(p.x, displayW));
  startY = Math.max(0, Math.min(p.y, displayH));
  sel.value = { x: startX, y: startY, w: 0, h: 0 };
  hasSelection.value = false;
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const p = canvasPos(e);
  if (!p) return;
  const ex = Math.max(0, Math.min(p.x, displayW));
  const ey = Math.max(0, Math.min(p.y, displayH));
  const x = Math.min(startX, ex);
  const y = Math.min(startY, ey);
  const w = Math.abs(ex - startX);
  const h = Math.abs(ey - startY);
  sel.value = { x, y, w, h };
  hasSelection.value = w > 3 && h > 3;
  redraw();
}

function onMouseUp() {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (sel.value.w < 3 || sel.value.h < 3) {
    hasSelection.value = false;
    redraw();
  }
}

function onMouseLeave() {
  if (isDragging.value) {
    onMouseUp();
  }
}

async function confirm() {
  if (!hasSelection.value || !image) return;
  const { x, y, w, h } = sel.value;
  const sx = image.naturalWidth / displayW;
  const sy = image.naturalHeight / displayH;
  const cx = Math.round(x * sx);
  const cy = Math.round(y * sy);
  const cw = Math.round(w * sx);
  const ch = Math.round(h * sy);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cw;
  cropCanvas.height = ch;
  const ctx = cropCanvas.getContext('2d')!;
  ctx.drawImage(image, cx, cy, cw, ch, 0, 0, cw, ch);
  cropCanvas.toBlob(blob => {
    const b = blob;
    if (b) emit('confirm', b);
  }, 'image/jpeg', 0.92);
}

function cancel() {
  emit('cancel');
}
</script>
