<script lang="ts">
import {
  Comment,
  Fragment,
  Text,
  computed,
  defineComponent,
  h,
  nextTick,
  provide,
  ref,
  useId,
  useSlots,
} from 'vue';
import type { CSSProperties, Component, PropType, VNode, VNodeChild } from 'vue';
import KTabPane from './TabPane.vue';
import { K_TAB_PANE_KEY } from './context';
import type { KTabsPart, KTabsPlacement, KTabsSize, KTabsType } from './context';

interface KTabsProps {
  /** 当前页签 key；受控时用 v-model:active */
  active?: string | number;
  type?: KTabsType;
  placement?: KTabsPlacement;
  size?: KTabsSize;
  /** 页签居中 */
  centered?: boolean;
  /** 页签等分铺满 */
  stretch?: boolean;
  classNames?: Partial<Record<KTabsPart, string>>;
  styles?: Partial<Record<KTabsPart, CSSProperties>>;
}

interface TabMeta {
  node: VNode;
  key: string | number;
  label: VNodeChild;
  icon: Component | undefined;
  disabled: boolean;
  closable: boolean;
  index: number;
  tabId: string;
  paneId: string;
}

function flattenTabs(nodes: VNode[]): VNode[] {
  const out: VNode[] = [];
  for (const node of nodes) {
    if (node.type === Fragment) {
      if (Array.isArray(node.children)) out.push(...flattenTabs(node.children as VNode[]));
      continue;
    }
    if (node.type === Comment) continue;
    if (node.type === Text && typeof node.children === 'string' && !node.children.trim()) continue;
    if (node.type === KTabPane) out.push(node);
  }
  return out;
}

/** VNode props 是原始值：裸写布尔属性时为空串，需复刻 Vue 的布尔转换 */
function boolProp(value: unknown, name: string): boolean {
  return value === '' || value === name ? true : Boolean(value);
}

function findEnabled(panes: TabMeta[], from: number, dir: 1 | -1): number {
  const len = panes.length;
  for (let step = 1; step <= len; step += 1) {
    const index = ((from + dir * step) % len + len) % len;
    if (!panes[index].disabled) return index;
  }
  return -1;
}

const PaneHost = defineComponent({
  name: 'KTabPaneHost',
  props: {
    node: { type: Object as PropType<VNode>, required: true },
    active: { type: Boolean, default: false },
    tabId: { type: String, required: true },
    paneId: { type: String, required: true },
  },
  setup(hostProps) {
    provide(K_TAB_PANE_KEY, {
      active: computed(() => hostProps.active),
      tabId: hostProps.tabId,
      paneId: hostProps.paneId,
    });
    return () => hostProps.node;
  },
});

