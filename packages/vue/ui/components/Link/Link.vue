<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <component
    :is="tag"
    v-else
    :class="[
      'k-link',
      `k-link--${type}`,
      `k-link--underline-${underline}`,
      { 'is-disabled': disabled },
      classNames?.root,
    ]"
    :style="rootStyle"
    :to="to"
    v-bind="rootAttrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { RouterLink } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KLink' });

type LinkType = 'link' | 'primary' | 'subtle' | 'subtle-primary' | 'default' | 'secondary';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KLinkRenderScope {
  type: LinkType;
  color: string | undefined;
  underline: 'always' | 'hover' | 'never';
  external: boolean;
  disabled: boolean;
  to: RouteLocationRaw | string | undefined;
  href: string | undefined;
  /** 派生标签：disabled=span，to=RouterLink，否则 a（自绘可 :is 直接消费；RouterLink 场景 :to 自绑） */
  tag: typeof tag.value;
  /** 自定义色三态变量（color-mix 派生逻辑）；视觉自绘消费 */
  colorVars: CSSProperties;
  /** data-part + href/target/rel/aria-disabled 语义包（external 自动 noopener） */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KLinkProps {
  /** 导航到路由；与 Button(type=link) 的边界：导航用 KLink，触发动作用 KButton */
  to?: RouteLocationRaw | string;
  href?: string;
  /**
   * 取色链：link = 链接色链（缺省）；primary = 主色链；
   * subtle / subtle-primary = 常态正文字色，hover 分别进链接/主色链；
   * default / secondary = 文本层级色（default 的 hover 为主色浅档，比 subtle-primary 更弱）
   */
  type?: LinkType;
  /** 自定义链接色：常态用该色，hover/active 按全库惯例 color-mix 派生（90% 提亮 / 75% 压暗） */
  color?: string;
  underline?: 'always' | 'hover' | 'never';
  external?: boolean;
  disabled?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KLinkRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KLinkProps>(), {
  type: 'link',
  underline: 'hover',
  external: false,
  disabled: false,
});

const tag = computed(() => {
  if (props.disabled) return 'span' as const;
  return props.to ? RouterLink : ('a' as const);
});

const rootAttrs = computed(() => {
  const base = { 'data-part': 'root' };
  if (props.to && !props.disabled) return base;
  if (props.disabled) return { ...base, 'aria-disabled': true };
  if (props.external) return { ...base, href: props.href, target: '_blank', rel: 'noopener noreferrer' };
  return { ...base, href: props.href };
});

/** 自定义色只落变量不落 color 本身：color 内联会压死 hover/active 类规则，变量则三态照常走链 */
const colorVars = computed<CSSProperties>(() => {
  const c = props.color;
  return (c
    ? {
        '--k-link-color': c,
        '--k-link-color-hover': `color-mix(in oklab, ${c} 90%, var(--k-mix-up))`,
        '--k-link-color-active': `color-mix(in oklab, ${c} 75%, var(--k-mix-down))`,
      }
    : {}) as CSSProperties;
});

const rootStyle = computed<CSSProperties>(() => ({ ...colorVars.value, ...props.styles?.root }));

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KLinkRenderScope>(
  () => props.render,
  () => ({
    type: props.type,
    color: props.color,
    underline: props.underline,
    external: props.external,
    disabled: props.disabled,
    to: props.to,
    href: props.href,
    tag: tag.value,
    colorVars: colorVars.value,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KLinkRenderScope): VNodeChild;
}>();
</script>

<style>

/* :is(a) 只继承参数特异度（a=0,0,1）：并列后与宿主 .vp-doc a 打平靠顺序赢；
   hover/active 规则因直接声明 color（0,2,1）压过 .vp-doc a:hover（0,1,2） */
.k-link,
.k-link:is(a) {
  --k-link-color: var(--k-color-link);
  --k-link-color-hover: var(--k-color-link-hover);
  --k-link-color-active: var(--k-color-link-active);

  color: var(--k-link-color);
  text-decoration: none;
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}

/* 类型链覆盖必须双类名 (0,2,0)：基线 .k-link:is(a) = (0,1,1) 会压过单类名 (0,1,0)，
   否则 <a> 上 --k-link-color* 三变量永远停在链接链缺省（旧 default/secondary 同病，一并修复） */
.k-link.k-link--primary {
  --k-link-color: var(--k-color-primary);
  --k-link-color-hover: var(--k-color-primary-hover);
  --k-link-color-active: var(--k-color-primary-active);
}
.k-link.k-link--default { --k-link-color: var(--k-color-text); --k-link-color-hover: var(--k-color-primary-hover); }
.k-link.k-link--secondary { --k-link-color: var(--k-color-text-secondary); }

/* subtle 两档（2026-11-17 用户改判：静置不用浏览器 UA 色，改正文字色起步，hover 才进链）：
   纯变量实现，无 revert/直声明特例；color prop 的 inline 变量天然覆盖静置档 */
.k-link.k-link--subtle {
  --k-link-color: var(--k-color-text);
  --k-link-color-hover: var(--k-color-link);
  --k-link-color-active: var(--k-color-link-active);
}
.k-link.k-link--subtle-primary {
  --k-link-color: var(--k-color-text);
  --k-link-color-hover: var(--k-color-primary);
  --k-link-color-active: var(--k-color-primary-active);
}

.k-link:hover,
.k-link:is(a):hover { color: var(--k-link-color-hover); }
.k-link:active,
.k-link:is(a):active { color: var(--k-link-color-active); }

.k-link--underline-always,
.k-link--underline-always:is(a) { text-decoration: underline; }
.k-link--underline-hover:hover,
.k-link--underline-hover:is(a):hover { text-decoration: underline; }

.k-link.is-disabled,
.k-link.is-disabled:is(a) {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
  text-decoration: none;
}
</style>
