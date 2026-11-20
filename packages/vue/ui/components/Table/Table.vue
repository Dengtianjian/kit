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
        'is-stacked': stackActive,
        'has-editable': hasEditableColumns,
        'has-bottom-scrollbar': bottomBar.visible,
        'is-header-bottom': headerAtBottom,
        'is-page-sticky': pageStickyActive && !headerAtBottom,
        'is-page-sticky-bottom': pageStickyActive && headerAtBottom,
      },
      classNames?.root,
    ]"
    :style="[rootStyle, styles?.root]"
  >
    <div v-if="$slots.header" class="k-table__header" :class="classNames?.header" :style="styles?.header">
      <slot name="header" :columns="visibleColumns" :rows="processedRows" />
    </div>
    <div
      v-if="toolbarVisible"
      class="k-table__toolbar"
      :class="classNames?.toolbar"
      :style="styles?.toolbar"
    >
      <div class="k-table__toolbar-start">
        <input
          v-if="searchable"
          class="k-table__search"
          type="search"
          :value="globalFilter"
          :placeholder="searchPlaceholder"
          aria-label="搜索表格"
          @input="onSearchInput"
        />
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
        :size="paginationSize"
        :page-size-options="paginationConfig.pageSizeOptions"
        :show-size-changer="paginationConfig.showSizeChanger"
        :show-quick-jumper="paginationConfig.showQuickJumper"
        :show-total="paginationConfig.showTotal"
        :hide-on-single-page="paginationConfig.hideOnSinglePage"
        @change="onPageChange"
      />
    </div>
    <div class="k-table__scroll">
    <div ref="wrapEl" class="k-table__wrap" :class="classNames?.wrap" :style="[wrapStyle, styles?.wrap]" @scroll.passive="onWrapScroll">
      <div v-if="!stackActive" class="k-table__canvas" :style="canvasStyle">
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
                :class="[
                  cell.column.classNames?.header,
                  headerFixedClass(cell),
                  {
                    'is-draggable': columnDraggable && !cell.isGroup,
                    'is-resizable': columnResizable && !cell.isGroup,
                  },
                ]"
                :style="[headerCellStyle(cell, rowIndex), cell.column.styles?.header]"
                :aria-sort="cell.isGroup ? undefined : ariaSort(cell.leafKey)"
                :data-column-key="cell.isGroup ? undefined : cell.leafKey"
                :data-group-leaves="cell.isGroup ? leafKeysUnder(cell.column).join(' ') : undefined"
                :title="columnDraggable && !cell.isGroup ? '拖动调整列顺序' : undefined"
                @pointerdown="onHeaderPointerDown(cell, $event)"
                @dblclick="onHeaderDblClick($event)"
              >
                <KHeadCell
                  :cell="cell"
                  :show-grip="columnDraggable && !cell.isGroup"
                  :filter-placement="headerAtBottom ? 'topLeft' : 'bottomLeft'"
                />
                <span
                  v-if="columnResizable && !cell.isGroup"
                  class="k-table__resize"
                  aria-hidden="true"
                  @pointerdown.stop.prevent="onResizeStart(cell.leafKey || '', $event)"
                  @dblclick.stop.prevent="reflowColumnWidths"
                ></span>
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
          <tr v-if="item.expanded" class="k-table__expanded-row" :data-expanded-key="item.key">
            <td :colspan="columnSpan" class="k-table__cell k-table__expanded-cell">
              <KExpandedContent :content="expandedContent(item.expanded.row, item.expanded.index)" />
            </td>
          </tr>
          <template v-for="entry in (item.entry ? [item.entry] : [])" :key="`row-${item.key}`">
          <tr
            class="k-table__row"
            :class="[
              {
                'is-selected': isSelected(entry.row),
                'is-pinned-top': entry.pinned === 'top',
                'is-pinned-bottom': entry.pinned === 'bottom',
                'is-row-draggable': rowDraggable && !entry.pinned,
              },
              classNames?.row,
            ]"
            :data-row-key="rowKeyOf(entry.row)"
            :style="styles?.row"
            @click="onRowClick(entry.row, entry.index, $event)"
            @pointerdown="onRowPointerDown(entry, $event)"
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
            <template v-for="leaf in leaves" :key="leaf.key">
              <td
                v-if="!isSpanCovered(entry.row, leaf.key)"
                class="k-table__cell"
                :class="[
                  leaf.column.classNames?.cell,
                  isOverlayColumn(leaf.column) ? 'is-overlay-placeholder' : fixedClass(leaf.column, leaf.key),
                  {
                    'is-align-center': leaf.column.align === 'center',
                    'is-align-right': leaf.column.align === 'right',
                    'is-ellipsis': leaf.column.ellipsis,
                    'is-span-edge': isSpanEdge(entry.row, leaf.key),
                  },
                ]"
                :style="[
                  isOverlayColumn(leaf.column) ? null : cellStyle(leaf.column, leaf.key),
                  isOverlayColumn(leaf.column) ? null : pinnedCellStyle(entry),
                  leaf.column.styles?.cell,
                ]"
                :aria-hidden="isOverlayColumn(leaf.column) ? 'true' : undefined"
                :rowspan="spanRowSpan(entry.row, leaf.key)"
                :colspan="spanColSpan(entry.row, leaf.key)"
                @click="maybeBeginCellEdit(entry, leaf, $event)"
                @dblclick="maybeBeginCellEditDouble(entry, leaf, $event)"
              >
                <KBodyCellInner
                  v-if="!isOverlayColumn(leaf.column)"
                  :column="leaf.column"
                  :row="entry.row"
                  :index="entry.index"
                  :editing="isCellEditing(entry.row, leaf.key)"
                  :on-commit="value => commitCellEdit(entry.row, leaf.column, entry.index, value)"
                  :on-cancel="cancelCellEdit"
                  :row-drag-handle="rowDraggable && rowDragMode === 'handle' && leaf.key === firstLeafKey"
                  :on-row-drag-start="event => onRowPointerDown(entry, event)"
                  v-bind="treeCellProps(entry, leaf)"
                />
              </td>
            </template>
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
      <template v-if="overlayEnabled">
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
                  { 'is-draggable': columnDraggable && !cell.isGroup },
                ]"
                :style="[overlayHeaderStyle(cell, rowIndex), cell.column.styles?.header]"
                :aria-sort="cell.isGroup ? undefined : ariaSort(cell.leafKey)"
                :data-column-key="cell.isGroup ? undefined : cell.leafKey"
                :data-group-leaves="cell.isGroup ? leafKeysUnder(cell.column).join(' ') : undefined"
                :title="columnDraggable && !cell.isGroup ? '拖动调整列顺序' : undefined"
                @pointerdown="onHeaderPointerDown(cell, $event)"
              >
                <KHeadCell
                  :cell="cell"
                  :show-grip="columnDraggable && !cell.isGroup"
                  :filter-placement="headerAtBottom ? 'topLeft' : 'bottomLeft'"
                />
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
                <tr v-if="item.expanded" class="k-table__expanded-row is-overlay-spacer">
                  <td :colspan="fixedColCount(side)" class="k-table__cell"></td>
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
                  <template v-for="leaf in fixedLeavesOf(side)" :key="leaf.key">
                    <td
                      v-if="!isSpanCovered(entry.row, leaf.key)"
                      class="k-table__cell"
                      :class="[
                        leaf.column.classNames?.cell,
                        side === 'left' ? 'is-fixed-left' : 'is-fixed-right',
                        {
                          'is-align-center': leaf.column.align === 'center',
                          'is-align-right': leaf.column.align === 'right',
                          'is-ellipsis': leaf.column.ellipsis,
                          'is-span-edge': isSpanEdge(entry.row, leaf.key),
                        },
                      ]"
                      :style="[pinnedCellStyle(entry), leaf.column.styles?.cell]"
                      :rowspan="spanRowSpan(entry.row, leaf.key)"
                      :colspan="spanColSpan(entry.row, leaf.key)"
                      @click="maybeBeginCellEdit(entry, leaf, $event)"
                      @dblclick="maybeBeginCellEditDouble(entry, leaf, $event)"
                    >
                      <KBodyCellInner
                        :column="leaf.column"
                        :row="entry.row"
                        :index="entry.index"
                        :editing="isCellEditing(entry.row, leaf.key)"
                        :on-commit="value => commitCellEdit(entry.row, leaf.column, entry.index, value)"
                        :on-cancel="cancelCellEdit"
                        :row-drag-handle="rowDraggable && rowDragMode === 'handle' && leaf.key === firstLeafKey"
                        :on-row-drag-start="event => onRowPointerDown(entry, event)"
                        v-bind="treeCellProps(entry, leaf)"
                      />
                    </td>
                  </template>
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
      </template>
      </div>
      <div
        v-if="stackActive"
        class="k-table__cards"
        :class="classNames?.stack"
        :style="styles?.stack"
        role="list"
      >
        <div v-if="!cardItems.length" class="k-table__cards-empty">
          <slot name="empty" :columns="visibleColumns">
            <KEmpty :description="emptyText" :size="size === 'sm' ? 'sm' : 'md'" />
          </slot>
        </div>
        <template v-else>
          <template v-for="item in cardItems" :key="item.key">
            <div
              v-if="item.entry"
              class="k-table__card"
              :class="{ 'is-selected': isSelected(item.entry.row) }"
              :style="cardIndentStyle(item.entry)"
              :data-row-key="rowKeyOf(item.entry.row)"
              role="listitem"
              @click="onRowClick(item.entry.row, item.entry.index, $event)"
              @mouseenter="scheduleHover(rowKeyOf(item.entry.row))"
              @mouseleave="scheduleHover(null)"
            >
              <div v-if="cardHasControls(item.entry) || !$slots.card" class="k-table__card-head">
                <span v-if="selectionEnabled" class="k-table__card-select" @click.stop>
                  <KCheckbox
                    v-if="selectionType === 'checkbox'"
                    :model-value="isSelected(item.entry.row)"
                    :disabled="checkboxDisabled(item.entry.row)"
                    :aria-label="`选择第 ${item.entry.index + 1} 行`"
                    @update:model-value="checked => toggleRow(item.entry.row, checked)"
                  />
                  <KRadio
                    v-else
                    :name="selectionName"
                    :value="rowKeyOf(item.entry.row)"
                    :model-value="selectedKeys[0]"
                    :disabled="checkboxDisabled(item.entry.row)"
                    :aria-label="`选择第 ${item.entry.index + 1} 行`"
                    @update:model-value="selectSingleRow(item.entry.row)"
                  />
                </span>
                <button
                  v-if="expandableEnabled && !item.entry.pinned && canExpand(item.entry.row)"
                  type="button"
                  class="k-table__expand"
                  :class="{ 'is-expanded': isExpanded(item.entry.row) }"
                  :aria-expanded="isExpanded(item.entry.row)"
                  :aria-label="isExpanded(item.entry.row) ? '收起' : '展开'"
                  @click.stop="toggleExpand(item.entry.row)"
                >
                  <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </button>
                <button
                  v-if="$slots.card && treeEnabled && (item.entry.hasChildren || (detailEnabled && canExpand(item.entry.row)))"
                  type="button"
                  class="k-table__tree-caret"
                  :class="{ 'is-expanded': isTreeExpanded(item.entry.row) }"
                  :aria-expanded="isTreeExpanded(item.entry.row)"
                  aria-label="展开子行"
                  @click.stop="toggleExpand(item.entry.row)"
                >
                  <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </button>
                <div v-if="!$slots.card" class="k-table__card-heading">
                  <div class="k-table__card-title">
                    <span
                      v-for="leaf in cardTitleLeaves"
                      :key="leaf.key"
                      class="k-table__card-title-cell"
                      :class="leaf.column.classNames?.cell"
                    >
                      <KBodyCellInner
                        :column="leaf.column"
                        :row="item.entry.row"
                        :index="item.entry.index"
                        v-bind="cardTreeCellProps(item.entry, leaf)"
                      />
                    </span>
                  </div>
                  <div v-if="cardSubtitleLeaves.length" class="k-table__card-subtitle">
                    <span
                      v-for="leaf in cardSubtitleLeaves"
                      :key="leaf.key"
                      :class="leaf.column.classNames?.cell"
                    >
                      <KBodyCellInner :column="leaf.column" :row="item.entry.row" :index="item.entry.index" />
                    </span>
                  </div>
                </div>
              </div>
              <template v-if="$slots.card">
                <slot
                  name="card"
                  :row="item.entry.row"
                  :index="item.entry.index"
                  :entry="item.entry"
                  :columns="visibleColumns"
                />
                <div v-if="cardExpanded(item.entry)" class="k-table__card-expanded">
                  <KExpandedContent :content="expandedContent(item.entry.row, item.entry.index)" />
                </div>
              </template>
              <template v-else>
                <div v-if="cardFieldLeaves.length" class="k-table__card-body">
                  <div
                    v-for="leaf in cardFieldLeaves"
                    :key="leaf.key"
                    class="k-table__card-field"
                    @click="maybeBeginCellEdit(item.entry, leaf, $event)"
                    @dblclick="maybeBeginCellEditDouble(item.entry, leaf, $event)"
                  >
                    <span class="k-table__card-label">{{ cardLabelOf(leaf) }}</span>
                    <span class="k-table__card-value" :class="leaf.column.classNames?.cell">
                      <KBodyCellInner
                        :column="leaf.column"
                        :row="item.entry.row"
                        :index="item.entry.index"
                        :editing="isCellEditing(item.entry.row, leaf.key)"
                        :on-commit="value => commitCellEdit(item.entry.row, leaf.column, item.entry.index, value)"
                        :on-cancel="cancelCellEdit"
                      />
                    </span>
                  </div>
                </div>
                <div v-if="cardExpanded(item.entry)" class="k-table__card-expanded">
                  <KExpandedContent :content="expandedContent(item.entry.row, item.entry.index)" />
                </div>
                <div v-if="cardActionLeaves.length" class="k-table__card-actions" @click.stop>
                  <KBodyCellInner
                    v-for="leaf in cardActionLeaves"
                    :key="leaf.key"
                    :column="leaf.column"
                    :row="item.entry.row"
                    :index="item.entry.index"
                  />
                </div>
              </template>
            </div>
          </template>
        </template>
      </div>
      <div v-if="loading" class="k-table__loading" :class="classNames?.loading" :style="styles?.loading" role="status" aria-label="加载中">
        <KSpin />
      </div>
    </div>
    <div
      v-if="loadingMore"
      class="k-table__load-more"
      :class="classNames?.loadMore"
      :style="styles?.loadMore"
      role="status"
      aria-label="加载更多"
    >
      <span class="k-table__load-more-pill"><KSpin size="sm" /></span>
    </div>
    </div>
    <div v-if="bottomScrollbar && bottomBar.visible && !stackActive && scroll?.y == null" class="k-table__bottom-scrollbar-slot">
      <div
        class="k-table__bottom-scrollbar"
        :class="[{ 'is-fixed': bottomFixed }, classNames?.scrollbar]"
        :style="[bottomBarStyle, styles?.scrollbar]"
        aria-hidden="true"
      >
        <div class="k-table__bottom-track" @pointerdown="onBottomTrackDown">
          <div
            class="k-table__bottom-thumb"
            :style="{ width: `${bottomBar.thumb}px`, transform: `translateX(${bottomBar.offset}px)` }"
            @pointerdown.stop="onBottomThumbDown"
          ></div>
        </div>
      </div>
    </div>
    <div v-if="$slots.footer" class="k-table__footer" :class="classNames?.footer" :style="styles?.footer">
      <slot name="footer" :columns="visibleColumns" :rows="processedRows" />
    </div>
    <div v-if="showBottomPagination" class="k-table__pagination" :class="[classNames?.pagination, `is-${paginationPlacement.align}`]" :style="styles?.pagination">
      <KPagination
        v-model:current="current"
        v-model:page-size="perPage"
        :total="paginationTotal"
        :size="paginationSize"
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
import type { Component, ComponentPublicInstance, CSSProperties, PropType, VNodeChild } from 'vue';
import KCheckbox from '../Checkbox/Checkbox.vue';
import KRadio from '../Radio/Radio.vue';
import KPopover from '../Popover/Popover.vue';
import KDropdown from '../Dropdown/Dropdown.vue';
import {
  IconCopy,
  IconDots,
  IconDotsVertical,
  IconEye,
  IconPencil,
  IconTrash,
} from '@tabler/icons-vue';
/* 菜单图标统一按 1em 输出，尺寸由所在元素的 font-size 决定 */
function tableActionIcon(icon: Component): Component {
  return defineComponent({
    name: 'KTableActionIcon',
    setup: () => () => h(icon, { size: '1em' }),
  });
}
const ACTION_ICONS: Record<string, Component> = {
  view: tableActionIcon(IconEye),
  edit: tableActionIcon(IconPencil),
  copy: tableActionIcon(IconCopy),
  remove: tableActionIcon(IconTrash),
  more: tableActionIcon(IconDots),
};
import KButton from '../Button/Button.vue';
import KSpin from '../Spin/Spin.vue';
import KInput from '../Input/Input.vue';
import KEmpty from '../Empty/Empty.vue';
import KPagination from '../Pagination/Pagination.vue';
import KOverflowTooltip from './OverflowTooltip.vue';
import { useTableColumns } from '../../composables/table/useTableColumns';
import { useBreakpoint } from '../../composables/useBreakpoint';
import type { KBreakpoint } from '../../composables/useBreakpoint';
import {
  applyColumnOrder,
  buildSpanPlan,
  buildTreeNodes,
  collectTreeExpandableKeys,
  columnKeyOf,
  createRowComparator,
  distributeIntegerWidths,
  filterRows,
  filterTreeNodes,
  flattenTreeNodes,
  getCellValue,
  getRowKey,
  paginateRows,
  sortRows,
  sortTreeNodes,
  spanCellKey,
  splitStackColumns,
  widthStyle,
} from '../../utils/table';
import {
  buildVirtualOffsets,
  expandRangeForSpans,
  findRowAtOffset,
  getVariableVirtualRange,
} from '../../utils/virtual';
import type {
  KTableColumn,
  KTableFilterState,
  KTableHeaderCell,
  KTableLeaf,
  KTableRowKey,
  KTableSortState,
  KTableSpanCell,
  KTableSpanMethod,
  KTableSpanPlan,
  KTableTreeNode,
  KTableTreeOptions,
  KTableCellEditContext,
  KTableRowAction,
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
  KTableCellSpan,
  KTableSpanContext,
  KTableSpanMethod,
  KTableTreeOptions,
  KTableCellEditContext,
  KTableRowAction,
} from '../../utils/table';

