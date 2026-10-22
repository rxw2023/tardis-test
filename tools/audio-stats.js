// ============================================================
// audio-stats.js — 读 WAV，输出分段 RMS / 峰值 / 静音段，快速判断有没有声音
// 用法：node tools/audio-stats.js audio/film.wav [每段秒数]
// ============================================================

import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'audio/film.wav';
const seg = parseFloat(process.argv[3] || '2');

const buf = await readFile(file);
if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a RIFF file');
let p = 12, fmt = null, data = null;
while (p + 8 <= buf.length) {
  const id = buf.toString('ascii', p, p + 4);
  const size = buf.readUInt32LE(p + 4);
  if (id === 'fmt ') fmt = buf.subarray(p + 8, p + 8 + size);
  if (id === 'data') { data = buf.subarray(p + 8, p + 8 + size); break; }
  p += 8 + size + (size % 2);
}
const ch = fmt.readUInt16LE(2);
const sr = fmt.readUInt32LE(4);
const bits = fmt.readUInt16LE(14);
console.log(`${file}  ${ch}ch ${sr}Hz ${bits}bit  ${(data.length / (sr * ch * bits / 8)).toFixed(2)}s`);

const n = data.length / (bits / 8);
const frames = n / ch;
const segFrames = Math.floor(seg * sr);
let peakAll = 0, sumSq = 0, cnt = 0, silent = 0;
const rows = [];
for (let s = 0; s < frames; s += segFrames) {
  let sq = 0, pk = 0, c = 0;
  for (let i = s; i < Math.min(frames, s + segFrames); i++) {
    let v = data.readInt16LE(i * ch * 2);   // 取左声道即可（干声为单声道）
    const x = v / 32768;
    sq += x * x; pk = Math.max(pk, Math.abs(x)); c++;
  }
  const rms = Math.sqrt(sq / Math.max(1, c));
  sumSq += sq; cnt += c;
  peakAll = Math.max(peakAll, pk);
  if (pk < 0.002) silent++;
  const bar = '#'.repeat(Math.min(48, Math.round(rms * 160)));
  rows.push(`${(s / sr).toFixed(1).padStart(6)}s  rms ${rms.toFixed(4)}  pk ${pk.toFixed(3)}  ${bar}`);
}
console.log(rows.join('\n'));
console.log(`peak ${peakAll.toFixed(3)}  overall rms ${Math.sqrt(sumSq / Math.max(1, cnt)).toFixed(4)}  silent segs ${silent}`);
