<template>
  <div
    v-bind="rootAttrs"
    class="k-table"
    :class="[
      `k-table--${size}`,
      {
        'is-bordered': bordered,
        'is-row-borders': rowBorders,
        'is-column-borders': showColumnBorders,
        'is-striped': striped,
        'is-sticky': sticky,
        'is-loading': loading,
        'has-scroll-left': scrollState.left,
        'has-scroll-right': scrollState.right,
        'has-scroll-top': scrollState.top,
        'has-scroll-bottom': scrollState.bottom,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <div
      v-if="toolbarVisible"
      class="k-table__toolbar"
      :class="classNames?.toolbar"
      :style="styles?.toolbar"
    >
      <div class="k-table__toolbar-start">
        <slot name="filter" :columns="leaves" :visibility="columnVisibility" />
      </div>
      <div class="k-table__toolbar-end">
        <slot name="toolbar" :columns="leaves" />
        <KPopover v-if="columnSetting" trigger="click" placement="bottomRight" :arrow="false">
          <template #trigger>
            <KButton size="sm">列设置</KButton>
          </template>
          <div class="k-table__column-setting" :class="classNames?.columnSetting" :style="styles?.columnSetting" @click.stop>
            <div class="k-table__column-setting-head">
              <span>显示列</span>
              <button type="button" class="k-table__link" @click="resetColumnVisibility">重置</button>
            </div>
            <div class="k-table__column-setting-list">
              <KCheckbox
                v-for="item in columnSettings"
                :key="item.key"
                :model-value="item.visible"
                :disabled="item.disabled || (item.visible && visibleColumnCount <= 1)"
                @update:model-value="checked => toggleColumnVisible(item.key, checked)"
              >
                {{ item.label }}
              </KCheckbox>
            </div>
          </div>
        </KPopover>
      </div>
    </div>
    <div v-if="showTopPagination" class="k-table__pagination is-top" :class="[classNames?.pagination, `is-${paginationPlacement.align}`]" :style="styles?.pagination">
      <KPagination
        v-model:current="current"
        v-model:page-size="perPage"
        :total="paginationTotal"
        :size="size === 'sm' ? 'sm' : 'md'"
        :page-size-options="paginationConfig.pageSizeOptions"
        :show-size-changer="paginationConfig.showSizeChanger"
        :show-quick-jumper="paginationConfig.showQuickJumper"
        :show-total="paginationConfig.showTotal"
        :hide-on-single-page="paginationConfig.hideOnSinglePage"
        @change="onPageChange"
      />
    </div>
    <div ref="wrapEl" class="k-table__wrap" :class="classNames?.wrap" :style="[wrapStyle, styles?.wrap]" @scroll.passive="onWrapScroll">
      <div class="k-table__canvas" :style="canvasStyle">
      <table ref="tableEl" class="k-table__table" :style="tableStyle" :aria-busy="loading || undefined">
        <colgroup>
          <col v-if="expandableEnabled" style="width: 44px" />
          <col v-if="selectionEnabled" style="width: 44px" />
          <col v-for="leaf in leaves" :key="leaf.key" :style="colStyle(leaf)" />
        </colgroup>
        <thead ref="headEl" class="k-table__head">
          <tr
            v-for="(headerRow, rowIndex) in headerRows"
            :key="`head-${rowIndex}`"
            :ref="el => setHeaderRowEl(el, rowIndex)"
            class="k-table__head-row"
          >
            <th
              v-if="rowIndex === 0 && expandableEnabled && leadingInOverlay"
              :rowspan="headerDepth > 1 ? headerDepth : undefined"
              scope="col"
              class="k-table__cell k-table__cell--head k-table__cell--expand is-overlay-placeholder"
              aria-hidden="true"
            ></th>
            <th
              v-else-if="rowIndex === 0 && expandableEnabled"
              :rowspan="headerDepth > 1 ? headerDepth : undefined"
              scope="col"
              class="k-table__cell k-table__cell--head k-table__cell--expand is-fixed is-fixed-left"
              style="left: 0"
            ><span class="k-table__sr-only">展开</span></th>
            <th
              v-if="rowIndex === 0 && selectionEnabled && leadingInOverlay"
              :rowspan="headerDepth > 1 ? headerDepth : undefined"
              scope="col"
              class="k-table__cell k-table__cell--head k-table__cell--selection is-overlay-placeholder"
              aria-hidden="true"
            ></th>
            <th
              v-else-if="rowIndex === 0 && selectionEnabled"
              :rowspan="headerDepth > 1 ? headerDepth : undefined"
              scope="col"
              class="k-table__cell k-table__cell--head k-table__cell--selection is-fixed is-fixed-left"
              :style="{ left: `${expandableEnabled ? 44 : 0}px` }"
            >
              <KCheckbox
                v-if="selectionType === 'checkbox'"
                :model-value="allChecked"
                :indeterminate="partiallyChecked"
                :disabled="!pageSelectableRows.length"
                aria-label="全选当前页"
                @update:model-value="toggleAll"
              />
            </th>
            <template v-for="cell in headerRow" :key="cell.path">
              <th
                v-if="isOverlayHeaderCell(cell)"
                scope="col"
                :colspan="cell.colSpan > 1 ? cell.colSpan : undefined"
                :rowspan="cell.rowSpan > 1 ? cell.rowSpan : undefined"
                class="k-table__cell k-table__cell--head is-overlay-placeholder"
                :style="cell.column.styles?.header"
                :data-column-key="cell.isGroup ? undefined : cell.leafKey"
                aria-hidden="true"
              ></th>
              <th
                v-else
                scope="col"
                :colspan="cell.colSpan > 1 ? cell.colSpan : undefined"
                :rowspan="cell.rowSpan > 1 ? cell.rowSpan : undefined"
                class="k-table__cell k-table__cell--head"
                :class="[cell.column.classNames?.header, headerFixedClass(cell)]"
                :style="[headerCellStyle(cell, rowIndex), cell.column.styles?.header]"
                :aria-sort="cell.isGroup ? undefined : ariaSort(cell.leafKey)"
                :data-column-key="cell.isGroup ? undefined : cell.leafKey"
              >
                <KHeadCell :cell="cell" />
              </th>
            </template>
          </tr>
        </thead>
        <tbody class="k-table__body">
          <tr v-if="!bodyRows.length" class="k-table__empty-row">
            <td :colspan="columnSpan" class="k-table__cell k-table__empty">
              <slot name="empty" :columns="visibleColumns">
                <KEmpty :description="emptyText" :size="size === 'sm' ? 'sm' : 'md'" />
              </slot>
            </td>
          </tr>
          <template v-else>
          <template v-for="item in renderEntries" :key="item.key">
          <tr v-if="item.height != null" class="k-table__virtual-spacer">
            <td :colspan="columnSpan" :style="{ height: `${item.height}px` }"></td>
          </tr>
          <template v-for="entry in (item.entry ? [item.entry] : [])" :key="`row-${item.key}`">
          <tr
            class="k-table__row"
            :class="[
              {
                'is-selected': isSelected(entry.row),
                'is-pinned-top': entry.pinned === 'top',
                'is-pinned-bottom': entry.pinned === 'bottom',
              },
              classNames?.row,
            ]"
            :data-row-key="rowKeyOf(entry.row)"
            :style="styles?.row"
            @click="onRowClick(entry.row, entry.index, $event)"
            @mouseenter="scheduleHover(rowKeyOf(entry.row))"
            @mouseleave="scheduleHover(null)"
          >
            <td
              v-if="expandableEnabled && leadingInOverlay"
              class="k-table__cell k-table__cell--expand is-overlay-placeholder"
              aria-hidden="true"
            ></td>
            <td
              v-else-if="expandableEnabled"
              class="k-table__cell k-table__cell--expand is-fixed is-fixed-left"
              :style="[pinnedCellStyle(entry), { left: '0px' }]"
              @click.stop
            >
              <button
                v-if="!entry.pinned && canExpand(entry.row)"
                type="button"
                class="k-table__expand"
                :class="{ 'is-expanded': isExpanded(entry.row) }"
                :aria-expanded="isExpanded(entry.row)"
                :aria-label="isExpanded(entry.row) ? '收起' : '展开'"
                @click="toggleExpand(entry.row)"
              >
                <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </button>
            </td>
            <td
              v-if="selectionEnabled && leadingInOverlay"
              class="k-table__cell k-table__cell--selection is-overlay-placeholder"
              aria-hidden="true"
            ></td>
            <td
              v-else-if="selectionEnabled"
              class="k-table__cell k-table__cell--selection is-fixed is-fixed-left"
              :style="[pinnedCellStyle(entry), { left: `${expandableEnabled ? 44 : 0}px` }]"
              @click.stop
            >
              <KCheckbox
                v-if="selectionType === 'checkbox'"
                :model-value="isSelected(entry.row)"
                :disabled="checkboxDisabled(entry.row)"
                :aria-label="`选择第 ${entry.index + 1} 行`"
                @update:model-value="checked => toggleRow(entry.row, checked)"
              />
              <KRadio
                v-else
                :name="selectionName"
                :value="rowKeyOf(entry.row)"
                :model-value="selectedKeys[0]"
                :disabled="checkboxDisabled(entry.row)"
                :aria-label="`选择第 ${entry.index + 1} 行`"
                @update:model-value="selectSingleRow(entry.row)"
              />
            </td>
            <td
              v-for="leaf in leaves"
              :key="leaf.key"
              class="k-table__cell"
              :class="[
                leaf.column.classNames?.cell,
                isOverlayColumn(leaf.column) ? 'is-overlay-placeholder' : fixedClass(leaf.column, leaf.key),
                {
                  'is-align-center': leaf.column.align === 'center',
                  'is-align-right': leaf.column.align === 'right',
                  'is-ellipsis': leaf.column.ellipsis,
                },
              ]"
              :style="[
                isOverlayColumn(leaf.column) ? null : cellStyle(leaf.column, leaf.key),
                isOverlayColumn(leaf.column) ? null : pinnedCellStyle(entry),
                leaf.column.styles?.cell,
              ]"
              :aria-hidden="isOverlayColumn(leaf.column) ? 'true' : undefined"
            >
              <KBodyCellInner
                v-if="!isOverlayColumn(leaf.column)"
                :column="leaf.column"
                :row="entry.row"
                :index="entry.index"
              />
            </td>
          </tr>
          <tr
            v-if="expandableEnabled && !entry.pinned && isExpanded(entry.row)"
            class="k-table__expanded-row"
          >
            <td :colspan="columnSpan" class="k-table__cell k-table__expanded-cell">
              <slot name="expanded" :row="entry.row" :index="entry.index" :row-key="rowKeyOf(entry.row)" />
            </td>
          </tr>
          </template>
          </template>
          </template>
        </tbody>
        <tfoot v-if="$slots.summary">
          <tr>
            <td :colspan="columnSpan" class="k-table__cell k-table__summary">
              <slot name="summary" :columns="visibleColumns" :rows="processedRows" />
            </td>
          </tr>
        </tfoot>
      </table>
      <div
        v-for="side in fixedSides"
        :key="`fixed-${side}`"
        :ref="el => setFixedLayerEl(el, side)"
        class="k-table__fixed-layer"
        :class="[side === 'left' ? 'is-left' : 'is-right', classNames?.fixedLayer]"
        :style="fixedLayerStyle(side)"
      >
        <table class="k-table__fixed-table">
          <colgroup>
            <template v-if="side === 'left' && leadingInOverlay">
              <col v-if="expandableEnabled" style="width: 44px" />
              <col v-if="selectionEnabled" style="width: 44px" />
            </template>
            <col v-for="leaf in fixedLeavesOf(side)" :key="leaf.key" :style="colStyle(leaf)" />
          </colgroup>
          <thead class="k-table__head">
            <tr
              v-for="(headerRow, rowIndex) in headerRows"
              :key="`fixed-${side}-head-${rowIndex}`"
              class="k-table__head-row"
            >
              <template v-if="side === 'left' && leadingInOverlay && rowIndex === 0">
                <th
                  v-if="expandableEnabled"
                  :rowspan="headerDepth > 1 ? headerDepth : undefined"
                  scope="col"
                  class="k-table__cell k-table__cell--head k-table__cell--expand"
                >
                  <span class="k-table__sr-only">展开</span>
                </th>
                <th
                  v-if="selectionEnabled"
                  :rowspan="headerDepth > 1 ? headerDepth : undefined"
                  scope="col"
                  class="k-table__cell k-table__cell--head k-table__cell--selection"
                >
                  <KCheckbox
                    v-if="selectionType === 'checkbox'"
                    :model-value="allChecked"
                    :indeterminate="partiallyChecked"
                    :disabled="!pageSelectableRows.length"
                    aria-label="全选当前页"
                    @update:model-value="toggleAll"
                  />
                </th>
              </template>
              <th
                v-for="cell in overlayHeaderCells(headerRow, side)"
                :key="cell.path"
                scope="col"
                :colspan="cell.colSpan > 1 ? cell.colSpan : undefined"
                :rowspan="cell.rowSpan > 1 ? cell.rowSpan : undefined"
                class="k-table__cell k-table__cell--head"
                :class="[
                  cell.column.classNames?.header,
                  side === 'left' ? 'is-fixed-left' : 'is-fixed-right',
                ]"
                :style="[overlayHeaderStyle(rowIndex), cell.column.styles?.header]"
                :aria-sort="cell.isGroup ? undefined : ariaSort(cell.leafKey)"
                :data-column-key="cell.isGroup ? undefined : cell.leafKey"
              >
                <KHeadCell :cell="cell" />
              </th>
              <th
                v-if="!overlayHeaderCells(headerRow, side).length && !(side === 'left' && leadingInOverlay && rowIndex === 0)"
                :colspan="fixedColCount(side)"
                class="k-table__cell k-table__cell--head is-overlay-spacer"
              ></th>
            </tr>
          </thead>
          <tbody class="k-table__body">
            <tr v-if="!bodyRows.length" class="k-table__empty-row is-overlay-spacer">
              <td :colspan="fixedColCount(side)" class="k-table__cell"></td>
            </tr>
            <template v-else>
              <template v-for="item in renderEntries" :key="`fixed-${side}-${item.key}`">
                <tr v-if="item.height != null" class="k-table__virtual-spacer">
                  <td :colspan="fixedColCount(side)" :style="{ height: `${item.height}px` }"></td>
                </tr>
                <template v-for="entry in (item.entry ? [item.entry] : [])" :key="`fixed-row-${side}-${item.key}`">
                <tr
                  class="k-table__row"
                  :class="[
                    {
                      'is-selected': isSelected(entry.row),
                      'is-pinned-top': entry.pinned === 'top',
                      'is-pinned-bottom': entry.pinned === 'bottom',
                    },
                    classNames?.row,
                  ]"
                  :data-row-key="rowKeyOf(entry.row)"
                  :style="styles?.row"
                  @click="onRowClick(entry.row, entry.index, $event)"
                  @mouseenter="scheduleHover(rowKeyOf(entry.row))"
                  @mouseleave="scheduleHover(null)"
                >
                  <template v-if="side === 'left' && leadingInOverlay">
                  <td
                    v-if="expandableEnabled"
                    class="k-table__cell k-table__cell--expand"
                    :style="pinnedCellStyle(entry)"
                    @click.stop
                  >
                    <button
                      v-if="!entry.pinned && canExpand(entry.row)"
                      type="button"
                      class="k-table__expand"
                      :class="{ 'is-expanded': isExpanded(entry.row) }"
                      :aria-expanded="isExpanded(entry.row)"
                      :aria-label="isExpanded(entry.row) ? '收起' : '展开'"
                      @click="toggleExpand(entry.row)"
                    >
                      <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M6 3.5 10.5 8 6 12.5" />
                      </svg>
                    </button>
                  </td>
                  <td
                    v-if="selectionEnabled"
                    class="k-table__cell k-table__cell--selection"
                    :style="pinnedCellStyle(entry)"
                    @click.stop
                  >
                    <KCheckbox
                      v-if="selectionType === 'checkbox'"
                      :model-value="isSelected(entry.row)"
                      :disabled="checkboxDisabled(entry.row)"
                      :aria-label="`选择第 ${entry.index + 1} 行`"
                      @update:model-value="checked => toggleRow(entry.row, checked)"
                    />
                    <KRadio
                      v-else
                      :name="selectionName"
                      :value="rowKeyOf(entry.row)"
                      :model-value="selectedKeys[0]"
                      :disabled="checkboxDisabled(entry.row)"
                      :aria-label="`选择第 ${entry.index + 1} 行`"
                      @update:model-value="selectSingleRow(entry.row)"
                    />
                  </td>
                </template>
                  <td
                    v-for="leaf in fixedLeavesOf(side)"
                    :key="leaf.key"
                    class="k-table__cell"
                    :class="[
                      leaf.column.classNames?.cell,
                      side === 'left' ? 'is-fixed-left' : 'is-fixed-right',
                      {
                        'is-align-center': leaf.column.align === 'center',
                        'is-align-right': leaf.column.align === 'right',
                        'is-ellipsis': leaf.column.ellipsis,
                      },
                    ]"
                    :style="[pinnedCellStyle(entry), leaf.column.styles?.cell]"
                  >
                    <KBodyCellInner :column="leaf.column" :row="entry.row" :index="entry.index" />
                  </td>
                </tr>
                <tr
                  v-if="expandableEnabled && !entry.pinned && isExpanded(entry.row)"
                  class="k-table__expanded-row is-overlay-spacer"
                >
                  <td :colspan="fixedColCount(side)" class="k-table__cell"></td>
                </tr>
              </template>
                </template>
            </template>
          </tbody>
          <tfoot v-if="$slots.summary">
            <tr class="is-overlay-spacer">
              <td :colspan="fixedColCount(side)" class="k-table__cell"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
      <div v-if="loading" class="k-table__loading" :class="classNames?.loading" :style="styles?.loading" role="status" aria-label="加载中">
        <KSpin />
      </div>
    </div>
    <div v-if="showBottomPagination" class="k-table__pagination" :class="[classNames?.pagination, `is-${paginationPlacement.align}`]" :style="styles?.pagination">
      <KPagination
        v-model:current="current"
        v-model:page-size="perPage"
        :total="paginationTotal"
        :size="size === 'sm' ? 'sm' : 'md'"
        :page-size-options="paginationConfig.pageSizeOptions"
        :show-size-changer="paginationConfig.showSizeChanger"
        :show-quick-jumper="paginationConfig.showQuickJumper"
        :show-total="paginationConfig.showTotal"
        :hide-on-single-page="paginationConfig.hideOnSinglePage"
        @change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onScopeDispose,
  reactive,
  ref,
  useId,
  useSlots,
  watch,
} from 'vue';
import type { ComponentPublicInstance, CSSProperties, PropType, VNodeChild } from 'vue';
import KCheckbox from '../Checkbox/Checkbox.vue';
import KRadio from '../Radio/Radio.vue';
import KPopover from '../Popover/Popover.vue';
import KButton from '../Button/Button.vue';
import KSpin from '../Spin/Spin.vue';
import KEmpty from '../Empty/Empty.vue';
import KPagination from '../Pagination/Pagination.vue';
import KOverflowTooltip from './OverflowTooltip.vue';
import { useTableColumns } from '../../composables/table/useTableColumns';
import {
  distributeIntegerWidths,
  filterRows,
  getCellValue,
  getRowKey,
  paginateRows,
  sortRows,
  widthStyle,
} from '../../utils/table';
import { getVirtualRange } from '../../utils/virtual';
import type {
  KTableColumn,
  KTableFilterState,
  KTableHeaderCell,
  KTableLeaf,
  KTableRowKey,
  KTableSortState,
} from '../../utils/table';