export type KTableExpandedPlacement = 'inline' | 'bottom';
export type KTableEditTrigger = 'click' | 'dblclick' | 'manual';

export interface KTableCellEditEvent<T = unknown> {
  row: T;
  column: KTableColumn<T>;
  value: unknown;
  previousValue: unknown;
  /** dataSource 下标 */
  rowIndex: number;
}

export interface KTableExpandedRenderContext<T = unknown> {
  row: T;
  /** dataSource 下标 */
  index: number;
  rowKey: KTableRowKey;
}

export interface KTablePaginationConfig {
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean | ((total: number, range: [number, number]) => string);
  hideOnSinglePage?: boolean;
  /** 分页器尺寸；缺省跟随表格 size：sm→sm、md→md、lg→lg */
  size?: 'sm' | 'md' | 'lg';
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
  | 'header'
  | 'toolbar'
  | 'columnSetting'
  | 'wrap'
  | 'fixedLayer'
  | 'row'
  | 'filterPanel'
  | 'loading'
  | 'stack'
  | 'scrollbar'
  | 'loadMore'
  | 'footer'
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
  /** 大数据量虚拟滚动：支持变量行高、单元格合并与展开行 */
  virtual?: boolean;
  /** 虚拟滚动启用阈值（行数），默认 40 */
  virtualThreshold?: number;
  /** 窗口上下预渲染行数，默认 6 */
  virtualOverscan?: number;
  /** 滚出窗口多少行后才重算窗口，默认 3 */
  virtualBuffer?: number;
  /** 未测量行的估算行高（px）；实测后按真实高度计算 */
  virtualRowHeight?: number;
  /** 树形数据：按子节点字段展开，展开状态与行详情共用 expandedRowKeys */
  tree?: boolean | KTableTreeOptions<T>;
  /** 单元格合并：返回 rowSpan / colSpan；rowSpan 参与虚拟窗口扩张 */
  spanMethod?: KTableSpanMethod<T>;
  /** 受控排序；不传走内部状态 */
  sortState?: KTableSortState | null;
  /** 受控筛选；不传走内部状态 */
  filters?: KTableFilterState;
  /** 内置「列设置」按钮 */
  columnSetting?: boolean;
  /** 列顺序（叶子 key 数组）；不传走内部状态 */
  columnOrder?: string[];
  /** 跨分组换位：叶子 key → 目标分组 key 路径；不传走内部状态 */
  columnGroups?: Record<string, string[]>;
  /** 列宽覆盖（叶子 key → px）；不传走内部状态 */
  columnWidths?: Record<string, number>;
  /** 拖动表头调整列顺序（同分组内换位，可拖入其它分组） */
  columnDraggable?: boolean;
  /** 拖动表头右边缘调整列宽 */
  columnResizable?: boolean;
  /** 工具条显示全局搜索框 */
  searchable?: boolean;
  /** 全局搜索占位文案 */
  searchPlaceholder?: string;
  /** 全局搜索关键字；不传走内部状态 */
  globalFilter?: string;
  /** 自定义全局搜索匹配；默认匹配可见叶子列的文本 */
  globalFilterMethod?: (row: T, keyword: string) => boolean;
  /** 行展开：配合 #expanded 插槽；false 可强制关闭 */
  expandable?: boolean;
  /** 默认展开全部可展开行 */
  defaultExpandAll?: boolean;
  /** 指定行是否可展开 */
  rowExpandable?: (row: T) => boolean;
  /** 展开内容位置：inline 紧随该行（默认）；bottom 追加到合并组末尾整行 */
  expandedPlacement?: KTableExpandedPlacement;
  /** 展开内容渲染函数；某行返回 undefined 时回退 #expanded 插槽（null 视为空内容） */
  expandedRender?: (context: KTableExpandedRenderContext<T>) => VNodeChild;
  /** 进入单元格编辑的方式：单击 / 双击 / 只能通过 v-model:editingCell 手动进入 */
  editTrigger?: KTableEditTrigger;
  /** 按住行拖动排序：发 rowReorder，不直接改 dataSource */
  rowDraggable?: boolean;
  /** 列拖拽触发方式：handle 仅抓手 / press 表头任意处 */
  columnDragMode?: 'handle' | 'press';
  /** 行拖拽触发方式：handle 仅行抓手 / press 按住行任意处 */
  rowDragMode?: 'handle' | 'press';
  /** 强制卡片模式（窄屏卡片堆叠），优先级高于断点 */
  stacked?: boolean;
  /** 视口低于该断点时自动切卡片：档位或像素 */
  stackBreakpoint?: KBreakpoint | number;
  /** 表格下方常驻横向滚动条：与表体双向同步，页面滚动时吸在视口底部 */
  bottomScrollbar?: boolean;
  /** 表头位置：top 常规 / bottom 沉到数据行下方（sticky 时吸在底部） */
  headerPosition?: 'top' | 'bottom';
  /** 页面滚动时表头吸顶；表头在底部时吸在视口底部（未设 scroll.y / scroll.x 时生效） */
  pageSticky?: boolean;
  /** 页面吸顶偏移：数字按 px，字符串原样，默认 0（可避开站点顶栏） */
  pageStickyOffset?: number | string;
  /** 距底部多少 px 触发 reachEnd，默认 40 */
  reachEndThreshold?: number;
  /** 业务正在加载更多：期间不再触发 reachEnd，并在表格内部底边上方悬浮加载指示 */
  loadingMore?: boolean;
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
  columnOrder: undefined,
  columnGroups: undefined,
  columnWidths: undefined,
  columnDraggable: false,
  columnResizable: false,
  searchable: false,
  searchPlaceholder: '搜索',
  globalFilter: undefined,
  globalFilterMethod: undefined,
  editTrigger: 'click',
  rowDraggable: false,
  columnDragMode: 'handle',
  rowDragMode: 'handle',
  stacked: false,
  stackBreakpoint: undefined,
  bottomScrollbar: false,
  headerPosition: 'top',
  pageSticky: false,
  pageStickyOffset: 0,
  reachEndThreshold: 40,
  loadingMore: false,
  expandable: true,
  defaultExpandAll: false,
  rowExpandable: undefined,
  expandedPlacement: 'inline',
  expandedRender: undefined,
  virtual: false,
  virtualThreshold: 40,
  virtualOverscan: 6,
  virtualBuffer: 3,
  virtualRowHeight: undefined,
  tree: false,
  spanMethod: undefined,
});

