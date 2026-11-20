<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-timepicker"
    :class="[
      `k-timepicker--${size}`,
      {
        'is-open': open,
        'is-range': rangeMode,
        'is-disabled': disabled,
        'is-readonly': readonly,
        'k-timepicker--error': effectiveStatus === 'error',
        'k-timepicker--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <input
      v-bind="triggerAttrs"
      class="k-timepicker__input"
      :class="classNames?.trigger"
      :style="styles?.trigger"
      :value="displayValue"
      :placeholder="placeholderText"
      :disabled="disabled"
      v-on="triggerOn"
    />
    <span data-part="suffix" class="k-timepicker__suffix" :class="classNames?.suffix" :style="styles?.suffix">
      <slot name="suffix" />
      <span v-if="showClear" class="k-timepicker__clear" role="button" aria-label="清除" v-on="clearOn">
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
      </span>
      <span class="k-timepicker__clock" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.4 1.5" /></svg>
      </span>
    </span>
    <Teleport :to="teleportTarget" defer>
      <Transition name="k-timepicker-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-timepicker__popup"
          :class="classNames?.popup"
          :style="[popupStyle, styles?.popup]"
        >
          <div class="k-timepicker__panels">
            <div
              v-for="panel in panels"
              :key="panel"
              class="k-timepicker__panel"
              :class="{ 'is-active': rangeMode && activePanel === panel }"
              @click="activePanel = panel"
            >
              <div v-if="rangeMode" class="k-timepicker__panel-title">
                {{ panel === 0 ? '开始时间' : '结束时间' }}
              </div>
              <div class="k-timepicker__columns">
                <div class="k-timepicker__column" role="listbox" aria-label="小时">
                  <button
                    v-for="h in hours"
                    :key="h"
                    type="button"
                    class="k-timepicker__cell"
                    :class="{ 'is-selected': draft[panel].hour === h }"
                    :data-selected="draft[panel].hour === h || undefined"
                    role="option"
                    :aria-selected="draft[panel].hour === h"
                    :disabled="isDisabled('hour', h)"
                    @click.stop="setPart(panel, 'hour', h)"
                  >{{ formatTimeLabel(h) }}</button>
                </div>
                <div class="k-timepicker__column" role="listbox" aria-label="分钟">
                  <button
                    v-for="m in minutes"
                    :key="m"
                    type="button"
                    class="k-timepicker__cell"
                    :class="{ 'is-selected': draft[panel].minute === m }"
                    :data-selected="draft[panel].minute === m || undefined"
                    role="option"
                    :aria-selected="draft[panel].minute === m"
                    :disabled="isDisabled('minute', m)"
                    @click.stop="setPart(panel, 'minute', m)"
                  >{{ formatTimeLabel(m) }}</button>
                </div>
                <div v-if="showSeconds" class="k-timepicker__column" role="listbox" aria-label="秒">
                  <button
                    v-for="s in seconds"
                    :key="s"
                    type="button"
                    class="k-timepicker__cell"
                    :class="{ 'is-selected': draft[panel].second === s }"
                    :data-selected="draft[panel].second === s || undefined"
                    role="option"
                    :aria-selected="draft[panel].second === s"
                    :disabled="isDisabled('second', s)"
                    @click.stop="setPart(panel, 'second', s)"
                  >{{ formatTimeLabel(s) }}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="k-timepicker__footer">
            <button type="button" class="k-timepicker__now" @mousedown.prevent @click="setNow">此刻</button>
            <span class="k-timepicker__actions">
              <button type="button" class="k-timepicker__clear-btn" @mousedown.prevent @click="clear">清除</button>
              <button type="button" class="k-timepicker__confirm" @mousedown.prevent @click="confirm">确定</button>
            </span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useOverlayPosition, usePopupDismiss, usePopupHost } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import {
  buildTimeList,
  formatTimeLabel,
  formatTimeString,
  parseTimeString,
} from '../../utils/time';
import type { KTimeParts } from '../../utils/time';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KTimePicker' });

