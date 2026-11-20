import { afterEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import KTable from '../../components/Table/Table.vue';

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  score: number;
  status?: string;
}

const rows: Row[] = [
  { id: 1, name: 'beta', score: 30, status: 'open' },
  { id: 2, name: 'alpha', score: 10, status: 'closed' },
  { id: 3, name: 'gamma', score: 20, status: 'open' },
];

const columns = [
  { key: 'name', dataIndex: 'name', title: '名称' },
  { key: 'score', dataIndex: 'score', title: '分数' },
];

const wrappers: ReturnType<typeof mount>[] = [];

function mountTable(options: Parameters<typeof mount>[1] = {}) {
  const wrapper = mount(KTable as never, {
    attachTo: document.body,
    ...options,
  });
  wrappers.push(wrapper);
  return wrapper;
}

function mainRows(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.k-table__table > tbody > .k-table__row');
}

function headerCheckbox(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.k-table__table > thead .k-table__cell--selection .k-checkbox');
}

function headerCheckboxInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.k-table__table > thead .k-table__cell--selection input[type="checkbox"]');
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `row-${index + 1}`,
    score: index,
  }));
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  document.body.innerHTML = '';
});

describe('KTable DOM regression', () => {
  test('globalFilter filters rows and renders <mark> only when highlight is enabled', async () => {
    const highlighted = mountTable({
      props: { columns, dataSource: rows, globalFilter: 'al' },
    });
    await nextTick();

    expect(mainRows(highlighted)).toHaveLength(1);
    expect(mainRows(highlighted)[0].attributes('data-row-key')).toBe('2');
    const marks = highlighted.findAll('.k-table__table mark.k-table__mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].text()).toBe('al');

    const plain = mountTable({
      props: { columns, dataSource: rows, globalFilter: 'al', globalFilterHighlight: false },
    });
    await nextTick();

    expect(mainRows(plain)).toHaveLength(1);
    expect(plain.findAll('.k-table__table mark.k-table__mark')).toHaveLength(0);
  });

  test('card mode renders cards and exposes the aggregated filter entry', async () => {
    const wrapper = mountTable({
      props: {
        columns: [
          { key: 'name', dataIndex: 'name', title: '名称' },
          {
            key: 'status',
            dataIndex: 'status',
            title: '状态',
            filters: [
              { label: '开放', value: 'open' },
              { label: '关闭', value: 'closed' },
            ],
          },
        ],
        dataSource: rows,
        stacked: true,
      },
    });
    await nextTick();

    expect(wrapper.find('.k-table__canvas').exists()).toBe(false);
    expect(wrapper.findAll('.k-table__card')).toHaveLength(3);
    expect(wrapper.find('.k-table__toolbar-filter').exists()).toBe(true);
    expect(wrapper.find('.k-table__card-filter').exists()).toBe(false);
  });

  test('card virtual mode only mounts a window of a large card list', async () => {
    const dataSource = makeRows(120);
    const wrapper = mountTable({
      props: {
        columns,
        dataSource,
        stacked: true,
        virtual: true,
        virtualThreshold: 10,
        virtualOverscan: 2,
      },
    });

    await vi.waitFor(() => {
      expect(wrapper.findAll('.k-table__card').length).toBeGreaterThan(0);
    });
    const cardCount = wrapper.findAll('.k-table__card').length;
    expect(cardCount).toBeLessThan(dataSource.length);
    expect(wrapper.find('.k-table__cards-spacer').exists()).toBe(true);
  });

  test('global search input drives filtering and highlighting', async () => {
    const wrapper = mountTable({
      props: { columns, dataSource: rows, searchable: true },
    });
    await nextTick();

    expect(mainRows(wrapper)).toHaveLength(3);
    await wrapper.find('.k-table__search').setValue('gam');
    await nextTick();

    expect(mainRows(wrapper)).toHaveLength(1);
    expect(mainRows(wrapper)[0].attributes('data-row-key')).toBe('3');
    expect(wrapper.find('.k-table__table mark.k-table__mark').text()).toBe('gam');
  });

  test('virtual table mounts a window instead of every row', async () => {
    const dataSource = makeRows(200);
    const wrapper = mountTable({
      props: {
        columns,
        dataSource,
        virtual: true,
        virtualThreshold: 10,
        virtualOverscan: 2,
      },
    });

    await vi.waitFor(() => {
      expect(mainRows(wrapper).length).toBeGreaterThan(0);
    });
    expect(mainRows(wrapper).length).toBeLessThan(dataSource.length);
    expect(wrapper.findAll('.k-table__virtual-spacer').length).toBeGreaterThan(0);
  });

  test('tree rows stay collapsed until the caret expands children', async () => {
    const dataSource = [
      { id: 1, name: 'root', children: [{ id: 11, name: 'child' }] },
      { id: 2, name: 'leaf', children: [] },
    ];
    const wrapper = mountTable({
      props: { columns, dataSource, tree: true },
    });
    await nextTick();

    expect(mainRows(wrapper)).toHaveLength(2);
    const caret = mainRows(wrapper)[0].find('.k-table__tree-caret');
    expect(caret.attributes('aria-expanded')).toBe('false');
    await caret.trigger('click');
    await nextTick();

    expect(mainRows(wrapper)).toHaveLength(3);
    expect(mainRows(wrapper).map(row => row.attributes('data-row-key'))).toEqual(['1', '11', '2']);
    expect(mainRows(wrapper)[0].find('.k-table__tree-caret').attributes('aria-expanded')).toBe('true');
  });

  test('a span crossing fixed regions falls back to sticky cells without overlay layers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = mountTable({
      props: {
        columns: [
          { key: 'name', dataIndex: 'name', title: '名称', width: 120, fixed: 'left' },
          { key: 'score', dataIndex: 'score', title: '分数', width: 120 },
          { key: 'status', dataIndex: 'status', title: '状态', width: 100, fixed: 'right' },
        ],
        dataSource: rows,
        scroll: { x: 600 },
        spanMethod: ({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) =>
          rowIndex === 0 && columnIndex === 0 ? { colSpan: 3 } : undefined,
      },
    });
    await nextTick();

    expect(wrapper.findAll('.k-table__fixed-layer')).toHaveLength(0);
    const firstRowCells = mainRows(wrapper)[0].findAll('td');
    expect(firstRowCells).toHaveLength(1);
    expect(firstRowCells[0].attributes('colspan')).toBe('3');
    expect(warn).toHaveBeenCalled();
  });

  test('selection scope only limits the header toggle, not rendered row checkboxes', async () => {
    const scopeAll = mountTable({
      props: {
        columns,
        dataSource: makeRows(30),
        pagination: {},
        rowSelection: { selectedRowKeys: [20], selectAllScope: 'all' },
      },
    });
    await nextTick();

    expect(headerCheckbox(scopeAll).classes()).toContain('is-indeterminate');
    expect(headerCheckbox(scopeAll).attributes('aria-label')).toBe('全选全部页');

    const input = headerCheckboxInput(scopeAll);
    await input.setValue(true);
    const emitted = scopeAll.emitted('selectionChange') as unknown[][];
    expect(emitted).toHaveLength(1);
    expect(emitted[0][0]).toHaveLength(30);

    const scopePage = mountTable({
      props: {
        columns,
        dataSource: makeRows(30),
        pagination: {},
        rowSelection: { selectedRowKeys: [20], selectAllScope: 'page' },
      },
    });
    await nextTick();

    expect(headerCheckbox(scopePage).classes()).not.toContain('is-indeterminate');
    expect(headerCheckbox(scopePage).classes()).not.toContain('is-checked');
    expect(headerCheckbox(scopePage).attributes('aria-label')).toBe('全选当前页');
  });

  test('pinned rows keep their offset on the row element', async () => {
    const wrapper = mountTable({
      props: {
        columns,
        dataSource: rows,
        sticky: true,
        rowPinning: { top: [1], bottom: [3] },
      },
    });
    await nextTick();

    expect(wrapper.find('.k-table').classes()).toContain('is-sticky');
    const top = wrapper.find('.k-table__table > tbody > .k-table__row.is-pinned-top');
    const bottom = wrapper.find('.k-table__table > tbody > .k-table__row.is-pinned-bottom');
    expect(top.attributes('data-row-key')).toBe('1');
    expect(top.attributes('style')).toContain('top: 0px');
    expect(bottom.attributes('data-row-key')).toBe('3');
    expect(bottom.attributes('style')).toContain('bottom: 0px');
    expect(mainRows(wrapper).map(row => row.attributes('data-row-key'))).toEqual(['1', '2', '3']);
  });

  test('fixed columns build overlay layers and honor fixedLayer part bindings', async () => {
    const wrapper = mountTable({
      props: {
        columns: [
          { key: 'name', dataIndex: 'name', title: '名称', width: 120, fixed: 'left' },
          { key: 'score', dataIndex: 'score', title: '分数', width: 120 },
          { key: 'status', dataIndex: 'status', title: '状态', width: 100, fixed: 'right' },
        ],
        dataSource: rows,
        scroll: { x: 600 },
        classNames: { fixedLayer: 'test-fixed-layer' },
        styles: { fixedLayer: { backgroundColor: 'rgb(1, 2, 3)' } },
      },
    });
    await nextTick();

    const layers = wrapper.findAll('.k-table__fixed-layer');
    expect(layers).toHaveLength(2);
    for (const layer of layers) {
      expect(layer.classes()).toContain('test-fixed-layer');
      expect((layer.element as HTMLElement).style.backgroundColor).toBe('rgb(1, 2, 3)');
    }
    expect(wrapper.findAll('.k-table__fixed-layer.is-left .k-table__cell.is-fixed-left').length).toBeGreaterThan(0);
    expect(wrapper.findAll('.k-table__fixed-layer.is-right .k-table__cell.is-fixed-right').length).toBeGreaterThan(0);
  });

  test('editHeight reserves row height and click enters the cell editor', async () => {
    const wrapper = mountTable({
      props: {
        columns: [
          { key: 'name', dataIndex: 'name', title: '名称', editable: true, editHeight: 64 },
          { key: 'score', dataIndex: 'score', title: '分数' },
        ],
        dataSource: rows,
      },
    });
    await nextTick();

    const root = wrapper.element as HTMLElement;
    expect(root.style.getPropertyValue('--k-table-edit-height')).toBe('64px');

    const firstRow = mainRows(wrapper)[0];
    await firstRow.find('td').trigger('click');
    await nextTick();
    expect(wrapper.find('.k-table__editor').exists()).toBe(true);
  });

  test('summary slot renders a neutral summary footer', async () => {
    const wrapper = mountTable({
      props: { columns, dataSource: rows },
      slots: {
        summary: () => h('span', { class: 'test-summary' }, '合计'),
      },
    });
    await nextTick();

    expect(wrapper.find('.k-table__table tfoot .k-table__summary').exists()).toBe(true);
    expect(wrapper.find('.test-summary').text()).toBe('合计');
  });

  test('empty data renders the empty row instead of body rows', async () => {
    const wrapper = mountTable({
      props: { columns, dataSource: [], emptyText: '没有记录' },
    });
    await nextTick();

    expect(mainRows(wrapper)).toHaveLength(0);
    expect(wrapper.find('.k-table__empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('没有记录');
  });
});