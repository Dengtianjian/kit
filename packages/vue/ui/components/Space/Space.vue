<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    data-part="root"
    :class="[classes, classNames?.root]"
    :style="rootStyle"
  >
    <template v-if="!separator">
      <slot />
    </template>
    <template v-else>
      <template v-for="(child, i) in children" :key="i">
        <span data-part="item" :class="['k-space__item', classNames?.item]" :style="styles?.item">
          <component :is="child" />
        </span>
        <span
          v-if="i < children.length - 1"
          data-part="separator"
          :class="['k-space__separator', classNames?.separator]"
          :style="styles?.separator"
          aria-hidden="true"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots, Comment, Fragment, isVNode } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import { resolveSizeTuple } from '../../utils/size';
import type { KSpaceSize } from '../../utils/size';
import { useResponsiveValue } from '../../composables/useResponsiveValue';
import type { KResponsiveValue, KResponsiveMap } from '../../composables/useResponsiveValue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KSpace' });

type SpacePart = 'root' | 'item' | 'separator';
type SpaceSizeValue = KSpaceSize | [KSpaceSize, KSpaceSize];

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KSpaceRenderScope {
  direction: 'horizontal' | 'vertical';
  align: 'start' | 'center' | 'end' | 'baseline' | undefined;
  wrap: boolean;
  separator: boolean;
  /** 解析后的间距 [行, 列]（token 阶梯 → CSS 值） */
  size: [string, string];
  /** 拍平后的子项 VNode（去 Comment/展 Fragment，separator 模式自绘可直接 v-for） */
  children: VNode[];
  /** data-part + 间距变量 style（布局逻辑）；display/方向等视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KSpaceProps {
  direction?: 'horizontal' | 'vertical';
  /** 轴名对应 token 阶梯（4/8/12/16/24），数字 = 直接 px，可传 [行, 列]；对象/字符串按断点取值 */
  size?: SpaceSizeValue | KResponsiveMap<SpaceSizeValue> | string;
  align?: 'start' | 'center' | 'end' | 'baseline';
  wrap?: boolean;
  separator?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KSpaceRenderScope>;
  classNames?: Partial<Record<SpacePart, string>>;
  styles?: Partial<Record<SpacePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSpaceProps>(), {
  direction: 'horizontal',
  size: 'sm',
  wrap: false,
  separator: false,
});

const slots = useSlots();

const resolvedSize = useResponsiveValue<SpaceSizeValue>(
  () => props.size as KResponsiveValue<SpaceSizeValue>,
  {
    coerce: raw => (/^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw) as SpaceSizeValue,
  },
);

const sizeTuple = computed(() => resolveSizeTuple(resolvedSize.value ?? 'sm'));

/* 间距变量 = 布局逻辑，headless 绑定包带走；styles?.root 只进默认渲染 */
const gapStyle = computed<CSSProperties>(() => ({
  '--k-space-gap-row': sizeTuple.value[0],
  '--k-space-gap-column': sizeTuple.value[1],
}) as CSSProperties);

const rootStyle = computed<CSSProperties>(() => ({
  ...gapStyle.value,
  ...props.styles?.root,
}) as CSSProperties);

const classes = computed(() => [
  'k-space',
  `k-space--${props.direction}`,
  props.align && `k-space--align-${props.align}`,
  { 'k-space--wrap': props.wrap, 'k-space--separator': props.separator },
]);

/** separator 模式才给子项包一层（gap 原生能力优先，见组件规格） */
const children = computed<VNode[]>(() => {
  const raw = slots.default?.() ?? [];
  const flat: VNode[] = [];
  for (const node of raw) {
    if (node.type === Comment) continue;
    if (node.type === Fragment && Array.isArray(node.children)) {
      flat.push(...(node.children as VNode[]).filter(n => n.type !== Comment && isVNode(n)));
    } else {
      flat.push(node);
    }
  }
  if (props.separator && import.meta.env.DEV) {
    for (const node of flat) {
      if (typeof node.type === 'symbol') {
        console.warn('[KSpace] separator 模式要求子项为元素节点，文本节点会导致分隔线错位');
        break;
      }
    }
  }
  return flat;
});

const rootAttrs = computed(() => ({ 'data-part': 'root', style: gapStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KSpaceRenderScope>(
  () => props.render,
  () => ({
    direction: props.direction,
    align: props.align,
    wrap: props.wrap,
    separator: props.separator,
    size: sizeTuple.value,
    children: children.value,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KSpaceRenderScope): VNodeChild;
}>();
</script>

<style>

.k-space {
  display: inline-flex;
  gap: var(--k-space-gap-row, var(--k-size-sm)) var(--k-space-gap-column, var(--k-size-sm));
}

.k-space--vertical {
  flex-direction: column;
}

.k-space--wrap {
  flex-wrap: wrap;
}

.k-space--align-start { align-items: flex-start; }
.k-space--align-center { align-items: center; }
.k-space--align-end { align-items: flex-end; }
.k-space--align-baseline { align-items: baseline; }

.k-space--separator {
  display: flex;
}

.k-space__item {
  display: inline-flex;
  flex: none;
}

.k-space__separator {
  flex: none;
  align-self: stretch;
  width: var(--k-line-width);
  background: var(--k-color-split);
}

.k-space--vertical .k-space__separator {
  width: auto;
  align-self: auto;
  height: var(--k-line-width);
}
</style>