const emit = defineEmits<{
  sortChange: [sorter: KTableSortState | null];
  filterChange: [filters: KTableFilterState];
  selectionChange: [keys: KTableRowKey[], rows: T[]];
  rowClick: [row: T, index: number, event: MouseEvent];
  pageChange: [page: number, pageSize: number];
  expandChange: [keys: KTableRowKey[], row: T, expanded: boolean];
  cellEdit: [payload: KTableCellEditEvent<T>];
  rowReorder: [payload: { row: T; from: number; to: number }];
  reachEnd: [distance: number];
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
const columnOrder = defineModel<string[]>('columnOrder', { default: () => [] });
const columnGroups = defineModel<Record<string, string[]>>('columnGroups', { default: () => ({}) });
const columnWidths = defineModel<Record<string, number>>('columnWidths', { default: () => ({}) });
const globalFilter = defineModel<string>('globalFilter', { default: '' });
const editingCell = defineModel<{ rowKey: KTableRowKey; columnKey: string } | null>(
  'editingCell',
  { default: null },
);
const rootAttrs = { 'data-part': 'root' };
const filterOpen = reactive<Record<string, boolean>>({});
const slots = useSlots();

/** 展开内容：expandedRender 逐行优先，返回 undefined 的行回退 #expanded 插槽（null 视为空内容） */
function expandedContent(row: T, index: number): VNodeChild {
  const rowKey = rowKeyOf(row);
  if (props.expandedRender) {
    const content = props.expandedRender({ row, index, rowKey });
    if (content !== undefined) return content;
  }
  if (slots.expanded) return slots.expanded({ row, index, rowKey });
  return null;
}

const orderedColumns = computed(() =>
  applyColumnOrder(props.columns, columnOrder.value, columnGroups.value),
);
const widthOverrides = computed(() => columnWidths.value ?? {});
const {
  allLeaves,
  leaves,
  headerRows,
  headerDepth,
  keyOfColumn,
  leafByKey,
  leafIndexByKey,
  settings: columnSettings,
  visibleCount: visibleColumnCount,
} = useTableColumns<T>(() => orderedColumns.value, () => columnVisibility.value);

/* ---------- 响应式卡片：断点自动切换，stacked 可强制 ---------- */
const stackBreakpointState = useBreakpoint();
const STACK_BREAKPOINT_ORDER: KBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
const stackBelowPixels = ref(false);
let stackMedia: MediaQueryList | null = null;
function syncStackMedia() {
  if (stackMedia) stackBelowPixels.value = stackMedia.matches;
}
watch(
  () => props.stackBreakpoint,
  value => {
    stackMedia?.removeEventListener('change', syncStackMedia);
    stackMedia = null;
    stackBelowPixels.value = false;
    if (
      typeof value !== 'number' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    stackMedia = window.matchMedia(`(max-width: ${Math.max(0, value - 0.02)}px)`);
    stackBelowPixels.value = stackMedia.matches;
    stackMedia.addEventListener('change', syncStackMedia);
  },
  { immediate: true },
);
onScopeDispose(() => stackMedia?.removeEventListener('change', syncStackMedia));
const stackActive = computed(() => {
  if (props.stacked) return true;
  const target = props.stackBreakpoint;
  if (target == null) return false;
  if (typeof target === 'number') return stackBelowPixels.value;
  return (
    STACK_BREAKPOINT_ORDER.indexOf(stackBreakpointState.current.value) <
    STACK_BREAKPOINT_ORDER.indexOf(target)
  );
});
let stackCompatWarned = false;
watch(
  () =>
    stackActive.value &&
    (Boolean(props.spanMethod) ||
      props.virtual ||
      props.rowDraggable ||
      props.columnDraggable ||
      props.columnResizable),
  hit => {
    if (!hit || stackCompatWarned) return;
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    stackCompatWarned = true;
    console.warn(
      '[KTable] 卡片模式不渲染表格：单元格合并、虚拟滚动、列/行拖拽与列宽调整在卡片下已忽略。',
    );
  },
  { immediate: true },
);

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
const paginationSize = computed<'sm' | 'md' | 'lg'>(
  () => paginationConfig.value.size ?? props.size,
);
const selectionEnabled = computed(() => Boolean(props.rowSelection));
const selectionType = computed(() => props.rowSelection?.type ?? 'checkbox');
const selectionName = `k-table-selection-${useId()}`;
const detailEnabled = computed(
  () => props.expandable !== false && Boolean(slots.expanded || props.expandedRender),
);
const treeConfig = computed<KTableTreeOptions<T> | null>(() => {
  if (!props.tree) return null;
  return props.tree === true ? {} : props.tree;
});
const treeEnabled = computed(() => treeConfig.value != null);
const treeChildrenKey = computed(() => treeConfig.value?.childrenKey ?? 'children');
const treeIndent = computed(() => treeConfig.value?.indent ?? 16);
/** 树形模式下展开箭头放进首列，不再单独占 44px 展开列 */
const expandableEnabled = computed(() => detailEnabled.value && !treeEnabled.value);
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
/** 有可编辑列时表体行统一预留编辑控件高度，避免进入编辑撑高行 */
const hasEditableColumns = computed(() =>
  leaves.value.some(leaf => leaf.column.editable),
);
const toolbarVisible = computed(
  () => props.columnSetting || props.searchable || Boolean(slots.filter || slots.toolbar),
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

/** 行 key 的 index 语义统一为 dataSource 下标（树形按先序计数，固定行/筛选/分页下保持稳定） */
const sourceIndex = computed(() => {
  const map = new Map<T, number>();
  let next = 0;
  const visit = (row: T) => {
    map.set(row, next++);
    if (!treeEnabled.value) return;
    const children = (row as Record<string, unknown>)[treeChildrenKey.value];
    if (Array.isArray(children)) (children as T[]).forEach(visit);
  };
  props.dataSource.forEach(visit);
  return map;
});

/** 筛选/排序作用于全量叶子列：隐藏列不丢排序与筛选状态 */
const dataColumns = computed(() => allLeaves.value.map(leaf => leaf.column));

const keyword = computed(() => (globalFilter.value ?? '').trim());
const globalActive = computed(() => keyword.value.length > 0);
/** 全局搜索：默认拼接可见叶子列的文本做包含匹配，树形下与列筛选一起决定命中行 */
function rowMatchesKeyword(row: T) {
  if (!globalActive.value) return true;
  if (props.globalFilterMethod) return props.globalFilterMethod(row, keyword.value);
  const text = keyword.value.toLowerCase();
  return dataColumns.value.some(column => {
    const value = getCellValue(row, column.dataIndex);
    return value != null && String(value).toLowerCase().includes(text);
  });
}

const treeNodes = computed<KTableTreeNode<T>[] | null>(() => {
  if (!treeEnabled.value) return null;
  return buildTreeNodes(props.dataSource, treeChildrenKey.value, row => rowKeyOf(row));
});
/** 树内筛选：保留命中行与祖先，并记录要强制展开的祖先 */
const treeFiltered = computed(() => {
  const nodes = treeNodes.value;
  if (!nodes) return null;
  const columns = dataColumns.value;
  const hasFilters =
    globalActive.value ||
    Object.entries(activeFilters.value).some(
      ([key, values]) =>
        values.length > 0 &&
        columns.some((column, index) => columnKeyOf(column, index) === key && column.filters?.length),
    );
  if (!hasFilters) return { nodes, forcedExpanded: new Set<KTableRowKey>() };
  const allRows: T[] = [];
  const collect = (list: KTableTreeNode<T>[]) => {
    list.forEach(node => {
      allRows.push(node.row);
      collect(node.children);
    });
  };
  collect(nodes);
  const matched = new Set(
    filterRows(allRows, columns, activeFilters.value).filter(rowMatchesKeyword),
  );
  return filterTreeNodes(nodes, row => matched.has(row));
});
const treeSorted = computed(() => {
  const filtered = treeFiltered.value;
  if (!filtered) return null;
  const compare = createRowComparator(dataColumns.value, sort.value);
  return compare ? sortTreeNodes(filtered.nodes, compare) : filtered.nodes;
});
/** 固定行只支持顶层节点：固定后从树里摘出，不参与子级展开 */
const treeVisible = computed(() => {
  const sorted = treeSorted.value;
  if (!sorted) return null;
  return sorted.filter(
    node => !pinnedTopKeys.value.has(node.key) && !pinnedBottomKeys.value.has(node.key),
  );
});
const treeFlat = computed(() => {
  const nodes = treeVisible.value;
  if (!nodes) return null;
  const forced = treeFiltered.value?.forcedExpanded;
  return flattenTreeNodes(
    nodes,
    key => expandedSet.value.has(key) || Boolean(forced?.has(key)),
  );
});
const treeMetaByKey = computed(() => {
  const map = new Map<KTableRowKey, { depth: number; hasChildren: boolean }>();
  treeFlat.value?.forEach(item => {
    map.set(item.key, { depth: item.depth, hasChildren: item.hasChildren });
  });
  return map;
});
/** 筛选命中的祖先在展开态上也要显示为展开 */
function isTreeExpanded(row: T) {
  const key = rowKeyOf(row);
  return expandedSet.value.has(key) || Boolean(treeFiltered.value?.forcedExpanded.has(key));
}

const processedRows = computed(() => {
  if (treeFlat.value) return treeFlat.value.map(item => item.row);
  return sortRows(
    filterRows(props.dataSource, dataColumns.value, activeFilters.value).filter(rowMatchesKeyword),
    dataColumns.value,
    sort.value,
  );
});
/** 固定行不受筛选/排序/分页影响，始终按 dataSource 顺序显示 */
watch(keyword, () => {
  if (paginationEnabled.value) current.value = 1;
});

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

/* ---------- 单元格合并：colSpan 保留虚拟；rowSpan / 跨固定区 / 展开行各有降级 ---------- */
const EMPTY_SPAN_PLAN: KTableSpanPlan = {
  cells: new Map(),
  covered: new Set(),
  hasRowSpan: false,
  crossesFixedRegion: false,
};
const spanPlan = computed<KTableSpanPlan>(() => {
  if (!props.spanMethod) return EMPTY_SPAN_PLAN;
  return buildSpanPlan({
    rows: pageRows.value,
    leaves: leaves.value,
    keyOfRow: row => rowKeyOf(row),
    spanMethod: props.spanMethod,
  });
});
/** 合并场景下展开内容挂到所属合并组底部；无合并时保持原有行内展开 */
const bottomExpanded = computed(
  () =>
    Boolean(props.spanMethod) &&
    (props.expandedPlacement === 'bottom' || spanPlan.value.hasRowSpan),
);
let bottomFallbackWarned = false;
watch(
  () => props.expandedPlacement === 'bottom' && !props.spanMethod,
  unused => {
    if (!unused || bottomFallbackWarned) return;
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    bottomFallbackWarned = true;
    console.warn(
      '[KTable] expandedPlacement="bottom" 仅在启用 spanMethod 时生效；未检测到合并，已按 inline 渲染。',
    );
  },
  { immediate: true },
);
let inlineSpanWarned = false;
watch(
  () =>
    Boolean(props.spanMethod) &&
    spanPlan.value.hasRowSpan &&
    props.expandedPlacement !== 'bottom' &&
    expandedSet.value.size > 0,
  auto => {
    if (!auto || inlineSpanWarned) return;
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    inlineSpanWarned = true;
    console.warn(
      '[KTable] 检测到 rowSpan 合并：展开内容已自动追加到所属合并组底部，避免打断合并。',
    );
  },
  { immediate: true },
);
function isSpanCovered(row: T, leafKey: string) {
  const plan = spanPlan.value;
  if (!plan.covered.size) return false;
  return plan.covered.has(spanCellKey(rowKeyOf(row), leafKey));
}
function spanOf(row: T, leafKey: string): KTableSpanCell | undefined {
  const plan = spanPlan.value;
  if (!plan.cells.size) return undefined;
  return plan.cells.get(spanCellKey(rowKeyOf(row), leafKey));
}
function spanRowSpan(row: T, leafKey: string) {
  const span = spanOf(row, leafKey);
  return span && span.rowSpan > 1 ? span.rowSpan : undefined;
}
function spanColSpan(row: T, leafKey: string) {
  const span = spanOf(row, leafKey);
  return span && span.colSpan > 1 ? span.colSpan : undefined;
}
/** 本行前面的叶子都被合并覆盖时，这个首格拿不到“前一个兄弟”的左边框 */
function isSpanEdge(row: T, leafKey: string) {
  if (!spanPlan.value.covered.size) return false;
  const index = leafIndex(leafKey);
  if (index <= 0) return false;
  for (let cursor = 0; cursor < index; cursor++) {
    if (!isSpanCovered(row, leaves.value[cursor].key)) return false;
  }
  return true;
}
const isDevEnv = () => Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
let spanStickyWarned = false;
watch(
  () => spanPlan.value.crossesFixedRegion,
  crosses => {
    if (!crosses || spanStickyWarned || !isDevEnv()) return;
    spanStickyWarned = true;
    console.warn(
      '[KTable] 合并跨了左右固定区与中区：浮层无法承载，已退回粘性单元格模式（固定列抗抖动与性能会相应回退）。',
    );
  },
  { immediate: true },
);

interface KTableBodyRow<T> {
  row: T;
  pinned: 'top' | 'bottom' | null;
  pinIndex: number;
  /** rowClick / 渲染用的数据下标 */
  index: number;
  /** 树形层级（非树形为 0） */
  depth: number;
  hasChildren: boolean;
}
const bodyRows = computed<KTableBodyRow<T>[]>(() => [
  ...pinnedTopRows.value.map((row, pinIndex) => ({
    row,
    pinned: 'top' as const,
    pinIndex,
    index: sourceIndex.value.get(row) ?? 0,
    depth: 0,
    hasChildren: false,
  })),
  ...pageRows.value.map((row, index) => {
    const meta = treeMetaByKey.value.get(rowKeyOf(row));
    return {
      row,
      pinned: null,
      pinIndex: -1,
      index: rowIndexAt(index),
      depth: meta?.depth ?? 0,
      hasChildren: meta?.hasChildren ?? false,
    };
  }),
  ...pinnedBottomRows.value.map((row, pinIndex) => ({
    row,
    pinned: 'bottom' as const,
    pinIndex,
    index: sourceIndex.value.get(row) ?? 0,
    depth: 0,
    hasChildren: false,
  })),
]);

/* ---------- 卡片列表：展开详情渲染在卡片内部，不走虚拟窗口 ---------- */
interface KTableCardItem<T> {
  key: string;
  entry: KTableBodyRow<T>;
}
const cardItems = computed<KTableCardItem<T>[]>(() => {
  if (!stackActive.value) return [];
  return bodyRows.value.map(entry => ({
    key: `card-${rowKeyOf(entry.row)}`,
    entry,
  }));
});

/* ---------- 虚拟滚动：变量行高（实测缓存 + 前缀和）+ 共用窗口 ---------- */
interface KTableRenderEntry<T> {
  key: string;
  entry?: KTableBodyRow<T>;
  /** 置底展开行：整行跨全部列，与 entry 互斥 */
  expanded?: KTableBodyRow<T>;
  height?: number;
}
/** 未测量行的估算高度；实测后以缓存为准 */
const virtualRowHeight = ref(48);
const virtualStart = ref(0);
const virtualEnd = ref(0);
const virtualActive = computed(() => props.virtual);
const virtualEnabled = computed(
  () => virtualActive.value && pageRows.value.length > Math.max(1, props.virtualThreshold),
);
const pinnedTopHeight = ref(0);
const pinnedBottomHeight = ref(0);
/** 实测行高缓存按行 key 存，排序/筛选/换页都不失效 */
const rowHeightCache = new Map<string, number>();
/** 展开行高度按展开项 key 缓存；展开行占用的空间计入所属数据行的偏移 */
const expandedHeightCache = new Map<string, number>();
const virtualOffsets = ref<number[]>([]);
let offsetSignature = '';
function rowCacheKey(row: T) {
  return String(rowKeyOf(row));
}
const pageKeySignature = computed(() => pageRows.value.map(rowCacheKey).join('\u0001'));
/** 展开/收起会改变行占位，必须让前缀和失效 */
const virtualSignature = computed(
  () => `${pageKeySignature.value}|${expandedRowKeys.value.join('\u0001')}`,
);
/** 展开行的估算高度：优先用已测平均值，避免滚动条总高大幅漂移 */
function expandedHeightEstimate() {
  if (!expandedHeightCache.size) return virtualRowHeight.value;
  let sum = 0;
  expandedHeightCache.forEach(height => (sum += height));
  return Math.round(sum / expandedHeightCache.size);
}
function extraHeightOf(index: number) {
  const extras = extrasByRow.value.get(index);
  if (!extras) return 0;
  const estimate = expandedHeightEstimate();
  return extras.reduce(
    (sum, entry) => sum + (expandedHeightCache.get(entry.key) ?? estimate),
    0,
  );
}
function rebuildVirtualOffsets() {
  const heights = pageRows.value.map((row, index) => {
    const base = rowHeightCache.get(rowCacheKey(row));
    const extra = extraHeightOf(index);
    if (base == null && extra === 0) return undefined;
    return (base ?? virtualRowHeight.value) + extra;
  });
  virtualOffsets.value = buildVirtualOffsets(
    heights,
    pageRows.value.length,
    virtualRowHeight.value,
  ).offsets;
}
function ensureVirtualOffsets() {
  const signature = virtualSignature.value;
  if (signature !== offsetSignature) {
    offsetSignature = signature;
    rebuildVirtualOffsets();
  }
  return virtualOffsets.value;
}
watch(
  () => props.virtualRowHeight,
  value => {
    if (typeof value === 'number' && value > 0) {
      virtualRowHeight.value = value;
      offsetSignature = '';
      /* 测量依赖模板 ref，放到 setup 之后 */
      nextTick(() => updateVirtualWindow());
    }
  },
  { immediate: true },
);
/** 行详情展开项：inline 紧随该行；合并场景挂到所属组尾；虚拟与非虚拟共用同一份 */
const extrasByRow = computed<Map<number, KTableRenderEntry<T>[]>>(() => {
  const map = new Map<number, KTableRenderEntry<T>[]>();
  if (!detailEnabled.value || expandedSet.value.size === 0) return map;
  pageRows.value.forEach((row, index) => {
    const rowKey = rowKeyOf(row);
    if (!expandedSet.value.has(rowKey)) return;
    const target = bottomExpanded.value ? spanPlan.value.rowCoverEnd[index] ?? index : index;
    const list = map.get(target) ?? [];
    list.push({
      key: `expanded-${index}-${rowKey}`,
      expanded: {
        row,
        pinned: null,
        pinIndex: -1,
        index: rowIndexAt(index),
        depth: 0,
        hasChildren: false,
      },
    });
    map.set(target, list);
  });
  return map;
});
const renderEntries = computed<KTableRenderEntry<T>[]>(() => {
  const center = bodyRows.value.slice(
    pinnedTopRows.value.length,
    pinnedTopRows.value.length + pageRows.value.length,
  );
  const extras = extrasByRow.value;
  const entries: KTableRenderEntry<T>[] = bodyRows.value
    .slice(0, pinnedTopRows.value.length)
    .map(entry => ({ key: `top-${rowKeyOf(entry.row)}`, entry }));
  if (virtualEnabled.value) {
    const offsets = virtualOffsets.value;
    const total = offsets[center.length] ?? center.length * virtualRowHeight.value;
    const top = offsets[virtualStart.value] ?? 0;
    if (top > 0) entries.push({ key: 'virtual-top', height: top });
    for (let index = virtualStart.value; index < virtualEnd.value; index++) {
      const entry = center[index];
      if (entry) entries.push({ key: `row-${rowKeyOf(entry.row)}`, entry });
      const rowExtras = extras.get(index);
      if (rowExtras) entries.push(...rowExtras);
    }
    const bottom = total - (offsets[virtualEnd.value] ?? total);
    if (bottom > 0) entries.push({ key: 'virtual-bottom', height: bottom });
  } else {
    center.forEach((entry, index) => {
      entries.push({ key: `row-${rowKeyOf(entry.row)}`, entry });
      const rowExtras = extras.get(index);
      if (rowExtras) entries.push(...rowExtras);
    });
  }
  for (const entry of bodyRows.value.slice(pinnedTopRows.value.length + pageRows.value.length)) {
    entries.push({ key: `bottom-${rowKeyOf(entry.row)}`, entry });
  }
  return entries;
});
function updateVirtualWindow() {
  const count = pageRows.value.length;
  if (!virtualEnabled.value) {
    if (virtualStart.value !== 0) virtualStart.value = 0;
    if (virtualEnd.value !== count) virtualEnd.value = count;
    return;
  }
  const wrap = wrapEl.value;
  if (!wrap) return;
  const offsets = ensureVirtualOffsets();
  const viewport = Math.max(
    0,
    wrap.clientHeight - headerHeight.value - pinnedTopHeight.value - pinnedBottomHeight.value,
  );
  const range = getVariableVirtualRange(
    wrap.scrollTop,
    viewport,
    offsets,
    Math.max(0, props.virtualOverscan),
  );
  let start = range.start;
  let end = range.end;
  /* 合并格必须整块渲染：窗口上探到起点行、下探到覆盖末行 */
  const plan = spanPlan.value;
  if (plan.cells.size && plan.rowOrigin.length === count) {
    const expanded = expandRangeForSpans(start, end, plan.rowOrigin, plan.rowCoverEnd, count);
    start = expanded.start;
    end = expanded.end;
  }
  /* 缓冲区：滚出当前窗口的缓冲带才重算，避免每帧重建行 */
  const buffer = Math.max(0, props.virtualBuffer) * virtualRowHeight.value;
  const insideWindow =
    virtualStart.value > 0 &&
    virtualEnd.value < count &&
    wrap.scrollTop > (offsets[virtualStart.value + 1] ?? 0) + buffer &&
    wrap.scrollTop + viewport < (offsets[virtualEnd.value] ?? 0) - buffer;
  if (insideWindow) return;
  if (start !== virtualStart.value) virtualStart.value = start;
  if (end !== virtualEnd.value) virtualEnd.value = end;
}
/** 测量窗口内数据行，更新缓存与前缀和；高度变化时做滚动锚定，避免内容跳动 */
function measureVirtualHeights() {
  const table = tableEl.value;
  if (!table || !virtualEnabled.value) return;
  const rows = table.querySelectorAll<HTMLElement>(
    ':scope > tbody > tr.k-table__row:not(.is-pinned-top):not(.is-pinned-bottom)',
  );
  let changed = false;
  rows.forEach(row => {
    const key = row.dataset.rowKey;
    if (key == null) return;
    const height = row.getBoundingClientRect().height;
    if (!(height > 0)) return;
    const cached = rowHeightCache.get(key);
    if (cached == null || Math.abs(cached - height) > 0.5) {
      rowHeightCache.set(key, height);
      changed = true;
    }
  });
  /* 展开行单独测量：它不占数据行下标，但高度要计入所属行的偏移 */
  table
    .querySelectorAll<HTMLElement>(':scope > tbody > tr.k-table__expanded-row[data-expanded-key]')
    .forEach(row => {
      const key = row.dataset.expandedKey;
      if (key == null) return;
      const height = row.getBoundingClientRect().height;
      if (!(height > 0)) return;
      const cached = expandedHeightCache.get(key);
      if (cached == null || Math.abs(cached - height) > 0.5) {
        expandedHeightCache.set(key, height);
        changed = true;
      }
    });
  if (!changed) return;
  /* 未显式给估算行高时，用已测行的平均值修正，避免滚动条总高大幅漂移 */
  if (typeof props.virtualRowHeight !== 'number' && rowHeightCache.size >= 8) {
    let sum = 0;
    rowHeightCache.forEach(height => (sum += height));
    const average = Math.round(sum / rowHeightCache.size);
    if (Math.abs(average - virtualRowHeight.value) > 2) virtualRowHeight.value = average;
  }
  const wrap = wrapEl.value;
  const offsets = virtualOffsets.value;
  const hasAnchor = Boolean(wrap && offsets.length === pageRows.value.length + 1);
  const anchorIndex = hasAnchor && wrap ? findRowAtOffset(offsets, wrap.scrollTop) : 0;
  const anchorDelta = hasAnchor && wrap ? wrap.scrollTop - offsets[anchorIndex] : 0;
  rebuildVirtualOffsets();
  offsetSignature = virtualSignature.value;
  const anchorTop = virtualOffsets.value[anchorIndex];
  if (hasAnchor && wrap && anchorTop != null) {
    const target = anchorTop + anchorDelta;
    /* 占位高度下一帧才生效，补偿滚动放到 DOM 更新之后 */
    nextTick(() => {
      if (!virtualEnabled.value) return;
      if (Math.abs(wrap.scrollTop - target) > 0.5) wrap.scrollTop = target;
    });
  }
  updateVirtualWindow();
}
/* post flush：窗口换行的 DOM 更新完成后、绘制前测量并同步行高；
   带 rowSpan 的浮层行会自然排版成 49px、主体 48px，若等下一帧再同步，快速滚动时逐行错开 */
watch(
  [virtualStart, virtualEnd],
  () => {
    if (!virtualEnabled.value) return;
    measureVirtualHeights();
    syncFixedLayers();
    /* 浮层用 marginTop:-tableHeight 与主表对齐；换窗后真实表高已变，
       必须同帧刷新，否则整块浮层会上下偏几像素 */
    tableHeight.value = tableEl.value?.getBoundingClientRect().height ?? 0;
  },
  { flush: 'post' },
);

const leadingWidth = computed(
  () => (expandableEnabled.value ? 44 : 0) + (selectionEnabled.value ? 44 : 0),
);

/* ---------- 树形：箭头与缩进放在首个数据列，不再额外占列 ---------- */
const firstLeafKey = computed(() => leaves.value[0]?.key);
function treeCellProps(entry: KTableBodyRow<T>, leaf: KTableLeaf<T>) {
  if (!treeEnabled.value || leaf.key !== firstLeafKey.value) return {};
  const detail = detailEnabled.value && canExpand(entry.row);
  return {
    showTree: true,
    treeDepth: entry.depth,
    treeCaret: entry.hasChildren || detail,
    treeKind: entry.hasChildren ? 'children' : 'detail',
    treeExpanded: isTreeExpanded(entry.row),
    treeToggle: () => toggleExpand(entry.row),
  };
}

/* ---------- 卡片字段：首列标题、副标题、键值字段、操作列 ---------- */
const stackColumns = computed(() => splitStackColumns(leaves.value));
const cardTitleLeaves = computed(() => {
  const title = stackColumns.value.title;
  const firstKey = firstLeafKey.value;
  /* 树形箭头挂在首列：首列被隐藏时也要把它带回标题，否则卡片里没有展开入口 */
  if (!treeEnabled.value || !firstKey || title.some(leaf => leaf.key === firstKey)) return title;
  const first = leafByKey.value.get(firstKey);
  return first ? [first, ...title] : title;
});
const cardSubtitleLeaves = computed(() =>
  stackColumns.value.subtitle.filter(
    leaf => !cardTitleLeaves.value.some(title => title.key === leaf.key),
  ),
);
const cardFieldLeaves = computed(() =>
  stackColumns.value.fields.filter(
    leaf => !cardTitleLeaves.value.some(title => title.key === leaf.key),
  ),
);
const cardActionLeaves = computed(() => stackColumns.value.actions);
function cardLabelOf(leaf: KTableLeaf<T>) {
  return [...leaf.parents, leaf.column.title ?? leaf.key].filter(Boolean).join(' / ');
}
function cardHasControls(entry: KTableBodyRow<T>) {
  return (
    selectionEnabled.value ||
    (expandableEnabled.value && !entry.pinned && canExpand(entry.row)) ||
    (Boolean(slots.card) &&
      treeEnabled.value &&
      (entry.hasChildren || (detailEnabled.value && canExpand(entry.row))))
  );
}
/** 卡片内展开详情：与行详情共用 expandedRowKeys，但渲染在卡片内部 */
function cardExpanded(entry: KTableBodyRow<T>) {
  return (
    detailEnabled.value && !entry.pinned && expandedSet.value.has(rowKeyOf(entry.row))
  );
}
/** 树形子卡按层级缩进；缩进从卡片外边距实现，标题内不再重复缩进 */
function cardIndentStyle(entry: KTableBodyRow<T>): CSSProperties {
  if (!treeEnabled.value || entry.depth <= 0) return {};
  return { marginInlineStart: `${entry.depth * treeIndent.value}px` };
}
function cardTreeCellProps(entry: KTableBodyRow<T>, leaf: KTableLeaf<T>) {
  const treeProps = treeCellProps(entry, leaf);
  return treeProps.showTree ? { ...treeProps, treeDepth: 0 } : treeProps;
}

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
      widthOverrides.value[leaf.key] ??
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
const totalLeafWidth = computed(() =>
  leaves.value.reduce((sum, leaf) => sum + leafWidthOf(leaf), 0),
);
const tableStyle = computed<CSSProperties>(() => {
  const frozen = frozenTableWidth.value;
  const resizeMin = props.columnResizable
    ? Math.max(
        typeof props.scroll?.x === 'number' ? props.scroll.x : 0,
        totalLeafWidth.value + leadingWidth.value,
      )
    : null;
  return {
    width:
      frozen != null ? `${frozen}px` : resizeMin != null ? `${resizeMin}px` : undefined,
    minWidth:
      frozen == null
        ? resizeMin != null
          ? `${resizeMin}px`
          : props.scroll?.x != null
            ? widthStyle(props.scroll.x)
            : undefined
        : undefined,
    /* 省略依赖固定布局；固定列也用固定布局稳定列宽，避免随内容伸缩造成漂移 */
    tableLayout:
      frozen != null ||
      props.columnResizable ||
      leaves.value.some(leaf => leaf.column.ellipsis) ||
      leaves.value.some(leaf => leaf.column.fixed)
        ? 'fixed'
        : undefined,
  };
});
function colStyle(leaf: KTableLeaf<T>): CSSProperties {
  const override = widthOverrides.value[leaf.key];
  if (override != null) return { width: `${override}px` };
  const frozen = frozenWidths.value?.[leaf.key];
  return { width: frozen == null ? widthStyle(leaf.column.width) : `${frozen}px` };
}

/* ---------- 吸顶测量、固定行堆叠偏移、滚动阴影状态 ---------- */
const wrapEl = ref<HTMLElement | null>(null);
const tableEl = ref<HTMLElement | null>(null);
const headEl = ref<HTMLElement | null>(null);
const headerRowEls = ref<(HTMLElement | null)[]>([]);
const headerRowTops = ref<number[]>([]);
const headerRowBottoms = ref<number[]>([]);
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

/* ---------- 吸底横向滚动条：独立轨道 + 拖拽拇指，与表体滚动双向同步 ---------- */
const bottomBar = reactive({ visible: false, thumb: 0, offset: 0, track: 0 });
const BOTTOM_THUMB_MIN = 32;
const bottomFixed = ref(false);
const bottomFixedRect = reactive({ left: 0, width: 0 });
const bottomBarStyle = computed<CSSProperties>(() =>
  bottomFixed.value
    ? { left: `${bottomFixedRect.left}px`, width: `${bottomFixedRect.width}px` }
    : {},
);
let bottomPositionRaf = 0;
/** 表格跨越视口时把滚动条固定在视口底部；整表进入视口后回到表格下方 */
function updateBottomBarPosition() {
  const wrap = wrapEl.value;
  if (!wrap || !bottomBar.visible || stackActive.value) {
    bottomFixed.value = false;
    return;
  }
  const rect = wrap.getBoundingClientRect();
  const viewport = window.innerHeight || document.documentElement.clientHeight;
  const fixed = rect.top < viewport && rect.bottom > viewport;
  bottomFixed.value = fixed;
  if (fixed) {
    bottomFixedRect.left = rect.left;
    bottomFixedRect.width = rect.width;
  }
}
function scheduleBottomBarPosition() {
  if (bottomPositionRaf) return;
  bottomPositionRaf = requestAnimationFrame(() => {
    bottomPositionRaf = 0;
    updateBottomBarPosition();
  });
}
function measureBottomBar() {
  const wrap = wrapEl.value;
  if (
    !wrap ||
    !props.bottomScrollbar ||
    stackActive.value ||
    props.scroll?.y != null
  ) {
    bottomBar.visible = false;
    bottomFixed.value = false;
    return;
  }
  const track = wrap.clientWidth;
  const overflow = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
  bottomBar.track = track;
  bottomBar.visible = overflow > 1 && track > 0;
  if (!bottomBar.visible) {
    bottomBar.thumb = 0;
    bottomBar.offset = 0;
    bottomFixed.value = false;
    return;
  }
  bottomBar.thumb = Math.max(
    BOTTOM_THUMB_MIN,
    Math.round((track * track) / (track + overflow)),
  );
  syncBottomBar();
  updateBottomBarPosition();
}
function syncBottomBar() {
  if (!bottomBar.visible) return;
  const wrap = wrapEl.value;
  if (!wrap) return;
  const maxOffset = bottomBar.track - bottomBar.thumb;
  bottomBar.offset =
    maxScrollLeft > 0 && maxOffset > 0
      ? (wrap.scrollLeft / maxScrollLeft) * maxOffset
      : 0;
}
interface BottomDragState {
  startX: number;
  startScroll: number;
  maxOffset: number;
}
let bottomDrag: BottomDragState | null = null;
function onBottomThumbMove(event: PointerEvent) {
  const wrap = wrapEl.value;
  if (!bottomDrag || !wrap || bottomDrag.maxOffset <= 0 || maxScrollLeft <= 0) return;
  const delta = event.clientX - bottomDrag.startX;
  wrap.scrollLeft = bottomDrag.startScroll + (delta / bottomDrag.maxOffset) * maxScrollLeft;
}
function stopBottomThumbDrag() {
  window.removeEventListener('pointermove', onBottomThumbMove);
  window.removeEventListener('pointerup', stopBottomThumbDrag);
  bottomDrag = null;
  document.body.style.userSelect = '';
}
function onBottomThumbDown(event: PointerEvent) {
  if (!wrapEl.value) return;
  event.preventDefault();
  bottomDrag = {
    startX: event.clientX,
    startScroll: wrapEl.value.scrollLeft,
    maxOffset: bottomBar.track - bottomBar.thumb,
  };
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onBottomThumbMove);
  window.addEventListener('pointerup', stopBottomThumbDrag, { once: true });
}
function onBottomTrackDown(event: PointerEvent) {
  if (event.target !== event.currentTarget) return;
  const wrap = wrapEl.value;
  const track = event.currentTarget as HTMLElement;
  const maxOffset = bottomBar.track - bottomBar.thumb;
  if (!wrap || maxOffset <= 0 || maxScrollLeft <= 0) return;
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(
    1,
    Math.max(0, (event.clientX - rect.left - bottomBar.thumb / 2) / maxOffset),
  );
  wrap.scrollLeft = ratio * maxScrollLeft;
}
onScopeDispose(stopBottomThumbDrag);
let bottomListenersOn = false;
function setBottomBarListeners(active: boolean) {
  if (active === bottomListenersOn || typeof window === 'undefined') return;
  bottomListenersOn = active;
  if (active) {
    window.addEventListener('scroll', scheduleBottomBarPosition, { passive: true });
    window.addEventListener('resize', scheduleBottomBarPosition);
    return;
  }
  window.removeEventListener('scroll', scheduleBottomBarPosition);
  window.removeEventListener('resize', scheduleBottomBarPosition);
  if (bottomPositionRaf) cancelAnimationFrame(bottomPositionRaf);
  bottomPositionRaf = 0;
}
onMounted(() => setBottomBarListeners(props.bottomScrollbar));
watch(() => props.bottomScrollbar, active => setBottomBarListeners(active));
onScopeDispose(() => setBottomBarListeners(false));
watch([() => props.bottomScrollbar, () => props.scroll?.y, stackActive], () =>
  nextTick(measureLayout),
);

/* ---------- 页面级吸顶：不创建内部滚动容器时，直接把表头 sticky 到视口 ---------- */
const headerAtBottom = computed(() => props.headerPosition === 'bottom');
const pageStickyActive = computed(
  () => props.pageSticky && props.scroll?.y == null && props.scroll?.x == null,
);
const rootStyle = computed<CSSProperties>(() => {
  const style: Record<string, string> = {
    '--k-table-head-height': `${headerHeight.value}px`,
  };
  if (pageStickyActive.value) {
    const offset = props.pageStickyOffset;
    style[headerAtBottom.value ? '--k-table-page-sticky-bottom' : '--k-table-page-sticky-top'] =
      typeof offset === 'number' ? `${offset}px` : offset;
  }
  return style as CSSProperties;
});
let pageStickyWarned = false;
watch(
  () => props.pageSticky && (props.scroll?.x != null || props.scroll?.y != null),
  hit => {
    if (!hit || pageStickyWarned) return;
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    pageStickyWarned = true;
    console.warn(
      '[KTable] pageSticky 要求表格没有内部滚动；检测到 scroll.x / scroll.y，已忽略页面吸顶（scroll.y 请用 sticky）。',
    );
  },
  { immediate: true },
);

/* ---------- 触底加载：进入阈值触发一次，离开阈值后重新武装 ---------- */
let reachEndArmed = true;
function checkReachEnd() {
  const wrap = wrapEl.value;
  if (!wrap || props.scroll?.y == null) return;
  const threshold = Math.max(0, props.reachEndThreshold);
  const distance = Math.max(0, maxScrollTop - wrap.scrollTop);
  if (distance <= threshold) {
    if (reachEndArmed && !props.loadingMore && maxScrollTop > 0) {
      reachEndArmed = false;
      emit('reachEnd', distance);
    }
    return;
  }
  if (distance > threshold * 2) reachEndArmed = true;
}
watch(
  () => props.dataSource.length,
  () => {
    reachEndArmed = true;
    nextTick(measureLayout);
  },
);

function setHeaderRowEl(el: Element | ComponentPublicInstance | null, rowIndex: number) {
  headerRowEls.value[rowIndex] = (el as HTMLElement | null) ?? null;
}
function measureHeaderRows() {
  const heights = headerRowEls.value.map(el => el?.offsetHeight ?? 0);
  let top = 0;
  headerRowTops.value = heights.map(height => {
    const rowTop = top;
    top += height;
    return rowTop;
  });
  let bottom = 0;
  const bottoms: number[] = new Array(heights.length);
  for (let index = heights.length - 1; index >= 0; index--) {
    bottoms[index] = bottom;
    bottom += heights[index];
  }
  headerRowBottoms.value = bottoms;
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
  let bottom = props.sticky && headerAtBottom.value ? headerHeight.value : 0;
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
  const signature = leaves.value
    .map(leaf => `${leaf.key}:${widthOverrides.value[leaf.key] ?? leaf.column.width ?? ''}`)
    .join('|');
  if (!baseWidths || signature !== baseSignature) {
    baseWidths = {};
    for (const leaf of leaves.value) {
      baseWidths[leaf.key] =
        widthOverrides.value[leaf.key] ??
        measuredWidths.value[leaf.key] ??
        (Number(leaf.column.width) || 0);
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
  syncBottomBar();
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
    updateVirtualWindow();
    measureVirtualHeights();
    tableHeight.value = tableEl.value?.getBoundingClientRect().height ?? 0;
    const wrap = wrapEl.value;
    if (wrap) {
      maxScrollLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    }
    scrollRange.value = maxScrollLeft;
    measureBottomBar();
    updateVirtualWindow();
    correctBottomStickyHeader();
    syncScrollState();
  } finally {
    measuringLayout = false;
  }
}
/* Chromium 在内容高度变化后不会立即重算底部粘性；按差量补偿 scrollTop，借这次真实滚动让原生 sticky 复位 */
let lastHeaderScrollHeight = -1;
let stickyScrollSeen = false;
function correctBottomStickyHeader() {
  if (!props.sticky || !headerAtBottom.value || props.scroll?.y == null) {
    lastHeaderScrollHeight = -1;
    return;
  }
  const wrap = wrapEl.value;
  const head = headEl.value;
  if (!wrap || !head) return;
  const height = wrap.scrollHeight;
  if (lastHeaderScrollHeight < 0) {
    lastHeaderScrollHeight = height;
    return;
  }
  if (height === lastHeaderScrollHeight) return;
  lastHeaderScrollHeight = height;
  const rect = wrap.getBoundingClientRect();
  const viewportTop = rect.top + wrap.clientTop;
  const pinnedTop = viewportTop + wrap.clientHeight - headerHeight.value;
  const naturalTop = viewportTop + height - headerHeight.value - wrap.scrollTop;
  const actualTop = head.getBoundingClientRect().top;
  /* 表头还没被原生 sticky 定位过时不动滚动，等它先稳定贴到容器底部 */
  if (!stickyScrollSeen) {
    if (Math.abs(actualTop - pinnedTop) >= 1) return;
    stickyScrollSeen = true;
  }
  const expectedTop = Math.min(naturalTop, pinnedTop);
  const delta = actualTop - expectedTop;
  if (Math.abs(delta) < 1) return;
  const maxTop = Math.max(0, height - wrap.clientHeight);
  wrap.scrollTop = Math.min(Math.max(wrap.scrollTop + delta, 0), maxTop);
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
  stickyScrollSeen = true;
  /* 滚动帧里不读 scrollWidth/scrollHeight（会强制排版），状态合并到每帧一次 */
  if (syncScrollRaf) return;
  syncScrollRaf = requestAnimationFrame(() => {
    syncScrollRaf = 0;
    syncScrollState();
    updateVirtualWindow();
    checkReachEnd();
  });
}
onMounted(async () => {
  await nextTick();
  measureLayout();
  if (
    props.defaultExpandAll &&
    (expandableEnabled.value || treeEnabled.value) &&
    !expandedRowKeys.value.length
  ) {
    if (treeEnabled.value) {
      const nodes = buildTreeNodes(props.dataSource, treeChildrenKey.value, row => rowKeyOf(row));
      expandedRowKeys.value = collectTreeExpandableKeys(nodes);
    } else {
      expandedRowKeys.value = props.dataSource
        .filter(row => canExpand(row))
        .map(row => rowKeyOf(row));
    }
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
    () => expandedRowKeys.value.join('\u0001'),
    () => leaves.value.map(leaf => leaf.key).join('|'),
    () => processedRows.value,
    () => props.scroll?.x,
    () => props.scroll?.y,
  ],
  async () => {
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
    overlayGroupsConsistent.value &&
    !spanPlan.value.crossesFixedRegion,
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
    widthOverrides.value[leaf.key] ??
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
function overlayHeaderStyle(cell: KTableHeaderCell<T>, rowIndex: number): CSSProperties {
  if (!props.sticky) return {};
  if (headerAtBottom.value) {
    const endIndex = rowIndex + Math.max(0, (cell.rowSpan ?? 1) - 1);
    return { bottom: `${headerRowBottoms.value[endIndex] ?? 0}px` };
  }
  return { top: `${headerRowTops.value[rowIndex] ?? 0}px` };
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
  if (props.sticky) {
    if (headerAtBottom.value) {
      const endIndex = rowIndex + Math.max(0, (cell.rowSpan ?? 1) - 1);
      style.top = 'auto';
      style.bottom = `${headerRowBottoms.value[endIndex] ?? 0}px`;
    } else {
      style.top = `${headerRowTops.value[rowIndex] ?? 0}px`;
    }
  }
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

/* ---------- 全局搜索 / 列拖拽 / 列宽 ---------- */
function onSearchInput(event: Event) {
  globalFilter.value = (event.target as HTMLInputElement).value;
}

interface ColumnDragState {
  key: string;
  startX: number;
  active: boolean;
  sourceEl: HTMLElement | null;
  ghost: HTMLElement | null;
  line: HTMLElement | null;
  cap: HTMLElement | null;
  targetKey: string | null;
  targetSide: 'start' | 'end';
}
let columnDrag: ColumnDragState | null = null;

function fixedOfKey(key: string) {
  return allLeaves.value.find(leaf => leaf.key === key)?.column.fixed ?? null;
}
/** 叶子列所在分组路径（分组 key 数组）；找不到返回 null */
function groupChainOf(
  key: string,
  list: readonly KTableColumn<T>[] = orderedColumns.value,
  chain: string[] = [],
): string[] | null {
  for (const column of list) {
    if (column.children?.length) {
      const found = groupChainOf(key, column.children, [
        ...chain,
        column.key ?? column.title ?? '',
      ]);
      if (found) return found;
      continue;
    }
    if (keyOfColumn(column) === key) return chain;
  }
  return null;
}
/** 跨分组可换位，但固定侧必须一致，避免列和分组表头分处两张表 */
function canDropColumn(sourceKey: string, targetKey: string) {
  return Boolean(
    sourceKey &&
      targetKey &&
      sourceKey !== targetKey &&
      fixedOfKey(sourceKey) === fixedOfKey(targetKey) &&
      groupChainOf(sourceKey) &&
      groupChainOf(targetKey),
  );
}
const DROP_HIGHLIGHT = ['is-column-drop-group', 'is-column-drop-top'];
function clearDropHighlight() {
  const root = wrapEl.value?.closest<HTMLElement>('.k-table');
  root
    ?.querySelectorAll<HTMLElement>('.is-column-drop-group, .is-column-drop-top')
    .forEach(el => el.classList.remove(...DROP_HIGHLIGHT));
}
/** 落点提示：并入分组时高亮目标分组表头，落到顶层时高亮目标列头 */
function highlightDropTarget(sourceKey: string, targetKey: string) {
  clearDropHighlight();
  const root = wrapEl.value?.closest<HTMLElement>('.k-table');
  if (!root) return;
  const targetChain = (groupChainOf(targetKey) ?? []).join('\u0000');
  const sourceChain = (groupChainOf(sourceKey) ?? []).join('\u0000');
  if (targetChain === sourceChain) return;
  if (targetChain) {
    const groups = [...root.querySelectorAll<HTMLElement>('th[data-group-leaves]')]
      .filter(th => (th.dataset.groupLeaves ?? '').split(' ').includes(targetKey))
      /* 嵌套分组取最内层 */
      .sort((a, b) => (a.dataset.groupLeaves?.length ?? 0) - (b.dataset.groupLeaves?.length ?? 0));
    groups[0]?.classList.add('is-column-drop-group');
    return;
  }
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(targetKey) : targetKey;
  root
    .querySelector<HTMLElement>(
      `th[data-column-key="${escaped}"]:not(.is-overlay-placeholder)`,
    )
    ?.classList.add('is-column-drop-top');
}
function onHeaderPointerDown(cell: KTableHeaderCell<T>, event: PointerEvent) {
  if (!props.columnDraggable || cell.isGroup || !cell.leafKey) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, input, .k-table__resize')) return;
  if (props.columnDragMode === 'handle' && !target.closest('.k-table__grip')) return;
  columnDrag = {
    key: cell.leafKey,
    startX: event.clientX,
    active: false,
    sourceEl: (event.currentTarget as HTMLElement | null) ?? null,
    ghost: null,
    line: null,
    cap: null,
    targetKey: null,
    targetSide: 'start',
  };
  window.addEventListener('pointermove', onHeaderPointerMove);
  window.addEventListener('pointerup', onHeaderPointerUp, { once: true });
}
function updateColumnDropLine(event: PointerEvent) {
  const drag = columnDrag;
  if (!drag) return;
  const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)
    ?.closest<HTMLElement>('th[data-column-key]');
  const targetKey = target?.dataset.columnKey ?? null;
  if (!targetKey || !canDropColumn(drag.key, targetKey)) {
    drag.targetKey = null;
    if (drag.line) drag.line.style.display = 'none';
    drag.cap?.remove();
    drag.cap = null;
    clearDropHighlight();
    return;
  }
  highlightDropTarget(drag.key, targetKey);
  const rect = target!.getBoundingClientRect();
  const side = event.clientX < rect.left + rect.width / 2 ? 'start' : 'end';
  drag.targetKey = targetKey;
  drag.targetSide = side;
  if (!drag.line) {
    drag.line = document.createElement('div');
    drag.line.className = 'k-table__col-drop-line';
    document.body.appendChild(drag.line);
  }
  const wrapRect = wrapEl.value?.getBoundingClientRect();
  drag.line.style.display = 'block';
  drag.line.style.left = `${side === 'start' ? rect.left : rect.right}px`;
  drag.line.style.top = `${wrapRect?.top ?? rect.top}px`;
  drag.line.style.height = `${wrapRect?.height ?? rect.height}px`;
  /* 落到顶层：在目标列头顶部再画一条落点线，与并入分组区分 */
  const targetChain = (groupChainOf(targetKey) ?? []).join('\u0000');
  const sourceChain = (groupChainOf(drag.key) ?? []).join('\u0000');
  const toTopLevel = !targetChain && targetChain !== sourceChain;
  if (toTopLevel) {
    if (!drag.cap) {
      drag.cap = document.createElement('div');
      drag.cap.className = 'k-table__col-drop-cap';
      document.body.appendChild(drag.cap);
    }
    drag.cap.style.display = 'block';
    drag.cap.style.left = `${rect.left}px`;
    drag.cap.style.top = `${rect.top}px`;
    drag.cap.style.width = `${rect.width}px`;
  } else if (drag.cap) {
    drag.cap.remove();
    drag.cap = null;
  }
}
function onHeaderPointerMove(event: PointerEvent) {
  const drag = columnDrag;
  if (!drag) return;
  if (!drag.active) {
    if (Math.abs(event.clientX - drag.startX) <= 4) return;
    drag.active = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    drag.sourceEl?.classList.add('is-column-dragging');
    const ghost = document.createElement('div');
    ghost.className = 'k-table__col-ghost';
    if (drag.sourceEl) {
      const rect = drag.sourceEl.getBoundingClientRect();
      const style = getComputedStyle(drag.sourceEl);
      const clone = drag.sourceEl.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.k-table__resize, .k-table__grip').forEach(node => node.remove());
      clone.style.cssText =
        `display:flex;align-items:center;gap:4px;width:${rect.width}px;height:${rect.height}px;` +
        `padding:${style.padding};box-sizing:border-box;font:${style.font};color:${style.color};`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.background = style.backgroundColor;
      ghost.appendChild(clone);
    }
    document.body.appendChild(ghost);
    drag.ghost = ghost;
  }
  if (drag.ghost) {
    drag.ghost.style.left = `${event.clientX + 12}px`;
    drag.ghost.style.top = `${event.clientY + 12}px`;
  }
  updateColumnDropLine(event);
}
function onHeaderPointerUp(event: PointerEvent) {
  const drag = columnDrag;
  if (!drag) return;
  if (drag.active) updateColumnDropLine(event);
  window.removeEventListener('pointermove', onHeaderPointerMove);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  columnDrag = null;
  drag.sourceEl?.classList.remove('is-column-dragging');
  drag.ghost?.remove();
  drag.line?.remove();
  drag.cap?.remove();
  clearDropHighlight();
  if (!drag.active) return;
  const targetKey = drag.targetKey;
  if (!targetKey || !canDropColumn(drag.key, targetKey)) return;
  const keys = allLeaves.value.map(leaf => leaf.key);
  const from = keys.indexOf(drag.key);
  keys.splice(from, 1);
  const targetIndex = keys.indexOf(targetKey);
  if (targetIndex < 0) return;
  keys.splice(drag.targetSide === 'end' ? targetIndex + 1 : targetIndex, 0, drag.key);
  const targetChain = groupChainOf(targetKey) ?? [];
  const sourceChain = groupChainOf(drag.key) ?? [];
  if (targetChain.join('\u0000') === sourceChain.join('\u0000')) {
    if (drag.key in columnGroups.value) {
      const next = { ...columnGroups.value };
      delete next[drag.key];
      columnGroups.value = next;
    }
  } else {
    columnGroups.value = { ...columnGroups.value, [drag.key]: [...targetChain] };
  }
  columnOrder.value = keys;
}
function reflowColumnWidths() {
  if (!props.columnResizable || !leaves.value.length) return;
  const wrap = wrapEl.value;
  const target =
    Math.max(
      typeof props.scroll?.x === 'number' ? props.scroll.x : 0,
      wrap?.clientWidth ?? 0,
    ) - leadingWidth.value;
  const base: Record<string, number> = {};
  for (const leaf of leaves.value) {
    base[leaf.key] =
      widthOverrides.value[leaf.key] ??
      ((leaf ? leafWidthOf(leaf) : 0) || Number(leaf.column.width) || 80);
  }
  columnWidths.value = distributeIntegerWidths(base, Math.max(target, leaves.value.length * 56));
}
function onHeaderDblClick(event: MouseEvent) {
  if (!props.columnResizable) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('button, input, .k-table__resize')) return;
  reflowColumnWidths();
}
function onResizeReset(key: string) {
  if (!key || !widthOverrides.value[key]) return;
  const lastKey = leaves.value[leaves.value.length - 1]?.key;
  /* 最后一列双击恢复初始列宽（含之前拖动产生的宽度快照） */
  if (key === lastKey) {
    columnWidths.value = {};
    return;
  }
  const next = { ...columnWidths.value };
  delete next[key];
  columnWidths.value = next;
}
function onResizeStart(key: string, event: PointerEvent) {
  if (!props.columnResizable || !key) return;
  const keys = leaves.value.map(leaf => leaf.key);
  const index = keys.indexOf(key);
  const nextKey = index >= 0 ? keys[index + 1] : undefined;
  const widthOf = (leafKey: string) => {
    const leaf = leafByKey.value.get(leafKey);
    return (
      widthOverrides.value[leafKey] ??
      ((leaf ? leafWidthOf(leaf) : 0) || Number(leaf?.column.width) || 80)
    );
  };
  const startX = event.clientX;
  const startCurrent = widthOf(key);
  const startNext = nextKey ? widthOf(nextKey) : 0;
  /* 首次拖动时冻结当前实际列宽，避免只覆盖两列后其余列按声明宽度重新分配 */
  const snapshot: Record<string, number> = {};
  for (const leaf of leaves.value) snapshot[leaf.key] = widthOf(leaf.key);
  const MIN = 56;
  const move = (moveEvent: PointerEvent) => {
    let delta = Math.round(moveEvent.clientX - startX);
    if (!nextKey) {
      /* 最后一列：继续加宽，表格随列宽变宽 */
      columnWidths.value = { ...snapshot, [key]: Math.max(MIN, startCurrent + delta) };
      return;
    }
    delta = Math.min(delta, startNext - MIN);
    const current = Math.max(MIN, startCurrent + delta);
    const next = startCurrent + startNext - current;
    columnWidths.value = { ...snapshot, [key]: current, [nextKey]: next };
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop, { once: true });
}

/* ---------- 行拖拽：按住行拖动，线条标示落位，发 rowReorder ---------- */
interface RowDragState {
  row: T;
  from: number;
  startX: number;
  startY: number;
  active: boolean;
  sourceEl: HTMLElement | null;
  ghost: HTMLElement | null;
  line: HTMLElement | null;
  to: number | null;
}
let rowDrag: RowDragState | null = null;

function createRowGhost(source: HTMLElement) {
  const rect = source.getBoundingClientRect();
  const table = document.createElement('table');
  table.className = 'k-table__table k-table__row-ghost';
  const tbody = document.createElement('tbody');
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  clone.removeAttribute('data-row-key');
  [...clone.children].forEach((cell, index) => {
    const original = source.children[index] as HTMLElement | undefined;
    if (!original) return;
    const td = cell as HTMLElement;
    const style = getComputedStyle(original);
    td.style.width = `${original.getBoundingClientRect().width}px`;
    td.style.padding = style.padding;
    td.style.background = style.backgroundColor;
    td.style.color = style.color;
    td.style.boxSizing = 'border-box';
  });
  clone.style.backgroundColor = getComputedStyle(source).backgroundColor;
  tbody.appendChild(clone);
  table.appendChild(tbody);
  table.style.cssText =
    `position:fixed;left:0;top:0;margin:0;width:${rect.width}px;` +
    'border-collapse:separate;border-spacing:0;pointer-events:none;z-index:2147483000;' +
    'box-shadow:0 10px 24px rgb(0 0 0 / 16%);border-radius:6px;overflow:hidden;';
  document.body.appendChild(table);
  return table;
}
function onRowPointerDown(
  entry: { row: T; index: number; pinned?: string | null },
  event: PointerEvent,
) {
  if (!props.rowDraggable || entry.pinned) return;
  const pointerTarget = event.target as HTMLElement;
  if (props.rowDragMode === 'handle' && !pointerTarget.closest('.k-table__row-grip')) return;
  if (
    pointerTarget.closest(
      'button, a, input, textarea, select, .k-table__actions, .k-table__expand, .k-table__tree-caret, .k-table__resize',
    ) &&
    !pointerTarget.closest('.k-table__row-grip')
  ) {
    return;
  }
  const from = pageRows.value.indexOf(entry.row);
  rowDrag = {
    row: entry.row,
    from: from >= 0 ? from : entry.index,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    sourceEl: (event.currentTarget as HTMLElement | null) ?? null,
    ghost: null,
    line: null,
    to: null,
  };
  window.addEventListener('pointermove', onRowPointerMove);
  window.addEventListener('pointerup', onRowPointerUp, { once: true });
}
function onRowPointerMove(event: PointerEvent) {
  const drag = rowDrag;
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 5) return;
    drag.active = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    drag.sourceEl?.classList.add('is-row-dragging');
    if (drag.sourceEl) drag.ghost = createRowGhost(drag.sourceEl);
    drag.line = document.createElement('div');
    drag.line.className = 'k-table__row-drop-line';
    document.body.appendChild(drag.line);
  }
  if (drag.ghost && drag.sourceEl) {
    const rect = drag.sourceEl.getBoundingClientRect();
    drag.ghost.style.left = `${event.clientX - rect.width / 2}px`;
    drag.ghost.style.top = `${event.clientY - rect.height / 2}px`;
  }
  const table = tableEl.value;
  if (!table) return;
  const rows = [
    ...table.querySelectorAll<HTMLElement>(
      'tbody > tr.k-table__row[data-row-key]:not(.is-pinned-top):not(.is-pinned-bottom)',
    ),
  ];
  if (!rows.length) return;
  let to = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      to = index;
      break;
    }
  }
  drag.to = to;
  const first = rows[0].getBoundingClientRect();
  const y =
    to < rows.length
      ? rows[to].getBoundingClientRect().top
      : rows[rows.length - 1].getBoundingClientRect().bottom;
  if (drag.line) {
    drag.line.style.display = 'block';
    drag.line.style.left = `${first.left}px`;
    drag.line.style.width = `${first.width}px`;
    drag.line.style.top = `${y - 1}px`;
  }
}
function onRowPointerUp() {
  const drag = rowDrag;
  window.removeEventListener('pointermove', onRowPointerMove);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  rowDrag = null;
  if (!drag) return;
  drag.sourceEl?.classList.remove('is-row-dragging');
  drag.ghost?.remove();
  drag.line?.remove();
  if (!drag.active || drag.to == null) return;
  let to = drag.to;
  if (to > drag.from) to -= 1;
  if (to === drag.from) return;
  emit('rowReorder', { row: drag.row, from: drag.from, to });
}

/* ---------- 单元格编辑：单击 / 双击 / 手动（v-model:editingCell） ---------- */
function isCellEditing(row: T, columnKey: string) {
  const cell = editingCell.value;
  return Boolean(
    cell && cell.columnKey === columnKey && String(cell.rowKey) === String(rowKeyOf(row)),
  );
}
function maybeBeginCellEdit(
  entry: { row: T; index: number },
  leaf: KTableLeaf<T>,
  event: MouseEvent,
) {
  if (!leaf.column.editable || props.editTrigger !== 'click') return;
  beginCellEdit(entry, leaf, event);
}
function maybeBeginCellEditDouble(
  entry: { row: T; index: number },
  leaf: KTableLeaf<T>,
  event: MouseEvent,
) {
  if (!leaf.column.editable || props.editTrigger !== 'dblclick') return;
  beginCellEdit(entry, leaf, event);
}
function beginCellEdit(
  entry: { row: T; index: number },
  leaf: KTableLeaf<T>,
  event: MouseEvent,
) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('button, a, input, textarea, select, .k-table__actions')) return;
  editingCell.value = { rowKey: rowKeyOf(entry.row), columnKey: leaf.key };
  event.stopPropagation();
}
function commitCellEdit(
  row: T,
  column: KTableColumn<T>,
  rowIndex: number,
  value: unknown,
) {
  editingCell.value = null;
  emit('cellEdit', {
    row,
    column,
    value,
    previousValue: getCellValue(row, column.dataIndex),
    rowIndex,
  });
}
function cancelCellEdit() {
  editingCell.value = null;
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

/** 展开内容壳：插槽或 expandedRender 产出的 VNode 直接渲染 */
const KExpandedContent = defineComponent({
  name: 'KTableExpandedContent',
  props: {
    content: { type: null, default: null },
  },
  setup(contentProps) {
    return () => contentProps.content as VNodeChild;
  },
});

/* 单元格内容（省略/提示），主表与固定列浮层共用；树形首列附带缩进与展开箭头 */
const KBodyCellInner = defineComponent({
  props: {
    column: { type: Object as PropType<KTableColumn<T>>, required: true },
    row: { type: Object as PropType<T>, required: true },
    index: { type: Number, required: true },
    showTree: { type: Boolean, default: false },
    treeDepth: { type: Number, default: 0 },
    treeCaret: { type: Boolean, default: false },
    treeKind: { type: String as PropType<'children' | 'detail'>, default: 'children' },
    treeExpanded: { type: Boolean, default: false },
    treeToggle: {
      type: Function as PropType<(() => void) | undefined>,
      default: undefined,
    },
    editing: { type: Boolean, default: false },
    rowDragHandle: { type: Boolean, default: false },
    onRowDragStart: {
      type: Function as PropType<((event: PointerEvent) => void) | undefined>,
      default: undefined,
    },
    onCommit: {
      type: Function as PropType<((value: unknown) => void) | undefined>,
      default: undefined,
    },
    onCancel: {
      type: Function as PropType<(() => void) | undefined>,
      default: undefined,
    },
  },
  setup(cellProps) {
    const draft = ref('');
    const inputRef = ref<ComponentPublicInstance | null>(null);
    let finished = false;
    watch(
      () => cellProps.editing,
      editing => {
        if (!editing) return;
        finished = false;
        const value = getCellValue(cellProps.row, cellProps.column.dataIndex);
        draft.value = value == null ? '' : String(value);
        nextTick(() => {
          const root = inputRef.value?.$el as HTMLElement | undefined;
          const input = root?.querySelector?.('input, textarea') as HTMLInputElement | null;
          input?.focus();
          if (input) {
            const end = input.value.length;
            input.setSelectionRange(end, end);
          }
        });
      },
      { immediate: true },
    );
    const ICON_PATHS: Record<string, string> = {
      view: 'M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5zm7 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
      edit: 'M3 11.5V13h1.5l7-7L10 4.5l-7 7zM12.7 3.3a1 1 0 0 1 0 1.4l-1 1L10.3 4.3l1-1a1 1 0 0 1 1.4 0z',
      copy: 'M5 2h6a1 1 0 0 1 1 1v1H5V2zm8 2h1a1 1 0 0 1 1 1v9H5v-1H4V4h1V3a1 1 0 0 1 1-1h1V1h6v1a1 1 0 0 1 1 1v1zM5 5v8h9V5H5z',
      remove: 'M3 5h10M6 5V3h4v2m-5 0 .5 8h5L11 5',
      more: 'M3 8h.01M8 8h.01M13 8h.01',
    };
    function renderActionIcon(action: KTableRowAction<T>, fallback?: string) {
      const path = action.icon ? ICON_PATHS[action.icon] : undefined;
      if (path) {
        return h(
          'svg',
          {
            viewBox: '0 0 16 16',
            width: '1em',
            height: '1em',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 1.4,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true',
          },
          [h('path', { d: path })],
        );
      }
      return h('span', { class: 'k-table__action-text' }, fallback ?? action.label);
    }
    function renderActions() {
      const column = cellProps.column;
      const actions = column.actions ?? [];
      const max = Math.max(1, column.maxActions ?? 3);
      const disabledOf = (action: KTableRowAction<T>) =>
        typeof action.disabled === 'function'
          ? action.disabled(cellProps.row)
          : Boolean(action.disabled);
      const renderAction = (action: KTableRowAction<T>) =>
        h(
          'button',
          {
            type: 'button',
            class: ['k-table__action', { 'is-danger': action.danger }],
            disabled: disabledOf(action),
            title: action.label,
            'aria-label': action.label,
            onClick: (event: MouseEvent) => {
              event.stopPropagation();
              if (disabledOf(action)) return;
              action.onClick?.({ row: cellProps.row, index: cellProps.index, event });
            },
          },
          [renderActionIcon(action)],
        );
      const items: VNodeChild[] = [];
      const slotContent = slots.actions?.({
        row: cellProps.row,
        index: cellProps.index,
        column,
      });
      if (slotContent) items.push(h('span', { class: 'k-table__actions-slot' }, slotContent));
      items.push(...actions.slice(0, max).map(renderAction));
      const rest = actions.slice(max);
      if (rest.length) {
        items.push(
          h(
            KDropdown,
            {
              trigger: 'click',
              placement: 'bottomRight',
              menuLabel: '更多操作',
              items: rest.map(action => ({
                key: action.key ?? action.label,
                label: action.label,
                icon: ACTION_ICONS[action.icon ?? ''] ?? undefined,
                disabled: disabledOf(action),
                danger: action.danger,
              })),
              onSelect: (key: string | number) => {
                const action = rest.find(item => (item.key ?? item.label) === key);
                if (!action || disabledOf(action)) return;
                action.onClick?.({ row: cellProps.row, index: cellProps.index });
              },
            },
            {
              trigger: () =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'k-table__action',
                    title: '更多',
                    'aria-label': '更多操作',
                  },
                  [h(IconDotsVertical, { size: '1em' })],
                ),
            },
          ),
        );
      }
      return h(
        'span',
        {
          class: 'k-table__actions',
          onClick: (event: MouseEvent) => event.stopPropagation(),
        },
        items,
      );
    }
    const GRIP_SVG =
      '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M8 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' +
      '<path d="M16 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M16 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M16 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' +
      '</svg>';
    function wrapWithRowGrip(content: VNodeChild) {
      return h('span', { class: 'k-table__cell-with-grip' }, [
        h('span', {
          class: 'k-table__row-grip',
          'aria-hidden': 'true',
          innerHTML: GRIP_SVG,
          onPointerdown: (event: PointerEvent) => {
            event.stopPropagation();
            cellProps.onRowDragStart?.(event);
          },
        }),
        content,
      ]);
    }
    return () => {
      const column = cellProps.column;
      if (column.actions?.length) return renderActions();
      if (cellProps.editing && column.editable) {
        const value = getCellValue(cellProps.row, column.dataIndex);
        const finish = (next: unknown) => {
          if (finished) return;
          finished = true;
          cellProps.onCommit?.(next);
        };
        const cancel = () => {
          if (finished) return;
          finished = true;
          cellProps.onCancel?.();
        };
        if (column.editRender) {
          return column.editRender({
            row: cellProps.row,
            value,
            index: cellProps.index,
            column,
            commit: finish,
            cancel,
          });
        }
        return h(
          'span',
          {
            class: 'k-table__editor',
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                finish(draft.value);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
            },
            onFocusout: () => finish(draft.value),
          },
          [
            h(KInput, {
              ref: inputRef,
              modelValue: draft.value,
              size: 'sm',
              'onUpdate:modelValue': (next: string) => {
                draft.value = next;
              },
            }),
          ],
        );
      }
      const content = h(KCellContent, {
        column,
        row: cellProps.row,
        index: cellProps.index,
      });
      let inner: VNodeChild = content;
      if (cellProps.column.ellipsisTooltip) {
        inner = h(
          KOverflowTooltip,
          { text: cellText(cellProps.column, cellProps.row) },
          { default: () => content },
        );
      } else if (cellProps.column.ellipsis) {
        inner = h('span', { class: 'k-table__ellipsis-text' }, [content]);
      }
      if (!cellProps.showTree) return cellProps.rowDragHandle ? wrapWithRowGrip(inner) : inner;
      const indent = h('span', {
        class: 'k-table__tree-indent',
        style: { width: `${cellProps.treeDepth * treeIndent.value}px` },
      });
      const caret = cellProps.treeCaret
        ? h(
            'button',
            {
              type: 'button',
              class: ['k-table__tree-caret', { 'is-expanded': cellProps.treeExpanded }],
              'aria-expanded': cellProps.treeExpanded,
              'aria-label': cellProps.treeExpanded
                ? '收起'
                : cellProps.treeKind === 'children'
                  ? '展开子行'
                  : '展开详情',
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                cellProps.treeToggle?.();
              },
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
                  'stroke-width': 1.6,
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                  'aria-hidden': 'true',
                },
                [h('path', { d: 'M6 3.5 10.5 8 6 12.5' })],
              ),
            ],
          )
        : h('span', { class: 'k-table__tree-caret is-placeholder', 'aria-hidden': 'true' });
      const tree = h('span', { class: 'k-table__tree' }, [
        indent,
        caret,
        h('span', { class: 'k-table__tree-content' }, [inner]),
      ]);
      return cellProps.rowDragHandle ? wrapWithRowGrip(tree) : tree;
    };
  },
});

