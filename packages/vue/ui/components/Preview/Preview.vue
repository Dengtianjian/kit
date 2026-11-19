<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <template v-else>
    <Teleport to="body">
      <Transition name="k-preview-fade">
        <div
          v-if="openModel"
          ref="rootEl"
          v-bind="rootAttrs"
          :class="[rootClasses, classNames?.root]"
          :style="styles?.root"
          v-on="rootOn"
        >
          <div
            data-part="mask"
            class="k-preview__mask"
            :class="classNames?.mask"
            :style="styles?.mask"
            v-on="maskOn"
          />
          <div
            ref="stageEl"
            data-part="stage"
            class="k-preview__stage"
            :class="[classNames?.stage, { 'is-gesturing': gesturing }]"
            :style="styles?.stage"
            v-on="stageOn"
          >
            <template v-if="currentItem">
              <slot v-if="$slots.item" name="item" :item="currentItem" :index="safeCurrent" />
              <Transition
                v-else-if="(currentItem.type ?? 'image') === 'image'"
                :name="`k-preview-slide-${slideDir}`"
                mode="out-in"
              >
                <div :key="safeCurrent" class="k-preview__slide">
                  <img
                    v-bind="imageAttrs"
                    class="k-preview__img"
                    :class="classNames?.image"
                    :style="[imageStyle, styles?.image]"
                  />
                </div>
              </Transition>
              <div v-else class="k-preview__unsupported">该文件类型暂不支持预览</div>
            </template>
            <span v-else class="k-preview__empty">暂无可预览内容</span>
          </div>

          <button
            v-if="closable"
            type="button"
            data-part="close"
            class="k-preview__close"
            :class="classNames?.close"
            :style="styles?.close"
            aria-label="关闭"
            v-on="closeOn"
          >
            <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" /></svg>
          </button>

          <button
            v-if="hasPrev"
            type="button"
            data-part="nav"
            class="k-preview__nav k-preview__nav--prev"
            :class="classNames?.nav"
            :style="styles?.nav"
            aria-label="上一张"
            v-on="prevOn"
          >‹</button>
          <button
            v-if="hasNext"
            type="button"
            data-part="nav"
            class="k-preview__nav k-preview__nav--next"
            :class="classNames?.nav"
            :style="styles?.nav"
            aria-label="下一张"
            v-on="nextOn"
          >›</button>

          <div
            v-if="toolbar"
            data-part="toolbar"
            class="k-preview__toolbar"
            :class="classNames?.toolbar"
            :style="styles?.toolbar"
          >
            <button type="button" class="k-preview__tool" aria-label="缩小" v-on="zoomOutOn">−</button>
            <button type="button" class="k-preview__scale" title="重置为 100%" v-on="resetOn">{{ Math.round(scale * 100) }}%</button>
            <button type="button" class="k-preview__tool" aria-label="放大" v-on="zoomInOn">+</button>
            <span class="k-preview__tool-divider" aria-hidden="true" />
            <button type="button" class="k-preview__tool" aria-label="逆时针旋转" title="逆时针旋转 90°" v-on="rotateLeftOn">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6" /><path d="M2.8 2.6V5h2.4" /></svg>
            </button>
            <button type="button" class="k-preview__tool" aria-label="顺时针旋转" title="顺时针旋转 90°" v-on="rotateRightOn">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13.2 2.6V5h-2.4" /></svg>
            </button>
            <button type="button" class="k-preview__tool" :aria-pressed="flipX" aria-label="水平翻转" title="水平翻转" v-on="flipOn">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M8 2.5v11" /><path d="M6.4 4.2 3 8l3.4 3.8z" /><path d="M9.6 4.2 13 8l-3.4 3.8z" /></svg>
            </button>
          </div>

          <div v-if="count > 1" data-part="counter" class="k-preview__counter" :class="classNames?.counter" :style="styles?.counter">
            {{ safeCurrent + 1 }} / {{ count }}
          </div>
        </div>
      </Transition>
    </Teleport>
  </template>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import { useKConfig } from '../../composables/useKConfig';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';