defineOptions({ name: 'KTable' });

export type {
  KTableColumn,
  KTableFilterState,
  KTableRowKey,
  KTableSortState,
  KTableFilterOption,
  KTableSortOrder,
  KTableAlign,
  KTableCellContext,
  KTableLeaf,
  KTableHeaderCell,
} from '../../utils/table';

export interface KTablePaginationConfig {
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean | ((total: number, range: [number, number]) => string);
  hideOnSinglePage?: boolean;
}

export type KTablePaginationPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'both';

export interface KTableRowSelection<T> {
  /** checkbox = 多选（默认，含全选）；radio = 单选 */
  type?: 'checkbox' | 'radio';
  selectedRowKeys?: KTableRowKey[];
  onChange?: (keys: KTableRowKey[], rows: T[]) => void;
  getCheckboxProps?: (row: T) => { disabled?: boolean };
}

type TablePart =
  | 'root'
  | 'toolbar'
  | 'columnSetting'
  | 'wrap'
  | 'fixedLayer'
  | 'row'
  | 'filterPanel'
  | 'loading'
  | 'pagination';

interface KTableProps<T> {
  columns: KTableColumn<T>[];
  dataSource: T[];
  rowKey?: string | ((row: T, index: number) => KTableRowKey);
  size?: 'sm' | 'md' | 'lg';
  /** 外框与圆角 */
  bordered?: boolean;
  /** 行分隔线 */
  rowBorders?: boolean;
  /** 列分隔线；不传时跟随 bordered */
  columnBorders?: boolean;
  striped?: boolean;
  sticky?: boolean;
  loading?: boolean;
  emptyText?: string;
  /** false = 不分页；对象 = 自定义分页器能力 */
  pagination?: false | KTablePaginationConfig;
  /** 分页器位置：六个角 + both（上下各一份，右下对齐） */
  paginationPosition?: KTablePaginationPosition;
  rowSelection?: KTableRowSelection<T>;
  scroll?: { x?: number | string; y?: number | string };
  /** 大数据量虚拟滚动：要求等行高；展开行/行高不一致时自动退回全量渲染 */
  virtual?: boolean;
  /** 显式指定虚拟行高（px）；内容撑高或行高不一致时仍会自动退回全量渲染 */
  virtualRowHeight?: number;
  /** 受控排序；不传走内部状态 */
  sortState?: KTableSortState | null;
  /** 受控筛选；不传走内部状态 */
  filters?: KTableFilterState;
  /** 内置「列设置」按钮 */
  columnSetting?: boolean;
  /** 行展开：配合 #expanded 插槽；false 可强制关闭 */
  expandable?: boolean;
  /** 默认展开全部可展开行 */
  defaultExpandAll?: boolean;
  /** 指定行是否可展开 */
  rowExpandable?: (row: T) => boolean;
  classNames?: Partial<Record<TablePart, string>>;
  styles?: Partial<Record<TablePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KTableProps<T>>(), {
  rowKey: 'id',
  size: 'md',
  bordered: true,
  rowBorders: true,
  columnBorders: undefined,
  striped: false,
  sticky: false,
  loading: false,
  emptyText: '暂无数据',
  pagination: false,
  paginationPosition: 'bottom-right',
  rowSelection: undefined,
  scroll: undefined,
  columnSetting: false,
  expandable: true,
  defaultExpandAll: false,
  rowExpandable: undefined,
  virtual: false,
  virtualRowHeight: undefined,
});

