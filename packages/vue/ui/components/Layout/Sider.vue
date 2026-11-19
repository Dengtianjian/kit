<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <aside v-else data-part="root" :class="['k-layout-sider', classNames?.root]" :style="rootStyle">
    <slot />
  </aside>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useResponsiveValue } from '../../composables/useResponsiveValue';
import type { KResponsiveValue, KResponsiveMap } from '../../composables/useResponsiveValue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KLayoutSider' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KLayoutSiderRenderScope {
  width: number | undefined;
  /** data-part + 宽度变量 style（显式传值才注入）；其余视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KLayoutSiderProps {
  /** 默认 208 = 16×13 模度；对象/字符串按断点取值（如 `'xs:160 md:208'`）；折叠属 P4 Menu 场景，本批不做 */
  width?: number | KResponsiveMap<number> | string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KLayoutSiderRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = defineProps<KLayoutSiderProps>();

const resolvedWidth = useResponsiveValue<number>(
  () => props.width as KResponsiveValue<number> | undefined,
  { coerce: Number },
);

/** 仅在显式传值时落内联，否则让 createTheme 组件令牌与 CSS 缺省依次生效 */
const varStyle = computed<CSSProperties>(() =>
  resolvedWidth.value !== undefined ? { '--k-layout-sider-width': `${resolvedWidth.value}px` } : {},
);

const rootStyle = computed<CSSProperties>(() => ({ ...varStyle.value, ...props.styles?.root }));

const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', style: varStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KLayoutSiderRenderScope>(
  () => props.render,
  () => ({ width: resolvedWidth.value, rootAttrs: rootAttrs.value, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KLayoutSiderRenderScope): VNodeChild;
}>();
</script>

<style>

.k-layout-sider {
  flex: none;
  width: var(--k-layout-sider-width, 208px);
  box-sizing: border-box;
  background: var(--k-color-bg-container);
  overflow: auto;
}
</style>
