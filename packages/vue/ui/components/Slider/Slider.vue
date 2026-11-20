<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-slider"
    :class="[
      `k-slider--${size}`,
      {
        'k-slider--vertical': vertical,
        'is-range': isRange,
        'is-disabled': disabled,
        'is-readonly': readonly,
        'is-with-marks': markEntries.length > 0,
        'k-slider--error': effectiveStatus === 'error',
        'k-slider--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="[rootStyle, styles?.root]"
    role="group"
    :aria-label="ariaLabel"
  >
    <div
      ref="railEl"
      v-bind="railAttrs"
      class="k-slider__rail"
      :class="classNames?.rail"
      :style="styles?.rail"
      v-on="railOn"
    >
      <div
        data-part="track"
        class="k-slider__track"
        :class="classNames?.track"
        :style="[activeStyle, styles?.track]"
      />
      <span
        v-for="m in markEntries"
        :key="m.value"
        data-part="mark"
        class="k-slider__mark"
        :class="classNames?.mark"
        :style="[markStyle(m.percent), styles?.mark]"
      >
        <span class="k-slider__mark-dot" :style="m.style" />
        <span v-if="m.label" class="k-slider__mark-label" :style="m.style">{{ m.label }}</span>
      </span>
      <span
        v-for="(v, i) in values"
        :key="i"
        data-part="thumb"
        class="k-slider__thumb-wrap"
        :class="classNames?.thumb"
        :style="[thumbStyle(i), styles?.thumb]"
      >
        <span
          :ref="(el) => setThumbRef(el as HTMLElement | null, i)"
          v-bind="thumbAttrs(i)"
          class="k-slider__thumb"
          :class="[{ 'is-active': activeThumb === i }, classNames?.thumb]"
          v-on="thumbOn(i)"
        />
        <span
          v-if="tooltipVisible(i)"
          data-part="tooltip"
          class="k-slider__tooltip"
          :class="classNames?.tooltip"
          :style="styles?.tooltip"
        >{{ tooltipText(v) }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { FORM_ITEM_KEY } from '../Form/context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KSlider' });

export type KSliderValue = number | [number, number];
export type KSliderSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KSliderStatus = 'error' | 'warning';
export type KSliderTooltip = boolean | 'always' | 'hover';
export type KSliderMark = string | { label?: string; style?: CSSProperties };
type SliderPart = 'root' | 'rail' | 'track' | 'thumb' | 'tooltip' | 'mark';

interface MarkEntry {
  value: number;
  label: string;
  percent: number;
  style?: CSSProperties;
}

