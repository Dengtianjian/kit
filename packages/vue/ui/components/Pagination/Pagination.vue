<template>
  <nav
    v-if="!hidden"
    v-bind="rootAttrs"
    class="k-pagination"
    :class="[`k-pagination--${size}`, { 'is-disabled': disabled }, classNames?.root]"
    :style="styles?.root"
    aria-label="分页"
  >
    <span v-if="showTotal" data-part="total" class="k-pagination__total" :class="classNames?.total" :style="styles?.total">
      {{ totalText }}
    </span>
    <div class="k-pagination__pages">
      <button
        type="button"
        data-part="prev"
        class="k-pagination__nav"
        :class="classNames?.prev"
        :style="styles?.prev"
        :disabled="disabled || page <= 1"
        aria-label="上一页"
        @click="changeTo(page - 1)"
      >
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
      </button>
      <template v-if="simple">
        <span class="k-pagination__simple">{{ page }} / {{ pageCount }}</span>
      </template>
      <template v-else>
        <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
          <span v-if="typeof item === 'string'" class="k-pagination__ellipsis" :class="classNames?.ellipsis" :style="styles?.ellipsis" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            data-part="item"
            class="k-pagination__item"
            :class="[{ 'is-active': item === page }, classNames?.item, item === page ? classNames?.active : '']"
            :style="[styles?.item, item === page ? styles?.active : null]"
            :aria-current="item === page ? 'page' : undefined"
            :aria-label="`第 ${item} 页`"
            :disabled="disabled"
            @click="changeTo(item)"
          >
            {{ item }}
          </button>
        </template>
      </template>
      <button
        type="button"
        data-part="next"
        class="k-pagination__nav"
        :class="classNames?.next"
        :style="styles?.next"
        :disabled="disabled || page >= pageCount"
        aria-label="下一页"
        @click="changeTo(page + 1)"
      >
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
      </button>
    </div>
    <KSelect
      v-if="showSizeChanger"
      data-part="size"
      class="k-pagination__size"
      :class="classNames?.sizeChanger"
      :style="styles?.sizeChanger"
      :model-value="pageSize"
      :options="sizeOptions"
      :size="controlSize"
      :disabled="disabled"
      aria-label="每页条数"
      @update:model-value="changePageSize"
    />
    <label v-if="showQuickJumper" class="k-pagination__jumper" :class="classNames?.quickJumper" :style="styles?.quickJumper">
      跳至
      <KInput
        v-model="jumpText"
        class="k-pagination__jump-input"
        :size="controlSize"
        inputmode="numeric"
        :disabled="disabled"
        aria-label="跳转页码"
        @keydown.enter="applyJump"
        @blur="applyJump"
      />
      页
    </label>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import KSelect from '../Select/Select.vue';
import KInput from '../Input/Input.vue';
import { buildPageItems, clampPage, totalPagesOf } from '../../utils/pagination';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KPagination' });

type PaginationPart = 'root' | 'total' | 'item' | 'active' | 'ellipsis' | 'prev' | 'next' | 'sizeChanger' | 'quickJumper';
type ShowTotal = boolean | ((total: number, range: [number, number]) => string);

interface KPaginationProps {
  total: number;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: ShowTotal;
  simple?: boolean;
  disabled?: boolean;
  hideOnSinglePage?: boolean;
  size?: Extract<KSize, 'sm' | 'md' | 'lg'>;
  classNames?: Partial<Record<PaginationPart, string>>;
  styles?: Partial<Record<PaginationPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KPaginationProps>(), {
  pageSizeOptions: () => [10, 20, 50, 100],
  showSizeChanger: false,
  showQuickJumper: false,
  showTotal: false,
  simple: false,
  disabled: false,
  hideOnSinglePage: false,
  size: 'md',
});

const emit = defineEmits<{
  change: [page: number, pageSize: number];
}>();

const current = defineModel<number>('current', { default: 1 });
const pageSize = defineModel<number>('pageSize', { default: 10 });
const rootAttrs = { 'data-part': 'root' };

