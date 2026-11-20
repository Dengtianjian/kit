import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kDayjs,
  parsePicker,
  formatPicker,
  commitLevel,
  levelPicker,
  buildRows,
} from '../utils/date.ts';

test('parsePicker accepts only strict formatted dates', () => {
  const ok = parsePicker('2026-11-19', ['YYYY-MM-DD']);
  assert.equal(ok?.format('YYYY-MM-DD'), '2026-11-19');
  assert.equal(parsePicker('2026-02-30', ['YYYY-MM-DD']), null);
  assert.equal(parsePicker('2026/11/19', ['YYYY-MM-DD']), null);
  assert.equal(parsePicker('  ', ['YYYY-MM-DD']), null);
});

test('week format uses weekYear across year boundary', () => {
  const d = kDayjs('2027-01-01');
  assert.match(formatPicker(d, 'week'), /^2026-53/);
});

test('commitLevel and levelPicker map modes to panel layers', () => {
  assert.equal(commitLevel('date'), 'date');
  assert.equal(commitLevel('week'), 'date');
  assert.equal(commitLevel('month'), 'month');
  assert.equal(commitLevel('quarter'), 'month');
  assert.equal(commitLevel('year'), 'year');
  assert.equal(levelPicker('month', 'quarter'), 'quarter');
  assert.equal(levelPicker('month', 'date'), 'month');
  assert.equal(levelPicker('year', 'date'), 'year');
});

test('buildRows shapes follow panel level', () => {
  const view = kDayjs('2026-11-19');
  const ctx = { value: null, disabled: () => false };
  assert.equal(buildRows(view, 'date', 'date', ctx).length, 6);
  assert.equal(buildRows(view, 'date', 'date', ctx)[0].length, 7);
  assert.equal(buildRows(view, 'month', 'quarter', ctx).length, 1);
  assert.equal(buildRows(view, 'month', 'quarter', ctx)[0].length, 4);
  assert.equal(buildRows(view, 'month', 'month', ctx).length, 4);
  assert.equal(buildRows(view, 'month', 'month', ctx)[0].length, 3);
  assert.equal(buildRows(view, 'year', 'year', ctx).length, 4);
  assert.equal(buildRows(view, 'year', 'year', ctx)[0].length, 3);
});

test('date layer includes month padding and marks today', () => {
  const view = kDayjs('2026-11-19');
  const rows = buildRows(view, 'date', 'date', { value: null, disabled: () => false });
  const cells = rows.flat();
  assert.equal(cells.length, 42);
  assert.ok(cells.some((c) => !c.inView));
  const today = cells.find((c) => c.today);
  assert.ok(today);
  assert.equal(today!.label, String(kDayjs().date()));
});

test('disabled callback applies at panel granularity', () => {
  const view = kDayjs('2026-11-19');
  const rows = buildRows(view, 'month', 'month', {
    value: null,
    disabled: (d) => d.month() === 10,
  });
  const nov = rows.flat().find((c) => c.label === '11月');
  assert.equal(nov?.disabled, true);
});