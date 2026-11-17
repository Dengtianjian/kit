<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KTitle' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KTitleRenderScope {
  level: 1 | 2 | 3 | 4 | 5;
  /** 派生标签名 h1…h5（自绘可 :is 直接消费） */
  tag: string;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KTitleProps {
  level: 1 | 2 | 3 | 4 | 5;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KTitleRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = defineProps<KTitleProps>();

const tag = computed(() => `h${props.level}` as const);

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTitleRenderScope>(
  () => props.render,
  () => ({ level: props.level, tag: tag.value, rootAttrs, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KTitleRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <component
    :is="tag"
    v-else
    data-part="root"
    :class="['k-title', `k-title-${level}`, classNames?.root]"
    :style="styles?.root"
  >
    <slot />
  </component>
</template>

<style>

.k-title {
  margin: 0 0 0.5em;
  color: var(--k-color-text);
  font-weight: var(--k-font-weight-heading);
}

/* 字号 = heading 阶（视觉规则 §3：字阶跳跃，禁止业务自定义插值档） */
.k-title-1 { font-size: var(--k-font-size-heading-1); line-height: var(--k-line-height-heading-1); }
.k-title-2 { font-size: var(--k-font-size-heading-2); line-height: var(--k-line-height-heading-2); }
.k-title-3 { font-size: var(--k-font-size-heading-3); line-height: var(--k-line-height-heading-3); }
.k-title-4 { font-size: var(--k-font-size-heading-4); line-height: var(--k-line-height-heading-4); }
.k-title-5 { font-size: var(--k-font-size-heading-5); line-height: var(--k-line-height-heading-5); }
</style>
