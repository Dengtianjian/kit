import type { ComputedRef, InjectionKey } from 'vue';

export type KTabsType = 'line' | 'card';
export type KTabsPlacement = 'top' | 'bottom' | 'left' | 'right';
export type KTabsSize = 'sm' | 'md' | 'lg';
export type KTabsPart = 'root' | 'nav' | 'tab' | 'tabActive' | 'close' | 'content' | 'extra';
export type KTabPanePart = 'root';

export interface KTabPaneContext {
  active: ComputedRef<boolean>;
  tabId: string;
  paneId: string;
}

export const K_TAB_PANE_KEY: InjectionKey<KTabPaneContext> = Symbol('k-tab-pane');