export interface KSliderRenderScope {
  values: number[];
  percents: number[];
  isRange: boolean;
  vertical: boolean;
  disabled: boolean;
  readonly: boolean;
  min: number;
  max: number;
  step: number;
  activeThumb: number | null;
  rootAttrs: Record<string, unknown>;
  railAttrs: Record<string, unknown>;
  railOn: KOnPack;
  thumbAttrs: (index: number) => Record<string, unknown>;
  thumbOn: (index: number) => KOnPack;
  setValue: (index: number, value: number) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KSliderProps {
  min?: number;
  max?: number;
  step?: number;
  range?: boolean;
  vertical?: boolean;
  reverse?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  size?: KSliderSize;
  status?: KSliderStatus;
  marks?: Record<number, KSliderMark>;
  showTooltip?: KSliderTooltip;
  tooltipFormatter?: (value: number) => string;
  ariaLabel?: string;
  render?: KRenderFn<KSliderRenderScope>;
  classNames?: Partial<Record<SliderPart, string>>;
  styles?: Partial<Record<SliderPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSliderProps>(), {
  min: 0,
  max: 100,
  step: 1,
  range: false,
  vertical: false,
  reverse: false,
  disabled: false,
  readonly: false,
  size: 'md',
  showTooltip: 'hover',
  ariaLabel: '滑块',
});

const emit = defineEmits<{
  change: [value: KSliderValue];
  dragStart: [value: KSliderValue];
  dragEnd: [value: KSliderValue];
}>();

const model = defineModel<KSliderValue>({ default: 0 });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const railEl = ref<HTMLElement | null>(null);
const thumbEls = ref<(HTMLElement | null)[]>([]);
const activeThumb = ref<number | null>(null);
const hoverThumb = ref<number | null>(null);
const dragging = ref(false);

const min = computed(() => Number(props.min) || 0);
const max = computed(() => (Number(props.max) > min.value ? Number(props.max) : min.value + 1));
const step = computed(() => (Number(props.step) > 0 ? Number(props.step) : 1));
const isRange = computed(() => props.range || Array.isArray(model.value));
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

function clamp(v: number) {
  return Math.min(max.value, Math.max(min.value, v));
}
function snap(v: number) {
  const steps = Math.round((clamp(v) - min.value) / step.value);
  return Number((min.value + steps * step.value).toFixed(10));
}
function toValues(value: KSliderValue): [number, number] {
  if (isRange.value) {
    if (Array.isArray(value)) return [clamp(value[0]), clamp(value[1])];
    return [min.value, clamp(Number(value) || min.value)];
  }
  return [clamp(Array.isArray(value) ? value[0] : Number(value) || min.value), min.value];
}
const values = computed<number[]>(() => {
  const pair = toValues(model.value);
  if (!isRange.value) return [pair[0]];
  return pair[0] <= pair[1] ? pair : [pair[1], pair[0]];
});
function percentOf(v: number) {
  const p = ((v - min.value) / (max.value - min.value)) * 100;
  return props.reverse ? 100 - p : p;
}
const percents = computed(() => values.value.map(percentOf));
const activeStyle = computed<CSSProperties>(() => {
  if (!isRange.value) {
    return props.vertical
      ? { height: `${percents.value[0]}%` }
      : { width: `${percents.value[0]}%` };
  }
  const a = Math.min(percents.value[0], percents.value[1]);
  const b = Math.max(percents.value[0], percents.value[1]);
  return props.vertical
    ? { bottom: `${a}%`, height: `${b - a}%` }
    : { left: `${a}%`, width: `${b - a}%` };
});
const markEntries = computed<MarkEntry[]>(() => {
  if (!props.marks) return [];
  return Object.entries(props.marks)
    .map(([raw, mark]) => {
      const value = Number(raw);
      return {
        value,
        label: typeof mark === 'string' ? mark : mark?.label ?? '',
        percent: percentOf(value),
        style: typeof mark === 'object' ? mark?.style : undefined,
      };
    })
    .filter((m) => Number.isFinite(m.value) && m.value >= min.value && m.value <= max.value)
    .sort((a, b) => a.value - b.value);
});

function thumbStyle(index: number): CSSProperties {
  const p = percents.value[index] ?? 0;
  return props.vertical ? { bottom: `${p}%` } : { '--k-slider-percent': `${p}%` };
}
function markStyle(percent: number): CSSProperties {
  return props.vertical ? { bottom: `${percent}%` } : { left: `${percent}%` };
}
function setThumbRef(el: HTMLElement | null, index: number) {
  thumbEls.value[index] = el;
}
function tooltipVisible(index: number) {
  if (props.showTooltip === false || props.disabled) return false;
  return props.showTooltip === 'always' || dragging.value && activeThumb.value === index || hoverThumb.value === index;
}
function tooltipText(value: number) {
  return props.tooltipFormatter?.(value) ?? String(value);
}

const emitChange = () => {
  emit('change', model.value);
  formItem?.onFieldChange();
};
function setValue(index: number, next: number) {
  if (props.disabled || props.readonly) return;
  const v = snap(next);
  if (isRange.value) {
    const pair = [...values.value] as [number, number];
    pair[index] = index === 0 ? Math.min(v, pair[1]) : Math.max(v, pair[0]);
    model.value = pair;
  } else {
    model.value = v;
  }
}
function valueFromPointer(e: PointerEvent) {
  const rect = railEl.value?.getBoundingClientRect();
  if (!rect) return min.value;
  const ratio = props.vertical
    ? 1 - (e.clientY - rect.top) / rect.height
    : (e.clientX - rect.left) / rect.width;
  const visualRatio = props.reverse ? 1 - ratio : ratio;
  return min.value + Math.min(1, Math.max(0, visualRatio)) * (max.value - min.value);
}
function closestThumb(v: number) {
  if (!isRange.value) return 0;
  return Math.abs(v - values.value[0]) <= Math.abs(v - values.value[1]) ? 0 : 1;
}

function updateFromPointer(e: PointerEvent) {
  if (activeThumb.value == null) return;
  setValue(activeThumb.value, valueFromPointer(e));
}
function onPointerMove(e: PointerEvent) {
  updateFromPointer(e);
}
function onPointerUp() {
  dragging.value = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  emitChange();
  emit('dragEnd', model.value);
  formItem?.onFieldBlur();
}
function beginDrag(e: PointerEvent, index: number) {
  if (props.disabled || props.readonly) return;
  e.preventDefault();
  activeThumb.value = index;
  dragging.value = true;
  thumbEls.value[index]?.focus();
  setValue(index, valueFromPointer(e));
  emit('dragStart', model.value);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}
function onRailPointerdown(e: PointerEvent) {
  if (props.disabled || props.readonly) return;
  if (e.target !== railEl.value && (e.target as HTMLElement).closest('[data-part="thumb"]')) return;
  const index = closestThumb(valueFromPointer(e));
  beginDrag(e, index);
}
function onThumbPointerdown(e: PointerEvent, index: number) {
  beginDrag(e, index);
}
function onThumbEnter(index: number) {
  if (!dragging.value) hoverThumb.value = index;
}
function onThumbLeave(index: number) {
  if (hoverThumb.value === index) hoverThumb.value = null;
}
function onThumbKeydown(e: KeyboardEvent, index: number) {
  if (props.disabled || props.readonly) return;
  const unit = e.shiftKey ? step.value * 10 : step.value;
  let next = values.value[index];
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      next += unit;
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      next -= unit;
      break;
    case 'PageUp':
      next += step.value * 10;
      break;
    case 'PageDown':
      next -= step.value * 10;
      break;
    case 'Home':
      next = min.value;
      break;
    case 'End':
      next = max.value;
      break;
    default:
      return;
  }
  e.preventDefault();
  setValue(index, next);
  emitChange();
  formItem?.onFieldBlur();
}

