<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-colorpicker"
    :class="[
      `k-colorpicker--${size}`,
      {
        'is-open': open,
        'is-disabled': disabled,
        'k-colorpicker--error': effectiveStatus === 'error',
        'k-colorpicker--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <button
      v-bind="triggerAttrs"
      type="button"
      class="k-colorpicker__trigger"
      :class="classNames?.trigger"
      :style="styles?.trigger"
      :disabled="disabled"
      v-on="triggerOn"
    >
      <span data-part="swatch" class="k-colorpicker__swatch" :class="classNames?.swatch" :style="[swatchStyle, styles?.swatch]">
        <span class="k-colorpicker__swatch-color" :style="{ background: displayColor }" />
      </span>
      <span v-if="showText" class="k-colorpicker__text" :class="classNames?.text" :style="styles?.text">
        {{ displayColor }}
      </span>
      <span v-if="showClear" class="k-colorpicker__clear" role="button" aria-label="清除" @mousedown.prevent.stop="clear">
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
      </span>
    </button>
    <Teleport :to="teleportTarget" defer>
      <Transition name="k-colorpicker-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-colorpicker__popup"
          :class="classNames?.popup"
          :style="[popupStyle, styles?.popup]"
          role="dialog"
          :aria-label="ariaLabel"
        >
          <div
            ref="svEl"
            data-part="sv"
            class="k-colorpicker__sv"
            :class="classNames?.sv"
            :style="[svStyle, styles?.sv]"
            @pointerdown="onSvPointerdown"
          >
            <span class="k-colorpicker__sv-thumb" :style="svThumbStyle" />
          </div>
          <div class="k-colorpicker__sliders">
            <label class="k-colorpicker__slider-row">
              <span class="k-colorpicker__slider-label">色相</span>
              <input
                class="k-colorpicker__range k-colorpicker__range--hue"
                type="range"
                min="0"
                max="360"
                step="1"
                :value="Math.round(hsv.h)"
                @input="onHueInput"
              />
            </label>
            <label v-if="alpha" class="k-colorpicker__slider-row">
              <span class="k-colorpicker__slider-label">透明度</span>
              <span class="k-colorpicker__alpha-wrap">
                <span class="k-colorpicker__alpha-color" :style="alphaColorStyle" />
                <input
                  class="k-colorpicker__range k-colorpicker__range--alpha"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  :value="Math.round(alphaValue * 100)"
                  @input="onAlphaInput"
                />
              </span>
            </label>
          </div>
          <div class="k-colorpicker__input-row">
            <span class="k-colorpicker__preview" :style="{ background: displayColor }" />
            <input
              class="k-colorpicker__input"
              :value="textValue"
              :placeholder="format"
              @input="textValue = ($event.target as HTMLInputElement).value"
              @keydown.enter.prevent="commitText"
              @blur="commitText"
            />
          </div>
          <div v-if="presets.length" class="k-colorpicker__presets">
            <button
              v-for="preset in presets"
              :key="preset"
              type="button"
              class="k-colorpicker__preset"
              :class="{ 'is-active': isPresetActive(preset) }"
              :style="{ background: preset }"
              :aria-label="preset"
              @click="applyPreset(preset)"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, useSlots, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useOverlayPosition, usePopupDismiss, usePopupHost } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import {
  formatColor,
  hsvToRgb,
  parseColor,
  rgbToHsv,
} from '../../utils/color';
import type { KColorFormat, KColorValue, KHsvValue } from '../../utils/color';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KColorPicker' });

export type KColorPickerSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KColorPickerStatus = 'error' | 'warning';
type ColorPickerPart = 'root' | 'trigger' | 'swatch' | 'text' | 'popup' | 'sv';

