// 一次性生成 grid.css（列宽 class 矩阵）。运行：node packages/vue/ui/css/gen-grid.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pct = n => `${(n / 24 * 100).toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}%`;
const bps = [['sm', 576], ['md', 768], ['lg', 992], ['xl', 1200], ['xxl', 1600]];

const spanRules = s => {
  const out = [`.k-col-${s}0{display:none}`];
  for (let n = 1; n <= 24; n++) out.push(`.k-col-${s}${n}{flex:0 0 ${pct(n)};max-width:${pct(n)}}`);
  for (let n = 1; n <= 23; n++) out.push(`.k-col-${s}offset-${n}{margin-left:${pct(n)}}`);
  return out;
};

const lines = [
  '/**',
  ' * 24 栅格列宽 class 矩阵（CSS-first：默认断点全部预编译进 CSS，运行时 JS 只解析 gutter）。',
  ' * 规格 = docs site /vue/ui/components/grid.md；产物由同目录 gen-grid.mjs 生成，改阶梯请改脚本后重跑。',
  ' */',
  ...spanRules(''),
  ...spanRules('xs-'),
];

for (const [name, w] of bps) {
  lines.push(`@media (min-width: ${w}px) {`);
  for (const r of spanRules(`${name}-`)) lines.push(`  ${r}`);
  lines.push('}');
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'grid.css');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`grid.css written: ${lines.length} lines`);
