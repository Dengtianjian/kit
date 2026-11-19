import type { ComputedRef, InjectionKey } from 'vue';

export interface KSiderContext {
  collapsed: ComputedRef<boolean>;
  toggle: () => void;
}

export const K_SIDER_KEY: InjectionKey<KSiderContext> = Symbol('k-sider');