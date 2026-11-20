import type { Component, VNodeChild } from 'vue';
import type { KSize } from '../../utils/size';

export type KDropdownTrigger = 'hover' | 'click' | 'contextmenu';
export type KDropdownSize = Extract<KSize, 'sm' | 'md' | 'lg'>;

export type KDropdownPart =
  | 'trigger'
  | 'root'
  | 'item'
  | 'label'
  | 'icon'
  | 'divider'
  | 'danger';

export interface KDropdownItem {
  key: string | number;
  label?: VNodeChild;
  icon?: Component;
  disabled?: boolean;
  danger?: boolean;
  /** 在本项前插入分隔线（首项忽略） */
  divided?: boolean;
}