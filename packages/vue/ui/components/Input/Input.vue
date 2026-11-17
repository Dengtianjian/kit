<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue';
import { FORM_ITEM_KEY } from '../Form/context';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KInput' });

type InputPart = 'root' | 'prefix' | 'input' | 'suffix';
type InputStatus = 'error' | 'warning';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KInputRenderScope {
  size: 'xs' | 'sm' | 'md' | 'lg';
  variant: 'outlined' | 'filled' | 'borderless';
  type: string;
  /** 合并链：prop > FormItem 校验态 */
  status: InputStatus | undefined;
  placeholder: string | undefined;
  disabled: boolean | undefined;
  readonly: boolean | undefined;
  clearable: boolean | undefined;
  maxlength: number | string | undefined;
  showCount: boolean | undefined;
  id: string | undefined;
  name: string | undefined;
  value: string;
  focused: boolean;
  /** clearable && 有值 && 可交互 的合成显隐 */
  showClear: boolean;
  inputEl: typeof inputEl;
  rootAttrs: Record<string, unknown>;
  /** 原生 input 语义包：value/type/placeholder/disabled/readonly/maxlength/autofocus/autocomplete/inputmode/id/name */
  inputAttrs: Record<string, unknown>;
  /** input/focus/blur/change 逻辑包（写值 + FormItem 校验联动 + 事件） */
  inputOn: {
    input: (e: Event) => void;
    focus: (e: FocusEvent) => void;
    blur: (e: FocusEvent) => void;
    change: (e: Event) => void;
  };
  /** 清除动作（置空 + clear 事件 + 回焦） */
  onClear: () => void;
  focus: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KInputProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 校验态（KForm 下发 / 手动指定）；缺省跟随 status 语义色链 */
  status?: InputStatus;
  variant?: 'outlined' | 'filled' | 'borderless';
  type?: 'text' | 'password' | 'search' | 'email' | 'tel' | 'url' | 'number';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  clearable?: boolean;
  maxlength?: number | string;
  /** 字数统计（配合 maxlength；无上限时仅显示当前字数） */
  showCount?: boolean;
  autofocus?: boolean;
  autocomplete?: string;
  /** 透传原生 input[inputmode]（数字键盘等；InputNumber 消费） */
  inputmode?: string;
  id?: string;
  name?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KInputRenderScope>;
  classNames?: Partial<Record<InputPart, string>>;
  styles?: Partial<Record<InputPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KInputProps>(), {
  size: 'md',
  variant: 'outlined',
  type: 'text',
});

const emit = defineEmits<{
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  change: [e: Event];
  clear: [];
}>();

const model = defineModel<string>({ default: '' });
const slots = useSlots();

const inputEl = ref<HTMLInputElement | null>(null);
const focused = ref(false);

/* KForm 联动（合并链：prop > FormItem 校验态）；blur/change 回调触发字段校验 */
const formItem = inject(FORM_ITEM_KEY, null);
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const hasValue = computed(() => model.value !== '' && model.value != null);
const showClear = computed(
  () => props.clearable && hasValue.value && !props.disabled && !props.readonly,
);

const classes = computed(() => [
  'k-input',
  `k-input--${props.size}`,
  `k-input--${props.variant}`,
  {
    [`k-input--${effectiveStatus.value}`]: effectiveStatus.value,
    'is-disabled': props.disabled,
    'is-readonly': props.readonly,
    'k-input--has-suffix':
      showClear.value || props.showCount || Boolean(slots.suffix),
  },
]);

function onInput(e: Event) {
  model.value = (e.target as HTMLInputElement).value;
  formItem?.onFieldChange();
}
function onFocus(e: FocusEvent) {
  focused.value = true;
  emit('focus', e);
}
function onBlur(e: FocusEvent) {
  focused.value = false;
  emit('blur', e);
  formItem?.onFieldBlur();
}
function onClear() {
  model.value = '';
  emit('clear');
  inputEl.value?.focus();
}
function focus() {
  inputEl.value?.focus();
}

