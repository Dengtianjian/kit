<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-treeselect"
    :class="[
      `k-treeselect--${size}`,
      {
        'is-open': open,
        'is-disabled': disabled,
        'is-multiple': multiple,
        'k-treeselect--error': effectiveStatus === 'error',
        'k-treeselect--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <span
      ref="controlEl"
      v-bind="controlAttrs"
      class="k-treeselect__control"
      :class="classNames?.control"
      :style="styles?.control"
      v-on="controlOn"
    >
      <span v-if="$slots.prefix" class="k-treeselect__prefix"><slot name="prefix" /></span>
      <span data-part="content" class="k-treeselect__content" :class="classNames?.content" :style="styles?.content">
        <template v-if="multiple">
          <span
            v-for="row in tagRows"
            :key="row.key"
            class="k-treeselect__tag"
            :class="classNames?.tag"
            :style="styles?.tag"
          >
            <span class="k-treeselect__tag-label">{{ row.node.label }}</span>
            <span
              v-if="!disabled"
              class="k-treeselect__tag-remove"
              role="button"
              aria-label="移除"
              @mousedown.prevent.stop="toggleValue(row.node)"
            >
              <svg viewBox="0 0 10 10" width="0.7em" height="0.7em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
            </span>
          </span>
          <span v-if="!tagRows.length" class="k-treeselect__placeholder">{{ placeholder }}</span>
        </template>
        <span v-else-if="singleRow" class="k-treeselect__label">
          <slot name="display" :node="singleRow.node" :path="singleRow.path">{{ singleRow.node.label }}</slot>
        </span>
        <span v-else class="k-treeselect__placeholder">{{ placeholder }}</span>
      </span>
      <span data-part="suffix" class="k-treeselect__suffix" :class="classNames?.suffix" :style="styles?.suffix">
        <slot name="suffix" />
        <span v-if="showClear" class="k-treeselect__clear" role="button" aria-label="清除" @mousedown.prevent.stop="clear">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
        </span>
        <span class="k-treeselect__arrow" :class="{ 'is-open': open }" aria-hidden="true">
          <svg viewBox="0 0 10 6" width="1em" height="0.6em" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4" /></svg>
        </span>
      </span>
    </span>
    <Teleport :to="teleportTarget" defer>
      <Transition name="k-treeselect-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-treeselect__popup"
          :class="classNames?.popup"
          :style="[{ minWidth: popupWidth || undefined }, popupStyle, styles?.popup]"
        >
          <div v-if="showSearch" class="k-treeselect__search">
            <input
              ref="searchEl"
              v-model="query"
              class="k-treeselect__search-input"
              :placeholder="searchPlaceholder"
              @input="emit('search', query)"
            />
          </div>
          <div class="k-treeselect__tree" role="tree">
            <div
              v-for="row in visibleRows"
              :key="row.key"
              class="k-treeselect__row"
              :class="{ 'is-selected': selectedSet.has(row.node.value), 'is-disabled': row.node.disabled }"
              :style="{ paddingLeft: `${8 + row.level * 16}px` }"
              role="treeitem"
              :aria-level="row.level + 1"
              :aria-expanded="row.node.children?.length ? expandedSet.has(row.node.value) : undefined"
              :aria-selected="!multiple ? selectedSet.has(row.node.value) : undefined"
            >
              <button
                v-if="row.node.children?.length"
                type="button"
                class="k-treeselect__expand"
                :aria-label="expandedSet.has(row.node.value) ? '收起' : '展开'"
                @click.stop="toggleExpand(row.node.value)"
              >
                <svg viewBox="0 0 10 6" width="0.7em" height="0.42em" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
              </button>
              <span v-else class="k-treeselect__expand-space" />
              <input
                v-if="multiple"
                type="checkbox"
                class="k-treeselect__checkbox"
                :checked="checkStateOf(row.node).checked"
                :indeterminate.prop="checkStateOf(row.node).indeterminate"
                :disabled="row.node.disabled"
                @click.stop
                @change="toggleValue(row.node)"
              />
              <button
                type="button"
                class="k-treeselect__label-button"
                :disabled="row.node.disabled"
                @click="pickNode(row.node)"
              >{{ row.node.label }}</button>
            </div>
            <span v-if="!visibleRows.length" class="k-treeselect__empty">{{ notFoundContent }}</span>
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
  filterTreeOptions,
  findTreeRowByValue,
  flattenTreeOptions,
  toggleTreeChecked,
  treeCheckState,
} from '../../utils/tree';
import type { KTreeOption, KTreeRow } from '../../utils/tree';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KTreeSelect' });