export default defineComponent({
  name: 'KTabs',
  props: {
    active: { type: [String, Number] as PropType<string | number>, default: undefined },
    type: { type: String as PropType<KTabsType>, default: 'line' },
    placement: { type: String as PropType<KTabsPlacement>, default: 'top' },
    size: { type: String as PropType<KTabsSize>, default: 'md' },
    centered: { type: Boolean, default: false },
    stretch: { type: Boolean, default: false },
    classNames: { type: Object as PropType<KTabsProps['classNames']>, default: undefined },
    styles: { type: Object as PropType<KTabsProps['styles']>, default: undefined },
  },
  emits: {
    'update:active': (_key: string | number) => true,
    change: (_key: string | number) => true,
    close: (_key: string | number, _index: number) => true,
  },
  setup(props, { emit }) {
    const slots = useSlots();
    const uid = useId();
    const innerActive = ref<string | number | undefined>(undefined);
    const tabEls: (HTMLElement | null)[] = [];

    const activeValue = computed(() => props.active ?? innerActive.value);

    function selectPane(pane: TabMeta) {
      if (pane.disabled || pane.key === activeValue.value) return;
      if (props.active === undefined) innerActive.value = pane.key;
      emit('update:active', pane.key);
      emit('change', pane.key);
    }

    function focusTab(index: number) {
      nextTick(() => tabEls[index]?.focus());
    }

    function onTabKeydown(e: KeyboardEvent, panes: TabMeta[], index: number) {
      const vertical = props.placement === 'left' || props.placement === 'right';
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
      let target = -1;

      if (e.key === nextKey) target = findEnabled(panes, index, 1);
      else if (e.key === prevKey) target = findEnabled(panes, index, -1);
      else if (e.key === 'Home') target = panes.findIndex(pane => !pane.disabled);
      else if (e.key === 'End') {
        for (let i = panes.length - 1; i >= 0; i -= 1) {
          if (!panes[i].disabled) {
            target = i;
            break;
          }
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPane(panes[index]);
        return;
      }

      if (target >= 0) {
        e.preventDefault();
        selectPane(panes[target]);
        focusTab(target);
      }
    }

    const closeIcon = h(
      'svg',
      {
        viewBox: '0 0 16 16',
        width: '1em',
        height: '1em',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
        'aria-hidden': 'true',
      },
      [h('path', { d: 'M4.5 4.5l7 7M11.5 4.5l-7 7' })],
    );

    return () => {
      const nodes = flattenTabs((slots.default?.() ?? []) as VNode[]);
      const panes: TabMeta[] = nodes.map((node, index) => {
        const paneProps = (node.props ?? {}) as Record<string, unknown>;
        return {
          node,
          key: (node.key ?? paneProps.name ?? index) as string | number,
          label: paneProps.label as VNodeChild,
          icon: paneProps.icon as Component | undefined,
          disabled: boolProp(paneProps.disabled, 'disabled'),
          closable: boolProp(paneProps.closable, 'closable'),
          index,
          tabId: `${uid}-tab-${index}`,
          paneId: `${uid}-panel-${index}`,
        };
      });

      let currentKey = activeValue.value;
      if (!panes.some(pane => pane.key === currentKey && !pane.disabled)) {
        currentKey = panes.find(pane => !pane.disabled)?.key;
      }

      const tabNodes = panes.map((pane, index) => {
        const isActive = pane.key === currentKey;
        const trigger = h(
          'button',
          {
            type: 'button',
            role: 'tab',
            id: pane.tabId,
            'aria-selected': isActive ? 'true' : 'false',
            'aria-controls': pane.paneId,
            'aria-disabled': pane.disabled || undefined,
            tabindex: isActive ? 0 : -1,
            disabled: pane.disabled,
            class: 'k-tabs__trigger',
            ref: (el: unknown) => {
              tabEls[index] = el as HTMLElement | null;
            },
            onClick: () => {
              if (pane.disabled) return;
              selectPane(pane);
              focusTab(index);
            },
            onKeydown: (e: KeyboardEvent) => onTabKeydown(e, panes, index),
          },
          [
            pane.icon
              ? h('span', { class: 'k-tabs__icon', 'aria-hidden': 'true' }, [h(pane.icon)])
              : null,
            h('span', { class: 'k-tabs__label' }, [
              slots.label
                ? slots.label({ item: pane, index, active: isActive })
                : pane.label ?? String(pane.key),
            ]),
          ],
        );

        const close = pane.closable && !pane.disabled
          ? h(
              'button',
              {
                type: 'button',
                'data-part': 'close',
                class: ['k-tabs__close', props.classNames?.close],
                style: props.styles?.close,
                'aria-label': '关闭标签',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation();
                  emit('close', pane.key, index);
                },
              },
              [closeIcon],
            )
          : null;

        return h(
          'div',
          {
            key: pane.key,
            'data-part': 'tab',
            class: [
              'k-tabs__tab',
              {
                'is-active': isActive,
                'is-disabled': pane.disabled,
                'is-closable': Boolean(close),
              },
              props.classNames?.tab,
              isActive ? props.classNames?.tabActive : undefined,
            ],
            style: [props.styles?.tab, isActive ? props.styles?.tabActive : undefined],
          },
          [trigger, close],
        );
      });

      const nav = h(
        'div',
        {
          'data-part': 'nav',
          role: 'tablist',
          'aria-orientation':
            props.placement === 'left' || props.placement === 'right' ? 'vertical' : 'horizontal',
          class: [
            'k-tabs__nav',
            { 'is-centered': props.centered, 'is-stretch': props.stretch },
            props.classNames?.nav,
          ],
          style: props.styles?.nav,
        },
        [
          ...tabNodes,
          slots.extra
            ? h(
                'div',
                { class: ['k-tabs__extra', props.classNames?.extra], style: props.styles?.extra },
                slots.extra(),
              )
            : null,
        ],
      );

      const content = h(
        'div',
        {
          'data-part': 'content',
          class: ['k-tabs__content', props.classNames?.content],
          style: props.styles?.content,
        },
        panes.map(pane =>
          h(PaneHost, {
            key: pane.key,
            node: pane.node,
            active: pane.key === currentKey,
            tabId: pane.tabId,
            paneId: pane.paneId,
          }),
        ),
      );

      return h(
        'div',
        {
          'data-part': 'root',
          class: [
            'k-tabs',
            `k-tabs--${props.type}`,
            `k-tabs--${props.placement}`,
            `k-tabs--${props.size}`,
            props.classNames?.root,
          ],
          style: props.styles?.root,
        },
        [nav, content],
      );
    };
  },
});
</script>

