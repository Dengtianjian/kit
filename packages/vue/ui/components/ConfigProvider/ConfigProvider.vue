<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { createTheme } from '../../themes/create-theme';
import type { ThemeConfig, ThemeResult } from '../../themes/types';
import { provideKConfig } from '../../composables/useKConfig';

defineOptions({ name: 'KConfigProvider', inheritAttrs: false });

interface KConfigProviderProps {
  /** ThemeConfig = schema 输入（就地 createTheme）；ThemeResult = 复用已有实例 */
  theme?: ThemeConfig | ThemeResult;
  /** 与全局同一语义：auto 跟随系统/外层，light/dark 强制（子树独立，token 规格 §7） */
  scheme?: 'auto' | 'light' | 'dark';
  /** true = 注入作用域容器，主题与 scheme 限本子树；false = 全局（:root 注入 + html 属性） */
  scoped?: boolean;
  /** 弹层默认容器（职责④，Teleport 出口须带 scopeClass 的契约由弹层组件消费 config 实现） */
  popupContainer?: HTMLElement | (() => HTMLElement);
  /** 四轴等属性默认值：{ KButton: { size: 'sm' } } */
  defaults?: Record<string, Record<string, unknown>>;
  /** 点击波纹全局开关（antd ConfigProvider.wave 同款）：disabled=true 时所有波纹组件停发 */
  wave?: { disabled?: boolean };
}

const props = withDefaults(defineProps<KConfigProviderProps>(), {
  scheme: 'auto',
  scoped: false,
});

const themeResult = computed<ThemeResult | null>(() => {
  const theme = props.theme;
  if (!theme) return null;
  return typeof (theme as ThemeResult).cssText === 'function'
    ? (theme as ThemeResult)
    : createTheme(theme as ThemeConfig);
});

/** 稳定 hash：同输入必同 class，SSR/CSR 一致 */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const themeKey = computed(() => JSON.stringify(props.theme ?? {}));

const scopeClass = computed(() =>
  props.scoped && themeResult.value ? `k-scope-${fnv1a(themeKey.value)}` : undefined
);

const cssText = computed(() => {
  const result = themeResult.value;
  if (!result) return '';
  // scoped 注入选择器带 .k-config-provider 前缀：特异度压过 theme.css 图块里同名的 seed 缺省声明，
  // 不依赖 Teleport 样式与 theme.css 的先后顺序
  return result.cssText(scopeClass.value ? `.k-config-provider.${scopeClass.value}` : ':root');
});

const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined';

// 全局模式：scheme 落 html 属性；scoped 模式由容器自身的 data-k-theme 承担。
// auto = 不触碰属性（可能是宿主如站点开关在强制），只回收本 Provider 自己写上的那次
let ownSchemeAttr: string | null = null;
if (canUseDom) {
  watchEffect(() => {
    if (props.scoped) return;
    const el = document.documentElement;
    if (props.scheme === 'auto') {
      if (ownSchemeAttr && el.getAttribute('data-k-theme') === ownSchemeAttr) {
        el.removeAttribute('data-k-theme');
        ownSchemeAttr = null;
      }
      return;
    }
    el.setAttribute('data-k-theme', props.scheme);
    ownSchemeAttr = props.scheme;
  });
}

provideKConfig({
  scopeClass,
  scheme: computed(() => props.scheme),
  popupContainer: computed(() => props.popupContainer),
  defaults: computed(() => props.defaults),
  wave: computed(() => props.wave),
});
</script>

<template>
  <Teleport to="head" :disabled="!canUseDom">
    <component :is="'style'" v-if="cssText" v-html="cssText" />
  </Teleport>

  <div
    v-if="scoped"
    :class="['k-config-provider', scopeClass, ($attrs.class as string) ?? '']"
    :data-k-theme="scheme === 'auto' ? undefined : scheme"
  >
    <slot />
  </div>
  <slot v-else />
</template>
