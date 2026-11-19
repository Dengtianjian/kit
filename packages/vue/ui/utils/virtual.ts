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