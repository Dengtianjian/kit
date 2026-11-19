<template>
  <KTooltip :content="text" :disabled="!truncated" :mouse-enter-delay="0.2" placement="top">
    <template #trigger>
      <span ref="textEl" class="k-table__ellipsis-text" @mouseenter="measure">
        <slot>{{ text }}</slot>
      </span>
    </template>
  </KTooltip>
</template>

<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue';
import KTooltip from '../Tooltip/Tooltip.vue';

defineOptions({ name: 'KTableOverflowTooltip' });

defineProps<{ text?: string }>();

const textEl = ref<HTMLElement | null>(null);
const truncated = ref(false);
let resizeObserver: ResizeObserver | null = null;

function measure() {
  const node = textEl.value;
  if (!node) return;
  truncated.value = node.scrollWidth > node.clientWidth + 1;
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && textEl.value) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(textEl.value);
  }
});

onScopeDispose(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style>
.k-table__ellipsis-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>