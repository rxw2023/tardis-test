// ============================================================
// mux.js — 帧序列 + WAV → MP4（H.264 + AAC）
// 用法：node tools/mux.js --frames frames/run --fps 60 --audio audio/film.wav --out out/film.mp4
//      [--from 5 --to 20] 只合成一段（按秒，音频同步裁切）
//      [--crf 18] [--preset medium]
// ============================================================

import { spawn } from 'node:child_process';
import { readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const frames = get('frames', 'frames/run');
const fps = get('fps', '60');
const audio = get('audio', 'audio/film.wav');
const out = resolve(get('out', 'out/film.mp4'));
const from = get('from', '');
const to = get('to', '');
const crf = get('crf', '18');
const preset = get('preset', 'medium');

const dir = resolve(frames);
const files = (await readdir(dir)).filter((f) => f.endsWith('.png') && f.startsWith('frame_')).sort();
if (!files.length) throw new Error(`no frame_*.png in ${dir}`);
const first = files[0].match(/frame_(\d+)\.png/);
const digits = first[1].length;
console.log(`frames: ${files.length}  pattern frame_%0${digits}d.png  @${fps}fps`);

await mkdir(dirname(out), { recursive: true });

const args = ['-y'];
if (from !== '') args.push('-start_number', String(Math.round(parseFloat(from) * fps)));
args.push('-framerate', fps, '-i', `${dir}/frame_%0${digits}d.png`);
if (from !== '' || to !== '') args.push('-ss', from === '' ? '0' : from);
args.push('-i', audio);
if (to !== '' && from !== '') args.push('-t', String(parseFloat(to) - parseFloat(from)));
args.push(
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-preset', preset,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart',
  out,
);

console.log('ffmpeg', args.join(' '));
const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
let last = '';
p.stderr.on('data', (d) => {
  const s = d.toString();
  const m = s.match(/time=(\d+:\d+:\d+\.\d+)/);
  if (m) { last = m[1]; process.stdout.write(`  ${last}\r`); }
});
const code = await new Promise((r) => p.on('close', r));
console.log(code === 0 ? `\ndone -> ${out}` : `\nffmpeg exit ${code}`);