const emit = defineEmits<{
  sortChange: [sorter: KTableSortState | null];
  filterChange: [filters: KTableFilterState];
  selectionChange: [keys: KTableRowKey[], rows: T[]];
  rowClick: [row: T, index: number, event: MouseEvent];
  pageChange: [page: number, pageSize: number];
  expandChange: [keys: KTableRowKey[], row: T, expanded: boolean];
}>();

const current = defineModel<number>('current', { default: 1 });
const perPage = defineModel<number>('pageSize', { default: 10 });
const expandedRowKeys = defineModel<KTableRowKey[]>('expandedRowKeys', {
  default: () => [],
});
const rowPinning = defineModel<{ top?: KTableRowKey[]; bottom?: KTableRowKey[] }>('rowPinning', {
  default: () => ({}),
});
const columnVisibility = defineModel<Record<string, boolean>>('columnVisibility', {
  default: () => ({}),
});
const rootAttrs = { 'data-part': 'root' };
const filterOpen = reactive<Record<string, boolean>>({});
const slots = useSlots();

const {
  allLeaves,
  leaves,
  headerRows,
  headerDepth,
  keyOfColumn,
  leafIndexByKey,
  settings: columnSettings,
  visibleCount: visibleColumnCount,
} = useTableColumns<T>(() => props.columns, () => columnVisibility.value);

const showColumnBorders = computed(() => props.columnBorders ?? props.bordered);
const paginationEnabled = computed(() => props.pagination !== false);
const paginationPlacement = computed(() => {
  const position = props.paginationPosition;
  if (position === 'both') return { top: true, bottom: true, align: 'right' };
  const [side, align] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  return { top: side === 'top', bottom: side === 'bottom', align };
});
const showTopPagination = computed(
  () => paginationEnabled.value && paginationPlacement.value.top,
);
const showBottomPagination = computed(
  () => paginationEnabled.value && paginationPlacement.value.bottom,
);
const paginationConfig = computed<KTablePaginationConfig>(() =>
  props.pagination === false ? {} : props.pagination,
);
const selectionEnabled = computed(() => Boolean(props.rowSelection));
const selectionType = computed(() => props.rowSelection?.type ?? 'checkbox');
const selectionName = `k-table-selection-${useId()}`;
const expandableEnabled = computed(
  () => props.expandable !== false && Boolean(slots.expanded),
);
const expandedSet = computed(() => new Set(expandedRowKeys.value));
const pinnedTopKeys = computed(() => new Set(rowPinning.value?.top ?? []));
const pinnedBottomKeys = computed(() => new Set(rowPinning.value?.bottom ?? []));
const columnSpan = computed(
  () =>
    leaves.value.length +
    (expandableEnabled.value ? 1 : 0) +
    (selectionEnabled.value ? 1 : 0),
);
const visibleColumns = computed(() => leaves.value.map(leaf => leaf.column));
const toolbarVisible = computed(
  () => props.columnSetting || Boolean(slots.filter || slots.toolbar),
);

const internalSort = ref<KTableSortState | null>(null);
/** 悬浮行高亮：主表与浮层通过 DOM class 直接联动，避免滚动经过行时触发整表重渲染 */
let activeHoverKey: KTableRowKey | null = null;
let pendingHoverKey: KTableRowKey | null = null;
let hoverRaf = 0;
let hoveredRows: HTMLElement[] = [];
function scheduleHover(key: KTableRowKey | null) {
  pendingHoverKey = key;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    if (pendingHoverKey === activeHoverKey) return;
    activeHoverKey = pendingHoverKey;
    const wrap = wrapEl.value;
    if (!wrap) return;
    /* 直接记住行元素，来回移动时只改这两行，不再全表扫描 */
    hoveredRows.forEach(row => row.classList.remove('is-overlay-hover'));
    hoveredRows = [];
    if (activeHoverKey != null) {
      hoveredRows = [
        ...wrap.querySelectorAll<HTMLElement>(
          `.k-table__row[data-row-key="${CSS.escape(String(activeHoverKey))}"]`,
        ),
      ];
      hoveredRows.forEach(row => row.classList.add('is-overlay-hover'));
    }
  });
}
const sort = computed(() => (props.sortState !== undefined ? props.sortState : internalSort.value));
const internalFilters = ref<KTableFilterState>({});
const activeFilters = computed(() => (props.filters !== undefined ? props.filters : internalFilters.value));

/** 行 key 的 index 语义统一为 dataSource 下标（固定行/筛选/分页下保持稳定） */
const sourceIndex = computed(() => {
  const map = new Map<T, number>();
  props.dataSource.forEach((row, index) => map.set(row, index));
  return map;
});

/** 筛选/排序作用于全量叶子列：隐藏列不丢排序与筛选状态 */
const dataColumns = computed(() => allLeaves.value.map(leaf => leaf.column));
const processedRows = computed(() =>
  sortRows(
    filterRows(props.dataSource, dataColumns.value, activeFilters.value),
    dataColumns.value,
    sort.value,
  ),
);
/** 固定行不受筛选/排序/分页影响，始终按 dataSource 顺序显示 */
const pinnedTopRows = computed(() =>
  props.dataSource.filter(row => pinnedTopKeys.value.has(rowKeyOf(row))),
);
const pinnedBottomRows = computed(() =>
  props.dataSource.filter(row => pinnedBottomKeys.value.has(rowKeyOf(row))),
);
const unpinnedRows = computed(() =>
  processedRows.value.filter(
    row => !pinnedTopKeys.value.has(rowKeyOf(row)) && !pinnedBottomKeys.value.has(rowKeyOf(row)),
  ),
);
const pageRows = computed(() =>
  paginationEnabled.value
    ? paginateRows(unpinnedRows.value, current.value, perPage.value)
    : unpinnedRows.value,
);
const paginationTotal = computed(() => unpinnedRows.value.length);

interface KTableBodyRow<T> {
  row: T;
  pinned: 'top' | 'bottom' | null;
  pinIndex: number;
  /** rowClick / 渲染用的数据下标 */
  index: number;
}
const bodyRows = computed<KTableBodyRow<T>[]>(() => [
  ...pinnedTopRows.value.map((row, pinIndex) => ({
    row,
    pinned: 'top' as const,
    pinIndex,
    index: sourceIndex.value.get(row) ?? 0,
  })),
  ...pageRows.value.map((row, index) => ({
    row,
    pinned: null,
    pinIndex: -1,
    index: rowIndexAt(index),
  })),
  ...pinnedBottomRows.value.map((row, pinIndex) => ({
    row,
    pinned: 'bottom' as const,
    pinIndex,
    index: sourceIndex.value.get(row) ?? 0,
  })),
]);

