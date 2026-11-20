import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectSubtreeValues,
  filterTreeOptions,
  findTreeRowByValue,
  flattenTreeOptions,
  leafRows,
  searchTreeRows,
  toggleTreeChecked,
  treeCheckState,
  treePathKey,
} from '../utils/tree.ts';
import type { KTreeOption } from '../utils/tree.ts';

const options: KTreeOption[] = [
  {
    label: '华东',
    value: 'east',
    children: [
      { label: '上海', value: 'shanghai' },
      { label: '杭州', value: 'hangzhou', disabled: true },
      { label: '南京', value: 'nanjing' },
    ],
  },
  {
    label: '华南',
    value: 'south',
    children: [{ label: '深圳', value: 'shenzhen' }],
  },
];

test('tree flatten keeps paths and levels', () => {
  const rows = flattenTreeOptions(options);
  assert.deepEqual(rows.map((row) => row.key), [
    treePathKey(['east']),
    treePathKey(['east', 'shanghai']),
    treePathKey(['east', 'hangzhou']),
    treePathKey(['east', 'nanjing']),
    treePathKey(['south']),
    treePathKey(['south', 'shenzhen']),
  ]);
  assert.equal(findTreeRowByValue(options, 'nanjing')?.level, 1);
  assert.deepEqual(findTreeRowByValue(options, 'east')?.path, ['east']);
});

test('leaf rows and search exclude parents', () => {
  assert.deepEqual(leafRows(options).map((row) => row.node.value), [
    'shanghai',
    'hangzhou',
    'nanjing',
    'shenzhen',
  ]);
  assert.deepEqual(searchTreeRows(options, '南').map((row) => row.node.value), ['nanjing']);
  assert.deepEqual(searchTreeRows(options, '华').map((row) => row.node.value), []);
});

test('filterTreeOptions keeps matching nodes and ancestors', () => {
  const filtered = filterTreeOptions(options, (node) => node.label.includes('深'));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].value, 'south');
  assert.deepEqual(filtered[0].children?.map((node) => node.value), ['shenzhen']);
});

test('cascade checking updates descendants and parent state', () => {
  const values = collectSubtreeValues(options[0]);
  assert.deepEqual(values, ['east', 'shanghai', 'hangzhou', 'nanjing']);
  const checked = toggleTreeChecked(options, new Set(), 'east', true);
  assert.deepEqual([...checked].sort(), ['east', 'hangzhou', 'nanjing', 'shanghai']);
  assert.deepEqual(treeCheckState(options[0], checked), { checked: true, indeterminate: false });
  const partial = toggleTreeChecked(options, checked, 'shanghai', false);
  assert.equal(partial.has('east'), false);
  assert.deepEqual(treeCheckState(options[0], partial), { checked: false, indeterminate: true });
});