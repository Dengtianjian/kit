<template>
  <div
    data-part="root"
    class="k-step"
    :class="[
      `is-${resolvedStatus}`,
      {
        'is-last': last,
        'is-dot': variant === 'dot',
        'is-clickable': canClick,
        'is-disabled': disabled,
        'is-current': isCurrent,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
    :role="canClick ? 'button' : undefined"
    :tabindex="canClick ? 0 : undefined"
    :aria-current="isCurrent ? 'step' : undefined"
    :aria-disabled="disabled || undefined"
    @click="onClick"
    @keydown="onKeydown"
  >
    <span
      data-part="icon"
      class="k-step__icon"
      :class="[{ 'is-custom': hasCustomIcon }, classNames?.icon]"
      :style="styles?.icon"
      aria-hidden="true"
    >
      <slot name="icon">
        <span v-if="variant === 'dot'" class="k-step__dot" />
        <component :is="icon" v-else-if="icon" />
        <svg
          v-else-if="resolvedStatus === 'finish'"
          viewBox="0 0 16 16"
          width="1em"
          height="1em"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
        <svg
          v-else-if="resolvedStatus === 'error'"
          viewBox="0 0 16 16"
          width="1em"
          height="1em"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
        <span v-else class="k-step__index">{{ index + 1 }}</span>
      </slot>
    </span>
    <div
      data-part="content"
      class="k-step__content"
      :class="classNames?.content"
      :style="styles?.content"
    >
      <div
        data-part="title"
        class="k-step__title"
        :class="classNames?.title"
        :style="styles?.title"
      >
        <slot v-if="$slots.title" name="title" />
        <slot v-else>{{ title }}</slot>
      </div>
      <div
        v-if="description || $slots.description"
        data-part="description"
        class="k-step__description"
        :class="classNames?.description"
        :style="styles?.description"
      >
        <slot name="description">{{ description }}</slot>
      </div>
    </div>
    <span
      v-if="!last"
      data-part="connector"
      class="k-step__connector"
      :class="classNames?.connector"
      :style="styles?.connector"
      aria-hidden="true"
    />
    <span
      v-if="showArrow"
      data-part="arrow"
      class="k-step__arrow"
      :class="classNames?.arrow"
      :style="styles?.arrow"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4l3 8l-3 8" />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, useSlots } from 'vue';
import type { Component, CSSProperties, VNodeChild } from 'vue';
import { K_STEP_KEY } from './context';
import type { KStepStatus, KStepsVariant } from './context';

defineOptions({ name: 'KStep' });

type StepPart = 'root' | 'icon' | 'content' | 'title' | 'description' | 'connector' | 'arrow';

interface KStepProps {
  title?: string;
  description?: string;
  /** 自定义图标组件；`icon` 插槽优先 */
  icon?: Component;
  /** 单项状态覆盖（缺省由 KSteps 按 current 推导） */
  status?: KStepStatus;
  disabled?: boolean;
  classNames?: Partial<Record<StepPart, string>>;
  styles?: Partial<Record<StepPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KStepProps>(), {
  disabled: false,
});

const ctx = inject(K_STEP_KEY, undefined);
const slots = useSlots();
const hasCustomIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon));

const index = computed(() => ctx?.index.value ?? 0);
const last = computed(() => ctx?.last.value ?? true);
const variant = computed<KStepsVariant>(() => ctx?.variant.value ?? 'default');
const resolvedStatus = computed<KStepStatus>(() => props.status ?? ctx?.status.value ?? 'wait');
const isCurrent = computed(() => ctx?.current.value ?? false);
const showArrow = computed(() => !last.value && variant.value === 'navigation');
const canClick = computed(() => !props.disabled && (ctx?.clickable.value ?? false));

function activate() {
  if (canClick.value) ctx?.activate();
}

function onClick() {
  activate();
}

function onKeydown(e: KeyboardEvent) {
  if (!canClick.value) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    activate();
  }
}

defineSlots<{
  default?(): VNodeChild;
  title?(): VNodeChild;
  icon?(): VNodeChild;
  description?(): VNodeChild;
}>();
</script>

