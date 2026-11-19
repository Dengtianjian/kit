<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-card"
    :class="[
      `k-card--${size}`,
      `k-card--${resolvedVariant}`,
      {
        'is-hoverable': hoverable,
        'is-hover-shadow': hoverShadow,
        'is-loading': loading,
        'is-segmented': segmented,
        'is-inner': inner,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <div v-if="$slots.cover" data-part="cover" class="k-card__cover" :class="classNames?.cover" :style="styles?.cover">
      <slot name="cover" />
    </div>
    <div
      v-if="$slots.header || title || $slots.title || $slots.extra"
      data-part="header"
      class="k-card__header"
      :class="classNames?.header"
      :style="styles?.header"
    >
      <slot v-if="$slots.header" name="header" />
      <template v-else>
        <div data-part="title" class="k-card__title" :class="classNames?.title" :style="styles?.title">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="$slots.extra" data-part="extra" class="k-card__extra" :class="classNames?.extra" :style="styles?.extra">
          <slot name="extra" />
        </div>
      </template>
    </div>
    <div data-part="body" class="k-card__body" :class="classNames?.body" :style="styles?.body">
      <KSkeleton v-if="loading" :paragraph="{ rows: 3 }" active />
      <slot v-else />
    </div>
    <div v-if="$slots.footer" data-part="footer" class="k-card__footer" :class="classNames?.footer" :style="styles?.footer">
      <slot name="footer" />
    </div>
    <div v-if="$slots.actions" data-part="actions" class="k-card__actions" :class="classNames?.actions" :style="styles?.actions">
      <ActionList />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Comment, Fragment, Text, computed, defineComponent, h, useSlots } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import KSkeleton from '../Skeleton/Skeleton.vue';
import KButton from '../Button/Button.vue';
import KCardAction from './CardAction.vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KCard' });

type CardPart = 'root' | 'cover' | 'header' | 'title' | 'extra' | 'body' | 'footer' | 'actions';

export type KCardVariant = 'outlined' | 'borderless' | 'filled' | 'elevated';

