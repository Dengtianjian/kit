<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    v-bind="rootAttrs"
    class="k-badge"
    :class="[
      `k-badge--${size}`,
      { 'is-standalone': !hasContent, 'is-status': statusMode },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <slot />
    <Transition name="k-badge-fade">
      <span
        v-if="statusMode"
        data-part="status"
        class="k-badge__status"
        :class="{ 'is-pulse': pulse }"
        :style="statusStyle"
      />
    </Transition>
    <Transition name="k-badge-fade">
      <sup
        v-if="!statusMode && visible"
        data-part="count"
        class="k-badge__count"
        :class="[`is-${placement}`, { 'is-dot': dot, 'is-standalone': !hasContent, 'is-pulse': pulse }]"
        :style="[countStyle, styles?.count]"
        :aria-label="ariaLabel"
      >
        <slot name="count">{{ dot ? '' : displayCount }}</slot>
      </sup>
    </Transition>
    <Transition name="k-badge-fade">
      <span v-if="statusMode && text" class="k-badge__text" :class="classNames?.text" :style="styles?.text">{{ text }}</span>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KBadge' });

export type KBadgePresetColor = 'success' | 'processing' | 'warning' | 'error' | 'default';
export type KBadgeColor = KBadgePresetColor | `#${string}`;
export type KBadgePlacement =
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'start'
  | 'center'
  | 'end'
  | 'bottom-start'
  | 'bottom'
  | 'bottom-end';
type BadgePart = 'root' | 'count' | 'status' | 'text';

export interface KBadgeRenderScope {
  count: number | string | undefined;
  max: number;
  dot: boolean;
  showZero: boolean;
  pulse: boolean;
  placement: KBadgePlacement;
  statusMode: boolean;
  text: string | undefined;
  color: string | undefined;
  displayCount: string;
  visible: boolean;
  ariaLabel: string | undefined;
  hasContent: boolean;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KBadgeProps {
  /** 数字按 max 折叠；字符串原样展示（如 NEW） */
  count?: number | string;
  max?: number;
  dot?: boolean;
  showZero?: boolean;
  /** 呼吸动画（计数与状态圆点） */
  pulse?: boolean;
  /** 状态模式文案；传 text 进入状态模式 */
  text?: string;
  /** 语义预设或 16 进制；计数模式作底色，状态模式作圆点色 */
  color?: KBadgeColor;
  /** 九宫格方位，徽标中心对准对应角/边/中心 */
  placement?: KBadgePlacement;
  /** 在方位基础上额外偏移 [x, y]（px） */
  offset?: [number, number];
  size?: 'sm' | 'md';
  ariaLabel?: string;
  render?: KRenderFn<KBadgeRenderScope>;
  classNames?: Partial<Record<BadgePart, string>>;
  styles?: Partial<Record<BadgePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KBadgeProps>(), {
  max: 99,
  dot: false,
  showZero: false,
  pulse: false,
  placement: 'top-end',
  size: 'md',
});

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };
const presetColors: Record<KBadgePresetColor, string> = {
  success: 'var(--k-color-success)',
  processing: 'var(--k-color-primary)',
  warning: 'var(--k-color-warning)',
  error: 'var(--k-color-error)',
  default: 'var(--k-color-text-tertiary)',
};
const isPresetColor = (value: KBadgeColor): value is KBadgePresetColor => value in presetColors;
const colorValue = computed(() => {
  const color = props.color;
  if (!color) return undefined;
  return isPresetColor(color) ? presetColors[color] : color;
});

