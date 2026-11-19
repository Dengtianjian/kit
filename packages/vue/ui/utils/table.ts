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

/** 单元格合并：返回 rowSpan / colSpan，缺省按 1 处理 */
export interface KTableCellSpan {
  rowSpan?: number;
  colSpan?: number;
}

export interface KTableSpanContext<T = Record<string, unknown>> {
  row: T;
  /** 当前页展示序（排序/筛选后，从 0 开始） */
  rowIndex: number;
  column: KTableColumn<T>;
  /** 可见叶子列序号，不含展开/选择列 */
  columnIndex: number;
}

export type KTableSpanMethod<T = Record<string, unknown>> = (
  context: KTableSpanContext<T>,
) => KTableCellSpan | undefined;

export interface KTableSpanCell {
  rowSpan: number;
  colSpan: number;
}

export interface KTableSpanPlan {
  /** 合并起点：rowKey\0leafKey */
  cells: Map<string, KTableSpanCell>;
  /** 被覆盖、不再渲染的单元格：rowKey\0leafKey */
  covered: Set<string>;
  hasRowSpan: boolean;
  /** 合并跨了左右固定区与中区：浮层无法承载，需要退回粘性单元格 */
  crossesFixedRegion: boolean;
  /** 每行所属合并格的起始行（无合并时为自身下标），供虚拟窗口上探 */
  rowOrigin: number[];
  /** 每行所在合并格的覆盖末行（无合并时为自身下标），供虚拟窗口下探 */
  rowCoverEnd: number[];
}

export function spanCellKey(rowKey: string | number, leafKey: string): string {
  return `${rowKey}\u0000${leafKey}`;
}

function spanLimit(value: unknown): number {
  const number = Math.floor(Number(value ?? 1));
  return Number.isFinite(number) && number > 0 ? number : 1;
}

/** 合并计划：从覆盖率网格推导起点与跳过集合，跨区只标记不截断（交给粘性回退） */
export function buildSpanPlan<T>(options: {
  rows: readonly T[];
  leaves: readonly KTableLeaf<T>[];
  keyOfRow: (row: T, index: number) => string | number;
  spanMethod?: KTableSpanMethod<T>;
}): KTableSpanPlan {
  const plan: KTableSpanPlan = {
    cells: new Map(),
    covered: new Set(),
    hasRowSpan: false,
    crossesFixedRegion: false,
    rowOrigin: [],
    rowCoverEnd: [],
  };
  const { rows, leaves, keyOfRow, spanMethod } = options;
  plan.rowOrigin = rows.map((_, index) => index);
  plan.rowCoverEnd = rows.map((_, index) => index);
  if (!spanMethod || !rows.length || !leaves.length) return plan;
  const occupied = rows.map(() => new Array<boolean>(leaves.length).fill(false));
  const rowKeys = rows.map((row, index) => keyOfRow(row, index));
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowKey = rowKeys[rowIndex];
    for (let columnIndex = 0; columnIndex < leaves.length; columnIndex++) {
      if (occupied[rowIndex][columnIndex]) continue;
      const leaf = leaves[columnIndex];
      const requested = spanMethod({ row, rowIndex, column: leaf.column, columnIndex });
      let rowSpan = Math.min(spanLimit(requested?.rowSpan), rows.length - rowIndex);
      let colSpan = Math.min(spanLimit(requested?.colSpan), leaves.length - columnIndex);
      /* 不能压到已合并的单元格：逐格收缩到空位 */
      while (colSpan > 1) {
        let free = true;
        for (let offset = 1; offset < colSpan; offset++) {
          if (occupied[rowIndex][columnIndex + offset]) {
            free = false;
            break;
          }
        }
        if (free) break;
        colSpan--;
      }
      while (rowSpan > 1) {
        let free = true;
        for (let rowOffset = 1; rowOffset < rowSpan && free; rowOffset++) {
          for (let offset = 0; offset < colSpan; offset++) {
            if (occupied[rowIndex + rowOffset][columnIndex + offset]) {
              free = false;
              break;
            }
          }
        }
        if (free) break;
        rowSpan--;
      }
      if (colSpan > 1) {
        const region = leaf.column.fixed ?? 'center';
        for (let offset = 1; offset < colSpan; offset++) {
          if ((leaves[columnIndex + offset].column.fixed ?? 'center') !== region) {
            plan.crossesFixedRegion = true;
            break;
          }
        }
      }
      if (rowSpan > 1) plan.hasRowSpan = true;
      if (rowSpan > 1 || colSpan > 1) {
        plan.cells.set(spanCellKey(rowKey, leaf.key), { rowSpan, colSpan });
      }
      if (rowSpan > 1) {
        const coverEnd = rowIndex + rowSpan - 1;
        for (let rowOffset = rowIndex; rowOffset <= coverEnd; rowOffset++) {
          if (rowIndex < plan.rowOrigin[rowOffset]) plan.rowOrigin[rowOffset] = rowIndex;
          if (coverEnd > plan.rowCoverEnd[rowOffset]) plan.rowCoverEnd[rowOffset] = coverEnd;
        }
      }
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset++) {
        for (let offset = 0; offset < colSpan; offset++) {
          occupied[rowIndex + rowOffset][columnIndex + offset] = true;
          if (rowOffset > 0 || offset > 0) {
            plan.covered.add(spanCellKey(rowKeys[rowIndex + rowOffset], leaves[columnIndex + offset].key));
          }
        }
      }
    }
  }
  return plan;
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