export interface KCardRenderScope {
  title: string | undefined;
  size: 'sm' | 'md' | 'lg';
  variant: KCardVariant;
  hoverable: boolean;
  hoverShadow: boolean;
  inner: boolean;
  loading: boolean;
  segmented: boolean;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KCardProps {
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  /** 外观变体；未传时由 bordered 推导（true → outlined，false → borderless） */
  variant?: KCardVariant;
  bordered?: boolean;
  hoverable?: boolean;
  /** hover 时浮起阴影（带过渡），任意变体可用 */
  hoverShadow?: boolean;
  /** 内部卡片：小圆角与更紧的内边距；背景/边框/阴影跟随 variant */
  inner?: boolean;
  /** 内容区显示骨架屏，头部保持可见 */
  loading?: boolean;
  /** 分段外观：header 底边线、footer 顶边线（类 naive segmented） */
  segmented?: boolean;
  render?: KRenderFn<KCardRenderScope>;
  classNames?: Partial<Record<CardPart, string>>;
  styles?: Partial<Record<CardPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KCardProps>(), {
  size: 'md',
  bordered: true,
  hoverable: false,
  hoverShadow: false,
  inner: false,
  loading: false,
  segmented: false,
});

const resolvedVariant = computed<KCardVariant>(
  () => props.variant ?? (props.bordered ? 'outlined' : 'borderless'),
);

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

const isActionNode = (node: VNode) => {
  if (node.type === Comment) return false;
  return !(node.type === Text && typeof node.children === 'string' && !node.children.trim());
};

const flattenActions = (nodes: VNode[]): VNode[] => {
  const result: VNode[] = [];
  const visit = (list: VNode[]) => {
    for (const node of list) {
      if (node.type === Fragment && Array.isArray(node.children)) {
        visit(node.children as VNode[]);
      } else if (isActionNode(node)) {
        result.push(node);
      }
    }
  };
  visit(nodes);
  return result;
};

// 每个 action 子项包成原生 button，直接获得键盘聚焦与点击语义
const ActionList = defineComponent({
  name: 'KCardActionList',
  setup: () => () =>
    flattenActions((slots.actions?.() ?? []) as VNode[]).map((node, index) =>
      node.type === KCardAction
        ? node
        : h(
            KButton,
            { key: index, type: 'default', variant: 'quiet', wave: false, class: 'k-card__action' },
            { default: () => node },
          ),
    ),
});

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KCardRenderScope>(
  () => props.render,
  () => ({
    title: props.title,
    size: props.size,
    variant: resolvedVariant.value,
    hoverable: props.hoverable,
    hoverShadow: props.hoverShadow,
    inner: props.inner,
    loading: props.loading,
    segmented: props.segmented,
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  header?(): VNodeChild;
  title?(): VNodeChild;
  extra?(): VNodeChild;
  cover?(): VNodeChild;
  footer?(): VNodeChild;
  actions?(): VNodeChild;
  render?(scope: KCardRenderScope): VNodeChild;
}>();
</script>

<style>
.k-card {
  --k-card-padding: var(--k-size-md);
  --k-card-padding-y: var(--k-size-sm);
  --k-card-radius: var(--k-border-radius-lg);

  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  background: var(--k-color-bg-container);
  border-radius: var(--k-card-radius);
  transition:
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-card--outlined {
  border: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-card--filled {
  background: var(--k-color-fill-quaternary);
}
.k-card--elevated {
  box-shadow: var(--k-shadow-md, 0 4px 16px rgb(0 0 0 / 8%));
}
.k-card.is-hoverable:hover {
  box-shadow: var(--k-shadow-md, 0 4px 16px rgb(0 0 0 / 8%));
}
.k-card--outlined.is-hoverable:hover {
  border-color: var(--k-color-primary-border-hover);
}
.k-card.is-hover-shadow {
  transition:
    box-shadow var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-card.is-hover-shadow:hover {
  box-shadow: var(--k-shadow-md, 0 4px 16px rgb(0 0 0 / 8%));
}
.k-card--sm {
  --k-card-padding: var(--k-size);
  --k-card-padding-y: var(--k-size-xs);
}
.k-card--lg {
  --k-card-padding: var(--k-size-lg);
  --k-card-padding-y: var(--k-size);
}
.k-card.is-inner {
  --k-card-padding: var(--k-size);
  --k-card-padding-y: var(--k-size-xs);
  --k-card-radius: var(--k-border-radius);
}
.k-card__cover {
  overflow: hidden;
  border-start-start-radius: var(--k-card-radius);
  border-start-end-radius: var(--k-card-radius);
}
.k-card__cover img {
  display: block;
  width: 100%;
  object-fit: cover;
}
.k-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-size);
  padding: var(--k-card-padding-y) var(--k-card-padding);
}
.k-card.is-segmented .k-card__header {
  border-bottom: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-card__title {
  flex: auto;
  min-width: 0;
  overflow: hidden;
  color: var(--k-color-text);
  font-size: var(--k-font-size-lg);
  font-weight: var(--k-font-weight-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-card--sm .k-card__title {
  font-size: var(--k-font-size);
}
.k-card--lg .k-card__title {
  font-size: var(--k-font-size-xl);
}
.k-card__extra {
  flex: none;
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
}
.k-card__body {
  flex: auto;
  min-height: 0;
  padding: var(--k-card-padding);
  color: var(--k-color-text-secondary);
}
.k-card__footer {
  padding: var(--k-card-padding-y) var(--k-card-padding);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
}
.k-card.is-segmented .k-card__footer {
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-card__actions {
  display: flex;
  align-items: center;
  overflow: hidden;
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
  border-end-start-radius: max(0px, calc(var(--k-card-radius) - var(--k-line-width)));
  border-end-end-radius: max(0px, calc(var(--k-card-radius) - var(--k-line-width)));
}
.k-card__actions .k-card__action.k-button {
  flex: 1;
  height: auto;
  padding: var(--k-card-padding-y) 0;
  border: 0;
  border-inline-start: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: 0;
  line-height: var(--k-line-height);
}
.k-card__actions .k-card__action.k-button--default.k-button--quiet:hover:not(.is-disabled) {
  --k-button-bg: var(--k-color-fill-secondary);
}
.k-card__actions .k-card__action.k-button--default.k-button--quiet:active:not(.is-disabled) {
  --k-button-bg: var(--k-color-fill);
}
.k-card__actions .k-card__action.k-button:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: -2px;
  box-shadow: none;
}
.k-card__actions .k-card__action:first-child {
  border-inline-start-color: transparent;
}
</style>