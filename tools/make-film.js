// ============================================================
// make-film.js — 一键成片：音轨 → 帧序列 → MP4
//
//   node tools/make-film.js                        # 全流程 60fps
//   node tools/make-film.js --fps 30 --out out/x.mp4
//   node tools/make-film.js --skip-audio           # 复用已有 audio/film.wav
//   node tools/make-film.js --skip-frames          # 复用已有帧，只做合成
//   node tools/make-film.js --from 5 --to 17       # 只做一段
//
// 时间轴 / 版块划分全部来自 src/beat/beats.js，这里不重复定义。
// ============================================================

import { spawn } from 'node:child_process';
import { mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const has = (k) => a.includes('--' + k);

const fps = parseInt(get('fps', '60'), 10);
const sr = parseInt(get('sr', '48000'), 10);
const from = parseFloat(get('from', '0'));
const to = parseFloat(get('to', '137'));
const frameDir = get('frames', `frames/film${fps}`);
const audioFile = get('audio', 'audio/film.wav');
const out = resolve(get('out', `out/film-${fps}fps.mp4`));

function run(script, args) {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [resolve(HERE, script), ...args],
      { stdio: 'inherit', cwd: ROOT });
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${script} exit ${code}`))));
  });
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

console.log(`=== 成片：${from}s ~ ${to}s @ ${fps}fps ===\n`);

console.log('[1/3] 音轨');
if (has('--skip-audio')) {
  console.log(`  跳过，复用 ${audioFile}`);
} else {
  await run('render-audio.js', ['--out', audioFile, '--sr', String(sr)]);
}

console.log('\n[2/3] 帧序列');
if (has('--skip-frames')) {
  console.log(`  跳过，复用 ${frameDir}`);
} else {
  await run('render.js',
    ['--from', String(from), '--to', String(to), '--fps', String(fps), '--out', frameDir]);
}

console.log('\n[3/3] 合成');
await mkdir(dirname(out), { recursive: true });
const digits = String(Math.round(to * fps)).length;
const ff = [
  '-y', '-start_number', String(Math.round(from * fps)),
  '-framerate', String(fps), '-i', `${resolve(frameDir)}/frame_%0${digits}d.png`,
  '-i', resolve(audioFile),
  '-ss', String(from), '-t', String(to - from),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart',
  out,
];
console.log('  ffmpeg', ff.join(' '));
const code = await new Promise((r) => {
  const p = spawn('ffmpeg', ff, { stdio: ['ignore', 'pipe', 'pipe'] });
  let last = '';
  p.stderr.on('data', (d) => {
    const m = String(d).match(/time=(\d+:\d+:\d+\.\d+)/);
    if (m) { last = m[1]; process.stdout.write(`  ${last}\r`); }
  });
  p.on('close', r);
});
console.log(code === 0 ? `\n完成 -> ${out}` : `\nffmpeg 退出码 ${code}`);
