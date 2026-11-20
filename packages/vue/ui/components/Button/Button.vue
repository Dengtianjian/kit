<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <component
    :is="tag"
    v-else
    ref="rootEl"
    v-bind="rootAttrs"
    :class="[classes, classNames?.root]"
    :style="styles?.root"
    v-on="rootOn"
  >
    <span v-if="loading" data-part="loading" :class="['k-button__spinner', classNames?.loading]" :style="styles?.loading">
      <slot name="loading" />
    </span>
    <KIcon v-else-if="hasIcon" data-part="icon" :class="['k-button__icon', classNames?.icon]" :style="styles?.icon" :component="icon ?? undefined">
      <slot name="icon" />
    </KIcon>
    <!-- 无文字内容不落 span：否则 icon-only 按钮变成 [icon][空 content] 两项，gap 把图标挤离中心 -->
    <span v-if="$slots.default" data-part="content" :class="['k-button__content', classNames?.content]" :style="styles?.content">
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue';
import type { Component, CSSProperties, VNodeChild } from 'vue';
import KIcon from '../Icon/Icon.vue';
import { useKConfig } from '../../composables/useKConfig';
import { useResponsiveValue } from '../../composables/useResponsiveValue';
import type { KResponsiveValue, KResponsiveMap } from '../../composables/useResponsiveValue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import { buttonGroupSizeKey } from './groupContext';
import type { ButtonSize } from './groupContext';

defineOptions({ name: 'KButton' });

type ButtonType = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'link';
type ButtonVariant = 'outlined' | 'filled' | 'tonal' | 'text' | 'quiet' | 'dashed' | 'ghost' | 'plain' | 'soft' | 'border';
type ButtonShape = 'default' | 'round' | 'circle' | 'square';
type ButtonPart = 'root' | 'loading' | 'icon' | 'content';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KButtonRenderScope {
  type: ButtonType;
  variant: ButtonVariant;
  /** 合并后的尺寸（prop > 组下发 > md） */
  size: ButtonSize;
  shape: ButtonShape;
  loading: boolean;
  disabled: boolean;
  block: boolean;
  href: string | undefined;
  target: string | undefined;
  icon: Component | null;
  iconPlacement: 'start' | 'end' | 'top' | 'bottom';
  nativeType: 'button' | 'submit' | 'reset';
  /** 派生标签：有 href = a，否则 button */
  tag: 'a' | 'button';
  hasIcon: boolean;
  /** 波纹锚点（默认视觉用；自绘可绑可不绑） */
  rootEl: typeof rootEl;
  /** 原生语义包：type/href/target/disabled/aria-disabled/aria-busy + data-part */
  rootAttrs: Record<string, unknown>;
  /** click 包：loading/disabled 拦截 + 波纹 + emit 照跑 */
  rootOn: { click: (e: MouseEvent) => void };
  slots: ReturnType<typeof useSlots>;
}

interface KButtonProps {
  type?: ButtonType;
  variant?: ButtonVariant;
  /** 缺省走 KButtonGroup 下发 size，无组则 md；对象/字符串按断点取值 */
  size?: ButtonSize | KResponsiveMap<ButtonSize> | string;
  shape?: ButtonShape;
  loading?: boolean;
  disabled?: boolean;
  /** 撑满容器宽 */
  block?: boolean;
  /** 有 href → 渲染 `<a>` */
  href?: string;
  /** 配合 href 的外链打开方式 */
  target?: string;
  /** 也可 #icon 插槽；两者都无 = 纯文字按钮 */
  icon?: Component | null;
  /** 图标位置：start = 文字前（缺省），end = 文字后，top / bottom = 文字上 / 下（按钮转纵向） */
  iconPlacement?: 'start' | 'end' | 'top' | 'bottom';
  /** 点击波纹开关：prop > Provider defaults.KButton.wave > Provider wave.disabled 取反 > 开 */
  wave?: boolean;
  nativeType?: 'button' | 'submit' | 'reset';
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KButtonRenderScope>;
  classNames?: Partial<Record<ButtonPart, string>>;
  styles?: Partial<Record<ButtonPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KButtonProps>(), {
  type: 'default',
  variant: 'outlined',
  shape: 'default',
  loading: false,
  disabled: false,
  block: false,
  icon: null,
  iconPlacement: 'start',
  nativeType: 'button',
  // 显式 undefined：Vue 对纯 Boolean 型且无缺省的 prop 缺省填 false，会吞掉「未传」三态
  wave: undefined,
});