<style>
.k-tabs {
  --k-tabs-pad-y: var(--k-size-xs);
  --k-tabs-pad-x: var(--k-size);
  --k-tabs-font-size: var(--k-font-size);

  display: flex;
  box-sizing: border-box;
  min-width: 0;
  color: var(--k-color-text-secondary);
  font-size: var(--k-tabs-font-size);
}
.k-tabs--sm {
  --k-tabs-pad-y: var(--k-size-xxs);
  --k-tabs-pad-x: var(--k-size-sm);
  --k-tabs-font-size: var(--k-font-size-sm);
}
.k-tabs--lg {
  --k-tabs-pad-y: var(--k-size-sm);
  --k-tabs-pad-x: var(--k-size-md);
  --k-tabs-font-size: var(--k-font-size-lg);
}
.k-tabs--top,
.k-tabs--bottom {
  flex-direction: column;
}
.k-tabs--left,
.k-tabs--right {
  flex-direction: row;
}
.k-tabs--bottom .k-tabs__nav,
.k-tabs--right .k-tabs__nav {
  order: 2;
}
.k-tabs--bottom .k-tabs__content,
.k-tabs--right .k-tabs__content {
  order: 1;
}
.k-tabs__nav {
  position: relative;
  display: flex;
  flex: none;
  box-sizing: border-box;
  min-width: 0;
}
.k-tabs--top .k-tabs__nav {
  border-block-end: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-tabs--bottom .k-tabs__nav {
  border-block-start: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-tabs--left .k-tabs__nav {
  flex-direction: column;
  border-inline-end: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-tabs--right .k-tabs__nav {
  flex-direction: column;
  border-inline-start: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-tabs--left .k-tabs__nav,
.k-tabs--right .k-tabs__nav {
  width: max-content;
  min-width: 160px;
}
.k-tabs__nav.is-centered {
  justify-content: center;
}
.k-tabs__nav.is-stretch {
  width: 100%;
}
.k-tabs__nav.is-stretch .k-tabs__tab {
  flex: 1 1 0;
}
.k-tabs__nav.is-stretch .k-tabs__trigger {
  flex: 1;
  justify-content: center;
}
.k-tabs__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  color: var(--k-color-text-secondary);
  font-size: var(--k-tabs-font-size);
  line-height: var(--k-line-height);
  white-space: nowrap;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-tabs--left .k-tabs__tab,
.k-tabs--right .k-tabs__tab {
  width: 100%;
}
.k-tabs__trigger {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--k-size-xs);
  box-sizing: border-box;
  padding: var(--k-tabs-pad-y) var(--k-tabs-pad-x);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.k-tabs__tab.is-closable .k-tabs__trigger {
  padding-inline-end: var(--k-size-xs);
}
.k-tabs__tab:hover:not(.is-disabled):not(.is-active) {
  color: var(--k-color-primary-hover);
}
.k-tabs__tab.is-active {
  color: var(--k-color-primary);
}
.k-tabs__tab.is-disabled {
  color: var(--k-color-text-quaternary);
}
.k-tabs__trigger:disabled {
  cursor: not-allowed;
}
.k-tabs__trigger:focus-visible {
  z-index: 2;
  outline: none;
  border-radius: var(--k-border-radius-sm);
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-tabs__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  line-height: 1;
}
.k-tabs__label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-tabs__close {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  margin-inline: 0 var(--k-tabs-pad-y);
  border: none;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: inherit;
  font-size: 12px;
  opacity: 0.7;
  cursor: pointer;
  transition:
    background var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    opacity var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-tabs__close:hover {
  background: var(--k-color-fill-secondary);
  opacity: 1;
}
.k-tabs__close:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 1px;
  opacity: 1;
}
.k-tabs__content {
  flex: 1;
  min-width: 0;
}
.k-tabs__extra {
  display: flex;
  align-items: center;
  margin-inline-start: auto;
  padding-inline-start: var(--k-size);
}
.k-tabs--left .k-tabs__extra,
.k-tabs--right .k-tabs__extra {
  margin-top: var(--k-size-sm);
  margin-inline-start: 0;
  padding-inline-start: 0;
}

/* line：激活项下划线 / 侧边指示线 */
.k-tabs--line .k-tabs__tab.is-active::after {
  position: absolute;
  background: var(--k-color-primary);
  content: '';
}
.k-tabs--line.k-tabs--top .k-tabs__tab.is-active::after {
  inset-inline: 0;
  bottom: calc(var(--k-line-width) * -1);
  height: calc(var(--k-line-width) * 2);
}
.k-tabs--line.k-tabs--bottom .k-tabs__tab.is-active::after {
  inset-inline: 0;
  top: calc(var(--k-line-width) * -1);
  height: calc(var(--k-line-width) * 2);
}
.k-tabs--line.k-tabs--left .k-tabs__tab.is-active::after {
  inset-block: 0;
  inset-inline-end: calc(var(--k-line-width) * -1);
  width: calc(var(--k-line-width) * 2);
}
.k-tabs--line.k-tabs--right .k-tabs__tab.is-active::after {
  inset-block: 0;
  inset-inline-start: calc(var(--k-line-width) * -1);
  width: calc(var(--k-line-width) * 2);
}

/* card：页签连成卡片，激活项与内容区同底 */
.k-tabs--card .k-tabs__nav {
  gap: 0;
  border: 0;
}
.k-tabs--card .k-tabs__tab {
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  background: var(--k-color-fill-tertiary);
}
.k-tabs--card .k-tabs__tab + .k-tabs__tab {
  margin-inline-start: calc(var(--k-line-width) * -1);
}
.k-tabs--card .k-tabs__tab.is-active {
  z-index: 1;
  background: var(--k-color-bg-container);
}
.k-tabs--card.k-tabs--top .k-tabs__tab {
  border-start-start-radius: var(--k-border-radius-sm);
  border-start-end-radius: var(--k-border-radius-sm);
}
.k-tabs--card.k-tabs--bottom .k-tabs__tab {
  border-end-start-radius: var(--k-border-radius-sm);
  border-end-end-radius: var(--k-border-radius-sm);
}
.k-tabs--card.k-tabs--left .k-tabs__tab {
  border-start-start-radius: var(--k-border-radius-sm);
  border-end-start-radius: var(--k-border-radius-sm);
}
.k-tabs--card.k-tabs--right .k-tabs__tab {
  border-start-end-radius: var(--k-border-radius-sm);
  border-end-end-radius: var(--k-border-radius-sm);
}
.k-tabs--card.k-tabs--top .k-tabs__tab.is-active {
  border-block-end-color: var(--k-color-bg-container);
}
.k-tabs--card.k-tabs--bottom .k-tabs__tab.is-active {
  border-block-start-color: var(--k-color-bg-container);
}
.k-tabs--card.k-tabs--left .k-tabs__tab.is-active {
  border-inline-end-color: var(--k-color-bg-container);
}
.k-tabs--card.k-tabs--right .k-tabs__tab.is-active {
  border-inline-start-color: var(--k-color-bg-container);
}
</style>