<template>
  <div
    v-bind="rootAttrs"
    class="k-empty"
    :class="[`k-empty--${size}`, classNames?.root]"
    :style="styles?.root"
  >
    <div data-part="image" class="k-empty__image" :class="classNames?.image" :style="styles?.image">
      <slot name="image">
        <span v-if="icon" class="k-empty__icon" aria-hidden="true">
          <component :is="icon" />
        </span>
        <svg
          v-else
          viewBox="24 28.7 135.6 122.6"
          width="1em"
          class="k-empty__illustration"
          fill="none"
          aria-hidden="true"
        >
          <g transform="translate(24 31.7)">
            <g fill="none" stroke="#d9d9d9" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M67.8 8v15" />
              <path d="M50 25 38.5 13.5" />
              <path d="M85.6 25 97.1 13.5" />
            </g>
            <ellipse fill-opacity=".8" fill="#f0f0f0" cx="67.8" cy="106.9" rx="67.8" ry="12.7" />
            <path fill="#bfbfbf" d="M122 69.7 98.1 40.2a6 6 0 0 0-4.6-2.2H42.1a6 6 0 0 0-4.6 2.2l-24 29.5V85H122z" />
            <path fill="#d9d9d9" d="M121.9 105a7 7 0 0 1-6.8 5.4H20.5a7 7 0 0 1-6.7-5.4l-.2-1.8V69.7h26.3c2.9 0 5.2 2.4 5.2 5.4s2.4 5.4 5.3 5.4h34.8c2.9 0 5.3-2.4 5.3-5.4s2.3-5.4 5.2-5.4H122v33.5q0 1-.2 1.8" />
          </g>
        </svg>
      </slot>
    </div>
    <div v-if="title" data-part="title" class="k-empty__title" :class="classNames?.title" :style="styles?.title">
      {{ title }}
    </div>
    <div data-part="description" class="k-empty__description" :class="classNames?.description" :style="styles?.description">
      <slot>{{ description }}</slot>
    </div>
    <div v-if="$slots.actions" data-part="actions" class="k-empty__actions" :class="classNames?.actions" :style="styles?.actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component, CSSProperties } from 'vue';

defineOptions({ name: 'KEmpty' });

type EmptyPart = 'root' | 'image' | 'title' | 'description' | 'actions';

interface KEmptyProps {
  /** 标题，展示在描述上方 */
  title?: string;
  /** 图标组件，替代内置插图（#image 插槽优先） */
  icon?: Component;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  classNames?: Partial<Record<EmptyPart, string>>;
  styles?: Partial<Record<EmptyPart, CSSProperties>>;
}

withDefaults(defineProps<KEmptyProps>(), {
  description: '暂无数据',
  size: 'md',
});

const rootAttrs = { 'data-part': 'root' };
</script>

<style>
.k-empty {
  --k-empty-image-size: 64px;
  --k-empty-gap: var(--k-size-sm);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--k-empty-gap);
  padding: var(--k-size-lg) var(--k-size);
  color: var(--k-color-text-secondary);
  text-align: center;
}
.k-empty__image {
  display: inline-flex;
  color: var(--k-color-text-quaternary);
  font-size: var(--k-empty-image-size);
  line-height: 1;
}
.k-empty__image svg {
  width: 1em;
  height: 1em;
  display: block;
}
.k-empty__image svg.k-empty__illustration {
  height: auto;
}
.k-empty__icon {
  display: inline-flex;
}
.k-empty__title {
  color: var(--k-color-text);
  font-size: var(--k-font-size-lg);
  font-weight: var(--k-font-weight-strong);
}
.k-empty__title + .k-empty__description {
  margin-top: calc(var(--k-size-xxs) - var(--k-empty-gap));
}
.k-empty__description {
  font-size: var(--k-font-size);
}
.k-empty__actions {
  margin-top: calc(var(--k-size-md) - var(--k-empty-gap));
  display: flex;
  align-items: center;
  gap: var(--k-size-sm);
}
.k-empty--sm {
  --k-empty-image-size: 44px;
  --k-empty-gap: var(--k-size-xs);
  padding: var(--k-size);
}
.k-empty--lg {
  --k-empty-image-size: 88px;
  --k-empty-gap: var(--k-size);
  padding: var(--k-size-xl) var(--k-size);
}
</style>