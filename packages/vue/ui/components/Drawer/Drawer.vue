<template>
  <Teleport :to="teleportTarget" defer>
    <Transition name="k-drawer" :duration="300" @after-leave="onAfterLeave">
      <div
        v-if="openState"
        data-part="root"
        class="k-drawer"
        :class="[
          popupClasses,
          `k-drawer--${placement}`,
          `k-drawer--${size}`,
          classNames?.root,
        ]"
        :data-k-theme="popupTheme"
      >
        <div
          v-if="mask"
          data-part="mask"
          class="k-drawer__mask"
          :class="classNames?.mask"
          :style="styles?.mask"
          @click="onMaskClick"
        />
        <section
          ref="panelEl"
          data-part="panel"
          class="k-drawer__panel"
          :class="classNames?.panel"
          :style="[sizeStyle, styles?.panel]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <header data-part="header" class="k-drawer__header" :class="classNames?.header" :style="styles?.header">
            <div :id="titleId" data-part="title" class="k-drawer__title" :class="classNames?.title" :style="styles?.title">
              <slot name="header">
                <slot name="title">{{ title }}</slot>
              </slot>
            </div>
            <button
              v-if="closable"
              type="button"
              data-part="close"
              class="k-drawer__close"
              :class="classNames?.close"
              :style="styles?.close"
              aria-label="关闭"
              @click="requestClose($event)"
            >
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
                <path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" />
              </svg>
            </button>
          </header>
          <div data-part="body" class="k-drawer__body" :class="classNames?.body" :style="styles?.body">
            <slot>
              <KNode :node="content" />
            </slot>
          </div>
          <footer
            v-if="$slots.footer || footer !== undefined"
            data-part="footer"
            class="k-drawer__footer"
            :class="classNames?.footer"
            :style="styles?.footer"
          >
            <slot name="footer">
              <KNode :node="footer" />
            </slot>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import { useKApp } from '../../composables/useKApp';
import { useKConfig } from '../../composables/useKConfig';
import { usePopupHost } from '../../composables/usePopup';
import { lockBody, unlockBody } from '../../utils/scrollLock';
import { isTopOverlay, pushOverlay, removeOverlay } from '../../utils/overlayStack';
import type { KDrawerPart, KDrawerPlacement, KDrawerSize } from './types';

defineOptions({ name: 'KDrawer' });

interface KDrawerProps {
  /** 受控开合；配合 v-model:open 使用 */
  open?: boolean;
  title?: string | VNodeChild;
  content?: string | VNodeChild;
  footer?: string | VNodeChild;
  placement?: KDrawerPlacement;
  size?: KDrawerSize;
  width?: number | string;
  height?: number | string;
  closable?: boolean;
  mask?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  classNames?: Partial<Record<KDrawerPart, string>>;
  styles?: Partial<Record<KDrawerPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KDrawerProps>(), {
  open: undefined,
  placement: 'right',
  size: 'md',
  closable: true,
  mask: true,
  maskClosable: true,
  keyboard: true,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
  close: [e: MouseEvent | KeyboardEvent];
  afterClose: [];
}>();

const instance = getCurrentInstance()!;
const controlled = computed(() => 'open' in (instance.vnode.props ?? {}));
const innerOpen = ref(false);
const openState = computed(() => (controlled.value ? Boolean(props.open) : innerOpen.value));

const appCtx = useKApp();
const config = useKConfig();
const { popupClasses, popupTheme } = usePopupHost();
const teleportTarget = computed(() => {
  const root = appCtx?.root.value;
  if (root) return root;
  const container = config?.popupContainer.value;
  return container ? (container instanceof HTMLElement ? container : container()) : 'body';
});

const titleId = `k-drawer-title-${useId()}`;
const panelEl = ref<HTMLElement | null>(null);
let restoreFocus: HTMLElement | null = null;

const horizontal = computed(() => props.placement === 'left' || props.placement === 'right');
const sizeStyle = computed<CSSProperties>(() => {
  const raw = horizontal.value ? props.width : props.height;
  if (raw === undefined) return {};
  const value = typeof raw === 'number' ? `${raw}px` : raw;
  return horizontal.value ? { width: value } : { height: value };
});

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    el =>
      el.getAttribute('aria-hidden') !== 'true' &&
      el.getClientRects().length > 0,
  );
}

function focusInitial(panel: HTMLElement) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== panel && panel.contains(active)) return;
  const auto = panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
  const body = panel.querySelector<HTMLElement>('[data-part="body"]');
  const footer = panel.querySelector<HTMLElement>('[data-part="footer"]');
  const target =
    auto ??
    (body && getFocusable(body)[0]) ??
    (footer && getFocusable(footer)[0]) ??
    panel;
  target.focus();
}

function trapTab(e: KeyboardEvent) {
  const panel = panelEl.value;
  if (!panel) return;
  const items = getFocusable(panel);
  if (!items.length) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === panel || !panel.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
    return;
  }
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!isTopOverlay(panelEl.value)) return;
  if (e.key === 'Escape' && props.keyboard) {
    e.stopPropagation();
    requestClose(e);
    return;
  }
  if (e.key === 'Tab') trapTab(e);
}

