/** 全组件统一尺寸档：只允许 xs / sm / md / lg（间距轴另见 KSpaceSize） */
export type KSize = 'xs' | 'sm' | 'md' | 'lg';

/** 间距轴名 → token 阶梯变量（Space/Flex/Row 共用，规格 components/space.md） */

export type KSpaceSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | number;

const SIZE_VARS: Record<'xxs' | 'xs' | 'sm' | 'md' | 'lg', string> = {
  xxs: 'var(--k-size-xxs)',
  xs: 'var(--k-size-xs)',
  sm: 'var(--k-size-sm)',
  md: 'var(--k-size)',
  lg: 'var(--k-size-lg)',
};

export function resolveSizeToken(size: KSpaceSize): string {
  return typeof size === 'number' ? `${size}px` : SIZE_VARS[size];
}

/** [行, 列] 元组或单值 → 两值元组 */
export function resolveSizeTuple(size: KSpaceSize | [KSpaceSize, KSpaceSize]): [string, string] {
  const [row, column] = Array.isArray(size) ? size : [size, size];
  return [resolveSizeToken(row), resolveSizeToken(column)];
}