export type KTimePickerValue = string | [string, string] | null;
export type KTimePickerSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KTimePickerStatus = 'error' | 'warning';
type TimeUnit = 'hour' | 'minute' | 'second';
type TimePickerPart = 'root' | 'trigger' | 'suffix' | 'popup';

export interface KTimePickerRenderScope {
  value: KTimePickerValue;
  displayValue: string;
  open: boolean;
  range: boolean;
  showSeconds: boolean;
  draft: KTimeParts[];
  activePanel: number;
  disabled: boolean;
  readonly: boolean;
  size: KTimePickerSize;
  status: KTimePickerStatus | undefined;
  rootAttrs: Record<string, unknown>;
  triggerAttrs: Record<string, unknown>;
  triggerOn: KOnPack;
  setOpen: (value: boolean) => void;
  confirm: () => void;
  clear: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KTimePickerProps {
  format?: string;
  range?: boolean;
  hourStep?: number;
  minuteStep?: number;
  secondStep?: number;
  disabledHours?: number[] | ((hour: number) => boolean);
  disabledMinutes?: number[] | ((minute: number) => boolean);
  disabledSeconds?: number[] | ((second: number) => boolean);
  allowClear?: boolean;
  placeholder?: string | [string, string];
  disabled?: boolean;
  readonly?: boolean;
  size?: KTimePickerSize;
  status?: KTimePickerStatus;
  rangeSeparator?: string;
  ariaLabel?: string;
  render?: KRenderFn<KTimePickerRenderScope>;
  classNames?: Partial<Record<TimePickerPart, string>>;
  styles?: Partial<Record<TimePickerPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KTimePickerProps>(), {
  format: 'HH:mm:ss',
  range: false,
  hourStep: 1,
  minuteStep: 1,
  secondStep: 1,
  allowClear: true,
  placeholder: '请选择时间',
  disabled: false,
  readonly: false,
  size: 'md',
  rangeSeparator: ' ~ ',
  ariaLabel: '时间选择',
});

const emit = defineEmits<{
  change: [value: KTimePickerValue];
  openChange: [open: boolean];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
}>();

const model = defineModel<KTimePickerValue>({ default: null });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const rootEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const open = ref(false);
const activePanel = ref(0);

const showSeconds = computed(() => /s/i.test(props.format));
const rangeMode = computed(() => props.range || Array.isArray(model.value));
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);
const hours = computed(() => buildTimeList(props.hourStep, 23));
const minutes = computed(() => buildTimeList(props.minuteStep, 59));
const seconds = computed(() => buildTimeList(props.secondStep, 59));
const panels = computed(() => (rangeMode.value ? [0, 1] : [0]));