/* ---------- 虚拟滚动：主体与左右浮层共用同一窗口 ---------- */
interface KTableRenderEntry<T> {
  key: string;
  entry?: KTableBodyRow<T>;
  height?: number;
}
const virtualRowHeight = ref(48);
watch(
  () => props.virtualRowHeight,
  value => {
    if (typeof value === 'number' && value > 0) virtualRowHeight.value = value;
  },
  { immediate: true },
);
const virtualStart = ref(0);
const virtualEnd = ref(0);
const virtualBroken = ref(false);
let virtualWarned = false;
const virtualActive = computed(
  () => props.virtual && expandedSet.value.size === 0 && !virtualBroken.value,
);
const virtualEnabled = computed(() => virtualActive.value && pageRows.value.length > 40);
const pinnedTopHeight = ref(0);
const pinnedBottomHeight = ref(0);
const renderEntries = computed<KTableRenderEntry<T>[]>(() => {
  const center = bodyRows.value.slice(
    pinnedTopRows.value.length,
    pinnedTopRows.value.length + pageRows.value.length,
  );
  const entries: KTableRenderEntry<T>[] = bodyRows.value
    .slice(0, pinnedTopRows.value.length)
    .map(entry => ({ key: `top-${rowKeyOf(entry.row)}`, entry }));
  if (virtualEnabled.value) {
    if (virtualStart.value > 0) {
      entries.push({ key: 'virtual-top', height: virtualStart.value * virtualRowHeight.value });
    }
    for (let index = virtualStart.value; index < virtualEnd.value; index++) {
      const entry = center[index];
      if (entry) entries.push({ key: `row-${rowKeyOf(entry.row)}`, entry });
    }
    const rest = center.length - virtualEnd.value;
    if (rest > 0) {
      entries.push({ key: 'virtual-bottom', height: rest * virtualRowHeight.value });
    }
  } else {
    for (const entry of center) entries.push({ key: `row-${rowKeyOf(entry.row)}`, entry });
  }
  for (const entry of bodyRows.value.slice(pinnedTopRows.value.length + pageRows.value.length)) {
    entries.push({ key: `bottom-${rowKeyOf(entry.row)}`, entry });
  }
  return entries;
});
function updateVirtualWindow() {
  if (!virtualEnabled.value) {
    if (virtualStart.value !== 0) virtualStart.value = 0;
    if (virtualEnd.value !== pageRows.value.length) virtualEnd.value = pageRows.value.length;
    return;
  }
  const wrap = wrapEl.value;
  if (!wrap) return;
  const viewport = Math.max(
    0,
    wrap.clientHeight - headerHeight.value - pinnedTopHeight.value - pinnedBottomHeight.value,
  );
  const range = getVirtualRange(
    wrap.scrollTop,
    viewport,
    virtualRowHeight.value,
    pageRows.value.length,
    6,
  );
  /* 缓冲区：只有滚出当前窗口的缓冲带才重算，避免每帧重建行 */
  const buffer = 3 * virtualRowHeight.value;
  const insideWindow =
    virtualStart.value > 0 &&
    virtualEnd.value < pageRows.value.length &&
    wrap.scrollTop > virtualStart.value * virtualRowHeight.value + buffer &&
    wrap.scrollTop + viewport < virtualEnd.value * virtualRowHeight.value - buffer;
  if (insideWindow) return;
  if (range.start !== virtualStart.value) virtualStart.value = range.start;
  if (range.end !== virtualEnd.value) virtualEnd.value = range.end;
}
/** 校验窗口内所有已渲染行：等行高才维持虚拟；任何一行被内容撑高就退回全量渲染 */
function measureVirtualRow() {
  const table = tableEl.value;
  if (!table || !virtualEnabled.value) return;
  const rows = table.querySelectorAll<HTMLElement>(
    ':scope > tbody > tr.k-table__row:not(.is-pinned-top):not(.is-pinned-bottom)',
  );
  if (!rows.length) return;
  const heights: number[] = [];
  rows.forEach(row => {
    const height = row.getBoundingClientRect().height;
    if (height > 0) heights.push(height);
  });
  if (!heights.length) return;
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const expected =
    typeof props.virtualRowHeight === 'number' && props.virtualRowHeight > 0
      ? props.virtualRowHeight
      : virtualRowHeight.value;
  if (max - min > 1 || Math.abs(min - expected) > 1) {
    virtualBroken.value = true;
    if (!virtualWarned && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      virtualWarned = true;
      console.warn(
        '[KTable] 已退回全量渲染：检测到行高不一致（内容换行/撑高）。可给文本列开启 ellipsis / ellipsisTooltip 保持单行，或显式设置 virtualRowHeight。',
      );
    }
    return;
  }
  if (typeof props.virtualRowHeight !== 'number' && Math.abs(min - virtualRowHeight.value) > 0.5) {
    virtualRowHeight.value = min;
  }
  updateVirtualWindow();
}

const leadingWidth = computed(
  () => (expandableEnabled.value ? 44 : 0) + (selectionEnabled.value ? 44 : 0),
);

/** 固定列偏移按实际渲染宽度累计：拉伸/小数宽度时也能与列宽严丝合缝 */
const measuredWidths = ref<Record<string, number>>({});
/** 冻结列宽：固定列 + 横向滚动时把列宽落到整数像素，粘性偏移不再随设备像素取整抖动 */
const frozenWidths = ref<Record<string, number> | null>(null);
const frozenTableWidth = ref<number | null>(null);
let baseWidths: Record<string, number> | null = null;
let baseSignature = '';
function fixedOffsets(side: 'left' | 'right') {
  const result: Record<string, number> = {};
  const ordered = side === 'left' ? leaves.value : [...leaves.value].reverse();
  let offset = side === 'left' ? leadingWidth.value : 0;
  for (const leaf of ordered) {
    if (leaf.column.fixed !== side) continue;
    result[leaf.key] = offset;
    offset +=
      frozenWidths.value?.[leaf.key] ??
      measuredWidths.value[leaf.key] ??
      (Number(leaf.column.width) || 0);
  }
  return result;
}
const leftOffsets = computed(() => fixedOffsets('left'));
const rightOffsets = computed(() => fixedOffsets('right'));
const lastLeftKey = computed(() => {
  const keys = leaves.value.filter(leaf => leaf.column.fixed === 'left').map(leaf => leaf.key);
  return keys[keys.length - 1];
});
const firstRightKey = computed(
  () => leaves.value.find(leaf => leaf.column.fixed === 'right')?.key,
);

const wrapStyle = computed<CSSProperties>(() => {
  const scroll = props.scroll;
  if (!scroll) return {};
  return {
    overflowX: scroll.x ? 'auto' : undefined,
    overflowY: scroll.y != null ? 'auto' : undefined,
    maxHeight: scroll.y == null ? undefined : typeof scroll.y === 'number' ? `${scroll.y}px` : scroll.y,
    /* 预留滚动条槽：内容高度变化时不再因滚动条显隐改变可用宽度，避免列宽重排抖动 */
    scrollbarGutter: scroll.y != null ? 'stable' : undefined,
  };
});
const tableStyle = computed<CSSProperties>(() => {
  const frozen = frozenTableWidth.value;
  return {
    width: frozen == null ? undefined : `${frozen}px`,
    minWidth:
      frozen == null && props.scroll?.x != null ? widthStyle(props.scroll.x) : undefined,
    /* 省略依赖固定布局；固定列也用固定布局稳定列宽，避免随内容伸缩造成漂移 */
    tableLayout:
      frozen != null ||
      leaves.value.some(leaf => leaf.column.ellipsis) ||
      leaves.value.some(leaf => leaf.column.fixed)
        ? 'fixed'
        : undefined,
  };
});
function colStyle(leaf: KTableLeaf<T>): CSSProperties {
  const frozen = frozenWidths.value?.[leaf.key];
  return { width: frozen == null ? widthStyle(leaf.column.width) : `${frozen}px` };
}

/* ---------- 吸顶测量、固定行堆叠偏移、滚动阴影状态 ---------- */
const wrapEl = ref<HTMLElement | null>(null);
const tableEl = ref<HTMLElement | null>(null);
const headEl = ref<HTMLElement | null>(null);
const headerRowEls = ref<(HTMLElement | null)[]>([]);
const headerRowTops = ref<number[]>([]);
const headerHeight = ref(0);
const pinnedTopOffsets = ref<number[]>([]);
const pinnedBottomOffsets = ref<number[]>([]);
const scrollState = reactive({ left: false, right: false, top: false, bottom: false });
let layoutResizeObserver: ResizeObserver | null = null;
let layoutMeasureRaf = 0;
let measuringLayout = false;
let maxScrollLeft = 0;
let maxScrollTop = 0;
let syncScrollRaf = 0;

