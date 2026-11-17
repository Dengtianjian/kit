/**
 * theme.css ↔ palette.ts 双源防漂移检查（零依赖，node packages/vue/ui/themes/drift-check.mjs）
 *
 * 真相源 = theme.css 的主色状态系数表达式；逐档从 CSS 解析白/黑比例，
 * 用 palette 的 mixOklab 重建期望色，与 generateRamp 产出的色板逐项比对。
 * 任何一边改了系数没同步另一边，本脚本即红（2026-11-17 首例漂移：p1~p3 与 bg/bg-hover/border 差 Δ2~4）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mixOklab, generateRamp, darkSeedVariant } from './palette.ts';

const SEED = '#1677ff';
const themeCss = readFileSync(
  fileURLToPath(new URL('../css/theme.css', import.meta.url)),
  'utf8',
);

/** 提取 `--k-color-primary-<token>: color-mix(in oklab, var(--k-color-primary) N%, var(--k-mix-*));` 的 N% */
function cssMixPct(token, channel) {
  const re = new RegExp(
    `--k-color-primary-${token}:\\s*color-mix\\(in oklab,\\s*var\\(--k-color-primary\\)\\s+(\\d+(?:\\.\\d+)?)%,\\s*var\\(--k-mix-${channel}\\)`,
  );
  const m = themeCss.match(re);
  if (!m) throw new Error(`theme.css 未找到表达式：--k-color-primary-${token} (mix-${channel})`);
  return Number(m[1]);
}

const ramp = generateRamp(SEED);
const checks = [
  ['p1 bg', cssMixPct('bg', 'onto'), '#ffffff', ramp[0]],
  ['p2 bg-hover', cssMixPct('bg-hover', 'onto'), '#ffffff', ramp[1]],
  ['p3 border', cssMixPct('border', 'onto'), '#ffffff', ramp[2]],
  ['p4 border-hover', cssMixPct('border-hover', 'onto'), '#ffffff', ramp[3]],
  ['p5 hover', cssMixPct('hover', 'up'), '#ffffff', ramp[4]],
  ['p7 active', cssMixPct('active', 'down'), '#000000', ramp[6]],
];

let failed = 0;
for (const [name, pct, toward, actual] of checks) {
  const expected = mixOklab(SEED, toward, (100 - pct) / 100);
  const ok = expected.toLowerCase() === actual.toLowerCase();
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}: css ${pct}% → ${expected} | ramp ${actual}`);
}

/** 暗色 seed：CSS light-dark 兜底表达式里的 c92% 白 ↔ darkSeedVariant 的 0.08（R4 校准 15%→8%） */
const darkSeed = themeCss.match(/color-mix\(in oklab,\s*var\(--k-seed-color-primary\)\s+(\d+(?:\.\d+)?)%,\s*#ffffff\)/);
if (darkSeed) {
  const expected = mixOklab(SEED, '#ffffff', (100 - Number(darkSeed[1])) / 100);
  const actual = darkSeedVariant(SEED);
  const ok = expected.toLowerCase() === actual.toLowerCase();
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} dark seed: css ${darkSeed[1]}% → ${expected} | js ${actual}`);
} else {
  console.log('（跳过 dark seed：theme.css 表达式形态变更，请同步本脚本正则）');
}

process.exit(failed ? 1 : 0);