/* 组内下发：子级自传 size 优先（2026-11-17 拍板，naive ButtonGroup 同款） */
const groupSize = inject(buttonGroupSizeKey, undefined);
const resolvedSize = useResponsiveValue<ButtonSize>(
  () => props.size as KResponsiveValue<ButtonSize> | undefined,
  { coerce: raw => raw as ButtonSize },
);
const mergedSize = computed<ButtonSize>(() => resolvedSize.value ?? groupSize?.value ?? 'md');

/* 波纹开关解析（antd 同款双通道：Provider 全局 wave.disabled + 实例级 prop） */
const config = useKConfig();
const waveOn = computed(() => {
  if (props.variant === 'text' || props.type === 'link') return false;
  if (props.wave !== undefined) return props.wave;
  const d = config?.defaults.value?.KButton?.wave;
  if (d !== undefined) return Boolean(d);
  return !config?.wave.value?.disabled;
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const slots = useSlots();

const isDisabled = computed(() => props.disabled);
const tag = computed(() => (props.href ? 'a' : 'button'));
const hasIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon));

/* 点击波纹（对齐 antd v5 Wave）：摘类→强制重排→挂类重启动画。
   曾用 waving ref + nextTick 摘挂，同帧内 Vue 批处理不产生真实绘制，连点波纹时有时无（2026-11-17 修复） */
const rootEl = ref<HTMLElement>();
function triggerWave() {
  const el = rootEl.value;
  if (!el) return;
  el.classList.remove('k-button--waving');
  void el.offsetWidth;
  el.classList.add('k-button--waving');
}

const classes = computed(() => [
  'k-button',
  `k-button--${props.type}`,
  // type=link 独立于矩阵（antd 无框文本按钮语义），不落 variant 类名
  props.type === 'link' ? null : `k-button--${props.variant}`,
  `k-button--${mergedSize.value}`,
  // shape=default 不落 class：与 type 轴的 k-button--default 同名，会让 default 列规则误伤所有语义按钮
  props.shape === 'default' ? null : `k-button--${props.shape}`,
  {
    'is-loading': props.loading,
    'is-disabled': isDisabled.value || props.loading,
    'k-button--block': props.block,
    'k-button--icon-end': props.iconPlacement === 'end',
    'k-button--icon-top': props.iconPlacement === 'top',
    'k-button--icon-bottom': props.iconPlacement === 'bottom',
  },
]);

function onClick(event: MouseEvent) {
  if (isDisabled.value || props.loading) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (waveOn.value) triggerWave();
  emit('click', event);
}

