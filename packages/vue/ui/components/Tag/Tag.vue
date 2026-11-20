<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <span
    v-else
    v-bind="rootAttrs"
    class="k-tag"
    :class="[
      `k-tag--${preset ?? 'custom'}`,
      `k-tag--${variant}`,
      `k-tag--${size}`,
      {
        'is-round': round,
        'is-clickable': clickable,
        'is-closable': closable,
        [`is-icon-${iconPosition}`]: hasIcon,
      },
      classNames?.root,
    ]"
    :style="[colorStyle, styles?.root]"
  >
    <span
      v-if="hasIcon"
      data-part="icon"
      class="k-tag__icon"
      :class="[classNames?.icon, { 'is-spin': shouldSpin }]"
      :style="styles?.icon"
      aria-hidden="true"
    >
      <slot name="icon"><component :is="resolvedIcon" v-if="resolvedIcon" /></slot>
    </span>
    <span data-part="content" class="k-tag__content" :class="classNames?.content" :style="styles?.content">
      <slot />
    </span>
    <button
      v-if="closable"
      type="button"
      data-part="close"
      class="k-tag__close"
      :class="classNames?.close"
      :style="styles?.close"
      aria-label="关闭标签"
      @click="onClose"
    >
      <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
      </svg>
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, useSlots, watch } from 'vue';
import type { Component, CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import type { KSize } from '../../utils/size';

defineOptions({ name: 'KTag' });

export type KTagPresetColor = 'default' | 'primary' | 'processing' | 'success' | 'warning' | 'error';
/** color 同时接受预设状态名与十六进制色值 */
export type KTagColor = KTagPresetColor | `#${string}`;
export type KTagVariant = 'filled' | 'outlined' | 'dashed' | 'borderless' | 'text';
export type KTagSize = Extract<KSize, 'sm' | 'md' | 'lg'>;
export type KTagIconPosition = 'left' | 'right' | 'top' | 'bottom';
type TagPart = 'root' | 'icon' | 'content' | 'close';

export interface KTagRenderScope {
  color: KTagColor;
  /** color 解析出的预设状态；十六进制时为空 */
  preset?: KTagPresetColor;
  variant: KTagVariant;
  size: KTagSize;
  spin: boolean;
  iconPosition: KTagIconPosition;
  clickable: boolean;
  closable: boolean;
  round: boolean;
  rootAttrs: Record<string, unknown>;
  onClose: (e: MouseEvent) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KTagProps {
  /** 预设状态名或十六进制色值（#rgb / #rrggbb） */
  color?: KTagColor;
  variant?: KTagVariant;
  size?: KTagSize;
  /** 图标组件，也可用 #icon 插槽；processing 缺省显示加载图标 */
  icon?: Component;
  /** 图标旋转；缺省在 processing 时开启 */
  spin?: boolean;
  iconPosition?: KTagIconPosition;
  /** 可点击外观：鼠标指针改为手型（选中态由业务控制） */
  clickable?: boolean;
  closable?: boolean;
  round?: boolean;
  render?: KRenderFn<KTagRenderScope>;
  classNames?: Partial<Record<TagPart, string>>;
  styles?: Partial<Record<TagPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KTagProps>(), {
  color: 'default',
  variant: 'filled',
  size: 'md',
  icon: undefined,
  spin: undefined,
  iconPosition: 'left',
  clickable: false,
  closable: false,
  round: false,
});

const emit = defineEmits<{ close: [e: MouseEvent] }>();
const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };

function onClose(e: MouseEvent) {
  emit('close', e);
}

function parseHex(value?: string) {
  if (!value) return null;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map(char => char + char)
          .join('')
      : match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

const PRESET_COLORS: KTagPresetColor[] = ['default', 'primary', 'processing', 'success', 'warning', 'error'];
const preset = computed<KTagPresetColor | undefined>(() =>
  (PRESET_COLORS as string[]).includes(props.color) ? (props.color as KTagPresetColor) : undefined,
);

let colorWarned = false;
watch(
  () => props.color,
  value => {
    if (!value || preset.value || parseHex(value) || colorWarned) return;
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    colorWarned = true;
    console.warn(
      `[KTag] 无效的 color="${value}"：仅支持预设状态（${PRESET_COLORS.join(' / ')}）或 #rgb / #rrggbb。`,
    );
  },
  { immediate: true },
);

/** 十六进制颜色按 variant 推导：浅底/描边取透明度，文字保持原色并在浅色下加深 */
const colorStyle = computed<CSSProperties | undefined>(() => {
  const rgb = parseHex(props.color);
  if (!rgb) return undefined;
  const { r, g, b } = rgb;
  const solid = `rgb(${r}, ${g}, ${b})`;
  const strong = `light-dark(rgb(${Math.round(r * 0.78)}, ${Math.round(g * 0.78)}, ${Math.round(b * 0.78)}), ${solid})`;
  /* 只给语义基准色，final 变量与 hover/active 全部交给 variant 规则 */
  return {
    '--k-tag-base-color': strong,
    '--k-tag-base-bg': `rgba(${r}, ${g}, ${b}, 0.12)`,
    '--k-tag-base-bg-hover': `rgba(${r}, ${g}, ${b}, 0.18)`,
    '--k-tag-base-bg-active': `rgba(${r}, ${g}, ${b}, 0.26)`,
    '--k-tag-base-border': `rgba(${r}, ${g}, ${b}, 0.3)`,
    '--k-tag-base-border-hover': `rgba(${r}, ${g}, ${b}, 0.55)`,
  } as CSSProperties;
});

const LoadingIcon = defineComponent({
  name: 'KTagLoading',
  setup() {
    return () =>
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
          'aria-hidden': 'true',
        },
        [
          h('circle', { cx: 8, cy: 8, r: 5.5, opacity: 0.25 }),
          h('path', { d: 'M8 2.5a5.5 5.5 0 0 1 5.5 5.5' }),
        ],
      );
  },
});
const resolvedIcon = computed<Component | undefined>(
  () => props.icon ?? (preset.value === 'processing' ? LoadingIcon : undefined),
);
const hasIcon = computed(() => Boolean(resolvedIcon.value || slots.icon));
const shouldSpin = computed(() => props.spin ?? preset.value === 'processing');

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KTagRenderScope>(
  () => props.render,
  () => ({
    color: props.color,
    preset: preset.value,
    variant: props.variant,
    size: props.size,
    spin: shouldSpin.value,
    iconPosition: props.iconPosition,
    clickable: props.clickable,
    closable: props.closable,
    round: props.round,
    rootAttrs,
    onClose,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  icon?(): VNodeChild;
  render?(scope: KTagRenderScope): VNodeChild;
}>();
</script>

<style>
.k-tag {
  --k-tag-height: var(--k-control-height-sm);
  --k-tag-padding-x: var(--k-size);
  --k-tag-line-height: 1.4;
  --k-tag-base-bg: var(--k-color-fill-tertiary);
  --k-tag-base-bg-hover: var(--k-color-fill-secondary);
  --k-tag-base-bg-active: var(--k-color-border-secondary);
  --k-tag-base-border: var(--k-color-border);
  --k-tag-base-border-hover: var(--k-color-border);
  --k-tag-base-color: var(--k-color-text-secondary);
  --k-tag-bg: var(--k-tag-base-bg);
  --k-tag-border: var(--k-tag-base-border);
  --k-tag-color: var(--k-tag-base-color);

  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  max-width: 100%;
  height: var(--k-tag-height);
  padding: 0 var(--k-tag-padding-x);
  border: var(--k-line-width) solid var(--k-tag-border);
  border-radius: var(--k-border-radius-sm);
  background: var(--k-tag-bg);
  color: var(--k-tag-color);
  font-size: var(--k-font-size-sm);
  line-height: 1;
  white-space: nowrap;
  cursor: default;
  user-select: none;
}
.k-tag.is-round {
  border-radius: 999px;
}
.k-tag__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  line-height: 1;
}
.k-tag__icon.is-spin {
  animation: k-tag-spin 1s linear infinite;
}
@keyframes k-tag-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .k-tag__icon.is-spin {
    animation: none;
  }
}
.k-tag__content {
  overflow: hidden;
  text-overflow: ellipsis;
  /* 行高必须容纳字形上下伸部，line-height:1 会把 g / j / p 的下伸裁掉；0.08em 做视觉居中 */
  line-height: var(--k-tag-line-height);
  transform: translateY(0.08em);
}
/* 图标四向：DOM 上图标在内容前，用 order 调整位置 */
.k-tag.is-icon-right .k-tag__icon {
  order: 2;
}
.k-tag.is-icon-top,
.k-tag.is-icon-bottom {
  flex-direction: column;
  height: auto;
  min-height: var(--k-tag-height);
  padding-block: var(--k-size-xxs);
  white-space: normal;
}
.k-tag.is-icon-bottom .k-tag__icon {
  order: 2;
}
.k-tag__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  order: 3;
  padding: 0;
  margin-inline-end: calc(var(--k-size-xxs) * -1);
  border: none;
  background: transparent;
  color: inherit;
  font-size: 12px;
  opacity: 0.7;
  cursor: pointer;
}
.k-tag__close:hover {
  opacity: 1;
}
.k-tag__close:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 1px;
  border-radius: 2px;
}
/* 三档尺寸：左右内边距 12 / 16 / 20 */
.k-tag--sm {
  --k-tag-height: var(--k-control-height-xs);
  --k-tag-padding-x: var(--k-size-sm);
  font-size: 12px;
}
.k-tag--lg {
  --k-tag-height: var(--k-control-height-lg);
  --k-tag-padding-x: var(--k-size-md);
  font-size: var(--k-font-size);
}
/* 语义色：primary 保留；processing 对齐 antd 状态命名，默认跟随 info（即主色） */
.k-tag--primary {
  --k-tag-base-bg: var(--k-color-primary-bg);
  --k-tag-base-bg-hover: var(--k-color-primary-bg-hover);
  --k-tag-base-bg-active: var(--k-color-primary-border);
  --k-tag-base-border: var(--k-color-primary-border);
  --k-tag-base-border-hover: var(--k-color-primary-border-hover);
  --k-tag-base-color: var(--k-color-primary-text-strong);
}
.k-tag--processing {
  --k-tag-base-bg: var(--k-color-info-bg);
  --k-tag-base-bg-hover: var(--k-color-info-bg-hover);
  --k-tag-base-bg-active: var(--k-color-info-border);
  --k-tag-base-border: var(--k-color-info-border);
  --k-tag-base-border-hover: var(--k-color-info-border-hover);
  --k-tag-base-color: var(--k-color-info-text-strong);
}
.k-tag--success {
  --k-tag-base-bg: var(--k-color-success-bg);
  --k-tag-base-bg-hover: var(--k-color-success-bg-hover);
  --k-tag-base-bg-active: var(--k-color-success-border);
  --k-tag-base-border: var(--k-color-success-border);
  --k-tag-base-border-hover: var(--k-color-success-border-hover);
  --k-tag-base-color: var(--k-color-success-text-strong);
}
.k-tag--warning {
  --k-tag-base-bg: var(--k-color-warning-bg);
  --k-tag-base-bg-hover: var(--k-color-warning-bg-hover);
  --k-tag-base-bg-active: var(--k-color-warning-border);
  --k-tag-base-border: var(--k-color-warning-border);
  --k-tag-base-border-hover: var(--k-color-warning-border-hover);
  --k-tag-base-color: var(--k-color-warning-text-strong);
}
.k-tag--error {
  --k-tag-base-bg: var(--k-color-error-bg);
  --k-tag-base-bg-hover: var(--k-color-error-bg-hover);
  --k-tag-base-bg-active: var(--k-color-error-border);
  --k-tag-base-border: var(--k-color-error-border);
  --k-tag-base-border-hover: var(--k-color-error-border-hover);
  --k-tag-base-color: var(--k-color-error-text-strong);
}
/* 外观由 variant 决定；十六进制 color 会以内联变量覆盖 */
.k-tag--filled {
  --k-tag-bg: var(--k-tag-base-bg);
  --k-tag-border: var(--k-tag-base-border);
  --k-tag-color: var(--k-tag-base-color);
}
.k-tag--outlined {
  --k-tag-bg: transparent;
  --k-tag-border: var(--k-tag-base-border);
  --k-tag-color: var(--k-tag-base-color);
}
.k-tag--dashed {
  --k-tag-bg: transparent;
  --k-tag-border: var(--k-tag-base-border);
  --k-tag-color: var(--k-tag-base-color);
  border-style: dashed;
}
.k-tag--borderless {
  --k-tag-bg: var(--k-tag-base-bg);
  --k-tag-border: transparent;
  --k-tag-color: var(--k-tag-base-color);
}
/* 交互反馈只对 clickable 生效，具体反馈仍由 variant 决定：
   filled / borderless 加深底色，outlined / dashed 加深描边并铺浅底 */