defineOptions({ name: 'KPreview' });

/** 首批仅 image；pdf / video 等后续以联合类型登记，消费方按 type 分流即可 */
export type KPreviewItemType = 'image';

export interface KPreviewItem {
  src: string;
  alt?: string;
  name?: string;
  type?: KPreviewItemType;
  [key: string]: unknown;
}

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KPreviewRenderScope {
  open: boolean;
  items: KPreviewItem[];
  count: number;
  /** 当前序号（0 基） */
  current: number;
  currentItem: KPreviewItem | null;
  scale: number;
  /** 旋转角（0/90/180/270） */
  rotate: number;
  /** 是否水平翻转 */
  flipX: boolean;
  minScale: number;
  maxScale: number;
  hasPrev: boolean;
  hasNext: boolean;
  maskClosable: boolean;
  closable: boolean;
  toolbar: boolean;
  rootEl: Ref<HTMLElement | null>;
  stageEl: Ref<HTMLElement | null>;
  rootAttrs: Record<string, unknown>;
  /** 根节点 keydown（←/→ 切换、+/-/0 缩放、Esc 关闭） */
  rootOn: KOnPack;
  maskOn: KOnPack;
  stageOn: KOnPack;
  prevOn: KOnPack;
  nextOn: KOnPack;
  closeOn: KOnPack;
  zoomInOn: KOnPack;
  zoomOutOn: KOnPack;
  resetOn: KOnPack;
  rotateLeftOn: KOnPack;
  rotateRightOn: KOnPack;
  flipOn: KOnPack;
  /** 当前图语义包（src/alt/draggable） */
  imageAttrs: Record<string, unknown>;
  /** 图片 transform 样式（缩放随动） */
  imageStyle: CSSProperties;
  setOpen: (v: boolean) => void;
  close: () => void;
  setCurrent: (index: number) => void;
  next: () => void;
  prev: () => void;
  zoomBy: (factor: number) => void;
  setScale: (scale: number) => void;
  rotateBy: (delta: number) => void;
  flip: () => void;
  resetView: () => void;
  slots: ReturnType<typeof useSlots>;
}

type PreviewPart = 'root' | 'mask' | 'stage' | 'image' | 'toolbar' | 'nav' | 'close' | 'counter';

interface KPreviewProps {
  items?: KPreviewItem[];
  minScale?: number;
  maxScale?: number;
  maskClosable?: boolean;
  closable?: boolean;
  /** 底部缩放工具栏 */
  toolbar?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KPreviewRenderScope>;
  classNames?: Partial<Record<PreviewPart, string>>;
  styles?: Partial<Record<PreviewPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KPreviewProps>(), {
  items: () => [],
  minScale: 0.25,
  maxScale: 5,
  maskClosable: true,
  closable: true,
  toolbar: true,
});

const emit = defineEmits<{
  close: [];
  change: [current: number, item: KPreviewItem];
  zoom: [scale: number];
  rotate: [deg: number];
  flip: [flippedX: boolean];
}>();

const openModel = defineModel<boolean>('open', { default: false });
const currentModel = defineModel<number>('current', { default: 0 });
const slots = useSlots();

const config = useKConfig();
const rootEl = ref<HTMLElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const rotate = ref(0);
const flipX = ref(false);
const slideDir = ref<'next' | 'prev'>('next');

const count = computed(() => props.items.length);
const safeCurrent = computed(() =>
  count.value ? Math.min(Math.max(currentModel.value, 0), count.value - 1) : 0,
);
const currentItem = computed<KPreviewItem | null>(() => props.items[safeCurrent.value] ?? null);
const hasPrev = computed(() => safeCurrent.value > 0);
const hasNext = computed(() => safeCurrent.value < count.value - 1);

const rootClasses = computed(() => [
  'k-preview',
  config?.scopeClass.value ? 'k-config-provider' : '',
  config?.scopeClass.value ?? '',
]);