const pageCount = computed(() => totalPagesOf(props.total, pageSize.value));
/** 页码按钮之外的输入控件沿用原档位：sm→sm、md→sm（保持历史观感）、lg→md */
const controlSize = computed(() => (props.size === 'lg' ? 'md' : 'sm'));
const page = computed(() => clampPage(current.value, pageCount.value));
const pageItems = computed(() => buildPageItems(page.value, pageCount.value));
const sizeOptions = computed(() =>
  props.pageSizeOptions.map((value) => ({ label: `${value} 条/页`, value })),
);
const hidden = computed(() => props.hideOnSinglePage && pageCount.value <= 1);
const totalText = computed(() => {
  const start = props.total === 0 ? 0 : (page.value - 1) * pageSize.value + 1;
  const end = Math.min(page.value * pageSize.value, props.total);
  if (typeof props.showTotal === 'function') return props.showTotal(props.total, [start, end]);
  return `共 ${props.total} 条`;
});

const jumpText = ref(String(page.value));
watch(page, (value) => {
  jumpText.value = String(value);
});
watch(pageCount, (count) => {
  if (current.value > count) current.value = count;
});

function changeTo(next: number) {
  if (props.disabled) return;
  const value = clampPage(next, pageCount.value);
  if (value === current.value) return;
  current.value = value;
  emit('change', value, pageSize.value);
}
function changePageSize(value: unknown) {
  const size = Number(value);
  if (!(size > 0) || size === pageSize.value) return;
  pageSize.value = size;
  const nextPage = clampPage(1, totalPagesOf(props.total, size));
  current.value = nextPage;
  emit('change', nextPage, size);
}
function applyJump() {
  const value = Number(jumpText.value);
  if (!Number.isFinite(value) || value <= 0) {
    jumpText.value = String(page.value);
    return;
  }
  changeTo(value);
  jumpText.value = String(page.value);
}
</script>

<style>
.k-pagination {
  --k-pagination-height: var(--k-control-height-sm);

  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--k-size-sm);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
  user-select: none;
}
.k-pagination--sm {
  --k-pagination-height: var(--k-control-height-xs);
  gap: var(--k-size-xs);
}
.k-pagination--lg {
  --k-pagination-height: var(--k-control-height-lg);
  gap: var(--k-size);
  font-size: var(--k-font-size-lg);
}
.k-pagination__pages {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.k-pagination__nav,
.k-pagination__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  /* 页码与翻页按钮统一为正方形，位数变化不改变尺寸 */
  width: var(--k-pagination-height);
  min-width: var(--k-pagination-height);
  height: var(--k-pagination-height);
  padding: 0;
  flex: none;
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-pagination__nav {
  color: var(--k-color-text-secondary);
  font-size: 14px;
}
.k-pagination__nav:hover:not(:disabled),
.k-pagination__item:hover:not(.is-active):not(:disabled) {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
.k-pagination__item.is-active {
  border-color: var(--k-color-primary);
  background: var(--k-color-primary);
  color: #fff;
  font-weight: var(--k-font-weight-strong);
}
.k-pagination__nav:disabled,
.k-pagination__item:disabled,
.k-pagination.is-disabled .k-pagination__item {
  opacity: 0.45;
  cursor: not-allowed;
}
.k-pagination__nav:focus-visible,
.k-pagination__item:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 1px;
}
.k-pagination__ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--k-pagination-height);
  height: var(--k-pagination-height);
  color: var(--k-color-text-tertiary);
}
.k-pagination__simple {
  display: inline-flex;
  align-items: center;
  height: var(--k-pagination-height);
  padding: 0 var(--k-size-sm);
  font-variant-numeric: tabular-nums;
}
.k-pagination__total {
  white-space: nowrap;
}
.k-pagination__size {
  width: auto;
  min-width: 108px;
}
.k-pagination__jumper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.k-pagination__jump-input {
  width: 56px;
}
@media (max-width: 767px) {
  .k-pagination__size {
    min-width: 96px;
  }
}
</style>