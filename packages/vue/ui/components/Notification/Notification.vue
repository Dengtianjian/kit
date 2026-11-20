<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-notification"
    :class="[
      type ? `k-notification--${type}` : '',
      `k-notification--${size}`,
      { 'is-hover-pause': pauseOnHover },
      classNames?.root,
    ]"
    :style="styles?.root"
    v-on="rootOn"
  >
    <span
      v-if="icon !== null && (icon || type || $slots.icon)"
      data-part="icon"
      class="k-notification__icon"
      :class="classNames?.icon"
      :style="styles?.icon"
      aria-hidden="true"
    >
      <slot name="icon">
        <component :is="KNode" v-if="icon" :node="icon" />
        <svg v-else-if="type" viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICON_PATH[type]" />
        </svg>
      </slot>
    </span>
    <div data-part="section" class="k-notification__section" :class="classNames?.section" :style="styles?.section">
      <div v-if="title || $slots.title" data-part="title" class="k-notification__title" :class="classNames?.title" :style="styles?.title">
        <slot name="title">
          <component :is="KNode" :node="title" />
        </slot>
      </div>
      <div v-if="description || $slots.description" data-part="description" class="k-notification__description" :class="classNames?.description" :style="styles?.description">
        <slot name="description">
          <component :is="KNode" :node="description" />
        </slot>
      </div>
      <div v-if="actions || $slots.actions" data-part="actions" class="k-notification__actions" :class="classNames?.actions" :style="styles?.actions">
        <slot name="actions">
          <component :is="KNode" :node="actions" />
        </slot>
      </div>
    </div>
    <button
      v-if="closable && closeIcon !== null"
      type="button"
      data-part="close"
      class="k-notification__close"
      :class="classNames?.close"
      :style="styles?.close"
      aria-label="关闭"
      @click.stop="onClose"
    >
      <slot name="close">
        <component :is="KNode" v-if="closeIcon" :node="closeIcon" />
        <svg v-else viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" /></svg>
      </slot>
    </button>
    <div v-if="showProgress && progressDuration" data-part="progress" class="k-notification__progress" :class="classNames?.progress" :style="styles?.progress">
      <span class="k-notification__progress-bar" :style="{ animationDuration: `${progressDuration}s` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KNotificationSemanticPart, KNotificationSize, KNotificationType } from './service';

defineOptions({ name: 'KNotification' });

