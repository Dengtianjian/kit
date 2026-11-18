<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import KInput from '../Input/Input.vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KInputNumber' });

type NumberPart = 'root' | 'input' | 'step';
type NumberStatus = 'error' | 'warning';

/** headless scope：#render 插槽 / render prop 闭包参数；文本态/数值态分离逻辑全在动作包里 */
export interface KInputNumberRenderScope {
  size: 'xs' | 'sm' | 'md' | 'lg';
  variant: 'outlined' | 'filled' | 'borderless' | 'underlined';
  status: NumberStatus | undefined;
  min: number | undefined;
  max: number | undefined;
  step: number;
  /** precision ?? step 小数位 */
  precision: number;
  placeholder: string | undefined;
  disabled: boolean | undefined;
  readonly: boolean | undefined;
  controls: boolean;
  id: string | undefined;
  /** 数值态（v-model） */
  value: number | null;
  /** 文本态（输入中间态 "1."、"-" 不回填）；自绘输入框绑它 */
  text: string;
  /** controls && 可交互 的合成显隐 */
  showStep: boolean;
  inputRef: typeof inputRef;
  rootAttrs: Record<string, unknown>;
  /** 写文本态（打字即同步 model 的 watcher 照跑） */
  setText: (t: string) => void;
  /** 落定：解析/限幅/格式化 + change 事件 */
  onCommit: () => void;
  onFocus: (e: FocusEvent) => void;
  /** 落定 + blur 事件（自绘输入框 @blur 绑它） */
  onBlur: (e: FocusEvent) => void;
  stepUp: () => void;
  stepDown: () => void;
  /** ArrowUp/Down 步进（自绘输入框 @keydown 绑它） */
  onKeydown: (e: KeyboardEvent) => void;
  focus: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KInputNumberProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  status?: NumberStatus;
  variant?: 'outlined' | 'filled' | 'borderless' | 'underlined';
  min?: number;
  max?: number;
  /** 步进，默认 1；precision 缺省跟随 step 小数位 */
  step?: number;
  precision?: number;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  /** 右侧步进列开关（antd controls 语义） */
  controls?: boolean;
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KInputNumberRenderScope>;
  classNames?: Partial<Record<NumberPart, string>>;
  styles?: Partial<Record<NumberPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KInputNumberProps>(), {
  size: 'md',
  variant: 'outlined',
  step: 1,
  controls: true,
});

const emit = defineEmits<{
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  change: [value: number | null];
}>();

const model = defineModel<number | null>({ default: null });

/* 文本态与数值态分离：输入中间态（"1."、"-"）不强制回填，落定（blur/step/外部赋值）才格式化 */
const text = ref(model.value == null ? '' : String(model.value));
const inputRef = ref<InstanceType<typeof KInput> | null>(null);

const resolvedPrecision = computed(() => {
  if (props.precision != null) return props.precision;
  const s = String(props.step);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.slice(dot + 1).length;
});

function format(v: number): string {
  return v.toFixed(resolvedPrecision.value);
}
function clamp(v: number): number {
  if (props.min != null && v < props.min) return props.min;
  if (props.max != null && v > props.max) return props.max;
  return v;
}
function parse(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.eE+-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '+' || !Number.isFinite(Number(cleaned)))
    return null;
  return Number(cleaned);
}

/* 打字即同步：可解析就更新 model；model watcher 的等值短路防回环 */
watch(text, (t) => {
  if (t.trim() === '') model.value = null;
  else {
    const n = parse(t);
    if (n != null) model.value = n;
  }
});
watch(model, (v) => {
  if (v == null) text.value = '';
  else if (v !== Number(text.value)) text.value = format(v);
});

function setText(t: string) {
  text.value = t;
}
function onCommit() {
  const n = parse(text.value);
  if (n == null) {
    text.value = model.value == null ? '' : format(model.value);
    emit('change', model.value);
    return;
  }
  const next = clamp(n);
  if (next !== model.value || text.value !== format(next)) {
    model.value = next;
    text.value = format(next);
  }
  emit('change', next);
}
function onFocus(e: FocusEvent) {
  emit('focus', e);
}
function onBlur(e: FocusEvent) {
  onCommit();
  emit('blur', e);
}
function stepBy(dir: 1 | -1) {
  if (props.disabled || props.readonly) return;
  const base = model.value ?? 0;
  const raw = dir > 0 ? base + props.step : base - props.step;
  // 浮点残差（0.1+0.2）先按宽精度归位，再限幅
  const next = clamp(Number(raw.toFixed(Math.max(resolvedPrecision.value, 10))));
  model.value = next;
  text.value = format(next);
  emit('change', next);
  inputRef.value?.focus();
}
function stepUp() {
  stepBy(1);
}
function stepDown() {
  stepBy(-1);
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    stepBy(1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    stepBy(-1);
  }
}
function focus() {
  inputRef.value?.focus();
}

