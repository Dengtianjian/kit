<template>
  <span
    ref="triggerEl"
    v-bind="triggerAttrs"
    class="k-dropdown__trigger"
    :class="classNames?.trigger"
    :style="styles?.trigger"
    v-on="triggerOn"
  >
    <slot name="trigger" />
  </span>

  <Teleport :to="teleportTarget" defer>
    <Transition name="k-dropdown">
      <div
        v-if="visible"
        ref="popupEl"
        v-bind="popupAttrs"
        :style="styles?.root"
        v-on="popupOn"
        @keydown="onMenuKeydown"
      >
        <slot>
          <template v-if="items?.length">
            <template v-for="(item, index) in items" :key="item.key">
              <div
                v-if="item.divided && index > 0"
                data-part="divider"
                class="k-dropdown__divider"
                :class="classNames?.divider"
                :style="styles?.divider"
                role="separator"
              />
              <button
                ref="itemEls"
                type="button"
                role="menuitem"
                data-part="item"
                :disabled="item.disabled"
                :aria-disabled="item.disabled || undefined"
                :tabindex="-1"
                :class="[
                  'k-dropdown__item',
                  {
                    'is-danger': item.danger,
                    'is-disabled': item.disabled,
                  },
                  classNames?.item,
                  item.danger ? classNames?.danger : undefined,
                ]"
                :style="[styles?.item, item.danger ? styles?.danger : null]"
                @click="selectItem(item)"
              >
                <span
                  v-if="item.icon"
                  data-part="icon"
                  class="k-dropdown__icon"
                  :class="classNames?.icon"
                  :style="styles?.icon"
                  aria-hidden="true"
                >
                  <component :is="item.icon" />
                </span>
                <span
                  data-part="label"
                  class="k-dropdown__label"
                  :class="classNames?.label"
                  :style="styles?.label"
                >
                  <slot name="item" :item="item" :index="index">
                    <KNode :node="item.label ?? item.key" />
                  </slot>
                </span>
              </button>
            </template>
          </template>
        </slot>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { usePopupHost, useOverlayPosition, usePopupDismiss } from '../../composables/usePopup';
import { KNode } from '../../utils/vnode';
import type { KOverlayPlacement } from '../../utils/overlay';
import type { KDropdownItem, KDropdownPart, KDropdownSize, KDropdownTrigger } from './types';

defineOptions({ name: 'KDropdown' });

interface KDropdownProps {
  items?: KDropdownItem[];
  placement?: KOverlayPlacement;
  /** 触发方式；触屏缺省改为 click */
  trigger?: KDropdownTrigger | KDropdownTrigger[];
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  /** 受控开合；不传则组件自管 */
  open?: boolean;
  disabled?: boolean;
  closeOnSelect?: boolean;
  /** 菜单 a11y 名称 */
  menuLabel?: string;
  /** 菜单尺寸；触发器尺寸由业务控件决定 */
  size?: KDropdownSize;
  classNames?: Partial<Record<KDropdownPart, string>>;
  styles?: Partial<Record<KDropdownPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KDropdownProps>(), {
  items: undefined,
  placement: 'bottomLeft',
  trigger: undefined,
  mouseEnterDelay: 0.1,
  mouseLeaveDelay: 0.1,
  disabled: false,
  closeOnSelect: true,
  menuLabel: undefined,
  size: 'md',
});

const emit = defineEmits<{
  select: [key: string | number, item: KDropdownItem];
  openChange: [open: boolean];
  'update:open': [open: boolean];
}>();

const instance = getCurrentInstance()!;
const controlled = computed(() => 'open' in (instance.vnode.props ?? {}));
const triggerExplicit = computed(() => 'trigger' in (instance.vnode.props ?? {}));
const innerOpen = ref(false);
const visible = computed(() =>
  controlled.value ? Boolean(props.open && !props.disabled) : innerOpen.value && !props.disabled,
);

const popupId = `k-dropdown-${useId()}`;
const triggerEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const itemEls = ref<HTMLButtonElement[]>([]);
const focusOnOpen = ref(false);

const coarsePointer = ref(false);
onMounted(() => {
  coarsePointer.value =
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: none)').matches;
});

