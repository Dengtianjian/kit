<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <template v-else>
  <span
    v-if="$slots.trigger"
    v-bind="triggerAttrs"
    class="k-modal__trigger"
    v-on="triggerOn"
  ><slot name="trigger" /></span>

  <Teleport :to="teleportTarget" defer>
    <Transition name="k-modal" @after-leave="onAfterLeave">
    <div
      v-if="openState"
      v-bind="rootAttrs"
      class="k-modal"
      :class="classNames?.root"
      :style="styles?.root"
    >
      <div v-if="mask" v-bind="maskAttrs" class="k-modal__mask" :class="classNames?.mask" :style="styles?.mask" />
      <div
        v-bind="wrapAttrs"
        class="k-modal__wrap"
        :class="classNames?.wrap"
        :style="styles?.wrap"
        v-on="wrapOn"
      >
        <div
          ref="dialogEl"
          v-bind="dialogAttrs"
          class="k-modal__dialog"
          :class="[classNames?.dialog, { 'is-zoomed': zoomed }]"
          :style="styles?.dialog"
        >
          <div
            v-bind="headerAttrs"
            class="k-modal__header"
            :class="[classNames?.header, { 'is-draggable': draggable, 'is-dragging': dragging }]"
            :style="styles?.header"
            v-on="headerOn"
          >
            <div data-part="title" class="k-modal__title" :class="classNames?.title" :style="styles?.title">
              <span v-if="icon" class="k-modal__icon" aria-hidden="true"><component :is="KNode" :node="icon" /></span>
              <component v-if="title" :is="KNode" :node="title" />
              <slot v-else name="title" />
            </div>
            <button
              v-if="closable"
              type="button"
              class="k-modal__close"
              aria-label="关闭"
              @click="requestClose($event)"
            >
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" /></svg>
            </button>
          </div>
          <div data-part="body" class="k-modal__body" :class="classNames?.body" :style="styles?.body">
            <slot><component :is="KNode" :node="content" /></slot>
          </div>
          <div
            v-if="$slots.footer"
            data-part="footer"
            class="k-modal__footer"
            :class="classNames?.footer"
            :style="styles?.footer"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
  </template>
</template>

<script lang="ts">
/* 滚动锁模块计数：多模态叠层只由最后一个释放（普通 script 块 = 模块作用域） */
import { installPointerRecorder } from '../../utils/interaction';
installPointerRecorder(); // 模块装载即挂 capture 记录器，早于任何首次点击（SSR 内部有守卫）
let bodyLockCount = 0;
function lockBody() {
  if (bodyLockCount++ === 0 && typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }
}
function unlockBody() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0 && typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNode, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import { useKApp } from '../../composables/useKApp';
import { useKConfig } from '../../composables/useKConfig';
import { usePopupHost } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import { getLastPointer } from '../../utils/interaction';
import type { KModalPlacement } from './service';

defineOptions({ name: 'KModal' });

