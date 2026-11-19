import type { CSSProperties, VNodeChild } from 'vue';

export type KTableAlign = 'left' | 'center' | 'right';
export type KTableSortOrder = 'ascend' | 'descend';
export type KTableRowKey = string | number;

export interface KTableSortState {
  columnKey: string;
  order: KTableSortOrder;
}

export interface KTableFilterOption {
  label: string;
  value: string | number | boolean;
}

export interface KTableCellContext<T> {
  row: T;
  value: unknown;
  index: number;
  column: KTableColumn<T>;
}

export interface KTableColumn<T = Record<string, unknown>> {
  key?: string;
  title?: string;
  dataIndex?: string;
  width?: number | string;
  minWidth?: number | string;
  align?: KTableAlign;
  /** 固定列需要数字 width；同侧固定列必须连续 */
  fixed?: 'left' | 'right';
  sortable?: boolean | ((a: T, b: T) => number);
  filters?: KTableFilterOption[];
  filterMultiple?: boolean;
  filterMethod?: (value: unknown, row: T) => boolean;
  render?: (ctx: KTableCellContext<T>) => VNodeChild;
  /** 分组表头：有 children 的列自己不渲染数据单元格 */
  children?: KTableColumn<T>[];
  /** 静态隐藏（优先于 columnVisibility） */
  hidden?: boolean;
  /** 是否出现在列设置菜单，默认 true */
  hideable?: boolean;
  /** 单元格单行省略 */
  ellipsis?: boolean;
  /** 真实溢出时用 KTooltip 显示全文 */
  ellipsisTooltip?: boolean;
  classNames?: { cell?: string; header?: string };
  styles?: { cell?: CSSProperties; header?: CSSProperties };
}

/** 扁平化后的叶子列：key 在整棵列树上稳定，隐藏列不会让其他列改 key */
export interface KTableLeaf<T = Record<string, unknown>> {
  column: KTableColumn<T>;
  key: string;
  /** 所在分组层数（0 = 顶层） */
  depth: number;
  parents: string[];
}

/** 表头单元格：分组列 colSpan 覆盖叶子数，叶子列 rowSpan 补齐层高 */
export interface KTableHeaderCell<T = Record<string, unknown>> {
  path: string;
  column: KTableColumn<T>;
  isGroup: boolean;
  colSpan: number;
  rowSpan: number;
  leafKey?: string;
}

function leavesOf<T>(columns: readonly KTableColumn<T>[]): number {
  return columns.reduce(
    (total, column) => total + (column.children?.length ? leavesOf(column.children) : 1),
    0,
  );
}

export function columnDepth<T>(columns: readonly KTableColumn<T>[]): number {
  return columns.reduce(
    (depth, column) => Math.max(depth, column.children?.length ? 1 + columnDepth(column.children) : 1),
    0,
  );
}

/** 全量叶子列（含隐藏），key 按原始顺序生成，供受控状态与列设置使用 */
export function flattenLeafColumns<T>(
  columns: readonly KTableColumn<T>[],
  parents: string[] = [],
  depth = 0,
  out: KTableLeaf<T>[] = [],
): KTableLeaf<T>[] {
  for (const column of columns) {
    if (column.children?.length) {
      const nextParents = column.title ? [...parents, column.title] : parents;
      flattenLeafColumns(column.children, nextParents, depth + 1, out);
      continue;
    }
    const index = out.length;
    out.push({
      column,
      key: column.key ?? column.dataIndex ?? `column-${index}`,
      depth,
      parents,
    });
  }
  return out;
}

/** 可见列树：过滤隐藏列、清空空分组；叶子对象保持引用，便于用 Map 反查 key */
export function filterVisibleColumns<T>(
  columns: readonly KTableColumn<T>[],
  visibility: Record<string, boolean>,
  keyOfColumn: (column: KTableColumn<T>) => string | undefined,
): KTableColumn<T>[] {
  const result: KTableColumn<T>[] = [];
  for (const column of columns) {
    const key = keyOfColumn(column);
    /* 显式可见性优先于 hidden：hidden 只是默认值，列设置里可以把默认隐藏的列打开 */
    const override = key ? visibility[key] : undefined;
    if (override !== undefined) {
      if (!override) continue;
    } else if (column.hidden) {
      continue;
    }
    if (column.children?.length) {
      const children = filterVisibleColumns(column.children, visibility, keyOfColumn);
      if (children.length) result.push({ ...column, children });
      continue;
    }
    result.push(column);
  }
  return result;
}

/** 可见列树 → 叶子列（对象仍是原引用） */
export function visibleLeaves<T>(
  columns: readonly KTableColumn<T>[],
  keyOfColumn: (column: KTableColumn<T>) => string,
): KTableLeaf<T>[] {
  const leaves: KTableLeaf<T>[] = [];
  const visit = (list: readonly KTableColumn<T>[], parents: string[], depth: number) => {
    for (const column of list) {
      if (column.children?.length) {
        visit(column.children, column.title ? [...parents, column.title] : parents, depth + 1);
        continue;
      }
      leaves.push({ column, key: keyOfColumn(column), depth, parents });
    }
  };
  visit(columns, [], 0);
  return leaves;
}

