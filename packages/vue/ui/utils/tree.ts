export interface KTreeOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  children?: KTreeOption[];
  [key: string]: unknown;
}

export interface KTreeRow<T extends KTreeOption = KTreeOption> {
  node: T;
  path: (string | number)[];
  key: string;
  level: number;
}

export type KTreePath = (string | number)[];

export function treePathKey(path: KTreePath): string {
  return path.map((part) => `${typeof part}:${String(part)}`).join('\u0001');
}

export function flattenTreeOptions<T extends KTreeOption>(
  nodes: T[],
  parentPath: KTreePath = [],
): KTreeRow<T>[] {
  const rows: KTreeRow<T>[] = [];
  for (const node of nodes) {
    const path = [...parentPath, node.value];
    rows.push({ node, path, key: treePathKey(path), level: path.length - 1 });
    if (node.children?.length) rows.push(...flattenTreeOptions(node.children as T[], path));
  }
  return rows;
}

export function findTreeRowByValue<T extends KTreeOption>(
  nodes: T[],
  value: string | number | null | undefined,
): KTreeRow<T> | null {
  if (value == null) return null;
  return flattenTreeOptions(nodes).find((row) => row.node.value === value) ?? null;
}

export function findTreeRowByPath<T extends KTreeOption>(
  nodes: T[],
  path: KTreePath,
): KTreeRow<T> | null {
  const key = treePathKey(path);
  return flattenTreeOptions(nodes).find((row) => row.key === key) ?? null;
}

export function collectSubtreeValues<T extends KTreeOption>(node: T): (string | number)[] {
  const values: (string | number)[] = [node.value];
  for (const child of node.children ?? []) values.push(...collectSubtreeValues(child as T));
  return values;
}

export function leafRows<T extends KTreeOption>(
  nodes: T[],
  options: { changeOnSelect?: boolean } = {},
): KTreeRow<T>[] {
  return flattenTreeOptions(nodes).filter(
    (row) => options.changeOnSelect || !row.node.children?.length,
  );
}

export function filterTreeOptions<T extends KTreeOption>(
  nodes: T[],
  predicate: (node: T) => boolean,
): T[] {
  const result: T[] = [];
  for (const node of nodes) {
    const children = node.children?.length
      ? filterTreeOptions(node.children as T[], predicate)
      : undefined;
    if (predicate(node) || children?.length) {
      result.push({ ...node, ...(children ? { children } : {}) } as T);
    }
  }
  return result;
}

export function searchTreeRows<T extends KTreeOption>(
  nodes: T[],
  query: string,
  options: { changeOnSelect?: boolean } = {},
): KTreeRow<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return leafRows(nodes, options);
  return flattenTreeOptions(nodes).filter((row) => {
    if (!options.changeOnSelect && row.node.children?.length) return false;
    return row.node.label.toLowerCase().includes(q) || String(row.node.value).toLowerCase().includes(q);
  });
}

/** 级联勾选的父级状态：父节点在子节点全选时选中、部分选中时半选 */
export function treeCheckState<T extends KTreeOption>(
  node: T,
  selected: Set<string | number>,
): { checked: boolean; indeterminate: boolean } {
  if (!node.children?.length) {
    const checked = selected.has(node.value);
    return { checked, indeterminate: false };
  }
  const children = node.children.map((child) => treeCheckState(child as T, selected));
  const checkedCount = children.filter((state) => state.checked).length;
  const checked = checkedCount === children.length;
  return {
    checked,
    indeterminate: !checked && children.some((state) => state.checked || state.indeterminate),
  };
}

export function toggleTreeChecked<T extends KTreeOption>(
  nodes: T[],
  selected: Set<string | number>,
  value: string | number,
  checked: boolean,
  strict = false,
): Set<string | number> {
  const row = findTreeRowByValue(nodes, value);
  if (!row) return selected;
  const next = new Set(selected);
  const affected = strict ? [value] : collectSubtreeValues(row.node);
  for (const item of affected) {
    checked ? next.add(item) : next.delete(item);
  }
  if (!strict) {
    for (let i = row.path.length - 1; i > 0; i -= 1) {
      const parentPath = row.path.slice(0, i);
      const parent = findTreeRowByPath(nodes, parentPath);
      if (!parent) continue;
      const states = (parent.node.children ?? []).map((child) =>
        treeCheckState(child as T, next),
      );
      if (states.every((state) => state.checked)) next.add(parent.node.value);
      else next.delete(parent.node.value);
    }
  }
  return next;
}