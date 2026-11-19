import type { Component, CSSProperties, InjectionKey, Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { KSize } from '../../utils/size';

export type KBreadcrumbSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KBreadcrumbSeparator = string | Component;
export type KBreadcrumbPart = 'root' | 'list';
export type KBreadcrumbItemPart = 'item' | 'separator' | 'link' | 'text';

export interface KBreadcrumbItemOption {
  key?: string | number;
  label?: string;
  to?: RouteLocationRaw | string;
  href?: string;
  external?: boolean;
  current?: boolean;
  disabled?: boolean;
  separator?: KBreadcrumbSeparator;
  classNames?: Partial<Record<KBreadcrumbItemPart, string>>;
  styles?: Partial<Record<KBreadcrumbItemPart, CSSProperties>>;
}

export interface KBreadcrumbContext {
  separator: Ref<KBreadcrumbSeparator>;
  size: Ref<KBreadcrumbSize>;
}

export const K_BREADCRUMB_KEY: InjectionKey<KBreadcrumbContext> = Symbol('k-breadcrumb');