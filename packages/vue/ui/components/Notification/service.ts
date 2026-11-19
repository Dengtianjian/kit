import { ref } from 'vue';
import type { CSSProperties, VNode } from 'vue';

/**
 * notification 实例 API（挂 useKApp().notification，无全局静态），对齐 antd v6 API 面：
 * title/description/actions/closable(number|false)/duration(number|false)/placement 六值/
 * showProgress/pauseOnHover/maxCount。
 * 队列由 <NotificationHolder> 按 placement 分列渲染：同一方位只有一个列表，
 * 不同方位各自一个（滚动容器 + 进出场动画在 Holder）。
 */

export type KNotificationType = 'info' | 'success' | 'error' | 'warning';
export type KNotificationPlacement =
  | 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight';

/** 语义部件（classNames/styles 逐部件覆盖 + data-part 标记） */
export type KNotificationSemanticPart =
  | 'root' | 'icon' | 'section' | 'title' | 'description' | 'actions' | 'close' | 'progress';

/** antd v6 closable 对象形态 */
export interface KNotificationClosable {
  closeIcon?: string | VNode | null;
  onClose?: () => void;
}

export interface KNotificationConfig {
  title?: string | VNode;
  description?: string | VNode;
  /** 底部操作区（如「查看详情」按钮的 VNode） */
  actions?: string | VNode;
  /** @deprecated actions 的 v6 前旧名，下个大版本移除 */
  btn?: string | VNode;
  type?: KNotificationType;
  /** 覆盖类型图标；null = 无图标 */
  icon?: string | VNode | null;
  /** 自动关闭秒数；0 / false = 常驻（默认 4.5） */
  duration?: number | false;
  placement?: KNotificationPlacement;
  /** 关闭按钮：boolean = 显隐；对象 = 自定义图标 + 关闭回调 */
  closable?: boolean | KNotificationClosable;
  /** closable.closeIcon 的顶层简写 */
  closeIcon?: string | VNode | null;
  /** 底部倒计时进度条（时长与关闭计时同源） */
  showProgress?: boolean;
  /** 悬停暂停自动关闭与进度条（默认 true） */
  pauseOnHover?: boolean;
  role?: 'alert' | 'status';
  key?: string;
  onClose?: () => void;
  onClick?: (e: MouseEvent) => void;
  classNames?: Partial<Record<KNotificationSemanticPart, string>>;
  styles?: Partial<Record<KNotificationSemanticPart, CSSProperties>>;
}

/** api.config() 全局默认（合入其后每次 open；显式传值优先） */
export interface KNotificationGlobalConfig {
  /** 上/下缘距离（px），缺省走 --k-size */
  top?: number;
  bottom?: number;
  placement?: KNotificationPlacement;
  duration?: number | false;
  closeIcon?: string | VNode | null;
  showProgress?: boolean;
  pauseOnHover?: boolean;
  /** 同列数量上限，超限挤掉最旧一条 */
  maxCount?: number;
  /** 同列堆叠显示上限（默认 3；0 = 关闭堆叠，全部平铺） */
  stackLimit?: number;
}

export interface KNotificationHandle {
  destroy: () => void;
}

export interface KNotificationApi {
  open: (config: KNotificationConfig) => KNotificationHandle;
  info: (config: Omit<KNotificationConfig, 'type'>) => KNotificationHandle;
  success: (config: Omit<KNotificationConfig, 'type'>) => KNotificationHandle;
  error: (config: Omit<KNotificationConfig, 'type'>) => KNotificationHandle;
  warning: (config: Omit<KNotificationConfig, 'type'>) => KNotificationHandle;
  destroy: (key: string) => void;
  destroyAll: () => void;
  config: (options: KNotificationGlobalConfig) => void;
  /** 读取当前全局默认（用于 UI 回显 config 状态） */
  getConfig: () => KNotificationGlobalConfig;
}

export interface KNotificationHolderItem {
  id: number;
  key?: string;
  placement: KNotificationPlacement;
  config: KNotificationConfig;
  /** 已合并全局默认 + 归一化（0 → false）；false = 常驻 */
  duration: number | false;
  showProgress: boolean;
  pauseOnHover: boolean;
  closable: boolean;
  /** 已合并 closable 对象/顶层简写/全局默认；null = 不渲染关闭钮 */
  closeIcon?: string | VNode | null;
  onClose?: () => void;
  /** 同 key 原位更新产生的新项：进场动画不重放 */
  updated?: boolean;
}

export interface KNotificationService {
  api: KNotificationApi;
  items: { value: KNotificationHolderItem[] };
  global: { value: KNotificationGlobalConfig };
  remove: (item: KNotificationHolderItem) => void;
}

export function createNotificationService(): KNotificationService {
  const items = ref<KNotificationHolderItem[]>([]);
  const global = ref<KNotificationGlobalConfig>({});
  let seq = 0;

  function remove(item: KNotificationHolderItem) {
    items.value = items.value.filter((x) => x.id !== item.id);
    item.onClose?.();
  }

  function open(config: KNotificationConfig): KNotificationHandle {
    const g = global.value;
    const rawDuration = config.duration ?? g.duration ?? 4.5;
    const closableObj: KNotificationClosable | undefined =
      typeof config.closable === 'object' ? config.closable : undefined;
    const item: KNotificationHolderItem = {
      id: ++seq,
      key: config.key,
      placement: config.placement ?? g.placement ?? 'topRight',
      config,
      duration: rawDuration === 0 || rawDuration === false ? false : rawDuration,
      showProgress: config.showProgress ?? g.showProgress ?? false,
      pauseOnHover: config.pauseOnHover ?? g.pauseOnHover ?? true,
      closable: config.closable !== false,
      closeIcon: closableObj?.closeIcon ?? config.closeIcon ?? g.closeIcon,
      onClose: closableObj?.onClose ?? config.onClose,
    };
    if (config.key) {
      const existing = items.value.find((x) => x.key === config.key);
      if (existing) {
        // 原位更新：换新 id 重挂载（计时从头、动画不重放），位置与列不动
        items.value = items.value.map((x) => (x === existing ? { ...item, updated: true } : x));
        return { destroy: () => remove(item) };
      }
    }
    items.value = [...items.value, item];
    if (g.maxCount != null) {
      while (items.value.length > g.maxCount) {
        const [oldest, ...rest] = items.value;
        if (!oldest) break;
        items.value = rest;
        oldest.onClose?.();
      }
    }
    return { destroy: () => remove(item) };
  }

  const withType =
    (type: KNotificationType) =>
    (config: Omit<KNotificationConfig, 'type'>) =>
      open({ ...config, type });

  const api: KNotificationApi = {
    open,
    info: withType('info'),
    success: withType('success'),
    error: withType('error'),
    warning: withType('warning'),
    destroy: (key) => {
      const hit = items.value.find((x) => x.key === key);
      if (hit) remove(hit);
    },
    destroyAll: () => {
      items.value = [];
    },
    config: (options) => {
      global.value = { ...global.value, ...options };
    },
    getConfig: () => global.value,
  };

  return { api, items, global, remove };
}