export interface KColorPickerRenderScope {
  value: string;
  displayColor: string;
  open: boolean;
  hsv: KHsvValue;
  alpha: number;
  format: KColorFormat;
  presets: string[];
  disabled: boolean;
  size: KColorPickerSize;
  status: KColorPickerStatus | undefined;
  rootAttrs: Record<string, unknown>;
  triggerAttrs: Record<string, unknown>;
  triggerOn: KOnPack;
  setOpen: (value: boolean) => void;
  setColor: (color: KColorValue) => void;
  clear: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KColorPickerProps {
  format?: KColorFormat;
  alpha?: boolean;
  presets?: string[];
  showText?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  size?: KColorPickerSize;
  status?: KColorPickerStatus;
  ariaLabel?: string;
  render?: KRenderFn<KColorPickerRenderScope>;
  classNames?: Partial<Record<ColorPickerPart, string>>;
  styles?: Partial<Record<ColorPickerPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KColorPickerProps>(), {
  format: 'hex',
  alpha: false,
  presets: () => [],
  showText: true,
  allowClear: false,
  disabled: false,
  size: 'md',
  ariaLabel: '颜色选择',
});

const emit = defineEmits<{
  change: [value: string];
  changeComplete: [value: string];
  openChange: [open: boolean];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
}>();

const model = defineModel<string>({ default: '#1677ff' });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const rootEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const svEl = ref<HTMLElement | null>(null);
const open = ref(false);
const hsv = ref<KHsvValue>({ h: 0, s: 0, v: 0 });
const alphaValue = ref(1);
const textValue = ref('');
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

function parseModel(value: string): KColorValue {
  return parseColor(value) ?? { r: 23, g: 119, b: 255, a: 1 };
}
function syncFrom(value: string) {
  const color = parseModel(value);
  hsv.value = rgbToHsv(color.r, color.g, color.b);
  alphaValue.value = props.alpha ? color.a : 1;
  textValue.value = value;
}
watch(
  () => model.value,
  (value) => syncFrom(value ?? ''),
  { immediate: true },
);

const displayColor = computed(() => {
  if (!model.value && props.allowClear) return '';
  const rgb = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
  return formatColor({ ...rgb, a: props.alpha ? alphaValue.value : 1 }, props.format, props.alpha);
});
const showClear = computed(() => props.allowClear && !!model.value && !props.disabled);

const swatchStyle = computed<CSSProperties>(() => ({
  '--k-colorpicker-current': `rgb(${hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v).r}, ${hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v).g}, ${hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v).b})`,
}));
const svStyle = computed<CSSProperties>(() => ({
  '--k-colorpicker-hue-color': `hsl(${hsv.value.h}, 100%, 50%)`,
}));
const svThumbStyle = computed<CSSProperties>(() => ({
  left: `${hsv.value.s * 100}%`,
  top: `${(1 - hsv.value.v) * 100}%`,
}));
const alphaColorStyle = computed<CSSProperties>(() => {
  const rgb = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
  return { background: `linear-gradient(to right, transparent, rgb(${rgb.r}, ${rgb.g}, ${rgb.b}))` };
});

const { teleportTarget, popupClasses, popupTheme } = usePopupHost();
const { popupStyle: overlayStyle } = useOverlayPosition({
  anchor: rootEl,
  popup: popupEl,
  visible: open,
  placement: () => 'bottomLeft',
  target: teleportTarget,
  gap: 4,
});
const popupStyle = computed<CSSProperties>(() => ({ ...overlayStyle.value }));
const popupAttrs = computed(() => ({
  class: popupClasses.value,
  'data-part': 'popup',
  'data-k-theme': popupTheme.value,
}));

function commit(color: KColorValue, complete = false) {
  const value = formatColor(color, props.format, props.alpha);
  model.value = value;
  textValue.value = value;
  emit('change', value);
  if (complete) emit('changeComplete', value);
  formItem?.onFieldChange();
}
function currentColor(): KColorValue {
  const rgb = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
  return { ...rgb, a: props.alpha ? alphaValue.value : 1 };
}
function setColor(color: KColorValue, complete = false) {
  hsv.value = rgbToHsv(color.r, color.g, color.b);
  alphaValue.value = props.alpha ? color.a : 1;
  commit(color, complete);
}

function setOpen(value: boolean) {
  if (props.disabled) return;
  if (value === open.value) return;
  if (value) syncFrom(model.value ?? '');
  open.value = value;
  emit('openChange', value);
  if (!value) formItem?.onFieldBlur();
}

let svDragging = false;
function updateSv(e: PointerEvent) {
  const rect = svEl.value?.getBoundingClientRect();
  if (!rect) return;
  hsv.value = {
    ...hsv.value,
    s: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    v: Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height)),
  };
  commit(currentColor());
}
function onSvPointerdown(e: PointerEvent) {
  e.preventDefault();
  svDragging = true;
  updateSv(e);
  window.addEventListener('pointermove', onSvMove);
  window.addEventListener('pointerup', onSvUp);
  window.addEventListener('pointercancel', onSvUp);
}
function onSvMove(e: PointerEvent) {
  if (svDragging) updateSv(e);
}
function onSvUp() {
  svDragging = false;
  window.removeEventListener('pointermove', onSvMove);
  window.removeEventListener('pointerup', onSvUp);
  window.removeEventListener('pointercancel', onSvUp);
  emit('changeComplete', displayColor.value);
}
function onHueInput(e: Event) {
  hsv.value = { ...hsv.value, h: Number((e.target as HTMLInputElement).value) };
  commit(currentColor());
}
function onAlphaInput(e: Event) {
  alphaValue.value = Number((e.target as HTMLInputElement).value) / 100;
  commit(currentColor());
}
function commitText() {
  const parsed = parseColor(textValue.value);
  if (!parsed) {
    textValue.value = displayColor.value;
    return;
  }
  hsv.value = rgbToHsv(parsed.r, parsed.g, parsed.b);
  alphaValue.value = props.alpha ? parsed.a : 1;
  commit({ ...parsed, a: props.alpha ? parsed.a : 1 }, true);
}
function applyPreset(preset: string) {
  const parsed = parseColor(preset);
  if (parsed) setColor(parsed, true);
}
function isPresetActive(preset: string) {
  if (!model.value) return false;
  const parsed = parseColor(preset);
  if (!parsed) return false;
  const current = currentColor();
  return parsed.r === current.r && parsed.g === current.g && parsed.b === current.b && (!props.alpha || Math.abs(parsed.a - current.a) < 0.01);
}
function clear() {
  model.value = '';
  emit('change', '');
  formItem?.onFieldChange();
  setOpen(false);
}
function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation();
    setOpen(false);
  } else if (!open.value && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
    e.preventDefault();
    setOpen(true);
  }
}

