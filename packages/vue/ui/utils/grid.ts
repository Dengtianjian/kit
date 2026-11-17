import type { InjectionKey, Ref } from 'vue';

/** Row → Col 的 gutter 传递（[水平, 垂直]，px），规格 components/grid.md */
export const K_ROW_INJECTION_KEY: InjectionKey<Ref<[number, number]>> = Symbol('k-row-gutter');
