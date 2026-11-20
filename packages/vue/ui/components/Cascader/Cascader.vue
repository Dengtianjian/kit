<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    class="k-cascader"
    :class="[
      `k-cascader--${size}`,
      {
        'is-open': open,
        'is-disabled': disabled,
        'is-multiple': multiple,
        'k-cascader--error': effectiveStatus === 'error',
        'k-cascader--warning': effectiveStatus === 'warning',
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <span
      ref="controlEl"
      v-bind="controlAttrs"
      class="k-cascader__control"
      :class="classNames?.control"
      :style="styles?.control"
      v-on="controlOn"
    >
      <span v-if="$slots.prefix" class="k-cascader__prefix"><slot name="prefix" /></span>
      <span data-part="content" class="k-cascader__content" :class="classNames?.content" :style="styles?.content">
        <template v-if="multiple">
          <span
            v-for="row in selectedRows"
            :key="row.key"
            class="k-cascader__tag"
            :class="classNames?.tag"
            :style="styles?.tag"
          >
            <span class="k-cascader__tag-label">{{ row.node.label }}</span>
            <span
              v-if="!disabled"
              class="k-cascader__tag-remove"
              role="button"
              aria-label="移除"
              @mousedown.prevent.stop="removePath(row.path)"
            >
              <svg viewBox="0 0 10 10" width="0.7em" height="0.7em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
            </span>
          </span>
          <span v-if="!selectedRows.length" class="k-cascader__placeholder">{{ placeholder }}</span>
        </template>
        <span v-else-if="selectedRow" class="k-cascader__label">
          <slot name="display" :path="selectedPath" :labels="selectedLabels" :options="selectedOptions">
            {{ displayText }}
          </slot>
        </span>
        <span v-else class="k-cascader__placeholder">{{ placeholder }}</span>
      </span>
      <span data-part="suffix" class="k-cascader__suffix" :class="classNames?.suffix" :style="styles?.suffix">
        <slot name="suffix" />
        <span v-if="showClear" class="k-cascader__clear" role="button" aria-label="清除" @mousedown.prevent.stop="clear">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
        </span>
        <span class="k-cascader__arrow" :class="{ 'is-open': open }" aria-hidden="true">
          <svg viewBox="0 0 10 6" width="1em" height="0.6em" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4" /></svg>
        </span>
      </span>
    </span>
    <Teleport :to="teleportTarget" defer>
      <Transition name="k-cascader-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-cascader__popup"
          :class="classNames?.popup"
          :style="[{ minWidth: popupWidth || undefined }, popupStyle, styles?.popup]"
        >
          <div v-if="searchable" class="k-cascader__search">
            <input
              ref="searchEl"
              v-model="query"
              class="k-cascader__search-input"
              :placeholder="searchPlaceholder"
              @input="emit('search', query)"
            />
          </div>
          <div v-if="query" class="k-cascader__results" role="listbox">
            <button
              v-for="row in searchRows"
              :key="row.key"
              type="button"
              class="k-cascader__result"
              :class="{ 'is-selected': isSelected(row.path), 'is-disabled': row.node.disabled }"
              :disabled="row.node.disabled"
              role="option"
              :aria-selected="isSelected(row.path)"
              @click="pickRow(row)"
            >{{ pathLabel(row) }}</button>
            <span v-if="!searchRows.length" class="k-cascader__empty">{{ notFoundContent }}</span>
          </div>
          <div v-else class="k-cascader__columns">
            <div
              v-for="(column, ci) in columns"
              :key="ci"
              class="k-cascader__column"
              role="listbox"
            >
              <button
                v-for="node in column"
                :key="String(node.value)"
                type="button"
                class="k-cascader__option"
                :class="{
                  'is-active': isActive(node.value, ci),
                  'is-selected': isNodeSelected(node, ci),
                  'is-disabled': node.disabled,
                }"
                :disabled="node.disabled"
                role="option"
                :aria-selected="isNodeSelected(node, ci)"
                @click="onNodeClick(node, ci)"
                @pointerenter="onNodeHover(node, ci)"
              >
                <input
                  v-if="multiple && canPick(node)"
                  type="checkbox"
                  class="k-cascader__checkbox"
                  :checked="isNodeSelected(node, ci)"
                  :disabled="node.disabled"
                  @click.stop
                  @change="toggleNode(node, ci)"
                />
                <span class="k-cascader__option-label">{{ node.label }}</span>
                <span v-if="node.children?.length" class="k-cascader__option-arrow" aria-hidden="true">›</span>
              </button>
              <span v-if="!column.length" class="k-cascader__empty">暂无数据</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useOverlayPosition, usePopupDismiss, usePopupHost } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import {
  findTreeRowByPath,
  searchTreeRows,
  treePathKey,
} from '../../utils/tree';
import type { KTreeOption, KTreePath, KTreeRow } from '../../utils/tree';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KCascader' });

