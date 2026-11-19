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
            :class="[
              classNames?.stage,
              {
                'is-gesturing': gesturing,
                'is-media': !isImage,
                'is-pannable': isPannable,
                'is-panning': panning,
              },
            ]"
            :style="styles?.stage"
            v-on="stageOn"
          >
            <template v-if="currentItem">
              <slot
                v-if="$slots.item"
                name="item"
                :item="currentItem"
                :index="safeCurrent"
                :type="currentType"
              />
              <component v-else-if="rendererComponent" :is="rendererComponent" />
              <Transition
                v-else-if="isImage"
                :name="`k-preview-slide-${slideDir}`"
                mode="out-in"
              >
                <div :key="safeCurrent" class="k-preview__slide">
                  <div
                    v-if="mediaState === 'loading'"
                    class="k-preview__skeleton"
                    :class="classNames?.skeleton"
                    :style="styles?.skeleton"
                    aria-hidden="true"
                  />
                  <img
                    v-bind="imageAttrs"
                    :key="retryTick"
                    class="k-preview__img"
                    :class="[classNames?.image, { 'is-dimmed': mediaState === 'loading', 'is-hidden': mediaState === 'error' }]"
                    :style="[imageStyle, styles?.image]"
                    @load="onMediaLoad"
                    @error="onMediaError"
                  />
                </div>
              </Transition>
              <video
                v-else-if="currentType === 'video'"
                ref="mediaEl"
                :key="`${safeCurrent}-${retryTick}`"
                v-bind="videoAttrs"
                class="k-preview__video"
                :class="[classNames?.video, { 'is-dimmed': mediaState === 'loading', 'is-hidden': mediaState === 'error' }]"
                :style="styles?.video"
                @loadeddata="onMediaLoad"
                @error="onMediaError"
              />
              <div
                v-else-if="currentType === 'audio'"
                class="k-preview__audio-wrap"
                :class="classNames?.audio"
                :style="styles?.audio"
              >
                <audio
                  ref="mediaEl"
                  :key="`${safeCurrent}-${retryTick}`"
                  v-bind="audioAttrs"
                  class="k-preview__audio"
                  @loadeddata="onMediaLoad"
                  @error="onMediaError"
                />
                <span class="k-preview__audio-name">{{ currentItem.name ?? currentItem.src }}</span>
              </div>
              <div
                v-else-if="currentType === 'pdf'"
                class="k-preview__pdf-wrap"
                :class="classNames?.pdf"
                :style="styles?.pdf"
              >
                <iframe
                  class="k-preview__pdf"
                  :src="currentItem.src"
                  :title="currentItem.name ?? 'PDF 预览'"
                />
                <a
                  class="k-preview__pdf-open"
                  :href="currentItem.src"
                  target="_blank"
                  rel="noopener"
                >新窗口打开</a>
              </div>
              <div
                v-else-if="currentType === 'office'"
                class="k-preview__document"
                :class="classNames?.document"
                :style="styles?.document"
              >
                <span class="k-preview__doc-badge">{{ officeLabel }}</span>
                <strong class="k-preview__fallback-name">{{ currentItem.name ?? currentItem.src }}</strong>
                <p class="k-preview__unsupported">Office 文档不在页面内解析，可下载或在新窗口打开</p>
                <a
                  class="k-preview__fallback-link"
                  :href="currentItem.src"
                  target="_blank"
                  rel="noopener"
                  download
                >打开原文件</a>
              </div>
              <div
                v-else
                class="k-preview__fallback"
                :class="classNames?.fallback"
                :style="styles?.fallback"
              >
                <strong class="k-preview__fallback-name">{{ currentItem.name ?? currentItem.src }}</strong>
                <p class="k-preview__unsupported">暂不支持预览此类型，可通过 renderers / #item 自定义</p>
                <a
                  class="k-preview__fallback-link"
                  :href="currentItem.src"
                  target="_blank"
                  rel="noopener"
                  download
                >打开原文件</a>
              </div>

              <div
                v-if="mediaState === 'loading' && !isImage"
                class="k-preview__loading"
                role="status"
                aria-label="加载中"
              >
                <span class="k-preview__spinner" aria-hidden="true" />
              </div>
              <div
                v-else-if="mediaState === 'error'"
                class="k-preview__fallback k-preview__error"
                :class="classNames?.fallback"
                :style="styles?.fallback"
              >
                <strong class="k-preview__fallback-name">{{ currentItem.name ?? currentItem.src }}</strong>
                <p class="k-preview__unsupported">加载失败，请检查文件地址或重试</p>
                <div class="k-preview__fallback-actions">
                  <button type="button" class="k-preview__fallback-btn" @click.stop="retryMedia">重新加载</button>
                  <a class="k-preview__fallback-link" :href="currentItem.src" target="_blank" rel="noopener">打开原文件</a>
                </div>
              </div>
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
            v-if="showToolbar"
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

          <div
            v-if="showThumbs"
            ref="thumbsEl"
            data-part="thumbnails"
            class="k-preview__thumbs"
            :class="[
              classNames?.thumbnails,
              {
                'is-scrollable': thumbEdges.scrollable,
                'fade-l': thumbEdges.scrollable && !thumbEdges.atStart,
                'fade-r': thumbEdges.scrollable && !thumbEdges.atEnd,
              },
            ]"
            :style="styles?.thumbnails"
            @scroll.passive="onThumbScroll"
          >
            <button
              v-for="(item, index) in items"
              :key="index"
              type="button"
              class="k-preview__thumb"
              :class="[{ 'is-active': index === safeCurrent }, classNames?.thumb]"
              :style="styles?.thumb"
              :aria-label="`第 ${index + 1} 项：${thumbLabel(item)}`"
              :aria-current="index === safeCurrent ? 'true' : undefined"
              v-on="thumbOn(index)"
            >
              <img
                v-if="thumbSrc(item) && !thumbErrors.has(index)"
                :src="thumbSrc(item)"
                alt=""
                draggable="false"
                @error="onThumbError(index)"
              />
              <span v-else class="k-preview__thumb-label">{{ thumbLabel(item) }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </template>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import { useKConfig } from '../../composables/useKConfig';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';

defineOptions({ name: 'KPreview' });

/** 内置 image / video / audio / pdf / office；其他类型由 resolveType + renderers / #item 接管 */
export type KPreviewItemType = 'image' | 'video' | 'audio' | 'pdf' | 'office' | (string & {});

export interface KPreviewItem {
  src: string;
  alt?: string;
  name?: string;
  /** 显式类型优先；缺省走 resolveType → 后缀推断 */
  type?: KPreviewItemType;
  /** 缩略图地址；视频可用 poster，缺省图片取 src */
  thumbnail?: string;
  /** 视频封面 */
  poster?: string;
  [key: string]: unknown;
}

export interface KPreviewRendererContext {
  item: KPreviewItem;
  index: number;
  type: string;
  close: () => void;
  next: () => void;
  prev: () => void;
  setOpen: (v: boolean) => void;
  setCurrent: (index: number) => void;
}
export type KPreviewRenderer = (ctx: KPreviewRendererContext) => VNodeChild;

const IMAGE_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|bmp)(?:[?#]|$)/i;
const VIDEO_RE = /\.(?:mp4|webm|ogv|mov|m4v)(?:[?#]|$)/i;
const AUDIO_RE = /\.(?:mp3|wav|ogg|oga|m4a|aac|flac)(?:[?#]|$)/i;
const PDF_RE = /\.pdf(?:[?#]|$)/i;
const OFFICE_RE = /\.(?:docx?|xlsx?|pptx?)(?:[?#]|$)/i;
function inferType(src: string): string {
  if (/^data:image\//i.test(src)) return 'image';
  if (/^data:video\//i.test(src)) return 'video';
  if (/^data:audio\//i.test(src)) return 'audio';
  if (/^data:application\/pdf/i.test(src)) return 'pdf';
  if (IMAGE_RE.test(src)) return 'image';
  if (VIDEO_RE.test(src)) return 'video';
  if (AUDIO_RE.test(src)) return 'audio';
  if (PDF_RE.test(src)) return 'pdf';
  if (OFFICE_RE.test(src)) return 'office';
  return 'other';
}

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KPreviewRenderScope {
  open: boolean;
  items: KPreviewItem[];
  count: number;
  /** 当前序号（0 基） */
  current: number;
  currentItem: KPreviewItem | null;
  /** 解析后的当前类型：image / video / audio / pdf / office / other / 自定义 */
  currentType: string;
  scale: number;
  /** 平移偏移（仅放大后可拖拽，px） */
  panX: number;
  panY: number;
  /** 当前是否可拖拽平移（图片且 scale > 1） */
  isPannable: boolean;
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
  /** 是否显示缩略图条 */
  thumbnails: boolean;
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

type PreviewPart =
  | 'root'
  | 'mask'
  | 'stage'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'skeleton'
  | 'fallback'
  | 'toolbar'
  | 'nav'
  | 'close'
  | 'counter'
  | 'thumbnails'
  | 'thumb';

interface KPreviewProps {
  items?: KPreviewItem[];
  minScale?: number;
  maxScale?: number;
  maskClosable?: boolean;
  closable?: boolean;
  /** 底部缩放工具栏（仅图片显示） */
  toolbar?: boolean;
  /** 多图时显示底部缩略图条 */
  thumbnails?: boolean;
  /** 类型判定钩子：返回 undefined 时回落后缀推断 */
  resolveType?: (item: KPreviewItem) => string | undefined;
  /** 按类型注册渲染函数；优先级低于 #item 插槽、高于内置 image/video/audio/pdf/office */
  renderers?: Record<string, KPreviewRenderer>;
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
  thumbnails: true,
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

const currentType = computed(() => {
  const item = currentItem.value;
  if (!item) return 'other';
  return item.type ?? props.resolveType?.(item) ?? inferType(item.src);
});
const isImage = computed(() => currentType.value === 'image');
const showToolbar = computed(() => props.toolbar && isImage.value);
const showThumbs = computed(() => props.thumbnails && count.value > 1);

const rootClasses = computed(() => [
  'k-preview',
  config?.scopeClass.value ? 'k-config-provider' : '',
  config?.scopeClass.value ?? '',
  { 'has-thumbs': showThumbs.value },
]);

const mediaEl = ref<HTMLMediaElement | null>(null);
const thumbsEl = ref<HTMLElement | null>(null);
const mediaState = ref<'loading' | 'ready' | 'error'>('ready');
const retryTick = ref(0);
const panning = ref(false);
const isPannable = computed(() => isImage.value && scale.value > 1);
const thumbErrors = ref<Set<number>>(new Set());
const thumbEdges = reactive({ scrollable: false, atStart: true, atEnd: true });

function syncThumbEdges() {
  const box = thumbsEl.value;
  if (!box) {
    thumbEdges.scrollable = thumbEdges.atStart = thumbEdges.atEnd = true;
    return;
  }
  thumbEdges.scrollable = box.scrollWidth > box.clientWidth + 1;
  thumbEdges.atStart = box.scrollLeft <= 1;
  thumbEdges.atEnd = box.scrollLeft + box.clientWidth >= box.scrollWidth - 1;
}
function onThumbScroll() {
  syncThumbEdges();
}

function isMediaType(type: string) {
  return type === 'image' || type === 'video' || type === 'audio';
}
function onMediaLoad() {
  mediaState.value = 'ready';
}
function onMediaError() {
  mediaState.value = 'error';
}
function retryMedia() {
  mediaState.value = 'loading';
  retryTick.value += 1;
}
function onThumbError(index: number) {
  thumbErrors.value = new Set(thumbErrors.value).add(index);
}

function thumbSrc(item: KPreviewItem): string | undefined {
  if (item.thumbnail) return item.thumbnail;
  const type = item.type ?? props.resolveType?.(item) ?? inferType(item.src);
  if (type === 'image') return item.src;
  if (type === 'video') return item.poster;
  return undefined;
}
function thumbLabel(item: KPreviewItem): string {
  return item.name ?? (inferType(item.src) === 'video' ? '视频' : currentTypeLabel(item));
}
function fileExtLabel(item: KPreviewItem): string {
  const m = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(item.name ?? item.src);
  return m ? m[1].toUpperCase() : 'FILE';
}
function currentTypeLabel(item: KPreviewItem): string {
  const type = item.type ?? props.resolveType?.(item) ?? inferType(item.src);
  if (type === 'office') return fileExtLabel(item);
  return type.toUpperCase();
}
const officeLabel = computed(() =>
  currentItem.value ? fileExtLabel(currentItem.value) : 'FILE',
);
const rendererComponent = computed(() => {
  const fn = props.renderers?.[currentType.value];
  if (!fn || !currentItem.value) return null;
  return () =>
    fn({
      item: currentItem.value!,
      index: safeCurrent.value,
      type: currentType.value,
      close,
      next,
      prev,
      setOpen,
      setCurrent,
    });
});

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
  panning.value = false;
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

function trapTab(e: KeyboardEvent) {
  const root = rootEl.value;
  if (!root) return;
  const items = [...root.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.getClientRects().length > 0);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return;
  }
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
function onDocKey(e: KeyboardEvent) {
  if (!openModel.value) return;
  switch (e.key) {
    case 'Tab':
      trapTab(e);
      break;
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
      if (!isImage.value) return;
      e.preventDefault();
      zoomBy(1.25);
      break;
    case '-':
      if (!isImage.value) return;
      e.preventDefault();
      zoomBy(0.8);
      break;
    case '0':
      if (!isImage.value) return;
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
  if (!isImage.value) return;
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
  if (suppressClick) {
    suppressClick = false;
    return;
  }
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
let suppressClick = false;

function onPointerDown(e: PointerEvent) {
  if (!isImage.value) return;
  suppressClick = false;
  gesturing.value = true;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    // 双指缩放才需要捕获（否则 click 目标会被重定向到舞台，误判为点空白关闭）
    const stage = stageEl.value;
    for (const id of pointers.keys()) stage?.setPointerCapture?.(id);
    const [a, b] = [...pointers.values()];
    pinching = true;
    pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    pinchStartScale = scale.value;
    swipe = null;
    panLast = null;
    return;
  }
  if (pointers.size === 1) {
    if (scale.value > 1) {
      panLast = { x: e.clientX, y: e.clientY };
    }
    if (e.pointerType !== 'mouse' && scale.value === 1) swipe = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
}
function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinching && pointers.size === 2) {
    e.preventDefault();
    suppressClick = true;
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    setScale(pinchStartScale * (dist / pinchStartDist));
    return;
  }
  if (panLast && scale.value > 1) {
    e.preventDefault();
    // 拖动开始才捕获指针：单纯点卡片不捕获，避免 click 目标被重定向到舞台
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    suppressClick = true;
    panning.value = true;
    panX.value += e.clientX - panLast.x;
    panY.value += e.clientY - panLast.y;
    panLast = { x: e.clientX, y: e.clientY };
  }
}
function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (!pointers.size) gesturing.value = false;
  panning.value = false;
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
      suppressClick = true;
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
  panning.value = false;
  pinchStartDist = 0;
  pinching = false;
  panLast = null;
  swipe = null;
}

/* ---------- headless 绑定包 ---------- */
const rootAttrs = computed(() => ({
  'data-part': 'root',
  'data-type': currentType.value,
  role: 'dialog',
  'aria-modal': 'true',
  'aria-label': currentItem.value?.name ?? (isImage.value ? '图片预览' : '文件预览'),
  tabindex: -1,
  'data-k-theme': config?.scheme.value && config.scheme.value !== 'auto' ? config.scheme.value : undefined,
}));
const rootOn: KOnPack = {
  // 焦点在预览内时由根节点处理并阻断冒泡，避免与 document 监听重复触发（一次按键切两张）
  keydown: (e) => {
    (e as KeyboardEvent).stopPropagation();
    onDocKey(e as KeyboardEvent);
  },
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
const videoAttrs = computed(() => ({
  'data-part': 'video',
  src: currentItem.value?.src,
  poster: currentItem.value?.poster ?? currentItem.value?.thumbnail,
  controls: true,
  playsinline: true,
  preload: 'metadata',
}));
const audioAttrs = computed(() => ({
  'data-part': 'audio',
  src: currentItem.value?.src,
  controls: true,
  preload: 'metadata',
}));
function thumbOn(index: number): KOnPack {
  return {
    click: (e) => {
      e.stopPropagation();
      setCurrent(index);
    },
  };
}
watch([safeCurrent, openModel, currentType], () => {
  mediaEl.value?.pause();
  retryTick.value = 0;
  mediaState.value = isMediaType(currentType.value) ? 'loading' : 'ready';
});
const preloadedSources = new Set<string>();
function preloadNeighbors() {
  for (let offset = -2; offset <= 2; offset += 1) {
    if (!offset) continue;
    const item = props.items[safeCurrent.value + offset];
    if (!item) continue;
    const type = item.type ?? props.resolveType?.(item) ?? inferType(item.src);
    if (type !== 'image' || /^data:/i.test(item.src) || preloadedSources.has(item.src)) continue;
    preloadedSources.add(item.src);
    const img = new Image();
    img.decoding = 'async';
    img.src = item.src;
  }
}
watch([safeCurrent, openModel], () => {
  if (openModel.value) nextTick(preloadNeighbors);
});
watch(() => props.items, () => {
  thumbErrors.value = new Set();
  preloadedSources.clear();
});
watch([safeCurrent, openModel, showThumbs], async () => {
  if (!openModel.value || !showThumbs.value) return;
  await nextTick();
  const box = thumbsEl.value;
  const el = box?.children[safeCurrent.value] as HTMLElement | undefined;
  if (!box || !el) return;
  box.scrollTo({
    left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
    behavior: 'smooth',
  });
  syncThumbEdges();
});
onMounted(() => window.addEventListener('resize', syncThumbEdges));
onBeforeUnmount(() => window.removeEventListener('resize', syncThumbEdges));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KPreviewRenderScope>(
  () => props.render,
  () => ({
    open: openModel.value,
    items: props.items,
    count: count.value,
    current: safeCurrent.value,
    currentItem: currentItem.value,
    currentType: currentType.value,
    scale: scale.value,
    panX: panX.value,
    panY: panY.value,
    isPannable: isPannable.value,
    rotate: rotate.value,
    flipX: flipX.value,
    minScale: props.minScale,
    maxScale: props.maxScale,
    hasPrev: hasPrev.value,
    hasNext: hasNext.value,
    maskClosable: props.maskClosable,
    closable: props.closable,
    toolbar: props.toolbar,
    thumbnails: props.thumbnails,
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
  item?(scope: { item: KPreviewItem; index: number; type: string }): VNodeChild;
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
.k-preview__slide {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.k-preview__img {
  position: relative;
  z-index: 1;
  max-width: 86vw;
  max-height: 86vh;
  object-fit: contain;
  user-select: none;
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-preview__skeleton {
  position: absolute;
  z-index: 0;
  width: min(60vw, 720px);
  height: min(60vh, 480px);
  border-radius: var(--k-border-radius-lg);
  background: linear-gradient(
    100deg,
    rgb(255 255 255 / 0.06) 30%,
    rgb(255 255 255 / 0.16) 50%,
    rgb(255 255 255 / 0.06) 70%
  );
  background-size: 220% 100%;
  animation: k-preview-shimmer 1.2s ease-in-out infinite;
}
.k-preview__stage.is-pannable {
  cursor: grab;
}
.k-preview__stage.is-panning {
  cursor: grabbing;
}
.k-preview__stage.is-media {
  touch-action: auto;
}
.k-preview__video {
  max-width: 86vw;
  max-height: 86vh;
  background: #000;
}
.k-preview__audio-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--k-size);
  max-width: min(560px, 80vw);
  padding: var(--k-size-lg);
  border-radius: var(--k-border-radius-lg);
  background: var(--k-preview-control-bg);
  color: var(--k-preview-control-color);
}
.k-preview__audio {
  width: min(420px, 70vw);
}
.k-preview__audio-name {
  font-size: var(--k-font-size-sm);
  word-break: break-all;
}
.k-preview__pdf-wrap {
  position: relative;
  width: min(86vw, 1100px);
  height: 86vh;
  border-radius: var(--k-border-radius-lg);
  overflow: hidden;
  background: #fff;
}
.k-preview__pdf {
  width: 100%;
  height: 100%;
  border: 0;
}
.k-preview__pdf-open {
  position: absolute;
  z-index: 1;
  top: 12px;
  inset-inline-end: 12px;
  padding: 6px 12px;
  border-radius: var(--k-border-radius);
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font-size: var(--k-font-size-sm);
  text-decoration: none;
}
.k-preview__pdf-open:hover {
  background: rgb(0 0 0 / 0.72);
}
.k-preview__document {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--k-size-sm);
  max-width: min(560px, 80vw);
  padding: var(--k-size-lg);
  border-radius: var(--k-border-radius-lg);
  background: var(--k-preview-control-bg);
  color: var(--k-preview-control-color);
  text-align: center;
}
.k-preview__doc-badge {
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.18);
  font-size: var(--k-font-size-xs);
  font-weight: var(--k-font-weight-strong);
  letter-spacing: 0.06em;
}
.k-preview__unsupported,
.k-preview__empty {
  color: rgb(255 255 255 / 0.65);
  font-size: var(--k-font-size);
}
.k-preview__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--k-size-sm);
  max-width: min(560px, 80vw);
  padding: var(--k-size-lg);
  border-radius: var(--k-border-radius-lg);
  background: var(--k-preview-control-bg);
  color: var(--k-preview-control-color);
  text-align: center;
}
.k-preview__fallback-name {
  font-size: var(--k-font-size-lg);
  font-weight: var(--k-font-weight-strong);
  word-break: break-all;
}
.k-preview__fallback-link {
  color: var(--k-preview-control-color);
  text-decoration: underline;
  font-size: var(--k-font-size-sm);
}
.k-preview__fallback-actions {
  display: flex;
  align-items: center;
  gap: var(--k-size-sm);
}
.k-preview__fallback-btn {
  padding: 6px 14px;
  border: none;
  border-radius: var(--k-border-radius);
  background: rgb(255 255 255 / 0.16);
  color: var(--k-preview-control-color);
  font: inherit;
  font-size: var(--k-font-size-sm);
  cursor: pointer;
}
.k-preview__fallback-btn:hover {
  background: var(--k-preview-control-bg-hover);
}
.k-preview__error {
  position: absolute;
  z-index: 3;
  width: max-content;
  /* 原内容宽度约 196px，按 1.5 倍取 300px 作为最小宽度，再按内容/视口上限放宽 */
  min-width: min(300px, 92vw);
  max-width: min(840px, 92vw);
  background: rgb(0 0 0 / 0.6);
}
.k-preview__loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.k-preview__spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid rgb(255 255 255 / 0.25);
  border-top-color: #fff;
  animation: k-preview-spin 0.8s linear infinite;
}
.k-preview__img.is-dimmed,
.k-preview__video.is-dimmed {
  opacity: 0.35;
}
.k-preview__img.is-hidden,
.k-preview__video.is-hidden {
  visibility: hidden;
}
@keyframes k-preview-spin {
  to { transform: rotate(360deg); }
}
@keyframes k-preview-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -20% 0; }
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
/* 缩略图条：底部居中横滚，工具栏让位到其上方 */
.k-preview__thumbs {
  position: absolute;
  z-index: 2;
  bottom: 16px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  max-width: min(72vw, 720px);
  padding: 4px;
  border-radius: 10px;
  background: var(--k-preview-control-bg);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.k-preview__thumbs::-webkit-scrollbar {
  display: none;
}
.k-preview__thumbs.is-scrollable.fade-l {
  mask-image: linear-gradient(to right, transparent, #000 24px);
}
.k-preview__thumbs.is-scrollable.fade-r {
  mask-image: linear-gradient(to left, transparent, #000 24px);
}
.k-preview__thumbs.is-scrollable.fade-l.fade-r {
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
}
.k-preview__thumb {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.08);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-preview__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.k-preview__thumb.is-active {
  border-color: #fff;
}
.k-preview__thumb-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 2px;
  color: var(--k-preview-control-color);
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  word-break: break-all;
}
.k-preview.has-thumbs .k-preview__toolbar {
  bottom: 76px;
}
.k-preview.has-thumbs .k-preview__counter {
  bottom: 80px;
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

@media (max-width: 767px) {
  .k-preview__thumbs {
    bottom: 12px;
    max-width: 88vw;
  }
  .k-preview__thumb {
    width: 44px;
    height: 44px;
  }
  .k-preview.has-thumbs .k-preview__toolbar {
    bottom: 66px;
  }
  .k-preview.has-thumbs .k-preview__counter {
    bottom: 70px;
  }
  .k-preview__nav--prev {
    inset-inline-start: 8px;
  }
  .k-preview__nav--next {
    inset-inline-end: 8px;
  }
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