/* ---------- headless 绑定包：默认模板与自绘共用 ---------- */
const rootAttrs = computed(() => ({
  'data-part': 'root',
  type: tag.value === 'button' ? props.nativeType : undefined,
  href: props.href,
  target: tag.value === 'a' ? props.target : undefined,
  disabled: tag.value === 'button' && (isDisabled.value || props.loading) ? true : undefined,
  'aria-disabled': tag.value === 'a' && isDisabled.value ? true : undefined,
  'aria-busy': props.loading ? true : undefined,
}));
const rootOn = { click: onClick };

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KButtonRenderScope>(
  () => props.render,
  () => ({
    type: props.type,
    variant: props.variant,
    size: mergedSize.value,
    shape: props.shape,
    loading: props.loading,
    disabled: isDisabled.value,
    block: props.block,
    href: props.href,
    target: props.target,
    icon: props.icon,
    iconPlacement: props.iconPlacement,
    nativeType: props.nativeType,
    tag: tag.value,
    hasIcon: hasIcon.value,
    rootEl,
    rootAttrs: rootAttrs.value,
    rootOn,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  icon?(): VNodeChild;
  loading?(): VNodeChild;
  render?(scope: KButtonRenderScope): VNodeChild;
}>();

if (import.meta.env.DEV) {
  // antd 的 type=text 在 kit 里是 variant=text；误写会落成无效 type 类名且无任何 hover 反馈
  if (!['default', 'primary', 'success', 'warning', 'danger', 'info', 'link'].includes(props.type)) {
    console.warn(`[KButton] 无效 type="${props.type}"，text/quiet/dashed/outlined/filled/tonal/ghost/plain/soft/border 请改用 variant`);
  }
  if (props.shape === 'circle' && slots.default) {
    console.warn('[KButton] shape=circle 要求 icon-only，文字内容将被裁切');
  }
}
</script>

<style>

.k-button,
/* href 渲染为 <a> 时并列 :is(a)：与宿主 .vp-doc a 同特异度（0,1,1）靠加载顺序赢；
   hover 态见下方 :is(a):hover 显式 color（vp-doc a:hover = 0,1,2 更高） */
.k-button:is(a) {
  /* 部件变量缺省 = default type × outlined 列（矩阵基线，docs site /vue/ui/components/button.md §1.3） */
  --k-button-c: var(--k-color-primary); /* 语义基准：default 的 hover 强调也用它 */
  --k-button-c-text: var(--k-color-primary-text-strong); /* default 的彩字强调 = 主色深档 */
  --k-button-height: var(--k-control-height);
  --k-button-padding-x: var(--k-padding-md);
  --k-button-radius: var(--k-border-radius);
  --k-button-bg: transparent;
  --k-button-text-color: var(--k-color-text);
  --k-button-border-color: var(--k-color-border);
  --k-button-icon-gap: var(--k-size-xxs);
  --k-button-font-size: var(--k-font-size);
  --k-button-wave-color: color-mix(in oklab, var(--k-button-c) 24%, transparent);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--k-button-icon-gap);
  height: var(--k-button-height);
  padding: 0 var(--k-button-padding-x);
  border: var(--k-line-width) var(--k-line-type) var(--k-button-border-color);
  border-radius: var(--k-button-radius);
  background: var(--k-button-bg);
  color: var(--k-button-text-color);
  font-family: var(--k-font-family);
  font-size: var(--k-button-font-size);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}

/* ---------- type 基准色槽（variant 规则消费 c，六种语义同构）
   c-text = 白底彩字深档（R4b：text-strong 别名，WCAG 4.5 校准），仅文字通道用它 ---------- */
.k-button--primary { --k-button-c: var(--k-color-primary); --k-button-c-text: var(--k-color-primary-text-strong); }
.k-button--success { --k-button-c: var(--k-color-success); --k-button-c-text: var(--k-color-success-text-strong); }
.k-button--warning { --k-button-c: var(--k-color-warning); --k-button-c-text: var(--k-color-warning-text-strong); }
.k-button--danger { --k-button-c: var(--k-color-error); --k-button-c-text: var(--k-color-error-text-strong); }
.k-button--info { --k-button-c: var(--k-color-info); --k-button-c-text: var(--k-color-info-text-strong); }
.k-button--link { --k-button-c: var(--k-color-link); --k-button-c-text: var(--k-color-link-text-strong); }

/* ---------- 语义 type × variant（outlined 为实底主按钮）
   实底白字对比度随用户 seed 而变，不硬修（R4c 撤销拍板 2026-11-17：翻深字观感否决） ---------- */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--outlined {
  --k-button-bg: var(--k-button-c);
  --k-button-border-color: var(--k-button-c);
  --k-button-text-color: var(--k-color-text-light-solid);
}

:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--filled {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 10%, var(--k-mix-onto));
  --k-button-border-color: transparent;
  --k-button-text-color: var(--k-button-c-text);
}

/* tonal = 等级第三档（抄 naive 等级区分 2026-11-17：基础=outlined / 次要=filled / 次次要=tonal / 次次次要=text；
   值名当日由 tertiary 改 tonal——与 fill 阶梯 tertiary 撞名歧义，且观感词族 outlined/filled/dashed 更匹配）
   灰底顶格 4%（fill-tertiary），语义档底同灰、文字取语义色（naive 同款） */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--tonal {
  --k-button-bg: var(--k-color-fill-tertiary);
  --k-button-border-color: transparent;
  --k-button-text-color: var(--k-button-c-text);
}

