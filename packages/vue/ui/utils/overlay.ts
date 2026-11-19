/**
 * 弹层定位基座（纯函数，零 vue 依赖）：P2b Tooltip/Popover/Popconfirm 与 P2a Select 共用。
 * 方位命名 = antd 12 方位；翻转只在「首选侧放不下且对侧放得下」时发生（Select 首验语义）。
 */

export type KOverlayPlacement =
  | 'top' | 'topLeft' | 'topRight'
  | 'bottom' | 'bottomLeft' | 'bottomRight'
  | 'left' | 'leftTop' | 'leftBottom'
  | 'right' | 'rightTop' | 'rightBottom';

export interface OverlayRect { top: number; left: number; placement: KOverlayPlacement }

type Side = 'top' | 'bottom' | 'left' | 'right';

const FLIP: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function split(placement: KOverlayPlacement): { side: Side; align: string } {
  const side = /^(top|bottom|left|right)/.exec(placement)![1] as Side;
  return { side, align: placement.slice(side.length) };
}

export function computeOverlayPosition(
  anchor: DOMRect,
  size: { width: number; height: number },
  placement: KOverlayPlacement,
  gap: number,
  viewport: { width: number; height: number },
): OverlayRect {
  const { width: w, height: h } = size;
  const fits = (side: Side) =>
    side === 'top' ? anchor.top - gap - h >= 0
    : side === 'bottom' ? anchor.bottom + gap + h <= viewport.height
    : side === 'left' ? anchor.left - gap - w >= 0
    : anchor.right + gap + w <= viewport.width;

  let { side, align } = split(placement);
  if (!fits(side) && fits(FLIP[side])) side = FLIP[side];

  let top = 0;
  let left = 0;
  if (side === 'top' || side === 'bottom') {
    top = side === 'top' ? anchor.top - gap - h : anchor.bottom + gap;
    left = align === 'Left' ? anchor.left
      : align === 'Right' ? anchor.right - w
      : anchor.left + (anchor.width - w) / 2;
  } else {
    left = side === 'left' ? anchor.left - gap - w : anchor.right + gap;
    top = align === 'Top' ? anchor.top
      : align === 'Bottom' ? anchor.bottom - h
      : anchor.top + (anchor.height - h) / 2;
  }
  // 两侧都放不下时（移动端单面板仍高于剩余空间）保底夹进视口，宁可覆盖锚点也不越出屏幕
  const margin = 8;
  top = Math.min(Math.max(top, margin), Math.max(margin, viewport.height - h - margin));
  left = Math.min(Math.max(left, margin), Math.max(margin, viewport.width - w - margin));
  return { top: Math.round(top), left: Math.round(left), placement: `${side}${align}` as KOverlayPlacement };
}