/* 表头内容（排序 + 筛选），主表与固定列浮层共用 */
const KHeadCell = defineComponent({
  props: {
    cell: { type: Object as PropType<KTableHeaderCell<T>>, required: true },
    showGrip: { type: Boolean, default: false },
    filterPlacement: { type: String as PropType<'bottomLeft' | 'topLeft'>, default: 'bottomLeft' },
  },
  setup(headProps) {
    return () => {
      const cell = headProps.cell;
      const key = cell.leafKey ?? '';
      const title = slots.columnHeader
        ? slots.columnHeader({ column: cell.column, index: leafIndex(cell.leafKey) })
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
              placement: headProps.filterPlacement,
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
      const gripSvg =
        '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M8 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' +
        '<path d="M16 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M16 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M16 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' +
        '</svg>';
      if (headProps.showGrip) {
        inner.unshift(
          h('span', { class: 'k-table__grip', 'aria-hidden': 'true', innerHTML: gripSvg }),
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
  --k-table-hover-bg: color-mix(in oklab, var(--k-color-text-base) 2.5%, var(--k-color-bg-container));
  --k-table-stripe-bg: color-mix(in oklab, var(--k-color-text-base) 1%, var(--k-color-bg-container));
  /* 汇总行用主色轻染；展开行与页面同底，靠留白和分隔线区分 */
  --k-table-summary-bg: color-mix(in oklab, var(--k-color-primary) 2%, var(--k-color-bg-container));
  --k-table-expanded-bg: var(--k-color-bg-container);
  /* 分隔线沿用全局次级边框色，和 Card 等组件保持一致 */
  --k-table-line: var(--k-color-border-secondary);
  --k-table-border: var(--k-neutral-2);

  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 0;
  color: var(--k-color-text);
  font-size: var(--k-font-size);
}
.k-table__scroll {
  position: relative;
  min-width: 0;
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
  /* 浮层容器不吃指针：占位区事件穿透到主表；具体单元格再单独打开 */
  pointer-events: none;
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
.k-table__fixed-layer .k-table__fixed-table {
  /* 表格本体不吃指针：展开行占位区让事件落到主表的整行内容上 */
  pointer-events: none;
}
.k-table__fixed-layer .k-table__fixed-table .k-table__cell {
  pointer-events: auto;
}
.k-table__fixed-layer .k-table__fixed-table .is-overlay-spacer,
.k-table__fixed-layer .k-table__fixed-table .is-overlay-spacer > .k-table__cell {
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
  /* 无空格长串（邮箱/URL）在单元格内换行，避免压到相邻列；break-word 不影响自动布局列的最小宽度 */
  overflow-wrap: break-word;
}
/* 可编辑表：行高统一按默认编辑控件（KInput sm）预留，进入编辑不再撑高行。
   自定义 editRender 高于默认控件时仍会撑高当前行。 */
.k-table.has-editable {
  --k-table-row-min-height: calc(
    var(--k-control-height-sm) + var(--k-table-cell-padding-y) * 2
  );
}
.k-table.has-editable .k-table__body .k-table__row > .k-table__cell {
  height: var(--k-table-row-min-height);
}
/* 行分隔线用背景绘制而不是真边框：行高保持偶数，单元格内容落在整像素，
   跨行表头纵向居中也才不会出现 0.5px，滚动重绘时不上下跳 */
.k-table.is-row-borders .k-table__cell {
  background-image: linear-gradient(
    to top,
    var(--k-table-line) 0 var(--k-line-width),
    transparent var(--k-line-width)
  );
  background-repeat: no-repeat;
  background-position: left bottom;
}
.k-table .k-table__cell--head {
  position: relative;
  color: var(--k-color-text-secondary);
  font-weight: var(--k-font-weight-heading);
  background-color: var(--k-table-head-bg);
  text-align: start;
  white-space: nowrap;
}
/* 列拖拽落点：并入分组时目标分组表头加深，落到顶层时目标列头染色并在顶边加一条落点线 */
.k-table .k-table__cell--head.is-column-drop-group {
  background-color: color-mix(in oklab, var(--k-color-primary) 9%, var(--k-table-head-bg));
  box-shadow: inset 0 0 0 var(--k-line-width) var(--k-color-primary);
}
.k-table .k-table__cell--head.is-column-drop-top {
  background-color: color-mix(in oklab, var(--k-color-primary) 5%, var(--k-table-head-bg));
}
.k-table .k-table__cell--head.is-draggable {
  cursor: grab;
}
.k-table__grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-inline-end: 6px;
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text-tertiary);
  font-size: 14px;
  vertical-align: middle;
  cursor: grab;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.k-table__grip:hover {
  background: var(--k-color-fill-tertiary);
  color: var(--k-color-text);
}
.k-table__grip:active {
  background: var(--k-color-fill-secondary);
  color: var(--k-color-text);
  cursor: grabbing;
}
.k-table__cell--head.is-column-dragging {
  opacity: 0.4;
}
.k-table__col-ghost {
  position: fixed;
  z-index: 2147483000;
  padding: 6px 12px;
  border-radius: var(--k-border-radius-sm);
  background: var(--k-color-bg-elevated);
  box-shadow: 0 10px 24px rgb(0 0 0 / 16%);
  font-size: 12px;
  font-weight: 600;
  color: var(--k-color-text);
  pointer-events: none;
}
.k-table__col-drop-line {
  position: fixed;
  z-index: 2147483000;
  width: 2px;
  border-radius: 1px;
  background: var(--k-color-primary);
  pointer-events: none;
}
.k-table__col-drop-cap {
  position: fixed;
  z-index: 2147483000;
  height: 2px;
  border-radius: 1px;
  background: var(--k-color-primary);
  pointer-events: none;
}
.k-table__row-grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-inline-end: 6px;
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text-tertiary);
  font-size: 14px;
  vertical-align: middle;
  cursor: grab;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.k-table__row-grip:hover {
  background: var(--k-color-fill-tertiary);
  color: var(--k-color-text);
}
.k-table__row-grip:active {
  background: var(--k-color-fill-secondary);
  color: var(--k-color-text);
  cursor: grabbing;
}
.k-table__cell-with-grip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}
.k-table__row.is-row-draggable {
  cursor: grab;
}
.k-table__row.is-row-draggable:active {
  cursor: grabbing;
}
.k-table__row.is-row-dragging {
  opacity: 0.4;
}
.k-table__row-drop-line {
  position: fixed;
  z-index: 2147483000;
  height: 2px;
  border-radius: 1px;
  background: var(--k-color-primary);
  pointer-events: none;
}
.k-table .k-table__cell--head.is-draggable:active {
  cursor: grabbing;
}
.k-table__resize {
  position: absolute;
  inset-block: 0;
  inset-inline-end: -4px;
  width: 8px;
  cursor: col-resize;
  z-index: 3;
}
.k-table__resize::after {
  content: '';
  position: absolute;
  inset-block: 25%;
  inset-inline-start: 3px;
  width: 1px;
  background: var(--k-color-border);
  opacity: 0;
  transition: opacity 0.15s;
}
.k-table__cell--head:hover .k-table__resize::after {
  opacity: 1;
}
.k-table__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 24px;
}
.k-table__actions-slot {
  display: inline-flex;
  align-items: center;
}
.k-table__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text-secondary);
  font-size: 14px;
  cursor: pointer;
}
.k-table__action:hover:not(:disabled) {
  background: var(--k-color-fill-tertiary);
  color: var(--k-color-text);
}
.k-table__action svg {
  width: 1em;
  height: 1em;
}
.k-table__action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.k-table__action.is-danger:not(:disabled) {
  color: var(--k-color-error);
}
.k-table__action-text {
  padding: 0 4px;
  font-size: 12px;
}
.k-table__cell .k-input {
  width: 100%;
}
.k-table__editor {
  display: block;
  width: 100%;
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
  border: var(--k-line-width) solid var(--k-table-line);
}
/* 吸底横向滚动条：表格跨越视口时固定在视口底部；未限高时隐藏原生滚动条避免重复 */
.k-table.has-bottom-scrollbar .k-table__wrap {
  scrollbar-width: none;
}
.k-table__bottom-scrollbar-slot {
  position: relative;
  height: 14px;
}
.k-table__bottom-scrollbar {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  padding: 4px 0 2px;
  background: var(--k-color-bg-container);
  overscroll-behavior: contain;
}
.k-table__bottom-scrollbar.is-fixed {
  position: fixed;
  top: auto;
  right: auto;
  bottom: 0;
  z-index: 4;
  box-shadow: 0 -1px 0 var(--k-table-border);
}
.k-table__bottom-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--k-color-fill-secondary);
  cursor: pointer;
  touch-action: none;
}
.k-table__bottom-thumb {
  position: absolute;
  top: 0;
  left: 0;
  height: 8px;
  border-radius: 999px;
  background: var(--k-color-text-quaternary);
  cursor: grab;
  transition: background-color 0.15s;
}
.k-table__bottom-thumb:hover {
  background: var(--k-color-text-tertiary);
}
.k-table__bottom-thumb:active {
  background: var(--k-color-text-tertiary);
  cursor: grabbing;
}
.k-table.is-column-borders .k-table__cell + .k-table__cell {
  border-inline-start: var(--k-line-width) solid var(--k-table-line);
}
/* 右浮层首列要补与主表一致的分隔线；左浮层由相邻选择/展开列自然产生 */
.k-table.is-column-borders .k-table__fixed-layer.is-right .k-table__cell:first-child {
  border-inline-start: var(--k-line-width) solid var(--k-table-line);
}
/* 行首若干列被合并覆盖后，本行首格没有“前一个兄弟”，补回纵向分隔线 */
.k-table.is-column-borders .k-table__cell.is-span-edge {
  border-inline-start: var(--k-line-width) solid var(--k-table-line);
}
.k-table.is-sticky .k-table__cell--head {
  position: sticky;
  top: 0;
  z-index: 4;
}
/* 表头沉底：整组表头移到数据行之后；汇总行转为普通行组，排在最底部表头之上 */
.k-table.is-header-bottom .k-table__table > .k-table__head,
.k-table.is-header-bottom .k-table__fixed-table > .k-table__head {
  display: table-footer-group;
}
.k-table.is-header-bottom .k-table__table > tfoot,
.k-table.is-header-bottom .k-table__fixed-table > tfoot {
  display: table-row-group;
}
.k-table.is-header-bottom.is-row-borders .k-table__head-row:first-child > .k-table__cell {
  background-image:
    linear-gradient(
      to bottom,
      var(--k-table-line) 0 var(--k-line-width),
      transparent var(--k-line-width)
    ),
    linear-gradient(
      to top,
      var(--k-table-line) 0 var(--k-line-width),
      transparent var(--k-line-width)
    );
  background-position: left top, left bottom;
}
.k-table.is-sticky.is-header-bottom .k-table__cell--head {
  top: auto;
  /* 跨整组表头的选择/展开列没有逐行偏移，直接贴住容器底部；其余列的内联 bottom 优先级更高 */
  bottom: 0;
}
.k-table.is-page-sticky .k-table__head {
  position: sticky;
  top: var(--k-table-page-sticky-top, 0px);
  z-index: 4;
}
.k-table.is-page-sticky-bottom .k-table__head {
  position: sticky;
  bottom: var(--k-table-page-sticky-bottom, 0px);
  z-index: 4;
}
.k-table__load-more {
  position: absolute;
  right: 0;
  bottom: var(--k-size-sm);
  left: 0;
  z-index: 5;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.k-table__load-more-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 14px;
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: 999px;
  background: var(--k-color-bg-container);
  box-shadow: var(--k-box-shadow);
}
/* 底部粘性表头会占住表格底部，加载指示让到表头上方 */
.k-table.is-sticky.is-header-bottom .k-table__load-more {
  bottom: calc(var(--k-table-head-height, 0px) + var(--k-size-sm));
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
/* 树形：首列内缩进 + 箭头；叶子用占位保持文字左对齐 */
.k-table .k-table__tree {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}
.k-table .k-table__tree-indent {
  flex: none;
  height: 1px;
}
.k-table .k-table__tree-caret {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-inline-end: 4px;
  padding: 0;
  border: none;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: 14px;
  cursor: pointer;
  transition: transform var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-table .k-table__tree-caret:hover {
  color: var(--k-color-primary);
}
.k-table .k-table__tree-caret:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 1px;
}
.k-table .k-table__tree-caret.is-expanded {
  transform: rotate(90deg);
}
.k-table .k-table__tree-caret.is-placeholder {
  visibility: hidden;
}
.k-table .k-table__tree-content {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.k-table .k-table__expanded-row > .k-table__cell {
  background-color: var(--k-table-expanded-bg);
  padding: var(--k-size) var(--k-table-cell-padding-x);
}
/* ---------- 响应式卡片：表头与固定列不参与渲染，每行一张卡片 ---------- */
.k-table.is-stacked .k-table__wrap {
  border: 0;
}
.k-table__cards {
  display: flex;
  flex-direction: column;
  gap: var(--k-size-sm);
}
.k-table__cards-empty {
  padding: var(--k-size-lg) 0;
}
.k-table__card {
  display: flex;
  flex-direction: column;
  gap: var(--k-size-sm);
  padding: var(--k-size);
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background-color: var(--k-color-bg-container);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.k-table__card:hover {
  border-color: var(--k-color-border);
}
.k-table__card.is-selected {
  border-color: var(--k-color-primary);
  box-shadow: inset 0 0 0 1px var(--k-color-primary);
}
.k-table__card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
/* 勾选、展开、标题统一 22px 行高，三者间距一致 */
.k-table__card-select {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 22px;
}
.k-table__card-head .k-table__expand {
  flex: none;
  width: 22px;
  height: 22px;
}
.k-table__card-head .k-table__tree-caret {
  width: 22px;
  height: 22px;
  margin-inline-end: 0;
}
.k-table__card-heading {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.k-table__card-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: var(--k-font-size-lg, 15px);
  font-weight: var(--k-font-weight-heading);
  line-height: 22px;
}
.k-table__card-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm, 12px);
  line-height: 1.4;
}
.k-table__card-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--k-size-sm) var(--k-size);
  padding-top: var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
