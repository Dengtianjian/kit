<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-autocomplete"
    :class="[
      `k-autocomplete--${size}`,
      `k-autocomplete--${variant}`,
      {
        'is-disabled': disabled,
        'is-open': open,
        'is-readonly': readonly,
        'k-autocomplete--error': effectiveStatus === 'error',
        'k-autocomplete--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <span class="k-autocomplete__control" :class="classNames?.control" :style="styles?.control">
      <span v-if="$slots.prefix" class="k-autocomplete__prefix">
        <slot name="prefix" />
      </span>
      <input
        ref="inputEl"
        v-bind="inputAttrs"
        class="k-autocomplete__input"
        :class="classNames?.input"
        :style="styles?.input"
        :value="model"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :maxlength="maxlength"
        autocomplete="off"
        v-on="inputOn"
      />
      <span data-part="suffix" class="k-autocomplete__suffix" :class="classNames?.suffix" :style="styles?.suffix">
        <slot name="suffix" />
        <span v-if="loading" class="k-autocomplete__loading" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <circle cx="8" cy="8" r="6" stroke-opacity="0.25" />
            <path d="M14 8a6 6 0 0 0-6-6" />
          </svg>
        </span>
        <span v-if="showClear" class="k-autocomplete__clear" role="button" aria-label="清除" v-on="clearOn">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
        </span>
      </span>
    </span>
    <Teleport :to="teleportTarget" defer>
      <Transition name="k-autocomplete-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-autocomplete__popup"
          :class="classNames?.popup"
          :style="[{ width: popupWidth || undefined }, popupStyle, styles?.popup]"
        >
          <span
            v-if="!suggestions.length"
            class="k-autocomplete__empty"
            :class="classNames?.empty"
            :style="styles?.empty"
          >{{ loading ? '加载中…' : notFoundContent }}</span>
          <template v-else>
            <span
              v-for="(option, i) in suggestions"
              :key="String(option.value)"
              v-bind="optionAttrs(option, i)"
              class="k-autocomplete__option"
              :class="[
                { 'is-active': i === activeIndex, 'is-disabled': option.disabled },
                classNames?.option,
              ]"
              :style="styles?.option"
              v-on="optionOn(option, i)"
            >
              <slot name="option" :option="option" :active="i === activeIndex">
                <span class="k-autocomplete__option-label">{{ option.label }}</span>
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

defineOptions({ name: 'KAutoComplete' });

