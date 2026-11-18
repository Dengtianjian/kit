<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, useSlots } from 'vue';
import type { CSSProperties, Ref, VNode, VNodeChild } from 'vue';
import { usePopupHost, useOverlayPosition, usePopupDismiss } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KOverlayPlacement } from '../../utils/overlay';
import { KNode } from '../../utils/vnode';

defineOptions({ name: 'KTooltip' });

type TooltipTrigger = 'hover' | 'focus' | 'click';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KTooltipRenderScope {
  visible: boolean;
  hasContent: boolean;
  placement: KOverlayPlacement;
  teleportTarget: HTMLElement | string;
  triggerEl: Ref<HTMLElement | null>;
  popupEl: Ref<HTMLElement | null>;
  triggerAttrs: Record<string, unknown>;
  triggerOn: Record<string, (e: Event) => void>;
  popupAttrs: Record<string, unknown>;
  popupOn: Record<string, (e: Event) => void>;
  setOpen: (v: boolean) => void;
  content: string | VNode | undefined;
  slots: ReturnType<typeof useSlots>;
}

interface KTooltipProps {
  /** 提示内容（默认插槽优先） */
  content?: string | VNode;
  /** 提示内容别名（antd 同名兼容；优先级低于 content） */
  title?: string | VNode;
  placement?: KOverlayPlacement;
  trigger?: TooltipTrigger | TooltipTrigger[];
  /** 出现延迟秒数（antd 同款默认 0.1，防路过误触） */
  mouseEnterDelay?: number;
  /** 消失延迟秒数（默认 0.1，留出移入弹层的容差） */
  mouseLeaveDelay?: number;
  /** 强制开合（受控）；不传 = 组件自管 */
  open?: boolean;
  disabled?: boolean;
  arrow?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KTooltipRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KTooltipProps>(), {
  placement: 'top',
  trigger: () => ['hover', 'focus'],
  mouseEnterDelay: 0.1,
  mouseLeaveDelay: 0.1,
  arrow: true,
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
// 无内容不弹空泡：默认插槽存在性或 prop 非空任一成立
const hasContent = computed(() => !!(props.content ?? props.title) || !!slots.default);
const visible = computed(() => (controlled.value ? props.open && !props.disabled : innerOpen.value) && hasContent.value);

/** 触屏（无 hover）默认改为点按触发，避免 hover 语义在移动端失效 */
const triggerExplicit = 'trigger' in (getCurrentInstance()!.vnode.props ?? {});
const coarsePointer = ref(false);
onMounted(() => {
  coarsePointer.value =
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: none)').matches;
});
const triggerList = computed<TooltipTrigger[]>(() => {
  if (!triggerExplicit) return coarsePointer.value ? ['click'] : ['hover', 'focus'];
  return Array.isArray(props.trigger) ? props.trigger : [props.trigger];
});
const hasHover = computed(() => triggerList.value.includes('hover'));
const hasFocus = computed(() => triggerList.value.includes('focus'));
const hasClick = computed(() => triggerList.value.includes('click'));

const triggerEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);

const { teleportTarget, popupClasses, popupTheme } = usePopupHost(() => ['k-tooltip']);
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
const triggerAttrs = { 'data-part': 'trigger' };
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
  'data-part': 'root',
  class: popupClasses.value,
  'data-k-theme': popupTheme.value,
  'data-placement': actualPlacement.value,
  role: 'tooltip',
  style: popupStyle.value,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTooltipRenderScope>(
  () => props.render,
  () => ({
    visible: visible.value,
    hasContent: hasContent.value,
    placement: actualPlacement.value,
    teleportTarget: teleportTarget.value,
    triggerEl,
    popupEl,
    triggerAttrs,
    triggerOn,
    popupAttrs: popupAttrs.value,
    popupOn,
    setOpen,
    content: props.content ?? props.title,
    slots,
  }),
);