/**
 * 声明式通知卡片（antd v6 Notification 语义：结构部件 + 同名插槽 + classNames/styles）。
 * 实例队列由 <NotificationHolder> 用本组件渲染；计时/动画由 Holder 驱动。
 */

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KNotificationRenderScope {
  title: string | VNode | undefined;
  description: string | VNode | undefined;
  actions: string | VNode | undefined;
  type: KNotificationType | undefined;
  size: KNotificationSize;
  icon: string | VNode | null | undefined;
  closable: boolean;
  closeIcon: string | VNode | null | undefined;
  showProgress: boolean;
  progressDuration: number | undefined;
  pauseOnHover: boolean;
  role: 'alert' | 'status';
  rootAttrs: Record<string, unknown>;
  rootOn: Record<string, (e: Event) => void>;
  onClose: (e: MouseEvent) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KNotificationProps {
  title?: string | VNode;
  description?: string | VNode;
  /** 底部操作区（antd v6 的 actions；旧名 btn 由 service 兼容转发） */
  actions?: string | VNode;
  type?: KNotificationType;
  /** 尺寸：字号、内边距、标题/描述与关闭钮同步缩放 */
  size?: KNotificationSize;
  /** 覆盖类型图标；null = 无图标 */
  icon?: string | VNode | null;
  closable?: boolean;
  /** 关闭钮自定义图标；null = 不渲染关闭钮 */
  closeIcon?: string | VNode | null;
  /** 倒计时进度条（动画时长由 progressDuration 提供，与关闭计时同源） */
  showProgress?: boolean;
  progressDuration?: number;
  /** 悬停暂停进度条动画（service 已默认 true） */
  pauseOnHover?: boolean;
  role?: 'alert' | 'status';
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KNotificationRenderScope>;
  classNames?: Partial<Record<KNotificationSemanticPart, string>>;
  styles?: Partial<Record<KNotificationSemanticPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KNotificationProps>(), {
  closable: true,
  showProgress: false,
  pauseOnHover: true,
  role: 'alert',
  size: 'md',
});

const emit = defineEmits<{
  close: [e: MouseEvent];
  click: [e: MouseEvent];
}>();

const CIRCLE = 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z';
const ICON_PATH: Record<KNotificationType, string> = {
  info: `${CIRCLE}M8 7.3v3.8M8 4.9l.02 0`,
  success: `${CIRCLE}M5 8.2l2.1 2.1L11 6.1`,
  error: `${CIRCLE}M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6`,
  warning: `${CIRCLE}M8 4.8v4M8 11.1l.02 0`,
};

/* ---------- headless 绑定包：事件收进 script，默认模板与自绘共用 ---------- */
const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', role: props.role }));
const rootOn = { click: (e: Event) => emit('click', e as MouseEvent) };
function onClose(e: MouseEvent) {
  emit('close', e);
}

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KNotificationRenderScope>(
  () => props.render,
  () => ({
    title: props.title,
    description: props.description,
    actions: props.actions,
    type: props.type,
    size: props.size,
    icon: props.icon,
    closable: props.closable,
    closeIcon: props.closeIcon,
    showProgress: props.showProgress,
    progressDuration: props.progressDuration,
    pauseOnHover: props.pauseOnHover,
    role: props.role,
    rootAttrs: rootAttrs.value,
    rootOn,
    onClose,
    slots,
  }),
);

defineSlots<{
  icon?(): VNodeChild;
  title?(): VNodeChild;
  description?(): VNodeChild;
  actions?(): VNodeChild;
  close?(): VNodeChild;
  render?(scope: KNotificationRenderScope): VNodeChild;
}>();
</script>

<style>
.k-notification {
  --k-notification-bg: var(--k-color-bg-elevated);
  --k-notification-radius: var(--k-border-radius-lg);
  --k-notification-padding: var(--k-size);
  --k-notification-font-size: var(--k-font-size);
  --k-notification-title-size: var(--k-popup-title-size);
  --k-notification-description-size: var(--k-popup-description-size);
  --k-notification-icon-size: var(--k-font-size);
  --k-notification-close-size: var(--k-font-size);
  --k-notification-accent: var(--k-color-primary);

  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--k-size-xs);
  /* 贴底进度条的直边会伸出圆角轮廓：统一由卡片圆角裁切。track 自身 2px 高做 bottom radius 会被 CSS 半径缩放压到 ~1px，裁不对 */
  overflow: hidden;
  padding: var(--k-notification-padding);
  border-radius: var(--k-notification-radius);
  background-color: var(--k-notification-bg);
  /* antd notification 同款 boxShadow（三层匀开淡影）；secondary 偏紧偏黑，是 tooltip/popover 小弹层档 */
  box-shadow: var(--k-box-shadow);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-notification-font-size);
  line-height: var(--k-line-height);
  pointer-events: auto; /* 列表容器 pointer-events: none，卡片自身可交互 */
}
.k-notification--sm {
  --k-notification-padding: var(--k-size-sm);
  --k-notification-font-size: var(--k-font-size-sm);
  --k-notification-title-size: var(--k-font-size);
  --k-notification-icon-size: var(--k-font-size);
  --k-notification-close-size: var(--k-font-size-sm);
}
.k-notification--lg {
  --k-notification-padding: var(--k-size-md);
  --k-notification-font-size: var(--k-font-size-lg);
  --k-notification-title-size: var(--k-font-size-lg);
  --k-notification-description-size: var(--k-font-size);
  --k-notification-icon-size: var(--k-font-size-lg);
  --k-notification-close-size: var(--k-font-size-lg);
}
.k-notification--success {
  --k-notification-accent: var(--k-color-success);
}
.k-notification--error {
  --k-notification-accent: var(--k-color-error);
}
.k-notification--warning {
  --k-notification-accent: var(--k-color-warning);
}
.k-notification--info {
  --k-notification-accent: var(--k-color-info);
}
.k-notification__icon {
  flex: none;
  display: inline-flex;
  margin-top: calc((var(--k-line-height) * var(--k-notification-font-size) - var(--k-notification-icon-size)) / 2);
  color: var(--k-notification-accent);
  font-size: var(--k-notification-icon-size);
}
.k-notification__section {
  flex: auto;
  min-width: 0;
}
.k-notification__title {
  color: var(--k-color-text);
  font-size: var(--k-notification-title-size);
  font-weight: var(--k-popup-title-weight);
}
.k-notification__description {
  margin-top: var(--k-size-xxs);
  color: var(--k-color-text-secondary);
  font-size: var(--k-notification-description-size);
  line-height: var(--k-line-height);
}
.k-notification__actions {
  margin-top: var(--k-size-sm);
  display: flex;
  justify-content: flex-end;
  gap: var(--k-size-xs);
}
.k-notification__close {
  position: absolute;
  top: var(--k-size-xs);
  right: var(--k-size-xs);
  display: inline-flex;
  padding: var(--k-size-xxs);
  border: none;
  border-radius: var(--k-border-radius);
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-notification-close-size);
  cursor: pointer;
}
.k-notification__close:hover {
  color: var(--k-color-text);
}
.k-notification__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
}
.k-notification__progress-bar {
  display: block;
  height: 100%;
  background: var(--k-notification-accent);
  transform-origin: left center;
  animation: k-notification-progress linear forwards;
}
/* pauseOnHover：悬停冻结倒计时条（自动关闭计时由 Holder 同步暂停） */
.k-notification.is-hover-pause:hover .k-notification__progress-bar {
  animation-play-state: paused;
}
@keyframes k-notification-progress {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

@media (hover: none) {
  .k-notification__close {
    padding: 8px;
    top: 4px;
    right: 4px;
  }
}
</style>
