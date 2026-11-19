import { computed, unref } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { getSharedBreakpoint } from './useBreakpoint';
import type { KBreakpoint } from './useBreakpoint';

/** 断点常量映射：缺档向低档回退（mobile-first），全缺则返回 undefined 交给组件缺省 */
export type KResponsiveMap<T> = Partial<Record<KBreakpoint, T>>;

/**
 * 响应式值三态：
 * - 常量：`24` / `'sm'` / `[8, 16]`
 * - 对象：`{ xs: 8, md: 24 }`
 * - 字符串语法糖：`'xs:8px sm:12px md:24px'`（值与值以空白分隔）
 */
export type KResponsiveValue<T> = T | KResponsiveMap<T> | string;

const BREAKPOINTS: KBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
const BREAKPOINT_SET = new Set<string>(BREAKPOINTS);
const RESPONSIVE_STRING_RE = /(?:^|\s)(?:xs|sm|md|lg|xl|xxl):/;

export function isResponsiveString(value: string): boolean {
  return RESPONSIVE_STRING_RE.test(value);
}

export function isResponsiveMap<T = unknown>(value: unknown): value is KResponsiveMap<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(key => BREAKPOINT_SET.has(key));
}

/** 字符串语法糖 → 断点映射；无法识别的片段忽略；coerce 用于组件把 '8' 转成数字等 */
export function parseResponsiveString<T = string>(
  value: string,
  coerce?: (raw: string) => T,
): KResponsiveMap<T> {
  const map: KResponsiveMap<T> = {};
  for (const token of value.trim().split(/\s+/)) {
    const colon = token.indexOf(':');
    if (colon <= 0) continue;
    const breakpoint = token.slice(0, colon) as KBreakpoint;
    if (!BREAKPOINT_SET.has(breakpoint)) continue;
    const raw = token.slice(colon + 1);
    map[breakpoint] = (coerce ? coerce(raw) : raw) as T;
  }
  return map;
}

/** 同步解析（非响应式场景/测试可直接用）；缺档向低档回退 */
export function resolveResponsiveValue<T>(
  value: KResponsiveValue<T> | undefined,
  current: KBreakpoint,
  coerce?: (raw: string) => T,
): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    if (!isResponsiveString(value)) return value as T;
    value = parseResponsiveString(value, coerce);
  }
  if (!isResponsiveMap<T>(value)) return value as T;
  const index = BREAKPOINTS.indexOf(current);
  for (let i = index; i >= 0; i--) {
    const next = value[BREAKPOINTS[i]];
    if (next !== undefined) return next;
  }
  return undefined;
}

/**
 * 响应式 prop 解析：常量零依赖直返；对象/字符串读取共享断点（全库一套 MQL）。
 * SSR 首帧走共享断点的保守档 md，挂载后由真实视口校正。
 */
export function useResponsiveValue<T>(
  source: MaybeRefOrGetter<KResponsiveValue<T> | undefined>,
  options?: { coerce?: (raw: string) => T },
): ComputedRef<T | undefined> {
  return computed(() => {
    const raw = typeof source === 'function' ? (source as () => KResponsiveValue<T> | undefined)() : unref(source);
    if (raw == null) return undefined;
    if (typeof raw === 'string' ? !isResponsiveString(raw) : !isResponsiveMap<T>(raw)) {
      return raw as T;
    }
    const current = getSharedBreakpoint().current.value;
    return resolveResponsiveValue(raw, current, options?.coerce);
  });
}