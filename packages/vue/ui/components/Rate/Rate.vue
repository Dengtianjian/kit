<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-rate"
    :class="[
      `k-rate--${size}`,
      {
        'is-disabled': disabled,
        'is-readonly': readonly,
        'k-rate--error': effectiveStatus === 'error',
        'k-rate--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="[rootStyle, styles?.root]"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-valuemin="0"
    :aria-valuemax="count"
    :aria-valuenow="value"
    :aria-valuetext="ariaValueText"
    :aria-disabled="disabled || undefined"
    :aria-readonly="readonly || undefined"
    :aria-label="ariaLabel"
    @keydown="onKeydown"
    @mouseleave="hoverValue = null"
  >
    <button
      v-for="i in count"
      :key="i"
      type="button"
      data-part="item"
      class="k-rate__item"
      :class="[
        {
          'is-active': i <= displayValue,
          'is-half': isHalf(i),
          'is-hover': hoverValue != null && i <= hoverValue,
        },
        classNames?.item,
      ]"
      :style="styles?.item"
      :disabled="disabled || readonly"
      :tabindex="-1"
      :title="tooltips?.[i - 1]"
      :aria-label="tooltips?.[i - 1] ?? `${i}`"
      @click="onPick($event, i)"
      @mousemove="onHover($event, i)"
      @focus="onItemFocus(i)"
    >
      <span class="k-rate__character" :class="classNames?.character" :style="styles?.character">
        <slot name="character" :index="i" :active="i <= displayValue" :half="isHalf(i)">
          <template v-if="character">{{ character }}</template>
          <svg v-else viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5l2.9 6.1 6.7.9-4.9 4.7 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.4 9.5l6.7-.9L12 2.5Z" />
          </svg>
        </slot>
      </span>
      <span
        v-if="isHalf(i)"
        class="k-rate__character k-rate__character--half"
        aria-hidden="true"
      >
        <slot name="character" :index="i" :active="true" :half="true">
          <template v-if="character">{{ character }}</template>
          <svg v-else viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5l2.9 6.1 6.7.9-4.9 4.7 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.4 9.5l6.7-.9L12 2.5Z" />
          </svg>
        </slot>
      </span>
    </button>
    <span v-if="showText" class="k-rate__text" :class="classNames?.text" :style="styles?.text">
      <slot name="text" :value="value">{{ text ?? value }}</slot>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, inject, ref, useId, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { FORM_ITEM_KEY } from '../Form/context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KRate' });

export type KRateSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KRateStatus = 'error' | 'warning';
type RatePart = 'root' | 'item' | 'character' | 'text';

export interface KRateRenderScope {
  value: number;
  hoverValue: number | null;
  displayValue: number;
  count: number;
  allowHalf: boolean;
  allowClear: boolean;
  disabled: boolean;
  readonly: boolean;
  size: KRateSize;
  status: KRateStatus | undefined;
  rootAttrs: Record<string, unknown>;
  setValue: (value: number) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KRateProps {
  count?: number;
  allowHalf?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  size?: KRateSize;
  status?: KRateStatus;
  character?: string;
  color?: string;
  voidColor?: string;
  tooltips?: string[];
  showText?: boolean;
  text?: string;
  ariaLabel?: string;
  render?: KRenderFn<KRateRenderScope>;
  classNames?: Partial<Record<RatePart, string>>;
  styles?: Partial<Record<RatePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KRateProps>(), {
  count: 5,
  allowHalf: false,
  allowClear: true,
  disabled: false,
  readonly: false,
  size: 'md',
  showText: false,
  ariaLabel: '评分',
});

const emit = defineEmits<{
  change: [value: number];
  hoverChange: [value: number];
}>();

const model = defineModel<number>({ default: 0 });
const formItem = inject(FORM_ITEM_KEY, null);
const uid = useId();
const slots = useSlots();
const rootEl = ref<HTMLElement | null>(null);
const hoverValue = ref<number | null>(null);

const count = computed(() => Math.max(1, Math.round(props.count) || 1));
const value = computed(() => Math.min(count.value, Math.max(0, Number(model.value) || 0)));
const displayValue = computed(() => hoverValue.value ?? value.value);
const ariaValueText = computed(() => `${value.value} / ${count.value}`);

function isHalf(i: number) {
  return displayValue.value >= i - 0.5 && displayValue.value < i;
}

function setValue(next: number) {
  if (props.disabled || props.readonly) return;
  const clamped = Math.min(count.value, Math.max(0, next));
  const final = props.allowClear && clamped === value.value ? 0 : clamped;
  model.value = final;
  emit('change', final);
  formItem?.onFieldChange();
  formItem?.onFieldBlur();
}

function valueFromPointer(e: MouseEvent, i: number) {
  if (!props.allowHalf) return i;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.clientX - rect.left < rect.width / 2 ? i - 0.5 : i;
}

function onPick(e: MouseEvent, i: number) {
  setValue(valueFromPointer(e, i));
}

function onHover(e: MouseEvent, i: number) {
  if (props.disabled || props.readonly) return;
  const next = valueFromPointer(e, i);
  if (next !== hoverValue.value) {
    hoverValue.value = next;
    emit('hoverChange', next);
  }
}

function onItemFocus(i: number) {
  if (!props.disabled && !props.readonly) rootEl.value?.focus();
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled || props.readonly) return;
  const step = props.allowHalf ? 0.5 : 1;
  let next = value.value;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      next = value.value + step;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      next = value.value - step;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = count.value;
      break;
    default:
      return;
  }
  e.preventDefault();
  model.value = Math.min(count.value, Math.max(0, next));
  emit('change', model.value);
  formItem?.onFieldChange();
  formItem?.onFieldBlur();
}

