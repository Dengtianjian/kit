export type KColorFormat = 'hex' | 'rgb' | 'hsl';

export interface KColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface KHsvValue {
  h: number;
  s: number;
  v: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

export function hexToRgb(hex: string): KColorValue | null {
  const value = hex.trim().replace(/^#/, '');
  if (!/^[\da-f]{3,8}$/i.test(value)) return null;
  const expanded =
    value.length === 3 || value.length === 4
      ? value.split('').map((char) => `${char}${char}`).join('')
      : value;
  if (expanded.length !== 6 && expanded.length !== 8) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

export function rgbToHex(color: KColorValue, withAlpha = false): string {
  const r = round(clamp(color.r, 0, 255)).toString(16).padStart(2, '0');
  const g = round(clamp(color.g, 0, 255)).toString(16).padStart(2, '0');
  const b = round(clamp(color.b, 0, 255)).toString(16).padStart(2, '0');
  const a = round(clamp(color.a, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${withAlpha && color.a < 1 ? a : ''}`;
}

export function parseColor(input: string | null | undefined): KColorValue | null {
  if (!input) return null;
  const text = input.trim().toLowerCase();
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (text.startsWith('#')) return hexToRgb(text);
  const rgb = /^rgba?\(([^)]+)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => Number(part.trim()));
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return {
      r: clamp(parts[0], 0, 255),
      g: clamp(parts[1], 0, 255),
      b: clamp(parts[2], 0, 255),
      a: clamp(parts[3] ?? 1, 0, 1),
    };
  }
  const hsl = /^hsla?\(([^)]+)\)$/.exec(text);
  if (hsl) {
    const parts = hsl[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
    const { r, g, b } = hslToRgb(parts[0], parts[1] / 100, parts[2] / 100);
    return { r, g, b, a: clamp(parts[3] ?? 1, 0, 1) };
  }
  return null;
}

export function formatColor(color: KColorValue, format: KColorFormat = 'hex', alpha = false): string {
  const a = clamp(color.a, 0, 1);
  if (format === 'rgb') {
    const base = `${round(color.r)}, ${round(color.g)}, ${round(color.b)}`;
    return a < 1 || alpha ? `rgba(${base}, ${Number(a.toFixed(3))})` : `rgb(${base})`;
  }
  if (format === 'hsl') {
    const { h, s, l } = rgbToHsl(color.r, color.g, color.b);
    const base = `${round(h)}, ${round(s * 100)}%, ${round(l * 100)}%`;
    return a < 1 || alpha ? `hsla(${base}, ${Number(a.toFixed(3))})` : `hsl(${base})`;
  }
  return rgbToHex(color, alpha);
}

export function rgbToHsv(r: number, g: number, b: number): KHsvValue {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);
  const c = value * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: round((r + m) * 255), g: round((g + m) * 255), b: round((b + m) * 255) };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * clamp(s, 0, 1);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: round((r + m) * 255), g: round((g + m) * 255), b: round((b + m) * 255) };
}