<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    class="k-radio-group"
    :class="[`k-radio-group--${shape}`, { 'k-radio-group--button-connected': shape === 'button' }]"
    v-bind="rootAttrs"
  >
    <KRadio
      v-for="o in normalized"
      :key="String(o.value)"
      :value="o.value"
      :disabled="o.disabled"
      :name="name"
    >
      {{ o.label }}
    </KRadio>
    <slot v-if="!options" />
  </span>
</template>

<script setup lang="ts">
import { computed, inject, provide, useSlots } from 'vue';
import type { VNodeChild } from 'vue';
import KRadio from './Radio.vue';
import { RADIO_GROUP_KEY } from './context';
import type { KRadioOptionInput } from './context';
import { FORM_ITEM_KEY } from '../Form/context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KRadioGroup' });

/** headless scope：#render 插槽 / render prop 闭包参数；provide 注入照跑（headless 组内 KRadio 照常继承） */
export interface KRadioGroupRenderScope {
  /** 归一化后的 options（string → {label, value}）；不传 options 走 slots.default */
  options: { label: string; value: string | number; disabled?: boolean }[];
  shape: 'circle' | 'button';
  disabled: boolean;
  name: string | undefined;
  value: string | number | undefined;
  /** 组选值动作；自绘选项可直接调用 */
  select: (v: string | number) => void;
  /** data-part + role=radiogroup + aria-disabled 语义包 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KRadioGroupProps {
  /** 传 options = 组自渲染清单；不传走默认插槽手写子件 */
  options?: KRadioOptionInput[];
  /** button = RadioButton 拼接段形态（antd optionType="button"） */
  shape?: 'circle' | 'button';
  disabled?: boolean;
  name?: string;
  /** 组根节点 id（缺省取 FormItem 自动 id） */
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KRadioGroupRenderScope>;
}

const props = withDefaults(defineProps<KRadioGroupProps>(), {
  shape: 'circle',
  disabled: false,
});

const model = defineModel<string | number | undefined>({ default: undefined });

function select(v: string | number) {
  model.value = v;
}

provide(RADIO_GROUP_KEY, {
  value: computed(() => model.value),
  disabled: computed(() => props.disabled),
  shape: computed(() => props.shape),
  select,
});

const normalized = computed(() =>
  (props.options ?? []).map((o) => (typeof o === 'string' ? { label: o, value: o } : o)),
);

const formItem = inject(FORM_ITEM_KEY, null);
const rootAttrs = computed(() => ({
  'data-part': 'root',
  role: 'radiogroup',
  'aria-disabled': props.disabled || undefined,
  id: props.id ?? formItem?.controlId,
  tabindex: formItem ? -1 : undefined,
  'aria-labelledby': formItem?.labelId,
  'aria-describedby': formItem?.describedBy.value,
  'aria-invalid': formItem?.invalid.value || undefined,
}));

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KRadioGroupRenderScope>(
  () => props.render,
  () => ({
    options: normalized.value,
    shape: props.shape,
    disabled: props.disabled,
    name: props.name,
    value: model.value,
    select,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KRadioGroupRenderScope): VNodeChild;
}>();
</script>

<style>
.k-radio-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--k-size-sm) var(--k-size);
}
/* button 形态：段间无缝（左边界由相邻段 first/last 规则处理） */
.k-radio-group--button-connected {
  gap: 0;
  flex-wrap: nowrap;
}
</style>
