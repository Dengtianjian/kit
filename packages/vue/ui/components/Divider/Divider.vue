<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    data-part="root"
    :class="[classes, classNames?.root]"
    :style="styles?.root"
    role="separator"
    :aria-orientation="type"
  >
    <span v-if="hasText" data-part="text" :class="['k-divider__text', classNames?.text]" :style="styles?.text">
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KDivider' });

type DividerPart = 'root' | 'text';

/** headless scope：#render 插槽 / render prop 闭包参数 */
export interface KDividerRenderScope {
  type: 'horizontal' | 'vertical';
  dashed: boolean;
  orientation: 'start' | 'center' | 'end';
  plain: boolean;
  /** horizontal 且有默认插槽内容 */
  hasText: boolean;
  /** role/aria 绑定包：v-bind 到自绘根节点继承分隔符语义 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KDividerProps {
  type?: 'horizontal' | 'vertical';
  dashed?: boolean;
  /** 仅在有文字内容时生效 */
  orientation?: 'start' | 'center' | 'end';
  /** 文字用常规字重（默认 500 强调） */
  plain?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KDividerRenderScope>;
  classNames?: Partial<Record<DividerPart, string>>;
  styles?: Partial<Record<DividerPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KDividerProps>(), {
  type: 'horizontal',
  dashed: false,
  orientation: 'center',
  plain: false,
});

const slots = useSlots();
const hasText = computed(() => props.type === 'horizontal' && Boolean(slots.default));

const classes = computed(() => [
  'k-divider',
  `k-divider--${props.type}`,
  {
    'k-divider--dashed': props.dashed,
    'k-divider--with-text': hasText.value,
    [`k-divider--${props.orientation}`]: hasText.value,
    'k-divider--plain': props.plain,
  },
]);

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KDividerRenderScope>(
  () => props.render,
  () => ({
    type: props.type,
    dashed: props.dashed,
    orientation: props.orientation,
    plain: props.plain,
    hasText: hasText.value,
    rootAttrs: { 'data-part': 'root', role: 'separator', 'aria-orientation': props.type },
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KDividerRenderScope): VNodeChild;
}>();
</script>

<style>

.k-divider {
  --k-divider-inset-block: var(--k-size-lg);
  --k-divider-inset-block-with-text: var(--k-size);
  --k-divider-vertical-gap: var(--k-size-xs);
  --k-divider-vertical-height: 0.9em;
  --k-divider-line-color: var(--k-color-split);
  --k-divider-line-type: solid;
  --k-divider-text-color: var(--k-color-text);
  --k-divider-text-gap: 1em;

  display: flex;
  align-items: center;
  margin: var(--k-divider-inset-block) 0;
  border-block-start: var(--k-line-width) var(--k-divider-line-type) var(--k-divider-line-color);
  color: var(--k-divider-text-color);
  font-size: var(--k-font-size);
  white-space: nowrap;
}

.k-divider--dashed { --k-divider-line-type: dashed; }

.k-divider--with-text {
  margin-block: var(--k-divider-inset-block-with-text);
  border: none;
}

/* 文字两侧 = 伪元素线（不用 flex:1 假元素，打印/复制不含空格） */
.k-divider--with-text::before,
.k-divider--with-text::after {
  content: "";
  flex: auto;
  border-block-start: var(--k-line-width) var(--k-divider-line-type) var(--k-divider-line-color);
}

.k-divider__text {
  flex: none;
  padding-inline: var(--k-divider-text-gap);
  font-weight: var(--k-font-weight-strong, 500);
}

.k-divider--plain .k-divider__text { font-weight: normal; }

.k-divider--start::before { max-width: 5%; }
.k-divider--end::after { max-width: 5%; }

.k-divider--vertical {
  display: inline-block;
  vertical-align: middle;
  margin: 0 var(--k-divider-vertical-gap);
  /* inline-block 无内容 → 高度必须显式给，否则 1px 边框画在 0 高元素上不可见（antd 同值 0.9em） */
  height: var(--k-divider-vertical-height);
  border-block-start: none;
  border-inline-start: var(--k-line-width) var(--k-divider-line-type) var(--k-divider-line-color);
  white-space: normal;
}
</style>
