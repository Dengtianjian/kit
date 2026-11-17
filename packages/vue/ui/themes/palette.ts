/**
 * oklab 混色与色阶导出（token 规格 §4.6 角色收窄后的 JS 侧）。
 * 运行时组件不消费这里的结果；供主题设计器导出、CLI `--static` 兜底、图表取色 API 使用。
 * 混色语义与 css/theme.css 的 `color-mix(in oklab, a t%, b)` 完全一致（同一求值模型）。
 */

type Rgb = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hexToRgb(hex: string): Rgb {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`[k-theme] 无法解析颜色：${hex}`);
  const n = parseInt(h, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (c: number) => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function rgbToOklab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514456434 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040753852 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToRgb([L, a, b]: Rgb): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2311053742 * s),
    linearToSrgb(-1.2684380046 * l + 2.6092820874 * m - 0.3413067580 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034114894 * m + 1.7076113548 * s),
  ];
}

/** 与 `color-mix(in oklab, colorA p%, colorB)` 等价的 JS 求值 */
export function mixOklab(colorA: string, colorB: string, ratioOfB: number): string {
  const labA = rgbToOklab(hexToRgb(colorA));
  const labB = rgbToOklab(hexToRgb(colorB));
  const t = clamp01(ratioOfB);
  const mixed: Rgb = [
    labA[0] + (labB[0] - labA[0]) * t,
    labA[1] + (labB[1] - labA[1]) * t,
    labA[2] + (labB[2] - labA[2]) * t,
  ];
  return rgbToHex(oklabToRgb(mixed));
}

/** 暗色态主色：向白提亮 8%（2026-11-17 R4 校准：15% 时 dark 实底链白字 hover/active 13 格红线，降到与 antd dark 同档），与 theme.css 的 light-dark 表达式终值一致 */
export const darkSeedVariant = (color: string) => mixOklab(color, '#ffffff', 0.08);

/**
 * 10 级色阶（设计器/静态导出用，非运行时消费）。
 * p1~p5 与 p7 的白/黑比例 = theme.css 主色状态系数同源（漂移检查见同目录 drift-check.mjs）：
 * p1=bg(白90) p2=bg-hover(白84) p3=border(白70) p4=border-hover(白55) p5=hover(白10)
 * p6=主色本体 p7=active(黑25)。p8~p10 为色阶深端延伸（黑30/45/65），CSS 侧无对应档。
 * 精确 antd 色板算法兼容留待引入 @ant-design/colors（§4.6）。
 */
const LIGHT_WHITE_RATIO = [0.9, 0.84, 0.7, 0.55, 0.1, 0];
const DARK_BLACK_RATIO = [0.25, 0.3, 0.45, 0.65];

export function generateRamp(color: string): string[] {
  const light = LIGHT_WHITE_RATIO.map(t => mixOklab(color, '#ffffff', t));
  const dark = DARK_BLACK_RATIO.map(t => mixOklab(color, '#000000', t));
  return [...light, ...dark];
}

/** 图表/第三方取色 API（§3 例外③） */
export const getColorPalette = generateRamp;
