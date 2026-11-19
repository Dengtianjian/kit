<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <label
    v-else
    class="k-radio"
    :class="[
      isButton ? 'k-radio--button' : 'k-radio--circle',
      { 'is-checked': isChecked, 'is-disabled': isDisabled },
      classNames?.root,
    ]"
    :style="styles?.root"
    v-bind="rootAttrs"
  >
    <input
      ref="inputEl"
      class="k-radio__input"
      :class="classNames?.input"
      :style="styles?.input"
      v-bind="inputAttrs"
      v-on="inputOn"
    />
    <template v-if="!isButton">
      <span data-part="dot" class="k-radio__dot" :class="classNames?.dot" :style="styles?.dot" aria-hidden="true"></span>
      <span data-part="text" class="k-radio__text" :class="classNames?.text" :style="styles?.text"><slot /></span>
    </template>
    <span v-else class="k-radio__button-label" :style="styles?.text"><slot /></span>
  </label>
</template>

<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { RADIO_GROUP_KEY } from './context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KRadio' });

type RadioPart = 'root' | 'input' | 'dot' | 'text';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KRadioRenderScope {
  value: string | number | undefined;
  /** 组模式读组 value，standalone 比对 v-model */
  checked: boolean;
  /** disabled || 组 disabled 合成 */
  disabled: boolean;
  /** 组 shape=button 注入的拼接段形态标记 */
  button: boolean;
  name: string | undefined;
  id: string | undefined;
  inputEl: typeof inputEl;
  rootAttrs: Record<string, unknown>;
  /** 原生 input 语义包：type/checked/disabled/name/id */
  inputAttrs: Record<string, unknown>;
  /** change 逻辑包（组 select / 单件写值 + change 事件） */
  inputOn: { change: () => void };
  slots: ReturnType<typeof useSlots>;
}

interface KRadioProps {
  /** 组模式下的选项值（standalone 不传） */
  value?: string | number;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KRadioRenderScope>;
  classNames?: Partial<Record<RadioPart, string>>;
  styles?: Partial<Record<RadioPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KRadioProps>(), { disabled: false });

const emit = defineEmits<{ change: [checked: boolean] }>();

const model = defineModel<string | number | undefined>({ default: undefined });
const group = inject(RADIO_GROUP_KEY, undefined);

const inputEl = ref<HTMLInputElement | null>(null);

const isChecked = computed(() =>
  group && props.value != null
    ? group.value.value === props.value
    : model.value === props.value,
);
const isDisabled = computed(() => props.disabled || (group?.disabled.value ?? false));
const isButton = computed(() => group?.shape.value === 'button');

function onChange() {
  if (group && props.value != null) group.select(props.value);
  else if (props.value != null) model.value = props.value;
  emit('change', true);
}