.k-tag.is-clickable.k-tag--filled:hover,
.k-tag.is-clickable.k-tag--borderless:hover {
  --k-tag-bg: var(--k-tag-base-bg-hover);
}
.k-tag.is-clickable.k-tag--filled:active,
.k-tag.is-clickable.k-tag--borderless:active {
  --k-tag-bg: var(--k-tag-base-bg-active);
}
.k-tag.is-clickable.k-tag--outlined:hover,
.k-tag.is-clickable.k-tag--dashed:hover {
  --k-tag-bg: var(--k-tag-base-bg);
  --k-tag-border: var(--k-tag-base-border-hover);
}
.k-tag.is-clickable.k-tag--outlined:active,
.k-tag.is-clickable.k-tag--dashed:active {
  --k-tag-bg: var(--k-tag-base-bg-hover);
  --k-tag-border: var(--k-tag-base-border-hover);
}
/* text：默认无底色无边框，clickable 时 hover / active 才出现语义浅底 */
.k-tag--text {
  --k-tag-bg: transparent;
  --k-tag-border: transparent;
  --k-tag-color: var(--k-tag-base-color);
}
.k-tag--default.k-tag--text {
  --k-tag-color: var(--k-color-text);
}
.k-tag.is-clickable.k-tag--text:hover {
  --k-tag-bg: var(--k-tag-base-bg);
}
.k-tag.is-clickable.k-tag--text:active {
  --k-tag-bg: var(--k-tag-base-bg-hover);
}
.k-tag.is-clickable {
  cursor: pointer;
}
</style>