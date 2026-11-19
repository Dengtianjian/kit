<template>
  <ul
    ref="rootEl"
    data-part="root"
    role="menu"
    :aria-label="menuLabel"
    :aria-orientation="mode === 'horizontal' ? 'horizontal' : 'vertical'"
    tabindex="0"
    class="k-menu"
    :class="[
      `k-menu--${mode}`,
      {
        'is-collapsed': collapsed,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
    @focus="onRootFocus"
    @keydown="onRootKeydown"
  >
    <component :is="MenuList" :items="items" :level="0" :path="''" :inline="inlineTree" />
  </ul>
</template>

<script setup lang="ts">
import {
  Fragment,
  Teleport,
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  useId,
  watch,
} from 'vue';
import type { CSSProperties, Component, ComputedRef, InjectionKey, PropType, Ref, VNode } from 'vue';
import { RouterLink } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import { usePopupDismiss, useOverlayPosition, usePopupHost } from '../../composables/usePopup';
import { onProps } from '../../composables/useCustomRender';
import { K_SIDER_KEY } from '../Layout/context';
import { KNode } from '../../utils/vnode';
import type { KOverlayPlacement } from '../../utils/overlay';
import type { KMenuItem, KMenuMode, KMenuPart, KMenuSubmenuTrigger } from './types';

defineOptions({ name: 'KMenu' });

interface KMenuProps {
  items: KMenuItem[];
  mode?: KMenuMode;
  /** 多选：点击切换选中项 */
  multiple?: boolean;
  /** 折叠态；不传则自动读父级 KLayoutSider */
  collapsed?: boolean;
  submenuTrigger?: KMenuSubmenuTrigger;
  menuLabel?: string;
  classNames?: Partial<Record<KMenuPart, string>>;
  styles?: Partial<Record<KMenuPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KMenuProps>(), {
  items: () => [],
  mode: 'inline',
  multiple: false,
  collapsed: undefined,
  submenuTrigger: 'hover',
  menuLabel: undefined,
});

const emit = defineEmits<{
  select: [key: string, item: KMenuItem];
  openChange: [keys: string[]];
  'update:selectedKeys': [keys: string[]];
  'update:openKeys': [keys: string[]];
}>();

const selectedKeys = defineModel<string[]>('selectedKeys', { default: () => [] });
const openKeys = defineModel<string[]>('openKeys', { default: () => [] });

const instance = getCurrentInstance()!;
const sider = inject(K_SIDER_KEY, undefined);
const hasCollapsedProp = 'collapsed' in (instance.vnode.props ?? {});
const collapsed = computed(() =>
  hasCollapsedProp ? Boolean(props.collapsed) : Boolean(sider?.collapsed.value),
);
const inlineTree = computed(() => props.mode === 'inline' && !collapsed.value);

const uid = useId();
const rootEl = ref<HTMLElement | null>(null);
const activePopup = ref<string | null>(null);
const activePopupHeader = ref<HTMLElement | null>(null);

function itemId(path: string) {
  return `${uid}-item-${path || 'root'}`;
}
function submenuId(path: string) {
  return `${uid}-sub-${path || 'root'}`;
}
function submenuListId(path: string) {
  return `${uid}-sublist-${path || 'root'}`;
}
function popupId(path: string) {
  return `${uid}-popup-${path || 'root'}`;
}

function hasSelected(item: KMenuItem): boolean {
  if (!item.children?.length) return selectedKeys.value.includes(item.key);
  return item.children.some(hasSelected);
}

function selectItem(item: KMenuItem) {
  if (item.disabled) return;
  if (props.multiple) {
    const set = new Set(selectedKeys.value);
    if (set.has(item.key)) set.delete(item.key);
    else set.add(item.key);
    selectedKeys.value = [...set];
  } else {
    selectedKeys.value = [item.key];
  }
  emit('select', item.key, item);
  const popupHeader = activePopupHeader.value;
  activePopup.value = null;
  activePopupHeader.value = null;
  if (popupHeader) nextTick(() => popupHeader.focus());
}

function toggleOpen(key: string) {
  const has = openKeys.value.includes(key);
  openKeys.value = has ? openKeys.value.filter(item => item !== key) : [...openKeys.value, key];
  emit('openChange', openKeys.value);
}

interface KMenuContext {
  mode: ComputedRef<KMenuMode>;
  collapsed: ComputedRef<boolean>;
  selectedKeys: Ref<string[]>;
  openKeys: Ref<string[]>;
  activePopup: Ref<string | null>;
  activePopupHeader: Ref<HTMLElement | null>;
  submenuTrigger: ComputedRef<KMenuSubmenuTrigger>;
  classNames: KMenuProps['classNames'];
  styles: KMenuProps['styles'];
  hasSelected: (item: KMenuItem) => boolean;
  selectItem: (item: KMenuItem) => void;
  toggleOpen: (key: string) => void;
  itemId: (path: string) => string;
  submenuId: (path: string) => string;
  submenuListId: (path: string) => string;
  popupId: (path: string) => string;
}

const K_MENU_KEY: InjectionKey<KMenuContext> = Symbol('k-menu');

provide(K_MENU_KEY, {
  mode: computed(() => props.mode),
  collapsed,
  selectedKeys,
  openKeys,
  activePopup,
  activePopupHeader,
  submenuTrigger: computed(() => props.submenuTrigger),
  classNames: props.classNames,
  styles: props.styles,
  hasSelected,
  selectItem,
  toggleOpen,
  itemId,
  submenuId,
  submenuListId,
  popupId,
});

function menuItemElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
    el =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-disabled') !== 'true' &&
      el.getClientRects().length > 0,
  );
}