defineSlots<{
  trigger?(): VNodeChild;
  default?(): VNodeChild;
  render?(scope: KTooltipRenderScope): VNodeChild;
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
    class="k-tooltip__trigger"
    v-on="triggerOn"
  ><slot name="trigger" /></span>

  <Teleport :to="teleportTarget" defer>
    <Transition name="k-tooltip">
    <div
      v-if="visible"
      ref="popupEl"
      v-bind="popupAttrs"
      :style="styles?.root"
      v-on="popupOn"
    >
      <span v-if="arrow" class="k-tooltip__arrow" aria-hidden="true" />
      <div class="k-tooltip__inner">
        <slot><component :is="KNode" :node="content ?? title" /></slot>
      </div>
    </div>
    </Transition>
  </Teleport>
  </template>
</template>

<style>
.k-tooltip__trigger {
  display: inline-block;
  width: auto;
}

.k-tooltip {
  --k-tooltip-bg: var(--k-color-bg-spotlight);
  --k-tooltip-color: var(--k-color-text-light-solid);
  --k-tooltip-radius: var(--k-border-radius);
  --k-tooltip-padding: var(--k-size-xs) var(--k-size);
  --k-tooltip-font-size: var(--k-font-size-sm);
  --k-tooltip-arrow-size: 8px; /* 直角等边三角形半对角 = 边长/√2，外露 ≈5.7px 略探过 gap 4 贴住触发器 */

  z-index: var(--k-z-index-popup-base);
  max-width: calc(var(--k-size) * 32);
  font-family: inherit;
}
.k-tooltip-enter-active {
  animation: k-tooltip-zoom var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-tooltip-leave-active {
  animation: k-tooltip-zoom-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
.k-tooltip__inner {
  position: relative;
  padding: var(--k-tooltip-padding);
  border-radius: var(--k-tooltip-radius);
  background-color: var(--k-tooltip-bg);
  color: var(--k-tooltip-color);
  font-size: var(--k-tooltip-font-size);
  line-height: var(--k-line-height);
  word-wrap: break-word;
}

/* 箭头：贴边小三角（clip 方块），随 data-placement 换侧 */
.k-tooltip__arrow {
  position: absolute;
  width: calc(var(--k-tooltip-arrow-size) * 2);
  height: calc(var(--k-tooltip-arrow-size) * 2);
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.k-tooltip__arrow::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: var(--k-tooltip-arrow-size);
  height: var(--k-tooltip-arrow-size);
  background-color: var(--k-tooltip-bg);
  transform: rotate(45deg);
}
/* 箭头：2s×2s 盒中心骑泡边（-2s+1 旧值把菱形整个推出泡外 = 悬空断连），外露半对角 ≈3.9px < gap 4；
   spotlight 半透明，内半被泡盖住仍会透出深色菱形 → clip-path 裁内半（留 1px 叠缝防亮线），
   clip 走本地坐标故盒子不做装饰性旋转，::before 自带 45° 已是菱形 */
.k-tooltip[data-placement^='top'] .k-tooltip__arrow {
  left: var(--k-overlay-arrow-offset, 50%);
  bottom: calc(var(--k-tooltip-arrow-size) * -1);
  transform: translateX(-50%);
  clip-path: inset(calc(50% - 1px) 0 0 0);
}
.k-tooltip[data-placement^='bottom'] .k-tooltip__arrow {
  left: var(--k-overlay-arrow-offset, 50%);
  top: calc(var(--k-tooltip-arrow-size) * -1);
  transform: translateX(-50%);
  clip-path: inset(0 0 calc(50% - 1px) 0);
}
.k-tooltip[data-placement^='left'] .k-tooltip__arrow {
  top: var(--k-overlay-arrow-offset, 50%);
  right: calc(var(--k-tooltip-arrow-size) * -1);
  transform: translateY(-50%);
  clip-path: inset(0 0 0 calc(50% - 1px));
}
.k-tooltip[data-placement^='right'] .k-tooltip__arrow {
  top: var(--k-overlay-arrow-offset, 50%);
  left: calc(var(--k-tooltip-arrow-size) * -1);
  transform: translateY(-50%);
  clip-path: inset(0 calc(50% - 1px) 0 0);
}

@keyframes k-tooltip-zoom {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: none; }
}
@keyframes k-tooltip-zoom-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: scale(0.8); }
}
</style>
