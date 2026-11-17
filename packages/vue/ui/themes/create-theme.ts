import type { ThemeConfig, ThemeResult, TokenValue } from './types';

/**
 * createTheme = 差量声明编译器（token 规格 §10.2 JS 通道）：
 * 输入 schema 任意子集，输出「覆盖用的变量声明」——表达式图本体在 css/theme.css，
 * 浏览器按级联在该作用域自动重算下游，因此这里从不展开派生链。
 */

const kebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** alias/components 数值是否免 px 后缀（seed 数值全部无单位，不走这里） */
const UNITLELESS = /^(lineHeight|neutralTint|zIndex|opacity|fontWeight|order|flex)/;

function serialize(key: string, value: TokenValue, unitless: boolean): string {
  if (typeof value === 'number' && !unitless && !UNITLELESS.test(key)) return `${value}px`;
  return String(value);
}

/** 键序稳定（SSR 直出比对），前缀如 `seed-` / `` / `button-` */
function declarations(vars: Record<string, TokenValue>, prefix: string, unitless: boolean): string[] {
  return Object.keys(vars)
    .sort()
    .map(key => `  --k-${prefix}${kebab(key)}: ${serialize(key, vars[key], unitless)};`);
}

function block(selector: string, lines: string[]): string {
  return `${selector} {\n${lines.join('\n')}\n}`;
}

const indent = (text: string) =>
  text
    .split('\n')
    .map(line => (line ? `  ${line}` : line))
    .join('\n');

/** KButton → button（类名 = k-button，变量前缀 = --k-button-） */
const componentBase = (name: string) => kebab(name.replace(/^K/, ''));

export function createTheme(config: ThemeConfig = {}): ThemeResult {
  const { seed, map, alias, dark, platform, components } = config;

  const baseLines: string[] = [];
  if (seed) baseLines.push(...declarations(seed as Record<string, TokenValue>, 'seed-', true));
  if (map) baseLines.push(...declarations(map, '', false));
  if (alias) baseLines.push(...declarations(alias, '', false));

  const darkLines: string[] = [];
  if (dark?.seed) darkLines.push(...declarations(dark.seed as Record<string, TokenValue>, 'seed-', true));
  if (dark?.alias) darkLines.push(...declarations(dark.alias, '', false));

  const mobileLines = platform?.mobile?.alias ? declarations(platform.mobile.alias, '', false) : [];

  const cssText = (scope = ':root') => {
    const parts: string[] = [];
    if (baseLines.length) parts.push(block(scope, baseLines));
    if (darkLines.length) parts.push(block(`${scope}[data-k-theme="dark"]`, darkLines));
    if (mobileLines.length)
      parts.push(`@media (max-width: 767px) {\n${indent(block(scope, mobileLines))}\n}`);
    for (const [comp, vars] of Object.entries(components ?? {})) {
      const lines = declarations(vars, `${componentBase(comp)}-`, false);
      if (lines.length) parts.push(block(`${scope} .k-${componentBase(comp)}`, lines));
    }
    return `${parts.join('\n\n')}\n`;
  };

  return { config, cssText, json: () => ({ ...config }) };
}
