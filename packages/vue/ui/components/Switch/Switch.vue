<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <button
    v-else
    ref="rootEl"
    class="k-switch"
    :class="[
      `k-switch--${size}`,
      { 'is-checked': checked, 'is-disabled': isDisabled, 'is-loading': loading },
      classNames?.root,
    ]"
    :style="styles?.root"
    v-bind="rootAttrs"
    v-on="rootOn"
  >
    <span class="k-switch__inner" aria-hidden="true">
      <template v-if="checked">{{ checkedChildren }}</template>
      <template v-else>{{ unCheckedChildren }}</template>
    </span>
    <span data-part="handle" class="k-switch__handle" :class="classNames?.handle" :style="styles?.handle">
      <svg
        v-if="loading"
        class="k-switch__spinner"
        viewBox="0 0 12 12"
        width="0.72em"
        height="0.72em"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="4.5" stroke-dasharray="18 8" />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { FORM_ITEM_KEY } from '../Form/context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KSwitch' });

type SwitchPart = 'root' | 'handle';
type SwitchSize = 'large' | 'medium' | 'small';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KSwitchRenderScope {
  size: SwitchSize;
  checked: boolean;
  /** disabled || loading 合成后的不可交互态 */
  disabled: boolean;
  loading: boolean;
  checkedChildren: string | undefined;
  unCheckedChildren: string | undefined;
  id: string | undefined;
  name: string | undefined;
  rootEl: typeof rootEl;
  /** role=switch + type/aria-checked/aria-disabled/disabled/id/name 语义包 */
  rootAttrs: Record<string, unknown>;
  /** click/keydown（Enter/Space）逻辑包；v-on spread 即继承开合 */
  rootOn: { click: () => void; keydown: (e: KeyboardEvent) => void };
  /** 开合动作（含 disabled/loading 拦截 + change 事件） */
  toggle: () => void;
  focus: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KSwitchProps {
  /** 轨道尺寸：large（68×30）/ medium（52×26）/ small（38×20）；无四轴 type/variant，开关只有开合 */
  size?: SwitchSize;
  disabled?: boolean;
  /** 加载中：不可交互 + 把手位显 spinner（反馈批前内建最小 spinner，同 KInput 图标路数） */
  loading?: boolean;
  /** 开/关态内嵌文字（antd checkedChildren/unCheckedChildren） */
  checkedChildren?: string;
  unCheckedChildren?: string;
  id?: string;
  name?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KSwitchRenderScope>;
  classNames?: Partial<Record<SwitchPart, string>>;
  styles?: Partial<Record<SwitchPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSwitchProps>(), {
  size: 'medium',
  disabled: false,
  loading: false,
});

const emit = defineEmits<{ change: [checked: boolean] }>();

const model = defineModel<boolean>({ default: false });

const rootEl = ref<HTMLElement | null>(null);
const formItem = inject(FORM_ITEM_KEY, null);
const checked = computed(() => model.value === true);
const isDisabled = computed(() => props.disabled || props.loading);

function toggle() {
  if (isDisabled.value) return;
  model.value = !checked.value;
  emit('change', model.value);
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggle();
  }
}

function focus() {
  rootEl.value?.focus();
}

const rootAttrs = computed(() => ({
  'data-part': 'root',
  type: 'button',
  role: 'switch',
  'aria-checked': checked.value,
  'aria-disabled': isDisabled.value || undefined,
  disabled: isDisabled.value || undefined,
  id: props.id ?? formItem?.controlId,
  name: props.name,
  'aria-describedby': formItem?.describedBy.value,
  'aria-invalid': formItem?.invalid.value || undefined,
}));
const rootOn = { click: toggle, keydown: onKeydown };

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KSwitchRenderScope>(
  () => props.render,
  () => ({
    size: props.size,
    checked: checked.value,
    disabled: isDisabled.value,
    loading: props.loading,
    checkedChildren: props.checkedChildren,
    unCheckedChildren: props.unCheckedChildren,
    id: props.id,
    name: props.name,
    rootEl,
    rootAttrs: rootAttrs.value,
    rootOn,
    toggle,
    focus,
    slots,
  }),
);

defineSlots<{
  render?(scope: KSwitchRenderScope): VNodeChild;
}>();

defineExpose({ focus });
</script>