function setScale(next: number) {
  const v = Math.min(props.maxScale, Math.max(props.minScale, Number(next.toFixed(3))));
  if (v === scale.value) return;
  scale.value = v;
  if (v <= 1) {
    panX.value = 0;
    panY.value = 0;
  }
  emit('zoom', v);
}
function zoomBy(factor: number) {
  setScale(scale.value * factor);
}
function rotateBy(delta: number) {
  /* 不清零取模：转满 360° 后继续累加（360→450），复位才归 0，避免视觉上反着倒转 */
  rotate.value += delta;
  emit('rotate', rotate.value);
}
function flip() {
  flipX.value = !flipX.value;
  emit('flip', flipX.value);
}
function resetView() {
  setScale(1);
  panX.value = 0;
  panY.value = 0;
  rotate.value = 0;
  flipX.value = false;
}

function setCurrent(index: number) {
  if (!count.value) return;
  const next = Math.min(Math.max(index, 0), count.value - 1);
  if (next === safeCurrent.value) return;
  currentModel.value = next;
  const item = props.items[next];
  if (item) emit('change', next, item);
}
function next() {
  if (hasNext.value) setCurrent(safeCurrent.value + 1);
}
function prev() {
  if (hasPrev.value) setCurrent(safeCurrent.value - 1);
}

let restoreFocus: HTMLElement | null = null;
let prevOverflow = '';

watch(openModel, (v, old) => {
  if (v) {
    restoreFocus = (document.activeElement as HTMLElement | null) ?? null;
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDocKey);
    nextTick(() => rootEl.value?.focus());
  } else if (old) {
    document.removeEventListener('keydown', onDocKey);
    document.body.style.overflow = prevOverflow || '';
    restoreFocus?.focus?.();
    restoreFocus = null;
    emit('close');
  }
});
function setOpen(v: boolean) {
  openModel.value = v;
}
function close() {
  setOpen(false);
}

function onDocKey(e: KeyboardEvent) {
  if (!openModel.value) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      prev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      next();
      break;
    case '+':
    case '=':
      e.preventDefault();
      zoomBy(1.25);
      break;
    case '-':
      e.preventDefault();
      zoomBy(0.8);
      break;
    case '0':
      e.preventDefault();
      resetView();
      break;
    case 'Escape':
      e.preventDefault();
      close();
      break;
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
}

watch(safeCurrent, (n, o) => {
  slideDir.value = n >= o ? 'next' : 'prev';
  resetView();
});
watch(openModel, (v) => {
  if (v) resetView();
});
watch(
  () => props.items.length,
  () => {
    if (currentModel.value > count.value - 1) currentModel.value = Math.max(0, count.value - 1);
  },
);
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKey);
  if (openModel.value) document.body.style.overflow = prevOverflow || '';
});

function maskClick() {
  if (props.maskClosable) close();
}
/** 舞台铺满全屏（在遮罩之上），真实点击空白的 target 是 stage：只有点空白/遮罩才关，点图不关 */
function onStageClick(e: MouseEvent) {
  if (!props.maskClosable) return;
  const t = e.target as HTMLElement;
  if (t === stageEl.value || t.classList.contains('k-preview__mask')) close();
}

/* ---------- 触屏手势：双指缩放、放大后拖动平移、单指左右滑切换 ---------- */
const pointers = new Map<number, { x: number; y: number }>();
const gesturing = ref(false);
let pinchStartDist = 0;
let pinchStartScale = 1;
let pinching = false;
let panLast: { x: number; y: number } | null = null;
let swipe: { x: number; y: number; t: number } | null = null;

