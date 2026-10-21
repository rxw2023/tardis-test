// ============================================================
// contact-sheet.js — 接触表生成器
// 用法：node tools/contact-sheet.js frames/run
// 输出：frames/run/contact-sheet.html（8 列网格 + 时间标签，浏览器打开）
// ============================================================

import { readdir, writeFile } from 'node:fs/promises';
import { resolve, basename, relative } from 'node:path';

const dir = resolve(process.argv[2] || 'frames/run');
const fps = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--fps') || 30) || 30;

const files = (await readdir(dir))
  .filter((f) => /^frame_\d+\.png$/.test(f))
  .sort();

if (!files.length) {
  console.error(`no frame_*.png found in ${dir}`);
  process.exit(1);
}

const digits = files[0].match(/\d+/)[0].length;
const cells = files
  .map((f) => {
    const n = parseInt(f.match(/\d+/)[0], 10);
    const t = (n / fps).toFixed(2);
    return `<figure><img src="${f}" loading="lazy"><figcaption>#${String(n).padStart(digits, '0')} · t=${t}s</figcaption></figure>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>接触表 · ${basename(dir)}</title>
<style>
  body { background: #111; color: #ccc; font: 13px/1.4 "Segoe UI", "Microsoft YaHei", sans-serif; padding: 16px; }
  h1 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
  main { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; }
  figure { margin: 0; }
  img { width: 100%; display: block; border: 1px solid #333; }
  figcaption { font-size: 11px; color: #888; padding: 3px 2px; font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>接触表 · ${basename(dir)} · ${files.length} 帧 @ ${fps}fps</h1>
<main>${cells}</main>
</body></html>`;

const out = `${dir}/contact-sheet.html`;
await writeFile(out, html);
console.log(`contact sheet: ${out} (${files.length} frames)`);
