<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-mentions"
    :class="[
      `k-mentions--${size}`,
      {
        'is-disabled': disabled,
        'is-open': open,
        'is-readonly': readonly,
        'k-mentions--error': effectiveStatus === 'error',
        'k-mentions--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <textarea
      ref="textareaEl"
      v-bind="textareaAttrs"
      class="k-mentions__textarea"
      :class="classNames?.textarea"
      :style="styles?.textarea"
      :value="model"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      v-on="textareaOn"
    />
    <Teleport :to="teleportTarget" defer>
      <Transition name="k-mentions-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-mentions__popup"
          :class="classNames?.popup"
          :style="[{ width: popupWidth || undefined }, popupStyle, styles?.popup]"
        >
          <span
            v-if="!filteredOptions.length"
            class="k-mentions__empty"
            :class="classNames?.empty"
            :style="styles?.empty"
          >{{ notFoundContent }}</span>
          <template v-else>
            <span
              v-for="(option, i) in filteredOptions"
              :key="String(option.value)"
              v-bind="optionAttrs(option, i)"
              class="k-mentions__option"
              :class="[
                { 'is-active': i === activeIndex, 'is-disabled': option.disabled },
                classNames?.option,
              ]"
              :style="styles?.option"
              v-on="optionOn(option, i)"
            >
              <slot name="option" :option="option" :active="i === activeIndex">
                <span class="k-mentions__option-label">{{ option.label }}</span>
                <span v-if="option.value !== option.label" class="k-mentions__option-value">{{ option.value }}</span>
              </slot>
            </span>
          </template>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, useSlots, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useOverlayPosition, usePopupDismiss, usePopupHost } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KMentions' });

export interface KMentionsOption {
  label: string;
  value: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export type KMentionsSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KMentionsStatus = 'error' | 'warning';
type MentionsPart = 'root' | 'textarea' | 'popup' | 'option' | 'empty';

export interface KMentionsRenderScope {
  value: string;
  pattern: string;
  open: boolean;
  activeIndex: number;
  options: KMentionsOption[];
  disabled: boolean;
  readonly: boolean;
  size: KMentionsSize;
  status: KMentionsStatus | undefined;
  rootAttrs: Record<string, unknown>;
  textareaAttrs: Record<string, unknown>;
  textareaOn: KOnPack;
  popupAttrs: Record<string, unknown>;
  optionAttrs: (option: KMentionsOption, index: number) => Record<string, unknown>;
  optionOn: (option: KMentionsOption, index: number) => KOnPack;
  pick: (option: KMentionsOption) => void;
  setOpen: (value: boolean) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KMentionsProps {
  options?: KMentionsOption[];
  trigger?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  size?: KMentionsSize;
  status?: KMentionsStatus;
  maxlength?: number;
  notFoundContent?: string;
  filter?: (pattern: string, option: KMentionsOption) => boolean;
  ariaLabel?: string;
  render?: KRenderFn<KMentionsRenderScope>;
  classNames?: Partial<Record<MentionsPart, string>>;
  styles?: Partial<Record<MentionsPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KMentionsProps>(), {
  options: () => [],
  trigger: '@',
  rows: 3,
  placeholder: '',
  disabled: false,
  readonly: false,
  size: 'md',
  notFoundContent: '无匹配项',
  ariaLabel: '提及输入',
});

const emit = defineEmits<{
  change: [value: string];
  select: [option: KMentionsOption];
  search: [pattern: string];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
}>();

const model = defineModel<string>({ default: '' });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const uid = useId();
const rootEl = ref<HTMLElement | null>(null);
const textareaEl = ref<HTMLTextAreaElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const open = ref(false);
const pattern = ref('');
const triggerStart = ref(-1);
const activeIndex = ref(-1);
const popupWidth = ref('');

const effectiveStatus = computed(() => props.status ?? formItem?.status.value);
const filteredOptions = computed(() => {
  const p = pattern.value.toLowerCase();
  return props.options.filter((option) => {
    if (option.disabled) return true;
    if (!p) return true;
    return props.filter
      ? props.filter(pattern.value, option)
      : option.label.toLowerCase().includes(p) || option.value.toLowerCase().includes(p);
  });
});

const { teleportTarget, popupClasses } = usePopupHost();
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
  role: 'listbox',
  id: `${uid}-listbox`,
}));

