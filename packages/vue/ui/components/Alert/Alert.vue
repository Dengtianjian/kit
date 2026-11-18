<script setup lang="ts">
import { computed, getCurrentInstance, ref, useSlots } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KAlert' });

type AlertType = 'info' | 'success' | 'warning' | 'error';
type AlertPart = 'root' | 'icon' | 'content' | 'title' | 'description' | 'action' | 'close';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KAlertRenderScope {
  type: AlertType;
  message: string | VNode | undefined;
  description: string | VNode | undefined;
  showIcon: boolean;
  closable: boolean;
  banner: boolean;
  visible: boolean;
  rootAttrs: Record<string, unknown>;
  onClose: (e: MouseEvent) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KAlertProps {
  type?: AlertType;
  /** 主文案（title 插槽优先） */
  message?: string | VNode;
  /** 辅助描述（description 插槽优先） */
  description?: string | VNode;
  showIcon?: boolean;
  /** 自定义类型图标；null = 强制无图标（showIcon 仍控制默认图标） */
  icon?: string | VNode | null;
  closable?: boolean;
  /** 受控开合（v-model:open）；关闭按钮走 update:open=false */
  open?: boolean;
  /** banner：贴边通告条（直角、通栏感由使用容器决定） */
  banner?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KAlertRenderScope>;
  classNames?: Partial<Record<AlertPart, string>>;
  styles?: Partial<Record<AlertPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KAlertProps>(), {
  type: 'info',
  showIcon: true,
  closable: false,
  open: true,
  banner: false,
});

const emit = defineEmits<{
  close: [e: MouseEvent];
  'update:open': [open: boolean];
}>();

const innerOpen = ref(true);
// Vue 对 Boolean prop 做 absent→false 强转，`props.open !== undefined` 判受控恒真；改查原始 vnode props
const instance = getCurrentInstance()!;
const controlled = computed(() => 'open' in (instance.vnode.props ?? {}));
const visible = computed(() => (controlled.value ? props.open : innerOpen.value));

const CIRCLE = 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z';
const ICON_PATH: Record<AlertType, string> = {
  info: `${CIRCLE}M8 7.3v3.8M8 4.9l.02 0`,
  success: `${CIRCLE}M5 8.2l2.1 2.1L11 6.1`,
  warning: `${CIRCLE}M8 4.8v4M8 11.1l.02 0`,
  error: `${CIRCLE}M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6`,
};

function onClose(e: MouseEvent) {
  if (!controlled.value) innerOpen.value = false;
  emit('update:open', false);
  emit('close', e);
}

/* ---------- headless 绑定包：默认模板与自绘共用 ---------- */
const slots = useSlots();
const rootAttrs = { 'data-part': 'root', role: 'alert' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KAlertRenderScope>(
  () => props.render,
  () => ({
    type: props.type,
    message: props.message,
    description: props.description,
    showIcon: props.showIcon,
    closable: props.closable,
    banner: props.banner,
    visible: visible.value,
    rootAttrs,
    onClose,
    slots,
  }),
);

defineSlots<{
  icon?(): VNodeChild;
  title?(): VNodeChild;
  description?(): VNodeChild;
  action?(): VNodeChild;
  render?(scope: KAlertRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <template v-if="visible">
      <slot v-if="$slots.render" name="render" v-bind="renderScope" />
      <component v-else :is="renderPropOutlet" />
    </template>
  </template>
  <div
    v-else-if="visible"
    v-bind="rootAttrs"
    class="k-alert"
    :class="[
      `k-alert--${type}`,
      { 'k-alert--banner': banner, 'k-alert--with-description': Boolean(description || $slots.description) },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <span
      v-if="showIcon && icon !== null"
      data-part="icon"
      class="k-alert__icon"
      :class="classNames?.icon"
      :style="styles?.icon"
      aria-hidden="true"
    >
      <template v-if="icon">
        <component :is="KNode" :node="icon" />
      </template>
      <slot v-else name="icon">
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICON_PATH[type]" />
        </svg>
      </slot>
    </span>
    <div data-part="content" class="k-alert__content" :class="classNames?.content" :style="styles?.content">
      <div v-if="message || $slots.title" data-part="title" class="k-alert__title" :class="classNames?.title" :style="styles?.title">
        <slot name="title"><component v-if="message" :is="KNode" :node="message" /></slot>
      </div>
      <div
        v-if="description || $slots.description"
        data-part="description"
        class="k-alert__description"
        :class="classNames?.description"
        :style="styles?.description"
      >
        <slot name="description"><component v-if="description" :is="KNode" :node="description" /></slot>
      </div>
    </div>
    <div v-if="$slots.action" data-part="action" class="k-alert__action" :class="classNames?.action" :style="styles?.action">
      <slot name="action" />
    </div>
    <button
      v-if="closable"
      type="button"
      data-part="close"
      class="k-alert__close"
      :class="classNames?.close"
      :style="styles?.close"
      aria-label="关闭"
      @click="onClose"
    >
      <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" /></svg>
    </button>
  </div>
</template>

<style>
.k-alert {
  --k-alert-bg: var(--k-color-info-bg);
  --k-alert-border-color: var(--k-color-info-border);
  --k-alert-icon-color: var(--k-color-info);
  --k-alert-radius: var(--k-border-radius-lg);
  --k-alert-padding: var(--k-size-sm) var(--k-size);
  --k-alert-gap: var(--k-size-xs);
  --k-alert-close-color: var(--k-color-text-tertiary);

  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--k-alert-gap);
  padding: var(--k-alert-padding);
  border: var(--k-line-width) solid var(--k-alert-border-color);
  border-radius: var(--k-alert-radius);
  background-color: var(--k-alert-bg);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}
.k-alert *,
.k-alert *::before,
.k-alert *::after {
  box-sizing: border-box;
}
.k-alert--success {
  --k-alert-bg: var(--k-color-success-bg);
  --k-alert-border-color: var(--k-color-success-border);
  --k-alert-icon-color: var(--k-color-success);
}
.k-alert--warning {
  --k-alert-bg: var(--k-color-warning-bg);
  --k-alert-border-color: var(--k-color-warning-border);
  --k-alert-icon-color: var(--k-color-warning);
}
.k-alert--error {
  --k-alert-bg: var(--k-color-error-bg);
  --k-alert-border-color: var(--k-color-error-border);
  --k-alert-icon-color: var(--k-color-error);
}
.k-alert--banner {
  --k-alert-radius: var(--k-border-radius-none);
  border-left: none;
  border-right: none;
}

.k-alert__icon {
  flex: none;
  display: inline-flex;
  margin-top: calc((var(--k-line-height) * 1em - 1em) / 2);
  color: var(--k-alert-icon-color);
}
.k-alert__content {
  flex: auto;
  min-width: 0;
}
.k-alert__title {
  word-break: break-word;
}
.k-alert--with-description .k-alert__title {
  font-weight: var(--k-font-weight-strong);
}
.k-alert--with-description .k-alert__icon {
  font-size: var(--k-font-size-lg);
}
.k-alert__description {
  margin-top: var(--k-size-xxs);
  color: var(--k-color-text-secondary);
  word-break: break-word;
}
.k-alert__action {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
}
.k-alert__close {
  flex: none;
  display: inline-flex;
  padding: 0;
  margin-top: calc((var(--k-line-height) * 1em - 1em) / 2);
  border: none;
  background: transparent;
  color: var(--k-alert-close-color);
  font-size: var(--k-font-size);
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-alert__close:hover {
  color: var(--k-color-text-secondary);
}

/* 触屏按压遮罩豁免：通告件本体无按压语义（关闭钮自带 hover 变色） */

@media (hover: none) {
  .k-alert__close {
    padding: 8px;
    margin: -8px -8px 0 0;
  }
  .k-alert__action {
    flex-wrap: wrap;
  }
}
</style>