function requestClose(e: MouseEvent | KeyboardEvent) {
  if (!controlled.value) innerOpen.value = false;
  emit('update:open', false);
  emit('close', e);
}

function onMaskClick(e: MouseEvent) {
  if (props.maskClosable) requestClose(e);
}

watch(
  openState,
  async (value, old) => {
    if (!value && old === undefined) return;
    if (typeof document === 'undefined') return;
    if (value) {
      lockBody();
      document.addEventListener('keydown', onKeydown);
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      await nextTick();
      const panel = panelEl.value;
      if (panel) {
        pushOverlay(panel);
        focusInitial(panel);
      }
    } else {
      unlockBody();
      document.removeEventListener('keydown', onKeydown);
      if (panelEl.value) removeOverlay(panelEl.value);
    }
  },
  { immediate: true },
);

function onAfterLeave() {
  if (!openState.value && restoreFocus) {
    if (restoreFocus.isConnected) restoreFocus.focus({ preventScroll: true });
    restoreFocus = null;
  }
  emit('afterClose');
}

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', onKeydown);
  if (panelEl.value) removeOverlay(panelEl.value);
  if (openState.value) unlockBody();
});

defineSlots<{
  default?(): VNodeChild;
  header?(): VNodeChild;
  title?(): VNodeChild;
  footer?(): VNodeChild;
}>();
</script>

<style>
.k-drawer {
  --k-drawer-size: 378px;

  position: fixed;
  inset: 0;
  z-index: var(--k-z-index-popup-base);
  font-family: inherit;
}
.k-drawer--sm {
  --k-drawer-size: 320px;
}
.k-drawer--lg {
  --k-drawer-size: 480px;
}
.k-drawer__mask {
  position: absolute;
  inset: 0;
  z-index: var(--k-z-index-mask);
  background: rgb(0 0 0 / 45%);
}
.k-drawer__panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  z-index: calc(var(--k-z-index-mask) + 1);
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
  box-shadow: var(--k-box-shadow-secondary);
  outline: none;
}
.k-drawer--left .k-drawer__panel {
  inset-block: 0;
  inset-inline-start: 0;
  width: var(--k-drawer-size);
  max-width: 100%;
}
.k-drawer--right .k-drawer__panel {
  inset-block: 0;
  inset-inline-end: 0;
  width: var(--k-drawer-size);
  max-width: 100%;
}
.k-drawer--top .k-drawer__panel {
  inset-inline: 0;
  top: 0;
  height: var(--k-drawer-size);
  max-height: 100%;
}
.k-drawer--bottom .k-drawer__panel {
  inset-inline: 0;
  bottom: 0;
  height: var(--k-drawer-size);
  max-height: 100%;
}
.k-drawer__header {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--k-size-sm);
  padding: var(--k-size) var(--k-size-lg);
  border-bottom: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-drawer__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--k-color-text);
  font-size: var(--k-font-size-lg);
  font-weight: var(--k-font-weight-strong);
  line-height: var(--k-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-drawer__close {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--k-control-height-sm);
  height: var(--k-control-height-sm);
  padding: 0;
  border: 0;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size);
  cursor: pointer;
  transition:
    background var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-drawer__close:hover {
  background: var(--k-color-fill-secondary);
  color: var(--k-color-text);
}
.k-drawer__close:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-drawer__body {
  flex: 1;
  min-height: 0;
  padding: var(--k-size-lg);
  overflow: auto;
}
.k-drawer__footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: var(--k-size-sm);
  padding: var(--k-size) var(--k-size-lg);
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
}

.k-drawer-enter-active .k-drawer__panel,
.k-drawer-leave-active .k-drawer__panel {
  transition: transform var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-drawer-enter-active .k-drawer__mask,
.k-drawer-leave-active .k-drawer__mask {
  transition: opacity var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-drawer-enter-from .k-drawer__mask,
.k-drawer-leave-to .k-drawer__mask {
  opacity: 0;
}
.k-drawer--left.k-drawer-enter-from .k-drawer__panel,
.k-drawer--left.k-drawer-leave-to .k-drawer__panel {
  transform: translateX(-100%);
}
.k-drawer--right.k-drawer-enter-from .k-drawer__panel,
.k-drawer--right.k-drawer-leave-to .k-drawer__panel {
  transform: translateX(100%);
}
.k-drawer--top.k-drawer-enter-from .k-drawer__panel,
.k-drawer--top.k-drawer-leave-to .k-drawer__panel {
  transform: translateY(-100%);
}
.k-drawer--bottom.k-drawer-enter-from .k-drawer__panel,
.k-drawer--bottom.k-drawer-leave-to .k-drawer__panel {
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .k-drawer-enter-active .k-drawer__panel,
  .k-drawer-leave-active .k-drawer__panel,
  .k-drawer-enter-active .k-drawer__mask,
  .k-drawer-leave-active .k-drawer__mask {
    transition: none;
  }
}
</style>