function focusItem(el: HTMLElement | undefined) {
  el?.focus();
}

function moveFocus(container: HTMLElement | null, current: HTMLElement | Element | null, dir: 1 | -1) {
  const els = menuItemElements(container);
  if (!els.length) return;
  const index = els.indexOf(current as HTMLElement);
  if (index < 0) {
    focusItem(dir === 1 ? els[0] : els[els.length - 1]);
    return;
  }
  focusItem(els[(index + dir + els.length) % els.length]);
}

function focusEdge(container: HTMLElement | null, edge: 'first' | 'last') {
  const els = menuItemElements(container);
  if (!els.length) return;
  focusItem(edge === 'first' ? els[0] : els[els.length - 1]);
}

function onRootFocus(e: FocusEvent) {
  if (e.target !== rootEl.value) return;
  focusEdge(rootEl.value, 'first');
}

function onRootKeydown(e: KeyboardEvent) {
  const horizontal = props.mode === 'horizontal';
  const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
  const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
  if (e.key === nextKey || e.key === prevKey) {
    e.preventDefault();
    moveFocus(rootEl.value, document.activeElement, e.key === nextKey ? 1 : -1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    focusEdge(rootEl.value, 'first');
  } else if (e.key === 'End') {
    e.preventDefault();
    focusEdge(rootEl.value, 'last');
  }
}

async function nextFrame() {
  await nextTick();
  await new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  await nextTick();
}

const MenuItemNode = defineComponent({
  name: 'KMenuItemNode',
  props: {
    item: { type: Object as PropType<KMenuItem>, required: true },
    level: { type: Number, required: true },
    path: { type: String, required: true },
  },
  setup(itemProps) {
    const ctx = inject(K_MENU_KEY)!;
    return () => {
      const item = itemProps.item;
      const active = ctx.selectedKeys.value.includes(item.key);
      const classes = [
        'k-menu__item',
        {
          'is-active': active,
          'is-disabled': item.disabled,
          'is-danger': item.danger,
        },
        ctx.classNames?.item,
        active ? ctx.classNames?.itemActive : undefined,
        item.danger ? ctx.classNames?.itemDanger : undefined,
      ];
      const style = [
        { '--k-menu-indent': `${itemProps.level * 16}px` } as CSSProperties,
        ctx.styles?.item,
        active ? ctx.styles?.itemActive : undefined,
      ];
      const content = [
        item.icon
          ? h(
              'span',
              {
                'data-part': 'icon',
                class: ['k-menu__icon', ctx.classNames?.icon],
                style: ctx.styles?.icon,
                'aria-hidden': 'true',
              },
              [h(item.icon)],
            )
          : null,
        h(
          'span',
          {
            'data-part': 'label',
            class: ['k-menu__label', ctx.classNames?.label],
            style: ctx.styles?.label,
          },
          [h(KNode, { node: item.label ?? item.key })],
        ),
      ];
      const common = {
        id: ctx.itemId(itemProps.path),
        role: 'menuitem',
        tabindex: '-1',
        'data-part': 'item',
        'aria-disabled': item.disabled || undefined,
        'aria-current': active ? 'page' : undefined,
        class: classes,
        style,
        title:
          ctx.collapsed.value && itemProps.level === 0 && typeof item.label === 'string'
            ? item.label
            : undefined,
        onClick: () => ctx.selectItem(item),
      };

      if (item.disabled) {
        return h('span', { ...common, 'aria-disabled': 'true' }, content);
      }
      if (item.to) {
        return h(
          RouterLink,
          { ...common, to: item.to as RouteLocationRaw },
          { default: () => content },
        );
      }
      if (item.href) {
        return h(
          'a',
          {
            ...common,
            href: item.href,
            target: item.external ? '_blank' : undefined,
            rel: item.external ? 'noopener noreferrer' : undefined,
          },
          content,
        );
      }
      return h('button', { ...common, type: 'button' }, content);
    };
  },
});

const MenuSubmenu = defineComponent({
  name: 'KMenuSubmenu',
  props: {
    item: { type: Object as PropType<KMenuItem>, required: true },
    level: { type: Number, required: true },
    path: { type: String, required: true },
    inline: { type: Boolean, default: false },
  },
  setup(subProps) {
    const ctx = inject(K_MENU_KEY)!;
    const headerEl = ref<HTMLElement | null>(null);
    const popupEl = ref<HTMLElement | null>(null);
    const popupOpen = ref(false);
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    const inlineOpen = computed(
      () => subProps.inline && ctx.openKeys.value.includes(subProps.item.key),
    );
    const active = computed(() => ctx.hasSelected(subProps.item));
    const popupVisible = computed(() => !subProps.inline && popupOpen.value);
    const placement = computed<KOverlayPlacement>(() =>
      ctx.mode.value === 'horizontal' ? 'bottomLeft' : 'rightTop',
    );

    const { teleportTarget, popupClasses, popupTheme } = usePopupHost(() => ['k-menu__popup']);
    const { popupStyle, actualPlacement } = useOverlayPosition({
      anchor: headerEl,
      popup: popupEl,
      visible: popupVisible,
      placement: () => placement.value,
      target: teleportTarget,
      gap: 2,
    });

    function clearHoverTimer() {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    }
    function scheduleHover(action: () => void, delay: number) {
      clearHoverTimer();
      hoverTimer = setTimeout(action, delay * 1000);
    }

    function focusPopupFirst() {
      const first = menuItemElements(popupEl.value)[0];
      first?.focus();
    }

    async function focusPopupWhenReady() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await nextFrame();
        if (!popupVisible.value) return;
        if (menuItemElements(popupEl.value).length) {
          focusPopupFirst();
          return;
        }
      }
    }

    function openPopup(focus = false) {
      if (subProps.item.disabled) return;
      popupOpen.value = true;
      ctx.activePopup.value = subProps.item.key;
      ctx.activePopupHeader.value = headerEl.value;
      if (focus) void focusPopupWhenReady();
    }
    function closePopup(focusHeader = false) {
      popupOpen.value = false;
      if (ctx.activePopup.value === subProps.item.key) {
        ctx.activePopup.value = null;
        ctx.activePopupHeader.value = null;
      }
      if (focusHeader) nextTick(() => headerEl.value?.focus());
    }

    watch(
      () => ctx.activePopup.value,
      value => {
        if (value !== subProps.item.key && popupOpen.value) popupOpen.value = false;
      },
    );

    usePopupDismiss(popupVisible, () => closePopup(), () => [headerEl.value, popupEl.value]);

    function onHeaderClick() {
      if (subProps.item.disabled) return;
      if (subProps.inline) {
        ctx.toggleOpen(subProps.item.key);
        return;
      }
      if (popupOpen.value) closePopup();
      else openPopup();
    }

    function onHeaderKeydown(e: KeyboardEvent) {
      if (subProps.item.disabled) return;
      const horizontal = ctx.mode.value === 'horizontal';
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (subProps.inline) ctx.toggleOpen(subProps.item.key);
        else if (popupOpen.value) closePopup(true);
        else openPopup(true);
        return;
      }
      if (subProps.inline) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          if (!inlineOpen.value) ctx.toggleOpen(subProps.item.key);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          if (inlineOpen.value) ctx.toggleOpen(subProps.item.key);
        }
        return;
      }
      if ((horizontal && e.key === 'ArrowDown') || (!horizontal && e.key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        openPopup(true);
      } else if (!horizontal && e.key === 'ArrowLeft' && popupOpen.value) {
        e.preventDefault();
        e.stopPropagation();
        closePopup(true);
      }
    }

    const headerOn = {
      mouseenter: () => {
        if (!subProps.inline && ctx.submenuTrigger.value === 'hover' && !subProps.item.disabled) {
          scheduleHover(() => openPopup(), 0.1);
        }
      },
      mouseleave: () => {
        if (!subProps.inline && ctx.submenuTrigger.value === 'hover') {
          scheduleHover(() => closePopup(), 0.15);
        }
      },
    };
    const popupOn = {
      mouseenter: () => clearHoverTimer(),
      mouseleave: () => {
        if (ctx.submenuTrigger.value === 'hover') scheduleHover(() => closePopup(), 0.15);
      },
    };

    function onPopupKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus(popupEl.value, document.activeElement, e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusEdge(popupEl.value, 'first');
      } else if (e.key === 'End') {
        e.preventDefault();
        focusEdge(popupEl.value, 'last');
      } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        closePopup(true);
      } else if (e.key === 'Tab') {
        closePopup();
      }
    }

    onBeforeUnmount(() => clearHoverTimer());

    return () => {
      const item = subProps.item;
      const headerClasses = [
        'k-menu__submenu',
        {
          'is-active': active.value,
          'is-open': inlineOpen.value || popupOpen.value,
          'is-disabled': item.disabled,
          'is-danger': item.danger,
        },
        ctx.classNames?.submenu,
        active.value ? ctx.classNames?.submenuActive : undefined,
      ];
      const headerStyle = [
        { '--k-menu-indent': `${subProps.level * 16}px` } as CSSProperties,
        ctx.styles?.submenu,
        active.value ? ctx.styles?.submenuActive : undefined,
      ];
      const expanded = inlineOpen.value || popupOpen.value;
      const controls = inlineOpen.value
        ? ctx.submenuListId(subProps.path)
        : popupOpen.value
          ? ctx.popupId(subProps.path)
          : undefined;

      const header = h(
        'div',
        {
          key: `${subProps.path}-header`,
          ref: headerEl,
          id: ctx.submenuId(subProps.path),
          role: 'menuitem',
          'data-part': 'submenu',
          'aria-haspopup': 'menu',
          'aria-expanded': expanded ? 'true' : 'false',
          'aria-controls': controls,
          'aria-disabled': item.disabled || undefined,
          tabindex: '-1',
          class: headerClasses,
          style: headerStyle,
          title:
            ctx.collapsed.value && subProps.level === 0 && typeof item.label === 'string'
              ? item.label
              : undefined,
          onClick: onHeaderClick,
          onKeydown: onHeaderKeydown,
          ...onProps(headerOn),
        },
        [
          item.icon
            ? h(
                'span',
                {
                  'data-part': 'icon',
                  class: ['k-menu__icon', ctx.classNames?.icon],
                  style: ctx.styles?.icon,
                  'aria-hidden': 'true',
                },
                [h(item.icon)],
              )
            : null,
          h(
            'span',
            {
              'data-part': 'label',
              class: ['k-menu__label', ctx.classNames?.label],
              style: ctx.styles?.label,
            },
            [h(KNode, { node: item.label ?? item.key })],
          ),
          h(
            'span',
            {
              'data-part': 'arrow',
              class: ['k-menu__arrow', ctx.classNames?.arrow],
              style: ctx.styles?.arrow,
              'aria-hidden': 'true',
            },
            [
              h(
                'svg',
                {
                  viewBox: '0 0 16 16',
                  width: '1em',
                  height: '1em',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': 1.6,
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                },
                [h('path', { d: 'M6 3.5 10.5 8 6 12.5' })],
              ),
            ],
          ),
        ],
      );

      const nodes: VNode[] = [header];

      if (subProps.inline) {
        nodes.push(
          h(
            'ul',
            {
              key: `${subProps.path}-sublist`,
              id: ctx.submenuListId(subProps.path),
              role: 'group',
              class: ['k-menu__sub-list', ctx.classNames?.subList],
              style: [
                { display: inlineOpen.value ? undefined : 'none' } as CSSProperties,
                ctx.styles?.subList,
              ],
            },
            [
              h(MenuList, {
                items: item.children ?? [],
                level: subProps.level + 1,
                path: `${subProps.path}-c`,
                inline: true,
              }),
            ],
          ),
        );
      } else if (popupOpen.value) {
        nodes.push(
          h(Teleport, { key: `${subProps.path}-popup-host`, to: teleportTarget.value, defer: true }, [
            h(
              'ul',
              {
                key: `${subProps.path}-popup`,
                ref: popupEl,
                id: ctx.popupId(subProps.path),
                role: 'menu',
                tabindex: '-1',
                class: [...popupClasses.value, ctx.classNames?.popup],
                style: [popupStyle.value, ctx.styles?.popup],
                'data-k-theme': popupTheme.value,
                'data-placement': actualPlacement.value,
                'aria-label': typeof item.label === 'string' ? item.label : undefined,
                onKeydown: onPopupKeydown,
                ...onProps(popupOn),
              },
              [
                h(MenuList, {
                  items: item.children ?? [],
                  level: 0,
                  path: `${subProps.path}-c`,
                  inline: true,
                }),
              ],
            ),
          ]),
        );
      }

      return h(Fragment, nodes);
    };
  },
});