const rootAttrs = { 'data-part': 'root' };
const railAttrs = { 'data-part': 'rail' };
const railOn: KOnPack = { pointerdown: (e) => onRailPointerdown(e as PointerEvent) };
function thumbAttrs(index: number) {
  const v = values.value[index];
  return {
    role: 'slider',
    tabindex: props.disabled ? -1 : 0,
    'aria-valuemin': isRange.value && index === 1 ? values.value[0] : min.value,
    'aria-valuemax': isRange.value && index === 0 ? values.value[1] : max.value,
    'aria-valuenow': v,
    'aria-valuetext': tooltipText(v),
    'aria-orientation': props.vertical ? 'vertical' : 'horizontal',
    'aria-disabled': props.disabled || undefined,
    'aria-readonly': props.readonly || undefined,
  };
}
function thumbOn(index: number): KOnPack {
  return {
    pointerdown: (e) => onThumbPointerdown(e as PointerEvent, index),
    keydown: (e) => onThumbKeydown(e as KeyboardEvent, index),
    pointerenter: () => onThumbEnter(index),
    pointerleave: () => onThumbLeave(index),
  };
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
});

const rootStyle = computed<CSSProperties>(() => ({
  ...(markEntries.value.length ? { '--k-slider-mark-space': '24px' } : {}),
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KSliderRenderScope>(
  () => props.render,
  () => ({
    values: values.value,
    percents: percents.value,
    isRange: isRange.value,
    vertical: props.vertical,
    disabled: props.disabled,
    readonly: props.readonly,
    min: min.value,
    max: max.value,
    step: step.value,
    activeThumb: activeThumb.value,
    rootAttrs,
    railAttrs,
    railOn,
    thumbAttrs,
    thumbOn,
    setValue,
    slots,
  }),
);

defineSlots<{
  render?(scope: KSliderRenderScope): VNodeChild;
}>();
</script>

<style>
.k-slider {
  --k-slider-rail-size: 8px;
  --k-slider-thumb-size: 16px;
  --k-slider-active-color: var(--k-color-primary);
  --k-slider-rail-color: var(--k-color-fill-secondary);
  --k-slider-mark-color: var(--k-color-text-tertiary);
  --k-slider-mark-space: 0px;

  position: relative;
  display: block;
  width: 100%;
  padding-block: calc(var(--k-slider-thumb-size) / 2) calc(var(--k-slider-thumb-size) / 2 + var(--k-slider-mark-space));
  color: var(--k-color-text);
  font-size: var(--k-font-size-sm);
}
.k-slider *,
.k-slider *::before,
.k-slider *::after {
  box-sizing: border-box;
}
.k-slider--sm { --k-slider-rail-size: 4px; --k-slider-thumb-size: 12px; }
.k-slider--lg { --k-slider-rail-size: 12px; --k-slider-thumb-size: 20px; }
.k-slider.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.k-slider__rail {
  position: relative;
  height: var(--k-slider-rail-size);
  border-radius: 999px;
  background: var(--k-slider-rail-color);
  cursor: pointer;
  touch-action: none;
}
.k-slider__track {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: inherit;
  background: var(--k-slider-active-color);
  transition: left var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    width var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-slider__thumb-wrap {
  position: absolute;
  top: 50%;
  left: var(--k-slider-percent, 0%);
  width: var(--k-slider-thumb-size);
  height: var(--k-slider-thumb-size);
  transform: translate(-50%, -50%);
  z-index: 1;
}
.k-slider__thumb {
  display: block;
  width: 100%;
  height: 100%;
  border: calc(var(--k-slider-thumb-size) / 8) solid var(--k-slider-active-color);
  border-radius: 50%;
  background: var(--k-color-bg-container);
  box-shadow: 0 0 0 2px var(--k-color-bg-container);
  outline: none;
  cursor: grab;
  transition: box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-slider__thumb:focus-visible,
.k-slider__thumb.is-active {
  box-shadow:
    0 0 0 2px var(--k-color-bg-container),
    0 0 0 calc(2px + var(--k-control-outline-width)) var(--k-control-outline);
}
.k-slider.is-disabled .k-slider__thumb {
  cursor: not-allowed;
}
.k-slider__tooltip {
  position: absolute;
  bottom: calc(100% + var(--k-size-xs));
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 6px;
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-bg-spotlight);
  color: var(--k-color-text-light-solid);
  font-size: var(--k-font-size-sm);
  line-height: var(--k-line-height);
  white-space: nowrap;
  pointer-events: none;
}
.k-slider__mark {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--k-slider-mark-color);
  font-size: var(--k-font-size-sm);
  pointer-events: none;
}
.k-slider__mark-dot {
  display: block;
  width: 4px;
  height: 4px;
  margin: 0 auto;
  border-radius: 50%;
  background: currentColor;
}
.k-slider__mark-label {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
.k-slider--error { --k-slider-active-color: var(--k-color-error); }
.k-slider--warning { --k-slider-active-color: var(--k-color-warning); }

.k-slider--vertical {
  display: inline-flex;
  width: auto;
  height: 200px;
  padding: 0 calc(var(--k-slider-thumb-size) / 2 + var(--k-slider-mark-space));
}
.k-slider--vertical .k-slider__rail {
  width: var(--k-slider-rail-size);
  height: 100%;
}
.k-slider--vertical .k-slider__track {
  inset-block: auto;
  inset-inline: 0;
  bottom: 0;
}
.k-slider--vertical .k-slider__thumb-wrap {
  top: auto;
  left: 50%;
  transform: translate(-50%, 50%);
}
.k-slider--vertical .k-slider__tooltip {
  bottom: 50%;
  left: calc(100% + var(--k-size-xs));
  transform: translateY(50%);
}
.k-slider--vertical .k-slider__mark {
  left: 50%;
  top: auto;
  transform: translate(-50%, 50%);
}
.k-slider--vertical .k-slider__mark-label {
  top: 50%;
  left: calc(100% + 6px);
  transform: translateY(-50%);
}
@media (prefers-reduced-motion: reduce) {
  .k-slider__track,
  .k-slider__thumb {
    transition: none;
  }
}
</style>