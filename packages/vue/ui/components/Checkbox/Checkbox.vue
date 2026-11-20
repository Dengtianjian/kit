<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <label
    v-else
    class="k-checkbox"
    :class="[{ 'is-checked': isChecked, 'is-indeterminate': indeterminate, 'is-disabled': isDisabled }, classNames?.root]"
    :style="styles?.root"
    v-bind="rootAttrs"
  >
    <input
      ref="inputEl"
      class="k-checkbox__input"
      :class="classNames?.input"
      :style="styles?.input"
      v-bind="inputAttrs"
      v-on="inputOn"
    />
    <span data-part="box" class="k-checkbox__box" :class="classNames?.box" :style="styles?.box" aria-hidden="true"></span>
    <span data-part="text" class="k-checkbox__text" :class="classNames?.text" :style="styles?.text"><slot /></span>
  </label>
</template>

<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { CHECKBOX_GROUP_KEY } from './context';
import { FORM_ITEM_KEY } from '../Form/context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KCheckbox' });

type CheckboxPart = 'root' | 'input' | 'box' | 'text';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KCheckboxRenderScope {
  value: string | number | undefined;
  indeterminate: boolean;
  /** 组模式读组 values，standalone 读 v-model */
  checked: boolean;
  /** disabled || 组 disabled 合成 */
  disabled: boolean;
  required: boolean | undefined;
  name: string | undefined;
  id: string | undefined;
  inputEl: typeof inputEl;
  rootAttrs: Record<string, unknown>;
  /** 原生 input 语义包：type/checked/disabled/required/name/id/indeterminate */
  inputAttrs: Record<string, unknown>;
  /** change 逻辑包（读 event.target.checked，组/单件写值 + change 事件） */
  inputOn: { change: (e: Event) => void };
  slots: ReturnType<typeof useSlots>;
}

interface KCheckboxProps {
  /** 组模式下的选项值（standalone 不传） */
  value?: string | number;
  /** 半选视觉（组/单件均可用；状态由调用方管理，antd 同语义） */
  indeterminate?: boolean;
  disabled?: boolean;
  /** 原生 required（仅 standalone） */
  required?: boolean;
  name?: string;
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KCheckboxRenderScope>;
  classNames?: Partial<Record<CheckboxPart, string>>;
  styles?: Partial<Record<CheckboxPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KCheckboxProps>(), {
  indeterminate: false,
  disabled: false,
});

const emit = defineEmits<{ change: [checked: boolean] }>();

const model = defineModel<boolean>({ default: undefined });
const group = inject(CHECKBOX_GROUP_KEY, undefined);
const formItem = inject(FORM_ITEM_KEY, null);

const inputEl = ref<HTMLInputElement | null>(null);

const isChecked = computed(() => {
  if (group && props.value != null) return group.values.value.includes(props.value);
  return model.value === true;
});
const isDisabled = computed(() => props.disabled || (group?.disabled.value ?? false));

function onChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  if (group && props.value != null) group.toggle(props.value, checked);
  else model.value = checked;
  emit('change', checked);
}

