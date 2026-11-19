<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <template v-else>
  <span
    ref="triggerEl"
    v-bind="triggerAttrs"
    class="k-popover__trigger"
    v-on="triggerOn"
  ><slot name="trigger" /></span>

  <Teleport :to="teleportTarget" defer>
    <Transition name="k-popover">
    <div
      v-if="visible"
      ref="popupEl"
      v-bind="popupAttrs"
      :style="styles?.root"
      v-on="popupOn"
    >
      <span v-if="arrow" class="k-popover__arrow" aria-hidden="true" />
      <div class="k-popover__card">
        <div v-if="title || $slots.title" :id="titleId" data-part="title" class="k-popover__title" :class="classNames?.title" :style="styles?.title">
          <slot name="title">{{ title }}</slot>
        </div>
        <button
          v-if="closable"
          type="button"
          class="k-popover__close"
          aria-label="关闭"
          @click="setOpen(false)"
        >
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" /></svg>
        </button>
        <div data-part="content" class="k-popover__content" :class="classNames?.content" :style="styles?.content">
          <slot>{{ content }}</slot>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
  </template>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, useId, useSlots } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import { usePopupHost, useOverlayPosition, usePopupDismiss } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KOverlayPlacement } from '../../utils/overlay';

defineOptions({ name: 'KPopover' });

type PopoverTrigger = 'hover' | 'focus' | 'click';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KPopoverRenderScope {
  visible: boolean;
  placement: KOverlayPlacement;
  teleportTarget: HTMLElement | string;
  triggerEl: Ref<HTMLElement | null>;
  popupEl: Ref<HTMLElement | null>;
  triggerAttrs: Record<string, unknown>;
  triggerOn: Record<string, (e: Event) => void>;
  popupAttrs: Record<string, unknown>;
  popupOn: Record<string, (e: Event) => void>;
  setOpen: (v: boolean) => void;
  title: string | undefined;
  content: string | undefined;
  closable: boolean;
  arrow: boolean;
  slots: ReturnType<typeof useSlots>;
}

interface KPopoverProps {
  /** 卡片标题（同名 title 插槽优先） */
  title?: string;
  /** 弹层内容（默认插槽优先） */
  content?: string;
  placement?: KOverlayPlacement;
  trigger?: PopoverTrigger | PopoverTrigger[];
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  open?: boolean;
  disabled?: boolean;
  arrow?: boolean;
  /** 右上角关闭 X */
  closable?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KPopoverRenderScope>;
  classNames?: { root?: string; title?: string; content?: string };
  styles?: { root?: CSSProperties; title?: CSSProperties; content?: CSSProperties };
}

const props = withDefaults(defineProps<KPopoverProps>(), {
  placement: 'top',
  trigger: () => ['hover', 'focus'],
  mouseEnterDelay: 0.1,
  mouseLeaveDelay: 0.1,
  arrow: true,
  closable: false,
});

const emit = defineEmits<{
  openChange: [open: boolean];
  'update:open': [open: boolean];
}>();

const innerOpen = ref(false);
// Vue 对 Boolean prop 做 absent→false 强转，`props.open !== undefined` 判受控恒真；改查原始 vnode props
const instance = getCurrentInstance()!;
const controlled = computed(() => 'open' in (instance.vnode.props ?? {}));
const slots = useSlots();
const popupId = `k-popover-${useId()}`;
const titleId = `${popupId}-title`;
const visible = computed(() =>
  controlled.value ? Boolean(props.open && !props.disabled) : innerOpen.value,
);

/** 触屏（无 hover）默认改为点按触发，避免 hover 语义在移动端失效 */
const triggerExplicit = 'trigger' in (getCurrentInstance()!.vnode.props ?? {});
const coarsePointer = ref(false);
onMounted(() => {
  coarsePointer.value =
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: none)').matches;
});
const triggerList = computed<PopoverTrigger[]>(() => {
  if (!triggerExplicit) return coarsePointer.value ? ['click'] : ['hover', 'focus'];
  return Array.isArray(props.trigger) ? props.trigger : [props.trigger];
});
const hasHover = computed(() => triggerList.value.includes('hover'));
const hasFocus = computed(() => triggerList.value.includes('focus'));
const hasClick = computed(() => triggerList.value.includes('click'));

const triggerEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);

const { teleportTarget, popupClasses, popupTheme } = usePopupHost(() => ['k-popover']);
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

let timer: ReturnType<typeof setTimeout> | null = null;
function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
function showAfter(delay: number) {
  clearTimer();
  if (props.disabled) return;
  timer = setTimeout(() => setOpen(true), delay * 1000);
}
function hideAfter(delay: number) {
  clearTimer();
  timer = setTimeout(() => setOpen(false), delay * 1000);
}

usePopupDismiss(visible, () => setOpen(false), () => [triggerEl.value, popupEl.value]);