<style>
.k-step {
  --k-step-icon-size: var(--k-control-height);
  --k-step-title-size: var(--k-font-size);
  --k-step-description-size: var(--k-font-size-sm);

  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--k-step-gap);
  box-sizing: border-box;
  min-width: 0;
  color: var(--k-color-text-secondary);
  font-size: var(--k-step-title-size);
}
.k-step__icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--k-step-icon-size);
  height: var(--k-step-icon-size);
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: 50%;
  background: var(--k-color-bg-container);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  font-weight: var(--k-font-weight-strong);
  line-height: 1;
  transition:
    background var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-step__icon svg {
  width: 1em;
  height: 1em;
}
.k-step__content {
  min-width: 0;
  padding-block: calc((var(--k-step-icon-size) - var(--k-step-title-size) * var(--k-line-height)) / 2);
}
.k-step__title {
  overflow: hidden;
  color: var(--k-color-text-secondary);
  font-size: var(--k-step-title-size);
  font-weight: var(--k-font-weight-strong);
  line-height: var(--k-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-step__description {
  margin-top: var(--k-size-xxs);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-step-description-size);
  line-height: var(--k-line-height);
  word-break: break-word;
}
.k-step.is-process .k-step__icon {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
.k-step.is-process .k-step__title {
  color: var(--k-color-text);
}
.k-step.is-finish .k-step__icon {
  border-color: var(--k-color-primary);
  background: var(--k-color-primary);
  color: var(--k-color-text-light-solid);
}
.k-step.is-finish .k-step__title {
  color: var(--k-color-text);
}
/* 自定义图标只渲染图形本身，不带圆形底与描边 */
.k-step .k-step__icon.is-custom {
  border: 0;
  background: transparent;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-step-icon-size);
}
.k-step.is-process .k-step__icon.is-custom {
  color: var(--k-color-primary);
}
.k-step.is-finish .k-step__icon.is-custom {
  color: var(--k-color-primary);
}
.k-step.is-error .k-step__icon.is-custom {
  color: var(--k-color-error);
}
.k-step.is-error .k-step__icon {
  border-color: var(--k-color-error);
  color: var(--k-color-error);
}
.k-step.is-error .k-step__title {
  color: var(--k-color-error);
}
.k-step__connector {
  position: absolute;
  background: var(--k-color-border-secondary);
  transition: background var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-step.is-finish .k-step__connector {
  background: var(--k-color-primary);
}
.k-step.is-error .k-step__connector {
  background: var(--k-color-error);
}
.k-step.is-clickable {
  cursor: pointer;
}
.k-step.is-clickable:hover .k-step__title {
  color: var(--k-color-primary);
}
.k-step.is-clickable:focus-visible {
  outline: none;
  border-radius: var(--k-border-radius-sm);
  box-shadow: 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-step.is-disabled {
  cursor: not-allowed;
}
.k-step.is-disabled.is-clickable:hover .k-step__title {
  color: var(--k-step-disabled-color, var(--k-color-text-secondary));
}
.k-step.is-dot .k-step__icon {
  border: none;
  background: transparent;
}
.k-step__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.k-step.is-dot.is-process .k-step__dot {
  box-shadow: 0 0 0 4px var(--k-color-primary-bg);
}
.k-step.is-dot.is-finish .k-step__dot {
  background: var(--k-color-primary);
}
.k-step.is-dot.is-error .k-step__dot {
  background: var(--k-color-error);
}
.k-step.is-dot.is-wait .k-step__dot {
  background: var(--k-color-text-quaternary);
}
.k-steps--horizontal .k-step {
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: var(--k-size-xs);
}
.k-steps--horizontal .k-step__content {
  width: 100%;
  max-width: 100%;
  padding-block: 0;
  text-align: center;
}
/* 图标居中后，连接线从本列图标右侧连到下一列图标左侧 */
.k-steps--horizontal .k-step__connector {
  top: calc(var(--k-step-icon-size) / 2);
  inset-inline-start: calc(50% + var(--k-step-icon-size) / 2 + var(--k-size-xs));
  inset-inline-end: calc(-50% + var(--k-step-icon-size) / 2 + var(--k-size-xs));
  height: var(--k-line-width);
  transform: translateY(-50%);
}
.k-steps--horizontal.is-dot .k-step__connector {
  top: calc(var(--k-step-icon-size) / 2);
}
.k-steps--vertical {
  flex-direction: column;
}
.k-steps--vertical .k-step {
  padding-bottom: var(--k-size-lg);
}
.k-steps--vertical .k-step:last-child {
  padding-bottom: 0;
}
.k-steps--vertical .k-step__connector {
  top: calc(var(--k-step-icon-size) + var(--k-size-xxs));
  bottom: 0;
  inset-inline-start: calc(var(--k-step-icon-size) / 2);
  width: var(--k-line-width);
  transform: translateX(-50%);
}

/* 导航型：面包屑式文字步骤，当前项带主题色下划线 */
.k-steps--navigation {
  --k-step-nav-pad: var(--k-size-sm);
  --k-step-nav-gap: var(--k-size);
  --k-step-arrow-size: 30px;
  --k-step-arrow-color: color-mix(in oklab, var(--k-color-text-base), transparent 85%);
}
.k-steps--navigation.k-steps--sm {
  --k-step-nav-pad: var(--k-size-xs);
  --k-step-nav-gap: var(--k-size-sm);
}
.k-steps--navigation.k-steps--lg {
  --k-step-nav-pad: var(--k-size);
  --k-step-nav-gap: var(--k-size-md);
}
.k-steps--navigation .k-step__icon,
.k-steps--navigation .k-step__connector,
.k-steps--panel .k-step__icon,
.k-steps--panel .k-step__connector {
  display: none;
}
.k-steps--navigation .k-step.is-ellipsis .k-step__icon,
.k-steps--panel .k-step.is-ellipsis .k-step__icon,
.k-steps--navigation.is-show-icon .k-step__icon,
.k-steps--panel.is-show-icon .k-step__icon {
  display: inline-flex;
}
.k-steps--navigation.is-show-icon .k-step,
.k-steps--panel.is-show-icon .k-step {
  --k-step-icon-size: var(--k-size-lg);
}
.k-steps--navigation.is-show-icon .k-step {
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--k-size);
}
.k-steps--navigation.is-show-icon .k-step__content {
  width: auto;
  text-align: start;
}
.k-steps--navigation.is-show-icon.k-steps--vertical .k-step {
  justify-content: flex-start;
}
.k-steps--panel.is-show-icon .k-step {
  flex-direction: row;
  align-items: flex-start;
}
.k-steps--navigation .k-step,
.k-steps--panel .k-step {
  position: relative;
}
.k-step__arrow {
  position: absolute;
  z-index: 1;
  display: inline-flex;
  width: 1em;
  height: 1em;
  font-size: var(--k-step-arrow-size, 16px);
  color: var(--k-step-arrow-color, var(--k-color-text-quaternary));
  pointer-events: none;
}
.k-step__arrow svg {
  display: block;
}
.k-steps--navigation .k-step__arrow path {
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
}
.k-steps--horizontal .k-step__arrow {
  top: 50%;
  inset-inline-end: calc(var(--k-step-arrow-gap, 0px) / -2);
  transform: translate(50%, -50%);
}
.k-steps--vertical .k-step__arrow {
  bottom: calc(var(--k-step-arrow-gap, 0px) / -2);
  inset-inline-start: 50%;
  transform: translate(-50%, 50%) rotate(90deg);
}
.k-steps--navigation.k-steps--horizontal {
  gap: var(--k-step-nav-gap);
}
.k-steps--navigation.k-steps--horizontal .k-step {
  padding-block: var(--k-step-nav-pad);
}
.k-steps--navigation .k-step.is-current .k-step__title {
  color: var(--k-color-primary);
}
.k-steps--navigation .k-step.is-current.is-error .k-step__title {
  color: var(--k-color-error);
}
.k-steps--navigation.k-steps--horizontal .k-step.is-current.is-error::before {
  background: var(--k-color-error);
}
.k-steps--navigation.k-steps--horizontal .k-step.is-current::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 2px;
  border-radius: 1px;
  background: var(--k-color-primary);
}
.k-steps--navigation.k-steps--horizontal {
  --k-step-arrow-gap: var(--k-step-nav-gap);
}
.k-steps--navigation.k-steps--vertical .k-step {
  padding-inline-start: var(--k-size-xl);
  padding-bottom: var(--k-size-lg);
}
.k-steps--navigation.k-steps--vertical .k-step:last-child {
  padding-bottom: 0;
}
.k-steps--navigation.k-steps--vertical .k-step.is-current::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  bottom: var(--k-size-lg);
  width: 2px;
  border-radius: 1px;
  background: var(--k-color-primary);
}
.k-steps--navigation.k-steps--vertical .k-step.is-current.is-error::before {
  background: var(--k-color-error);
}
.k-steps--navigation.k-steps--vertical {
  --k-step-arrow-gap: var(--k-size-lg);
}
.k-steps--navigation.k-steps--vertical .k-step__arrow {
  top: calc(100% - var(--k-size-lg) / 2);
  bottom: auto;
  inset-inline-start: calc(var(--k-size-xl) / 2);
  transform: translate(-50%, -50%) rotate(90deg);
}