/** 排序状态 → 行比较函数；列不可排序时返回 null */
export function createRowComparator<T>(
  columns: readonly KTableColumn<T>[],
  sorter: KTableSortState | null | undefined,
): ((a: T, b: T) => number) | null {
  if (!sorter) return null;
  const column = columns.find((item, index) => columnKeyOf(item, index) === sorter.columnKey);
  if (!column?.sortable) return null;
  const compare =
    typeof column.sortable === 'function'
      ? column.sortable
      : (a: T, b: T) => defaultCompare(getCellValue(a, column.dataIndex), getCellValue(b, column.dataIndex));
  const factor = sorter.order === 'descend' ? -1 : 1;
  return (a, b) => compare(a, b) * factor;
}

export function sortRows<T>(
  rows: readonly T[],
  columns: readonly KTableColumn<T>[],
  sorter: KTableSortState | null,
): T[] {
  const compare = createRowComparator(columns, sorter);
  if (!compare) return [...rows];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compare(a.row, b.row) || a.index - b.index)
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

/* ---------- 树形数据：构建 / 筛选 / 排序 / 扁平化 ---------- */
export interface KTableTreeOptions<T> {
  /** 子节点字段名，默认 children */
  childrenKey?: string;
  /** 每层缩进像素，默认 16 */
  indent?: number;
}

export interface KTableTreeNode<T> {
  row: T;
  key: KTableRowKey;
  children: KTableTreeNode<T>[];
}

export interface KTableTreeFlatRow<T> {
  row: T;
  key: KTableRowKey;
  /** 层级，0 为顶层 */
  depth: number;
  hasChildren: boolean;
}

function childrenOfRow<T>(row: T, childrenKey: string): T[] {
  const children = (row as Record<string, unknown>)[childrenKey];
  return Array.isArray(children) ? (children as T[]) : [];
}

/** 原始数据 → 树节点（保留行对象引用，供筛选/排序/固定行按引用比较） */
export function buildTreeNodes<T>(
  rows: readonly T[],
  childrenKey: string,
  keyOf: (row: T) => KTableRowKey,
): KTableTreeNode<T>[] {
  return rows.map(row => ({
    row,
    key: keyOf(row),
    children: buildTreeNodes(childrenOfRow(row, childrenKey), childrenKey, keyOf),
  }));
}

/**
 * 树内筛选：命中节点及其祖先保留，祖先 key 写入 forcedExpanded；
 * 未命中的子树整体剪掉。不命中的祖先即使自身命中后代也不会被剪掉。
 */
export function filterTreeNodes<T>(
  nodes: readonly KTableTreeNode<T>[],
  matches: (row: T) => boolean,
): { nodes: KTableTreeNode<T>[]; forcedExpanded: Set<KTableRowKey> } {
  const forcedExpanded = new Set<KTableRowKey>();
  const visit = (node: KTableTreeNode<T>): KTableTreeNode<T> | null => {
    const children = node.children
      .map(visit)
      .filter((child): child is KTableTreeNode<T> => child != null);
    const self = matches(node.row);
    if (!self && !children.length) return null;
    if (children.length) forcedExpanded.add(node.key);
    const untouched =
      children.length === node.children.length &&
      children.every((child, index) => child === node.children[index]);
    return untouched ? node : { ...node, children };
  };
  return {
    nodes: nodes.map(visit).filter((node): node is KTableTreeNode<T> => node != null),
    forcedExpanded,
  };
}

/** 同级排序：每层内部按比较函数稳定排序，子树跟随移动 */
export function sortTreeNodes<T>(
  nodes: readonly KTableTreeNode<T>[],
  compare: (a: T, b: T) => number,
): KTableTreeNode<T>[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => compare(a.node.row, b.node.row) || a.index - b.index)
    .map(({ node }) =>
      node.children.length ? { ...node, children: sortTreeNodes(node.children, compare) } : node,
    );
}

/** 按展开状态深度优先摊平；isExpanded 同时接收“筛选命中的祖先” */
export function flattenTreeNodes<T>(
  nodes: readonly KTableTreeNode<T>[],
  isExpanded: (key: KTableRowKey) => boolean,
  depth = 0,
  out: KTableTreeFlatRow<T>[] = [],
): KTableTreeFlatRow<T>[] {
  for (const node of nodes) {
    out.push({ row: node.row, key: node.key, depth, hasChildren: node.children.length > 0 });
    if (node.children.length && isExpanded(node.key)) {
      flattenTreeNodes(node.children, isExpanded, depth + 1, out);
    }
  }
  return out;
}

/** 深度优先收集所有含子节点的 key（defaultExpandAll） */
export function collectTreeExpandableKeys<T>(
  nodes: readonly KTableTreeNode<T>[],
  out: KTableRowKey[] = [],
): KTableRowKey[] {
  for (const node of nodes) {
    if (node.children.length) {
      out.push(node.key);
      collectTreeExpandableKeys(node.children, out);
    }
  }
  return out;
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