const hasContent = computed(() => Boolean(slots.default));
const displayCount = computed(() => {
  const count = props.count ?? 0;
  if (typeof count === 'string') return count;
  return count > props.max ? `${props.max}+` : String(count);
});
const visible = computed(() => {
  if (props.dot) return true;
  if (props.count === undefined) return false;
  if (typeof props.count === 'string') return true;
  return props.count !== 0 || props.showZero;
});
const countStyle = computed<CSSProperties>(() => {
  const style: Record<string, string> = {};
  if (colorValue.value) style.background = colorValue.value;
  if (props.pulse) style['--k-badge-pulse-color'] = colorValue.value ?? 'var(--k-color-error)';
  if (props.offset) {
    style['--k-badge-offset-x'] = `${props.offset[0]}px`;
    style['--k-badge-offset-y'] = `${props.offset[1]}px`;
  }
  return style as CSSProperties;
});
const statusMode = computed(() => {
  if (hasContent.value || visible.value) return false;
  if (props.text !== undefined) return true;
  return props.count === undefined && !props.dot && props.color !== undefined;
});
const statusColorValue = computed(() => colorValue.value ?? 'var(--k-color-text-tertiary)');
const statusStyle = computed<CSSProperties>(() => {
  const style: Record<string, string> = { background: statusColorValue.value };
  if (props.pulse) style['--k-badge-pulse-color'] = statusColorValue.value;
  return style as CSSProperties;
});

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KBadgeRenderScope>(
  () => props.render,
  () => ({
    count: props.count,
    max: props.max,
    dot: props.dot,
    showZero: props.showZero,
    pulse: props.pulse,
    placement: props.placement,
    statusMode: statusMode.value,
    text: props.text,
    color: colorValue.value,
    displayCount: displayCount.value,
    visible: visible.value,
    ariaLabel: props.ariaLabel,
    hasContent: hasContent.value,
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  count?(): VNodeChild;
  render?(scope: KBadgeRenderScope): VNodeChild;
}>();
</script>

<style>
.k-badge {
  --k-badge-height: 18px;
  --k-badge-font-size: 12px;

  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.k-badge__count {
  position: absolute;
  z-index: 1;
  scale: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--k-badge-height);
  height: var(--k-badge-height);
  padding: 0 6px;
  border-radius: 999px;
  background: var(--k-color-error);
  color: #fff;
  font-size: var(--k-badge-font-size);
  font-weight: var(--k-font-weight-strong);
  line-height: 1;
  white-space: nowrap;
  transform: translate(var(--k-badge-tx, 50%), var(--k-badge-ty, -50%))
    translate(var(--k-badge-offset-x, 0px), var(--k-badge-offset-y, 0px));
  box-shadow: 0 0 0 1px var(--k-color-bg-container);
}
.k-badge__count.is-top-start {
  top: 0;
  inset-inline-start: 0;
  --k-badge-tx: -50%;
  --k-badge-ty: -50%;
}
.k-badge__count.is-top {
  top: 0;
  inset-inline-start: 50%;
  --k-badge-tx: -50%;
  --k-badge-ty: -50%;
}
.k-badge__count.is-top-end {
  top: 0;
  inset-inline-end: 0;
  --k-badge-tx: 50%;
  --k-badge-ty: -50%;
}
.k-badge__count.is-start {
  top: 50%;
  inset-inline-start: 0;
  --k-badge-tx: -50%;
  --k-badge-ty: -50%;
}
.k-badge__count.is-center {
  top: 50%;
  inset-inline-start: 50%;
  --k-badge-tx: -50%;
  --k-badge-ty: -50%;
}
.k-badge__count.is-end {
  top: 50%;
  inset-inline-end: 0;
  --k-badge-tx: 50%;
  --k-badge-ty: -50%;
}
.k-badge__count.is-bottom-start {
  bottom: 0;
  inset-inline-start: 0;
  --k-badge-tx: -50%;
  --k-badge-ty: 50%;
}
.k-badge__count.is-bottom {
  bottom: 0;
  inset-inline-start: 50%;
  --k-badge-tx: -50%;
  --k-badge-ty: 50%;
}
.k-badge__count.is-bottom-end {
  bottom: 0;
  inset-inline-end: 0;
  --k-badge-tx: 50%;
  --k-badge-ty: 50%;
}
[dir='rtl'] .k-badge__count.is-top-start,
[dir='rtl'] .k-badge__count.is-start,
[dir='rtl'] .k-badge__count.is-bottom-start {
  --k-badge-tx: 50%;
}
[dir='rtl'] .k-badge__count.is-top-end,
[dir='rtl'] .k-badge__count.is-end,
[dir='rtl'] .k-badge__count.is-bottom-end {
  --k-badge-tx: -50%;
}
.k-badge__count.is-dot {
  min-width: 8px;
  width: 8px;
  height: 8px;
  padding: 0;
}
.k-badge__count.is-standalone {
  position: static;
  transform: none;
  box-shadow: none;
}
.k-badge--sm {
  --k-badge-height: 16px;
  --k-badge-font-size: 11px;
}
.k-badge__status {
  position: relative;
  display: inline-block;
  scale: 1;
  width: 6px;
  height: 6px;
  margin-inline-end: 6px;
  border-radius: 50%;
  background: var(--k-color-text-tertiary);
  flex: none;
}
.k-badge__text {
  color: var(--k-color-text);
  font-size: var(--k-font-size-sm);
}
.k-badge__count.is-pulse::after,
.k-badge__status.is-pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  animation: k-badge-pulse 1.6s ease-out infinite;
}
.k-badge__count.is-standalone.is-pulse::after {
  display: none;
}
@keyframes k-badge-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--k-badge-pulse-color);
    opacity: 0.65;
  }
  60% {
    box-shadow: 0 0 0 6px var(--k-badge-pulse-color);
    opacity: 0;
  }
  100% {
    box-shadow: 0 0 0 6px var(--k-badge-pulse-color);
    opacity: 0;
  }
}
.k-badge-fade-enter-active,
.k-badge-fade-leave-active {
  transition: opacity 0.18s ease, scale 0.18s ease;
}
.k-badge-fade-enter-from,
.k-badge-fade-leave-to {
  opacity: 0;
  scale: 0.6;
}
@media (prefers-reduced-motion: reduce) {
  .k-badge__count.is-pulse::after,
  .k-badge__status.is-pulse::after {
    animation: none;
  }
  .k-badge-fade-enter-active,
  .k-badge-fade-leave-active {
    transition: opacity 0.01ms;
  }
  .k-badge-fade-enter-from,
  .k-badge-fade-leave-to {
    opacity: 0;
    scale: 1;
  }
}
</style>