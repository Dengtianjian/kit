import { ref } from 'vue';
import type { VNode } from 'vue';
import type { KSize } from '../../utils/size';

/**
 * 实例 API（拍板③：无全局静态，挂在 useKApp().modal 上）。
 * createModalService() 由 KApp 在 setup 里调用一次：api 提供 open/info/success/error/warning，
 * items 交给 <ModalHolder> 渲染（同一响应式数组，随 KApp 卸载一起消失，天然无残留单例）。
 * 弹窗不预设按钮：关闭统一走 X / 遮罩 / Esc（onClose 回调），按钮交给业务内容自绘。
 */

export type KModalFuncType = 'info' | 'success' | 'error' | 'warning';
export type KModalSize = Extract<KSize, 'sm' | 'md' | 'lg'>;

/** 九宫格屏幕落位：弹窗打开后停在视口哪一格（上/下排缘距 80、左/右列缘距 24、center 四边 20） */
export type KModalPlacement =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export interface KModalFuncProps {
  title?: string | VNode;
  content?: string | VNode;
  /** 覆盖类型默认图标；传 null 关闭 */
  icon?: string | VNode | null;
  width?: number | string;
  size?: KModalSize;
  mask?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  /** 九宫格屏幕落位 */
  placement?: KModalPlacement;
  /** 头部拖拽 */
  draggable?: boolean;
  /** 动画原点覆盖；缺省走「最近 pointerdown」自动记录 */
  source?: Element;
  /** 关闭回调（X / 遮罩 / Esc 均触发，与 open 对称） */
  onClose?: () => void;
  afterClose?: () => void;
}

export interface KModalHandle {
  destroy: () => void;
}

export interface KModalApi {
  open: (props: KModalFuncProps) => KModalHandle;
  info: (props: KModalFuncProps) => KModalHandle;
  success: (props: KModalFuncProps) => KModalHandle;
  error: (props: KModalFuncProps) => KModalHandle;
  warning: (props: KModalFuncProps) => KModalHandle;
  destroyAll: () => void;
}

export interface KModalHolderItem {
  id: number;
  type: KModalFuncType | 'open';
  props: KModalFuncProps;
  /** 关闭中：open 置 false 播退场，afterClose 后才真正出队 */
  closing: boolean;
}

export interface KModalService {
  api: KModalApi;
  items: { value: KModalHolderItem[] };
  remove: (item: KModalHolderItem) => void;
}

export function createModalService(): KModalService {
  const items = ref<KModalHolderItem[]>([]);
  let seq = 0;

  function remove(item: KModalHolderItem) {
    items.value = items.value.filter((x) => x.id !== item.id);
    item.props.afterClose?.();
  }

  function push(type: KModalHolderItem['type'], props: KModalFuncProps): KModalHandle {
    const item: KModalHolderItem = { id: ++seq, type, props, closing: false };
    items.value = [...items.value, item];
    return { destroy: () => remove(item) };
  }

  const api: KModalApi = {
    open: (props) => push('open', props),
    info: (props) => push('info', props),
    success: (props) => push('success', props),
    error: (props) => push('error', props),
    warning: (props) => push('warning', props),
    destroyAll: () => {
      items.value = [];
    },
  };

  return { api, items, remove };
}
