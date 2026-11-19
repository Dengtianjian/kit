import type { Component, VNodeChild } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

export type KMenuMode = 'vertical' | 'horizontal' | 'inline';
export type KMenuSubmenuTrigger = 'hover' | 'click';
export type KMenuPart =
  | 'root'
  | 'item'
  | 'itemActive'
  | 'itemDanger'
  | 'icon'
  | 'label'
  | 'submenu'
  | 'submenuActive'
  | 'arrow'
  | 'subList'
  | 'popup'
  | 'divider';

export interface KMenuItem {
  key: string;
  label?: VNodeChild;
  icon?: Component;
  disabled?: boolean;
  danger?: boolean;
  /** 在本项前插入分隔线（首项忽略） */
  divided?: boolean;
  /** 路由目标；优先于 href */
  to?: RouteLocationRaw | string;
  href?: string;
  external?: boolean;
  children?: KMenuItem[];
}