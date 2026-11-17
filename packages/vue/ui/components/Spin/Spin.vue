<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useSlots, watch } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KSpin' });

type SpinPart = 'root' | 'indicator' | 'tip' | 'nested';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KSpinRenderScope {
  /** delay 收敛后的展示态（非原始 spinning prop） */
  spinning: boolean;
  size: 'sm' | 'md' | 'lg';
  tip: string | VNode | undefined;
  nested: boolean;
  rootAttrs: Record<string, unknown>;
  nestedAttrs: Record<string, unknown>;
  indicatorAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KSpinProps {
  spinning?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tip?: string | VNode;
  /** 延迟展示毫秒（antd delay 同款，防瞬时请求闪烁） */
  delay?: number;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KSpinRenderScope>;
  classNames?: Partial<Record<SpinPart, string>>;
  styles?: Partial<Record<SpinPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSpinProps>(), {
  spinning: true,
  size: 'md',
});

const slots = useSlots();
const nested = computed(() => Boolean(slots.default));

const visible = ref(props.spinning);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.spinning,
  (v) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!v) {
      visible.value = false;
      return;
    }
    if (props.delay && props.delay > 0) {
      timer = setTimeout(() => {
        visible.value = true;
        timer = null;
      }, props.delay);
    } else {
      visible.value = true;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

/* ---------- headless 绑定包：默认模板与自绘共用 ---------- */
const rootAttrs = { 'data-part': 'root' };
const indicatorAttrs = { 'data-part': 'indicator', role: 'status', 'aria-live': 'polite' };
const nestedAttrs = computed(() => ({
  'data-part': 'nested',
  inert: visible.value || undefined,
  'aria-busy': visible.value || undefined,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KSpinRenderScope>(
  () => props.render,
  () => ({
    spinning: visible.value,
    size: props.size,
    tip: props.tip,
    nested: nested.value,
    rootAttrs,
    nestedAttrs: nestedAttrs.value,
    indicatorAttrs,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  indicator?(): VNodeChild;
  render?(scope: KSpinRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-spin"
    :class="[
      `k-spin--${size}`,
      { 'k-spin--nested': nested, 'is-spinning': visible },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <div
      v-if="nested"
      v-bind="nestedAttrs"
      class="k-spin__nested"
      :class="classNames?.nested"
      :style="styles?.nested"
    >
      <slot />
    </div>
    <div
      v-if="visible"
      v-bind="indicatorAttrs"
      class="k-spin__indicator"
      :class="classNames?.indicator"
      :style="styles?.indicator"
    >
      <slot name="indicator">
        <span class="k-spin__dot" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <circle cx="8" cy="8" r="6.2" stroke-dasharray="26 13" />
          </svg>
        </span>
      </slot>
      <div v-if="tip" data-part="tip" class="k-spin__tip" :class="classNames?.tip" :style="styles?.tip">
        <component :is="KNode" :node="tip" />
      </div>
    </div>
  </div>
</template>

<style>
.k-spin {
  --k-spin-dot-size: calc(var(--k-size-step) * 6); /* 24px 基准，尺寸档按阶梯缩放 */
  --k-spin-color: var(--k-color-primary);
  --k-spin-tip-color: var(--k-color-primary);

  position: relative;
  display: inline-flex;
  font-family: inherit;
}
.k-spin--sm { --k-spin-dot-size: calc(var(--k-size-step) * 4.5); }
.k-spin--lg { --k-spin-dot-size: calc(var(--k-size-step) * 8); }

.k-spin__indicator {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-spin-color);
}
.k-spin__dot {
  display: inline-flex;
  width: var(--k-spin-dot-size);
  height: var(--k-spin-dot-size);
}
.k-spin__dot svg {
  width: 100%;
  height: 100%;
  animation: k-spin-rotate var(--k-motion-duration-spin) linear infinite;
}
.k-spin__tip {
  color: var(--k-spin-tip-color);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}

/* 包裹模式：内容压暗禁交互，指示器居中浮层 */
.k-spin--nested {
  display: block;
  width: 100%;
}
.k-spin__nested {
  transition: opacity var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-spin--nested.is-spinning .k-spin__nested {
  opacity: 0.45;
  user-select: none;
  pointer-events: none;
}
.k-spin--nested .k-spin__indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--k-z-index-segment);
}

@keyframes k-spin-rotate {
  to { transform: rotate(360deg); }
}

/* 触屏按压遮罩豁免：纯状态指示件，无交互语义 */
</style>