function setHeaderRowEl(el: Element | ComponentPublicInstance | null, rowIndex: number) {
  headerRowEls.value[rowIndex] = (el as HTMLElement | null) ?? null;
}
function measureHeaderRows() {
  let top = 0;
  headerRowTops.value = headerRowEls.value.map(el => {
    const rowTop = top;
    top += el?.offsetHeight ?? 0;
    return rowTop;
  });
  headerHeight.value = top;
}
/** 固定行堆叠：top 从表头下方累加；bottom 从容器底部向上累加 */
function measurePinnedRows() {
  const table = tableEl.value;
  if (!table) return;
  const heights = (selector: string) =>
    [...table.querySelectorAll<HTMLElement>(selector)].map(tr => tr.getBoundingClientRect().height);

  let top = props.sticky ? headerHeight.value : 0;
  const topHeights: number[] = [];
  pinnedTopOffsets.value = heights(':scope > tbody > tr.is-pinned-top').map(height => {
    const offset = top;
    top += height;
    topHeights.push(height);
    return offset;
  });
  pinnedTopHeight.value = topHeights.reduce((sum, height) => sum + height, 0);

  const bottomHeights = heights(':scope > tbody > tr.is-pinned-bottom');
  const bottoms: number[] = new Array(bottomHeights.length);
  let bottom = 0;
  for (let index = bottomHeights.length - 1; index >= 0; index--) {
    bottoms[index] = bottom;
    bottom += bottomHeights[index];
  }
  pinnedBottomOffsets.value = bottoms;
  pinnedBottomHeight.value = bottomHeights.reduce((sum, height) => sum + height, 0);
}
function measureColumnWidths() {
  const table = tableEl.value;
  if (!table) return;
  const next: Record<string, number> = {};
  table.querySelectorAll<HTMLElement>('thead th[data-column-key]').forEach(th => {
    const key = th.dataset.columnKey;
    if (key) next[key] = th.getBoundingClientRect().width;
  });
  const keys = Object.keys(next);
  if (!keys.length) return;
  const unchanged =
    keys.length === Object.keys(measuredWidths.value).length &&
    keys.every(key => Math.abs(next[key] - (measuredWidths.value[key] ?? -1)) < 0.01);
  if (!unchanged) measuredWidths.value = next;
}
/**
 * 固定列 + 横向滚动时，浏览器会把 100% 表宽按比例摊成 166.66 这类小数列宽，
 * 粘性单元格滚动时要按设备像素取整，就会来回 1px 抖动。
 * 这里把列宽冻结成整数、表宽取整数总和，列宽与粘性偏移就恒定不变。
 */
function quantizeColumnWidths() {
  const wrap = wrapEl.value;
  const scrollX = props.scroll?.x;
  const eligible =
    typeof scrollX === 'number' &&
    leaves.value.length > 0 &&
    (leadingWidth.value > 0 || leaves.value.some(leaf => leaf.column.fixed)) &&
    leaves.value.every(
      leaf => typeof leaf.column.width !== 'string' || !leaf.column.width.trim().endsWith('%'),
    );
  if (!wrap || !eligible) {
    baseWidths = null;
    baseSignature = '';
    if (frozenWidths.value) frozenWidths.value = null;
    if (frozenTableWidth.value != null) frozenTableWidth.value = null;
    return;
  }
  const signature = leaves.value.map(leaf => `${leaf.key}:${leaf.column.width ?? ''}`).join('|');
  if (!baseWidths || signature !== baseSignature) {
    baseWidths = {};
    for (const leaf of leaves.value) {
      baseWidths[leaf.key] = measuredWidths.value[leaf.key] ?? (Number(leaf.column.width) || 0);
    }
    baseSignature = signature;
  }
  const leading = leadingWidth.value;
  const total = Math.max(
    Math.round(typeof scrollX === 'number' ? scrollX : 0),
    Math.ceil(wrap.clientWidth),
    leading + leaves.value.length,
  );
  const next = distributeIntegerWidths(baseWidths, total - leading);
  const tableWidth = leading + Object.values(next).reduce((acc, value) => acc + value, 0);
  const unchanged =
    frozenTableWidth.value === tableWidth &&
    frozenWidths.value != null &&
    leaves.value.every(leaf => frozenWidths.value?.[leaf.key] === next[leaf.key]);
  if (unchanged) return;
  frozenWidths.value = next;
  frozenTableWidth.value = tableWidth;
}
function syncScrollState() {
  const el = wrapEl.value;
  if (!el) return;
  /* 2px 迟滞：触摸板回弹/亚像素滚动不会在边界反复切换阴影 */
  const edge = 2;
  scrollState.left = el.scrollLeft > edge;
  scrollState.right = el.scrollLeft < maxScrollLeft - edge;
  scrollState.top = el.scrollTop > edge;
  scrollState.bottom = el.scrollTop < maxScrollTop - edge;
}
function measureLayout() {
  if (measuringLayout) return;
  measuringLayout = true;
  try {
    measureHeaderRows();
    measureColumnWidths();
    quantizeColumnWidths();
    measurePinnedRows();
    syncFixedLayers();
    measureVirtualRow();
    tableHeight.value = tableEl.value?.getBoundingClientRect().height ?? 0;
    const wrap = wrapEl.value;
    if (wrap) {
      maxScrollLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    }
    scrollRange.value = maxScrollLeft;
    updateVirtualWindow();
    syncScrollState();
  } finally {
    measuringLayout = false;
  }
}
/* 自身写行高会触发 ResizeObserver：合并到下一帧，并避免测量过程中重入 */
function scheduleMeasureLayout() {
  if (measuringLayout || layoutMeasureRaf) return;
  layoutMeasureRaf = requestAnimationFrame(() => {
    layoutMeasureRaf = 0;
    measureLayout();
  });
}
function onWrapScroll() {
  /* 滚动帧里不读 scrollWidth/scrollHeight（会强制排版），状态合并到每帧一次 */
  if (syncScrollRaf) return;
  syncScrollRaf = requestAnimationFrame(() => {
    syncScrollRaf = 0;
    syncScrollState();
    updateVirtualWindow();
  });
}
onMounted(async () => {
  await nextTick();
  measureLayout();
  if (props.defaultExpandAll && expandableEnabled.value && !expandedRowKeys.value.length) {
    expandedRowKeys.value = props.dataSource
      .filter(row => canExpand(row))
      .map(row => rowKeyOf(row));
  }
  if (typeof ResizeObserver !== 'undefined') {
    layoutResizeObserver = new ResizeObserver(scheduleMeasureLayout);
    for (const el of [headEl.value, tableEl.value, wrapEl.value]) {
      if (el) layoutResizeObserver.observe(el);
    }
  }
});
onScopeDispose(() => {
  layoutResizeObserver?.disconnect();
  layoutResizeObserver = null;
  if (syncScrollRaf) cancelAnimationFrame(syncScrollRaf);
  syncScrollRaf = 0;
  if (layoutMeasureRaf) cancelAnimationFrame(layoutMeasureRaf);
  layoutMeasureRaf = 0;
  if (hoverRaf) cancelAnimationFrame(hoverRaf);
  hoverRaf = 0;
});
watch(
  [
    () => headerRows.value.length,
    () => bodyRows.value.length,
    () => expandedSet.value.size,
    () => leaves.value.map(leaf => leaf.key).join('|'),
    () => processedRows.value,
    () => props.scroll?.x,
    () => props.scroll?.y,
  ],
  async () => {
    virtualBroken.value = false;
    await nextTick();
    measureLayout();
  },
);

/** 行 key 的 index 统一取 dataSource 下标，固定行/筛选/分页下保持稳定 */
function rowKeyOf(row: T, index?: number): KTableRowKey {
  return getRowKey(
    row,
    props.rowKey as string | ((row: T, index: number) => KTableRowKey),
    index ?? sourceIndex.value.get(row) ?? 0,
  );
}
/** 分页下表内行号 → 数据集绝对行号（rowClick 与渲染序号使用） */
function rowIndexAt(pageIndex: number): number {
  return paginationEnabled.value ? (current.value - 1) * perPage.value + pageIndex : pageIndex;
}

function pinnedCellStyle(entry: KTableBodyRow<T>): CSSProperties {
  if (!entry.pinned) return {};
  const offsets = entry.pinned === 'top' ? pinnedTopOffsets.value : pinnedBottomOffsets.value;
  const offset = offsets[entry.pinIndex] ?? 0;
  return entry.pinned === 'top' ? { top: `${offset}px` } : { bottom: `${offset}px` };
}

function canExpand(row: T) {
  return props.rowExpandable ? props.rowExpandable(row) : true;
}
function isExpanded(row: T) {
  return expandedSet.value.has(rowKeyOf(row));
}
function toggleExpand(row: T) {
  const key = rowKeyOf(row);
  const next = new Set(expandedRowKeys.value);
  const expanded = !next.has(key);
  if (expanded) next.add(key);
  else next.delete(key);
  expandedRowKeys.value = [...next];
  emit('expandChange', [...next], row, expanded);
}

function leafIndex(key?: string) {
  return key ? (leafIndexByKey.value.get(key) ?? -1) : -1;
}
function cellStyle(column: KTableColumn<T>, key: string): CSSProperties {
  const style: CSSProperties = {};
  if (column.fixed === 'left') style.left = `${leftOffsets.value[key] ?? 0}px`;
  if (column.fixed === 'right') style.right = `${rightOffsets.value[key] ?? 0}px`;
  return style;
}
function fixedClass(column: KTableColumn<T>, key: string) {
  return {
    'is-fixed': Boolean(column.fixed),
    'is-fixed-left': column.fixed === 'left',
    'is-fixed-right': column.fixed === 'right',
    'is-fixed-edge': key === lastLeftKey.value || key === firstRightKey.value,
  };
}

