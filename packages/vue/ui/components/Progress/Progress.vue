<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-progress"
    :class="[
      `k-progress--${type}`,
      `k-progress--${size}`,
      `k-progress--${effectiveStatus}`,
      { 'is-active': effectiveStatus === 'active', 'is-with-info': showInfo },
      classNames?.root,
    ]"
    :style="[rootStyle, styles?.root]"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="percent"
    :aria-label="ariaLabel"
  >
    <div v-if="type === 'line'" data-part="track" class="k-progress__track" :class="classNames?.track" :style="styles?.track">
      <div
        data-part="success"
        class="k-progress__success"
        :class="classNames?.success"
        :style="[{ width: `${successPercent}%` }, styles?.success]"
      />
      <div
        data-part="bar"
        class="k-progress__bar"
        :class="classNames?.bar"
        :style="[{ width: `${percent}%`, background: strokeColor || undefined }, styles?.bar]"
      />
    </div>

    <div
      v-else-if="type === 'steps'"
      data-part="steps"
      class="k-progress__steps"
      :class="classNames?.steps"
      :style="styles?.steps"
    >
      <span
        v-for="i in stepCount"
        :key="i"
        class="k-progress__step"
        :class="[{ 'is-filled': i <= filledSteps }, classNames?.step]"
        :style="styles?.step"
      />
    </div>

    <div
      v-else
      data-part="circle"
      class="k-progress__circle"
      :class="classNames?.circle"
      :style="styles?.circle"
    >
      <svg viewBox="0 0 100 100" class="k-progress__svg" aria-hidden="true">
        <circle
          class="k-progress__circle-track"
          cx="50"
          cy="50"
          :r="radius"
          fill="none"
          :stroke-dasharray="`${arcLength} ${circumference}`"
          :transform="circleTransform"
        />
        <circle
          v-if="successPercent > 0"
          class="k-progress__circle-success"
          cx="50"
          cy="50"
          :r="radius"
          fill="none"
          :stroke-dasharray="`${successArc} ${circumference}`"
          :stroke-dashoffset="0"
          :transform="circleTransform"
        />
        <circle
          class="k-progress__circle-bar"
          cx="50"
          cy="50"
          :r="radius"
          fill="none"
          stroke-linecap="round"
          :stroke-dasharray="`${arcLength} ${circumference}`"
          :stroke-dashoffset="dashOffset"
          :transform="circleTransform"
          :style="{ stroke: strokeColor || undefined }"
        />
      </svg>
      <span v-if="showInfo" data-part="info" class="k-progress__info" :class="classNames?.info" :style="styles?.info">
        <slot name="format" :percent="percent">
          <span v-if="statusIcon" class="k-progress__status" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path :d="statusIcon" />
            </svg>
          </span>
          <template v-else>{{ infoText }}</template>
        </slot>
      </span>
    </div>

    <span
      v-if="showInfo && type !== 'circle' && type !== 'dashboard'"
      data-part="info"
      class="k-progress__info"
      :class="classNames?.info"
      :style="styles?.info"
    >
      <slot name="format" :percent="percent">
        <span v-if="statusIcon" class="k-progress__status" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path :d="statusIcon" />
          </svg>
        </span>
        <template v-else>{{ infoText }}</template>
      </slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KProgress' });

export type KProgressType = 'line' | 'circle' | 'dashboard' | 'steps';
export type KProgressStatus = 'normal' | 'active' | 'success' | 'exception' | 'warning';
export type KProgressSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
type ProgressPart = 'root' | 'track' | 'bar' | 'success' | 'info' | 'circle' | 'steps' | 'step';