const rootAttrs = { 'data-part': 'root' };
const inputAttrs = computed(() => ({
  'data-part': 'input',
  type: 'radio',
  checked: isChecked.value,
  disabled: isDisabled.value || undefined,
  name: props.name,
  id: props.id,
}));
const inputOn = { change: onChange };

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KRadioRenderScope>(
  () => props.render,
  () => ({
    value: props.value,
    checked: isChecked.value,
    disabled: isDisabled.value,
    button: isButton.value,
    name: props.name,
    id: props.id,
    inputEl,
    rootAttrs,
    inputAttrs: inputAttrs.value,
    inputOn,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KRadioRenderScope): VNodeChild;
}>();

defineExpose({ inputEl, focus: () => inputEl.value?.focus() });
</script>

<style>
.k-radio {
  --k-radio-dot-size: var(--k-size);
  --k-radio-border: var(--k-color-border);
  --k-radio-hover-border: var(--k-color-primary-hover);
  --k-radio-checked-border: var(--k-color-primary);
  --k-radio-inner: var(--k-color-primary);
  --k-radio-text-color: var(--k-color-text);
  --k-radio-outline: var(--k-control-outline);
  --k-radio-outline-width: var(--k-control-outline-width);

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  cursor: pointer;
  font-size: var(--k-input-font-size);
  color: var(--k-radio-text-color);
}
.k-radio__input {
  position: absolute;
  width: 0;
  height: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
.k-radio__dot {
  position: relative;
  flex: none;
  width: var(--k-radio-dot-size);
  height: var(--k-radio-dot-size);
  border: var(--k-line-width) solid var(--k-radio-border);
  border-radius: var(--k-border-radius-full);
  background-color: var(--k-color-bg-container);
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-radio__dot::after {
  content: '';
  position: absolute;
  /* 默认 16px 环 → 内点 8×8 @ 3px 整偏移（antd 同比例）；纯 25% 会得 7px @ 3.5px 半像素，
     栅格化把环隙舍入成 3/4 不对称 → 视觉偏芯 */
  inset: calc(25% - 0.5px);
  border-radius: inherit;
  background-color: var(--k-radio-inner);
  transform: scale(0);
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-radio.is-checked .k-radio__dot {
  border-color: var(--k-radio-checked-border);
}
.k-radio.is-checked .k-radio__dot::after {
  transform: scale(1);
}
.k-radio:not(.is-disabled):hover .k-radio__dot {
  border-color: var(--k-radio-hover-border);
}
.k-radio__input:focus-visible + .k-radio__dot {
  box-shadow: 0 0 0 var(--k-radio-outline-width) var(--k-radio-outline);
}

/* ---------- button 形态（antd RadioButton：拼接段，选中=主色描边主色字） ---------- */
.k-radio--button {
  position: relative;
  gap: 0;
  padding: 0 var(--k-radio-btn-padding-x, var(--k-size));
  min-height: var(--k-control-height);
  border: var(--k-line-width) solid var(--k-radio-border);
  border-left-width: 0;
  background-color: var(--k-color-bg-container);
  transition:
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
/* 左边界替身（antd 同款 ::before）：段自身 border-left 为 0，左缘像素归前段右边框所有，
   选中段描边染不到左缘 → 用贴左侧 1px 竖条补上，高度含上下边框行才能与选中上下边连成整框 */
.k-radio--button::before {
  content: '';
  position: absolute;
  top: calc(var(--k-line-width) * -1);
  left: calc(var(--k-line-width) * -1);
  width: var(--k-line-width);
  height: calc(100% + var(--k-line-width) * 2);
  background-color: var(--k-radio-border);
  transition: background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-radio--button:first-child {
  border-left-width: var(--k-line-width);
  border-radius: var(--k-border-radius) 0 0 var(--k-border-radius);
}
.k-radio--button:first-child::before,
.k-radio--button:only-child::before {
  display: none;
}
.k-radio--button:last-child {
  border-radius: 0 var(--k-border-radius) var(--k-border-radius) 0;
}
.k-radio--button:only-child {
  border-radius: var(--k-border-radius);
  border-left-width: var(--k-line-width);
}
.k-radio--button.is-checked {
  color: var(--k-color-primary);
  border-color: var(--k-radio-checked-border);
  z-index: 1; /* 选中段描边压住相邻段边线 */
}
.k-radio--button.is-checked::before {
  background-color: var(--k-radio-checked-border);
}
.k-radio--button:not(.is-disabled):hover {
  color: var(--k-color-primary-hover);
}
.k-radio--button.is-checked:not(.is-disabled):hover {
  color: var(--k-color-primary-hover);
}
.k-radio--button:has(.k-radio__input:focus-visible) {
  box-shadow: 0 0 0 var(--k-radio-outline-width) var(--k-radio-outline);
  z-index: 2;
}
.k-radio--button.is-disabled {
  cursor: not-allowed;
  color: var(--k-color-text-quaternary);
  background-color: var(--k-color-fill-tertiary);
}

.k-radio.is-disabled {
  cursor: not-allowed;
  color: var(--k-color-text-quaternary);
}
.k-radio.is-disabled .k-radio__dot {
  background-color: var(--k-color-fill-tertiary);
}
.k-radio.is-disabled.is-checked .k-radio__dot {
  border-color: var(--k-color-border);
}
.k-radio.is-disabled.is-checked .k-radio__dot::after {
  background-color: var(--k-color-text-quaternary);
}
/* 按压遮罩豁免：同输入族 */

@media (hover: none) {
  .k-radio {
    min-height: 44px;
  }
}
</style>
