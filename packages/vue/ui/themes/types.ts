import type { KSeedToken } from './seed';

export type TokenValue = string | number;

export interface ThemePlatformConfig {
  alias?: Record<string, TokenValue>;
}

/**
 * 主题配置 schema = token 规格 §10.1 JSON 的类型形态，任一层可省略。
 * 注意：这里只做「差量声明」，完整的表达式图在 css/theme.css，
 * createTheme 的产物仅是覆盖用的变量声明。
 */
export interface ThemeConfig {
  name?: string;
  /** 亮暗两态共用；dark 态用同名 + Dark 后缀键（colorTextBaseDark） */
  seed?: Partial<KSeedToken>;
  /** 钉住派生输入（一级派生层），键 = token 名，如 colorPrimary */
  map?: Record<string, TokenValue>;
  alias?: Record<string, TokenValue>;
  dark?: {
    seed?: Partial<KSeedToken>;
    alias?: Record<string, TokenValue>;
  };
  platform?: {
    mobile?: ThemePlatformConfig;
  };
  /** 组件层：键 = 组件名（KButton），内层键 = 部件变量名（无 --k-button- 前缀） */
  components?: Record<string, Record<string, TokenValue>>;
  /** P1.5：条件值无法用变量表达，需 Provider 生成 @media 块，cssText 暂不产出 */
  breakpoints?: Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', number>>;
}

export interface ThemeResult {
  config: ThemeConfig;
  /**
   * 生成作用域变量声明。scope = ':root'（全局）或 Provider 的哈希 scope class（'.k-scope-xxxx'）。
   * 键序稳定（同一 config 两次调用输出一致），供 SSR 直出比对。
   */
  cssText: (scope?: string) => string;
  json: () => ThemeConfig;
}