function syncWidth() {
  const width = rootEl.value?.offsetWidth;
  if (width) popupWidth.value = `${Math.round(width)}px`;
}

function detectTrigger() {
  const el = textareaEl.value;
  const text = el?.value ?? model.value ?? '';
  const caret = el?.selectionStart ?? text.length;
  const before = text.slice(0, caret);
  const index = before.lastIndexOf(props.trigger);
  if (index < 0) {
    close();
    return;
  }
  const prev = before[index - 1];
  if (prev && !/[\s\n([{（]/.test(prev)) {
    close();
    return;
  }
  const query = before.slice(index + props.trigger.length);
  if (/[\s\n]/.test(query)) {
    close();
    return;
  }
  triggerStart.value = index;
  pattern.value = query;
  activeIndex.value = filteredOptions.value.findIndex((o) => !o.disabled);
  open.value = true;
  emit('search', query);
  nextTick(syncWidth);
}

function onInput(e: Event) {
  const value = (e.target as HTMLTextAreaElement).value;
  model.value = value;
  emit('change', value);
  formItem?.onFieldChange();
  detectTrigger();
}

function setOpen(value: boolean) {
  if (props.disabled || props.readonly) return;
  open.value = value;
  if (value) nextTick(syncWidth);
}

function close() {
  open.value = false;
  pattern.value = '';
  triggerStart.value = -1;
  activeIndex.value = -1;
}

usePopupDismiss(open, close, () => [rootEl.value, popupEl.value]);

function pick(option: KMentionsOption) {
  if (option.disabled) return;
  const el = textareaEl.value;
  const text = el?.value ?? model.value ?? '';
  const caret = el?.selectionStart ?? text.length;
  const start = triggerStart.value >= 0 ? triggerStart.value : caret;
  const insert = `${props.trigger}${option.label} `;
  model.value = text.slice(0, start) + insert + text.slice(caret);
  emit('change', model.value);
  emit('select', option);
  formItem?.onFieldChange();
  close();
  nextTick(() => {
    const nextCaret = start + insert.length;
    el?.focus();
    el?.setSelectionRange(nextCaret, nextCaret);
  });
}

function moveActive(dir: 1 | -1) {
  const list = filteredOptions.value;
  if (!list.length) return;
  let next = activeIndex.value;
  for (let i = 0; i < list.length; i += 1) {
    next = (next + dir + list.length) % list.length;
    if (!list[next].disabled) break;
  }
  activeIndex.value = next;
  nextTick(() => {
    popupEl.value
      ?.querySelector<HTMLElement>('.k-mentions__option.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  });
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  if (open.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      const option = filteredOptions.value[activeIndex.value];
      if (option) {
        e.preventDefault();
        pick(option);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
  }
  if (e.key === 'Escape') close();
}

function onFocus(e: FocusEvent) {
  emit('focus', e);
}

function onBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null;
  if (next && (rootEl.value?.contains(next) || popupEl.value?.contains(next))) return;
  close();
  emit('blur', e);
  formItem?.onFieldBlur();
}

watch(filteredOptions, (list) => {
  if (!open.value) return;
  if (activeIndex.value < 0 || activeIndex.value >= list.length) {
    activeIndex.value = list.findIndex((o) => !o.disabled);
  }
});

const rootAttrs = { 'data-part': 'root' };
const textareaAttrs = computed(() => ({
  id: formItem?.controlId,
  role: 'combobox',
  'aria-label': props.ariaLabel,
  'aria-autocomplete': 'list',
  'aria-expanded': open.value,
  'aria-controls': open.value ? `${uid}-listbox` : undefined,
  'aria-activedescendant':
    open.value && activeIndex.value >= 0 ? `${uid}-option-${activeIndex.value}` : undefined,
  'aria-invalid': formItem?.invalid.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
}));
const textareaOn: KOnPack = {
  input: onInput,
  keydown: (e) => onKeydown(e as KeyboardEvent),
  focus: (e) => onFocus(e as FocusEvent),
  blur: (e) => onBlur(e as FocusEvent),
  click: detectTrigger,
};
function optionAttrs(option: KMentionsOption, index: number) {
  return {
    id: `${uid}-option-${index}`,
    role: 'option',
    'aria-selected': index === activeIndex.value,
    'aria-disabled': option.disabled || undefined,
    'data-active': index === activeIndex.value || undefined,
  };
}
function optionOn(option: KMentionsOption, index: number): KOnPack {
  return {
    mousedown: (e) => {
      e.preventDefault();
      pick(option);
    },
    pointerenter: () => {
      if (!option.disabled) activeIndex.value = index;
    },
  };
}

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KMentionsRenderScope>(
  () => props.render,
  () => ({
    value: model.value,
    pattern: pattern.value,
    open: open.value,
    activeIndex: activeIndex.value,
    options: filteredOptions.value,
    disabled: props.disabled,
    readonly: props.readonly,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    textareaAttrs: textareaAttrs.value,
    textareaOn,
    popupAttrs: popupAttrs.value,
    optionAttrs,
    optionOn,
    pick,
    setOpen,
    slots,
  }),
);

defineSlots<{
  option?(scope: { option: KMentionsOption; active: boolean }): VNodeChild;
  render?(scope: KMentionsRenderScope): VNodeChild;
}>();

onBeforeUnmount(() => close());
</script>

<style>
.k-mentions {
  --k-mentions-height: var(--k-control-height);
  --k-mentions-radius: var(--k-border-radius);
  --k-mentions-border: var(--k-color-border);
  --k-mentions-bg: var(--k-color-bg-container);
  --k-mentions-focus-border: var(--k-color-primary);

  position: relative;
  display: inline-flex;
  width: 100%;
  min-width: 0;
  font-family: inherit;
  color: var(--k-color-text);
}
.k-mentions *,
.k-mentions *::before,
.k-mentions *::after {
  box-sizing: border-box;
}
.k-mentions__textarea {
  width: 100%;
  min-height: calc(var(--k-mentions-height) * 1.5);
  padding: var(--k-size-xs) var(--k-size-sm);
  border: var(--k-line-width) solid var(--k-mentions-border);
  border-radius: var(--k-mentions-radius);
  outline: none;
  background: var(--k-mentions-bg);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
  resize: vertical;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-mentions__textarea::placeholder {
  color: var(--k-color-text-tertiary);
}
.k-mentions__textarea:hover {
  border-color: var(--k-color-primary-hover);
}
.k-mentions__textarea:focus {
  border-color: var(--k-mentions-focus-border);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-mentions.is-disabled .k-mentions__textarea {
  cursor: not-allowed;
  color: var(--k-color-text-secondary);
  background: var(--k-color-fill-secondary);
}
.k-mentions--error .k-mentions__textarea { border-color: var(--k-color-error); }
.k-mentions--warning .k-mentions__textarea { border-color: var(--k-color-warning); }
.k-mentions--sm .k-mentions__textarea { padding: 4px var(--k-size-xs); }
.k-mentions--lg .k-mentions__textarea { padding: var(--k-size-sm) var(--k-size); }

.k-mentions__popup {
  z-index: var(--k-z-index-popup, 1000);
  min-width: 180px;
  max-height: 220px;
  padding: var(--k-popup-padding);
  overflow-y: auto;
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-elevated);
  box-shadow: var(--k-box-shadow-secondary);
}
.k-mentions__option {
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  min-height: var(--k-popup-item-height);
  padding: 0 var(--k-popup-item-padding-x);
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text);
  cursor: pointer;
}
.k-mentions__option:hover,
.k-mentions__option.is-active {
  background: var(--k-color-fill-secondary);
}
.k-mentions__option.is-disabled {
  color: var(--k-color-text-tertiary);
  cursor: not-allowed;
}
.k-mentions__option-label {
  flex: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-mentions__option-value {
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
}
.k-mentions__empty {
  display: block;
  padding: var(--k-size-xs);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  text-align: center;
}
</style>