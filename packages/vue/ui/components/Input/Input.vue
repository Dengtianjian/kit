<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    ref="rootEl"
    :class="[classes, classNames?.root]"
    :style="styles?.root"
    v-bind="rootAttrs"
    @click="onRootClick"
  >
    <span
      v-if="hasAddonBefore"
      data-part="addon-before"
      class="k-input__addon k-input__addon--before"
      :class="classNames?.addonBefore"
      :style="styles?.addonBefore"
    ><slot name="addonBefore">{{ addonBefore }}</slot></span>
    <span
      v-if="slots.prefix"
      data-part="prefix"
      class="k-input__prefix"
      :class="classNames?.prefix"
      :style="styles?.prefix"
    ><slot name="prefix" /></span>
    <textarea
      v-if="isTextarea"
      ref="inputEl"
      class="k-input__input"
      :class="classNames?.input"
      :style="[styles?.input, autosize ? { resize: 'none' } : null]"
      v-bind="inputAttrs"
      v-on="inputOn"
    />
    <input
      v-else
      ref="inputEl"
      class="k-input__input"
      :class="classNames?.input"
      :style="styles?.input"
      v-bind="inputAttrs"
      v-on="inputOn"
    />
    <span
      v-if="hasSuffix"
      data-part="suffix"
      class="k-input__suffix"
      :class="classNames?.suffix"
      :style="styles?.suffix"
    >
      <slot name="suffix" />
      <span v-if="loading" class="k-input__loading" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="8" cy="8" r="6" stroke-opacity="0.25" />
          <path d="M14 8a6 6 0 0 0-6-6" />
        </svg>
      </span>
      <span
        v-if="isPassword && showPassword"
        class="k-input__eye"
        role="button"
        :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
        @mousedown.prevent="togglePassword"
      >
        <svg v-if="passwordVisible" viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.8" /></svg>
        <svg v-else viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 2l12 12" /><path d="M6.3 4.2A6.6 6.6 0 0 1 8 4c4 0 6.5 4 6.5 4a12 12 0 0 1-2.2 2.6M4.2 5.6A11 11 0 0 0 1.5 8S4 12 8 12c.9 0 1.7-.2 2.4-.5" /></svg>
      </span>
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
      <span v-if="showCount" class="k-input__count" :class="{ 'is-over': overCount }">
        <span class="k-input__count-current">{{ countLength }}</span>
        <template v-if="maxlength"> / {{ maxlength }}</template>
      </span>
    </span>
    <span
      v-if="hasAddonAfter"
      data-part="addon-after"
      class="k-input__addon k-input__addon--after"
      :class="classNames?.addonAfter"
      :style="styles?.addonAfter"
    ><slot name="addonAfter">{{ addonAfter }}</slot></span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue';
import { FORM_ITEM_KEY } from '../Form/context';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KInput' });