export interface KAutoCompleteOption {
  label: string;
  value: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export type KAutoCompleteSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KAutoCompleteVariant = 'outlined' | 'filled' | 'borderless';
export type KAutoCompleteStatus = 'error' | 'warning';
type AutoCompletePart = 'root' | 'control' | 'input' | 'suffix' | 'popup' | 'option' | 'empty';

export interface KAutoCompleteRenderScope {
  value: string;
  open: boolean;
  loading: boolean;
  activeIndex: number;
  options: KAutoCompleteOption[];
  disabled: boolean;
  readonly: boolean;
  size: KAutoCompleteSize;
  status: KAutoCompleteStatus | undefined;
  rootAttrs: Record<string, unknown>;
  inputAttrs: Record<string, unknown>;
  inputOn: KOnPack;
  popupAttrs: Record<string, unknown>;
  optionAttrs: (option: KAutoCompleteOption, index: number) => Record<string, unknown>;
  optionOn: (option: KAutoCompleteOption, index: number) => KOnPack;
  pick: (option: KAutoCompleteOption) => void;
  search: (query: string) => void;
  setOpen: (value: boolean) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KAutoCompleteProps {
  options?: KAutoCompleteOption[];
  fetchSuggestions?: (query: string) => KAutoCompleteOption[] | Promise<KAutoCompleteOption[]>;
  debounce?: number;
  minLength?: number;
  triggerOnFocus?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  size?: KAutoCompleteSize;
  variant?: KAutoCompleteVariant;
  status?: KAutoCompleteStatus;
  maxlength?: number;
  notFoundContent?: string;
  filter?: (query: string, option: KAutoCompleteOption) => boolean;
  render?: KRenderFn<KAutoCompleteRenderScope>;
  classNames?: Partial<Record<AutoCompletePart, string>>;
  styles?: Partial<Record<AutoCompletePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KAutoCompleteProps>(), {
  options: () => [],
  debounce: 200,
  minLength: 0,
  triggerOnFocus: false,
  allowClear: true,
  placeholder: '',
  disabled: false,
  readonly: false,
  size: 'md',
  variant: 'outlined',
  notFoundContent: '无匹配项',
});

const emit = defineEmits<{
  change: [value: string];
  search: [query: string];
  select: [option: KAutoCompleteOption];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
}>();

const model = defineModel<string>({ default: '' });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const uid = useId();
const rootEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const open = ref(false);
const loading = ref(false);
const activeIndex = ref(-1);
const suggestions = ref<KAutoCompleteOption[]>([]);
const popupWidth = ref('');

const effectiveStatus = computed(() => props.status ?? formItem?.status.value);
const showClear = computed(() => props.allowClear && !!model.value && !props.disabled && !props.readonly);

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

let timer: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

function localOptions(query: string) {
  if (!query) return props.options;
  const q = query.toLowerCase();
  return props.options.filter((option) =>
    props.filter ? props.filter(query, option) : option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
  );
}

function applySuggestions(list: KAutoCompleteOption[]) {
  suggestions.value = list;
  activeIndex.value = list.findIndex((o) => !o.disabled);
  open.value = list.length > 0 || !!props.notFoundContent;
  nextTick(syncWidth);
}

function search(query: string) {
  if (timer) clearTimeout(timer);
  const id = ++requestId;
  if (query.length < props.minLength || (!query && !props.triggerOnFocus)) {
    suggestions.value = [];
    open.value = false;
    loading.value = false;
    return;
  }
  emit('search', query);
  if (!props.fetchSuggestions) {
    applySuggestions(localOptions(query));
    return;
  }
  loading.value = true;
  open.value = true;
  suggestions.value = [];
  activeIndex.value = -1;
  nextTick(syncWidth);
  timer = setTimeout(async () => {
    try {
      const result = await props.fetchSuggestions?.(query);
      if (id !== requestId) return;
      applySuggestions(Array.isArray(result) ? result : []);
    } catch {
      if (id === requestId) applySuggestions([]);
    } finally {
      if (id === requestId) loading.value = false;
    }
  }, Math.max(0, props.debounce));
}

function setOpen(value: boolean) {
  if (props.disabled || props.readonly) return;
  open.value = value;
  if (value) {
    syncWidth();
    nextTick(syncWidth);
  } else {
    activeIndex.value = -1;
  }
}

function pick(option: KAutoCompleteOption) {
  if (option.disabled) return;
  model.value = option.value;
  emit('change', model.value);
  emit('select', option);
  formItem?.onFieldChange();
  setOpen(false);
  inputEl.value?.focus();
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  model.value = value;
  emit('change', value);
  formItem?.onFieldChange();
  search(value);
}

function onClear(e: MouseEvent) {
  e.stopPropagation();
  model.value = '';
  emit('change', '');
  formItem?.onFieldChange();
  suggestions.value = [];
  setOpen(false);
  inputEl.value?.focus();
}

function moveActive(dir: 1 | -1) {
  const list = suggestions.value;
  if (!list.length) return;
  let next = activeIndex.value;
  for (let i = 0; i < list.length; i += 1) {
    next = (next + dir + list.length) % list.length;
    if (!list[next].disabled) break;
  }
  activeIndex.value = next;
  nextTick(() => {
    popupEl.value
      ?.querySelector<HTMLElement>('.k-autocomplete__option.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  });
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled || e.isComposing) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!open.value) search(model.value);
    else moveActive(1);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!open.value) search(model.value);
    else moveActive(-1);
    return;
  }
  if (e.key === 'Enter' && open.value) {
    const option = suggestions.value[activeIndex.value];
    if (option) {
      e.preventDefault();
      pick(option);
    }
    return;
  }
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation();
    setOpen(false);
  }
}

function onFocus(e: FocusEvent) {
  emit('focus', e);
  if (props.triggerOnFocus) search(model.value);
}

function onBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null;
  if (next && (rootEl.value?.contains(next) || popupEl.value?.contains(next))) return;
  setOpen(false);
  emit('blur', e);
  formItem?.onFieldBlur();
}

function optionAttrs(option: KAutoCompleteOption, index: number) {
  return {
    id: `${uid}-option-${index}`,
    role: 'option',
    'aria-selected': index === activeIndex.value,
    'aria-disabled': option.disabled || undefined,
    'data-active': index === activeIndex.value || undefined,
  };
}
function optionOn(option: KAutoCompleteOption, index: number): KOnPack {
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

watch(
  () => props.options,
  () => {
    if (open.value && !props.fetchSuggestions) applySuggestions(localOptions(model.value));
  },
);

usePopupDismiss(open, () => setOpen(false), () => [rootEl.value, popupEl.value]);

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  requestId += 1;
});

