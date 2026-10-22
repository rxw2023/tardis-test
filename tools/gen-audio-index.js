// ============================================================
// gen-audio-index.js — 扫描 src/audio/sections/aNN-*.js，重写 index.js 的注册段
// （多个子代理并行开发时，避免大家抢着改同一个 index.js 造成互相覆盖）
// 用法：node tools/gen-audio-index.js
// ============================================================

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DIR = resolve('src/audio/sections');
const IDX = resolve('src/audio/sections/index.js');

const files = (await readdir(DIR))
  .filter((f) => /^a(\d{2})-.*\.js$/.test(f))
  .sort();

const mods = files.map((f) => {
  const n = parseInt(f.match(/^a(\d{2})/)[1], 10);
  return { file: f, slot: n - 1, name: 'm' + f.slice(1, 3) };
});

const importBlock = [
  '// ---AUTO-IMPORTS-START--- 由 tools/gen-audio-index.js 生成，勿手改',
  ...mods.map((m) => `import ${m.name} from './${m.file}';`),
  '// ---AUTO-IMPORTS-END---',
].join('\n');

const slotBlock = [
  '// ---AUTO-SLOTS-START---',
  'const SLOTS = [];',
  ...mods.map((m) => `SLOTS[${m.slot}] = ${m.name};`),
  '// ---AUTO-SLOTS-END---',
].join('\n');

let src = await readFile(IDX, 'utf8');

if (src.includes('---AUTO-IMPORTS-START---')) {
  src = src.replace(/\/\/ ---AUTO-IMPORTS-START---[\s\S]*?\/\/ ---AUTO-IMPORTS-END---/, importBlock);
} else {
  // 首次：把散落的 import 行替换掉
  src = src.replace(/^import .* from '\.\/a\d\d-.*\.js';\n/gm, '');
  src = src.replace(/^import neutral from '\.\/neutral\.js';\n/m, `import neutral from './neutral.js';\n\n${importBlock}\n`);
}

if (src.includes('---AUTO-SLOTS-START---')) {
  src = src.replace(/\/\/ ---AUTO-SLOTS-START---[\s\S]*?\/\/ ---AUTO-SLOTS-END---/, slotBlock);
} else {
  src = src.replace(/^const SLOTS = \[\];\n(?:SLOTS\[\d+\] = [^\n]*\n)*/m, slotBlock + '\n');
}

await writeFile(IDX, src, 'utf8');
console.log(`registered ${mods.length} sections:`);
for (const m of mods) console.log(`  [${String(m.slot).padStart(2, '0')}] ${m.file}`);