usePopupDismiss(open, () => setOpen(false), () => [rootEl.value, popupEl.value]);
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onSvMove);
  window.removeEventListener('pointerup', onSvUp);
  window.removeEventListener('pointercancel', onSvUp);
  open.value = false;
});

const rootAttrs = { 'data-part': 'root' };
const triggerAttrs = computed(() => ({
  id: formItem?.controlId,
  'aria-label': props.ariaLabel,
  'aria-expanded': open.value,
  'aria-haspopup': 'dialog',
  'aria-disabled': props.disabled || undefined,
}));
const triggerOn: KOnPack = {
  click: () => setOpen(!open.value),
  keydown: (e) => onTriggerKeydown(e as KeyboardEvent),
  focus: (e) => emit('focus', e as FocusEvent),
  blur: (e) => emit('blur', e as FocusEvent),
};

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KColorPickerRenderScope>(
  () => props.render,
  () => ({
    value: model.value,
    displayColor: displayColor.value,
    open: open.value,
    hsv: hsv.value,
    alpha: alphaValue.value,
    format: props.format,
    presets: props.presets,
    disabled: props.disabled,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    triggerAttrs: triggerAttrs.value,
    triggerOn,
    setOpen,
    setColor,
    clear,
    slots,
  }),
);

defineSlots<{
  render?(scope: KColorPickerRenderScope): VNodeChild;
}>();

defineExpose({ open: () => setOpen(true), close: () => setOpen(false) });
</script>

<style>
.k-colorpicker {
  --k-colorpicker-height: var(--k-control-height);
  --k-colorpicker-radius: var(--k-border-radius);
  --k-colorpicker-border: var(--k-color-border);
  --k-colorpicker-checker: repeating-conic-gradient(var(--k-color-fill-secondary) 0% 25%, var(--k-color-bg-container) 0% 50%) 50% / 8px 8px;

  position: relative;
  display: inline-flex;
  min-width: 0;
  font-family: inherit;
  color: var(--k-color-text);
}
.k-colorpicker *,
.k-colorpicker *::before,
.k-colorpicker *::after { box-sizing: border-box; }
.k-colorpicker__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  min-height: var(--k-colorpicker-height);
  padding: 0 var(--k-size-sm);
  border: var(--k-line-width) solid var(--k-colorpicker-border);
  border-radius: var(--k-colorpicker-radius);
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font: inherit;
  font-size: var(--k-font-size-sm);
  cursor: pointer;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-colorpicker:not(.is-disabled) .k-colorpicker__trigger:hover { border-color: var(--k-color-primary-hover); }
