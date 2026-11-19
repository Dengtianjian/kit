<template>
  <div ref="wrapperEl" data-part="root" class="k-affix" :class="classNames?.root" :style="styles?.root">
    <div
      ref="contentEl"
      data-part="content"
      class="k-affix__content"
      :class="[classNames?.content, { 'is-affixed': affixed }]"
      :style="[contentStyle, styles?.content]"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';

defineOptions({ name: 'KAffix' });

interface KAffixProps {
  /** 距滚动容器顶部的吸顶距离 */
  offsetTop?: number;
  /** 距滚动容器底部的吸底距离；设置后优先于 offsetTop */
  offsetBottom?: number;
  classNames?: { root?: string; content?: string };
  styles?: { root?: CSSProperties; content?: CSSProperties };
}

const props = defineProps<KAffixProps>();

const emit = defineEmits<{ change: [affixed: boolean] }>();

const wrapperEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const affixed = ref(false);

const bottomMode = computed(() => props.offsetBottom !== undefined);
const contentStyle = computed<CSSProperties>(() => {
  if (bottomMode.value) {
    return { bottom: `${props.offsetBottom}px` };
  }
  return { top: `${props.offsetTop ?? 0}px` };
});

function nearestScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return null;
}

function update() {
  const wrapper = wrapperEl.value;
  const content = contentEl.value;
  if (!wrapper || !content) return;
  const scroller = nearestScrollParent(wrapper);
  const w = wrapper.getBoundingClientRect();
  const c = content.getBoundingClientRect();
  const box = scroller?.getBoundingClientRect();
  const style = scroller ? getComputedStyle(scroller) : null;
  const viewportTop = scroller
    ? (box?.top ?? 0) + parseFloat(style?.paddingTop ?? '0')
    : 0;
  const viewportBottom = scroller
    ? (box?.bottom ?? window.innerHeight) - parseFloat(style?.paddingBottom ?? '0')
    : window.innerHeight;
  const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
  const maxScroll = scroller
    ? scroller.scrollHeight - scroller.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight;

  const next = bottomMode.value
    ? scrollTop < maxScroll - 1 && c.bottom <= viewportBottom - (props.offsetBottom ?? 0) + 0.5
    : scrollTop > 0 && w.top <= viewportTop + (props.offsetTop ?? 0) + 0.5;

  if (next !== affixed.value) {
    affixed.value = next;
    emit('change', next);
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  update();
  window.addEventListener('scroll', update, true);
  window.addEventListener('resize', update);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(update);
    if (wrapperEl.value) resizeObserver.observe(wrapperEl.value);
    if (contentEl.value) resizeObserver.observe(contentEl.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', update, true);
  window.removeEventListener('resize', update);
  resizeObserver?.disconnect();
  resizeObserver = null;
});

defineSlots<{ default?(): VNodeChild }>();
</script>

<style>
.k-affix {
  box-sizing: border-box;
}
.k-affix__content {
  position: sticky;
  z-index: var(--k-z-index-affix, 10);
}
</style>