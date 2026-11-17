<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import KButton from '../Button/Button.vue';
import { usePopupHost, useOverlayPosition, usePopupDismiss } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KOverlayPlacement } from '../../utils/overlay';

defineOptions({ name: 'KPopconfirm' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KPopconfirmRenderScope {
  visible: boolean;
  placement: KOverlayPlacement;
  teleportTarget: HTMLElement | string;
  triggerEl: Ref<HTMLElement | null>;
  popupEl: Ref<HTMLElement | null>;
  triggerAttrs: Record<string, unknown>;
  triggerOn: Record<string, (e: Event) => void>;
  popupAttrs: Record<string, unknown>;
  title: string | undefined;
  description: string | undefined;
  icon: 'warning' | 'info';
  okText: string;
  cancelText: string;
  okType: 'primary' | 'danger';
  okLoading: boolean;
  setOpen: (v: boolean) => void;
  onConfirm: (e: MouseEvent) => void;
  onCancel: (e: MouseEvent) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KPopconfirmProps {
  /** 确认提示文案（默认插槽整块优先，其次 title 插槽/prop） */
  title?: string;
  description?: string;
  /** 图标语义（antd 默认 warning 感叹圈） */
  icon?: 'warning' | 'info';
  okText?: string;
  cancelText?: string;
  okType?: 'primary' | 'danger';
  okLoading?: boolean;
  placement?: KOverlayPlacement;
  open?: boolean;
  disabled?: boolean;
  arrow?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KPopconfirmRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KPopconfirmProps>(), {
  placement: 'top',
  icon: 'warning',
  okText: '确定',
  cancelText: '取消',
  okType: 'primary',
  arrow: true,
});

const emit = defineEmits<{
  confirm: [e: MouseEvent];
  cancel: [e: MouseEvent];
  openChange: [open: boolean];
  'update:open': [open: boolean];
}>();

const innerOpen = ref(false);
// Vue 对 Boolean prop 做 absent→false 强转，`props.open !== undefined` 判受控恒真；改查原始 vnode props
const instance = getCurrentInstance()!;
const controlled = computed(() => 'open' in (instance.vnode.props ?? {}));
const visible = computed(() =>
  controlled.value ? Boolean(props.open && !props.disabled) : innerOpen.value,
);

const triggerEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);

const { teleportTarget, popupClasses, popupTheme } = usePopupHost(() => ['k-popconfirm']);
const { popupStyle, actualPlacement } = useOverlayPosition({
  anchor: triggerEl,
  popup: popupEl,
  visible,
  placement: () => props.placement,
  target: teleportTarget,
  gap: 4,
  arrowKeepout: 14, // 箭头限位 = 半盒(8) + 圆角余量（JS 端 clamp）
});

function setOpen(v: boolean) {
  if (v === (controlled.value ? props.open : innerOpen.value)) return;
  if (!controlled.value) innerOpen.value = v;
  emit('update:open', v);
  emit('openChange', v);
}

async function onConfirm(e: MouseEvent) {
  emit('confirm', e);
  // 等一轮 flush：调用方在 confirm 处理器里同步置 ok-loading，props 要下一帧才回读得到
  await nextTick();
  if (!props.okLoading) setOpen(false);
}
function onCancel(e: MouseEvent) {
  emit('cancel', e);
  setOpen(false);
}

/* okLoading 收尾（true→false）自动收摊；受控 open 时只发事件由调用方关 */
watch(
  () => props.okLoading,
  (v, old) => {
    if (old && !v) setOpen(false);
  },
);

usePopupDismiss(visible, () => setOpen(false), () => [triggerEl.value, popupEl.value]);

/* ---------- headless 绑定包：事件收进 script，默认模板与自绘共用 ---------- */
const slots = useSlots();
const triggerAttrs = { 'data-part': 'trigger' };
const triggerOn = {
  click: () => { if (!props.disabled) setOpen(!visible.value); },
};
const popupAttrs = computed(() => ({
  'data-part': 'root',
  class: popupClasses.value,
  'data-k-theme': popupTheme.value,
  'data-placement': actualPlacement.value,
  role: 'dialog',
  'aria-modal': 'false',
  style: popupStyle.value,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KPopconfirmRenderScope>(
  () => props.render,
  () => ({
    visible: visible.value,
    placement: actualPlacement.value,
    teleportTarget: teleportTarget.value,
    triggerEl,
    popupEl,
    triggerAttrs,
    triggerOn,
    popupAttrs: popupAttrs.value,
    title: props.title,
    description: props.description,
    icon: props.icon,
    okText: props.okText,
    cancelText: props.cancelText,
    okType: props.okType,
    okLoading: props.okLoading,
    setOpen,
    onConfirm,
    onCancel,
    slots,
  }),
);

defineSlots<{
  trigger?(): VNodeChild;
  default?(): VNodeChild;
  title?(): VNodeChild;
  description?(): VNodeChild;
  render?(scope: KPopconfirmRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <template v-else>
  <span
    ref="triggerEl"
    v-bind="triggerAttrs"
    class="k-popconfirm__trigger"
    v-on="triggerOn"
  ><slot name="trigger" /></span>

  <Teleport :to="teleportTarget" defer>
    <Transition name="k-popconfirm">
    <div
      v-if="visible"
      ref="popupEl"
      v-bind="popupAttrs"
      :style="styles?.root"
    >
      <span v-if="arrow" class="k-popconfirm__arrow" aria-hidden="true" />
      <div class="k-popconfirm__card">
        <div class="k-popconfirm__message">
          <span class="k-popconfirm__icon" :class="`k-popconfirm__icon--${icon}`" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="icon === 'warning'" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4.8v4M8 11.1l.02 0" />
              <path v-else d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 7.3v3.8M8 4.9l.02 0" />
            </svg>
          </span>
          <div class="k-popconfirm__text">
            <slot>
              <div class="k-popconfirm__title">
                <slot name="title">{{ title }}</slot>
              </div>
              <div v-if="description || $slots.description" class="k-popconfirm__description">
                <slot name="description">{{ description }}</slot>
              </div>
            </slot>
          </div>
        </div>
        <div class="k-popconfirm__footer">
          <KButton size="xs" @click="onCancel">{{ cancelText }}</KButton>
          <KButton size="xs" :type="okType" :loading="okLoading" @click="onConfirm">{{ okText }}</KButton>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
  </template>
</template>

<style>
.k-popconfirm__trigger {
  display: inline-block;
  width: auto;
}

.k-popconfirm {
  --k-popconfirm-bg: var(--k-color-bg-elevated);
  --k-popconfirm-radius: var(--k-border-radius-lg);
  --k-popconfirm-padding: var(--k-size);
  --k-popconfirm-min-width: calc(var(--k-size) * 13);
  --k-popconfirm-max-width: calc(var(--k-size) * 24);
  --k-popconfirm-arrow-size: 8px;

  z-index: var(--k-z-index-popup-base);
  font-family: inherit;
}
.k-popconfirm-enter-active {
  animation: k-popconfirm-zoom var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-popconfirm-leave-active {
  animation: k-popconfirm-zoom-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
.k-popconfirm__card {
  position: relative;
  min-width: var(--k-popconfirm-min-width);
  max-width: var(--k-popconfirm-max-width);
  padding: var(--k-popconfirm-padding);
  border-radius: var(--k-popconfirm-radius);
  background-color: var(--k-popconfirm-bg);
  box-shadow: var(--k-box-shadow-secondary);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}
.k-popconfirm__message {
  display: flex;
  gap: var(--k-size-xs);
  color: var(--k-color-text);
}
.k-popconfirm__icon {
  flex: none;
  display: inline-flex;
  margin-top: calc((var(--k-line-height) * var(--k-font-size) - 1em) / 2);
  font-size: var(--k-font-size);
}
.k-popconfirm__icon--warning {
  color: var(--k-color-warning);
}
.k-popconfirm__icon--info {
  color: var(--k-color-info);
}
.k-popconfirm__title {
  color: var(--k-color-text);
}
.k-popconfirm__description {
  margin-top: var(--k-size-xxs);
  color: var(--k-color-text-secondary);
}
.k-popconfirm__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--k-size-xs);
  margin-top: var(--k-popconfirm-padding);
}

/* 箭头：同 Popover——画在卡片之上 + clip 裁内半，tertiary 阴影接续卡片阴影线（实色浅底画在卡片下会被糊掉） */
.k-popconfirm__arrow {
  position: absolute;
  width: calc(var(--k-popconfirm-arrow-size) * 2);
  height: calc(var(--k-popconfirm-arrow-size) * 2);
  pointer-events: none;
  z-index: 1;
}
.k-popconfirm__arrow::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: var(--k-popconfirm-arrow-size);
  height: var(--k-popconfirm-arrow-size);
  background-color: var(--k-popconfirm-bg);
  transform: rotate(45deg);
  box-shadow: var(--k-box-shadow-tertiary);
}
.k-popconfirm[data-placement^='top'] .k-popconfirm__arrow {
  left: var(--k-overlay-arrow-offset, 50%);
  bottom: calc(var(--k-popconfirm-arrow-size) * -1);
  transform: translateX(-50%);
  clip-path: inset(calc(50% - 1px) 0 0 0);
}
.k-popconfirm[data-placement^='bottom'] .k-popconfirm__arrow {
  left: var(--k-overlay-arrow-offset, 50%);
  top: calc(var(--k-popconfirm-arrow-size) * -1);
  transform: translateX(-50%);
  clip-path: inset(0 0 calc(50% - 1px) 0);
}
.k-popconfirm[data-placement^='left'] .k-popconfirm__arrow {
  top: var(--k-overlay-arrow-offset, 50%);
  right: calc(var(--k-popconfirm-arrow-size) * -1);
  transform: translateY(-50%);
  clip-path: inset(0 0 0 calc(50% - 1px));
}
.k-popconfirm[data-placement^='right'] .k-popconfirm__arrow {
  top: var(--k-overlay-arrow-offset, 50%);
  left: calc(var(--k-popconfirm-arrow-size) * -1);
  transform: translateY(-50%);
  clip-path: inset(0 calc(50% - 1px) 0 0);
}

@keyframes k-popconfirm-zoom {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: none; }
}
@keyframes k-popconfirm-zoom-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: scale(0.85); }
}
</style>
