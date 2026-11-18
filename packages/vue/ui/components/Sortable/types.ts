import type { Ref, Slots } from 'vue';
import type { KOnPack } from '../../composables/useCustomRender';

export type KSortableOrientation = 'vertical' | 'horizontal' | 'grid';
export type KSortableKey = string | number;
export type KSortableItemKey<T> = keyof T | ((item: T) => KSortableKey);

export interface KSortableMoveInfo<T> {
  item: T;
  from: number;
  to: number;
}

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KSortableRenderScope<T> {
  items: T[];
  orientation: KSortableOrientation;
  disabled: boolean | undefined;
  draggingKey: KSortableKey | null;
  keyOf: (item: T) => KSortableKey;
  rootEl: Ref<HTMLElement | null>;
  itemAttrs: (item: T, index: number) => Record<string, unknown>;
  itemDragOn: (item: T) => KOnPack;
  handleAttrs: Record<string, unknown>;
  handleDragOn: (item: T) => KOnPack;
  containerAttrs: Record<string, unknown>;
  containerOn: KOnPack;
  move: (from: number, to: number) => void;
  slots: Slots;
}