/* 波纹跟主题色（2026-11-17 用户「filled/tonal 等交互后波纹颜色和按钮不一致」）：
   实底/灰底/浅底档波纹取当前 --k-button-bg（var 间接引用即时解析，hover/active 换底自动跟随）；
   透明底档（text/ghost/border/plain/outlined…）仍走 c 24% 字色波纹 */
:is(.k-button--filled, .k-button--tonal, .k-button--soft, .k-button--quiet) {
  --k-button-wave-color: color-mix(in oklab, var(--k-button-bg) 60%, transparent);
}

:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--text,
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--quiet {
  --k-button-bg: transparent;
  --k-button-border-color: transparent;
  --k-button-text-color: var(--k-button-c-text);
}

:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--dashed {
  --k-button-bg: transparent;
  --k-button-border-color: var(--k-button-c);
  --k-button-text-color: var(--k-button-c-text);
  --k-button-line-type: dashed;
}
.k-button--dashed { border-style: var(--k-button-line-type, var(--k-line-type)); }

/* ---------- ghost / plain / soft（2026-11-17 拍板三档） ----------
   ghost = 透明底档（跟 naive 路数）：彩色/复杂底图上用，交互只变边框+文字、永不填充；
   default×ghost = 中性边 + 正文字（基线原形态，不落静置规则）
   plain / soft = 白底族（2026-11-17 当日再拍板：soft 去边框，与有框 plain 拉开分工）：
   plain：hover/active 变边框+文字（背景恒容器白，antd default 交互路数）；
   soft：无边框，hover/active 背景 tint + 文字变色、边框静止（vant plain 按压路数）；
   border = 隐框档：静置边框透明占位（保高度不跳版），交互才现边框色，背景/文字恒静置 */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--ghost {
  --k-button-bg: transparent;
  --k-button-border-color: var(--k-button-c);
  --k-button-text-color: var(--k-button-c-text);
}
.k-button--plain,
.k-button--soft {
  --k-button-bg: var(--k-color-bg-container);
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--plain {
  --k-button-border-color: var(--k-button-c);
  --k-button-text-color: var(--k-button-c-text);
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--soft {
  --k-button-border-color: transparent;
  --k-button-text-color: var(--k-button-c-text);
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--border {
  --k-button-border-color: transparent;
  --k-button-text-color: var(--k-button-c-text);
}

/* ---------- default type 的 variant 列 ---------- */
.k-button--default.k-button--filled {
  --k-button-bg: var(--k-color-fill-secondary);
  --k-button-border-color: transparent;
}
.k-button--default.k-button--tonal {
  --k-button-bg: var(--k-color-fill-tertiary);
  --k-button-border-color: transparent;
}
/* tonal 状态按 naive 等差 +4%（5→9→13 映射到 4→8→12），阶梯内无此档，破格值 */
.k-button.k-button--tonal:hover:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-color-text-base), transparent 92%);
}
.k-button.k-button--tonal:active:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-color-text-base), transparent 88%);
}
.k-button--default.k-button--dashed {
  /* 2026-11-17 改判：dashed 静置无底色（原继承 filled 灰底），与语义 dashed 同构 = 透明底 + 虚线框 */
  --k-button-bg: transparent;
  --k-button-border-color: var(--k-color-border);
  border-style: dashed;
}
.k-button--default.k-button--text,
.k-button--default.k-button--quiet {
  --k-button-bg: transparent;
  --k-button-border-color: transparent;
}
/* soft 无边框 / border 隐框：default 档同样透明（双类名防 <a> 上被基线 :is(a) 压回） */
.k-button--default.k-button--soft,
.k-button--default.k-button--border {
  --k-button-border-color: transparent;
}

/* ---------- 状态：局部重声明（变量不进状态名） ---------- */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--outlined:hover:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 90%, var(--k-mix-up));
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--outlined:active:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 75%, var(--k-mix-down));
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 75%, var(--k-mix-down));
}

:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--filled:hover:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 16%, var(--k-mix-onto));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--filled:active:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 24%, var(--k-mix-onto));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