export type KTreeSelectValue = string | number | (string | number)[] | null;
export type KTreeSelectSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KTreeSelectStatus = 'error' | 'warning';
type TreeSelectPart = 'root' | 'control' | 'content' | 'suffix' | 'tag' | 'popup';

export interface KTreeSelectRenderScope {
  value: KTreeSelectValue;
  open: boolean;
  multiple: boolean;
  query: string;
  selectedValues: (string | number)[];
  visibleRows: KTreeRow[];
  expandedKeys: (string | number)[];
  disabled: boolean;
  size: KTreeSelectSize;
  status: KTreeSelectStatus | undefined;
  rootAttrs: Record<string, unknown>;
  controlAttrs: Record<string, unknown>;
  controlOn: KOnPack;
  setOpen: (value: boolean) => void;
  toggleValue: (node: KTreeOption) => void;
  clear: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KTreeSelectProps {
  options?: KTreeOption[];
  multiple?: boolean;
  checkStrictly?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  notFoundContent?: string;
  placeholder?: string;
  allowClear?: boolean;
  defaultExpandAll?: boolean;
  defaultExpandedKeys?: (string | number)[];
  filterTreeNode?: (query: string, node: KTreeOption) => boolean;
  disabled?: boolean;
  size?: KTreeSelectSize;
  status?: KTreeSelectStatus;
  ariaLabel?: string;
  render?: KRenderFn<KTreeSelectRenderScope>;
  classNames?: Partial<Record<TreeSelectPart, string>>;
  styles?: Partial<Record<TreeSelectPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KTreeSelectProps>(), {
  options: () => [],
  multiple: false,
  checkStrictly: false,
  showSearch: true,
  searchPlaceholder: '搜索节点',
  notFoundContent: '无匹配项',
  placeholder: '请选择',
  allowClear: true,
  disabled: false,
  size: 'md',
  ariaLabel: '树选择',
});

const emit = defineEmits<{
  change: [value: KTreeSelectValue];
  search: [query: string];
  expand: [keys: (string | number)[]];
  openChange: [open: boolean];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
}>();

const model = defineModel<KTreeSelectValue>({ default: null });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const rootEl = ref<HTMLElement | null>(null);
const controlEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
const popupWidth = ref('');
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const selectedValues = computed<(string | number)[]>(() => {
  if (props.multiple) return Array.isArray(model.value) ? [...model.value] : [];
  return model.value == null || Array.isArray(model.value) ? [] : [model.value];
});
const selectedSet = computed(() => new Set(selectedValues.value));
const singleRow = computed(() =>
  props.multiple || selectedValues.value.length === 0
    ? null
    : findTreeRowByValue(props.options, selectedValues.value[0]),
);
const tagRows = computed(() => {
  if (!props.multiple) return [];
  return flattenTreeOptions(props.options).filter(
    (row) => selectedSet.value.has(row.node.value) && (props.checkStrictly || !row.node.children?.length),
  );
});
const showClear = computed(
  () => props.allowClear && selectedValues.value.length > 0 && !props.disabled && !open.value,
);

const initialExpanded = new Set<string | number>(props.defaultExpandedKeys ?? []);
if (props.defaultExpandAll) {
  flattenTreeOptions(props.options)
    .filter((row) => row.node.children?.length)
    .forEach((row) => initialExpanded.add(row.node.value));
}
const expanded = ref<Set<string | number>>(initialExpanded);
const expandedSet = computed(() => expanded.value);
const filteredTree = computed(() =>
  query.value
    ? filterTreeOptions(props.options, (node) =>
        props.filterTreeNode
          ? props.filterTreeNode(query.value, node)
          : node.label.toLowerCase().includes(query.value.toLowerCase()) ||
            String(node.value).toLowerCase().includes(query.value.toLowerCase()),
      )
    : props.options,
);
const visibleRows = computed<KTreeRow[]>(() => {
  if (query.value) return flattenTreeOptions(filteredTree.value);
  const rows: KTreeRow[] = [];
  const walk = (nodes: KTreeOption[]) => {
    for (const node of nodes) {
      const row = findTreeRowByValue(props.options, node.value);
      if (!row) continue;
      rows.push(row);
      if (node.children?.length && expandedSet.value.has(node.value)) walk(node.children);
    }
  };
  walk(props.options);
  return rows;
});

function checkStateOf(node: KTreeOption) {
  return treeCheckState(node, selectedSet.value);
}
function setExpanded(next: Set<string | number>) {
  expanded.value = next;
  emit('expand', [...next]);
}
function toggleExpand(value: string | number) {
  const next = new Set(expanded.value);
  next.has(value) ? next.delete(value) : next.add(value);
  setExpanded(next);
}

function commit(next: (string | number)[]) {
  model.value = props.multiple ? next : next[0] ?? null;
  emit('change', model.value);
  formItem?.onFieldChange();
}
function toggleValue(node: KTreeOption) {
  if (props.disabled || node.disabled) return;
  if (!props.multiple) {
    if (node.children?.length) return;
    commit([node.value]);
    setOpen(false);
    return;
  }
  const nextSet = toggleTreeChecked(
    props.options,
    selectedSet.value,
    node.value,
    !checkStateOf(node).checked,
    props.checkStrictly,
  );
  commit([...nextSet]);
}
function pickNode(node: KTreeOption) {
  if (props.disabled || node.disabled) return;
  if (props.multiple) {
    toggleValue(node);
    return;
  }
  commit([node.value]);
  setOpen(false);
}
function clear() {
  commit([]);
  setOpen(false);
}

const { teleportTarget, popupClasses, popupTheme } = usePopupHost();
const { popupStyle: overlayStyle } = useOverlayPosition({
  anchor: controlEl,
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

function syncWidth() {
  const width = controlEl.value?.offsetWidth;
  if (width) popupWidth.value = `${Math.round(width)}px`;
}
function expandAncestors(value: string | number) {
  const row = findTreeRowByValue(props.options, value);
  if (!row) return;
  const next = new Set(expanded.value);
  row.path.slice(0, -1).forEach((key) => next.add(key));
  setExpanded(next);
}
function setOpen(value: boolean) {
  if (props.disabled) return;
  if (value === open.value) return;
  open.value = value;
  emit('openChange', value);
  if (value) {
    selectedValues.value.forEach(expandAncestors);
    syncWidth();
    nextTick(() => {
      syncWidth();
      if (props.showSearch) searchEl.value?.focus();
    });
  } else {
    query.value = '';
    formItem?.onFieldBlur();
  }
}
function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
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
  open.value = false;
});

const rootAttrs = { 'data-part': 'root' };
const controlAttrs = computed(() => ({
  id: formItem?.controlId,
  role: 'combobox',
  tabindex: props.disabled ? -1 : 0,
  'aria-label': props.ariaLabel,
  'aria-expanded': open.value,
  'aria-haspopup': 'tree',
  'aria-disabled': props.disabled || undefined,
  'aria-invalid': formItem?.invalid.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
}));
const controlOn: KOnPack = {
  click: () => setOpen(!open.value),
  keydown: (e) => onKeydown(e as KeyboardEvent),
  focus: (e) => emit('focus', e as FocusEvent),
  blur: (e) => emit('blur', e as FocusEvent),
};

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTreeSelectRenderScope>(
  () => props.render,
  () => ({
    value: model.value,
    open: open.value,
    multiple: props.multiple,
    query: query.value,
    selectedValues: selectedValues.value,
    visibleRows: visibleRows.value,
    expandedKeys: [...expandedSet.value],
    disabled: props.disabled,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    controlAttrs: controlAttrs.value,
    controlOn,
    setOpen,
    toggleValue,
    clear,
    slots,
  }),
);

defineSlots<{
  prefix?(): VNodeChild;
  suffix?(): VNodeChild;
  display?(scope: { node: KTreeOption; path: (string | number)[] }): VNodeChild;
  render?(scope: KTreeSelectRenderScope): VNodeChild;
}>();

defineExpose({ open: () => setOpen(true), close: () => setOpen(false) });
</script>

<style>
.k-treeselect {
  --k-treeselect-height: var(--k-control-height);
  --k-treeselect-radius: var(--k-border-radius);
  --k-treeselect-border: var(--k-color-border);
  --k-treeselect-bg: var(--k-color-bg-container);

  position: relative;
  display: inline-flex;
  width: 100%;
  min-width: 0;
  font-family: inherit;
  color: var(--k-color-text);
}
.k-treeselect *,
.k-treeselect *::before,
.k-treeselect *::after { box-sizing: border-box; }
.k-treeselect__control {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  width: 100%;
  min-width: 0;
  min-height: var(--k-treeselect-height);
  padding: 0 var(--k-size-sm);
  border: var(--k-line-width) solid var(--k-treeselect-border);
  border-radius: var(--k-treeselect-radius);
  background: var(--k-treeselect-bg);
  cursor: pointer;
  outline: none;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-treeselect:not(.is-disabled) .k-treeselect__control:hover { border-color: var(--k-color-primary-hover); }
.k-treeselect.is-open .k-treeselect__control,
.k-treeselect__control:focus-visible {
  border-color: var(--k-color-primary);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-treeselect.is-disabled .k-treeselect__control {
  cursor: not-allowed;
  background: var(--k-color-fill-secondary);
}
.k-treeselect--error .k-treeselect__control { border-color: var(--k-color-error); }
.k-treeselect--warning .k-treeselect__control { border-color: var(--k-color-warning); }
.k-treeselect__content {
  flex: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--k-size-xxs);
  min-width: 0;
  overflow: hidden;
}
.k-treeselect:not(.is-multiple) .k-treeselect__content {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.k-treeselect__label,
.k-treeselect__placeholder {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
}
.k-treeselect__placeholder { color: var(--k-color-text-tertiary); }
.k-treeselect__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  max-width: 100%;
  padding: 0 var(--k-size-xs);
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-fill-tertiary);
  font-size: var(--k-font-size-sm);
}
.k-treeselect__tag-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.k-treeselect__tag-remove { cursor: pointer; color: var(--k-color-text-tertiary); }
.k-treeselect__prefix,
.k-treeselect__suffix {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-color-text-tertiary);
}
.k-treeselect__clear { cursor: pointer; }
.k-treeselect__arrow { display: inline-flex; transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic); }
.k-treeselect__arrow.is-open { transform: rotate(180deg); }