.k-colorpicker.is-open .k-colorpicker__trigger,
.k-colorpicker__trigger:focus-visible {
  border-color: var(--k-color-primary);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-colorpicker.is-disabled .k-colorpicker__trigger {
  cursor: not-allowed;
  background: var(--k-color-fill-secondary);
}
.k-colorpicker--error .k-colorpicker__trigger { border-color: var(--k-color-error); }
.k-colorpicker--warning .k-colorpicker__trigger { border-color: var(--k-color-warning); }
.k-colorpicker__swatch {
  flex: none;
  display: inline-block;
  width: 18px;
  height: 18px;
  overflow: hidden;
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius-sm);
  background: var(--k-colorpicker-checker);
}
.k-colorpicker__swatch-color { display: block; width: 100%; height: 100%; }
.k-colorpicker__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.k-colorpicker__clear { color: var(--k-color-text-tertiary); cursor: pointer; }
.k-colorpicker--sm .k-colorpicker__trigger { min-height: var(--k-control-height-sm); }
.k-colorpicker--lg .k-colorpicker__trigger { min-height: var(--k-control-height-lg); }

.k-colorpicker__popup {
  z-index: var(--k-z-index-popup, 1000);
  box-sizing: border-box;
  width: 248px;
  padding: var(--k-popup-padding);
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-elevated);
  box-shadow: var(--k-box-shadow-secondary);
}
.k-colorpicker__sv {
  position: relative;
  height: 148px;
  border-radius: var(--k-border-radius-sm);
  background:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, var(--k-colorpicker-hue-color));
  cursor: crosshair;
  touch-action: none;
}
.k-colorpicker__sv-thumb {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 35%);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.k-colorpicker__sliders {
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xs);
  margin-top: var(--k-size-sm);
}
.k-colorpicker__slider-row {
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
}
.k-colorpicker__slider-label {
  flex: none;
  width: 2.6em;
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
}
.k-colorpicker__range {
  appearance: none;
  width: 100%;
  height: 10px;
  margin: 0;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}
.k-colorpicker__range--hue {
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
}
.k-colorpicker__range--alpha {
  position: absolute;
  inset: 0;
  background: transparent;
}
.k-colorpicker__alpha-wrap {
  position: relative;
  flex: auto;
  height: 10px;
  border-radius: 999px;
  background: var(--k-colorpicker-checker);
}
.k-colorpicker__alpha-color { position: absolute; inset: 0; border-radius: inherit; }
.k-colorpicker__range::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--k-color-primary);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 25%);
}
.k-colorpicker__range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--k-color-primary);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 25%);
}
.k-colorpicker__range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 2px var(--k-control-outline); }
.k-colorpicker__input-row {
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  margin-top: var(--k-size-sm);
}
.k-colorpicker__preview {
  flex: none;
  width: 20px;
  height: 20px;
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius-sm);
}
.k-colorpicker__input {
  flex: auto;
  min-width: 0;
  height: var(--k-control-height-sm);
  padding: 0 var(--k-size-xs);
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-border-radius-sm);
  outline: none;
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font: inherit;
  font-size: var(--k-font-size-sm);
  font-variant-numeric: tabular-nums;
}
.k-colorpicker__input:focus { border-color: var(--k-color-primary); }
.k-colorpicker__presets {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  margin-top: var(--k-size-sm);
  padding-top: var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-colorpicker__preset {
  width: 18px;
  height: 18px;
  padding: 0;
  border: var(--k-line-width) solid transparent;
  border-radius: var(--k-border-radius-sm);
  cursor: pointer;
}
.k-colorpicker__preset.is-active {
  box-shadow: 0 0 0 2px var(--k-color-bg-elevated), 0 0 0 3px var(--k-color-primary);
}
.k-colorpicker__preset:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--k-control-outline);
}
@media (max-width: 640px) {
  .k-colorpicker__popup {
    max-width: calc(100vw - var(--k-size-lg));
  }
}
</style>