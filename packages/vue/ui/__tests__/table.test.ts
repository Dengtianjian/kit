import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeaderRows,
  columnKeyOf,
  computeFixedOffsets,
  distributeIntegerWidths,
  filterRows,
  filterVisibleColumns,
  flattenLeafColumns,
  getCellValue,
  getRowKey,
  paginateRows,
  sortRows,
} from '../utils/table.ts';
import type { KTableColumn } from '../utils/table.ts';
import { buildPageItems, clampPage, totalPagesOf } from '../utils/pagination.ts';
import { getVirtualRange } from '../utils/virtual.ts';

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  score: number;
  team?: { title: string };
}

const rows: Row[] = [
  { id: 1, name: 'beta', score: 30, team: { title: 'B' } },
  { id: 2, name: 'alpha', score: 10, team: { title: 'A' } },
  { id: 3, name: 'gamma', score: 20, team: { title: 'C' } },
];

const columns: KTableColumn<Row>[] = [
  { key: 'name', dataIndex: 'name', title: '名称' },
  { key: 'score', dataIndex: 'score', title: '分数', sortable: true },
  {
    key: 'team',
    dataIndex: 'team.title',
    title: '团队',
    filters: [
      { label: 'A', value: 'A' },
      { label: 'C', value: 'C' },
    ],
  },
];

test('cell values and keys resolve nested paths', () => {
  assert.equal(getCellValue(rows[0], 'team.title'), 'B');
  assert.equal(getCellValue(rows[0], 'missing.path'), undefined);
  assert.equal(getRowKey(rows[0], 'id', 0), 1);
  assert.equal(getRowKey(rows[0], () => 'custom', 0), 'custom');
  assert.equal(columnKeyOf({ dataIndex: 'name' }, 0), 'name');
  assert.equal(columnKeyOf({}, 2), 'column-2');
});

test('sortRows handles ascend/descend and stays stable', () => {
  const asc = sortRows(rows, columns, { columnKey: 'score', order: 'ascend' });
  assert.deepEqual(asc.map((row) => row.score), [10, 20, 30]);
  const desc = sortRows(rows, columns, { columnKey: 'score', order: 'descend' });
  assert.deepEqual(desc.map((row) => row.score), [30, 20, 10]);
  assert.deepEqual(sortRows(rows, columns, null).map((row) => row.id), [1, 2, 3]);
  const tied = sortRows(
    [{ id: 1, name: 'a', score: 10 }, { id: 2, name: 'b', score: 10 }, { id: 3, name: 'c', score: 5 }] as Row[],
    columns,
    { columnKey: 'score', order: 'ascend' },
  );
  assert.deepEqual(tied.map((row) => row.id), [3, 1, 2]);
});

test('sortRows supports custom comparator and ignores unsortable columns', () => {
  const custom: KTableColumn<Row>[] = [
    { key: 'name', dataIndex: 'name', sortable: (a, b) => a.name.length - b.name.length },
  ];
  const sorted = sortRows(rows, custom, { columnKey: 'name', order: 'ascend' });
  assert.deepEqual(sorted.map((row) => row.name), ['beta', 'alpha', 'gamma']);
  assert.deepEqual(sortRows(rows, columns, { columnKey: 'name', order: 'ascend' }), rows);
});

test('filterRows matches values and custom filter methods', () => {
  const filtered = filterRows(rows, columns, { team: ['A', 'C'] });
  assert.deepEqual(filtered.map((row) => row.id), [2, 3]);
  assert.equal(filterRows(rows, columns, {}).length, 3);
  const hasMethod: KTableColumn<Row>[] = [
    {
      key: 'score',
      dataIndex: 'score',
      filters: [{ label: '>15', value: 15 }],
      filterMethod: (value, row) => (row.score as number) > (value as number),
    },
  ];
  assert.deepEqual(filterRows(rows, hasMethod, { score: [15] }).map((row) => row.id), [1, 3]);
});

test('paginateRows slices from one-based pages', () => {
  assert.deepEqual(paginateRows(rows, 1, 2).map((row) => row.id), [1, 2]);
  assert.deepEqual(paginateRows(rows, 2, 2).map((row) => row.id), [3]);
  assert.equal(paginateRows(rows, 3, 2).length, 0);
  assert.equal(paginateRows(rows, 1, 0).length, 3);
});

test('fixed offsets accumulate numeric widths per side', () => {
  const fixed: KTableColumn<Row>[] = [
    { key: 'a', width: 100, fixed: 'left' },
    { key: 'b', width: 80 },
    { key: 'c', width: 60, fixed: 'left' },
    { key: 'd', width: 70, fixed: 'right' },
    { key: 'e', width: 50, fixed: 'right' },
  ];
  assert.deepEqual(computeFixedOffsets(fixed, 'left'), { a: 0, c: 100 });
  assert.deepEqual(computeFixedOffsets(fixed, 'right'), { e: 0, d: 50 });
});

test('grouped columns flatten leaves with stable keys and parent titles', () => {
  const grouped: KTableColumn<Row>[] = [
    { key: 'name', dataIndex: 'name', title: '名称' },
    {
      key: 'meta',
      title: '评分',
      children: [
        { key: 'score', dataIndex: 'score', title: '分数' },
        { key: 'team', dataIndex: 'team.title', title: '团队' },
      ],
    },
  ];
  const leaves = flattenLeafColumns(grouped);
  assert.deepEqual(leaves.map((leaf) => leaf.key), ['name', 'score', 'team']);
  assert.equal(leaves[1].depth, 1);
  assert.deepEqual(leaves[1].parents, ['评分']);
  assert.equal(leaves[0].column, grouped[0]);
});

