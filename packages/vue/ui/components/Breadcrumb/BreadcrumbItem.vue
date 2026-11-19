<template>
  <li
    data-part="item"
    class="k-breadcrumb__item"
    :class="[classNames?.item]"
    :style="styles?.item"
  >
    <span
      data-part="separator"
      class="k-breadcrumb__separator"
      :class="classNames?.separator"
      :style="styles?.separator"
      aria-hidden="true"
    >
      <slot name="separator">
        <component :is="resolvedSeparator" v-if="typeof resolvedSeparator !== 'string'" />
        <template v-else>{{ resolvedSeparator }}</template>
      </slot>
    </span>
    <KLink
      v-if="isLink"
      data-part="link"
      class="k-breadcrumb__link"
      :class="classNames?.link"
      :style="styles?.link"
      type="secondary"
      :to="to"
      :href="href"
      :external="external"
      :disabled="disabled"
    >
      <slot>{{ label }}</slot>
    </KLink>
    <span
      v-else
      data-part="text"
      class="k-breadcrumb__text"
      :class="[classNames?.text, { 'is-disabled': disabled, 'is-current': current }]"
      :style="styles?.text"
      :aria-current="current ? 'page' : undefined"
      :aria-disabled="disabled || undefined"
    >
      <slot>{{ label }}</slot>
    </span>
  </li>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { CSSProperties, RouteLocationRaw, VNodeChild } from 'vue';
import KLink from '../Link/Link.vue';
import { K_BREADCRUMB_KEY } from './context';
import type { KBreadcrumbItemPart, KBreadcrumbSeparator } from './context';

defineOptions({ name: 'KBreadcrumbItem' });

interface KBreadcrumbItemProps {
  /** 文字内容；也可用默认插槽 */
  label?: string;
  /** 路由目标（优先于 href） */
  to?: RouteLocationRaw | string;
  href?: string;
  external?: boolean;
  /** 当前页：渲染为纯文本并带 aria-current="page" */
  current?: boolean;
  disabled?: boolean;
  /** 单项分隔符，覆盖根级 separator */
  separator?: KBreadcrumbSeparator;
  classNames?: Partial<Record<KBreadcrumbItemPart, string>>;
  styles?: Partial<Record<KBreadcrumbItemPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KBreadcrumbItemProps>(), {
  current: false,
  disabled: false,
  external: false,
});

const ctx = inject(K_BREADCRUMB_KEY, undefined);
const resolvedSeparator = computed<KBreadcrumbSeparator>(
  () => props.separator ?? ctx?.separator.value ?? '/',
);
const isLink = computed(
  () => !props.disabled && !props.current && Boolean(props.to || props.href),
);

defineSlots<{
  default?(): VNodeChild;
  separator?(): VNodeChild;
}>();
</script>

<style>
.k-breadcrumb__item {
  display: inline-flex;
  align-items: center;
  gap: var(--k-breadcrumb-gap);
  min-width: 0;
  list-style: none;
}
.k-breadcrumb__item:first-child .k-breadcrumb__separator {
  display: none;
}
.k-breadcrumb__separator {
  display: inline-flex;
  flex: none;
  align-items: center;
  color: var(--k-color-text-quaternary);
  font-size: var(--k-breadcrumb-font-size);
  line-height: 1;
  user-select: none;
}
.k-breadcrumb__separator > * {
  display: block;
}
.k-breadcrumb__link,
.k-breadcrumb__text {
  overflow: hidden;
  max-width: 100%;
  color: var(--k-breadcrumb-color);
  font-size: var(--k-breadcrumb-font-size);
  line-height: var(--k-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-breadcrumb__text.is-current {
  color: var(--k-color-text);
}
.k-breadcrumb__text.is-disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
</style>