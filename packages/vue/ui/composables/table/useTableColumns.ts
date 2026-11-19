import { computed } from 'vue';
import {
  buildHeaderRows,
  filterVisibleColumns,
  flattenLeafColumns,
  visibleLeaves,
} from '../../utils/table';
import type { KTableColumn, KTableLeaf } from '../../utils/table';

export interface KTableColumnSetting {
  key: string;
  label: string;
  title: string;
  visible: boolean;
  disabled: boolean;
}

/**
 * 列模型：叶子 key 在整棵树上稳定生成（隐藏列不会让其他列改 key），
 * 可见树负责 colgroup / 表头跨度 / 单元格渲染，全量叶子服务列设置。
 */
export function useTableColumns<T>(
  columns: () => readonly KTableColumn<T>[],
  visibility: () => Record<string, boolean> | undefined,
) {
  const allLeaves = computed(() => flattenLeafColumns(columns()));

  const keyByColumn = computed(() => {
    const map = new Map<KTableColumn<T>, string>();
    for (const leaf of allLeaves.value) map.set(leaf.column, leaf.key);
    return map;
  });
  const keyOfColumn = (column: KTableColumn<T>) => keyByColumn.value.get(column);

  const visibleTree = computed(() =>
    filterVisibleColumns(columns(), visibility() ?? {}, column =>
      column.children?.length ? undefined : keyOfColumn(column),
    ),
  );

  const leaves = computed<KTableLeaf<T>[]>(() =>
    visibleLeaves(visibleTree.value, column => keyOfColumn(column) ?? column.key ?? column.dataIndex ?? ''),
  );

  const headerRows = computed(() => buildHeaderRows(visibleTree.value, keyOfColumn));
  const headerDepth = computed(() => Math.max(1, headerRows.value.length));

  const leafByKey = computed(() => new Map(leaves.value.map(leaf => [leaf.key, leaf])));
  const leafIndexByKey = computed(
    () => new Map(leaves.value.map((leaf, index) => [leaf.key, index])),
  );

  const settings = computed<KTableColumnSetting[]>(() =>
    allLeaves.value.map(leaf => {
      const label = [...leaf.parents, leaf.column.title ?? leaf.key].filter(Boolean).join(' / ');
      return {
        key: leaf.key,
        label,
        title: leaf.column.title ?? leaf.key,
        visible: visibility()?.[leaf.key] ?? !leaf.column.hidden,
        disabled: leaf.column.hideable === false,
      };
    }),
  );

  const visibleCount = computed(() => settings.value.filter(item => item.visible).length);

  return {
    allLeaves,
    leaves,
    visibleTree,
    headerRows,
    headerDepth,
    leafByKey,
    leafIndexByKey,
    settings,
    visibleCount,
    keyOfColumn,
  };
}