<style>
.k-switch {
  /* medium 52×26；large 68×30；small 38×20 */
  --k-switch-track-width: calc(var(--k-control-height-xs) * 1.75);
  --k-switch-track-height: calc(var(--k-control-height-xs) - 4px);
  --k-switch-track-width-lg: calc(var(--k-control-height-xs) * 2 + 8px);
  --k-switch-track-height-lg: var(--k-control-height-xs);
  --k-switch-track-width-sm: calc(var(--k-control-height-xs) + 8px);
  --k-switch-track-height-sm: calc(var(--k-control-height-xs) - 10px);
  --k-switch-on-bg: var(--k-color-primary);
  --k-switch-off-bg: var(--k-color-text-quaternary);
  --k-switch-disabled-on-bg: color-mix(in oklab, var(--k-color-primary) 50%, var(--k-mix-onto));
  --k-switch-disabled-off-bg: var(--k-color-fill-secondary);
  --k-switch-handle-bg: var(--k-color-bg-container);
  --k-switch-text-color: var(--k-color-text-light-solid);
  --k-switch-outline: var(--k-control-outline);
  --k-switch-outline-width: var(--k-control-outline-width);

  position: relative;
  display: inline-flex;
  align-items: center;
  flex: none;
  width: var(--k-switch-track-width);
  height: var(--k-switch-track-height);
  padding: 0;
  border: none;
  border-radius: var(--k-border-radius-full);
  background-color: var(--k-switch-off-bg);
  cursor: pointer;
  font-family: inherit;
  transition: background-color var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-switch--large {
  width: var(--k-switch-track-width-lg);
  height: var(--k-switch-track-height-lg);
}
.k-switch--small {
  width: var(--k-switch-track-width-sm);
  height: var(--k-switch-track-height-sm);
}
.k-switch.is-checked {
  background-color: var(--k-switch-on-bg);
}
.k-switch.is-disabled {
  cursor: not-allowed;
}
.k-switch.is-disabled.is-checked {
  background-color: var(--k-switch-disabled-on-bg);
}
.k-switch.is-disabled:not(.is-checked) {
  background-color: var(--k-switch-disabled-off-bg);
}
.k-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--k-switch-outline-width) var(--k-switch-outline);
}

.k-switch__handle {
  position: absolute;
  left: 2px;
  top: 2px;
  width: calc(var(--k-switch-track-height) - 4px);
  height: calc(var(--k-switch-track-height) - 4px);
  border-radius: var(--k-border-radius-full);
  background-color: var(--k-switch-handle-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--k-box-shadow-tertiary);
  transition:
    left var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    width var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-switch.is-checked .k-switch__handle {
  left: calc(var(--k-switch-track-width) - (var(--k-switch-track-height) - 4px) - 2px);
}
.k-switch--large .k-switch__handle {
  width: calc(var(--k-switch-track-height-lg) - 4px);
  height: calc(var(--k-switch-track-height-lg) - 4px);
}
.k-switch--large.is-checked .k-switch__handle {
  left: calc(var(--k-switch-track-width-lg) - (var(--k-switch-track-height-lg) - 4px) - 2px);
}
.k-switch--small .k-switch__handle {
  width: calc(var(--k-switch-track-height-sm) - 4px);
  height: calc(var(--k-switch-track-height-sm) - 4px);
}
.k-switch--small.is-checked .k-switch__handle {
  left: calc(var(--k-switch-track-width-sm) - (var(--k-switch-track-height-sm) - 4px) - 2px);
}

/* 按压拉长：把手向对侧伸长 4px，贴住的那条边保持不动 */
.k-switch:not(.is-disabled):active .k-switch__handle {
  width: var(--k-switch-track-height);
}
.k-switch.is-checked:not(.is-disabled):active .k-switch__handle {
  left: calc(var(--k-switch-track-width) - var(--k-switch-track-height) - 2px);
}
.k-switch--large:not(.is-disabled):active .k-switch__handle {
  width: var(--k-switch-track-height-lg);
}
.k-switch--large.is-checked:not(.is-disabled):active .k-switch__handle {
  left: calc(var(--k-switch-track-width-lg) - var(--k-switch-track-height-lg) - 2px);
}
.k-switch--small:not(.is-disabled):active .k-switch__handle {
  width: var(--k-switch-track-height-sm);
}
.k-switch--small.is-checked:not(.is-disabled):active .k-switch__handle {
  left: calc(var(--k-switch-track-width-sm) - var(--k-switch-track-height-sm) - 2px);
}

.k-switch__inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  /* 文字居中于「边框 ↔ 把手」之间的剩余区域 */
  padding: 0 2px;
  color: var(--k-switch-text-color);
  font-size: var(--k-font-size-sm);
  white-space: nowrap;
  justify-content: center;
}
.k-switch.is-checked .k-switch__inner {
  padding-inline-end: var(--k-switch-track-height);
}
.k-switch:not(.is-checked) .k-switch__inner {
  padding-inline-start: var(--k-switch-track-height);
}
.k-switch--large.is-checked .k-switch__inner {
  padding-inline-end: var(--k-switch-track-height-lg);
}
.k-switch--large:not(.is-checked) .k-switch__inner {
  padding-inline-start: var(--k-switch-track-height-lg);
}
.k-switch--small.is-checked .k-switch__inner {
  padding-inline-end: var(--k-switch-track-height-sm);
}
.k-switch--small:not(.is-checked) .k-switch__inner {
  padding-inline-start: var(--k-switch-track-height-sm);
}

.k-switch__spinner {
  color: var(--k-color-text-tertiary);
  animation: k-switch-spin var(--k-motion-duration-spin) linear infinite;
}
@keyframes k-switch-spin {
  to { transform: rotate(360deg); }
}
/* 按压遮罩豁免：同输入族（按压语义 = 开合触发，Button 黑罩不适用） */

@media (hover: none) {
  /* 触屏扩大命中区（视觉轨道不变） */
  .k-switch::after {
    content: '';
    position: absolute;
    inset: -10px;
  }
}
</style>