const triggerList = computed<KDropdownTrigger[]>(() => {
  if (!triggerExplicit.value) return coarsePointer.value ? ['click'] : ['hover'];
  if (!props.trigger) return ['hover'];
  return Array.isArray(props.trigger) ? props.trigger : [props.trigger];
});
const hasHover = computed(() => triggerList.value.includes('hover'));
const hasClick = computed(() => triggerList.value.includes('click'));
const hasContextmenu = computed(() => triggerList.value.includes('contextmenu'));

const { teleportTarget, popupClasses, popupTheme } = usePopupHost(() => ['k-dropdown']);
const { popupStyle, actualPlacement } = useOverlayPosition({
  anchor: triggerEl,
  popup: popupEl,
  visible,
  placement: () => props.placement,
  target: teleportTarget,
  gap: 4,
});

function setOpen(value: boolean) {
  if (value && props.disabled) return;
  if (value === (controlled.value ? Boolean(props.open) : innerOpen.value)) return;
  if (!controlled.value) innerOpen.value = value;
  emit('update:open', value);
  emit('openChange', value);
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

function focusableTrigger() {
  const root = triggerEl.value;
  if (!root) return;
  const target = root.querySelector<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  (target ?? root).focus();
}

function setOpenWithFocus() {
  if (visible.value) {
    focusFirst();
    return;
  }
  focusOnOpen.value = true;
  setOpen(true);
}

function focusFirst() {
  const first = itemEls.value.findIndex(el => el && !el.disabled);
  if (first >= 0) itemEls.value[first]?.focus();
  else popupEl.value?.focus();
}

/** Teleport defer + Transition：菜单节点晚于首个 tick 挂载，等一帧再聚焦 */
async function focusFirstWhenReady() {
  await nextTick();
  await new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  await nextTick();
  if (visible.value) focusFirst();
}

function focusEdge(edge: 'first' | 'last') {
  const els = itemEls.value;
  if (edge === 'first') {
    focusFirst();
    return;
  }
  for (let i = els.length - 1; i >= 0; i -= 1) {
    if (!els[i].disabled) {
      els[i].focus();
      return;
    }
  }
}

function moveFocus(dir: 1 | -1) {
  const els = itemEls.value;
  if (!els.length) return;
  const current = els.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) {
    focusEdge(dir === 1 ? 'first' : 'last');
    return;
  }
  for (let step = 1; step <= els.length; step += 1) {
    const next = ((current + dir * step) % els.length + els.length) % els.length;
    if (!els[next].disabled) {
      els[next].focus();
      return;
    }
  }
}

const focusTriggerOnClose = ref(false);

function selectItem(item: KDropdownItem) {
  if (item.disabled) return;
  emit('select', item.key, item);
  if (props.closeOnSelect) {
    focusTriggerOnClose.value = true;
    setOpen(false);
  }
}

watch(visible, value => {
  if (value) {
    if (focusOnOpen.value) {
      focusOnOpen.value = false;
      if (visible.value) void focusFirstWhenReady();
    }
  } else if (focusTriggerOnClose.value) {
    focusTriggerOnClose.value = false;
    focusableTrigger();
  }
});

watch(
  () => props.disabled,
  value => {
    if (value) setOpen(false);
  },
);

onBeforeUnmount(() => {
  clearTimer();
  focusOnOpen.value = false;
});

usePopupDismiss(visible, () => setOpen(false), () => [triggerEl.value, popupEl.value]);

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (visible.value) {
      if (e.key === 'ArrowDown') focusFirst();
      else focusEdge('last');
    } else {
      setOpenWithFocus();
    }
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (visible.value) setOpen(false);
    else setOpenWithFocus();
    return;
  }
  if (e.key === 'Escape' && visible.value) {
    e.preventDefault();
    setOpen(false);
  }
}

function onMenuKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    moveFocus(e.key === 'ArrowDown' ? 1 : -1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    focusEdge('first');
  } else if (e.key === 'End') {
    e.preventDefault();
    focusEdge('last');
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    focusTriggerOnClose.value = true;
  } else if (e.key === 'Tab') {
    setOpen(false);
  }
}

const triggerAttrs = computed(() => ({
  'data-part': 'trigger',
  tabindex: '-1',
  'aria-haspopup': 'menu',
  'aria-expanded': visible.value ? 'true' : 'false',
  ...(visible.value ? { 'aria-controls': popupId } : {}),
}));

