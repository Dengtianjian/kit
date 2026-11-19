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
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { resolveSizeTuple } from '../../utils/size';
import type { KSpaceSize } from '../../utils/size';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KFlex' });

type FlexPart = 'root';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KFlexRenderScope {
  inline: boolean;
  vertical: boolean;
  wrap: boolean;
  justify: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | undefined;
  align: 'start' | 'center' | 'end' | 'baseline' | 'stretch' | undefined;
  /** 解析后的间距 [行, 列]；未传 gap = null */
  gap: [string, string] | null;
  /** data-part + 间距变量 style（布局逻辑）；display/对齐等视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KFlexProps {
  inline?: boolean;
  vertical?: boolean;
  wrap?: boolean;
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  gap?: KSpaceSize | [KSpaceSize, KSpaceSize];
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KFlexRenderScope>;
  classNames?: Partial<Record<FlexPart, string>>;
  styles?: Partial<Record<FlexPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KFlexProps>(), {
  inline: false,
  vertical: false,
  wrap: false,
});

// 布局原子件：属性一一映射 CSS，不加行为；间距语义请用 KSpace（规格 components/flex.md）
const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

const ALIGN: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  baseline: 'baseline',
  stretch: 'stretch',
};

const classes = computed(() => [
  'k-flex',
  props.justify && `k-flex--justify-${props.justify}`,
  props.align && `k-flex--align-${props.align}`,
  { 'k-flex--inline': props.inline, 'k-flex--vertical': props.vertical, 'k-flex--wrap': props.wrap },
]);

const gapTuple = computed<[string, string] | null>(() =>
  props.gap === undefined ? null : resolveSizeTuple(props.gap),
);

/* 间距变量 = 布局逻辑，headless 绑定包带走；styles?.root 只进默认渲染 */
const gapStyle = computed<CSSProperties>(() =>
  gapTuple.value
    ? ({ '--k-flex-gap-row': gapTuple.value[0], '--k-flex-gap-column': gapTuple.value[1] } as CSSProperties)
    : {},
);

const rootStyle = computed<CSSProperties>(() => ({ ...gapStyle.value, ...props.styles?.root }));

const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', style: gapStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KFlexRenderScope>(
  () => props.render,
  () => ({
    inline: props.inline,
    vertical: props.vertical,
    wrap: props.wrap,
    justify: props.justify,
    align: props.align,
    gap: gapTuple.value,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KFlexRenderScope): VNodeChild;
}>();
</script>

<style>

.k-flex {
  display: flex;
  gap: var(--k-flex-gap-row) var(--k-flex-gap-column);
}

.k-flex--inline { display: inline-flex; }
.k-flex--vertical { flex-direction: column; }
.k-flex--wrap { flex-wrap: wrap; }

.k-flex--justify-start { justify-content: flex-start; }
.k-flex--justify-end { justify-content: flex-end; }
.k-flex--justify-center { justify-content: center; }
.k-flex--justify-between { justify-content: space-between; }
.k-flex--justify-around { justify-content: space-around; }
.k-flex--justify-evenly { justify-content: space-evenly; }

.k-flex--align-start { align-items: flex-start; }
.k-flex--align-center { align-items: center; }
.k-flex--align-end { align-items: flex-end; }
.k-flex--align-baseline { align-items: baseline; }
.k-flex--align-stretch { align-items: stretch; }
</style>