/* ---------- 固定列浮层：横向滚动时用独立表格承载固定列，避免 sticky 单元格逐帧重绘 ---------- */
const leftFixedLeaves = computed(() => leaves.value.filter(leaf => leaf.column.fixed === 'left'));
const rightFixedLeaves = computed(() => leaves.value.filter(leaf => leaf.column.fixed === 'right'));
const fixedSides = computed(() => {
  const sides: Array<'left' | 'right'> = [];
  if (leftFixedLeaves.value.length) sides.push('left');
  if (rightFixedLeaves.value.length) sides.push('right');
  return sides;
});
/* 分组跨固定/非固定边界时无法拆成浮层，退回单元格 sticky */
const overlayGroupsConsistent = computed(() =>
  headerRows.value.every(row =>
    row.every(
      cell =>
        !cell.isGroup ||
        new Set(leafColumnsUnder(cell.column).map(column => column.fixed ?? 'none')).size <= 1,
    ),
  ),
);
const overlayEnabled = computed(
  () =>
    typeof props.scroll?.x === 'number' &&
    fixedSides.value.length > 0 &&
    overlayGroupsConsistent.value,
);
/** 左浮层存在时，展开/选择列也并入浮层，主表不再保留粘性体单元格 */
const leadingInOverlay = computed(() => overlayEnabled.value && leftFixedLeaves.value.length > 0);
const leftLeadingCount = computed(() =>
  leadingInOverlay.value ? (expandableEnabled.value ? 1 : 0) + (selectionEnabled.value ? 1 : 0) : 0,
);
function fixedColCount(side: 'left' | 'right') {
  return fixedLeavesOf(side).length + (side === 'left' ? leftLeadingCount.value : 0);
}
function isOverlayColumn(column: KTableColumn<T>) {
  return overlayEnabled.value && Boolean(column.fixed);
}
function isOverlayHeaderCell(cell: KTableHeaderCell<T>) {
  return overlayEnabled.value && headerSide(cell) != null;
}
function fixedLeavesOf(side: 'left' | 'right') {
  return side === 'left' ? leftFixedLeaves.value : rightFixedLeaves.value;
}
function leafWidthOf(leaf: KTableLeaf<T>) {
  return (
    frozenWidths.value?.[leaf.key] ??
    measuredWidths.value[leaf.key] ??
    (Number(leaf.column.width) || 0)
  );
}
const tableHeight = ref(0);
const scrollRange = ref(0);
const canvasStyle = computed(
  () =>
    ({
      width: frozenTableWidth.value != null ? `${frozenTableWidth.value}px` : '100%',
      '--k-table-scroll-range': `${scrollRange.value}px`,
    }) as CSSProperties,
);
const fixedLayerEls: Record<'left' | 'right', HTMLElement | null> = { left: null, right: null };
function setFixedLayerEl(el: Element | ComponentPublicInstance | null, side: 'left' | 'right') {
  fixedLayerEls[side] = (el as HTMLElement | null) ?? null;
}
function fixedLayerStyle(side: 'left' | 'right'): CSSProperties {
  const height = tableHeight.value;
  const includeLeading = side === 'left' && leadingInOverlay.value;
  const width =
    (includeLeading ? leadingWidth.value : 0) +
    fixedLeavesOf(side).reduce((sum, leaf) => sum + leafWidthOf(leaf), 0);
  const style: Record<string, string | number> = {
    width: `${width}px`,
    height: `${height}px`,
    marginTop: `${-height}px`,
  };
  if (side === 'left') {
    style.marginLeft = includeLeading ? '0px' : `${leadingWidth.value}px`;
    style['--k-fixed-inset'] = includeLeading ? '0px' : `${leadingWidth.value}px`;
  } else {
    style.marginInlineStart = 'auto';
  }
  return style as CSSProperties;
}
function overlayHeaderStyle(rowIndex: number): CSSProperties {
  return props.sticky ? { top: `${headerRowTops.value[rowIndex] ?? 0}px` } : {};
}
function overlayHeaderCells(row: KTableHeaderCell<T>[], side: 'left' | 'right') {
  return row.filter(cell => headerSide(cell) === side);
}
/** 浮层与主表逐行对齐：行高取两边的最大值，回写到两张表 */
function syncFixedLayers() {
  const main = tableEl.value;
  if (!main || !overlayEnabled.value) return;
  /* 先完成所有读，再统一写：左右浮层共用一次布局结果，避免两侧读写交错强制回流 */
  const mainHeadHeights = [...main.querySelectorAll<HTMLElement>(':scope > thead > tr')].map(
    row => row.getBoundingClientRect().height,
  );
  const mainRows = [
    ...main.querySelectorAll<HTMLElement>(
      ':scope > tbody > tr:not(.k-table__virtual-spacer), :scope > tfoot > tr',
    ),
  ];
  const rowHeights = mainRows.map(row => row.getBoundingClientRect().height);
  const sides = fixedSides.value
    .map(side => {
      const overlayTable = fixedLayerEls[side]?.querySelector('table');
      if (!overlayTable) return null;
      const rows = [
        ...overlayTable.querySelectorAll<HTMLElement>(
          ':scope > tbody > tr:not(.k-table__virtual-spacer), :scope > tfoot > tr',
        ),
      ];
      return {
        headRows: [...overlayTable.querySelectorAll<HTMLElement>(':scope > thead > tr')],
        rows,
        heights: rows.map(row => row.getBoundingClientRect().height),
      };
    })
    .filter((side): side is { headRows: HTMLElement[]; rows: HTMLElement[]; heights: number[] } =>
      Boolean(side),
    );
  /* 行高取主表与所有浮层的最大值，一次写回全部表格 */
  for (let index = 0; index < rowHeights.length; index++) {
    let height = rowHeights[index];
    for (const side of sides) {
      const sideHeight = side.heights[index];
      if (sideHeight != null && sideHeight > height) height = sideHeight;
    }
    rowHeights[index] = height;
  }
  mainRows.forEach((row, index) => {
    row.style.height = `${rowHeights[index]}px`;
  });
  for (const side of sides) {
    side.headRows.forEach((row, index) => {
      const height = mainHeadHeights[index];
      if (height != null) row.style.height = `${height}px`;
    });
    const count = Math.min(side.rows.length, rowHeights.length);
    for (let index = 0; index < count; index++) {
      side.rows[index].style.height = `${rowHeights[index]}px`;
    }
  }
}

function leafColumnsUnder(column: KTableColumn<T>): KTableColumn<T>[] {
  return column.children?.length ? column.children.flatMap(leafColumnsUnder) : [column];
}
function leafKeysUnder(column: KTableColumn<T>): string[] {
  return leafColumnsUnder(column)
    .map(item => keyOfColumn(item))
    .filter((key): key is string => Boolean(key));
}
/** 分组表头只在整组同侧固定时跟随吸边；跨固定/非固定的分组不固定 */
function headerSide(cell: KTableHeaderCell<T>): 'left' | 'right' | undefined {
  if (!cell.isGroup) return cell.column.fixed;
  const columns = leafColumnsUnder(cell.column);
  if (columns.every(column => column.fixed === 'left')) return 'left';
  if (columns.every(column => column.fixed === 'right')) return 'right';
  return undefined;
}
function headerCellStyle(cell: KTableHeaderCell<T>, rowIndex: number): CSSProperties {
  const style: CSSProperties = {};
  if (props.sticky) style.top = `${headerRowTops.value[rowIndex] ?? 0}px`;
  const side = headerSide(cell);
  if (!side) return style;
  const keys = cell.isGroup ? leafKeysUnder(cell.column) : [(cell.leafKey ?? '')];
  const offsets = side === 'left' ? leftOffsets.value : rightOffsets.value;
  const values = keys.map(key => offsets[key]).filter((value): value is number => value != null);
  const offset = values.length ? Math.min(...values) : 0;
  if (side === 'left') style.left = `${offset}px`;
  else style.right = `${offset}px`;
  return style;
}
function headerFixedClass(cell: KTableHeaderCell<T>) {
  const side = headerSide(cell);
  return {
    'is-fixed': Boolean(side),
    'is-fixed-left': side === 'left',
    'is-fixed-right': side === 'right',
  };
}

function cellText(column: KTableColumn<T>, row: T): string {
  const value = getCellValue(row, column.dataIndex);
  return value == null ? '' : String(value);
}

function ariaSort(key?: string) {
  if (!key) return undefined;
  if (sort.value?.columnKey !== key) return 'none';
  return sort.value.order === 'ascend' ? 'ascending' : 'descending';
}
function sortClass(key?: string) {
  if (!key || sort.value?.columnKey !== key) return null;
  return sort.value.order === 'ascend' ? 'is-asc' : 'is-desc';
}

function toggleSort(column: KTableColumn<T>, key: string) {
  if (!column.sortable) return;
  const currentOrder = sort.value?.columnKey === key ? sort.value.order : null;
  const nextOrder =
    currentOrder === null ? 'ascend' : currentOrder === 'ascend' ? 'descend' : null;
  const next: KTableSortState | null = nextOrder ? { columnKey: key, order: nextOrder } : null;
  if (props.sortState === undefined) internalSort.value = next;
  emit('sortChange', next);
  if (paginationEnabled.value) current.value = 1;
}

function filtersOf(column: KTableColumn<T>, key: string) {
  return activeFilters.value[key] ?? [];
}
function toggleFilterValue(
  column: KTableColumn<T>,
  key: string,
  value: string | number | boolean,
  checked: boolean,
) {
  const next: KTableFilterState = { ...activeFilters.value };
  const multiple = column.filterMultiple !== false;
  const values = new Set(multiple ? next[key] ?? [] : []);
  if (checked) values.add(value);
  else values.delete(value);
  if (values.size) next[key] = [...values];
  else delete next[key];
  if (props.filters === undefined) internalFilters.value = next;
  emit('filterChange', next);
  if (paginationEnabled.value) current.value = 1;
}
function clearFilter(column: KTableColumn<T>, key: string) {
  const next: KTableFilterState = { ...activeFilters.value };
  delete next[key];
  if (props.filters === undefined) internalFilters.value = next;
  emit('filterChange', next);
  if (paginationEnabled.value) current.value = 1;
}

function toggleColumnVisible(key: string, visible: boolean) {
  if (!visible && visibleColumnCount.value <= 1) return;
  columnVisibility.value = { ...columnVisibility.value, [key]: visible };
}
function resetColumnVisibility() {
  columnVisibility.value = {};
}

/* ---------- 行选择 ---------- */
const internalSelected = ref<KTableRowKey[]>([]);
const selectedKeys = computed(() => props.rowSelection?.selectedRowKeys ?? internalSelected.value);
const selectedSet = computed(() => new Set(selectedKeys.value));

function checkboxDisabled(row: T) {
  return Boolean(props.rowSelection?.getCheckboxProps?.(row)?.disabled);
}
function isSelected(row: T) {
  return selectedSet.value.has(rowKeyOf(row));
}
function commitSelection(keys: KTableRowKey[]) {
  if (props.rowSelection?.selectedRowKeys === undefined) internalSelected.value = keys;
  const keySet = new Set(keys);
  const rows = props.dataSource.filter(row => keySet.has(rowKeyOf(row)));
  props.rowSelection?.onChange?.(keys, rows);
  emit('selectionChange', keys, rows);
}
function toggleRow(row: T, checked: boolean) {
  const key = rowKeyOf(row);
  const next = new Set(selectedKeys.value);
  if (checked) next.add(key);
  else next.delete(key);
  commitSelection([...next]);
}
function selectSingleRow(row: T) {
  commitSelection([rowKeyOf(row)]);
}

