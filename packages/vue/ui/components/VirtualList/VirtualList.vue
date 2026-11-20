<template>
  <div
    ref="viewportEl"
    v-bind="rootAttrs"
    class="k-virtual-list"
    :class="classNames?.root"
    :style="[heightStyle, styles?.root]"
    @scroll.passive="onScroll"
  >
    <div
      class="k-virtual-list__content"
      :class="classNames?.content"
      :style="[contentStyle, styles?.content]"
      role="list"
    >
      <div class="k-virtual-list__window" :style="{ transform: `translateY(${range.offsetTop}px)` }">
        <div
          v-for="(item, offset) in visibleItems"
          :key="keyOf(item, range.start + offset)"
          class="k-virtual-list__item"
          :class="classNames?.item"
          :style="[itemStyle, styles?.item]"
          role="listitem"
        >
          <slot :item="item" :index="range.start + offset" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { getVirtualRange } from '../../utils/virtual';

defineOptions({ name: 'KVirtualList' });

type VirtualListPart = 'root' | 'content' | 'item';

interface KVirtualListProps<T> {
  items: readonly T[];
  itemHeight: number;
  height?: number | string;
  overscan?: number;
  /** 槽位 key：字段名或取值函数 */
  itemKey?: string | ((item: T, index: number) => string | number);
  classNames?: Partial<Record<VirtualListPart, string>>;
  styles?: Partial<Record<VirtualListPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KVirtualListProps<T>>(), {
  height: 320,
  overscan: 4,
});

const emit = defineEmits<{ scroll: [scrollTop: number] }>();
const rootAttrs = { 'data-part': 'root' };
const viewportEl = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const measuredHeight = ref(0);
let resizeObserver: ResizeObserver | null = null;

const heightStyle = computed<CSSProperties>(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
}));
const viewportHeight = computed(() =>
  typeof props.height === 'number' ? props.height : measuredHeight.value,
);
const range = computed(() =>
  getVirtualRange(scrollTop.value, viewportHeight.value, props.itemHeight, props.items.length, props.overscan),
);
const visibleItems = computed(() => props.items.slice(range.value.start, range.value.end));
const contentStyle = computed<CSSProperties>(() => ({ height: `${range.value.totalHeight}px` }));
const itemStyle = computed<CSSProperties>(() => ({ height: `${props.itemHeight}px` }));

function keyOf(item: T, index: number) {
  if (typeof props.itemKey === 'function') return props.itemKey(item, index);
  if (typeof props.itemKey === 'string' && item && typeof item === 'object') {
    return (item as Record<string, unknown>)[props.itemKey] as string | number;
  }
  return index;
}

function onScroll() {
  const el = viewportEl.value;
  if (!el) return;
  scrollTop.value = el.scrollTop;
  emit('scroll', el.scrollTop);
}

function scrollToIndex(index: number, align: 'start' | 'center' | 'end' = 'start') {
  const el = viewportEl.value;
  if (!el) return;
  const clamped = Math.min(Math.max(index, 0), Math.max(0, props.items.length - 1));
  let top = clamped * props.itemHeight;
  if (align === 'center') top -= (viewportHeight.value - props.itemHeight) / 2;
  if (align === 'end') top -= viewportHeight.value - props.itemHeight;
  el.scrollTop = Math.max(0, top);
  onScroll();
}

function scrollToTop() {
  scrollToIndex(0);
}

watch(
  () => props.items.length,
  () => {
    const el = viewportEl.value;
    if (!el) return;
    el.scrollTop = Math.min(el.scrollTop, Math.max(0, props.items.length * props.itemHeight - viewportHeight.value));
    scrollTop.value = el.scrollTop;
  },
);

function observe(el: HTMLElement | null) {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!el || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(() => {
    measuredHeight.value = el.clientHeight;
  });
  resizeObserver.observe(el);
  measuredHeight.value = el.clientHeight;
}

watch(viewportEl, observe, { flush: 'post' });
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

defineExpose({ scrollToIndex, scrollToTop, viewportEl });
</script>

<style>
.k-virtual-list {
  position: relative;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
}
.k-virtual-list__content {
  position: relative;
  width: 100%;
}
.k-virtual-list__window {
  position: absolute;
  inset-inline: 0;
  top: 0;
  will-change: transform;
}
.k-virtual-list__item {
  box-sizing: border-box;
  overflow: hidden;
}
</style>