const MenuList = defineComponent({
  name: 'KMenuList',
  props: {
    items: { type: Array as PropType<KMenuItem[]>, required: true },
    level: { type: Number, required: true },
    path: { type: String, required: true },
    inline: { type: Boolean, default: false },
  },
  setup(listProps) {
    const ctx = inject(K_MENU_KEY)!;
    return () => {
      const nodes: VNode[] = [];
      listProps.items.forEach((item, index) => {
        const path = listProps.path ? `${listProps.path}-${index}` : String(index);
        if (item.divided && index > 0) {
          nodes.push(
            h('li', {
              key: `divider-${path}`,
              role: 'separator',
              class: ['k-menu__divider', ctx.classNames?.divider],
              style: ctx.styles?.divider,
            }),
          );
        }
        nodes.push(
          h(
            'li',
            { key: item.key, role: 'none', class: 'k-menu__li' },
            [
              item.children?.length
                ? h(MenuSubmenu, {
                    item,
                    level: listProps.level,
                    path,
                    inline: listProps.inline,
                  })
                : h(MenuItemNode, { item, level: listProps.level, path }),
            ],
          ),
        );
      });
      return h(Fragment, nodes);
    };
  },
});

</script>

<style>
.k-menu {
  --k-menu-item-height: var(--k-control-height-lg);
  --k-menu-radius: var(--k-border-radius);
  --k-menu-popup-min-width: 160px;

  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  margin: 0;
  padding: var(--k-size-xxs);
  list-style: none;
  color: var(--k-color-text);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
  outline: none;
}
.k-menu:focus-visible {
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
  border-radius: var(--k-border-radius);
}
.k-menu--horizontal {
  flex-direction: row;
  align-items: center;
  padding: 0;
}
.k-menu__li {
  list-style: none;
  position: relative;
}
.k-menu__item,
.k-menu__submenu {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--k-menu-item-height);
  padding: 0 var(--k-size-sm);
  padding-inline-start: calc(var(--k-size-sm) + var(--k-menu-indent, 0px));
  border: 0;
  border-radius: var(--k-menu-radius);
  background: transparent;
  color: var(--k-color-text);
  font: inherit;
  text-align: start;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-menu--horizontal .k-menu__item,
