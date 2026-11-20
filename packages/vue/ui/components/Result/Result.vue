<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-result"
    :class="[`k-result--${status}`, classNames?.root]"
    :style="styles?.root"
  >
    <div data-part="icon" class="k-result__icon" :class="classNames?.icon" :style="styles?.icon">
      <slot name="icon">
        <span v-if="isCodeStatus" class="k-result__code">{{ status }}</span>
        <svg
          v-else
          viewBox="0 0 64 64"
          width="1em"
          height="1em"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="iconPath" />
        </svg>
      </slot>
    </div>
    <div v-if="title || $slots.title" data-part="title" class="k-result__title" :class="classNames?.title" :style="styles?.title">
      <slot name="title"><component v-if="title" :is="KNode" :node="title" /></slot>
    </div>
    <div
      v-if="subTitle || $slots.subTitle"
      data-part="subtitle"
      class="k-result__subtitle"
      :class="classNames?.subtitle"
      :style="styles?.subtitle"
    >
      <slot name="subTitle"><component v-if="subTitle" :is="KNode" :node="subTitle" /></slot>
    </div>
    <div v-if="extra || $slots.extra" data-part="extra" class="k-result__extra" :class="classNames?.extra" :style="styles?.extra">
      <slot name="extra"><component v-if="extra" :is="KNode" :node="extra" /></slot>
    </div>
    <div v-if="$slots.default" data-part="content" class="k-result__content" :class="classNames?.content" :style="styles?.content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNode, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KResult' });

export type KResultStatus = 'success' | 'error' | 'info' | 'warning' | '403' | '404' | '500';
type ResultPart = 'root' | 'icon' | 'title' | 'subtitle' | 'extra' | 'content';

const ICON_PATHS = {
  success: 'M32 6a26 26 0 1 0 0 52 26 26 0 0 0 0-52Zm-12 27 8 8 16-17',
  error: 'M32 6a26 26 0 1 0 0 52 26 26 0 0 0 0-52ZM23 23l18 18M41 23 23 41',
  info: 'M32 6a26 26 0 1 0 0 52 26 26 0 0 0 0-52ZM32 28v14M32 21v.1',
  warning: 'M32 6 58 54H6L32 6Zm0 17v14M32 46v.1',
} as const;

export interface KResultRenderScope {
  status: KResultStatus;
  title: string | VNode | undefined;
  subTitle: string | VNode | undefined;
  extra: string | VNode | undefined;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KResultProps {
  status?: KResultStatus;
  title?: string | VNode;
  subTitle?: string | VNode;
  extra?: string | VNode;
  render?: KRenderFn<KResultRenderScope>;
  classNames?: Partial<Record<ResultPart, string>>;
  styles?: Partial<Record<ResultPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KResultProps>(), {
  status: 'info',
});

const slots = useSlots();
const isCodeStatus = computed(() => props.status === '403' || props.status === '404' || props.status === '500');
const iconPath = computed(() => (isCodeStatus.value ? '' : ICON_PATHS[props.status as keyof typeof ICON_PATHS]));
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KResultRenderScope>(
  () => props.render,
  () => ({
    status: props.status,
    title: props.title,
    subTitle: props.subTitle,
    extra: props.extra,
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  icon?(): VNodeChild;
  title?(): VNodeChild;
  subTitle?(): VNodeChild;
  extra?(): VNodeChild;
  default?(): VNodeChild;
  render?(scope: KResultRenderScope): VNodeChild;
}>();
</script>

<style>
.k-result {
  --k-result-icon-size: 64px;
  --k-result-icon-color: var(--k-color-primary);
  --k-result-title-size: var(--k-font-size-xl);
  --k-result-padding: var(--k-size-lg) var(--k-size);

  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--k-result-padding);
  color: var(--k-color-text);
  text-align: center;
}
.k-result *,
.k-result *::before,
.k-result *::after {
  box-sizing: border-box;
}
.k-result--success { --k-result-icon-color: var(--k-color-success); }
.k-result--error { --k-result-icon-color: var(--k-color-error); }
.k-result--warning { --k-result-icon-color: var(--k-color-warning); }
.k-result--info { --k-result-icon-color: var(--k-color-info); }

.k-result__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--k-result-icon-size);
  min-height: var(--k-result-icon-size);
  margin-bottom: var(--k-size);
  color: var(--k-result-icon-color);
  font-size: var(--k-result-icon-size);
  line-height: 1;
}
.k-result__code {
  font-size: calc(var(--k-result-icon-size) * 1.35);
  font-weight: var(--k-font-weight-strong);
  letter-spacing: 0.04em;
}
.k-result__title {
  font-size: var(--k-result-title-size);
  font-weight: var(--k-font-weight-strong);
  line-height: var(--k-line-height-heading-3);
}
.k-result__subtitle {
  max-width: 40em;
  margin-top: var(--k-size-xs);
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}
.k-result__extra {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--k-size-sm);
  margin-top: var(--k-size-lg);
}
.k-result__content {
  width: 100%;
  margin-top: var(--k-size-lg);
  text-align: start;
}
</style>