test('visibility filter drops hidden leaves and empty groups', () => {
  const grouped: KTableColumn<Row>[] = [
    { key: 'name', dataIndex: 'name', title: '名称' },
    {
      key: 'meta',
      title: '评分',
      children: [
        { key: 'score', dataIndex: 'score', title: '分数' },
        { key: 'team', dataIndex: 'team.title', title: '团队', hidden: true },
      ],
    },
  ];
  const keyOf = (column: KTableColumn<Row>) => column.key;
  const visible = filterVisibleColumns(grouped, { score: false }, keyOf);
  assert.deepEqual(visible.map((column) => column.key), ['name']);

  const allHidden = filterVisibleColumns(grouped, { score: false, team: false }, keyOf);
  assert.deepEqual(allHidden.map((column) => column.key), ['name']);

  const noMeta = filterVisibleColumns(grouped, {}, keyOf);
  assert.equal(noMeta[1].children?.length, 1);

  // 显式可见性优先于 hidden：默认隐藏的列可以在列设置里重新打开
  const reopened = filterVisibleColumns(grouped, { team: true }, keyOf);
  assert.deepEqual(reopened[1].children?.map((column) => column.key), ['score', 'team']);
});

test('header rows span grouped leaves and restate leaf keys', () => {
  const grouped: KTableColumn<Row>[] = [
    { key: 'name', dataIndex: 'name', title: '名称' },
    {
      key: 'meta',
      title: '评分',
      children: [
        { key: 'score', dataIndex: 'score', title: '分数' },
        { key: 'team', dataIndex: 'team.title', title: '团队' },
      ],
    },
  ];
  const rows = buildHeaderRows(grouped, (column) => column.key);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows[0].map((cell) => ({ group: cell.isGroup, span: cell.colSpan, rowSpan: cell.rowSpan })),
    [
      { group: false, span: 1, rowSpan: 2 },
      { group: true, span: 2, rowSpan: 1 },
    ],
  );
  assert.deepEqual(rows[1].map((cell) => cell.leafKey), ['score', 'team']);
});

test('fixed offsets accept a stable key resolver', () => {
  const fixed: KTableColumn<Row>[] = [
    { key: 'a', width: 100, fixed: 'left' },
    { key: 'b', width: 80, fixed: 'left' },
    { key: 'c', width: 60, fixed: 'right' },
  ];
  assert.deepEqual(
    computeFixedOffsets(fixed, 'left', (column) => `leaf:${column.key}`),
    { 'leaf:a': 0, 'leaf:b': 100 },
  );
  assert.deepEqual(
    computeFixedOffsets(fixed, 'right', (column) => `leaf:${column.key}`),
    { 'leaf:c': 0 },
  );
});

test('pagination items stay within bounds with ellipsis', () => {
  assert.deepEqual(buildPageItems(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(buildPageItems(1, 20), [1, 2, 3, 4, 5, 'next-ellipsis', 20]);
  assert.deepEqual(buildPageItems(10, 20), [1, 'prev-ellipsis', 9, 10, 11, 'next-ellipsis', 20]);
  assert.deepEqual(buildPageItems(20, 20), [1, 'prev-ellipsis', 16, 17, 18, 19, 20]);
  assert.equal(clampPage(0, 5), 1);
  assert.equal(clampPage(9, 5), 5);
  assert.equal(totalPagesOf(0, 10), 1);
  assert.equal(totalPagesOf(21, 10), 3);
});

test('virtual range covers viewport with overscan', () => {
  assert.deepEqual(getVirtualRange(0, 300, 50, 1000, 2), {
    start: 0,
    end: 8,
    totalHeight: 50000,
    offsetTop: 0,
  });
  const mid = getVirtualRange(5000, 300, 50, 1000, 2);
  assert.equal(mid.start, 98);
  assert.equal(mid.end, 108);
  assert.equal(mid.offsetTop, 4900);
  assert.deepEqual(getVirtualRange(0, 300, 0, 10), { start: 0, end: 0, totalHeight: 0, offsetTop: 0 });
});

test('distributeIntegerWidths keeps integer widths summing exactly to the target', () => {
  const widths = { name: 166.66, team: 124.98, role: 145.83, email: 229.16, city: 124.98, score: 104.16, status: 104.23 };
  const result = distributeIntegerWidths(widths, 1000);
  const values = Object.values(result);
  assert.equal(values.reduce((sum, value) => sum + value, 0), 1000);
  assert.ok(values.every(value => Number.isInteger(value) && value > 0));
  assert.ok(Math.abs(result.name - 166.66) <= 1);
  assert.ok(Math.abs(result.email - 229.16) <= 1);
});

test('distributeIntegerWidths splits equally when no usable widths are given', () => {
  const result = distributeIntegerWidths({ a: 0, b: 0, c: 0 }, 100);
  assert.deepEqual(result, { a: 34, b: 33, c: 33 });
  assert.equal(Object.values(distributeIntegerWidths({ a: 0 }, 0)).reduce((sum, v) => sum + v, 0), 1);
});