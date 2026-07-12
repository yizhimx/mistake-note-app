<template>
  <q-dialog :model-value="modelValue" maximized persistent @update:model-value="onDialogClose">
    <q-card class="column no-wrap" style="height:100vh">
      <q-card-section class="row items-center q-py-sm q-px-md" style="flex-shrink:0">
        <q-btn flat round dense icon="close" @click="cancel" />
        <q-space />
        <div class="text-weight-medium">裁剪图片</div>
        <q-space />
        <q-btn flat dense icon="restart_alt" label="清除" :disable="!hasSelection" @click="clearSelection" />
        <q-btn flat dense color="primary" label="确认裁剪" :disable="!hasSelection" @click="confirm" />
      </q-card-section>
      <q-separator />
      <q-card-section class="row items-center q-px-md q-py-xs bg-grey-2" style="flex-shrink:0">
        <span class="text-caption text-grey-7 q-mr-sm">比例</span>
        <q-btn-group flat dense>
          <q-btn size="sm" :color="aspect === 0 ? 'primary' : 'grey-7'" label="自由" @click="setAspect(0)" />
          <q-btn size="sm" :color="aspect === 1 ? 'primary' : 'grey-7'" label="1:1" @click="setAspect(1)" />
          <q-btn size="sm" :color="aspect === 4/3 ? 'primary' : 'grey-7'" label="4:3" @click="setAspect(4/3)" />
          <q-btn size="sm" :color="aspect === 16/9 ? 'primary' : 'grey-7'" label="16:9" @click="setAspect(16/9)" />
        </q-btn-group>
        <q-space />
        <span class="text-caption text-grey-6">拖拽框选 · 框内拖动可移动</span>
      </q-card-section>
      <q-card-section class="col relative-position overflow-hidden flex flex-center" style="background:#222;min-height:0"
        @mousedown.prevent="onMouseDown"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend.prevent="onTouchEnd">
        <canvas ref="canvasRef" class="crop-canvas"
          style="cursor:crosshair;touch-action:none;pointer-events:none" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

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
const aspect = ref(0); // 0 = free

const isDragging = ref(false);
let dragMode: 'new' | 'move' = 'new';
let startX = 0;
let startY = 0;
let baseSel = { x: 0, y: 0, w: 0, h: 0 };
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

async function reload() {
  try {
    image = await loadSrc();
    layout();
  } catch {
    image = null;
  }
}

// Reload whenever the dialog opens or the source image changes
// (q-dialog keeps the component mounted, so onMounted alone is not enough)
watch(
  () => [props.modelValue, props.imageDataUrl],
  ([open]) => {
    if (open) {
      hasSelection.value = false;
      sel.value = { x: 0, y: 0, w: 0, h: 0 };
      void reload();
    }
  },
);

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
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  redraw();
}

function onResize() {
  if (props.modelValue) layout();
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  if (props.modelValue) void reload();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});

function redraw() {
  const canvas = canvasRef.value;
  if (!canvas || !image) return;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, displayW, displayH);
  ctx.drawImage(image, 0, 0, displayW, displayH);
  if (!hasSelection.value) return;
  const { x, y, w, h } = sel.value;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, displayW, y);
  ctx.fillRect(x + w, y, displayW - x - w, h);
  ctx.fillRect(0, y + h, displayW, displayH - y - h);
  ctx.fillRect(0, y, x, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function canvasPos(clientX: number, clientY: number): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

function setAspect(a: number) {
  aspect.value = a;
  if (a > 0 && hasSelection.value) {
    let h = Math.round(sel.value.w / a);
    if (sel.value.y + h > displayH) h = displayH - sel.value.y;
    sel.value = { ...sel.value, h: Math.max(0, h) };
    redraw();
  }
}

function startDrag(p: { x: number; y: number }) {
  if (
    hasSelection.value &&
    p.x >= sel.value.x && p.x <= sel.value.x + sel.value.w &&
    p.y >= sel.value.y && p.y <= sel.value.y + sel.value.h
  ) {
    isDragging.value = true;
    dragMode = 'move';
    startX = p.x;
    startY = p.y;
    baseSel = { ...sel.value };
  } else {
  isDragging.value = true;
  dragMode = 'new';
    startX = Math.max(0, Math.min(p.x, displayW));
    startY = Math.max(0, Math.min(p.y, displayH));
    sel.value = { x: startX, y: startY, w: 0, h: 0 };
    hasSelection.value = false;
  }
}

function dragTo(p: { x: number; y: number }) {
  if (!isDragging.value) return;
  if (dragMode === 'move') {
    const dx = p.x - startX;
    const dy = p.y - startY;
    const nx = Math.max(0, Math.min(baseSel.x + dx, displayW - baseSel.w));
    const ny = Math.max(0, Math.min(baseSel.y + dy, displayH - baseSel.h));
    sel.value = { ...baseSel, x: nx, y: ny };
    redraw();
    return;
  }
  const ex = Math.max(0, Math.min(p.x, displayW));
  const ey = Math.max(0, Math.min(p.y, displayH));
  const x = Math.min(startX, ex);
  const y = Math.min(startY, ey);
  let w = Math.abs(ex - startX);
  let h = Math.abs(ey - startY);
  if (aspect.value > 0 && w > 0) {
    h = Math.round(w / aspect.value);
    if (y + h > displayH) {
      h = displayH - y;
      w = Math.round(h * aspect.value);
    }
  }
  sel.value = { x, y, w, h };
  hasSelection.value = w > 3 && h > 3;
  redraw();
}

function endDrag() {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (sel.value.w < 3 || sel.value.h < 3) {
    hasSelection.value = false;
    redraw();
  }
}

function onMouseDown(e: MouseEvent) {
  const p = canvasPos(e.clientX, e.clientY);
  if (!p || !image) return;
  startDrag(p);
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
}

function onWindowMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const p = canvasPos(e.clientX, e.clientY);
  if (p) dragTo(p);
}

function onWindowMouseUp() {
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
  endDrag();
}

function onTouchStart(e: TouchEvent) {
  if (!e.touches.length) return;
  const t = e.touches[0];
  const p = canvasPos(t.clientX, t.clientY);
  if (!p || !image) return;
  startDrag(p);
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value || !e.touches.length) return;
  const t = e.touches[0];
  const p = canvasPos(t.clientX, t.clientY);
  if (p) dragTo(p);
}

function onTouchEnd() {
  endDrag();
}

function clearSelection() {
  hasSelection.value = false;
  sel.value = { x: 0, y: 0, w: 0, h: 0 };
  redraw();
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
  cropCanvas.toBlob(
    (blob) => {
      if (blob) emit('confirm', blob);
      else emit('cancel');
    },
    'image/jpeg',
    0.92,
  );
}

function cancel() {
  emit('cancel');
}
</script>
