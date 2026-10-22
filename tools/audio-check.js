// ============================================================
// audio-check.js — 整片音频验收：逐格检查能量 / 静音 / 过框冲击 / 主题首音
// 用法：node tools/audio-check.js audio/film.wav
// ============================================================

import { readFile } from 'node:fs/promises';
import { SCENES_START, SCENE_LEN, N_SCENES, OUTRO_START, BAR, BEAT } from '../src/beat/beats.js';
import { audioModuleFor, PRESET } from '../src/audio/sections/index.js';
import { SCENES } from '../src/scenes/meta.js';
import { sceneThemeNotes, themeBarsForScene } from '../src/audio/melody.js';
import { themeFreq, snapToScale, stof } from '../src/audio/theory.js';

const file = process.argv[2] || 'audio/film.wav';
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
const frames = data.length / 2 / ch;
const at = (i) => data.readInt16LE(i * ch * 2) / 32768;

function seg(t0, t1) {
  const a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(frames, Math.floor(t1 * sr));
  let pk = 0, sq = 0, n = 0;
  for (let i = a; i < b; i++) { const v = at(i); pk = Math.max(pk, Math.abs(v)); sq += v * v; n++; }
  return { rms: Math.sqrt(sq / Math.max(1, n)), peak: pk };
}

// --- FFT（与 audio-spec 同实现）---
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
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
const N = 8192;
function peaksAt(t, k = 8) {
  const start = Math.max(0, Math.min(frames - N, Math.round(t * sr - N / 2)));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    re[i] = at(start + i) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  }
  fft(re, im);
  const mag = new Float64Array(N / 2);
  let mx = 0;
  for (let i = 1; i < N / 2; i++) { mag[i] = Math.hypot(re[i], im[i]); mx = Math.max(mx, mag[i]); }
  const out = [];
  for (let i = 3; i < N / 2 - 1; i++) {
    if (mag[i] > mag[i - 1] && mag[i] >= mag[i + 1] && mag[i] > mx * 0.02) {
      out.push({ f: i * sr / N, a: mag[i] / mx });
    }
  }
  out.sort((x, y) => y.a - x.a);
  return out.slice(0, k);
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (f) => {
  const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m);
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
};

console.log(`${file}  ${(frames / sr).toFixed(2)}s  ${ch}ch ${sr}Hz\n`);
console.log('格  版块            中段rms  峰值   过框冲击  静音   主题首音（期望 / 实测前3峰）');
console.log('─'.repeat(96));

let bad = 0;
for (let i = 0; i < N_SCENES; i++) {
  const t0 = SCENES_START + i * SCENE_LEN;
  const mid = seg(t0 + 0.6, t0 + 5.6);
  const cross = seg(t0 - 0.12, t0 + 0.10);
  // 版块内是否有 0.25s 全静音
  let silent = 0;
  for (let s = t0 + 0.1; s < t0 + 5.8; s += 0.25) {
    const q = seg(s, s + 0.25);
    if (q.peak < 0.004) silent++;
  }
  // 主题首音
  const mod = audioModuleFor(i) || {};
  const preset = PRESET[i] || {};
  const scale = mod.scale || preset.scale || 'minor';
  const oct = mod.octave ?? preset.octave ?? 0;
  const notes = sceneThemeNotes(i);
  const first = notes[0];
  const expect = themeFreq(first.semis, scale, oct);
  // 第一个音符只有 0.5 拍 = 0.25s，采样点必须落在它的持续期内（版块内 0.15s）
  // tape 型版块有磁带减速，主时间轴上的音高是滑动的，不做音高判定
  const pk = peaksAt(t0 + 0.15, 20);
  const hit = mod.tape ? true : pk.find((q) => Math.abs(q.f - expect) / expect < 0.04);
  const top3 = pk.slice(0, 3).map((q) => `${q.f.toFixed(0)}(${noteName(q.f)})`).join(' ');

  const okSound = mid.rms > 0.03;
  const okCross = cross.peak > 0.25;
  const okSilent = silent === 0;
  const okPitch = !!hit;
  if (!(okSound && okCross && okSilent && okPitch)) bad++;

  console.log(
    `${String(i + 1).padStart(2, '0')}  ${SCENES[i].zh.padEnd(12, '　')}  ` +
    `${mid.rms.toFixed(3)}${okSound ? ' ' : '!'}  ${mid.peak.toFixed(2)}  ` +
    `${cross.peak.toFixed(2)}${okCross ? ' ' : '!'}   ${silent}${okSilent ? ' ' : '!'}     ` +
    `${expect.toFixed(0)}(${noteName(expect)}) ${okPitch ? '✓' : '✗'}  ${top3}`,
  );
}

// 片头 / 片尾
const intro = seg(0.2, SCENES_START - 0.2);
const outro = seg(OUTRO_START + 0.2, OUTRO_START + 11.5);
const tail = seg(OUTRO_START + 11.6, OUTRO_START + 12.0);
console.log('─'.repeat(96));
console.log(`片头 rms ${intro.rms.toFixed(3)} peak ${intro.peak.toFixed(2)}   ` +
  `片尾 rms ${outro.rms.toFixed(3)} peak ${outro.peak.toFixed(2)}   ` +
  `尾音末段 rms ${tail.rms.toFixed(3)}（应接近 0，做淡出）`);
const all = seg(0, frames / sr);
console.log(`全片 peak ${all.peak.toFixed(3)}  rms ${all.rms.toFixed(3)}   不合格格数 ${bad}/${N_SCENES}`);