function onPointerDown(e: PointerEvent) {
  gesturing.value = true;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinching = true;
    pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    pinchStartScale = scale.value;
    swipe = null;
    panLast = null;
    return;
  }
  if (pointers.size === 1) {
    if (scale.value > 1) panLast = { x: e.clientX, y: e.clientY };
    if (e.pointerType !== 'mouse' && scale.value === 1) swipe = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
}
function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinching && pointers.size === 2) {
    e.preventDefault();
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    setScale(pinchStartScale * (dist / pinchStartDist));
    return;
  }
  if (panLast && scale.value > 1) {
    e.preventDefault();
    panX.value += e.clientX - panLast.x;
    panY.value += e.clientY - panLast.y;
    panLast = { x: e.clientX, y: e.clientY };
  }
}
function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (!pointers.size) gesturing.value = false;
  if (pinching) {
    pinching = false;
    swipe = null;
    panLast = null;
    return;
  }
  if (swipe && e.pointerType !== 'mouse' && scale.value === 1) {
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const dt = Date.now() - swipe.t;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40 && dt < 600) {
      if (dx < 0) next();
      else prev();
    }
  }
  swipe = null;
  panLast = null;
}
function onPointerCancel(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (!pointers.size) gesturing.value = false;
  pinchStartDist = 0;
  pinching = false;
  panLast = null;
  swipe = null;
}

