import { onScopeDispose, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * 断点判定（token 规格 §3 例外③）：数值与 theme.css 的默认断点同源，
 * 自定义断点 = overrides 传入同一份数值（Provider P1.5 接线后从 useKConfig 取）。
 */

export const DEFAULT_BREAKPOINTS = { xs: 0, sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1600 } as const;

export type KBreakpoint = keyof typeof DEFAULT_BREAKPOINTS;

/** 是否移动端视口 = width < md（§8.1） */
export function useBreakpoint(overrides?: Partial<typeof DEFAULT_BREAKPOINTS>): {
  current: Ref<KBreakpoint>;
  isMobile: Ref<boolean>;
} {
  const bp = { ...DEFAULT_BREAKPOINTS, ...overrides };
  // SSR：matchMedia 不存在，返回保守档 'md'（首屏列宽以 CSS 断点为准，JS 结果仅用于行为，规格 §6）
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { current: ref<KBreakpoint>('md'), isMobile: ref(false) };
  }
  // 从高到低找第一个满足 min-width 的档
  const order: KBreakpoint[] = ['xxl', 'xl', 'lg', 'md', 'sm'];
  const queries = order.map(name => ({
    name,
    mql: window.matchMedia(`(min-width: ${bp[name]}px)`),
  }));

  const resolve = (): KBreakpoint => queries.find(q => q.mql.matches)?.name ?? 'xs';

  const current = ref<KBreakpoint>(resolve());
  const isMobile = ref(current.value === 'xs' || current.value === 'sm');

  const onChange = () => {
    current.value = resolve();
    isMobile.value = current.value === 'xs' || current.value === 'sm';
  };
  for (const q of queries) {
    q.mql.addEventListener('change', onChange);
  }

  onScopeDispose(() => {
    for (const q of queries) {
      q.mql.removeEventListener('change', onChange);
    }
  });

  return { current, isMobile };
}
