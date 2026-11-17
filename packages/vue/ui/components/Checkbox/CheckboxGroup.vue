<script setup lang="ts">
import { computed, provide, useSlots } from 'vue';
import type { VNodeChild } from 'vue';
import KCheckbox from './Checkbox.vue';
import { CHECKBOX_GROUP_KEY } from './context';
import type { KCheckboxOptionInput } from './types';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KCheckboxGroup' });

/** headless scope：#render 插槽 / render prop 闭包参数；provide 注入照跑（headless 组内 KCheckbox 照常继承） */
export interface KCheckboxGroupRenderScope {
  /** 归一化后的 options（string → {label, value}）；不传 options 走 slots.default */
  options: { label: string; value: string | number; disabled?: boolean }[];
  disabled: boolean;
  values: (string | number)[];
  /** 组写值动作（Set 去重）；自绘选项可直接调用 */
  toggle: (v: string | number, on: boolean) => void;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KCheckboxGroupProps {
  /** 传 options = 组自渲染清单；不传走默认插槽手写子件（两形态共用同一 context） */
  options?: KCheckboxOptionInput[];
  disabled?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KCheckboxGroupRenderScope>;
}

const props = withDefaults(defineProps<KCheckboxGroupProps>(), { disabled: false });

const model = defineModel<(string | number)[]>({ default: () => [] });

const values = computed(() => model.value ?? []);
function toggle(v: string | number, on: boolean) {
  const set = new Set(values.value);
  on ? set.add(v) : set.delete(v);
  model.value = [...set];
}

provide(CHECKBOX_GROUP_KEY, { values, disabled: computed(() => props.disabled), toggle });

const normalized = computed(() =>
  (props.options ?? []).map((o) => (typeof o === 'string' ? { label: o, value: o } : o)),
);

const rootAttrs = { 'data-part': 'root' };
const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KCheckboxGroupRenderScope>(
  () => props.render,
  () => ({
    options: normalized.value,
    disabled: props.disabled,
    values: values.value,
    toggle,
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KCheckboxGroupRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span v-else class="k-checkbox-group" :class="$attrs.class" v-bind="rootAttrs">
    <KCheckbox v-for="o in normalized" :key="String(o.value)" :value="o.value" :disabled="o.disabled">
      {{ o.label }}
    </KCheckbox>
    <slot v-if="!options" />
  </span>
</template>

<style>
.k-checkbox-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--k-size-sm) var(--k-size);
}
</style>