/* ---------- headless 绑定包：事件收进 script，默认模板与自绘共用 ---------- */
const triggerAttrs = computed(() => ({
  'data-part': 'trigger',
  'aria-haspopup': 'dialog',
  'aria-expanded': visible.value ? 'true' : 'false',
  ...(visible.value ? { 'aria-controls': popupId } : {}),
}));
const triggerOn = {
  mouseenter: () => { if (hasHover.value) showAfter(props.mouseEnterDelay); },
  mouseleave: () => { if (hasHover.value) hideAfter(props.mouseLeaveDelay); },
  focusin: () => { if (hasFocus.value) showAfter(props.mouseEnterDelay); },
  focusout: () => { if (hasFocus.value) hideAfter(props.mouseLeaveDelay); },
  click: () => { if (hasClick.value) setOpen(!visible.value); },
};
const popupOn = {
  mouseenter: () => { if (hasHover.value) clearTimer(); },
  mouseleave: () => { if (hasHover.value) hideAfter(props.mouseLeaveDelay); },
};
const popupAttrs = computed(() => ({
  id: popupId,
  'data-part': 'root',
  class: popupClasses.value,
  'data-k-theme': popupTheme.value,
  'data-placement': actualPlacement.value,
  role: 'dialog',
  'aria-modal': 'false',
  ...(props.title || slots.title ? { 'aria-labelledby': titleId } : {}),
  style: popupStyle.value,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KPopoverRenderScope>(
  () => props.render,
  () => ({
    visible: visible.value,
    placement: actualPlacement.value,
    teleportTarget: teleportTarget.value,
    triggerEl,
    popupEl,
    triggerAttrs: triggerAttrs.value,
    triggerOn,
    popupAttrs: popupAttrs.value,
    popupOn,
    setOpen,
    title: props.title,
    content: props.content,
    closable: props.closable,
    arrow: props.arrow,
    slots,
  }),
);

defineSlots<{
  trigger?(): VNodeChild;
  title?(): VNodeChild;
  default?(): VNodeChild;
  render?(scope: KPopoverRenderScope): VNodeChild;
}>();
</script>

<style>
.k-popover__trigger {
  display: inline-block;
  width: auto;
}

.k-popover {
  --k-popover-bg: var(--k-color-bg-elevated);
  --k-popover-color: var(--k-color-text);
  --k-popover-title-color: var(--k-color-text);
  --k-popover-radius: var(--k-border-radius-lg);
  --k-popover-padding: var(--k-size);
  --k-popover-min-width: calc(var(--k-size) * 15);
  --k-popover-max-width: calc(var(--k-size) * 40);
  --k-popover-arrow-size: 8px;

  z-index: var(--k-z-index-popup-base);
  font-family: inherit;
}
.k-popover-enter-active {
  animation: k-popover-zoom var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-popover-leave-active {
  animation: k-popover-zoom-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
.k-popover__card {
  position: relative;
  min-width: var(--k-popover-min-width);
  max-width: var(--k-popover-max-width);
  border-radius: var(--k-popover-radius);
  background-color: var(--k-popover-bg);
  color: var(--k-popover-color);
  box-shadow: var(--k-box-shadow-secondary);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}
.k-popover__title {
  padding: var(--k-popover-padding) var(--k-popover-padding) 0;
  color: var(--k-popover-title-color);
  font-weight: var(--k-font-weight-strong);
}
.k-popover__close {
  position: absolute;
  top: var(--k-size-xs);
  right: var(--k-size-xs);
  display: inline-flex;
  padding: var(--k-size-xxs);
  border: none;
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size);
  cursor: pointer;
}
.k-popover__close:hover {
  color: var(--k-color-text);
}
.k-popover__content {
  padding: var(--k-popover-padding);
  word-wrap: break-word;
}

/* 箭头：elevated 实色浅底画在卡片之下会被卡片 own 阴影糊掉（= 「箭头出现一下自己消失」的根因）；
   改画到卡片之上（z-index 1）+ clip-path 裁内半（留 1px 叠缝），::before tertiary 阴影接续卡片阴影线；
   clip 走本地坐标 → 盒子去掉装饰旋转与 overflow 裁切，偏移 -1*size 让菱形中心骑卡片边缘 */
.k-popover__arrow {
  position: absolute;
  width: calc(var(--k-popover-arrow-size) * 2);
  height: calc(var(--k-popover-arrow-size) * 2);
  pointer-events: none;
  z-index: 1;
}
.k-popover__arrow::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: var(--k-popover-arrow-size);
  height: var(--k-popover-arrow-size);
  background-color: var(--k-popover-bg);
  transform: rotate(45deg);
  box-shadow: var(--k-box-shadow-tertiary);
}
.k-popover[data-placement^='top'] .k-popover__arrow {
  left: var(--k-overlay-arrow-offset, 50%);
  bottom: calc(var(--k-popover-arrow-size) * -1);
  transform: translateX(-50%);
  clip-path: inset(calc(50% - 1px) 0 0 0);
}
.k-popover[data-placement^='bottom'] .k-popover__arrow {
  left: var(--k-overlay-arrow-offset, 50%);
  top: calc(var(--k-popover-arrow-size) * -1);
  transform: translateX(-50%);
  clip-path: inset(0 0 calc(50% - 1px) 0);
}
.k-popover[data-placement^='left'] .k-popover__arrow {
  top: var(--k-overlay-arrow-offset, 50%);
  right: calc(var(--k-popover-arrow-size) * -1);
  transform: translateY(-50%);
  clip-path: inset(0 0 0 calc(50% - 1px));
}
.k-popover[data-placement^='right'] .k-popover__arrow {
  top: var(--k-overlay-arrow-offset, 50%);
  left: calc(var(--k-popover-arrow-size) * -1);
  transform: translateY(-50%);
  clip-path: inset(0 calc(50% - 1px) 0 0);
}

@keyframes k-popover-zoom {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: none; }
}
@keyframes k-popover-zoom-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: scale(0.85); }
}
</style>