/* ---------- headless 绑定包 ---------- */
const rootAttrs = computed(() => ({
  'data-part': 'root',
  role: 'dialog',
  'aria-modal': 'true',
  'aria-label': currentItem.value?.name ?? '图片预览',
  tabindex: -1,
  'data-k-theme': config?.scheme.value && config.scheme.value !== 'auto' ? config.scheme.value : undefined,
}));
const rootOn: KOnPack = {
  keydown: (e) => onDocKey(e as KeyboardEvent),
};
const maskOn: KOnPack = { click: () => maskClick() };
const stageOn: KOnPack = {
  wheel: (e) => onWheel(e as WheelEvent),
  click: (e) => onStageClick(e as MouseEvent),
  pointerdown: (e) => onPointerDown(e as PointerEvent),
  pointermove: (e) => onPointerMove(e as PointerEvent),
  pointerup: (e) => onPointerUp(e as PointerEvent),
  pointercancel: (e) => onPointerCancel(e as PointerEvent),
};
const prevOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    prev();
  },
};
const nextOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    next();
  },
};
const closeOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    close();
  },
};
const zoomInOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    zoomBy(1.25);
  },
};
const zoomOutOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    zoomBy(0.8);
  },
};
const resetOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    resetView();
  },
};
const rotateLeftOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    rotateBy(-90);
  },
};
const rotateRightOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    rotateBy(90);
  },
};
const flipOn: KOnPack = {
  click: (e) => {
    e.stopPropagation();
    flip();
  },
};
const imageAttrs = computed(() => ({
  'data-part': 'image',
  src: currentItem.value?.src,
  alt: currentItem.value?.alt ?? currentItem.value?.name ?? '',
  draggable: 'false',
}));
const imageStyle = computed<CSSProperties>(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value}) rotate(${rotate.value}deg) scaleX(${flipX.value ? -1 : 1})`,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KPreviewRenderScope>(
  () => props.render,
  () => ({
    open: openModel.value,
    items: props.items,
    count: count.value,
    current: safeCurrent.value,
    currentItem: currentItem.value,
    scale: scale.value,
    rotate: rotate.value,
    flipX: flipX.value,
    minScale: props.minScale,
    maxScale: props.maxScale,
    hasPrev: hasPrev.value,
    hasNext: hasNext.value,
    maskClosable: props.maskClosable,
    closable: props.closable,
    toolbar: props.toolbar,
    rootEl,
    stageEl,
    rootAttrs: rootAttrs.value,
    rootOn,
    maskOn,
    stageOn,
    prevOn,
    nextOn,
    closeOn,
    zoomInOn,
    zoomOutOn,
    resetOn,
    rotateLeftOn,
    rotateRightOn,
    flipOn,
    imageAttrs: imageAttrs.value,
    imageStyle: imageStyle.value,
    setOpen,
    close,
    setCurrent,
    next,
    prev,
    zoomBy,
    setScale,
    rotateBy,
    flip,
    resetView,
    slots,
  }),
);

defineSlots<{
  /** 自定义当前内容（后续 pdf/video 等类型扩展点） */
  item?(scope: { item: KPreviewItem; index: number }): VNodeChild;
  render?(scope: KPreviewRenderScope): VNodeChild;
}>();

defineExpose({ open: () => setOpen(true), close, next, prev, setCurrent, setScale, rotateBy, flip, resetView });
</script>

<style>
/* ---------- 全屏预览：暗色舞台 + 工具栏（破格登记：遮罩恒定深色，同 Modal mask 先例） ---------- */
.k-preview {
  --k-preview-mask-bg: rgb(0 0 0 / 75%);
  --k-preview-control-bg: rgb(255 255 255 / 0.12);
  --k-preview-control-bg-hover: rgb(255 255 255 / 0.22);
  --k-preview-control-color: #fff;

  position: fixed;
  inset: 0;
  z-index: var(--k-z-index-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  font-family: inherit;
}
.k-preview *,
.k-preview *::before,
.k-preview *::after {
  box-sizing: border-box;
}
.k-preview__mask {
  position: absolute;
  inset: 0;
  background: var(--k-preview-mask-bg);
}
.k-preview__stage {
  position: relative;
  z-index: 1;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.k-preview__stage.is-gesturing .k-preview__img {
  transition: none;
}
.k-preview__img {
  max-width: 86vw;
  max-height: 86vh;
  object-fit: contain;
  user-select: none;
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-preview__unsupported,
.k-preview__empty {
  color: rgb(255 255 255 / 0.65);
  font-size: var(--k-font-size);
}

/* 控件：白字半透明圆钮，置于遮罩之上 */
.k-preview__close,
.k-preview__nav,
.k-preview__tool,
.k-preview__scale {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--k-preview-control-bg);
  color: var(--k-preview-control-color);
  cursor: pointer;
  transition: background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-preview__close:hover,
.k-preview__nav:hover,
.k-preview__tool:hover,
.k-preview__scale:hover {
  background: var(--k-preview-control-bg-hover);
}
.k-preview__close {
  top: 16px;
  inset-inline-end: 16px;
  width: 36px;
  height: 36px;
  font-size: 16px;
}
.k-preview__nav {
  top: 50%;
  width: 44px;
  height: 44px;
  margin-top: -22px;
  font-size: 24px;
  line-height: 1;
  padding-bottom: 3px;
}
.k-preview__nav--prev {
  inset-inline-start: 24px;
}
.k-preview__nav--next {
  inset-inline-end: 24px;
}

.k-preview__toolbar {
  position: absolute;
  z-index: 2;
  bottom: 16px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  padding: 4px var(--k-size-xxs);
  border-radius: 999px;
  background: var(--k-preview-control-bg);
}
.k-preview__tool {
  position: static;
  width: 28px;
  height: 28px;
  font-size: 16px;
  background: transparent;
}
.k-preview__scale {
  position: static;
  width: auto;
  min-width: 52px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  background: transparent;
  font-size: var(--k-font-size-sm);
  font-variant-numeric: tabular-nums;
}
.k-preview__counter {
  position: absolute;
  z-index: 2;
  bottom: 20px;
  inset-inline-end: 24px;
  color: rgb(255 255 255 / 0.75);
  font-size: var(--k-font-size-sm);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.k-preview__slide {
  display: flex;
  align-items: center;
  justify-content: center;
}
.k-preview__tool-divider {
  flex: none;
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgb(255 255 255 / 0.25);
}

/* 轮播：out-in，旧图绝对定位保持居中；方向由切换序决定 */
.k-preview-slide-next-enter-active,
.k-preview-slide-prev-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.k-preview-slide-next-leave-active,
.k-preview-slide-prev-leave-active {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.k-preview-slide-next-enter-from {
  opacity: 0;
  transform: translateX(42px);
}
.k-preview-slide-next-leave-to {
  opacity: 0;
  transform: translateX(-42px);
}
.k-preview-slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-42px);
}
.k-preview-slide-prev-leave-to {
  opacity: 0;
  transform: translateX(42px);
}

/* 进出场：淡入淡出 */
.k-preview-fade-enter-active,
.k-preview-fade-leave-active {
  transition: opacity 0.2s ease;
}
.k-preview-fade-enter-from,
.k-preview-fade-leave-to {
  opacity: 0;
}
</style>
