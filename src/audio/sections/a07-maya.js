// ============================================================
// a07-maya.js — 第 7 格：玛雅抄本（约 1200）
// 音色：陶笛（lead）/ 低音陶鼓（bass）/ 排箫（chord）/ 树皮鼓 + 葫芦沙锤 + 木响（perc）
//       雨林虫鸣风声 + 雨棒 + 远处鸟鸣（flavor）
// 全部无金属：陶、木、葫芦、骨、气声。无采样、无 Math.random（走 S.prand）。
// ============================================================

import S, { prand } from '../synth.js';

// ---- 局部辅助：雨林底噪（长段带通噪声，缓慢扫频）----
// synth.js 的 S.noise 只能单向指数扫一次，这里要两端都可控的缓慢起伏，故自建。
function jungleBed(ctx, dest, t0, dur, seed) {
  const src = ctx.createBufferSource();
  src.buffer = S.noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.05;
  f.frequency.setValueAtTime(2500, t0);
  f.frequency.linearRampToValueAtTime(5000, t0 + dur * 0.55);
  f.frequency.linearRampToValueAtTime(3300, t0 + dur);
  const g = ctx.createGain();
  const PEAK = 0.045;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(PEAK, t0 + 1.3);
  g.gain.setValueAtTime(PEAK, t0 + dur - 1.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  // 极轻的呼吸起伏，像风穿过树冠
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.22;
  const lg = ctx.createGain();
  lg.gain.value = PEAK * 0.22;
  lfo.connect(lg).connect(g.gain);
  lfo.start(t0 + prand(seed) * 0.5);
  lfo.stop(t0 + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0, prand(seed * 1.7) * 1.2);
  src.stop(t0 + dur + 0.05);
}

// ---- 局部辅助：一次鸟鸣（短滑音 + 收尾的抖动）----
function birdCall(ctx, dest, t, f0, f1, gain) {
  const g = S.env(ctx, t, 0.18, { a: 0.012, d: 0.05, s: 0.35, r: 0.07, peak: gain });
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + 0.18);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.30);
}

export default {
  gain: 0.97,
  legato: 0.92,
  bassLen: 0.90,
  chordOct: -1,

  // 陶笛：三角波 + 重气声，音头偏慢；叠一层很弱的三次泛音做出陶土的空心感
  lead(ctx, io, t, freq, dur, vel, bar) {
    const a = Math.min(0.06, dur * 0.26);
    S.reed(ctx, io.out, t, {
      freq, dur, gain: 0.30 * vel, wave: 'triangle',
      breath: 0.42, bite: 1500,
      a, d: Math.min(0.09, dur * 0.3), s: 0.82, r: 0.16,
      vib: { rate: 4.9 + bar * 0.25, depth: 6 },
    });
    S.tone(ctx, io.out, t + 0.02, {
      freq: freq * 3, dur: Math.max(0.12, dur * 0.6), type: 'sine', gain: 0.045 * vel,
      a: Math.min(0.05, dur * 0.2), d: 0.10, s: 0.35, r: 0.13,
    });
  },

  // 低音陶鼓：锯齿低音管 + 一层正弦 sub（总增益压在 lead 的 60% 以内）
  bass(ctx, io, t, freq, dur, vel) {
    S.reed(ctx, io.out, t, {
      freq, dur: dur * 0.92, gain: 0.105 * vel, wave: 'sawtooth',
      breath: 0.30, bite: 350, a: 0.05, d: 0.10, s: 0.78, r: 0.18,
      vib: { rate: 3.0, depth: 3 },
    });
    S.sub(ctx, io.out, t, {
      freq, dur: dur * 0.86, gain: 0.045 * vel, wave: 'sine', bright: 300,
      a: 0.02, d: 0.10, s: 0.75, r: 0.14,
    });
  },

  // 排箫：三管弱起、彼此错开 0.04s，只取和弦里的 2~3 个音
  chord(ctx, io, t, freqs, dur, vel) {
    const pick = freqs.length >= 3 ? [freqs[0], freqs[1], freqs[2]] : freqs.slice(0, 2);
    for (let k = 0; k < pick.length; k++) {
      S.reed(ctx, io.out, t + k * 0.04, {
        freq: pick[k], dur: dur * 0.92, gain: 0.045 * vel, wave: 'sine',
        breath: 0.35, bite: 1400, a: 0.13, d: 0.12, s: 0.80, r: 0.24,
        vib: { rate: 4.6 + k * 0.4, depth: 5 },
      });
    }
  },

  // 打击：树皮鼓（tom）+ 葫芦沙锤（shaker）+ 木响（woodblock），八分网格
  // bar0 稀疏 → bar1 高光（沙锤满格 + 鼓点加密）→ bar2 渐收
  perc(ctx, io, t, bar, vel) {
    const E = 0.25;                       // 八分音符
    const DRUM = [
      [1, 0, 0, 3, 1, 0, 0, 0],          // 进：只在 1、3 拍落鼓
      [2, 0, 3, 1, 2, 0, 1, 3],          // 高光：加密 + 木响点缀
      [1, 0, 1, 0, 0, 3, 0, 0],          // 出：渐收
    ][bar] || [1, 0, 0, 0, 0, 0, 0, 0];
    const SHAKER = [
      [0, 0, 0.75, 0, 0, 0, 0.65, 0],
      [1, 0.55, 0.9, 0.5, 1, 0.55, 0.9, 0.6],
      [0.8, 0, 0.65, 0, 0.45, 0, 0, 0],
    ][bar] || [0, 0, 0, 0, 0, 0, 0, 0];

    for (let k = 0; k < 8; k++) {
      const tt = t + k * E + (prand(bar * 17.3 + k * 3.1) - 0.5) * 0.014;
      const d = DRUM[k];
      if (d === 1) {
        S.drum(ctx, io.out, tt, { kind: 'tom', gain: 0.20 * vel, dur: 0.34, from: 190, to: 88 });
      } else if (d === 2) {
        S.drum(ctx, io.out, tt, { kind: 'tom', gain: 0.25 * vel, dur: 0.34, from: 205, to: 92 });
      } else if (d === 3) {
        S.drum(ctx, io.out, tt, { kind: 'woodblock', gain: 0.10 * vel, freq: 850 });
      }
      const s = SHAKER[k];
      if (s) {
        S.drum(ctx, io.out, tt, { kind: 'shaker', gain: 0.055 * s * vel, freq: 4200 });
      }
    }
  },

  // 雨林：底噪虫鸣 + 三下雨棒 + 两声远处鸟鸣
  flavor(ctx, io, t0, index) {
    jungleBed(ctx, io.out, t0, 6.0, index * 3.3 + 1.1);

    for (let k = 0; k < 3; k++) {
      const tt = t0 + 0.85 + k * 1.65 + prand(k * 7.3 + 2.2) * 0.35;
      const gain = (0.042 + prand(k * 4.9) * 0.016) * (1 - k * 0.12);
      S.noise(ctx, io.out, tt, {
        dur: 0.48 + prand(k * 2.1) * 0.25, gain, a: 0.03, curve: 0.55,
        filter: { type: 'highpass', freq: 6000, q: 0.7 },
      });
    }

    birdCall(ctx, io.out, t0 + 1.55 + prand(11.1) * 0.2, 2350, 3300, 0.04);
    birdCall(ctx, io.out, t0 + 4.35 + prand(13.7) * 0.2, 3050, 2150, 0.036);
  },
};
