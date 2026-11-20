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

    <KDropdown
      v-if="hasChildren"
      :items="submenuItems"
      :disabled="disabled"
      :menu-label="submenuLabel"
      size="sm"
      :class-names="{ trigger: disabled ? 'k-breadcrumb__submenu is-disabled' : 'k-breadcrumb__submenu' }"
      @select="onSubmenuSelect"
    >
      <template #trigger>
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
          :aria-label="ariaLabel"
        >
          <span
            v-if="icon"
            data-part="icon"
            class="k-breadcrumb__icon"
            :class="classNames?.icon"
            :style="styles?.icon"
          >
            <KIcon :component="icon" />
          </span>
          <span v-if="label || $slots.default" class="k-breadcrumb__label"><slot>{{ label }}</slot></span>
          <svg
            class="k-breadcrumb__caret"
            viewBox="0 0 10 6"
            width="0.7em"
            height="0.42em"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            aria-hidden="true"
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </KLink>
        <span
          v-else
          data-part="text"
          class="k-breadcrumb__text"
          :class="[classNames?.text, { 'is-disabled': disabled, 'is-current': current }]"
          :style="styles?.text"
          :aria-current="current ? 'page' : undefined"
          :aria-disabled="disabled || undefined"
          :aria-label="ariaLabel"
          :tabindex="disabled ? undefined : 0"
        >
          <span
            v-if="icon"
            data-part="icon"
            class="k-breadcrumb__icon"
            :class="classNames?.icon"
            :style="styles?.icon"
          >
            <KIcon :component="icon" />
          </span>
          <span v-if="label || $slots.default" class="k-breadcrumb__label"><slot>{{ label }}</slot></span>
          <svg
            class="k-breadcrumb__caret"
            viewBox="0 0 10 6"
            width="0.7em"
            height="0.42em"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            aria-hidden="true"
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </span>
      </template>
    </KDropdown>

    <KLink
      v-else-if="isLink"
      data-part="link"
      class="k-breadcrumb__link"
      :class="classNames?.link"
      :style="styles?.link"
      type="secondary"
      :to="to"
      :href="href"
      :external="external"
      :disabled="disabled"
      :aria-label="ariaLabel"
    >
      <span
        v-if="icon"
        data-part="icon"
        class="k-breadcrumb__icon"
        :class="classNames?.icon"
        :style="styles?.icon"
      >
        <KIcon :component="icon" />
      </span>
      <span v-if="label || $slots.default" class="k-breadcrumb__label"><slot>{{ label }}</slot></span>
    </KLink>

    <span
      v-else
      data-part="text"
      class="k-breadcrumb__text"
      :class="[classNames?.text, { 'is-disabled': disabled, 'is-current': current }]"
      :style="styles?.text"
      :aria-current="current ? 'page' : undefined"
      :aria-disabled="disabled || undefined"
      :aria-label="ariaLabel"
    >
      <span
        v-if="icon"
        data-part="icon"
        class="k-breadcrumb__icon"
        :class="classNames?.icon"
        :style="styles?.icon"
      >
        <KIcon :component="icon" />
      </span>
      <span v-if="label || $slots.default" class="k-breadcrumb__label"><slot>{{ label }}</slot></span>
    </span>
  </li>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import type { Component, CSSProperties, RouteLocationRaw, VNodeChild } from 'vue';
import KDropdown from '../Dropdown/Dropdown.vue';
import KIcon from '../Icon/Icon.vue';
import KLink from '../Link/Link.vue';
import { K_BREADCRUMB_KEY } from './context';
import type {
  KBreadcrumbChildLink,
  KBreadcrumbItemPart,
  KBreadcrumbSeparator,
} from './context';
import type { KDropdownItem } from '../Dropdown/types';

defineOptions({ name: 'KBreadcrumbItem' });

interface KBreadcrumbItemProps {
  /** 文字内容；也可用默认插槽；纯图标项可省略 */
  label?: string;
  /** 纯图标或无文字项的可读名称 */
  ariaLabel?: string;
  /** 文字前置图标组件 */
  icon?: Component;
  /** 路由目标（优先于 href） */
  to?: RouteLocationRaw | string;
  href?: string;
  external?: boolean;
  /** 当前页：渲染为纯文本并带 aria-current="page" */
  current?: boolean;
  disabled?: boolean;
  /** 单项分隔符，覆盖根级 separator */
  separator?: KBreadcrumbSeparator;
  /** 子链接：一级下拉，选中后按 to / href 跳转 */
  children?: KBreadcrumbChildLink[];
  classNames?: Partial<Record<KBreadcrumbItemPart, string>>;
  styles?: Partial<Record<KBreadcrumbItemPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KBreadcrumbItemProps>(), {
  current: false,
  disabled: false,
  external: false,
});

const router = useRouter();
const ctx = inject(K_BREADCRUMB_KEY, undefined);
const resolvedSeparator = computed<KBreadcrumbSeparator>(
  () => props.separator ?? ctx?.separator.value ?? '/',
);
const isLink = computed(
  () => !props.disabled && !props.current && Boolean(props.to || props.href),
);
const childLinks = computed(() => props.children ?? []);
const hasChildren = computed(() => childLinks.value.length > 0);
const submenuLabel = computed(() => `${props.label ?? props.ariaLabel ?? '当前项'}的子链接`);
const submenuItems = computed<KDropdownItem[]>(() =>
  childLinks.value.map((child, index) => ({
    key: index,
    label: child.label ?? '',
    icon: child.icon,
    disabled: child.disabled,
  })),
);

function navigateChild(child: KBreadcrumbChildLink) {
  if (child.to) {
    if (router) {
      void router.push(child.to).catch(() => undefined);
    } else if (typeof child.to === 'string' && typeof window !== 'undefined') {
      window.location.assign(child.to);
    }
    return;
  }
  if (!child.href || typeof window === 'undefined') return;
  if (child.external) {
    window.open(child.href, '_blank', 'noopener,noreferrer');
  } else {
    window.location.assign(child.href);
  }
}

function onSubmenuSelect(key: string | number) {
  const child = childLinks.value[Number(key)];
  if (child && !child.disabled) navigateChild(child);
}

defineSlots<{
  default?(): VNodeChild;
  separator?(): VNodeChild;
}>();
</script>

<style>
.k-breadcrumb__list > .k-breadcrumb__item {
  margin: 0;
}
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
.k-breadcrumb__item > .k-breadcrumb__submenu {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
}
.k-breadcrumb__item > .k-breadcrumb__submenu.is-disabled {
  cursor: not-allowed;
}
.k-breadcrumb .k-breadcrumb__item .k-breadcrumb__link {
  --k-link-color: var(--k-breadcrumb-color);
}
.k-breadcrumb__link,
.k-breadcrumb__text {
  display: inline-flex;
  align-items: center;
  gap: var(--k-breadcrumb-icon-gap);
  overflow: hidden;
  max-width: 100%;
  color: var(--k-breadcrumb-color);
  font-size: var(--k-breadcrumb-font-size);
  line-height: var(--k-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-breadcrumb__label {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-breadcrumb__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  font-size: 1em;
}
.k-breadcrumb__caret {
  flex: none;
  opacity: 0.7;
}
.k-breadcrumb__text.is-current {
  color: var(--k-breadcrumb-current-color);
}
.k-breadcrumb__text.is-disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
</style>