const rootAttrs = { 'data-part': 'root' };
const inputAttrs = computed(() => ({
  'data-part': 'input',
  value: model.value,
  type: props.type,
  placeholder: props.placeholder,
  disabled: props.disabled || undefined,
  readonly: props.readonly || undefined,
  maxlength: props.maxlength,
  autofocus: props.autofocus || undefined,
  autocomplete: props.autocomplete,
  inputmode: props.inputmode,
  id: props.id,
  name: props.name,
}));
const inputOn = {
  input: onInput,
  focus: onFocus,
  blur: onBlur,
  change: (e: Event) => emit('change', e),
};

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KInputRenderScope>(
  () => props.render,
  () => ({
    size: props.size,
    variant: props.variant,
    type: props.type,
    status: effectiveStatus.value,
    placeholder: props.placeholder,
    disabled: props.disabled,
    readonly: props.readonly,
    clearable: props.clearable,
    maxlength: props.maxlength,
    showCount: props.showCount,
    id: props.id,
    name: props.name,
    value: model.value,
    focused: focused.value,
    showClear: showClear.value,
    inputEl,
    rootAttrs,
    inputAttrs: inputAttrs.value,
    inputOn,
    onClear,
    focus,
    slots,
  }),
);

defineSlots<{
  prefix?(): VNodeChild;
  suffix?(): VNodeChild;
  render?(scope: KInputRenderScope): VNodeChild;
}>();

defineExpose({ inputEl, focus });
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    :class="[classes, classNames?.root]"
    :style="styles?.root"
    v-bind="rootAttrs"
  >
    <span
      v-if="slots.prefix"
      data-part="prefix"
      class="k-input__prefix"
      :class="classNames?.prefix"
      :style="styles?.prefix"
    ><slot name="prefix" /></span>
    <input
      ref="inputEl"
      class="k-input__input"
      :class="classNames?.input"
      :style="styles?.input"
      v-bind="inputAttrs"
      v-on="inputOn"
    />
    <span
      v-if="showClear || showCount || slots.suffix"
      data-part="suffix"
      class="k-input__suffix"
      :class="classNames?.suffix"
      :style="styles?.suffix"
    >
      <slot name="suffix" />
      <!-- 内建清除图标：最小 inline SVG（currentColor），不动 KIcon 注入模式；KForm 批如引入图标库依赖再统一 -->
      <span
        v-if="showClear"
        class="k-input__clear"
        role="button"
        aria-label="清除"
        @mousedown.prevent="onClear"
      >
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/>
        </svg>
      </span>
      <span v-if="showCount" class="k-input__count">
        <span class="k-input__count-current">{{ String(model ?? '').length }}</span>
        <template v-if="maxlength"> / {{ maxlength }}</template>
      </span>
    </span>
  </span>
</template>

<style>
/* ---------- 部件变量（共同约定：初值引 alias，状态局部重声明） ---------- */
.k-input {
  --k-input-height: var(--k-control-height);
  /* 字号不在此重声明：直接消费 theme.css §8.2 的 `--k-input-font-size`（根级继承，mobile 块自动翻 16px 防 iOS 聚焦缩放） */
  --k-input-padding-x: var(--k-size);
  --k-input-radius: var(--k-border-radius);
  --k-input-bg: var(--k-color-bg-container);
  --k-input-border-color: var(--k-color-border);
  --k-input-border-width: var(--k-line-width);
  --k-input-text-color: var(--k-color-text);
  --k-input-placeholder-color: var(--k-color-text-tertiary);
  --k-input-icon-color: var(--k-color-text-tertiary);
  --k-input-clear-color: var(--k-color-text-quaternary);
  --k-input-clear-color-hover: var(--k-color-text-tertiary);
  --k-input-hover-border-color: var(--k-color-primary-hover);
  --k-input-focus-border-color: var(--k-color-primary);
  --k-input-outline: var(--k-control-outline);
  --k-input-outline-width: var(--k-control-outline-width);
  --k-input-count-color: var(--k-color-text-tertiary);

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 var(--k-input-padding-x);
  background-color: var(--k-input-bg);
  border: var(--k-input-border-width) solid var(--k-input-border-color);
  border-radius: var(--k-input-radius);
  font-family: inherit;
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
  cursor: text;
}
.k-input *,
.k-input *::before,
.k-input *::after {
  box-sizing: border-box;
}

