import type { VNodeChild } from 'vue';

export type KAnchorDirection = 'vertical' | 'horizontal';
export type KAnchorPart = 'root' | 'list' | 'item' | 'link';

export interface KAnchorItem {
  key: string;
  /** 目标锚点，如 `#section-1` */
  href: string;
  title?: VNodeChild;
  children?: KAnchorItem[];
}