type ModalPart = 'root' | 'mask' | 'wrap' | 'dialog' | 'header' | 'title' | 'body' | 'footer';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KModalRenderScope {
  open: boolean;
  title: string | VNode | undefined;
  content: string | VNode | undefined;
  icon: string | VNode | undefined;
  /** 归一化后的 CSS 宽度值 */
  width: string;
  placement: KModalPlacement;
  mask: boolean;
  maskClosable: boolean;
  keyboard: boolean;
  closable: boolean;
  draggable: boolean;
  dragging: boolean;
  /** 原点测好、动画放行标记（自绘 dialog 的可见性门） */
  zoomed: boolean;
  teleportTarget: HTMLElement | string;
  dialogEl: Ref<HTMLElement | null>;
  rootAttrs: Record<string, unknown>;
  maskAttrs: Record<string, unknown>;
  wrapAttrs: Record<string, unknown>;
  wrapOn: Record<string, (e: Event) => void>;
  /** width + 拖拽位移 + 动画原点变量（布局逻辑） */
  dialogAttrs: Record<string, unknown>;
  headerAttrs: Record<string, unknown>;
  headerOn: Record<string, (e: Event) => void>;
  triggerOn: Record<string, (e: Event) => void>;
  requestOpen: () => void;
  requestClose: (e: MouseEvent | KeyboardEvent) => void;
  /** 自绘退场动画结束后调用：复位 zoom 态 + 发 afterClose */
  onAfterLeave: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KModalProps {
  /** 受控开合（v-model:open）；不传 = 组件自管（trigger 点击开、X/蒙层/Esc 关） */
  open?: boolean;
  title?: string | VNode;
  /** 默认插槽为空时的内容（命令式服务用） */
  content?: string | VNode;
  /** 标题前行图标（功能型弹窗用） */
  icon?: string | VNode;
  /** px 数值或 CSS 宽度串（antd modalWidth 同款默认 520） */
  width?: number | string;
  /** 九宫格屏幕落位：弹窗打开后停在视口哪一格（缘距沿用 wrap 留白：上/下 80、左/右 24、center 20） */
  placement?: KModalPlacement;
  mask?: boolean;
  maskClosable?: boolean;
  /** Esc 关闭 */
  keyboard?: boolean;
  closable?: boolean;
  /** 头部拖拽移动弹窗（naive draggable 同款） */
  draggable?: boolean;
  /** 动画原点覆盖（拍板：显式传 > 最近 pointerdown 自动记录 > 中心缩放） */
  source?: Element;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KModalRenderScope>;
  classNames?: Partial<Record<ModalPart, string>>;
  styles?: Partial<Record<ModalPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KModalProps>(), {
  open: false,
  width: 520,
  placement: 'top',
  mask: true,
  maskClosable: true,
  keyboard: true,
  closable: true,
  draggable: false,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
  /** 关闭 X / 点蒙层 / Esc（均走 requestClose，与 open 对称） */
  close: [e: MouseEvent | KeyboardEvent];
  /** 退场动画结束、节点移除后发出（命令式 Holder 据此真正出队） */
  afterClose: [];
}>();

const appCtx = useKApp();
const config = useKConfig();
const innerOpen = ref(false);
// Vue 对 Boolean prop 做 absent→false 强转，`props.open !== undefined` 判受控恒真；改查原始 vnode props
const instance = getCurrentInstance()!;
const controlled = computed(() => 'open' in (instance.vnode.props ?? {}));
const openState = computed(() => (controlled.value ? props.open : innerOpen.value));
/* 出口 = KApp root > popupContainer > body；scopeClass/scheme 随节点走（契约④） */
const { popupClasses, popupTheme } = usePopupHost();
const teleportTarget = computed(() => {
  const c = appCtx?.root.value;
  if (c) return c;
  const pc = config?.popupContainer.value;
  return pc ? (pc instanceof HTMLElement ? pc : pc()) : 'body';
});

const dialogEl = ref<HTMLElement | null>(null);

/* 原点缩放：dialog 挂载帧先 visibility:hidden，测完触发源再放动画（transform-origin 必须在动画开始前落定）。
   统一走 --k-modal-transform-origin 变量：source/最近 pointer 写内联，业务 CSS 覆写该变量即可自定义原点
   （styles.dialog 内联通道优先级最高）；落位（placement）只管屏幕位置，不参与动画原点 */
const zoomed = ref(false);
const zoomOrigin = ref<Record<string, string>>({});
function applyOrigin() {
  const dialog = dialogEl.value;
  if (!dialog) return;
  const src = props.source ?? getLastPointer();
  if (!src) return;
  const s = src.getBoundingClientRect();
  if (!s.width && !s.height) return; // 已卸载元素 rect 全 0，别把 (0,0) 当原点
  const d = dialog.getBoundingClientRect();
  zoomOrigin.value = {
    '--k-modal-transform-origin': `${s.left + s.width / 2 - d.left}px ${s.top + s.height / 2 - d.top}px`,
  };
}

/* 头部拖拽：独立 translate 属性承载位移，与 zoom 的 transform:scale 复合不打架。
   pointer capture 挂 header，出窗也不丢事件；关闭钮区域不启动拖拽 */
const dragX = ref(0);
const dragY = ref(0);
const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let dragBaseX = 0;
let dragBaseY = 0;
function onDragStart(e: PointerEvent) {
  if (!props.draggable || dragging.value) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.k-modal__close')) return;
  dragging.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragBaseX = dragX.value;
  dragBaseY = dragY.value;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
}
function onDragMove(e: PointerEvent) {
  if (!dragging.value) return;
  dragX.value = dragBaseX + e.clientX - dragStartX;
  dragY.value = dragBaseY + e.clientY - dragStartY;
}
function onDragEnd() {
  dragging.value = false;
}

const widthCss = computed(() =>
  typeof props.width === 'number' ? `${props.width}px` : props.width,
);
const dialogStyle = computed(() => ({
  width: widthCss.value,
  ...(props.draggable ? { translate: `${dragX.value}px ${dragY.value}px` } : {}),
  ...zoomOrigin.value,
}));

function requestClose(e: MouseEvent | KeyboardEvent) {
  if (!controlled.value) innerOpen.value = false;
  emit('update:open', false);
  emit('close', e);
}
function requestOpen() {
  if (!controlled.value) innerOpen.value = true;
  emit('update:open', true);
}
function onMaskClick() {
  if (props.maskClosable) requestClose(new MouseEvent('click'));
}
/* wrap 抬层压过 mask 后，遮罩区域的命中目标变成透明 wrap：外点判定改为「点到 wrap 本身」 */
function onWrapClick(e: MouseEvent) {
  if (e.target === e.currentTarget) onMaskClick();
}
function onKeydown(e: KeyboardEvent) {
  if (props.keyboard && e.key === 'Escape') requestClose(e);
}

/* 打开时滚动锁定（模块计数，见顶部 script 块） */
watch(
  openState,
  async (v, old) => {
    if (!v && old === undefined) return; // 首挂即关：不动锁计数，避免误释放他模态的锁
    if (typeof document === 'undefined') return;
    if (v) {
      lockBody();
      document.addEventListener('keydown', onKeydown);
      zoomed.value = false; // 退场中途重开也重起 zoom：先落回隐藏门再放行
      dragX.value = 0; // 重开回位：拖拽位移不跨开合保留
      dragY.value = 0;
      await nextTick();
      applyOrigin();
      zoomed.value = true;
      dialogEl.value?.focus();
    } else {
      unlockBody();
      document.removeEventListener('keydown', onKeydown);
      // zoomed/zoomOrigin 留到 after-leave 复位：退场动画期间 dialog 仍需可见
    }
  },
  { immediate: true },
);
function onAfterLeave() {
  zoomed.value = false;
  zoomOrigin.value = {};
  emit('afterClose');
}
onBeforeUnmount(() => {
  if (openState.value && typeof document !== 'undefined') {
    unlockBody();
    document.removeEventListener('keydown', onKeydown);
  }
});

/* ---------- headless 绑定包：事件收进 script，默认模板与自绘共用 ---------- */
const slots = useSlots();
const triggerAttrs = { 'data-part': 'trigger' };
const triggerOn = { click: () => requestOpen() };
const maskAttrs = { 'data-part': 'mask' };
const wrapAttrs = { 'data-part': 'wrap' };
const wrapOn = { click: (e: Event) => onWrapClick(e as MouseEvent) };
const headerAttrs = { 'data-part': 'header' };
const headerOn = {
  pointerdown: (e: Event) => onDragStart(e as PointerEvent),
  pointermove: (e: Event) => onDragMove(e as PointerEvent),
  pointerup: () => onDragEnd(),
  pointercancel: () => onDragEnd(),
};
const rootAttrs = computed(() => ({
  'data-part': 'root',
  class: popupClasses.value,
  'data-k-theme': popupTheme.value,
  'data-placement': props.placement,
}));
const dialogAttrs = computed(() => ({
  'data-part': 'dialog',
  role: 'dialog',
  'aria-modal': 'true',
  tabindex: '-1',
  style: dialogStyle.value,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KModalRenderScope>(
  () => props.render,
  () => ({
    open: openState.value,
    title: props.title,
    content: props.content,
    icon: props.icon,
    width: widthCss.value,
    placement: props.placement,
    mask: props.mask,
    maskClosable: props.maskClosable,
    keyboard: props.keyboard,
    closable: props.closable,
    draggable: props.draggable,
    dragging: dragging.value,
    zoomed: zoomed.value,
    teleportTarget: teleportTarget.value,
    dialogEl,
    rootAttrs: rootAttrs.value,
    maskAttrs,
    wrapAttrs,
    wrapOn,
    dialogAttrs: dialogAttrs.value,
    headerAttrs,
    headerOn,
    triggerOn,
    requestOpen,
    requestClose,
    onAfterLeave,
    slots,
  }),
);

defineSlots<{
  trigger?(): VNodeChild;
  title?(): VNodeChild;
  default?(): VNodeChild;
  footer?(): VNodeChild;
  render?(scope: KModalRenderScope): VNodeChild;
}>();
</script>

<style>
.k-modal__trigger {
  display: inline-block;
}

.k-modal__mask {
  --k-modal-mask-bg: rgb(0 0 0 / 45%); /* 破格登记：遮罩语义 = 压暗背景，恒定黑不随主题文字色反相（--k-color-split 同款先例） */

  position: fixed;
  inset: 0;
  z-index: var(--k-z-index-mask);
  background-color: var(--k-modal-mask-bg);
}

.k-modal {
  --k-modal-bg: var(--k-color-bg-elevated);
  --k-modal-radius: var(--k-border-radius-lg);
  --k-modal-padding: calc(var(--k-size-lg) + var(--k-size-xxs));
  --k-modal-header-pad-x: var(--k-size-lg);
  --k-modal-title-color: var(--k-color-text);
  /* 内容滚动：dialog 限高 = 视口 − wrap 上下留白（上/下排 80×2）；超高时 body 内滚，头/脚不动 */
  --k-modal-max-height: calc(100vh - var(--k-size) * 10);

  position: fixed;
  inset: 0;
  z-index: var(--k-z-index-modal);
  /* dialog 限高限宽恒 fits 视口，root 无需滚动；hidden 防拖拽出界时出滚动条挤 wrap（底锚定落位会跳 15px） */
  overflow: hidden;
  outline: 0;
  font-family: inherit;
}
/* 中排（left/center/right）垂直居中：留白收 20，限高同步换档 */
.k-modal[data-placement='left'],
.k-modal[data-placement='center'],
.k-modal[data-placement='right'] {
  --k-modal-max-height: calc(100vh - var(--k-size-md) * 2);
}
.k-modal__wrap {
  /* mask 在 root 上下文内 z=mask(1300) > wrap(auto) 会盖住弹窗；本地抬一级（root 已是 1400 上下文） */
  position: relative;
  z-index: calc(var(--k-z-index-mask) + 1);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  /* 九宫格落位：纵轴 justify（上排缺省 flex-start）× 横轴 align（中列缺省 center） */
  justify-content: flex-start;
  align-items: center;
  padding: calc(var(--k-size) * 5) var(--k-size-lg);
  box-sizing: border-box;
}
.k-modal[data-placement='left'] .k-modal__wrap,
.k-modal[data-placement='right'] .k-modal__wrap {
  justify-content: center;
  padding: var(--k-size-md) var(--k-size-lg);
}
.k-modal[data-placement='center'] .k-modal__wrap {
  justify-content: center;
  padding: var(--k-size-md);
}
.k-modal[data-placement='top-left'] .k-modal__wrap,
.k-modal[data-placement='left'] .k-modal__wrap,
.k-modal[data-placement='bottom-left'] .k-modal__wrap {
  align-items: flex-start;
}
.k-modal[data-placement='top-right'] .k-modal__wrap,
.k-modal[data-placement='right'] .k-modal__wrap,
.k-modal[data-placement='bottom-right'] .k-modal__wrap {
  align-items: flex-end;
}
.k-modal[data-placement^='bottom'] .k-modal__wrap {
  justify-content: flex-end;
}

.k-modal__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - var(--k-size) * 2);
  max-height: var(--k-modal-max-height);
  /* 原点统一变量通道：pointer 记录写内联，业务 CSS 覆写即自定义动画原点 */
  transform-origin: var(--k-modal-transform-origin, 50% 50%);
  background-color: var(--k-modal-bg);
  border-radius: var(--k-modal-radius);
  box-shadow: var(--k-box-shadow-secondary);
  /* 滚动 body 贴边时裁进圆角 */
  overflow: hidden;
  outline: none;
}
/* 动画延迟到原点测好后放行：挂载帧不可见 → applyOrigin → is-zoomed 起 zoom（transform-origin 已落定） */
.k-modal__dialog:not(.is-zoomed) {
  visibility: hidden;
}
.k-modal__dialog.is-zoomed {
  animation: k-modal-zoom var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
}
/* 进出场淡入淡出挂在 root 上：Transition 只读根节点的动画时长来判定结束，子节点动画不算数 */
.k-modal-enter-active {
  animation: k-modal-fade-in var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
}
.k-modal-leave-active {
  animation: k-modal-fade-out var(--k-motion-duration-mid) var(--k-motion-ease-in-cubic);
}
/* 同特异性压过 .is-zoomed 的进场动画，须排在其后 */
.k-modal-leave-active .k-modal__dialog {
  animation: k-modal-zoom-out var(--k-motion-duration-mid) var(--k-motion-ease-in-cubic);
}
.k-modal__dialog *,
.k-modal__dialog *::before,
.k-modal__dialog *::after {
  box-sizing: border-box;
}

.k-modal__header {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: var(--k-size-xs);
  padding: var(--k-modal-padding) var(--k-modal-header-pad-x) var(--k-size-sm);
}
/* 拖拽把手 = 整个 header（naive 同款）；touch-action 关掉触屏原生滚动/缩放手势，位移全归 pointer 链 */
.k-modal__header.is-draggable {
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.k-modal__header.is-dragging {
  cursor: grabbing;
}
.k-modal__title {
  flex: auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  color: var(--k-modal-title-color);
  font-size: var(--k-font-size-lg);
  font-weight: var(--k-font-weight-strong);
  line-height: var(--k-line-height);
}
.k-modal__icon {
  flex: none;
  display: inline-flex;
  font-size: calc(var(--k-font-size-lg) * 1.2);
}
.k-modal__close {
  flex: none;
  display: inline-flex;
  padding: var(--k-size-xxs);
  margin: calc(var(--k-size-xxs) * -1) calc(var(--k-size-xxs) * -1) 0 0;
  border: none;
  border-radius: var(--k-border-radius);
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size);
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-modal__close:hover {
  color: var(--k-color-text);
}

.k-modal__body {
  flex: auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 var(--k-modal-header-pad-x) var(--k-size-md);
  color: var(--k-color-text);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
  word-break: break-word;
  scrollbar-width: thin;
  scrollbar-color: var(--k-color-fill-secondary) transparent;
}
.k-modal__body::-webkit-scrollbar {
  width: 6px;
}
.k-modal__body::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: var(--k-color-fill-secondary);
}
.k-modal__body::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-fill);
}

.k-modal__footer {
  flex: none;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--k-size-xs);
  padding: var(--k-size-md) var(--k-modal-header-pad-x) var(--k-modal-padding);
}

@keyframes k-modal-zoom {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: none; }
}
@keyframes k-modal-zoom-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: scale(0.3); }
}
@keyframes k-modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes k-modal-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@media (hover: none) {
  .k-modal__close {
    padding: 10px;
    margin: -10px -10px 0 0;
  }
  .k-modal__footer {
    padding-bottom: calc(var(--k-modal-padding) + env(safe-area-inset-bottom, 0px));
  }
}
</style>
