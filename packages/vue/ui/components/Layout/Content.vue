<script setup lang="ts">
import { useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KLayoutContent' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KLayoutContentRenderScope {
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KLayoutContentProps {
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KLayoutContentRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = defineProps<KLayoutContentProps>();

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KLayoutContentRenderScope>(
  () => props.render,
  () => ({ rootAttrs, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KLayoutContentRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <main v-else data-part="root" :class="['k-layout-content', classNames?.root]" :style="styles?.root">
    <slot />
  </main>
</template>

<style>

.k-layout-content {
  flex: auto;
  min-height: 0;
  box-sizing: border-box;
  overflow: auto;
  background: transparent;
}
</style>
