import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { useKConfig } from './useKConfig';

/**
 * 断点判定（token 规格 §3 例外③）：数值与 theme.css 的默认断点同源；
 * 自定义断点经 theme.breakpoints 下发，Provider 子树内生效（嵌套按档合并）。
 */

export const DEFAULT_BREAKPOINTS = { xs: 0, sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1600 } as const;

export type KBreakpoint = keyof typeof DEFAULT_BREAKPOINTS;
export type KBreakpointOverrides = Partial<Record<KBreakpoint, number>>;

export interface KBreakpointState {
  current: Ref<KBreakpoint>;
  isMobile: Ref<boolean>;
}

interface DisposableState extends KBreakpointState {
  dispose: () => void;
}

function createState(bp: Record<KBreakpoint, number>): DisposableState {
  // SSR：matchMedia 不存在，返回保守档 'md'（首屏列宽以 CSS 断点为准，JS 结果仅用于行为，规格 §6）
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { current: ref<KBreakpoint>('md'), isMobile: ref(false), dispose: () => {} };
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

  return {
    current,
    isMobile,
    dispose: () => {
      for (const q of queries) {
        q.mql.removeEventListener('change', onChange);
      }
    },
  };
}

/** 全库共享的断点状态：一套 MQL 服务所有响应式 prop，避免每实例 5 个监听器 */
let sharedState: KBreakpointState | null = null;

export function getSharedBreakpoint(): KBreakpointState {
  if (!sharedState) {
    const state = createState(DEFAULT_BREAKPOINTS);
    sharedState = { current: state.current, isMobile: state.isMobile };
  }
  return sharedState;
}

/** 同档位组合只建一套 MQL（同一 Provider 子树共享） */
const stateCache = new Map<string, KBreakpointState>();
const DEFAULT_KEY = Object.entries(DEFAULT_BREAKPOINTS)
  .map(([k, v]) => `${k}:${v}`)
  .join(',');

function getBreakpointState(overrides?: KBreakpointOverrides): KBreakpointState {
  if (!overrides || !Object.keys(overrides).length) return getSharedBreakpoint();
  const merged = { ...DEFAULT_BREAKPOINTS, ...overrides };
  const key = Object.entries(merged)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  if (key === DEFAULT_KEY) return getSharedBreakpoint();
  let state = stateCache.get(key);
  if (!state) {
    const created = createState(merged);
    state = { current: created.current, isMobile: created.isMobile };
    stateCache.set(key, state);
  }
  return state;
}

/**
 * 是否移动端视口 = width < md（§8.1）。
 * 无 overrides 时读取最近 Provider 的 theme.breakpoints（无则共用默认共享态）；
 * 显式 overrides 仍创建独立实例，随作用域销毁。
 */
export function useBreakpoint(overrides?: KBreakpointOverrides): KBreakpointState {
  if (overrides) {
    const state = createState({ ...DEFAULT_BREAKPOINTS, ...overrides });
    onScopeDispose(state.dispose);
    return { current: state.current, isMobile: state.isMobile };
  }
  const config = useKConfig();
  const source = config?.breakpoints;
  if (!source) return getSharedBreakpoint();
  const state = shallowRef(getBreakpointState(source.value));
  watch(source, (next) => {
    state.value = getBreakpointState(next);
  });
  return {
    current: computed(() => state.value.current.value),
    isMobile: computed(() => state.value.isMobile.value),
  };
}