// ============================================================
// audio-spec.js — 短时频谱探针（听不见声音时的“耳朵”）
// 用法：node tools/audio-spec.js audio/scene01.wav --at 1.0,1.5,2.25 [--n 8192] [--k 6]
// 输出每个时刻最强的若干谱峰：频率 / 音名 / 相对强度
// ============================================================

import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/audio-spec.js <wav> --at 1.0,1.5 [--n 8192] [--k 6]'); process.exit(1); }
const a = process.argv.slice(3);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const at = (get('at', '1.0')).split(',').map(Number).filter((n) => !isNaN(n));
const N = parseInt(get('n', '8192'), 10);
const K = parseInt(get('k', '6'), 10);

const buf = await readFile(file);
let p = 12, fmt = null, data = null;
while (p + 8 <= buf.length) {
  const id = buf.toString('ascii', p, p + 4);
  const size = buf.readUInt32LE(p + 4);
  if (id === 'fmt ') fmt = buf.subarray(p + 8, p + 8 + size);
  if (id === 'data') { data = buf.subarray(p + 8, p + 8 + size); break; }
  p += 8 + size + (size % 2);
}
const ch = fmt.readUInt16LE(2), sr = fmt.readUInt32LE(4);

// ---- FFT (radix-2, in-place) ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function note(f) {
  if (f <= 0) return '—';
  const m = 69 + 12 * Math.log2(f / 440);
  const r = Math.round(m);
  const cents = Math.round((m - r) * 100);
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}${cents >= 0 ? '+' : ''}${cents}c`;
}

const frames = data.length / 2 / ch;
for (const t of at) {
  const start = Math.max(0, Math.min(frames - N, Math.round(t * sr - N / 2)));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const idx = start + i;
    const v = data.readInt16LE(idx * ch * 2) / 32768;
    re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  }
  fft(re, im);
  const mag = new Float64Array(N / 2);
  let mx = 0;
  for (let i = 1; i < N / 2; i++) { mag[i] = Math.hypot(re[i], im[i]); mx = Math.max(mx, mag[i]); }
  const peaks = [];
  for (let i = 2; i < N / 2 - 1; i++) {
    if (mag[i] > mag[i - 1] && mag[i] >= mag[i + 1] && mag[i] > mx * 0.045) {
      // 抛物线插值，提高频率精度
      const d = 0.5 * (mag[i - 1] - mag[i + 1]) / (mag[i - 1] - 2 * mag[i] + mag[i + 1] || 1);
      const f = (i + (isFinite(d) ? d : 0)) * sr / N;
      if (f > 40 && f < 8000) peaks.push({ f, a: mag[i] / mx });
    }
  }
  peaks.sort((x, y) => y.a - x.a);
  const top = peaks.slice(0, K).map((q) => `${q.f.toFixed(1)}Hz ${note(q.f)} (${(q.a * 100).toFixed(0)})`);
  console.log(`t=${t.toFixed(3)}s  ${top.join('  |  ')}`);
}
