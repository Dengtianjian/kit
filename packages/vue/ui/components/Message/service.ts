import { ref } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';

/**
 * message 实例 API（挂 useKApp().message，无全局静态）。
 * 队列 = 响应式数组，渲染在 KApp 内挂载的 <MessageHolder>；时长为秒，0 = 不自动关。
 */

export type KMessageType = 'info' | 'success' | 'error' | 'warning' | 'loading';

export type KMessagePart = 'root' | 'icon' | 'content';

export interface KMessageRenderScope {
  content: string | VNode;
  type: KMessageType;
  icon?: string | VNode | null;
  /** 手动关闭当前这条（仍走 onClose/计时清理） */
  close: () => void;
}

export interface KMessageConfig {
  content: string | VNode;
  /** 自动关闭秒数；0 = 常驻（默认 3） */
  duration?: number;
  type?: KMessageType;
  /** 覆盖类型图标；null = 无图标 */
  icon?: string | VNode | null;
  /** 同 key 复用一条（更新内容而非叠加） */
  key?: string;
  /** 自定义消息内容渲染（保留外层 role/计时/队列） */
  render?: (scope: KMessageRenderScope) => VNodeChild;
  classNames?: Partial<Record<KMessagePart, string>>;
  styles?: Partial<Record<KMessagePart, CSSProperties>>;
  onClose?: () => void;
}

export interface KMessageHandle {
  destroy: () => void;
}

export interface KMessageApi {
  open: (config: KMessageConfig | string) => KMessageHandle;
  info: (content: string | VNode | Omit<KMessageConfig, 'type'>, duration?: number, onClose?: () => void) => KMessageHandle;
  success: (content: string | VNode | Omit<KMessageConfig, 'type'>, duration?: number, onClose?: () => void) => KMessageHandle;
  error: (content: string | VNode | Omit<KMessageConfig, 'type'>, duration?: number, onClose?: () => void) => KMessageHandle;
  warning: (content: string | VNode | Omit<KMessageConfig, 'type'>, duration?: number, onClose?: () => void) => KMessageHandle;
  loading: (content: string | VNode | Omit<KMessageConfig, 'type'>, duration?: number, onClose?: () => void) => KMessageHandle;
  destroy: (key: string) => void;
  destroyAll: () => void;
}

export interface KMessageHolderItem {
  id: number;
  key?: string;
  type: KMessageType;
  content: string | VNode;
  icon?: string | VNode | null;
  duration: number;
  render?: (scope: KMessageRenderScope) => VNodeChild;
  classNames?: Partial<Record<KMessagePart, string>>;
  styles?: Partial<Record<KMessagePart, CSSProperties>>;
  onClose?: () => void;
}

export interface KMessageService {
  api: KMessageApi;
  items: { value: KMessageHolderItem[] };
  remove: (item: KMessageHolderItem) => void;
}

function normalizeArg(
  arg: string | VNode | Omit<KMessageConfig, 'type'>,
  duration?: number,
  onClose?: () => void,
  type?: KMessageType,
): KMessageConfig {
  if (typeof arg === 'string' || typeof arg === 'object' && 'shapeFlag' in (arg as VNode)) {
    return { content: arg as string | VNode, duration, onClose, type };
  }
  return { ...(arg as Omit<KMessageConfig, 'type'>), duration: (arg as KMessageConfig).duration ?? duration, type };
}

export function createMessageService(): KMessageService {
  const items = ref<KMessageHolderItem[]>([]);
  let seq = 0;

  function remove(item: KMessageHolderItem) {
    items.value = items.value.filter((x) => x.id !== item.id);
    item.onClose?.();
  }

  function open(config: KMessageConfig): KMessageHandle {
    const item: KMessageHolderItem = {
      id: ++seq,
      key: config.key,
      type: config.type ?? 'info',
      content: config.content,
      icon: config.icon,
      duration: config.duration ?? 3,
      render: config.render,
      classNames: config.classNames,
      styles: config.styles,
      onClose: config.onClose,
    };
    if (config.key) {
      const existing = items.value.find((x) => x.key === config.key);
      if (existing) {
        items.value = items.value.map((x) => (x === existing ? { ...item, id: x.id } : x));
        return { destroy: () => remove(existing) };
      }
    }
    items.value = [...items.value, item];
    return { destroy: () => remove(item) };
  }

  const api: KMessageApi = {
    open: (config) => open(typeof config === 'string' ? { content: config } : config),
    info: (a, d, c) => open(normalizeArg(a, d, c, 'info')),
    success: (a, d, c) => open(normalizeArg(a, d, c, 'success')),
    error: (a, d, c) => open(normalizeArg(a, d, c, 'error')),
    warning: (a, d, c) => open(normalizeArg(a, d, c, 'warning')),
    loading: (a, d, c) => open(normalizeArg(a, d, c, 'loading')),
    destroy: (key) => {
      const hit = items.value.find((x) => x.key === key);
      if (hit) remove(hit);
    },
    destroyAll: () => {
      items.value = [];
    },
  };

  return { api, items, remove };
}
