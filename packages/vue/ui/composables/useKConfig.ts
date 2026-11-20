import { computed, inject, provide, unref } from 'vue';
import type { InjectionKey, MaybeRef, Ref } from 'vue';
import type { KBreakpoint } from './useBreakpoint';

export type KBreakpointOverrides = Partial<Record<KBreakpoint, number>>;

/**
 * KConfigProvider 的注入面（规格 docs site /vue/ui/components/config-provider.md）：
 * 嵌套 Provider = 浅合并级联（子覆盖父），消费端 useKConfig() 拿到当前作用域生效值。
 */

export interface KComponentDefaults {
  [prop: string]: unknown;
}

export interface KConfigInput {
  /** 主题注入的作用域 class（scoped=false 时为空 = 全局 :root 注入） */
  scopeClass?: MaybeRef<string | undefined>;
  scheme?: MaybeRef<'auto' | 'light' | 'dark'>;
  /** 弹层默认容器（职责④） */
  popupContainer?: MaybeRef<HTMLElement | (() => HTMLElement) | undefined>;
  /** 四轴等属性默认值：{ KButton: { size: 'sm' } }（合并链 prop > 这里 > token） */
  defaults?: MaybeRef<Record<string, KComponentDefaults> | undefined>;
  /** 点击波纹全局开关（antd ConfigProvider.wave 同款形态） */
  wave?: MaybeRef<{ disabled?: boolean } | undefined>;
  /** 自定义断点（theme.breakpoints）：JS 响应式 prop 与 platform.mobile 生成块共用 */
  breakpoints?: MaybeRef<KBreakpointOverrides | undefined>;
}

export interface KConfig extends KConfigInput {
  /** Teleport 协作契约：弹层组件必须把 scopeClass 与 scheme 带到出口节点 */
  scopeClass: Ref<string | undefined>;
  scheme: Ref<'auto' | 'light' | 'dark'>;
  popupContainer: Ref<HTMLElement | (() => HTMLElement) | undefined>;
  defaults: Ref<Record<string, KComponentDefaults> | undefined>;
  wave: Ref<{ disabled?: boolean } | undefined>;
  breakpoints: Ref<KBreakpointOverrides | undefined>;
}

const K_CONFIG_KEY: InjectionKey<KConfig> = Symbol('k-config');

export function provideKConfig(input: KConfigInput): KConfig {
  const parent = inject(K_CONFIG_KEY, undefined);

  const config: KConfig = {
    scopeClass: computed(() => unref(input.scopeClass) ?? parent?.scopeClass.value),
    scheme: computed(() => unref(input.scheme) ?? parent?.scheme.value ?? 'auto'),
    popupContainer: computed(() => unref(input.popupContainer) ?? parent?.popupContainer.value),
    wave: computed(() => unref(input.wave) ?? parent?.wave.value),
    breakpoints: computed(() => {
      const own = unref(input.breakpoints);
      const inherited = parent?.breakpoints.value;
      if (!own) return inherited;
      if (!inherited) return own;
      return { ...inherited, ...own };
    }),
    defaults: computed(() => {
      const own = unref(input.defaults);
      const inherited = parent?.defaults.value;
      if (!own) return inherited;
      if (!inherited) return own;
      const merged: Record<string, KComponentDefaults> = { ...inherited };
      for (const [name, props] of Object.entries(own)) {
        merged[name] = { ...merged[name], ...props };
      }
      return merged;
    }),
  };

  provide(K_CONFIG_KEY, config);
  return config;
}

export function useKConfig(): KConfig | undefined {
  return inject(K_CONFIG_KEY, undefined);
}

/**
 * 组件内属性缺省合并（合并链：prop > useKConfig().defaults[组件名] > undefined 留给 CSS token）。
 * 用法：`const size = useProps('KButton', 'size', () => props.size)`
 */
export function useProps(
  componentName: string,
  propName: string,
  pick: () => unknown
): Ref<unknown> {
  const config = useKConfig();
  return computed(() => pick() ?? config?.defaults.value?.[componentName]?.[propName]);
}