const pageSelectableRows = computed(() =>
  pageRows.value.filter(row => !checkboxDisabled(row)),
);
const allChecked = computed(
  () =>
    pageSelectableRows.value.length > 0 &&
    pageSelectableRows.value.every(row => selectedSet.value.has(rowKeyOf(row))),
);
const partiallyChecked = computed(
  () =>
    !allChecked.value &&
    pageSelectableRows.value.some(row => selectedSet.value.has(rowKeyOf(row))),
);
function toggleAll(checked: boolean) {
  const next = new Set(selectedKeys.value);
  for (const row of pageRows.value) {
    if (checkboxDisabled(row)) continue;
    const key = rowKeyOf(row);
    if (checked) next.add(key);
    else next.delete(key);
  }
  commitSelection([...next]);
}

function onRowClick(row: T, index: number, event: MouseEvent) {
  emit('rowClick', row, index, event);
}
function onPageChange(page: number, pageSize: number) {
  if (!pageSize) return;
  emit('pageChange', page, pageSize);
}

/* 单元格内容：列 render 优先，否则按 dataIndex 取原始值 */
const KCellContent = defineComponent({
  props: {
    column: { type: Object as PropType<KTableColumn<T>>, required: true },
    row: { type: Object as PropType<T>, required: true },
    index: { type: Number, required: true },
  },
  setup(cellProps) {
    return () => {
      const column = cellProps.column;
      const value = getCellValue(cellProps.row, column.dataIndex);
      if (column.render) {
        return column.render({ row: cellProps.row, value, index: cellProps.index, column });
      }
      return h('span', value == null ? '' : String(value));
    };
  },
});

/* 单元格内容（省略/提示），主表与固定列浮层共用 */
const KBodyCellInner = defineComponent({
  props: {
    column: { type: Object as PropType<KTableColumn<T>>, required: true },
    row: { type: Object as PropType<T>, required: true },
    index: { type: Number, required: true },
  },
  setup(cellProps) {
    return () => {
      const content = h(KCellContent, {
        column: cellProps.column,
        row: cellProps.row,
        index: cellProps.index,
      });
      if (cellProps.column.ellipsisTooltip) {
        return h(
          KOverflowTooltip,
          { text: cellText(cellProps.column, cellProps.row) },
          { default: () => content },
        );
      }
      if (cellProps.column.ellipsis) {
        return h('span', { class: 'k-table__ellipsis-text' }, [content]);
      }
      return content;
    };
  },
});

/* 表头内容（排序 + 筛选），主表与固定列浮层共用 */
const KHeadCell = defineComponent({
  props: {
    cell: { type: Object as PropType<KTableHeaderCell<T>>, required: true },
  },
  setup(headProps) {
    return () => {
      const cell = headProps.cell;
      const key = cell.leafKey ?? '';
      const title = slots.header
        ? slots.header({ column: cell.column, index: leafIndex(cell.leafKey) })
        : cell.column.title;
      const sorter = h(
        'span',
        { class: ['k-table__sorter', sortClass(cell.leafKey)], 'aria-hidden': 'true' },
        [
          h('svg', { viewBox: '0 0 8 5', width: 8, height: 5, fill: 'currentColor' }, [
            h('path', { d: 'M4 0 8 5H0z' }),
          ]),
          h('svg', { viewBox: '0 0 8 5', width: 8, height: 5, fill: 'currentColor' }, [
            h('path', { d: 'M4 5 0 0h8z' }),
          ]),
        ],
      );
      const label =
        !cell.isGroup && cell.column.sortable
          ? h(
              'button',
              { type: 'button', class: 'k-table__sort', onClick: () => toggleSort(cell.column, key) },
              [title, sorter],
            )
          : h('span', { class: 'k-table__th-text' }, [title]);
      const inner: VNodeChild[] = [label];
      if (!cell.isGroup && cell.column.filters?.length) {
        inner.push(
          h(
            KPopover,
            {
              open: filterOpen[key],
              'onUpdate:open': (value: boolean) => {
                filterOpen[key] = value;
              },
              trigger: 'click',
              placement: 'bottomLeft',
              arrow: false,
            },
            {
              trigger: () =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: ['k-table__filter', { 'is-active': Boolean(filtersOf(cell.column, key).length) }],
                    'aria-label': `筛选${cell.column.title ?? ''}`,
                  },
                  [
                    h(
                      'svg',
                      {
                        viewBox: '0 0 16 16',
                        width: '1em',
                        height: '1em',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': 1.4,
                        'stroke-linecap': 'round',
                        'aria-hidden': 'true',
                      },
                      [h('path', { d: 'M2.5 3.5h11l-4.2 5v4.2L6.7 14V8.5z' })],
                    ),
                  ],
                ),
              default: () =>
                h(
                  'div',
                  {
                    class: ['k-table__filter-panel', props.classNames?.filterPanel],
                    style: props.styles?.filterPanel,
                    onClick: (event: Event) => event.stopPropagation(),
                  },
                  [
                    h(
                      'div',
                      { class: 'k-table__filter-options' },
                      cell.column.filters!.map(option =>
                        h(
                          KCheckbox,
                          {
                            key: String(option.value),
                            modelValue: filtersOf(cell.column, key).includes(option.value),
                            'onUpdate:modelValue': (checked: boolean) =>
                              toggleFilterValue(cell.column, key, option.value, checked),
                          },
                          { default: () => option.label },
                        ),
                      ),
                    ),
                    h('div', { class: 'k-table__filter-actions' }, [
                      h(
                        KButton,
                        { size: 'xs', onClick: () => clearFilter(cell.column, key) },
                        { default: () => '重置' },
                      ),
                      h(
                        KButton,
                        {
                          size: 'xs',
                          type: 'primary',
                          onClick: () => {
                            filterOpen[key] = false;
                          },
                        },
                        { default: () => '确定' },
                      ),
                    ]),
                  ],
                ),
            },
          ),
        );
      }
      return h('div', { class: 'k-table__th-inner' }, inner);
    };
  },
});

watch(
  () => paginationTotal.value,
  () => {
    if (paginationEnabled.value && current.value > 1) {
      const pages = Math.max(1, Math.ceil(paginationTotal.value / perPage.value));
      if (current.value > pages) current.value = pages;
    }
  },
);

defineSlots<{
  header?(scope: { column: KTableColumn<T>; index: number }): VNodeChild;
  empty?(scope: { columns: KTableColumn<T>[] }): VNodeChild;
  summary?(scope: { columns: KTableColumn<T>[]; rows: T[] }): VNodeChild;
  expanded?(scope: { row: T; index: number; rowKey: KTableRowKey }): VNodeChild;
  filter?(scope: {
    columns: KTableLeaf<T>[];
    visibility: Record<string, boolean>;
  }): VNodeChild;
  toolbar?(scope: { columns: KTableLeaf<T>[] }): VNodeChild;
}>();
</script>

