// ============================================================
// render-parallel.js — 把整片切成 N 段，并行起 N 个 Chrome 渲染
//
// 用法：node tools/render-parallel.js [--fps 60] [--from 0] [--to 137]
//                                     [--out frames/film60] [--parts 12]
//
// 各段帧文件名用的是全局帧号，互不重叠，所以可以直接输出到同一个目录，
// 最后用一条 image2 输入（-start_number）一次性合成。
// ============================================================

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const a = process.argv.slice(2);
const get = (k, d) => {
  const i = a.indexOf('--' + k);
  return i >= 0 ? a[i + 1] : d;
};

const from = parseFloat(get('from', '0'));
const to = parseFloat(get('to', '137'));
const fps = parseInt(get('fps', '60'), 10);
const outDir = get('out', `frames/film${fps}`);
const parts = parseInt(get('parts', '12'));

await mkdir(resolve(outDir), { recursive: true });

// 全局帧号位数：由整片终点决定，所有段共用，保证 frame_0001.png 这种定长命名
const DIGITS = String(Math.round(to * fps)).length;

function run(k, f0, f1) {
  const args = [
    resolve(HERE, 'render.js'),
    '--from', String(f0),
    '--to', String(f1),
    '--fps', String(fps),
    '--out', outDir,
    '--digits', String(DIGITS),
  ];
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
  });
    let err = '';
    let line = 0;
    p.stdout.on('data', (d) => {
      // 子进程的进度每 30 帧一行；这里每 5 行转发一次，避免刷屏
      for (const l of d.toString().split('\n')) {
        if (!l.trim()) continue;
        if (++line % 5 === 0) console.log(`  [p${String(k).padStart(2, '0')}] ${l.trim()}`);
      }
    });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => {
      if (code === 0) {
        console.log(`  part${String(k).padStart(2, '0')} done (${f0.toFixed(2)}~${f1.toFixed(2)}s)`);
        res();
      } else {
        rej(new Error(`part${k} exit ${code}: ${err.slice(-600)}`));
      }
    });
  });
}

const seg = (to - from) / parts;
const t0 = Date.now();
console.log(`${parts} 段并行：${from}s ~ ${to}s @ ${fps}fps`);

// 错峰启动：让 N 个 Chrome 依次开机而不是同一秒一起抢 CPU，
// 否则并发启动会把导航时间拖过超时阈值。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jobs = [];
for (let k = 0; k < parts; k++) {
  jobs.push(run(k, from + k * seg, Math.min(to, from + (k + 1) * seg)));
  await sleep(2500);
}
await Promise.all(jobs);
console.log(`帧序列完成，耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟 -> ${outDir}`);