/* 面板型：单一容器内的连体分段，当前项浅底 + 底部指示条 */
.k-steps--panel {
  --k-step-panel-pad: var(--k-size-sm) var(--k-size);
  --k-step-panel-radius: var(--k-border-radius);
  --k-step-panel-divider: var(--k-color-border-secondary);
  overflow: hidden;
  border: var(--k-line-width) solid var(--k-step-panel-divider);
  border-radius: var(--k-step-panel-radius);
  background: var(--k-color-bg-container);
}
.k-steps--panel.k-steps--sm {
  --k-step-panel-pad: var(--k-size-xs) var(--k-size-sm);
  --k-step-panel-radius: var(--k-border-radius-sm);
}
.k-steps--panel.k-steps--lg {
  --k-step-panel-pad: var(--k-size) var(--k-size-md);
  --k-step-panel-radius: var(--k-border-radius-lg);
}
.k-steps--panel .k-step {
  padding: var(--k-step-panel-pad);
  background: transparent;
  transition: background var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-steps--panel.k-steps--horizontal {
  align-items: stretch;
  gap: 0;
}
.k-steps--panel.k-steps--horizontal .k-step + .k-step {
  border-inline-start: var(--k-line-width) solid var(--k-step-panel-divider);
}
.k-steps--panel.k-steps--vertical {
  gap: 0;
}
.k-steps--panel.k-steps--vertical .k-step + .k-step {
  border-block-start: var(--k-line-width) solid var(--k-step-panel-divider);
}
.k-steps--panel.k-steps--vertical .k-step:last-child {
  padding: var(--k-step-panel-pad);
}
.k-steps--panel .k-step__content {
  padding-block: 0;
  text-align: start;
}
.k-steps--panel .k-step.is-ellipsis {
  justify-content: center;
}
.k-steps--panel .k-step.is-clickable:not(.is-current):hover {
  background: var(--k-color-fill-quaternary);
}
.k-steps--panel .k-step.is-current {
  background: var(--k-color-primary-bg);
}
.k-steps--panel .k-step.is-current::after {
  content: '';
  position: absolute;
  background: var(--k-color-primary);
}
.k-steps--panel.k-steps--horizontal .k-step.is-current::after {
  inset-inline: 0;
  bottom: 0;
  height: 2px;
}
.k-steps--panel.k-steps--vertical .k-step.is-current::after {
  inset-block: 0;
  inset-inline-start: 0;
  width: 2px;
}
.k-steps--panel .k-step.is-current.is-error {
  background: var(--k-color-error-bg);
}
.k-steps--panel .k-step.is-current.is-error::after {
  background: var(--k-color-error);
}
.k-steps--panel .k-step.is-current .k-step__title {
  color: var(--k-color-primary);
}
.k-steps--panel .k-step.is-current.is-error .k-step__title {
  color: var(--k-color-error);
}
</style>