const showStep = computed(() => props.controls && !props.disabled && !props.readonly);

const rootAttrs = { 'data-part': 'root' };
const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KInputNumberRenderScope>(
  () => props.render,
  () => ({
    size: props.size,
    variant: props.variant,
    status: props.status,
    min: props.min,
    max: props.max,
    step: props.step,
    precision: resolvedPrecision.value,
    placeholder: props.placeholder,
    disabled: props.disabled,
    readonly: props.readonly,
    controls: props.controls,
    id: props.id,
    value: model.value,
    text: text.value,
    showStep: showStep.value,
    inputRef,
    rootAttrs,
    setText,
    onCommit,
    onFocus,
    onBlur,
    stepUp,
    stepDown,
    onKeydown,
    focus,
    slots,
  }),
);

defineSlots<{
  render?(scope: KInputNumberRenderScope): VNodeChild;
}>();

defineExpose({
  focus,
  inputEl: () => (inputRef.value as unknown as { inputEl?: HTMLInputElement } | null)?.inputEl,
});
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    class="k-input-number"
    :class="[{ 'k-input-number--controls': showStep }, classNames?.root]"
    :style="styles?.root"
    v-bind="rootAttrs"
  >
    <KInput
      ref="inputRef"
      v-model="text"
      class="k-input-number__inner"
      :class="classNames?.input"
      :style="styles?.input"
      :size="size"
      :variant="variant"
      :status="status"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :id="id"
      inputmode="decimal"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <span
      v-if="showStep"
      data-part="step"
      class="k-input-number__step"
      :class="classNames?.step"
      :style="styles?.step"
    >
      <button
        type="button"
        aria-label="增加"
        tabindex="-1"
        @mousedown.prevent="stepUp"
      >
        <svg viewBox="0 0 10 6" width="1em" height="0.6em" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 5l4-4 4 4" /></svg>
      </button>
      <button
        type="button"
        aria-label="减少"
        tabindex="-1"
        @mousedown.prevent="stepDown"
      >
        <svg viewBox="0 0 10 6" width="1em" height="0.6em" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
      </button>
    </span>
  </span>
</template>

<style>
/* ---------- 组合件：输入框视觉全走 KInput 部件变量，本组件只立步进列变量 ---------- */
.k-input-number {
  --k-input-number-step-width: calc(var(--k-font-size) * 1.7);
  --k-input-number-step-icon-color: var(--k-color-text-tertiary);
  --k-input-number-step-icon-hover: var(--k-color-text);
  --k-input-number-step-hover-bg: var(--k-color-fill-tertiary);
  --k-input-number-step-active-bg: var(--k-color-fill-secondary);
  --k-input-number-step-divider: var(--k-color-split);

  position: relative;
  display: inline-flex;
  width: 100%;
  min-width: 0;
}
.k-input-number .k-input-number__inner {
  width: 100%;
}
/* 让位步进列：只在有步进时改内边距（特异性 (0,2,0) > .k-input 基线，不动 KInput 源码） */
.k-input-number--controls .k-input {
  padding-right: calc(var(--k-input-number-step-width) + var(--k-input-padding-x));
}

.k-input-number__step {
  position: absolute;
  top: var(--k-line-width);
  right: var(--k-line-width);
  bottom: var(--k-line-width);
  display: flex;
  flex-direction: column;
  width: var(--k-input-number-step-width);
  border-left: var(--k-line-width) solid var(--k-input-number-step-divider);
}
.k-input-number__step button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--k-input-number-step-icon-color);
  font-size: var(--k-font-size-sm);
  cursor: pointer;
  user-select: none;
}
.k-input-number__step button + button {
  border-top: var(--k-line-width) solid var(--k-input-number-step-divider);
}
.k-input-number__step button:hover {
  color: var(--k-input-number-step-icon-hover);
  background-color: var(--k-input-number-step-hover-bg);
}
.k-input-number__step button:active {
  background-color: var(--k-input-number-step-active-bg);
}
/* borderless 无框时步进列不垫左边线（对齐 KInput 透明框语义） */
.k-input-number .k-input--borderless ~ .k-input-number__step {
  border-left: none;
}

@media (hover: none) {
  /* 触屏步进按钮纵向命中区不足：收起步进列，改用数字键盘输入（inputmode=decimal） */
  .k-input-number__step {
    display: none;
  }
  .k-input-number--controls .k-input {
    padding-right: var(--k-input-padding-x);
  }
}
</style>