/* text（2026-11-17 拆分定稿）= 纯文字交互：hover/active 只变文字色、永不上底（naive text 路数）；
   quiet = 原 text 改名：交互上灰底（antd text 路数），静置同 text */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--text:hover:not(.is-disabled) {
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--text:active:not(.is-disabled) {
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--quiet:hover:not(.is-disabled) {
  --k-button-bg: var(--k-color-fill-tertiary);
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--quiet:active:not(.is-disabled) {
  --k-button-bg: var(--k-color-fill-secondary);
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--dashed:hover:not(.is-disabled) {
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 90%, var(--k-mix-up));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info).k-button--dashed:active:not(.is-disabled) {
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 75%, var(--k-mix-down));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

/* ghost / plain 状态同通道：只变边框+文字；default 档也进列表（c=primary → 自然落主色浅/深档） */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--ghost:hover:not(.is-disabled),
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--plain:hover:not(.is-disabled) {
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 90%, var(--k-mix-up));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--ghost:active:not(.is-disabled),
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--plain:active:not(.is-disabled) {
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 75%, var(--k-mix-down));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

/* soft 状态：背景 tint + 文字变色，边框静止；tint 浓度取 filled 阶梯下移一档（hover 10% / active 16%） */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--soft:hover:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 10%, var(--k-mix-onto));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--soft:active:not(.is-disabled) {
  --k-button-bg: color-mix(in oklab, var(--k-button-c) 16%, var(--k-mix-onto));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

/* border 档状态：只现出边框色（hover 90%up / active 75%down），背景与文字恒静置；default 档 c=primary 自然落主色 */
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--border:hover:not(.is-disabled) {
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 90%, var(--k-mix-up));
  /* 2026-11-17 调参：用户「交互后文字颜色也跟着变」，补 text 公式（与 plain 同式） */
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
:is(.k-button--primary, .k-button--success, .k-button--warning, .k-button--danger, .k-button--info, .k-button--default).k-button--border:active:not(.is-disabled) {
  --k-button-border-color: color-mix(in oklab, var(--k-button-c) 75%, var(--k-mix-down));
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

/* ---------- type=link：独立于矩阵 = 无框文本按钮（antd 语义），hover/active 只变文字色 ---------- */
.k-button--link {
  --k-button-bg: transparent;
  --k-button-border-color: transparent;
  --k-button-text-color: var(--k-button-c-text);
}
.k-button--link:hover:not(.is-disabled) {
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
.k-button--link:active:not(.is-disabled) {
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}
.k-button--link.is-disabled {
  --k-button-bg: transparent;
  --k-button-border-color: transparent;
}

.k-button--default.k-button--outlined:hover:not(.is-disabled),
.k-button--default.k-button--dashed:hover:not(.is-disabled) {
  --k-button-border-color: var(--k-color-primary-hover);
  /* R4b 彩字深档：文字通道走 c-text（default 基线 = primary-text-strong），边框保持原主色档 */
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
.k-button--default.k-button--outlined:active:not(.is-disabled),
.k-button--default.k-button--dashed:active:not(.is-disabled) {
  --k-button-border-color: var(--k-color-primary-active);
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}
.k-button--default.k-button--filled:hover:not(.is-disabled) { --k-button-bg: var(--k-color-fill); }
/* active 原为 fill-secondary = 基线色 → 按住零反馈；fill 阶梯顶格 15%，按压再深一档用 20% 破格值 */
.k-button--default.k-button--filled:active:not(.is-disabled) { --k-button-bg: color-mix(in oklab, var(--k-color-text-base), transparent 80%); }
/* default×quiet = 原 default×text 的灰底交互（改名跟随）；default×text = 只变文字色（c=primary 落主色浅/深档） */
.k-button--default.k-button--quiet:hover:not(.is-disabled) { --k-button-bg: var(--k-color-fill-tertiary); }
.k-button--default.k-button--quiet:active:not(.is-disabled) { --k-button-bg: var(--k-color-fill-secondary); }
.k-button--default.k-button--text:hover:not(.is-disabled) {
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 90%, var(--k-mix-up));
}
.k-button--default.k-button--text:active:not(.is-disabled) {
  --k-button-text-color: color-mix(in oklab, var(--k-button-c-text) 75%, var(--k-mix-down));
}

/* :is(a) 只继承参数特异度（a = 类型选择器 0,0,1），基线 .k-button:is(a) = 0,1,1，
   与宿主 .vp-doc a 打平靠顺序赢；但 .vp-doc a:hover = 0,1,2 更高，
   而状态规则只重声明自定义属性不声明 color 本身 → hover 必须显式落 color 压回 */
.k-button:is(a):hover {
  text-decoration: none;
  color: var(--k-button-text-color);
}

.k-button:focus-visible {
  box-shadow: 0 0 0 var(--k-control-outline-width) color-mix(in oklab, var(--k-button-c), transparent 85%);
  outline: none;
}

/* ---------- 点击波纹（antd v5 Wave 同形态，2026-11-17 拍板引入、同日调参放慢 0.6s；同日再缩宽 80%：0→4px（35% 保持）→6.4px；动画期间 box-shadow 压过 focus 描边） ---------- */
.k-button.k-button--waving {
  animation: k-button-wave var(--k-motion-duration-wave) var(--k-motion-ease-wave);
}
@keyframes k-button-wave {
  from { box-shadow: 0 0 0 0 var(--k-button-wave-color); }
  35% { box-shadow: 0 0 0 4px var(--k-button-wave-color); }
  to { box-shadow: 0 0 0 6.4px transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .k-button.k-button--waving { animation: none; }
}

/* ---------- App 端按压（2026-11-17 拍板走 antd-mobile 实况）：真触屏落波纹、改黑 8% 遮罩。
   门槛用 hover:none（触屏判定）而非视口宽——桌面窄窗仍归桌面波纹；底色加深照常叠加。 ---------- */
@media (hover: none) {
  .k-button {
    position: relative;
  }
  .k-button::before {
    content: " ";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: #000;
    opacity: 0;
    transition: opacity ease 0.15s;
    pointer-events: none;
  }
  .k-button:active:not(.is-disabled)::before {
    opacity: 0.08;
  }
  .k-button.k-button--waving {
    animation: none;
  }
}

.k-button.is-disabled {
  --k-button-bg: var(--k-color-fill-secondary);
  --k-button-text-color: var(--k-color-text-quaternary);
  --k-button-border-color: var(--k-color-border);
  cursor: not-allowed;
}
.k-button:disabled { pointer-events: auto; }

.k-button.is-loading { pointer-events: none; }

/* ---------- 尺寸档 ---------- */
.k-button--xs {
  --k-button-height: var(--k-control-height-xs);
  --k-button-font-size: var(--k-font-size-sm);
  --k-button-padding-x: var(--k-padding-sm);
}
.k-button--sm {
  --k-button-height: var(--k-control-height-sm);
  --k-button-font-size: var(--k-font-size-sm);
  --k-button-padding-x: var(--k-padding);
}
.k-button--lg {
  --k-button-height: var(--k-control-height-lg);
  --k-button-font-size: var(--k-font-size-lg);
  --k-button-padding-x: var(--k-padding-md);
}

/* ---------- 形态 ---------- */
.k-button--round { --k-button-radius: var(--k-border-radius-full); }
.k-button--circle {
  --k-button-radius: 50%;
  --k-button-padding-x: calc(var(--k-button-height) / 2.75);
}
.k-button--square {
  --k-button-padding-x: calc(var(--k-button-height) / 2.75);
}

.k-button--block {
  display: flex;
  width: 100%;
}

/* ---------- 部件 ---------- */
/* 图标位置：DOM 顺序不动，order 后移（antd/naive 同款逻辑命名，RTL 安全）；loading 占图标位 */
.k-button--icon-end :is(.k-button__icon, .k-button__spinner) { order: 1; }
.k-button--icon-top,
.k-button--icon-bottom {
  flex-direction: column;
  height: auto;
  min-height: var(--k-button-height);
  padding-block: calc(var(--k-size-xxs) + 2px);
  gap: var(--k-size-xxs);
}
.k-button--icon-bottom :is(.k-button__icon, .k-button__spinner) { order: 1; }

.k-button__icon svg {
  width: 1em;
  height: 1em;
  fill: currentcolor;
  display: block;
}
/* 描边图标（Tabler 等 fill="none"）保持空心，不被上面的 fill 覆盖 */
.k-button__icon svg[fill='none'] {
  fill: none;
}

.k-button__spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
}
.k-button__spinner::before {
  content: "";
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid currentcolor;
  border-top-color: transparent;
  animation: k-button-rotate var(--k-motion-duration-spin) linear infinite;
}

@keyframes k-button-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