.k-table__card-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.k-table__card-label {
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm, 12px);
  line-height: 1.4;
}
.k-table__card-value {
  min-width: 0;
  overflow-wrap: break-word;
}
/* 卡片里不做单行截断，全文换行展示 */
.k-table__card .k-table__ellipsis-text {
  display: block;
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
}
.k-table__card .k-table__tree-content {
  overflow: visible;
}
.k-table__card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding-top: var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
.k-table__card-expanded {
  padding-top: var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
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
  background-color: var(--k-table-summary-bg);
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
.k-table__search {
  height: 32px;
  min-width: 200px;
  padding: 0 10px;
  border: 1px solid var(--k-color-border);
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  font-size: var(--k-font-size-sm);
  outline: none;
}
.k-table__search:focus-visible {
  border-color: var(--k-color-primary);
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
.k-table .k-table__cell.is-ellipsis .k-table__ellipsis-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
/* 浮层占位行（含合并组尾展开行）只负责等高：行与单元格都不画底色、分隔线，避免把跨全部列的整行切碎。
   行级透明必须显式写：宿主站点 .vp-doc tr 的条纹背景会盖住下方的整行展开内容 */
.k-table .k-table__fixed-layer .is-overlay-spacer {
  border: 0;
  background: transparent;
  background-image: none;
}
.k-table .k-table__fixed-layer .is-overlay-spacer > .k-table__cell,
.k-table.is-column-borders .k-table__fixed-layer.is-left .is-overlay-spacer > .k-table__cell,
.k-table.is-column-borders .k-table__fixed-layer.is-right .is-overlay-spacer > .k-table__cell {
  padding: 0;
  border: 0;
  background: transparent;
  background-image: none;
}
</style>