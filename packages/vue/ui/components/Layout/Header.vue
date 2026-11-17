<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KLayoutHeader' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KLayoutHeaderRenderScope {
  height: number | undefined;
  /** data-part + 高度变量 style（显式传值才注入）；其余视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KLayoutHeaderProps {
  /** 默认 64，8 网格模度表值 */
  height?: number;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KLayoutHeaderRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = defineProps<KLayoutHeaderProps>();

/** 仅在显式传值时落内联，否则让 createTheme 组件令牌与 CSS 缺省依次生效 */
const varStyle = computed<CSSProperties>(() =>
  props.height !== undefined ? { '--k-layout-header-height': `${props.height}px` } : {},
);

const rootStyle = computed<CSSProperties>(() => ({ ...varStyle.value, ...props.styles?.root }));

const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', style: varStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KLayoutHeaderRenderScope>(
  () => props.render,
  () => ({ height: props.height, rootAttrs: rootAttrs.value, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KLayoutHeaderRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <header v-else data-part="root" :class="['k-layout-header', classNames?.root]" :style="rootStyle">
    <slot />
  </header>
</template>

<style>

.k-layout-header {
  display: flex;
  align-items: center;
  flex: none;
  height: var(--k-layout-header-height, 64px);
  padding-inline: var(--k-padding-lg);
  box-sizing: border-box;
  background: var(--k-color-bg-container);
}
</style>
