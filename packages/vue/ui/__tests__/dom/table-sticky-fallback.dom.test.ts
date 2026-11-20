import { afterEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const rows = [
  { id: 1, name: 'beta', score: 30 },
  { id: 2, name: 'alpha', score: 10 },
];
const columns = [
  { key: 'name', dataIndex: 'name', title: '名称' },
  { key: 'score', dataIndex: 'score', title: '分数' },
];

const originalRect = Element.prototype.getBoundingClientRect;

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  document.body.innerHTML = '';
});

function rect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    bottom: top,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

async function mountFresh() {
  vi.resetModules();
  const { default: KTable } = await import('../../components/Table/Table.vue');
  const wrapper = mount(KTable as never, {
    attachTo: document.body,
    props: {
      columns,
      dataSource: rows,
      sticky: true,
      rowPinning: { top: [1] },
    },
  });
  await nextTick();
  await nextTick();
  return wrapper;
}

describe('KTable sticky mode detection', () => {
  test('enables block sticky when thead/tr sticky survives scrolling', async () => {
    Element.prototype.getBoundingClientRect = () => rect(0);
    const wrapper = await mountFresh();

    const root = wrapper.find('.k-table');
    expect(root.classes()).toContain('is-sticky');
    expect(root.classes()).toContain('is-sticky-block');

    const topRow = wrapper.find('.k-table__table > tbody > .k-table__row.is-pinned-top');
    expect(topRow.attributes('style')).toContain('top: 0px');
    wrapper.unmount();
  });

  test('keeps per-cell sticky when thead/tr sticky is not supported', async () => {
    Element.prototype.getBoundingClientRect = function () {
      return rect(this instanceof HTMLTableRowElement || this instanceof HTMLTableCellElement ? 40 : 0);
    };

    const wrapper = await mountFresh();
    const root = wrapper.find('.k-table');
    expect(root.classes()).toContain('is-sticky');
    expect(root.classes()).not.toContain('is-sticky-block');

    const topRow = wrapper.find('.k-table__table > tbody > .k-table__row.is-pinned-top');
    expect(topRow.attributes('style')).toContain('top: 0px');
    expect(topRow.find('.k-table__cell').attributes('style')).toContain('top: 0px');
    wrapper.unmount();
  });
});