const rootAttrs = { 'data-part': 'root' };
const inputAttrs = computed(() => ({
  'data-part': 'input',
  type: 'checkbox',
  checked: isChecked.value,
  disabled: isDisabled.value || undefined,
  required: props.required || undefined,
  name: props.name,
  // 组内由 KCheckboxGroup 承载 FormItem 关联，避免每个选项复用同一个 id
  id: props.id ?? (group ? undefined : formItem?.controlId),
  'aria-invalid': (group ? null : formItem?.invalid.value) || undefined,
  'aria-describedby': group ? undefined : formItem?.describedBy.value,
  indeterminate: props.indeterminate && !isChecked.value,
}));
const inputOn = { change: onChange };

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KCheckboxRenderScope>(
  () => props.render,
  () => ({
    value: props.value,
    indeterminate: props.indeterminate,
    checked: isChecked.value,
    disabled: isDisabled.value,
    required: props.required,
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
  render?(scope: KCheckboxRenderScope): VNodeChild;
}>();

defineExpose({ inputEl, focus: () => inputEl.value?.focus() });
</script>

<style>
.k-checkbox {
  --k-checkbox-box-size: var(--k-size);
  --k-checkbox-radius: var(--k-border-radius-xs);
  --k-checkbox-border: var(--k-color-border);
  --k-checkbox-hover-border: var(--k-color-primary-hover);
  --k-checkbox-checked-bg: var(--k-color-primary);
  --k-checkbox-checked-border: var(--k-color-primary);
  --k-checkbox-solid-color: var(--k-color-text-light-solid);
  --k-checkbox-disabled-bg: var(--k-color-fill-tertiary);
  --k-checkbox-disabled-border: var(--k-color-border);
  --k-checkbox-text-color: var(--k-color-text);
  --k-checkbox-outline: var(--k-control-outline);
  --k-checkbox-outline-width: var(--k-control-outline-width);

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  cursor: pointer;
  font-size: var(--k-input-font-size);
  color: var(--k-checkbox-text-color);
}
.k-checkbox__input {
  position: absolute;
  width: 0;
  height: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
.k-checkbox__box {
  position: relative;
  flex: none;
  width: var(--k-checkbox-box-size);
  height: var(--k-checkbox-box-size);
  border: var(--k-line-width) solid var(--k-checkbox-border);
  border-radius: var(--k-checkbox-radius);
  background-color: var(--k-color-bg-container);
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
/* 勾 = 右下半边框旋转 45°（无图标依赖路数，同 KInput 清除件）。
   translate 必须写在 rotate 左侧（未旋转坐标系位移）：勾的墨迹（右+下边框）旋转后视觉中心
   比元素几何中心低约 7% 元素高，-57% 上移补偿；旧写法 rotate 后再 translate 会沿旋转轴位移 → 偏左 */
.k-checkbox__box::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 25%;
  height: 52%;
  border: 2px solid var(--k-checkbox-solid-color);
  border-top: none;
  border-left: none;
  transform: translate(-50%, -57%) rotate(45deg) scale(0);
  transform-origin: center;
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-checkbox.is-checked .k-checkbox__box {
  background-color: var(--k-checkbox-checked-bg);
  border-color: var(--k-checkbox-checked-border);
}
.k-checkbox.is-checked .k-checkbox__box::after {
  transform: translate(-50%, -57%) rotate(45deg) scale(1);
}
/* 半选 = 居中横条（勾隐藏） */
.k-checkbox.is-indeterminate .k-checkbox__box {
  background-color: var(--k-checkbox-checked-bg);
  border-color: var(--k-checkbox-checked-border);
}
.k-checkbox.is-indeterminate .k-checkbox__box::before {
  content: '';
  position: absolute;
  inset: 42% 18%;
  background-color: var(--k-checkbox-solid-color);
}
.k-checkbox.is-indeterminate.is-checked .k-checkbox__box::after {
  transform: translate(-50%, -57%) rotate(45deg) scale(0);
}
.k-checkbox:not(.is-disabled) .k-checkbox__input:hover + .k-checkbox__box,
.k-checkbox:not(.is-disabled):hover .k-checkbox__box {
  border-color: var(--k-checkbox-hover-border);
}
.k-checkbox:not(.is-disabled) .k-checkbox__input:focus-visible + .k-checkbox__box {
  box-shadow: 0 0 0 var(--k-checkbox-outline-width) var(--k-checkbox-outline);
}
.k-checkbox.is-disabled {
  cursor: not-allowed;
}
.k-checkbox.is-disabled .k-checkbox__box {
  background-color: var(--k-checkbox-disabled-bg);
  border-color: var(--k-checkbox-disabled-border);
}
.k-checkbox.is-disabled.is-checked .k-checkbox__box,
.k-checkbox.is-disabled.is-indeterminate .k-checkbox__box {
  background-color: var(--k-color-text-quaternary);
  border-color: var(--k-checkbox-disabled-border);
}
.k-checkbox.is-disabled .k-checkbox__text {
  color: var(--k-color-text-quaternary);
}
/* 按压遮罩豁免：选择件按压语义 = 勾选，同输入族不加 hover:none 黑罩 */

@media (hover: none) {
  .k-checkbox {
    min-height: 44px;
  }
}
</style>
