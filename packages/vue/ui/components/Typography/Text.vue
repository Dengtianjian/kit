<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <component
    :is="tag"
    v-else
    data-part="root"
    :class="['k-text', type !== 'default' && `k-text--${type}`, gradient && 'k-text--gradient', classNames?.root]"
    :style="rootStyle"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KText' });

type TextType = 'default' | 'secondary' | 'tertiary' | 'disabled';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KTextRenderScope {
  type: TextType;
  strong: boolean;
  code: boolean;
  mark: boolean;
  delete: boolean;
  underline: boolean;
  gradient: boolean | string;
  /** 派生语义标签（code/mark/del/u/b/span，语义优先于 strong） */
  tag: string;
  /** color/gradient 解析 style（色彩逻辑；background-clip 等视觉自绘） */
  rootStyle: CSSProperties;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KTextProps {
  /** 层级语义色（α 四级），禁止业务直接写色 */
  type?: TextType;
  /** 自定义文字颜色（任意 CSS 色值）；与 gradient 同传时 gradient 优先 */
  color?: string;
  /** 渐变文字：true = token 默认渐变；字符串 = 自定义色标（逗号分隔，或完整 gradient()） */
  gradient?: boolean | string;
  strong?: boolean;
  code?: boolean;
  mark?: boolean;
  delete?: boolean;
  underline?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KTextRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KTextProps>(), { type: 'default', gradient: false });

/** color 落内联压过 type 类；gradient 走类名（需要 background-clip，内联做不了） */
const gradientImage = computed(() => {
  const g = props.gradient;
  if (!g || g === true) return undefined; // true = CSS 里的 token 默认渐变
  return g.includes('gradient(') ? g : `linear-gradient(90deg, ${g})`;
});

/* color/gradient 解析 = 色彩逻辑，headless scope 带走；styles?.root 只进默认渲染 */
const logicStyle = computed<CSSProperties>(() => ({
  ...(props.color && !props.gradient ? { color: props.color } : {}),
  ...(gradientImage.value ? { backgroundImage: gradientImage.value } : {}),
}));

const rootStyle = computed<CSSProperties>(() => ({ ...logicStyle.value, ...props.styles?.root }));

/* 语义元素优先于 strong；全 false = span */
const tag = computed(() => {
  if (props.code) return 'code';
  if (props.mark) return 'mark';
  if (props.delete) return 'del';
  if (props.underline) return 'u';
  if (props.strong) return 'b';
  return 'span';
});

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTextRenderScope>(
  () => props.render,
  () => ({
    type: props.type,
    strong: !!props.strong,
    code: !!props.code,
    mark: !!props.mark,
    delete: !!props.delete,
    underline: !!props.underline,
    gradient: props.gradient,
    tag: tag.value,
    rootStyle: logicStyle.value,
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KTextRenderScope): VNodeChild;
}>();
</script>

<style>

.k-text {
  color: inherit;
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}

.k-text--secondary { color: var(--k-color-text-secondary); }
.k-text--tertiary { color: var(--k-color-text-tertiary); }
.k-text--disabled { color: var(--k-color-text-quaternary); cursor: not-allowed; }

/* 渐变文字：hover 浅 → active 深（同族最大明度差档位，10% 的 primary→hover 肉眼看不出渐变）
   双类名特异度 0,2,0：压过 .k-text:is(code/mark) 的 background 简写，防 clip 后文字透明 */
.k-text.k-text--gradient {
  background: linear-gradient(90deg, var(--k-color-primary-hover), var(--k-color-primary-active));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

/* strong = 500（中文原则：不提供 600+ 正文强调） */
.k-text:is(b) { font-weight: var(--k-font-weight-strong); }

.k-text:is(code) {
  margin-inline: 0.2em;
  padding: 0.1em 0.35em;
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-fill-quaternary);
  font-family: var(--k-font-family-code);
  font-size: 0.9em;
}

.k-text:is(mark) {
  padding: 0.05em 0.2em;
  background-color: var(--k-color-warning-bg);
  color: inherit;
}
</style>