function nowParts(): KTimeParts {
  const d = new Date();
  return { hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
}
function initialDraft(): KTimeParts[] {
  const now = nowParts();
  if (rangeMode.value) {
    const pair = Array.isArray(model.value) ? model.value : [];
    return [
      parseTimeString(pair[0]) ?? now,
      parseTimeString(pair[1]) ?? { ...now, hour: Math.min(23, now.hour + 1) },
    ];
  }
  const single = Array.isArray(model.value) ? model.value[0] : model.value;
  return [parseTimeString(single) ?? now];
}
const draft = ref<KTimeParts[]>(initialDraft());

const displayValue = computed(() => {
  if (rangeMode.value) {
    if (!Array.isArray(model.value)) return '';
    const [a, b] = model.value;
    return a || b ? `${a ?? ''}${props.rangeSeparator}${b ?? ''}` : '';
  }
  return Array.isArray(model.value) ? model.value[0] ?? '' : model.value ?? '';
});
const placeholderText = computed(() =>
  Array.isArray(props.placeholder)
    ? props.placeholder.join(props.rangeSeparator)
    : String(props.placeholder),
);
const showClear = computed(() => props.allowClear && !!displayValue.value && !props.disabled && !props.readonly);

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

function isDisabled(unit: TimeUnit, value: number) {
  const cfg = unit === 'hour' ? props.disabledHours : unit === 'minute' ? props.disabledMinutes : props.disabledSeconds;
  return Array.isArray(cfg) ? cfg.includes(value) : cfg?.(value) ?? false;
}

function setOpen(value: boolean) {
  if (props.disabled || props.readonly) return;
  if (value === open.value) return;
  if (value) draft.value = initialDraft();
  open.value = value;
  emit('openChange', value);
  if (value) {
    activePanel.value = 0;
    nextTick(() => {
      popupEl.value?.querySelectorAll<HTMLElement>('[data-selected="true"]').forEach((el) => {
        el.scrollIntoView({ block: 'center' });
      });
    });
  } else {
    formItem?.onFieldBlur();
  }
}

function setPart(panel: number, unit: TimeUnit, value: number) {
  draft.value = draft.value.map((item, i) => (i === panel ? { ...item, [unit]: value } : item));
}

function setNow() {
  const now = nowParts();
  draft.value = draft.value.map((item, i) =>
    i === activePanel.value ? now : item,
  );
}

function confirm() {
  if (rangeMode.value) {
    const [a, b] = draft.value;
    model.value = [
      formatTimeString(a, showSeconds.value),
      formatTimeString(b, showSeconds.value),
    ];
  } else {
    model.value = formatTimeString(draft.value[0], showSeconds.value);
  }
  emit('change', model.value);
  formItem?.onFieldChange();
  formItem?.onFieldBlur();
  setOpen(false);
}

function clear() {
  model.value = null;
  emit('change', null);
  formItem?.onFieldChange();
  setOpen(false);
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled || props.readonly) return;
  if (!open.value && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
    e.preventDefault();
    setOpen(true);
  } else if (open.value && e.key === 'Escape') {
    e.stopPropagation();
    setOpen(false);
  }
}

usePopupDismiss(open, () => setOpen(false), () => [rootEl.value, popupEl.value]);
onBeforeUnmount(() => {
  open.value = false;
});

const rootAttrs = { 'data-part': 'root' };
const triggerAttrs = computed(() => ({
  id: formItem?.controlId,
  role: 'combobox',
  readonly: true,
  'aria-label': props.ariaLabel,
  'aria-expanded': open.value,
  'aria-haspopup': 'dialog',
  'aria-disabled': props.disabled || undefined,
  'aria-invalid': formItem?.invalid.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
}));
const triggerOn: KOnPack = {
  click: () => setOpen(!open.value),
  keydown: (e) => onTriggerKeydown(e as KeyboardEvent),
  focus: (e) => emit('focus', e as FocusEvent),
  blur: (e) => emit('blur', e as FocusEvent),
};
const clearOn: KOnPack = {
  mousedown: (e) => {
    e.preventDefault();
    e.stopPropagation();
    clear();
  },
};

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTimePickerRenderScope>(
  () => props.render,
  () => ({
    value: model.value,
    displayValue: displayValue.value,
    open: open.value,
    range: rangeMode.value,
    showSeconds: showSeconds.value,
    draft: draft.value,
    activePanel: activePanel.value,
    disabled: props.disabled,
    readonly: props.readonly,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    triggerAttrs: triggerAttrs.value,
    triggerOn,
    setOpen,
    confirm,
    clear,
    slots,
  }),
);

defineSlots<{
  suffix?(): VNodeChild;
  render?(scope: KTimePickerRenderScope): VNodeChild;
}>();

defineExpose({ open: () => setOpen(true), close: () => setOpen(false) });
</script>

