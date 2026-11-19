<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    v-bind="rootAttrs"
    class="k-control-group__item"
    :class="classNames?.root"
    :style="styles?.root"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KControlGroupItem' });

/** 控件组内的通用外壳：给无边框控件（Checkbox/Radio/Switch）或纯文字补输入框同款外壳，参与首尾圆角拼接 */
export interface KControlGroupItemRenderScope {
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KControlGroupItemProps {
  /** 自定义渲染闭包（#render 插槽优先） */
  render?: KRenderFn<KControlGroupItemRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = defineProps<KControlGroupItemProps>();

const slots = useSlots();

const rootAttrs = { 'data-part': 'item' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KControlGroupItemRenderScope>(
  () => props.render,
  () => ({
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KControlGroupItemRenderScope): VNodeChild;
}>();
</script>

<style>
.k-control-group__item {
  --k-control-group-item-height: var(--k-control-height);
  --k-control-group-item-padding-x: var(--k-size);
  --k-control-group-item-radius: var(--k-border-radius);
  --k-control-group-item-bg: var(--k-color-bg-container);
  --k-control-group-item-border-color: var(--k-color-border);
  --k-control-group-item-border-width: var(--k-line-width);
  --k-control-group-item-text-color: var(--k-color-text);

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  box-sizing: border-box;
  min-height: var(--k-control-group-item-height);
  padding: 0 var(--k-control-group-item-padding-x);
  background-color: var(--k-control-group-item-bg);
  border: var(--k-control-group-item-border-width) solid var(--k-control-group-item-border-color);
  border-radius: var(--k-control-group-item-radius);
  color: var(--k-control-group-item-text-color);
  font-family: inherit;
  font-size: var(--k-input-font-size, var(--k-font-size));
  line-height: var(--k-line-height);
  white-space: nowrap;
}
.k-control-group__item *,
.k-control-group__item *::before,
.k-control-group__item *::after {
  box-sizing: border-box;
}
</style>