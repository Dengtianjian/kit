import { ref } from 'vue';
import type { CSSProperties, VNode } from 'vue';
import type { KDrawerPlacement, KDrawerSize } from './types';

/**
 * 实例 API（与 Modal/Message/Notification 同契约）：挂在 useKApp().drawer，
 * Holder 随 KApp 生命周期存活；无全局静态。
 */

export interface KDrawerFuncProps {
  title?: string | VNode;
  content?: string | VNode;
  footer?: string | VNode;
  placement?: KDrawerPlacement;
  size?: KDrawerSize;
  width?: number | string;
  height?: number | string;
  closable?: boolean;
  mask?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  classNames?: Record<string, string>;
  styles?: Record<string, CSSProperties>;
  onClose?: () => void;
  afterClose?: () => void;
}

export interface KDrawerHandle {
  destroy: () => void;
}

export interface KDrawerApi {
  open: (props: KDrawerFuncProps) => KDrawerHandle;
  destroyAll: () => void;
}

export interface KDrawerHolderItem {
  id: number;
  props: KDrawerFuncProps;
  closing: boolean;
}

export interface KDrawerService {
  api: KDrawerApi;
  items: { value: KDrawerHolderItem[] };
  remove: (item: KDrawerHolderItem) => void;
}

export function createDrawerService(): KDrawerService {
  const items = ref<KDrawerHolderItem[]>([]);
  let seq = 0;

  function remove(item: KDrawerHolderItem) {
    items.value = items.value.filter(x => x.id !== item.id);
    item.props.afterClose?.();
  }

  function open(props: KDrawerFuncProps): KDrawerHandle {
    const item: KDrawerHolderItem = { id: ++seq, props, closing: false };
    items.value = [...items.value, item];
    return { destroy: () => remove(item) };
  }

  const api: KDrawerApi = {
    open,
    destroyAll: () => {
      items.value = [];
    },
  };

  return { api, items, remove };
}