const effectiveStatus = computed(() => props.status ?? formItem?.status.value);
const rootAttrs = { 'data-part': 'root', id: formItem?.controlId ?? `${uid}-rate` };
const rootStyle = computed<CSSProperties>(() => ({
  ...(props.color ? { '--k-rate-active-color': props.color } : {}),
  ...(props.voidColor ? { '--k-rate-inactive-color': props.voidColor } : {}),
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KRateRenderScope>(
  () => props.render,
  () => ({
    value: value.value,
    hoverValue: hoverValue.value,
    displayValue: displayValue.value,
    count: count.value,
    allowHalf: props.allowHalf,
    allowClear: props.allowClear,
    disabled: props.disabled,
    readonly: props.readonly,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    setValue,
    slots,
  }),
);

defineSlots<{
  character?(scope: { index: number; active: boolean; half: boolean }): VNodeChild;
  text?(scope: { value: number }): VNodeChild;
  render?(scope: KRateRenderScope): VNodeChild;
}>();
</script>

<style>
.k-rate {
  --k-rate-font-size: 24px;
  --k-rate-gap: var(--k-size-xxs);
  --k-rate-active-color: var(--k-color-primary);
  --k-rate-inactive-color: var(--k-color-text-quaternary);
  --k-rate-hover-scale: 1.08;

  display: inline-flex;
  align-items: center;
  gap: var(--k-rate-gap);
  color: var(--k-rate-inactive-color);
  line-height: 1;
  vertical-align: middle;
  outline: none;
  border-radius: var(--k-border-radius-sm);
}
.k-rate--sm { --k-rate-font-size: 20px; }
.k-rate--lg { --k-rate-font-size: 32px; }
.k-rate:focus-visible {
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-rate.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.k-rate__item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--k-rate-font-size);
  line-height: 1;
  cursor: pointer;
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-rate__item:disabled {
  cursor: inherit;
}
.k-rate:not(.is-disabled):not(.is-readonly) .k-rate__item:hover {
  transform: scale(var(--k-rate-hover-scale));
}
.k-rate__item.is-active,
.k-rate__item.is-hover {
  color: var(--k-rate-active-color);
}
.k-rate__character {
  display: inline-flex;
  pointer-events: none;
}
.k-rate__character--half {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 50%;
  overflow: hidden;
  color: var(--k-rate-active-color);
}
.k-rate--error { --k-rate-active-color: var(--k-color-error); }
.k-rate--warning { --k-rate-active-color: var(--k-color-warning); }
.k-rate__text {
  margin-inline-start: var(--k-size-xs);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
  line-height: var(--k-line-height);
}
@media (prefers-reduced-motion: reduce) {
  .k-rate__item {
    transition: none;
  }
}
</style>