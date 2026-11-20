<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-transfer"
    :class="[
      `k-transfer--${size}`,
      { 'is-disabled': disabled, 'k-transfer--error': effectiveStatus === 'error', 'k-transfer--warning': effectiveStatus === 'warning' },
      classNames?.root,
    ]"
    :style="[rootStyle, styles?.root]"
    :aria-label="ariaLabel"
  >
    <div
      v-for="panel in panels"
      :key="panel.direction"
      data-part="panel"
      class="k-transfer__panel"
      :class="classNames?.panel"
      :style="styles?.panel"
    >
      <div class="k-transfer__header">
        <label v-if="showSelectAll" class="k-transfer__check">
          <input
            type="checkbox"
            :checked="isAllSelected(panel)"
            :indeterminate.prop="isIndeterminate(panel)"
            :disabled="disabled || !panel.data.length"
            @change="toggleAll(panel)"
          />
        </label>
        <span class="k-transfer__title">
          <slot name="title" :title="panel.title" :direction="panel.direction">{{ panel.title }}</slot>
        </span>
        <span class="k-transfer__count">{{ selectedCount(panel) }}/{{ panel.data.length }}</span>
      </div>
      <div v-if="searchable" class="k-transfer__search">
        <input
          class="k-transfer__search-input"
          :value="panel.query"
          :placeholder="searchPlaceholder"
          :disabled="disabled"
          @input="setQuery(panel.direction, $event)"
        />
      </div>
      <div
        class="k-transfer__list"
        :class="classNames?.list"
        :style="styles?.list"
        role="listbox"
        :aria-multiselectable="true"
        :aria-label="panel.title"
      >
        <label
          v-for="item in panel.data"
          :key="String(item.key)"
          class="k-transfer__item"
          :class="[{ 'is-selected': panel.selected.has(item.key), 'is-disabled': item.disabled || disabled }, classNames?.item]"
          :style="styles?.item"
        >
          <input
            type="checkbox"
            :checked="panel.selected.has(item.key)"
            :disabled="disabled || item.disabled"
            @change="toggleSelect(panel, item)"
          />
          <span class="k-transfer__item-content">
            <slot name="item" :item="item" :direction="panel.direction">
              <span class="k-transfer__item-label">{{ item.label }}</span>
              <span v-if="item.description" class="k-transfer__item-description">{{ item.description }}</span>
            </slot>
          </span>
        </label>
        <span v-if="!panel.data.length" class="k-transfer__empty">{{ emptyText }}</span>
      </div>
      <div class="k-transfer__footer">
        <slot name="footer" :direction="panel.direction" :selected="[...panel.selected]">
          <span>{{ panel.title }}</span>
        </slot>
      </div>
    </div>

    <div class="k-transfer__operations" aria-hidden="false">
      <button
        type="button"
        class="k-transfer__move"
        :disabled="disabled || !sourceSelected.size"
        aria-label="移入右侧"
        @click="move('right')"
      >
        ›
      </button>
      <button
        type="button"
        class="k-transfer__move"
        :disabled="disabled || !targetSelected.size"
        aria-label="移回左侧"
        @click="move('left')"
      >
        ‹
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KTransfer' });