<style>
.k-timepicker {
  --k-timepicker-height: var(--k-control-height);
  --k-timepicker-radius: var(--k-border-radius);
  --k-timepicker-border: var(--k-color-border);
  --k-timepicker-bg: var(--k-color-bg-container);
  --k-timepicker-focus-border: var(--k-color-primary);
  --k-timepicker-panel-width: 232px;

  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  font-family: inherit;
  color: var(--k-color-text);
}
.k-timepicker *,
.k-timepicker *::before,
.k-timepicker *::after {
  box-sizing: border-box;
}
.k-timepicker__input {
  width: 100%;
  min-height: var(--k-timepicker-height);
  padding: 0 calc(var(--k-size-sm) + 1.6em) 0 var(--k-size-sm);
  border: var(--k-line-width) solid var(--k-timepicker-border);
  border-radius: var(--k-timepicker-radius);
  outline: none;
  background: var(--k-timepicker-bg);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
  cursor: pointer;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-timepicker__input::placeholder {
  color: var(--k-color-text-tertiary);
}
.k-timepicker:not(.is-disabled) .k-timepicker__input:hover {
  border-color: var(--k-color-primary-hover);
}
.k-timepicker.is-open .k-timepicker__input,
.k-timepicker__input:focus-visible {
  border-color: var(--k-timepicker-focus-border);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-timepicker.is-disabled .k-timepicker__input {
  cursor: not-allowed;
  background: var(--k-color-fill-secondary);
}
.k-timepicker--error .k-timepicker__input { border-color: var(--k-color-error); }
.k-timepicker--warning .k-timepicker__input { border-color: var(--k-color-warning); }
.k-timepicker__suffix {
  position: absolute;
  right: var(--k-size-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-color-text-tertiary);
  pointer-events: none;
}
.k-timepicker__clear {
  cursor: pointer;
  pointer-events: auto;
}

.k-timepicker__popup {
  z-index: var(--k-z-index-popup, 1000);
  padding: var(--k-popup-padding);
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-elevated);
  box-shadow: var(--k-box-shadow-secondary);
}
.k-timepicker__panels {
  display: flex;
  gap: var(--k-size-sm);
}
.k-timepicker__panel {
  min-width: var(--k-timepicker-panel-width);
  padding: var(--k-size-xxs);
  border: var(--k-line-width) solid transparent;
  border-radius: var(--k-border-radius-sm);
}
.k-timepicker__panel.is-active {
  border-color: var(--k-color-primary-border);
  background: var(--k-color-primary-bg);
}
.k-timepicker__panel-title {
  margin-bottom: var(--k-size-xxs);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
  text-align: center;
}
.k-timepicker__columns {
  display: flex;
  gap: 2px;
  height: 216px;
}
.k-timepicker__column {
  flex: 1;
  min-width: 52px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.k-timepicker__cell {
  display: block;
  width: 100%;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-font-size-sm);
  line-height: 30px;
  text-align: center;
  cursor: pointer;
}
.k-timepicker__cell:hover:not(:disabled) {
  background: var(--k-color-fill-secondary);
}
.k-timepicker__cell.is-selected {
  background: var(--k-color-primary);
  color: var(--k-color-text-light-solid);
}
.k-timepicker__cell:disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-timepicker__cell:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-timepicker__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--k-size-xs);
  padding-top: var(--k-size-xs);
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-timepicker__actions {
  display: inline-flex;
  gap: var(--k-size-xs);
}
.k-timepicker__now,
.k-timepicker__clear-btn,
.k-timepicker__confirm {
  padding: 2px var(--k-size-xs);
  border: 0;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-primary);
  font-family: inherit;
  font-size: var(--k-font-size-sm);
  cursor: pointer;
}
.k-timepicker__now:hover,
.k-timepicker__clear-btn:hover,
.k-timepicker__confirm:hover {
  background: var(--k-color-fill-secondary);
}
.k-timepicker__confirm {
  background: var(--k-color-primary);
  color: var(--k-color-text-light-solid);
}
.k-timepicker__confirm:hover {
  background: var(--k-color-primary-hover);
}
.k-timepicker__now:focus-visible,
.k-timepicker__clear-btn:focus-visible,
.k-timepicker__confirm:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
@media (max-width: 640px) {
  .k-timepicker__popup {
    max-width: calc(100vw - var(--k-size-lg));
  }
  .k-timepicker__panels {
    max-width: 100%;
  }
  .k-timepicker__panel {
    min-width: 0;
    flex: 1;
  }
}
</style>