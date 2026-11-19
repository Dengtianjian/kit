import type { Component, VNodeChild } from 'vue';

export type KTabBarPart =
  | 'root'
  | 'item'
  | 'itemActive'
  | 'icon'
  | 'label'
  | 'badge';

export interface KTabBarItem {
  key: string;
  title?: VNodeChild;
  icon?: Component;
  /** true = 红点；其余按文本展示 */
  badge?: string | number | boolean;
  disabled?: boolean;
}