export function buildHeaderRows<T>(
  columns: readonly KTableColumn<T>[],
  keyOfColumn: (column: KTableColumn<T>) => string | undefined,
): KTableHeaderCell<T>[][] {
  const depth = columnDepth(columns);
  const rows: KTableHeaderCell<T>[][] = Array.from({ length: depth }, () => []);
  const visit = (list: readonly KTableColumn<T>[], row: number, path: string) => {
    list.forEach((column, index) => {
      const cellPath = `${path}/${index}`;
      if (column.children?.length) {
        rows[row].push({
          path: cellPath,
          column,
          isGroup: true,
          colSpan: leavesOf(column.children),
          rowSpan: 1,
        });
        visit(column.children, row + 1, cellPath);
        return;
      }
      rows[row].push({
        path: cellPath,
        column,
        isGroup: false,
        colSpan: 1,
        rowSpan: depth - row,
        leafKey: keyOfColumn(column),
      });
    });
  };
  visit(columns, 0, '');
  return rows;
}

/** 列设置里是否可切换：分组列不可单独隐藏，显式 hideable=false 的列锁定 */
export function isColumnHideable<T>(column: KTableColumn<T>): boolean {
  return column.hideable !== false && !column.children?.length;
}

export type KTableFilterState = Record<string, (string | number | boolean)[]>;

export function columnKeyOf<T>(column: KTableColumn<T>, index: number): string {
  return column.key ?? column.dataIndex ?? `column-${index}`;
}

export function getCellValue(row: unknown, dataIndex?: string): unknown {
  if (!dataIndex) return undefined;
  return dataIndex.split('.').reduce<unknown>((value, key) => {
    if (value == null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}

export function getRowKey<T>(row: T, rowKey: keyof T | ((row: T, index: number) => KTableRowKey), index: number): KTableRowKey {
  if (typeof rowKey === 'function') return rowKey(row, index);
  return (row as Record<string, unknown>)[rowKey as string] as KTableRowKey;
}

function defaultCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b));
}

export function sortRows<T>(
  rows: readonly T[],
  columns: readonly KTableColumn<T>[],
  sorter: KTableSortState | null,
): T[] {
  if (!sorter) return [...rows];
  const column = columns.find((item, index) => columnKeyOf(item, index) === sorter.columnKey);
  if (!column?.sortable) return [...rows];
  const compare =
    typeof column.sortable === 'function'
      ? column.sortable
      : (a: T, b: T) => defaultCompare(getCellValue(a, column.dataIndex), getCellValue(b, column.dataIndex));
  const factor = sorter.order === 'descend' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compare(a.row, b.row) * factor || a.index - b.index)
    .map((entry) => entry.row);
}

export function filterRows<T>(
  rows: readonly T[],
  columns: readonly KTableColumn<T>[],
  filters: KTableFilterState,
): T[] {
  const active = columns
    .map((column, index) => ({ column, key: columnKeyOf(column, index) }))
    .filter(({ column, key }) => column.filters?.length && filters[key]?.length);
  if (!active.length) return [...rows];
  return rows.filter((row) =>
    active.every(({ column, key }) => {
      const values = filters[key]!;
      const value = getCellValue(row, column.dataIndex);
      if (column.filterMethod) return values.some((item) => column.filterMethod!(item, row));
      return values.some((item) => item === value);
    }),
  );
}

export function paginateRows<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  if (!(pageSize > 0)) return [...rows];
  const start = (Math.max(1, page) - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

/** 固定列偏移（px）：仅统计 numeric width 的同侧列；同侧列需连续 */
export function computeFixedOffsets<T>(
  columns: readonly KTableColumn<T>[],
  side: 'left' | 'right',
  keyOf: (column: KTableColumn<T>, index: number) => string = columnKeyOf,
): Record<string, number> {
  const result: Record<string, number> = {};
  const fixed = columns
    .map((column, index) => ({ column, key: keyOf(column, index) }))
    .filter(({ column }) => column.fixed === side);
  if (side === 'left') {
    let offset = 0;
    for (const { column, key } of fixed) {
      result[key] = offset;
      offset += Number(column.width) || 0;
    }
  } else {
    let offset = 0;
    for (const { column, key } of [...fixed].reverse()) {
      result[key] = offset;
      offset += Number(column.width) || 0;
    }
  }
  return result;
}

export function widthStyle(width: number | string | undefined): string | undefined {
  if (width == null) return undefined;
  return typeof width === 'number' ? `${width}px` : width;
}

/**
 * 按比例把列宽分配为整数像素且总和精确等于 total。
 * 粘性固定列用小数宽度会在滚动时按设备像素重新取整，产生 1px 抖动；
 * 最大余数法保证整数化后总宽不变、列之间不留缝。
 */
export function distributeIntegerWidths(
  widths: Record<string, number>,
  total: number,
): Record<string, number> {
  const keys = Object.keys(widths);
  const result: Record<string, number> = {};
  if (!keys.length) return result;

  const sum = keys.reduce((acc, key) => acc + Math.max(0, widths[key] || 0), 0);
  const budget = Math.max(keys.length, Math.round(total));
  const scaled = keys.map(key => {
    const ratio = sum > 0 ? (Math.max(0, widths[key] || 0) * budget) / sum : budget / keys.length;
    return { key, ratio };
  });
  const floors = scaled.map(item => Math.floor(item.ratio));
  const rest = budget - floors.reduce((acc, value) => acc + value, 0);
  const order = scaled
    .map((item, index) => ({ index, fraction: item.ratio - Math.floor(item.ratio) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let offset = 0; offset < rest; offset++) floors[order[offset % order.length].index] += 1;

  scaled.forEach((item, index) => {
    result[item.key] = Math.max(1, floors[index]);
  });
  const delta = budget - Object.values(result).reduce((acc, value) => acc + value, 0);
  if (delta !== 0) {
    const widest = keys.reduce((acc, key) => (result[key] > result[acc] ? key : acc), keys[0]);
    result[widest] = Math.max(1, result[widest] + delta);
  }
  return result;
}