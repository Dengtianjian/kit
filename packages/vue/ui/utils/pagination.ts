/** 分页页码序列：两侧各 siblings 个邻页 + 首尾页 + 省略号 */
export type KPageItem = number | 'prev-ellipsis' | 'next-ellipsis';

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

export function buildPageItems(current: number, total: number, siblings = 1): KPageItem[] {
  if (total <= 0) return [];
  if (total <= siblings * 2 + 5) return range(1, total);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, total);
  const showLeft = left > 2;
  const showRight = right < total - 1;
  const edgeCount = 3 + siblings * 2;

  if (!showLeft && showRight) {
    return [...range(1, edgeCount), 'next-ellipsis', total];
  }
  if (showLeft && !showRight) {
    return [1, 'prev-ellipsis', ...range(total - edgeCount + 1, total)];
  }
  return [1, 'prev-ellipsis', ...range(left, right), 'next-ellipsis', total];
}

export function clampPage(current: number, totalPages: number): number {
  return Math.min(Math.max(Math.trunc(current) || 1, 1), Math.max(1, totalPages));
}

export function totalPagesOf(total: number, pageSize: number): number {
  if (!(pageSize > 0)) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}