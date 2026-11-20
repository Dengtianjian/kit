import type { Component, CSSProperties, InjectionKey, Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { KSize } from '../../utils/size';

export type KBreadcrumbSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KBreadcrumbSeparator = string | Component;
export type KBreadcrumbPart = 'root' | 'list' | 'before' | 'after';
export type KBreadcrumbItemPart = 'item' | 'separator' | 'link' | 'text' | 'icon';

export interface KBreadcrumbChildLink {
  key?: string | number;
  label?: string;
  icon?: Component;
  to?: RouteLocationRaw | string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

export interface KBreadcrumbItemOption extends KBreadcrumbChildLink {
  /** 无文字/纯图标项的可读名称 */
  ariaLabel?: string;
  current?: boolean;
  separator?: KBreadcrumbSeparator;
  /** 子链接：一级下拉，选中后按 to / href 跳转 */
  children?: KBreadcrumbChildLink[];
  classNames?: Partial<Record<KBreadcrumbItemPart, string>>;
  styles?: Partial<Record<KBreadcrumbItemPart, CSSProperties>>;
}

export interface KBreadcrumbContext {
  separator: Ref<KBreadcrumbSeparator>;
  size: Ref<KBreadcrumbSize>;
}

export const K_BREADCRUMB_KEY: InjectionKey<KBreadcrumbContext> = Symbol('k-breadcrumb');