export interface KProgressRenderScope {
  percent: number;
  successPercent: number;
  type: KProgressType;
  status: KProgressStatus;
  size: KProgressSize;
  showInfo: boolean;
  infoText: string;
  strokeColor: string | undefined;
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KProgressProps {
  percent?: number;
  successPercent?: number;
  type?: KProgressType;
  status?: KProgressStatus;
  size?: KProgressSize;
  showInfo?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  trailColor?: string;
  steps?: number;
  gapDegree?: number;
  format?: (percent: number) => string;
  ariaLabel?: string;
  render?: KRenderFn<KProgressRenderScope>;
  classNames?: Partial<Record<ProgressPart, string>>;
  styles?: Partial<Record<ProgressPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KProgressProps>(), {
  percent: 0,
  successPercent: 0,
  type: 'line',
  status: 'normal',
  size: 'md',
  showInfo: true,
  steps: 5,
  gapDegree: 75,
  ariaLabel: '进度',
});

const slots = useSlots();
const percent = computed(() => Math.min(100, Math.max(0, Number(props.percent) || 0)));
const successPercent = computed(() =>
  Math.min(100, Math.max(0, Number(props.successPercent) || 0)),
);
const effectiveStatus = computed<KProgressStatus>(() => {
  if (props.status !== 'normal') return props.status;
  return percent.value >= 100 ? 'success' : 'normal';
});
const infoText = computed(() => props.format?.(percent.value) ?? `${Math.round(percent.value)}%`);
const statusIcon = computed(() => {
  if (props.format) return null;
  if (effectiveStatus.value === 'success') return 'M3.5 8.4l2.9 2.9 6.1-6.1';
  if (effectiveStatus.value === 'exception') return 'M4.5 4.5l7 7M11.5 4.5l-7 7';
  if (effectiveStatus.value === 'warning') return 'M8 5v4M8 11.4v.1';
  return null;
});
const stepCount = computed(() => Math.max(1, Math.round(props.steps) || 1));
const filledSteps = computed(() => Math.round((percent.value / 100) * stepCount.value));

const radius = 48;
const circumference = 2 * Math.PI * radius;
const gap = computed(() => (props.type === 'dashboard' ? Math.min(360, Math.max(0, props.gapDegree)) : 0));
const arcLength = computed(() => circumference * (1 - gap.value / 360));
const dashOffset = computed(() => arcLength.value * (1 - percent.value / 100));
const successArc = computed(() => arcLength.value * (successPercent.value / 100));
const circleTransform = computed(() =>
  props.type === 'dashboard' ? `rotate(${90 + gap.value / 2} 50 50)` : 'rotate(-90 50 50)',
);

const rootStyle = computed<CSSProperties>(() => ({
  ...(props.strokeWidth ? { '--k-progress-stroke-width': `${props.strokeWidth}px` } : {}),
  ...(props.trailColor ? { '--k-progress-trail': props.trailColor } : {}),
}));
const rootAttrs = { 'data-part': 'root' };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KProgressRenderScope>(
  () => props.render,
  () => ({
    percent: percent.value,
    successPercent: successPercent.value,
    type: props.type,
    status: effectiveStatus.value,
    size: props.size,
    showInfo: props.showInfo,
    infoText: infoText.value,
    strokeColor: props.strokeColor,
    rootAttrs,
    slots,
  }),
);

defineSlots<{
  format?(scope: { percent: number }): VNodeChild;
  render?(scope: KProgressRenderScope): VNodeChild;
}>();
</script>

<style>
.k-progress {
  --k-progress-height: 8px;
  --k-progress-stroke-width: 8px;
  --k-progress-color: var(--k-color-primary);
  --k-progress-trail: var(--k-color-fill-secondary);
  --k-progress-info-color: var(--k-color-text-secondary);
  --k-progress-radius: var(--k-border-radius);
  --k-progress-circle-size: 120px;

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  width: 100%;
  min-width: 0;
  color: var(--k-color-text);
  font-size: var(--k-font-size-sm);
}
.k-progress *,
.k-progress *::before,
.k-progress *::after {
  box-sizing: border-box;
}
.k-progress--sm { --k-progress-height: 4px; --k-progress-circle-size: 96px; }
.k-progress--lg { --k-progress-height: 12px; --k-progress-circle-size: 144px; }
.k-progress--success { --k-progress-color: var(--k-color-success); }
.k-progress--exception { --k-progress-color: var(--k-color-error); }
.k-progress--warning { --k-progress-color: var(--k-color-warning); }

.k-progress__track {
  position: relative;
  flex: auto;
  min-width: 0;
  height: var(--k-progress-height);
  overflow: hidden;
  border-radius: var(--k-progress-radius);
  background: var(--k-progress-trail);
}
.k-progress__bar,
.k-progress__success {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: inherit;
  transition: width var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-progress__bar {
  background: var(--k-progress-color);
}
.k-progress__success {
  background: var(--k-color-success);
  opacity: 0.45;
}
.k-progress.is-active .k-progress__bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, white 35%, transparent),
    transparent
  );
  animation: k-progress-active 1.4s linear infinite;
}
@keyframes k-progress-active {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

.k-progress__info {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  min-width: 3.2em;
  color: var(--k-progress-info-color);
  font-variant-numeric: tabular-nums;
  justify-content: flex-end;
}
.k-progress--success .k-progress__info { color: var(--k-color-success); }
.k-progress--exception .k-progress__info { color: var(--k-color-error); }
.k-progress--warning .k-progress__info { color: var(--k-color-warning); }

.k-progress__circle {
  position: relative;
  flex: none;
  width: var(--k-progress-circle-size);
  height: var(--k-progress-circle-size);
}
.k-progress__svg {
  display: block;
  width: 100%;
  height: 100%;
}
.k-progress__circle-track {
  stroke: var(--k-progress-trail);
  stroke-width: var(--k-progress-stroke-width);
}
.k-progress__circle-success {
  stroke: var(--k-color-success);
  stroke-width: var(--k-progress-stroke-width);
  opacity: 0.35;
}
.k-progress__circle-bar {
  stroke: var(--k-progress-color);
  stroke-width: var(--k-progress-stroke-width);
  transition: stroke-dashoffset var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-progress__circle .k-progress__info {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  font-size: var(--k-font-size-lg);
  color: var(--k-color-text);
}

.k-progress__steps {
  display: flex;
  flex: auto;
  gap: 2px;
  min-width: 0;
}
.k-progress__step {
  flex: 1;
  height: var(--k-progress-height);
  border-radius: var(--k-progress-radius);
  background: var(--k-progress-trail);
  transition: background var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-progress__step.is-filled {
  background: var(--k-progress-color);
}
.k-progress__status {
  display: inline-flex;
  align-items: center;
}
@media (prefers-reduced-motion: reduce) {
  .k-progress__bar,
  .k-progress__success,
  .k-progress__circle-bar,
  .k-progress__step {
    transition: none;
  }
  .k-progress.is-active .k-progress__bar::after {
    animation: none;
  }
}
</style>