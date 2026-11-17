<script setup lang="ts">
import { computed, provide, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { buttonGroupSizeKey } from './groupContext';
import type { ButtonSize } from './groupContext';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KButtonGroup' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KButtonGroupRenderScope {
  size: ButtonSize | undefined;
  vertical: boolean;
  /** role=group 语义 + data-part；size 下发（provide）照跑，接壤视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KButtonGroupProps {
  /** 下发给组内 KButton 的 size；子级自传优先 */
  size?: ButtonSize;
  vertical?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KButtonGroupRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KButtonGroupProps>(), {
  vertical: false,
});

provide(buttonGroupSizeKey, computed(() => props.size));

const slots = useSlots();
const rootAttrs = { 'data-part': 'root', role: 'group' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KButtonGroupRenderScope>(
  () => props.render,
  () => ({ size: props.size, vertical: props.vertical, rootAttrs, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KButtonGroupRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    data-part="root"
    :class="[
      'k-button-group',
      { 'k-button-group--vertical': vertical },
      classNames?.root,
    ]"
    :style="styles?.root"
    role="group"
  >
    <slot />
  </div>
</template>

<style>
/* ---------- 按钮组（2026-11-17 拍板走 naive 路线：antd v5 已弃用 ButtonGroup 推荐 Space，但接壤体验 Space 给不了） ---------- */
.k-button-group {
  display: inline-flex;
}
.k-button-group--vertical {
  flex-direction: column;
  align-items: stretch;
}

/* 接壤：非首尾子级 -1px 叠边 + 直角；首尾只留外侧半径 */
.k-button-group > .k-button {
  border-radius: 0;
}
.k-button-group > .k-button:first-child {
  border-radius: var(--k-button-radius) 0 0 var(--k-button-radius);
}
.k-button-group > .k-button:last-child {
  border-radius: 0 var(--k-button-radius) var(--k-button-radius) 0;
}
.k-button-group > .k-button:only-child {
  border-radius: var(--k-button-radius);
}
.k-button-group > .k-button + .k-button {
  margin-left: calc(0px - var(--k-line-width));
}
.k-button-group--vertical > .k-button:first-child {
  border-radius: var(--k-button-radius) var(--k-button-radius) 0 0;
}
.k-button-group--vertical > .k-button:last-child {
  border-radius: 0 0 var(--k-button-radius) var(--k-button-radius);
}
.k-button-group--vertical > .k-button + .k-button {
  margin-left: 0;
  margin-top: calc(0px - var(--k-line-width));
}

/* 悬停/聚焦者的变色边框要盖住邻按钮压过来的边（叠边方向 = 后来者在上，需要 z 抬升） */
.k-button-group > .k-button:hover,
.k-button-group > .k-button:focus-visible {
  z-index: 1;
}
.k-button-group > .k-button:active {
  z-index: 2;
}
</style>
