<template>
  <Transition name="k-backtop">
    <button
      v-if="visible"
      type="button"
      data-part="root"
      class="k-backtop"
      :class="[classNames?.root, { 'is-visible': visible }]"
      :style="[rootStyle, styles?.root]"
      aria-label="回到顶部"
      @click="onClick"
    >
      <span data-part="icon" class="k-backtop__icon" :class="classNames?.icon" :style="styles?.icon">
        <slot>
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 12.5V3.8M4.2 7.6 8 3.8l3.8 3.8" />
          </svg>
        </slot>
      </span>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import {
  addScrollListener,
  getScrollTop,
  resolveScrollTarget,
  scrollToY,
} from '../../utils/scroll';
import type { KScrollTarget } from '../../utils/scroll';

defineOptions({ name: 'KBackTop' });

interface KBackTopProps {
  /** 滚动容器；缺省 window */
  target?: KScrollTarget;
  /** 滚动超过该距离后显示 */
  visibilityHeight?: number;
  right?: number;
  bottom?: number;
  classNames?: { root?: string; icon?: string };
  styles?: { root?: CSSProperties; icon?: CSSProperties };
}

const props = withDefaults(defineProps<KBackTopProps>(), {
  target: undefined,
  visibilityHeight: 200,
  right: 24,
  bottom: 24,
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();

const visible = ref(false);
let detach: (() => void) | null = null;

const rootStyle = computed<CSSProperties>(() => ({
  position: 'fixed',
  right: `${props.right}px`,
  bottom: `${props.bottom}px`,
}));

function update() {
  const target = resolveScrollTarget(props.target);
  visible.value = getScrollTop(target) > props.visibilityHeight;
}

onMounted(async () => {
  await nextTick();
  const target = resolveScrollTarget(props.target);
  detach = addScrollListener(target, update);
  update();
});

onBeforeUnmount(() => {
  detach?.();
  detach = null;
});

function onClick(e: MouseEvent) {
  emit('click', e);
  scrollToY(resolveScrollTarget(props.target), 0);
}

defineSlots<{ default?(): VNodeChild }>();
</script>

<style>
.k-backtop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--k-control-height-lg);
  height: var(--k-control-height-lg);
  padding: 0;
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: 50%;
  background: var(--k-color-bg-elevated);
  color: var(--k-color-text-secondary);
  box-shadow: var(--k-box-shadow-secondary);
  font-size: var(--k-font-size-lg);
  cursor: pointer;
  z-index: var(--k-z-index-affix, 10);
  transition:
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-backtop:hover {
  border-color: var(--k-color-primary-border);
  color: var(--k-color-primary);
}
.k-backtop:active {
  transform: scale(0.94);
}
.k-backtop:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-backtop__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.k-backtop-enter-active,
.k-backtop-leave-active {
  transition:
    opacity var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    transform var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-backtop-enter-from,
.k-backtop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}
@media (prefers-reduced-motion: reduce) {
  .k-backtop,
  .k-backtop-enter-active,
  .k-backtop-leave-active {
    transition: none;
  }
}
</style>