.k-treeselect__popup {
  z-index: var(--k-z-index-popup, 1000);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--k-popup-padding);
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-elevated);
  box-shadow: var(--k-box-shadow-secondary);
}
.k-treeselect__search {
  padding: 0 0 var(--k-popup-padding);
  border-bottom: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-treeselect__search-input {
  width: 100%;
  height: var(--k-popup-item-height);
  padding: 0 var(--k-popup-item-padding-x);
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-border-radius-sm);
  outline: none;
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font: inherit;
  font-size: var(--k-font-size-sm);
}
.k-treeselect__search-input:focus { border-color: var(--k-color-primary); }
.k-treeselect__tree {
  max-height: 280px;
  padding: 0;
  overflow: auto;
}
.k-treeselect__row {
  display: flex;
  align-items: center;
  gap: var(--k-size-xxs);
  min-height: var(--k-popup-item-height);
  padding-right: var(--k-popup-item-padding-x);
  border-radius: var(--k-border-radius-sm);
}
.k-treeselect__row:hover,
.k-treeselect__row.is-selected { background: var(--k-color-fill-secondary); }
.k-treeselect__row.is-disabled { color: var(--k-color-text-quaternary); }
.k-treeselect__expand,
.k-treeselect__expand-space {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.k-treeselect__expand {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--k-color-text-tertiary);
  cursor: pointer;
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-treeselect__row[aria-expanded='true'] .k-treeselect__expand { transform: rotate(180deg); }
.k-treeselect__checkbox { margin: 0; accent-color: var(--k-color-primary); }
.k-treeselect__label-button {
  flex: auto;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--k-font-size);
  text-align: start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.k-treeselect__label-button:disabled { cursor: not-allowed; }
.k-treeselect__empty {
  display: block;
  padding: var(--k-size-xs);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  text-align: center;
}
@media (max-width: 640px) {
  .k-treeselect__popup { max-width: calc(100vw - var(--k-size-lg)); }
}
</style>