.k-menu--horizontal .k-menu__submenu {
  width: auto;
  padding: 0 var(--k-size);
}
.k-menu__item:hover:not(.is-disabled),
.k-menu__submenu:hover:not(.is-disabled) {
  background: var(--k-color-fill-secondary);
}
.k-menu__item:focus-visible,
.k-menu__submenu:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-menu__item.is-active {
  background: var(--k-color-primary-bg);
  color: var(--k-color-primary);
}
.k-menu__submenu.is-active {
  color: var(--k-color-primary);
}
.k-menu--horizontal .k-menu__item.is-active,
.k-menu--horizontal .k-menu__submenu.is-active {
  background: transparent;
}
.k-menu--horizontal .k-menu__item.is-active::after,
.k-menu--horizontal .k-menu__submenu.is-active::after {
  position: absolute;
  inset-inline: var(--k-size-sm);
  bottom: 0;
  height: 2px;
  border-radius: 1px;
  background: var(--k-color-primary);
  content: '';
}
.k-menu__submenu.is-open {
  background: var(--k-color-fill-secondary);
}
.k-menu__item.is-danger,
.k-menu__submenu.is-danger {
  color: var(--k-color-error);
}
.k-menu__item.is-danger:hover:not(.is-disabled),
.k-menu__submenu.is-danger:hover:not(.is-disabled) {
  background: var(--k-color-error-bg);
}
.k-menu__item.is-disabled,
.k-menu__submenu.is-disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
  background: transparent;
}
.k-menu.is-collapsed .k-menu__item,
.k-menu.is-collapsed .k-menu__submenu {
  justify-content: center;
  padding-inline: 0;
}
.k-menu.is-collapsed .k-menu__label,
.k-menu.is-collapsed .k-menu__arrow {
  display: none;
}
.k-menu__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  font-size: 1em;
  line-height: 1;
}
.k-menu__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-menu__arrow {
  display: inline-flex;
  flex: none;
  align-items: center;
  margin-inline-start: auto;
  color: var(--k-color-text-tertiary);
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-menu__submenu.is-open .k-menu__arrow {
  transform: rotate(90deg);
}
.k-menu__sub-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.k-menu__divider {
  flex: none;
  height: var(--k-line-width);
  margin: var(--k-size-xxs) var(--k-size-xxs);
  list-style: none;
  background: var(--k-color-border-secondary);
}
.k-menu--horizontal .k-menu__divider {
  align-self: center;
  width: var(--k-line-width);
  height: 1.2em;
  margin: 0 var(--k-size-xs);
}
.k-menu__popup {
  --k-menu-item-height: var(--k-control-height-lg);
  --k-menu-radius: var(--k-border-radius);
  --k-menu-popup-min-width: 160px;

  position: fixed;
  z-index: var(--k-z-index-popup-base);
  box-sizing: border-box;
  min-width: var(--k-menu-popup-min-width);
  max-height: min(70vh, 480px);
  margin: 0;
  padding: var(--k-size-xxs);
  overflow-y: auto;
  border-radius: var(--k-border-radius);
  background: var(--k-color-bg-elevated);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
  box-shadow: var(--k-box-shadow-secondary);
  list-style: none;
}
.k-menu__popup .k-menu__item,
.k-menu__popup .k-menu__submenu {
  width: 100%;
}
</style>