.k-input__input {
  flex: auto;
  min-width: 0;
  width: 100%;
  height: calc(var(--k-input-height) - var(--k-input-border-width) * 2);
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--k-input-text-color);
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
  font-family: inherit;
}
.k-input__input::placeholder {
  color: var(--k-input-placeholder-color);
  opacity: 1;
  transition: color 0.3s;
}
.k-input__input::-webkit-outer-spin-button,
.k-input__input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}
.k-input__input[type='number'] {
  appearance: textfield;
}

.k-input__prefix,
.k-input__suffix {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  flex: none;
  color: var(--k-input-icon-color);
}
/* 插槽直供的裸 svg（如 @vicons，只有 viewBox 无宽高）由宿主定尺寸，同 KButton/KIcon 路数 */
.k-input__prefix svg,
.k-input__suffix svg {
  width: 1em;
  height: 1em;
  display: block;
}

.k-input__clear {
  display: inline-flex;
  color: var(--k-input-clear-color);
  cursor: pointer;
  font-size: var(--k-font-size);
  visibility: hidden; /* 规格：有值 + 悬浮或聚焦时才现（antd 实况同） */
}
.k-input:hover .k-input__clear,
.k-input:focus-within .k-input__clear {
  visibility: visible;
}
@media (hover: none) {
  .k-input__clear {
    visibility: visible; /* 触屏无 hover，常驻 */
  }
}
.k-input__clear:hover {
  color: var(--k-input-clear-color-hover);
}

.k-input__count {
  color: var(--k-input-count-color);
  font-size: var(--k-font-size-sm);
  white-space: nowrap;
}

/* ---------- 状态：hover / focus-within（根垫圈 = antd 路数，描在 root 非 input） ---------- */
.k-input:not(.is-disabled):hover {
  --k-input-border-color: var(--k-input-hover-border-color);
}
.k-input:focus-within:not(.is-disabled) {
  --k-input-border-color: var(--k-input-focus-border-color);
  box-shadow: 0 0 0 var(--k-input-outline-width) var(--k-input-outline);
}

/* ---------- status：边框/圈随语义色；error 计数超限感留 KForm 批 ---------- */
.k-input--error {
  --k-input-border-color: var(--k-color-error);
  --k-input-hover-border-color: var(--k-color-error);
  --k-input-focus-border-color: var(--k-color-error);
  --k-input-outline: color-mix(in oklab, var(--k-color-error) 25%, transparent);
}
.k-input--warning {
  --k-input-border-color: var(--k-color-warning);
  --k-input-hover-border-color: var(--k-color-warning);
  --k-input-focus-border-color: var(--k-color-warning);
  --k-input-outline: color-mix(in oklab, var(--k-color-warning) 25%, transparent);
}

/* ---------- variant：filled 灰底无框、borderless 全透明（outlined = 基线） ---------- */
.k-input--filled {
  --k-input-bg: var(--k-color-fill-tertiary);
  --k-input-border-color: transparent;
  --k-input-hover-border-color: transparent;
  --k-input-focus-border-color: transparent;
}
.k-input--borderless {
  --k-input-bg: transparent;
  --k-input-border-color: transparent;
  --k-input-hover-border-color: transparent;
  --k-input-focus-border-color: transparent;
}
.k-input--filled:focus-within,
.k-input--borderless:focus-within {
  box-shadow: none;
}

/* ---------- disabled / readonly ---------- */
.k-input.is-disabled {
  --k-input-bg: var(--k-color-fill-tertiary);
  --k-input-text-color: var(--k-color-text-quaternary);
  --k-input-border-color: var(--k-color-border);
  cursor: not-allowed;
}
.k-input.is-disabled .k-input__input {
  cursor: not-allowed;
  -webkit-text-fill-color: var(--k-input-text-color);
}
.k-input.is-readonly .k-input__input {
  cursor: default;
}

/* ---------- 尺寸档（controlHeight 阶梯；字号全档同值走根级 --k-input-font-size，不破 iOS 保护） ---------- */
.k-input--xs { --k-input-height: var(--k-control-height-xs); --k-input-padding-x: var(--k-size-sm); }
.k-input--sm { --k-input-height: var(--k-control-height-sm); }
.k-input--lg { --k-input-height: var(--k-control-height-lg); --k-input-padding-x: var(--k-size-md); }

/* 按压遮罩豁免：输入族不套 Button 的 hover:none 黑 8%（表单件按压语义 = 聚焦，不是触发） */
</style>
