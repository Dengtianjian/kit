<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue';
import type { Component, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KIcon', inheritAttrs: false });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KIconRenderScope {
  size: number | 'xs' | 'sm' | 'md' | 'lg' | undefined;
  spin: boolean;
  label: string | undefined;
  component: Component | undefined;
  /** aria 语义（label→role=img，无 label→aria-hidden）+ 数字 size style + 透传 attrs */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KIconProps {
  /** 数字 = 直接 px；轴名映射 --k-size-icon-*（14/16/24/32）；缺省跟随当前字号 */
  size?: number | 'xs' | 'sm' | 'md' | 'lg';
  spin?: boolean;
  /** 图标集本体（待定项 Q1）不阻塞：注入模式先行，svg 由业务自带 */
  component?: Component;
  /** 有 label = role=img 可读；无 label 视为装饰性 aria-hidden */
  label?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KIconRenderScope>;
}

const props = withDefaults(defineProps<KIconProps>(), { spin: false });

const classes = computed(() => [
  'k-icon',
  typeof props.size === 'string' && `k-icon--${props.size}`,
  props.spin && 'is-spin',
]);

const rootStyle = computed(() =>
  typeof props.size === 'number' ? { fontSize: `${props.size}px` } : undefined,
);

const slots = useSlots();
const attrs = useAttrs();
const rootAttrs = computed(() => ({
  'data-part': 'root',
  role: props.label ? 'img' : undefined,
  'aria-label': props.label,
  'aria-hidden': props.label ? undefined : true,
  style: rootStyle.value,
  ...attrs,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KIconRenderScope>(
  () => props.render,
  () => ({
    size: props.size,
    spin: props.spin,
    label: props.label,
    component: props.component,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KIconRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span v-else :class="classes" v-bind="rootAttrs">
    <component :is="component" v-if="component" />
    <slot v-else />
  </span>
</template>

<style>

.k-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: inherit;
  line-height: 1;
  vertical-align: -0.125em;
  color: inherit;
  font-style: normal;
}

.k-icon svg {
  width: 1em;
  height: 1em;
  fill: currentcolor;
  display: block;
}

.k-icon--xs { font-size: var(--k-size-icon-xs); }
.k-icon--sm { font-size: var(--k-size-icon-sm); }
.k-icon--md { font-size: var(--k-size-icon-md); }
.k-icon--lg { font-size: var(--k-size-icon-lg); }

.k-icon.is-spin {
  animation: k-icon-spin var(--k-motion-duration-spin) linear infinite;
}

@keyframes k-icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
