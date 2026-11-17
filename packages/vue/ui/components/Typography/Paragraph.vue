<script setup lang="ts">
import { useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KParagraph' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KParagraphRenderScope {
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KParagraphProps {
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KParagraphRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = defineProps<KParagraphProps>();

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KParagraphRenderScope>(
  () => props.render,
  () => ({ rootAttrs, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KParagraphRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <p v-else data-part="root" :class="['k-paragraph', classNames?.root]" :style="styles?.root">
    <slot />
  </p>
</template>

<style>

.k-paragraph {
  margin: 0 0 1em;
  color: var(--k-color-text);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}
</style>