<style>
.k-table {
  --k-table-cell-padding-y: 12px;
  --k-table-cell-padding-x: var(--k-size);
  /* 表头必须是实色：粘性表头下方滚动内容会透出半透明底色 */
  --k-table-head-bg: color-mix(in oklab, var(--k-color-text-base) 1.5%, var(--k-color-bg-container));
  /* 固定列会盖在滚动单元格上，任何行的状态色都必须是实色 */
  --k-table-hover-bg: color-mix(in oklab, var(--k-color-text-base) 2%, var(--k-color-bg-container));
  --k-table-stripe-bg: color-mix(in oklab, var(--k-color-text-base) 2%, var(--k-color-bg-container));
  --k-table-border: var(--k-neutral-2);

  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 0;
  color: var(--k-color-text);
  font-size: var(--k-font-size);
}
.k-table__wrap {
  position: relative;
  min-width: 0;
  margin: 0;
  border-radius: var(--k-border-radius);
  /* 防止滚动锚定在固定列场景下引发位置跳动 */
  overflow-anchor: none;
}
/* 固定列浮层：sticky 容器 + 独立表格，横向滚动时固定列不参与重绘 */
.k-table__canvas {
  position: relative;
  min-width: 0;
}
.k-table__fixed-layer {
  position: sticky;
  z-index: 6;
  min-width: 0;
  /* 只有左右两块，独立合成后平移吸附跟随滚动帧，快速滚动不抖 */
  will-change: transform;
}
.k-table__fixed-layer.is-left {
  left: var(--k-fixed-inset, 0px);
}
.k-table__fixed-layer.is-right {
  right: 0;
}
/* 支持滚动驱动动画时用 transform 吸附：不产生粘性元素，滚动保持合成层，普通列不再逐帧重绘 */
@supports (animation-timeline: scroll()) {
  .k-table__fixed-layer.is-left,
  .k-table__fixed-layer.is-right {
    position: relative;
    left: auto;
    right: auto;
    animation-duration: auto;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-timeline: scroll(nearest inline);
  }
  .k-table__fixed-layer.is-left {
    animation-name: k-table-pin-left;
  }
  .k-table__fixed-layer.is-right {
    animation-name: k-table-pin-right;
  }
}
@keyframes k-table-pin-left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--k-table-scroll-range, 0px));
  }
}
@keyframes k-table-pin-right {
  from {
    transform: translateX(calc(-1 * var(--k-table-scroll-range, 0px)));
  }
  to {
    transform: translateX(0);
  }
}
/* 浮层边缘阴影整条绘制：纵向滚动时不会像逐行阴影那样跟着行走 */
.k-table__fixed-layer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  z-index: 3;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-table__fixed-layer.is-left::after {
  right: 0;
  transform: translateX(100%);
  background: linear-gradient(to right, rgb(0 0 0 / 18%), transparent);
}
.k-table__fixed-layer.is-right::after {
  left: 0;
  transform: translateX(-100%);
  background: linear-gradient(to left, rgb(0 0 0 / 18%), transparent);
}
.k-table.has-scroll-left .k-table__fixed-layer.is-left::after,
.k-table.has-scroll-right .k-table__fixed-layer.is-right::after {
  opacity: 1;
}
.k-table__fixed-layer .k-table__fixed-table {
  display: table;
  width: 100%;
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.k-table__fixed-layer .is-overlay-spacer,
.k-table__fixed-layer .is-overlay-spacer > .k-table__cell {
  pointer-events: none;
}
.k-table__fixed-layer .is-overlay-spacer > .k-table__cell {
  padding: 0;
  border: 0;
  background-color: transparent;
  background-image: none;
}
/* 虚拟滚动占位行：只负责撑高，不画任何装饰 */
.k-table .k-table__virtual-spacer > .k-table__cell {
  padding: 0;
  border: 0;
  background-color: transparent;
  background-image: none;
  pointer-events: none;
}
/* 加 .k-table 前缀提高特异度，避免被宿主文档样式（如 .vp-doc table/th/td）覆盖 */
.k-table .k-table__table {
  display: table;
  width: 100%;
  margin: 0;
  overflow: visible;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
}
.k-table .k-table__cell {
  box-sizing: border-box;
  padding: var(--k-table-cell-padding-y) var(--k-table-cell-padding-x);
  border: 0;
  background-color: var(--k-color-bg-container);
  text-align: start;
  vertical-align: middle;
}
/* 行分隔线用背景绘制而不是真边框：行高保持偶数，单元格内容落在整像素，
   跨行表头纵向居中也才不会出现 0.5px，滚动重绘时不上下跳 */
.k-table.is-row-borders .k-table__cell {
  background-image: linear-gradient(
    to top,
    var(--k-table-border) 0 var(--k-line-width),
    transparent var(--k-line-width)
  );
  background-repeat: no-repeat;
  background-position: left bottom;
}
.k-table .k-table__cell--head {
  color: var(--k-color-text-secondary);
  font-weight: var(--k-font-weight-heading);
  background-color: var(--k-table-head-bg);
  text-align: start;
  white-space: nowrap;
}
.k-table .k-table__cell.is-align-center {
  text-align: center;
}
.k-table .k-table__cell.is-align-right {
  text-align: end;
}
.k-table__th-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
/* 排序 + 筛选并排：弹层触发器默认按行高排布，会让筛选图标比排序文字高约 2px */
.k-table .k-table__th-inner .k-popover__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.k-table__th-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-table__sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.k-table__sort:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}
.k-table__sorter {
  display: inline-flex;
  flex-direction: column;
  /* 2px 间距让两个 5px 箭头总高 12px，在 24px 行内落在整像素，滚动重绘不上下跳 */
  gap: 2px;
  color: var(--k-color-text-quaternary);
  transform: translateY(-1px);
}
.k-table__sorter svg {
  width: 7px;
  height: 5px;
}
.k-table__sorter.is-asc svg:first-child,
.k-table__sorter.is-desc svg:last-child {
  color: var(--k-color-primary);
}
.k-table__filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--k-color-text-tertiary);
  cursor: pointer;
}
.k-table__filter:hover,
.k-table__filter.is-active {
  color: var(--k-color-primary);
}
.k-table__filter:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 1px;
}
.k-table__filter-panel {
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xs);
  min-width: 160px;
  padding: var(--k-size-xs) 0;
}
.k-table__filter-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.k-table__filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--k-size-xs);
  padding-top: var(--k-size-xs);
  border-top: var(--k-line-width) solid var(--k-color-border);
}
.k-table .k-table__row,
.k-table .k-table__empty-row {
  background: transparent;
  border-top: 0;
  cursor: default;
}
.k-table .k-table__row:hover > .k-table__cell {
  background-color: var(--k-table-hover-bg);
}
.k-table .k-table__row.is-overlay-hover > .k-table__cell {
  background-color: var(--k-table-hover-bg);
}
.k-table .k-table__row.is-selected > .k-table__cell {
  background-color: var(--k-color-primary-bg);
}
.k-table.is-striped .k-table__row:nth-child(odd) > .k-table__cell {
  background-color: var(--k-table-stripe-bg);
}
.k-table.is-striped .k-table__row:nth-child(odd):hover > .k-table__cell {
  background-color: var(--k-table-hover-bg);
}
.k-table.is-striped .k-table__row:nth-child(2n) {
  background: transparent;
}
.k-table.is-bordered .k-table__wrap {
  border: var(--k-line-width) solid var(--k-table-border);
}
.k-table.is-column-borders .k-table__cell + .k-table__cell {
  border-inline-start: var(--k-line-width) solid var(--k-table-border);
}
/* 右浮层首列要补与主表一致的分隔线；左浮层由相邻选择/展开列自然产生 */
.k-table.is-column-borders .k-table__fixed-layer.is-right .k-table__cell:first-child {
  border-inline-start: var(--k-line-width) solid var(--k-table-border);
}
.k-table.is-sticky .k-table__cell--head {
  position: sticky;
  top: 0;
  z-index: 4;
}
.k-table .k-table__cell.is-fixed {
  position: sticky;
  z-index: 1;
}
.k-table .k-table__cell--head.is-fixed {
  z-index: 5;
}
/* 阴影只在离开原位时出现：滚到最左/最右即消失 */
.k-table.has-scroll-left .k-table__cell.is-fixed-edge.is-fixed-left {
  box-shadow: 6px 0 8px -6px rgb(0 0 0 / 18%);
}
.k-table.has-scroll-right .k-table__cell.is-fixed-edge.is-fixed-right {
  box-shadow: -6px 0 8px -6px rgb(0 0 0 / 18%);
}
.k-table .k-table__row.is-pinned-top > .k-table__cell,
.k-table .k-table__row.is-pinned-bottom > .k-table__cell {
  position: sticky;
  z-index: 2;
}
.k-table .k-table__row.is-pinned-top > .k-table__cell.is-fixed,
.k-table .k-table__row.is-pinned-bottom > .k-table__cell.is-fixed {
  z-index: 3;
}
/* 浮层模式下主表占位单元格不参与粘性（含吸顶表头与固定行） */
.k-table .k-table__cell.is-overlay-placeholder,
.k-table .k-table__row.is-pinned-top > .k-table__cell.is-overlay-placeholder,
.k-table .k-table__row.is-pinned-bottom > .k-table__cell.is-overlay-placeholder,
.k-table.is-sticky .k-table__cell--head.is-overlay-placeholder {
  position: static;
  z-index: auto;
}
.k-table.has-scroll-top .k-table__row.is-pinned-top > .k-table__cell {
  box-shadow: 0 6px 8px -6px rgb(0 0 0 / 18%);
}
.k-table.has-scroll-bottom .k-table__row.is-pinned-bottom > .k-table__cell {
  box-shadow: 0 -6px 8px -6px rgb(0 0 0 / 18%);
}
.k-table .k-table__cell--expand {
  width: 44px;
  padding-inline: var(--k-size-xs);
  text-align: center;
}
.k-table__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: 14px;
  cursor: pointer;
  transition: transform var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-table__expand:hover {
  color: var(--k-color-primary);
}
.k-table__expand:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 1px;
}
.k-table__expand.is-expanded {
  transform: rotate(90deg);
}
.k-table .k-table__expanded-row > .k-table__cell {
  background-color: var(--k-color-fill-quaternary);
  padding: var(--k-size) var(--k-table-cell-padding-x);
}
.k-table__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.k-table .k-table__cell--selection {
  width: 44px;
  padding-inline: var(--k-size-xs);
  text-align: center;
}
.k-table .k-table__cell--selection.is-fixed {
  left: 0;
}
.k-table .k-table__empty {
  padding: 0;
}
.k-table .k-table__empty-row:hover > .k-table__cell {
  background-color: var(--k-color-bg-container);
}
.k-table .k-table__summary {
  background-color: var(--k-table-head-bg);
  font-weight: var(--k-font-weight-strong);
}
.k-table__loading {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--k-color-bg-container) 70%, transparent);
}
.k-table__pagination {
  --k-table-pagination-gap: var(--k-size);

  display: flex;
  justify-content: flex-end;
  margin: 0;
  padding-top: var(--k-table-pagination-gap);
}
.k-table__pagination.is-left {
  justify-content: flex-start;
}
.k-table__pagination.is-center {
  justify-content: center;
}
.k-table__pagination.is-top {
  padding-top: 0;
  padding-bottom: var(--k-table-pagination-gap);
}
.k-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-size-xs);
  padding-bottom: var(--k-size-sm);
}
.k-table__toolbar-start,
.k-table__toolbar-end {
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  min-width: 0;
}
.k-table__toolbar-start {
  flex: 1;
}
.k-table__column-setting {
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xs);
  min-width: 180px;
  max-height: 280px;
  overflow-y: auto;
}
.k-table__column-setting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-size);
  padding-bottom: var(--k-size-xs);
  border-bottom: var(--k-line-width) solid var(--k-color-border);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
}
.k-table__column-setting-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.k-table__link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--k-color-primary);
  font: inherit;
  font-size: var(--k-font-size-sm);
  cursor: pointer;
}
.k-table .k-table__cell.is-ellipsis {
  overflow: hidden;
}
/* KTooltip 的触发节点是 inline span，块级省略文本在里面会按 max-content 撑开，需改成块级并受单元格宽度约束 */
.k-table .k-table__cell .k-tooltip__trigger {
  display: block;
  min-width: 0;
  max-width: 100%;
}
.k-table--sm {
  --k-table-cell-padding-y: 8px;
  --k-table-cell-padding-x: var(--k-size-sm);
  font-size: var(--k-font-size-sm);
}
.k-table--lg {
  --k-table-cell-padding-y: 16px;
  --k-table-cell-padding-x: var(--k-size-md);
}
</style>