type InputPart = 'root' | 'prefix' | 'input' | 'suffix' | 'addonBefore' | 'addonAfter';
type InputStatus = 'error' | 'warning';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KInputRenderScope {
  size: 'xs' | 'sm' | 'md' | 'lg';
  variant: 'outlined' | 'filled' | 'borderless' | 'underlined';
  type: string;
  /** textarea 形态（多行） */
  isTextarea: boolean;
  rows: number | undefined;
  autosize: boolean | { minRows?: number; maxRows?: number } | undefined;
  loading: boolean | undefined;
  passivelyActivated: boolean | undefined;
  /** 密码明文是否可见 */
  passwordVisible: boolean;
  /** 合并链：prop > FormItem 校验态 */
  status: InputStatus | undefined;
  placeholder: string | undefined;
  disabled: boolean | undefined;
  readonly: boolean | undefined;
  clearable: boolean | undefined;
  maxlength: number | string | undefined;
  showCount: boolean | undefined;
  /** 当前字数（与原生 maxlength 一致） */
  countLength: number;
  /** showCount 且超过 maxlength */
  overCount: boolean;
  addonBefore: string | number | undefined;
  addonAfter: string | number | undefined;
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
  blur: () => void;
  select: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KInputProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 校验态（KForm 下发 / 手动指定）；缺省跟随 status 语义色链 */
  status?: InputStatus;
  variant?: 'outlined' | 'filled' | 'borderless' | 'underlined';
  type?: 'text' | 'password' | 'textarea' | 'search' | 'email' | 'tel' | 'url' | 'number';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  clearable?: boolean;
  maxlength?: number | string;
  /** 字数统计（配合 maxlength；无上限时仅显示当前字数） */
  showCount?: boolean;
  /** 前置组合标签（纯文本；#addonBefore 插槽优先） */
  addonBefore?: string | number;
  /** 后置组合标签（纯文本；#addonAfter 插槽优先） */
  addonAfter?: string | number;
  autofocus?: boolean;
  autocomplete?: string;
  /** 透传原生 input[inputmode]（数字键盘等；InputNumber 消费） */
  inputmode?: string;
  /** 透传原生 input[enterkeyhint]（移动端回车键文案：search/done/next…） */
  enterkeyhint?: string;
  /** 透传原生 input[autocapitalize]（移动端自动大写策略） */
  autocapitalize?: string;
  /** type=textarea 时的行数（未开 autosize 时生效，默认 3） */
  rows?: number;
  /** 文本域自适应内容高度：true 或 { minRows, maxRows } */
  autosize?: boolean | { minRows?: number; maxRows?: number };
  /** 加载态：后缀显示旋转图标（占位，不改变可编辑性） */
  loading?: boolean;
  /** 被动激活：点击外壳空白/前后缀区域也聚焦输入框 */
  passivelyActivated?: boolean;
  /** type=password 时显示明文切换按钮（默认显示） */
  showPassword?: boolean;
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
  rows: 3,
  showPassword: true,
});

const emit = defineEmits<{
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  change: [e: Event];
  clear: [];
  passwordVisibleChange: [visible: boolean];
}>();

const model = defineModel<string>({ default: '' });
const slots = useSlots();

const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const focused = ref(false);
const passwordVisible = ref(false);
const isTextarea = computed(() => props.type === 'textarea');
const resolvedPlaceholder = computed(
  () => props.placeholder ?? (isTextarea.value ? '请输入内容' : '请输入'),
);
const isPassword = computed(() => props.type === 'password');
const actualType = computed(() =>
  isPassword.value && props.showPassword && passwordVisible.value ? 'text' : props.type,
);
const hasSuffix = computed(
  () =>
    showClear.value ||
    props.showCount ||
    props.loading ||
    (isPassword.value && props.showPassword) ||
    Boolean(slots.suffix),
);

/* KForm 联动（合并链：prop > FormItem 校验态）；blur/change 回调触发字段校验 */
const formItem = inject(FORM_ITEM_KEY, null);
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const hasValue = computed(() => model.value !== '' && model.value != null);
const showClear = computed(
  () => props.clearable && hasValue.value && !props.disabled && !props.readonly,
);
const hasAddonBefore = computed(() => Boolean(slots.addonBefore) || props.addonBefore != null);
const hasAddonAfter = computed(() => Boolean(slots.addonAfter) || props.addonAfter != null);
const countLength = computed(() => String(model.value ?? '').length);
const overCount = computed(() => {
  const max = Number(props.maxlength);
  return props.showCount && Number.isFinite(max) && max > 0 && countLength.value > max;
});

const classes = computed(() => [
  'k-input',
  `k-input--${props.size}`,
  `k-input--${props.variant}`,
  {
    [`k-input--${effectiveStatus.value}`]: effectiveStatus.value,
    'is-disabled': props.disabled,
    'is-readonly': props.readonly,
    'is-loading': props.loading,
    'k-input--textarea': isTextarea.value,
    'k-input--has-suffix': hasSuffix.value,
  },
]);

