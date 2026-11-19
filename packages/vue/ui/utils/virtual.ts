/** 固定行高虚拟窗口：返回渲染区间与占位高度 */
export interface KVirtualRange {
  start: number;
  end: number;
  totalHeight: number;
  offsetTop: number;
}

export function getVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  count: number,
  overscan = 4,
): KVirtualRange {
  if (count <= 0 || !(itemHeight > 0)) {
    return { start: 0, end: 0, totalHeight: 0, offsetTop: 0 };
  }
  const first = Math.floor(Math.max(0, scrollTop) / itemHeight);
  const last = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / itemHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + overscan);
  return {
    start,
    end,
    totalHeight: count * itemHeight,
    offsetTop: start * itemHeight,
  };
}

/** 变量行高前缀和：未测量行用 estimate 估算，offsets[count] 即总高 */
export function buildVirtualOffsets(
  heights: readonly (number | undefined)[],
  count: number,
  estimate: number,
): { offsets: number[]; total: number } {
  const step = estimate > 0 ? estimate : 1;
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let index = 0; index < count; index++) {
    const height = heights[index];
    offsets[index + 1] = offsets[index] + (typeof height === 'number' && height > 0 ? height : step);
  }
  return { offsets, total: offsets[count] };
}

/** 二分：offset 落在第几行（0..count-1） */
export function findRowAtOffset(offsets: readonly number[], offset: number): number {
  const count = Math.max(0, offsets.length - 1);
  if (count <= 0) return 0;
  const target = Math.max(0, offset);
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= target) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** 变量行高窗口：按前缀和二分出可视行，再向两侧扩 overscan 行 */
export function getVariableVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  offsets: readonly number[],
  overscan = 6,
): KVirtualRange {
  const count = Math.max(0, offsets.length - 1);
  if (count <= 0) return { start: 0, end: 0, totalHeight: 0, offsetTop: 0 };
  const top = Math.max(0, scrollTop);
  const bottom = top + Math.max(0, viewportHeight);
  const first = findRowAtOffset(offsets, top);
  let low = first + 1;
  let high = count;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] >= bottom) high = mid;
    else low = mid + 1;
  }
  const last = Math.max(first + 1, low);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + overscan);
  return { start, end, totalHeight: offsets[count], offsetTop: offsets[start] };
}

/** 窗口两端扩张到覆盖所有相交的合并格：rowOrigin 为合并起点行，rowCoverEnd 为覆盖末行 */
export function expandRangeForSpans(
  start: number,
  end: number,
  rowOrigin: readonly number[],
  rowCoverEnd: readonly number[],
  count: number,
): { start: number; end: number } {
  let rangeStart = Math.max(0, start);
  let rangeEnd = Math.min(count, Math.max(rangeStart, end));
  let changed = true;
  let guard = 0;
  while (changed && guard++ <= count) {
    changed = false;
    for (let index = rangeStart; index < rangeEnd; index++) {
      const origin = rowOrigin[index];
      if (origin != null && origin < rangeStart) {
        rangeStart = Math.max(0, origin);
        changed = true;
      }
      const coverEnd = rowCoverEnd[index];
      if (coverEnd != null && coverEnd + 1 > rangeEnd) {
        rangeEnd = Math.min(count, coverEnd + 1);
        changed = true;
      }
    }
  }
  return { start: rangeStart, end: rangeEnd };
}