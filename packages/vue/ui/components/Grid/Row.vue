<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div v-else data-part="root" :class="[classes, classNames?.root]" :style="rootStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import type { KBreakpoint } from '../../composables/useBreakpoint';
import { useResponsiveValue } from '../../composables/useResponsiveValue';
import type { KResponsiveValue } from '../../composables/useResponsiveValue';
import { K_ROW_INJECTION_KEY } from '../../utils/grid';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KRow' });

type RowPart = 'root';

type GutterValue = number | [number, number];
type GutterResponsive = Partial<Record<KBreakpoint, GutterValue>>;

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KRowRenderScope {
  /** 解析后的 gutter [水平, 垂直]（响应式断点回退逻辑照跑，并继续 provide 给 KCol） */
  gutter: [number, number];
  justify: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | undefined;
  align: 'top' | 'middle' | 'bottom' | 'stretch' | undefined;
  wrap: boolean;
  /** data-part + 负外边距/rowGap style（gutter 逻辑）；display/flex 等视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KRowProps {
  /** 数值 = [水平, 垂直]；对象/字符串 = 按断点取定值（如 `'xs:8 sm:16 md:24'`） */
  gutter?: GutterValue | GutterResponsive | string;
  justify?: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  align?: 'top' | 'middle' | 'bottom' | 'stretch';
  wrap?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KRowRenderScope>;
  classNames?: Partial<Record<RowPart, string>>;
  styles?: Partial<Record<RowPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KRowProps>(), { wrap: true });

const resolvedGutter = useResponsiveValue<GutterValue>(
  () => props.gutter as KResponsiveValue<GutterValue> | undefined,
  {
    coerce: raw => {
      const parts = raw.split(',');
      return parts.length > 1
        ? ([Number(parts[0]), Number(parts[1] ?? 0)] as GutterValue)
        : (Number(raw) as GutterValue);
    },
  },
);

const gutter = computed<[number, number]>(() => {
  const value = resolvedGutter.value;
  if (value == null) return [0, 0];
  if (typeof value === 'number') return [value, 0];
  return [value[0] ?? 0, value[1] ?? 0];
});

provide(K_ROW_INJECTION_KEY, gutter);

const classes = computed(() => [
  'k-row',
  props.justify && `k-row--justify-${props.justify}`,
  props.align && `k-row--align-${props.align}`,
  { 'k-row--no-wrap': !props.wrap },
]);

/* 负外边距/rowGap = gutter 逻辑，headless 绑定包带走；styles?.root 只进默认渲染 */
const layoutStyle = computed<CSSProperties>(() => {
  const [h, v] = gutter.value;
  return {
    marginLeft: h ? `${-h / 2}px` : undefined,
    marginRight: h ? `${-h / 2}px` : undefined,
    rowGap: v ? `${v}px` : undefined,
  };
});

const rootStyle = computed<CSSProperties>(() => ({ ...layoutStyle.value, ...props.styles?.root }));

const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', style: layoutStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KRowRenderScope>(
  () => props.render,
  () => ({
    gutter: gutter.value,
    justify: props.justify,
    align: props.align,
    wrap: props.wrap,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KRowRenderScope): VNodeChild;
}>();
</script>

<style>

.k-row {
  display: flex;
  flex-wrap: wrap;
  box-sizing: border-box;
}

.k-row--no-wrap { flex-wrap: nowrap; }

.k-row--justify-start { justify-content: flex-start; }
.k-row--justify-end { justify-content: flex-end; }
.k-row--justify-center { justify-content: center; }
.k-row--justify-space-between { justify-content: space-between; }
.k-row--justify-space-around { justify-content: space-around; }
.k-row--justify-space-evenly { justify-content: space-evenly; }

.k-row--align-top { align-items: flex-start; }
.k-row--align-middle { align-items: center; }
.k-row--align-bottom { align-items: flex-end; }
.k-row--align-stretch { align-items: stretch; }
</style>