function onInput(e: Event) {
  model.value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
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
function blur() {
  inputEl.value?.blur();
}
function select() {
  inputEl.value?.select();
}

function autosizeOptions() {
  const a = props.autosize;
  if (!a || !isTextarea.value) return null;
  if (a === true) return { minRows: 1, maxRows: Infinity };
  return { minRows: a.minRows ?? 1, maxRows: a.maxRows ?? Infinity };
}

function resizeTextarea() {
  const el = inputEl.value;
  const opts = autosizeOptions();
  if (!(el instanceof HTMLTextAreaElement) || !opts) return;
  const cs = getComputedStyle(el);
  const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
  const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  el.style.height = 'auto';
  const min = line * opts.minRows + pad;
  const max = opts.maxRows === Infinity ? Infinity : line * opts.maxRows + pad;
  const height = Math.max(min, Math.min(max, el.scrollHeight));
  el.style.height = `${Math.round(height)}px`;
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
}

let resizeObserver: ResizeObserver | null = null;
watch(model, () => {
  if (!isTextarea.value) return;
  nextTick(resizeTextarea);
});
watch(
  () => [props.autosize, props.rows, props.type],
  () => nextTick(resizeTextarea),
);
onMounted(() => {
  resizeTextarea();
  if (isTextarea.value && autosizeOptions() && typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver = new ResizeObserver(() => resizeTextarea());
    resizeObserver.observe(rootEl.value);
  }
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

function togglePassword() {
  passwordVisible.value = !passwordVisible.value;
  emit('passwordVisibleChange', passwordVisible.value);
  nextTick(() => {
    const el = inputEl.value;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange?.(end, end);
  });
}

function onRootClick(e: MouseEvent) {
  if (!props.passivelyActivated || props.disabled) return;
  const target = e.target as HTMLElement;
  if (target.closest('button, a, [role="button"], input, textarea')) return;
  focus();
}


const rootAttrs = { 'data-part': 'root' };
const inputAttrs = computed(() => ({
  'data-part': 'input',
  value: model.value,
  type: isTextarea.value ? undefined : actualType.value,
  rows: isTextarea.value ? (autosizeOptions()?.minRows ?? props.rows) : undefined,
  'aria-busy': props.loading || undefined,
  placeholder: resolvedPlaceholder.value,
  disabled: props.disabled || undefined,
  readonly: props.readonly || undefined,
  maxlength: props.maxlength,
  autofocus: props.autofocus || undefined,
  autocomplete: props.autocomplete,
  inputmode: props.inputmode,
  enterkeyhint: props.enterkeyhint,
  autocapitalize: props.autocapitalize,
  id: props.id ?? formItem?.controlId,
  name: props.name,
  'aria-invalid': formItem?.invalid.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
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
    isTextarea: isTextarea.value,
    rows: props.rows,
    autosize: props.autosize,
    loading: props.loading,
    passivelyActivated: props.passivelyActivated,
    passwordVisible: passwordVisible.value,
    status: effectiveStatus.value,
    placeholder: resolvedPlaceholder.value,
    disabled: props.disabled,
    readonly: props.readonly,
    clearable: props.clearable,
    maxlength: props.maxlength,
    showCount: props.showCount,
    countLength: countLength.value,
    overCount: overCount.value,
    addonBefore: props.addonBefore,
    addonAfter: props.addonAfter,
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
  addonBefore?(): VNodeChild;
  addonAfter?(): VNodeChild;
  render?(scope: KInputRenderScope): VNodeChild;
}>();

defineExpose({ inputEl, focus, blur, select, activate: focus, deactivate: blur });
</script>

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
  --k-input-icon-color-hover: var(--k-color-text);
  --k-input-clear-color: var(--k-color-text-quaternary);
  --k-input-clear-color-hover: var(--k-color-text-tertiary);
  --k-input-hover-border-color: var(--k-color-primary-hover);
  --k-input-focus-border-color: var(--k-color-primary);
  --k-input-outline: var(--k-control-outline);
  --k-input-outline-width: var(--k-control-outline-width);
  --k-input-count-color: var(--k-color-text-tertiary);
  /* 前缀/输入/后缀之间的呼吸位（默认 8px，可经变量覆盖） */
  --k-input-affix-gap: var(--k-size-xs);
  /* 组合标签（addonBefore/After）：灰底标签，分隔线跟随边框状态色 */
  --k-input-addon-bg: var(--k-color-fill-secondary);
  --k-input-addon-text-color: var(--k-color-text-secondary);
  --k-input-addon-border-color: var(--k-input-border-color);
  --k-input-addon-padding-x: 12px;

  display: inline-flex;
  align-items: center;
  gap: var(--k-input-affix-gap);
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

.k-input--textarea {
  align-items: stretch;
  padding: var(--k-size-xs) var(--k-input-padding-x);
}
.k-input--textarea .k-input__prefix,
.k-input--textarea .k-input__suffix {
  align-self: center;
}
.k-input--textarea .k-input__input {
  height: auto;
  min-height: calc(var(--k-line-height) * 1em);
  padding: 0;
  line-height: var(--k-line-height);
  resize: vertical;
}
.k-input.is-loading {
  cursor: progress;
}
.k-input__loading {
  display: inline-flex;
  color: var(--k-input-icon-color);
  animation: k-input-spin 0.8s linear infinite;
}
.k-input__eye {
  display: inline-flex;
  color: var(--k-input-icon-color);
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-input__eye:hover {
  color: var(--k-input-icon-color-hover);
}
@keyframes k-input-spin {
  to { transform: rotate(360deg); }
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

/* 组合标签：贴住外壳内侧，靠负 margin 抵消 padding/gap，不额外加包裹层 */
.k-input__addon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  flex: none;
  padding: 0 var(--k-input-addon-padding-x);
  background: var(--k-input-addon-bg);
  color: var(--k-input-addon-text-color);
  font-size: var(--k-input-font-size);
  white-space: nowrap;
  cursor: default;
}
.k-input__addon--before {
  margin-inline-start: calc(var(--k-input-padding-x) * -1);
  margin-inline-end: calc(var(--k-input-affix-gap) * -1);
  border-inline-end: var(--k-input-border-width) solid var(--k-input-addon-border-color);
  border-start-start-radius: calc(var(--k-input-radius) - var(--k-input-border-width));
  border-end-start-radius: calc(var(--k-input-radius) - var(--k-input-border-width));
}
.k-input__addon--after {
  margin-inline-start: calc(var(--k-input-affix-gap) * -1);
  margin-inline-end: calc(var(--k-input-padding-x) * -1);
  border-inline-start: var(--k-input-border-width) solid var(--k-input-addon-border-color);
  border-start-end-radius: calc(var(--k-input-radius) - var(--k-input-border-width));
  border-end-end-radius: calc(var(--k-input-radius) - var(--k-input-border-width));
}
.k-input--textarea .k-input__addon {
  margin-block: calc(var(--k-size-xs) * -1);
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
.k-input__count.is-over {
  color: var(--k-color-error);
}

/* ---------- 状态：hover / focus-within（根垫圈 = antd 路数，描在 root 非 input） ---------- */
.k-input:not(.is-disabled):hover {
  --k-input-border-color: var(--k-input-hover-border-color);
}
.k-input:focus-within:not(.is-disabled) {
  --k-input-border-color: var(--k-input-focus-border-color);
  box-shadow: 0 0 0 var(--k-input-outline-width) var(--k-input-outline);
}

/* ---------- status：边框/圈随语义色；showCount 超限时计数单独标红 ---------- */
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
  --k-input-addon-bg: var(--k-color-fill-secondary);
  --k-input-addon-border-color: var(--k-color-border);
}
.k-input--borderless,
.k-input--underlined {
  --k-input-addon-bg: transparent;
  --k-input-addon-border-color: var(--k-color-border);
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

/* underlined：仅底部边框，hover/focus 只变底线颜色，不出聚焦圈 */
.k-input--underlined {
  --k-input-bg: transparent;
  border-width: 0 0 var(--k-input-border-width);
  border-color: var(--k-color-border);
  border-radius: 0;
}
.k-input--underlined:not(.is-disabled):hover {
  border-bottom-color: var(--k-color-primary-hover);
}
.k-input--underlined:focus-within:not(.is-disabled) {
  border-bottom-color: var(--k-color-primary);
  box-shadow: none;
}
.k-input--underlined.is-disabled {
  --k-input-bg: transparent;
  border-color: var(--k-color-border);
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
.k-input--xs { --k-input-height: var(--k-control-height-xs); --k-input-padding-x: var(--k-size-sm); --k-input-addon-padding-x: var(--k-size-sm); }
.k-input--sm { --k-input-height: var(--k-control-height-sm); --k-input-addon-padding-x: var(--k-size-sm); }
.k-input--lg { --k-input-height: var(--k-control-height-lg); --k-input-padding-x: var(--k-size-md); --k-input-addon-padding-x: var(--k-size); }

/* 按压遮罩豁免：输入族不套 Button 的 hover:none 黑 8%（表单件按压语义 = 聚焦，不是触发） */

@media (hover: none) {
  /* 触屏放大清除按钮命中区（视觉尺寸不变，负 margin 抵消占位） */
  .k-input__clear {
    padding: 8px;
    margin: -8px;
  }
}
</style>