const rootAttrs = { 'data-part': 'root' };
const inputAttrs = computed(() => ({
  id: formItem?.controlId,
  role: 'combobox',
  'aria-autocomplete': 'list',
  'aria-expanded': open.value,
  'aria-controls': open.value ? `${uid}-listbox` : undefined,
  'aria-activedescendant':
    open.value && activeIndex.value >= 0 ? `${uid}-option-${activeIndex.value}` : undefined,
  'aria-invalid': formItem?.invalid.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
}));
const inputOn: KOnPack = {
  input: onInput,
  keydown: (e) => onKeydown(e as KeyboardEvent),
  focus: (e) => onFocus(e as FocusEvent),
  blur: (e) => onBlur(e as FocusEvent),
};
const clearOn: KOnPack = {
  mousedown: (e) => {
    e.preventDefault();
    onClear(e as MouseEvent);
  },
};

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KAutoCompleteRenderScope>(
  () => props.render,
  () => ({
    value: model.value,
    open: open.value,
    loading: loading.value,
    activeIndex: activeIndex.value,
    options: suggestions.value,
    disabled: props.disabled,
    readonly: props.readonly,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    inputAttrs: inputAttrs.value,
    inputOn,
    popupAttrs: popupAttrs.value,
    optionAttrs,
    optionOn,
    pick,
    search,
    setOpen,
    slots,
  }),
);

defineSlots<{
  prefix?(): VNodeChild;
  suffix?(): VNodeChild;
  option?(scope: { option: KAutoCompleteOption; active: boolean }): VNodeChild;
  render?(scope: KAutoCompleteRenderScope): VNodeChild;
}>();
</script>

<style>
.k-autocomplete {
  --k-autocomplete-height: var(--k-control-height);
  --k-autocomplete-radius: var(--k-border-radius);
  --k-autocomplete-border: var(--k-color-border);
  --k-autocomplete-bg: var(--k-color-bg-container);
  --k-autocomplete-focus-border: var(--k-color-primary);

  position: relative;
  display: inline-flex;
  width: 100%;
  min-width: 0;
  font-family: inherit;
}
.k-autocomplete *,
.k-autocomplete *::before,
.k-autocomplete *::after {
  box-sizing: border-box;
}
.k-autocomplete__control {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  width: 100%;
  min-width: 0;
  min-height: var(--k-autocomplete-height);
  padding: 0 var(--k-size-sm);
  border: var(--k-line-width) solid var(--k-autocomplete-border);
  border-radius: var(--k-autocomplete-radius);
  background: var(--k-autocomplete-bg);
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-autocomplete--filled .k-autocomplete__control {
  border-color: transparent;
  background: var(--k-color-fill-secondary);
}
.k-autocomplete--borderless .k-autocomplete__control {
  border-color: transparent;
  background: transparent;
}
.k-autocomplete:not(.is-disabled) .k-autocomplete__control:hover {
  border-color: var(--k-color-primary-hover);
}
.k-autocomplete.is-open .k-autocomplete__control,
.k-autocomplete__control:focus-within {
  border-color: var(--k-autocomplete-focus-border);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-autocomplete.is-disabled .k-autocomplete__control {
  cursor: not-allowed;
  background: var(--k-color-fill-secondary);
}
.k-autocomplete--error .k-autocomplete__control { border-color: var(--k-color-error); }
.k-autocomplete--warning .k-autocomplete__control { border-color: var(--k-color-warning); }
.k-autocomplete__prefix,
.k-autocomplete__suffix {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-color-text-tertiary);
}
.k-autocomplete__input {
  flex: auto;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
}
.k-autocomplete__input::placeholder {
  color: var(--k-color-text-tertiary);
}
.k-autocomplete__loading svg {
  animation: k-autocomplete-spin 0.8s linear infinite;
}
.k-autocomplete__clear {
  cursor: pointer;
}
@keyframes k-autocomplete-spin {
  to { transform: rotate(360deg); }
}
.k-autocomplete__popup {
  z-index: var(--k-z-index-popup, 1000);
  max-height: 240px;
  padding: var(--k-popup-padding);
  overflow-y: auto;
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-elevated);
  box-shadow: var(--k-box-shadow-secondary);
}
.k-autocomplete__option {
  display: flex;
  align-items: center;
  min-height: var(--k-popup-item-height);
  padding: 0 var(--k-popup-item-padding-x);
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text);
  cursor: pointer;
}
.k-autocomplete__option:hover,
.k-autocomplete__option.is-active {
  background: var(--k-color-fill-secondary);
}
.k-autocomplete__option.is-disabled {
  color: var(--k-color-text-tertiary);
  cursor: not-allowed;
}
.k-autocomplete__option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-autocomplete__empty {
  display: block;
  padding: var(--k-size-xs);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  text-align: center;
}
</style>