export interface KTransferItem {
  key: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export type KTransferDirection = 'left' | 'right';
export type KTransferSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KTransferStatus = 'error' | 'warning';
type TransferPart = 'root' | 'panel' | 'list' | 'item';

interface TransferPanel {
  direction: 'source' | 'target';
  title: string;
  data: KTransferItem[];
  selected: Set<string | number>;
  query: string;
}

export interface KTransferRenderScope {
  targetKeys: (string | number)[];
  sourceSelected: Set<string | number>;
  targetSelected: Set<string | number>;
  disabled: boolean;
  size: KTransferSize;
  status: KTransferStatus | undefined;
  rootAttrs: Record<string, unknown>;
  move: (direction: KTransferDirection) => void;
  toggleSelect: (panel: TransferPanel, item: KTransferItem) => void;
  toggleAll: (panel: TransferPanel) => void;
  setQuery: (direction: 'source' | 'target', event: Event) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KTransferProps {
  dataSource?: KTransferItem[];
  titles?: [string, string];
  searchable?: boolean;
  searchPlaceholder?: string;
  showSelectAll?: boolean;
  listHeight?: number;
  emptyText?: string;
  disabled?: boolean;
  size?: KTransferSize;
  status?: KTransferStatus;
  ariaLabel?: string;
  render?: KRenderFn<KTransferRenderScope>;
  classNames?: Partial<Record<TransferPart, string>>;
  styles?: Partial<Record<TransferPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KTransferProps>(), {
  dataSource: () => [],
  titles: () => ['源列表', '目标列表'],
  searchable: true,
  searchPlaceholder: '搜索',
  showSelectAll: true,
  listHeight: 240,
  emptyText: '暂无数据',
  disabled: false,
  size: 'md',
  ariaLabel: '穿梭框',
});

const emit = defineEmits<{
  change: [targetKeys: (string | number)[], direction: KTransferDirection, movedKeys: (string | number)[]];
  search: [direction: 'source' | 'target', query: string];
  selectChange: [direction: 'source' | 'target', keys: (string | number)[]];
}>();

const model = defineModel<(string | number)[]>({ default: () => [] });
const formItem = inject(FORM_ITEM_KEY, null);
const slots = useSlots();
const sourceSelected = ref<Set<string | number>>(new Set());
const targetSelected = ref<Set<string | number>>(new Set());
const sourceQuery = ref('');
const targetQuery = ref('');
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

function filterData(data: KTransferItem[], query: string) {
  if (!query) return data;
  const q = query.toLowerCase();
  return data.filter(
    (item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
  );
}
const targetSet = computed(() => new Set(model.value));
const sourceData = computed(() => props.dataSource.filter((item) => !targetSet.value.has(item.key)));
const targetData = computed(() => props.dataSource.filter((item) => targetSet.value.has(item.key)));
const panels = computed<TransferPanel[]>(() => [
  {
    direction: 'source',
    title: props.titles[0],
    data: filterData(sourceData.value, sourceQuery.value),
    selected: sourceSelected.value,
    query: sourceQuery.value,
  },
  {
    direction: 'target',
    title: props.titles[1],
    data: filterData(targetData.value, targetQuery.value),
    selected: targetSelected.value,
    query: targetQuery.value,
  },
]);

function selectedCount(panel: TransferPanel) {
  return panel.data.filter((item) => panel.selected.has(item.key)).length;
}
function isAllSelected(panel: TransferPanel) {
  return panel.data.length > 0 && selectedCount(panel) === panel.data.length;
}
function isIndeterminate(panel: TransferPanel) {
  const count = selectedCount(panel);
  return count > 0 && count < panel.data.length;
}
function setSelected(direction: 'source' | 'target', next: Set<string | number>) {
  if (direction === 'source') sourceSelected.value = next;
  else targetSelected.value = next;
  emit('selectChange', direction, [...next]);
}
function toggleSelect(panel: TransferPanel, item: KTransferItem) {
  if (props.disabled || item.disabled) return;
  const next = new Set(panel.selected);
  next.has(item.key) ? next.delete(item.key) : next.add(item.key);
  setSelected(panel.direction, next);
}
function toggleAll(panel: TransferPanel) {
  if (props.disabled) return;
  const all = isAllSelected(panel);
  const next = new Set(panel.selected);
  for (const item of panel.data) {
    if (item.disabled) continue;
    all ? next.delete(item.key) : next.add(item.key);
  }
  setSelected(panel.direction, next);
}
function setQuery(direction: 'source' | 'target', event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (direction === 'source') sourceQuery.value = value;
  else targetQuery.value = value;
  emit('search', direction, value);
}
function move(direction: KTransferDirection) {
  if (props.disabled) return;
  const moving = [...(direction === 'right' ? sourceSelected.value : targetSelected.value)];
  if (!moving.length) return;
  const movingSet = new Set(moving);
  const next = props.dataSource
    .filter((item) =>
      direction === 'right' ? targetSet.value.has(item.key) || movingSet.has(item.key) : targetSet.value.has(item.key) && !movingSet.has(item.key),
    )
    .map((item) => item.key);
  model.value = next;
  setSelected(direction === 'right' ? 'source' : 'target', new Set());
  emit('change', next, direction, moving);
  formItem?.onFieldChange();
  formItem?.onFieldBlur();
}

const rootStyle = computed<CSSProperties>(() => ({
  '--k-transfer-list-height': `${props.listHeight}px`,
}));
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTransferRenderScope>(
  () => props.render,
  () => ({
    targetKeys: model.value,
    sourceSelected: sourceSelected.value,
    targetSelected: targetSelected.value,
    disabled: props.disabled,
    size: props.size,
    status: effectiveStatus.value,
    rootAttrs,
    move,
    toggleSelect,
    toggleAll,
    setQuery,
    slots,
  }),
);

defineSlots<{
  title?(scope: { title: string; direction: 'source' | 'target' }): VNodeChild;
  item?(scope: { item: KTransferItem; direction: 'source' | 'target' }): VNodeChild;
  footer?(scope: { direction: 'source' | 'target'; selected: (string | number)[] }): VNodeChild;
  render?(scope: KTransferRenderScope): VNodeChild;
}>();
</script>

<style>
.k-transfer {
  --k-transfer-height: var(--k-control-height);
  --k-transfer-radius: var(--k-border-radius);
  --k-transfer-list-height: 240px;

  display: flex;
  align-items: stretch;
  gap: var(--k-size-sm);
  width: 100%;
  color: var(--k-color-text);
  font-family: inherit;
}
.k-transfer *,
.k-transfer *::before,
.k-transfer *::after { box-sizing: border-box; }
.k-transfer__panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-transfer-radius);
  background: var(--k-color-bg-container);
  overflow: hidden;
}
.k-transfer--error .k-transfer__panel { border-color: var(--k-color-error); }
.k-transfer--warning .k-transfer__panel { border-color: var(--k-color-warning); }
.k-transfer.is-disabled { opacity: 0.65; }
.k-transfer__header,
.k-transfer__footer {
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  min-height: 40px;
  padding: 0 var(--k-size-sm);
  background: var(--k-color-fill-quaternary);
}
.k-transfer__footer {
  min-height: 32px;
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
}
.k-transfer__check { display: inline-flex; }
.k-transfer__check input,
.k-transfer__item input { margin: 0; accent-color: var(--k-color-primary); }
.k-transfer__title {
  flex: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--k-font-weight-strong);
}
.k-transfer__count {
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  font-variant-numeric: tabular-nums;
}
.k-transfer__search { padding: var(--k-size-xs); }
.k-transfer__search-input {
  width: 100%;
  height: var(--k-control-height-sm);
  padding: 0 var(--k-size-xs);
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-border-radius-sm);
  outline: none;
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font: inherit;
  font-size: var(--k-font-size-sm);
}
.k-transfer__search-input:focus { border-color: var(--k-color-primary); }
.k-transfer__list {
  flex: auto;
  height: var(--k-transfer-list-height);
  overflow-y: auto;
}
.k-transfer__item {
  display: flex;
  align-items: flex-start;
  gap: var(--k-size-xs);
  padding: var(--k-size-xs) var(--k-size-sm);
  cursor: pointer;
}
.k-transfer__item:hover { background: var(--k-color-fill-secondary); }
.k-transfer__item.is-selected { background: var(--k-color-primary-bg); }
.k-transfer__item.is-disabled { color: var(--k-color-text-quaternary); cursor: not-allowed; }
.k-transfer__item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.k-transfer__item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--k-font-size-sm);
}
.k-transfer__item-description {
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
}
.k-transfer__empty {
  display: block;
  padding: var(--k-size-lg) var(--k-size);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  text-align: center;
}
.k-transfer__operations {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--k-size-xs);
  padding-top: 80px;
}
.k-transfer__move {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--k-control-height);
  height: var(--k-control-height);
  padding: 0;
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font-size: var(--k-font-size-xl);
  line-height: 1;
  cursor: pointer;
}
.k-transfer__move:hover:not(:disabled) {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
.k-transfer__move:disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-transfer__move:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
@media (max-width: 640px) {
  .k-transfer {
    flex-direction: column;
  }
  .k-transfer__operations {
    flex-direction: row;
    padding-top: 0;
  }
  .k-transfer__move { transform: rotate(90deg); }
}
</style>