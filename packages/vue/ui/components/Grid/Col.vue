<script setup lang="ts">
import { computed, inject, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import type { KBreakpoint } from '../../composables/useBreakpoint';
import { K_ROW_INJECTION_KEY } from '../../utils/grid';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KCol' });

type ColPart = 'root';

type SpanResponsive = Partial<Record<KBreakpoint, number>>;

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KColRenderScope {
  span: number | SpanResponsive | undefined;
  offset: number | SpanResponsive | undefined;
  order: number | undefined;
  flex: string | number | undefined;
  /** 注入的 KRow gutter [水平, 垂直]（headless KRow 的 provide 照跑） */
  gutter: [number, number];
  /** data-part + gutter 内边距/order/flex style（布局逻辑）；列宽百分比由 span 自绘（默认走 grid.css class 矩阵） */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KColProps {
  /** 数字或按断点对象（对象值编译进 css/grid.css 的默认断点 class 矩阵） */
  span?: number | SpanResponsive;
  offset?: number | SpanResponsive;
  order?: number;
  flex?: string | number;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KColRenderScope>;
  classNames?: Partial<Record<ColPart, string>>;
  styles?: Partial<Record<ColPart, CSSProperties>>;
}

const props = defineProps<KColProps>();

const gutter = inject(K_ROW_INJECTION_KEY, computed(() => [0, 0] as [number, number]));

const classes = computed(() => {
  const out = ['k-col'];
  const push = (kind: 'span' | 'offset', value: number | SpanResponsive | undefined) => {
    if (value == null) return;
    if (typeof value === 'number') {
      out.push(kind === 'span' ? `k-col-${value}` : `k-col-offset-${value}`);
    } else {
      for (const [bp, v] of Object.entries(value)) {
        if (v == null) continue;
        out.push(kind === 'span' ? `k-col-${bp}-${v}` : `k-col-${bp}-offset-${v}`);
      }
    }
  };
  push('span', props.span);
  push('offset', props.offset);
  return out;
});

/* gutter 内边距/order/flex = 布局逻辑，headless 绑定包带走；styles?.root 只进默认渲染 */
const layoutStyle = computed<CSSProperties>(() => {
  const [h] = gutter.value;
  return {
    paddingLeft: h ? `${h / 2}px` : undefined,
    paddingRight: h ? `${h / 2}px` : undefined,
    order: props.order,
    flex: props.flex === undefined ? undefined : typeof props.flex === 'number' ? `${props.flex} 0 0` : props.flex,
  };
});

const rootStyle = computed<CSSProperties>(() => ({ ...layoutStyle.value, ...props.styles?.root }));

const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', style: layoutStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KColRenderScope>(
  () => props.render,
  () => ({
    span: props.span,
    offset: props.offset,
    order: props.order,
    flex: props.flex,
    gutter: gutter.value,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KColRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div v-else data-part="root" :class="[classes, classNames?.root]" :style="rootStyle">
    <slot />
  </div>
</template>

<style>
/* 列宽 class 矩阵随组件加载（CSS-first 预编译产物） */
@import '../../css/grid.css';

.k-col {
  position: relative;
  box-sizing: border-box;
}
</style>
