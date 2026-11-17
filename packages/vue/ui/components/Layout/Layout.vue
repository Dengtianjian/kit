<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KLayout' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KLayoutRenderScope {
  hasSider: boolean;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KLayoutProps {
  /** true → 横向（左 Sider 右内容）；不传则按插槽内容判断不了，显式声明 */
  hasSider?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KLayoutRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KLayoutProps>(), { hasSider: false });

const classes = computed(() => ['k-layout', { 'k-layout--has-sider': props.hasSider }]);

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KLayoutRenderScope>(
  () => props.render,
  () => ({ hasSider: props.hasSider, rootAttrs, slots }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KLayoutRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <section v-else data-part="root" :class="[classes, classNames?.root]" :style="styles?.root">
    <slot />
  </section>
</template>

<style>

.k-layout {
  display: flex;
  flex: auto;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
  background: var(--k-color-bg-layout);
}

.k-layout--has-sider { flex-direction: row; }
</style>