const triggerOn = {
  mouseenter: () => {
    if (hasHover.value) showAfter(props.mouseEnterDelay);
  },
  mouseleave: () => {
    if (hasHover.value) hideAfter(props.mouseLeaveDelay);
  },
  click: () => {
    if (hasClick.value && !props.disabled) setOpen(!visible.value);
  },
  contextmenu: (e: MouseEvent) => {
    if (!hasContextmenu.value || props.disabled) return;
    e.preventDefault();
    setOpen(true);
  },
  keydown: onTriggerKeydown,
};

const popupOn = {
  mouseenter: () => {
    if (hasHover.value) clearTimer();
  },
  mouseleave: () => {
    if (hasHover.value) hideAfter(props.mouseLeaveDelay);
  },
};

const popupAttrs = computed(() => ({
  id: popupId,
  'data-part': 'root',
  class: [...popupClasses.value, 'k-dropdown', `k-dropdown--${props.size}`, props.classNames?.root],
  'data-k-theme': popupTheme.value,
  'data-placement': actualPlacement.value,
  role: 'menu',
  tabindex: '-1',
  'aria-label': props.menuLabel,
  style: popupStyle.value,
}));

defineSlots<{
  trigger?(): unknown;
  default?(): unknown;
  item?(scope: { item: KDropdownItem; index: number }): unknown;
}>();
</script>

<style>
.k-dropdown__trigger {
  display: inline-block;
  width: auto;
}

.k-dropdown {
  --k-dropdown-bg: var(--k-color-bg-elevated);
  --k-dropdown-radius: var(--k-border-radius);
  --k-dropdown-padding: var(--k-popup-padding);
  --k-dropdown-item-height: var(--k-popup-item-height);
  --k-dropdown-item-padding-x: var(--k-popup-item-padding-x);
  --k-dropdown-font-size: var(--k-font-size);
  --k-dropdown-min-width: calc(var(--k-size) * 10);
  --k-dropdown-max-width: calc(var(--k-size) * 56);

  z-index: var(--k-z-index-popup-base);
  box-sizing: border-box;
  min-width: var(--k-dropdown-min-width);
  max-width: var(--k-dropdown-max-width);
  padding: var(--k-dropdown-padding);
  border-radius: var(--k-dropdown-radius);
  background: var(--k-dropdown-bg);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-dropdown-font-size);
  line-height: var(--k-line-height);
  box-shadow: var(--k-box-shadow-secondary);
}
.k-dropdown--sm {
  --k-dropdown-item-height: var(--k-popup-item-height-sm);
  --k-dropdown-font-size: var(--k-font-size-sm);
  --k-dropdown-min-width: calc(var(--k-size) * 9);
}
.k-dropdown--lg {
  --k-dropdown-item-height: var(--k-popup-item-height-lg);
  --k-dropdown-font-size: var(--k-font-size-lg);
  --k-dropdown-min-width: calc(var(--k-size) * 12);
}
.k-dropdown__item {
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--k-dropdown-item-height);
  padding: 0 var(--k-dropdown-item-padding-x);
  border: 0;
  border-radius: calc(var(--k-dropdown-radius) - var(--k-size-xxs));
  background: transparent;
  color: var(--k-color-text);
  font: inherit;
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-dropdown__item:hover:not(.is-disabled),
.k-dropdown__item:focus-visible {
  background: var(--k-color-fill-secondary);
  outline: none;
}
.k-dropdown__item:focus-visible {
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-dropdown__item.is-danger {
  color: var(--k-color-error);
}
.k-dropdown__item.is-danger:hover:not(.is-disabled) {
  background: var(--k-color-error-bg);
}
.k-dropdown__item.is-disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-dropdown__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  font-size: 1em;
}
.k-dropdown__label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-dropdown__divider {
  height: var(--k-line-width);
  margin: var(--k-size-xxs) calc(var(--k-size-xxs) * -1);
  background: var(--k-color-border-secondary);
}

.k-dropdown-enter-active {
  animation: k-dropdown-zoom var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-dropdown-leave-active {
  animation: k-dropdown-zoom-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
@keyframes k-dropdown-zoom {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes k-dropdown-zoom-out {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: scale(0.96);
  }
}
@media (prefers-reduced-motion: reduce) {
  .k-dropdown-enter-active,
  .k-dropdown-leave-active {
    animation: none;
  }
}
</style>