export type KCascaderValue = KTreePath | KTreePath[] | null;
export type KCascaderSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KCascaderStatus = 'error' | 'warning';
export type KCascaderExpandTrigger = 'click' | 'hover';
type CascaderPart = 'root' | 'control' | 'content' | 'suffix' | 'tag' | 'popup';

export interface KCascaderRenderScope {
  value: KCascaderValue;
  open: boolean;
  multiple: boolean;
  query: string;
  activePath: KTreePath;
  selectedPaths: KTreePath[];
  columns: KTreeOption[][];
  searchRows: KTreeRow[];
  disabled: boolean;
  size: KCascaderSize;
  status: KCascaderStatus | undefined;
  rootAttrs: Record<string, unknown>;
  controlAttrs: Record<string, unknown>;
  controlOn: KOnPack;
  setOpen: (value: boolean) => void;
  pickRow: (row: KTreeRow) => void;
  clear: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KCascaderProps {
  options?: KTreeOption[];
  multiple?: boolean;
  changeOnSelect?: boolean;
  expandTrigger?: KCascaderExpandTrigger;
  searchable?: boolean;
  searchPlaceholder?: string;
  notFoundContent?: string;
  placeholder?: string;
  allowClear?: boolean;
  separator?: string;
  displayRender?: (labels: string[], options: KTreeOption[]) => string;
  filter?: (query: string, row: KTreeRow) => boolean;
  disabled?: boolean;
  size?: KCascaderSize;
  status?: KCascaderStatus;
  ariaLabel?: string;
  render?: KRenderFn<KCascaderRenderScope>;
  classNames?: Partial<Record<CascaderPart, string>>;
  styles?: Partial<Record<CascaderPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KCascaderProps>(), {
  options: () => [],
  multiple: false,
  changeOnSelect: false,
  expandTrigger: 'click',
  searchable: true,
  searchPlaceholder: '搜索选项',
  notFoundContent: '无匹配项',
  placeholder: '请选择',
  allowClear: true,
  separator: ' / ',
  disabled: false,
  size: 'md',
  ariaLabel: '级联选择',
});

const emit = defineEmits<{
  change: [value: KCascaderValue];
  search: [query: string];
  openChange: [open: boolean];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
}>();

const model = defineModel<KCascaderValue>({ default: null });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const rootEl = ref<HTMLElement | null>(null);
const controlEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
const activePath = ref<KTreePath>([]);
const popupWidth = ref('');
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const selectedPaths = computed<KTreePath[]>(() => {
  if (props.multiple) {
    return Array.isArray(model.value) && Array.isArray(model.value[0])
      ? (model.value as KTreePath[]).filter((path) => path.length > 0)
      : [];
  }
  return Array.isArray(model.value) && !Array.isArray(model.value[0]) && model.value.length
    ? [model.value as KTreePath]
    : [];
});
const selectedKeys = computed(() => new Set(selectedPaths.value.map(treePathKey)));
const selectedRows = computed(() =>
  selectedPaths.value
    .map((path) => findTreeRowByPath(props.options, path))
    .filter((row): row is KTreeRow => !!row),
);
const selectedPath = computed<KTreePath>(() => selectedPaths.value[0] ?? []);
const selectedNode = computed(() => findTreeRowByPath(props.options, selectedPath.value));
const selectedRow = computed(() => (props.multiple ? null : selectedNode.value));
const selectedPathRows = computed(() =>
  selectedPath.value.map((_, i) => findTreeRowByPath(props.options, selectedPath.value.slice(0, i + 1))),
);
const selectedLabels = computed(() => selectedPathRows.value.map((row) => row?.node.label ?? ''));
const selectedOptions = computed(() =>
  selectedPathRows.value.map((row) => row?.node).filter((node): node is KTreeOption => !!node),
);
const displayText = computed(() => {
  if (!selectedRow.value) return '';
  const labels = pathLabels(selectedRow.value.path);
  return props.displayRender?.(labels, selectedOptions.value) ?? labels.join(props.separator);
});
const showClear = computed(
  () => props.allowClear && selectedPaths.value.length > 0 && !props.disabled && !open.value,
);

const columns = computed<KTreeOption[][]>(() => {
  const result: KTreeOption[][] = [props.options];
  let nodes = props.options;
  for (const value of activePath.value) {
    const node = nodes.find((item) => item.value === value);
    if (!node?.children?.length) break;
    result.push(node.children);
    nodes = node.children;
  }
  return result;
});

const searchRows = computed(() =>
  searchTreeRows(props.options, query.value, { changeOnSelect: props.changeOnSelect }).filter((row) =>
    props.filter ? props.filter(query.value, row) : true,
  ),
);

function pathLabels(path: KTreePath | null | undefined) {
  if (!Array.isArray(path)) return [];
  return path.map((_, i) => findTreeRowByPath(props.options, path.slice(0, i + 1))?.node.label ?? String(path[i]));
}
function pathLabel(row: KTreeRow | null | undefined) {
  return pathLabels(row?.path).join(props.separator);
}
function canPick(node: KTreeOption, ci = 0) {
  return props.changeOnSelect || !node.children?.length;
}
function isSelected(path: KTreePath) {
  return selectedKeys.value.has(treePathKey(path));
}
function isActive(value: string | number, columnIndex: number) {
  return activePath.value[columnIndex] === value;
}
function isNodeSelected(node: KTreeOption, ci: number) {
  const prefix = activePath.value.slice(0, ci);
  return isSelected([...prefix, node.value]);
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
function setOpen(value: boolean) {
  if (props.disabled) return;
  if (value === open.value) return;
  open.value = value;
  emit('openChange', value);
  if (value) {
    activePath.value = selectedPath.value.length ? [...selectedPath.value] : [];
    syncWidth();
    nextTick(() => {
      syncWidth();
      if (props.searchable) searchEl.value?.focus();
    });
  } else {
    query.value = '';
    formItem?.onFieldBlur();
  }
}

function commitValue(next: KTreePath[]) {
  model.value = props.multiple ? next : next[0] ?? null;
  emit('change', model.value);
  formItem?.onFieldChange();
}
function pickPath(path: KTreePath) {
  if (props.multiple) {
    const next = new Map(selectedPaths.value.map((item) => [treePathKey(item), item]));
    const key = treePathKey(path);
    if (next.has(key)) next.delete(key);
    else next.set(key, path);
    commitValue([...next.values()]);
  } else {
    commitValue([path]);
    setOpen(false);
  }
}
function pickRow(row: KTreeRow) {
  if (row.node.disabled) return;
  activePath.value = row.path;
  if (!canPick(row.node) && !props.multiple) return;
  pickPath(row.path);
}
function onNodeClick(node: KTreeOption, ci: number) {
  if (node.disabled) return;
  const prefix = activePath.value.slice(0, ci);
  const path = [...prefix, node.value];
  activePath.value = path;
  if (props.multiple) {
    if (canPick(node)) toggleNode(node, ci);
    return;
  }
  if (canPick(node)) pickPath(path);
}
function onNodeHover(node: KTreeOption, ci: number) {
  if (props.expandTrigger !== 'hover' || !node.children?.length || node.disabled) return;
  activePath.value = [...activePath.value.slice(0, ci), node.value];
}
function toggleNode(node: KTreeOption, ci: number) {
  if (node.disabled || !canPick(node)) return;
  const path = [...activePath.value.slice(0, ci), node.value];
  pickPath(path);
}
function removePath(path: KTreePath) {
  if (props.disabled) return;
  commitValue(selectedPaths.value.filter((item) => treePathKey(item) !== treePathKey(path)));
}
function clear() {
  commitValue([]);
  setOpen(false);
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

watch(
  () => props.options,
  () => {
    if (open.value) syncWidth();
  },
);

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KCascaderRenderScope>(
  () => props.render,
  () => ({
    value: model.value,
    open: open.value,
    multiple: props.multiple,
    query: query.value,
    activePath: activePath.value,
    selectedPaths: selectedPaths.value,
    columns: columns.value,
    searchRows: searchRows.value,
    disabled: props.disabled,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    controlAttrs: controlAttrs.value,
    controlOn,
    setOpen,
    pickRow,
    clear,
    slots,
  }),
);

defineSlots<{
  prefix?(): VNodeChild;
  suffix?(): VNodeChild;
  display?(scope: { path: KTreePath; labels: string[]; options: KTreeOption[] }): VNodeChild;
  render?(scope: KCascaderRenderScope): VNodeChild;
}>();

defineExpose({ open: () => setOpen(true), close: () => setOpen(false) });
</script>

<style>
.k-cascader {
  --k-cascader-height: var(--k-control-height);
  --k-cascader-radius: var(--k-border-radius);
  --k-cascader-border: var(--k-color-border);
  --k-cascader-bg: var(--k-color-bg-container);
  --k-cascader-focus-border: var(--k-color-primary);

  position: relative;
  display: inline-flex;
  width: 100%;
  min-width: 0;
  font-family: inherit;
  color: var(--k-color-text);
}
.k-cascader *,
.k-cascader *::before,
.k-cascader *::after { box-sizing: border-box; }
.k-cascader__control {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  width: 100%;
  min-width: 0;
  min-height: var(--k-cascader-height);
  padding: 0 var(--k-size-sm);
  border: var(--k-line-width) solid var(--k-cascader-border);
  border-radius: var(--k-cascader-radius);
  background: var(--k-cascader-bg);
  cursor: pointer;
  outline: none;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-cascader:not(.is-disabled) .k-cascader__control:hover { border-color: var(--k-color-primary-hover); }
.k-cascader.is-open .k-cascader__control,
.k-cascader__control:focus-visible {
  border-color: var(--k-cascader-focus-border);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-cascader.is-disabled .k-cascader__control {
  cursor: not-allowed;
  background: var(--k-color-fill-secondary);
}
.k-cascader--error .k-cascader__control { border-color: var(--k-color-error); }
.k-cascader--warning .k-cascader__control { border-color: var(--k-color-warning); }
.k-cascader__content {
  flex: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--k-size-xxs);
  min-width: 0;
  overflow: hidden;
}
.k-cascader:not(.is-multiple) .k-cascader__content {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.k-cascader__label,
.k-cascader__placeholder {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
}
.k-cascader__placeholder { color: var(--k-color-text-tertiary); }
.k-cascader__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  max-width: 100%;
  padding: 0 var(--k-size-xs);
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-fill-tertiary);
  font-size: var(--k-font-size-sm);
}
.k-cascader__tag-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.k-cascader__tag-remove { cursor: pointer; color: var(--k-color-text-tertiary); }
.k-cascader__prefix,
.k-cascader__suffix {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-color-text-tertiary);
}
.k-cascader__clear { cursor: pointer; }
.k-cascader__arrow { display: inline-flex; transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic); }
.k-cascader__arrow.is-open { transform: rotate(180deg); }

.k-cascader__popup {
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
.k-cascader__search { padding: 0 0 var(--k-popup-padding); border-bottom: var(--k-line-width) solid var(--k-color-border-secondary); }
.k-cascader__search-input {
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
.k-cascader__search-input:focus { border-color: var(--k-color-primary); }
.k-cascader__columns { display: flex; }
.k-cascader__column {
  min-width: 140px;
  max-height: 260px;
  padding: 0;
  overflow-y: auto;
  border-right: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-cascader__column:last-child { border-right: 0; }
.k-cascader__option,
.k-cascader__result {
  display: flex;
  align-items: center;
  gap: var(--k-size-xxs);
  width: 100%;
  min-height: var(--k-popup-item-height);
  padding: 0 var(--k-popup-item-padding-x);
  border: 0;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-font-size);
  text-align: start;
  cursor: pointer;
}
.k-cascader__option:hover,
.k-cascader__option.is-active,
.k-cascader__result:hover {
  background: var(--k-color-fill-secondary);
}
.k-cascader__option.is-selected,
.k-cascader__result.is-selected {
  color: var(--k-color-primary);
  font-weight: var(--k-font-weight-strong);
}
.k-cascader__option.is-disabled,
.k-cascader__result.is-disabled { color: var(--k-color-text-quaternary); cursor: not-allowed; }
.k-cascader__checkbox { margin: 0; accent-color: var(--k-color-primary); }
.k-cascader__option-label { flex: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.k-cascader__option-arrow { color: var(--k-color-text-tertiary); }
.k-cascader__results { max-height: 260px; padding: var(--k-size-xxs); overflow-y: auto; }
.k-cascader__results .k-cascader__result { justify-content: flex-start; }
.k-cascader__empty {
  display: block;
  padding: var(--k-size-xs);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  text-align: center;
}
@media (max-width: 640px) {
  .k-cascader__popup { max-width: calc(100vw - var(--k-size-lg)); overflow-x: auto; }
  .k-cascader__column { min-width: 120px; }
}
</style>