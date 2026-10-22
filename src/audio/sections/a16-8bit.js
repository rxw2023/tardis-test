// ============================================================
// a16-8bit.js — 第 16 格：8-bit 像素游戏（1980s）
// 音色：NES/FC 三声道思维 —— 2 个方波（主旋律 + 和声）+ 1 个三角波贝斯
//       + 1 个噪声通道（hi-hat / 爆炸音），再加金币与 1UP 音效。
// 全部「硬」音色：无滤波扫弦、无长混响（主机只有 8-bit DAC）。
// ============================================================

import S, { prand } from '../synth.js';

const BEAT = 0.5;          // 120BPM：一拍 0.5s
const E = BEAT / 2;        // 八分 0.25
const S16 = BEAT / 4;      // 十六分 0.125

// ---- 局部辅助（不改动 synth.js）----

// 方波 chip 音：NES 2A03 的脉冲通道，attack 极短、sustain 高（方波没有自然衰减）
function chip(ctx, dest, t, freq, dur, gain, duty) {
  return S.blip(ctx, dest, t, {
    freq, dur, gain, wave: 'square', duty: duty ?? 0.5,
    a: 0.004, d: 0.03, s: 0.9, r: 0.05,
  });
}

// 长音的「同音重复」装饰：chiptune 里代替持续音的写法（DAC 只有一个音量级持续，
// 靠十六分重触发做出颗粒感），gain 逐次递减。
function chipTail(ctx, dest, t, freq, gain, n) {
  for (let k = 0; k < n; k++) {
    S.blip(ctx, dest, t + k * S16, {
      freq, dur: S16 * 0.72, gain: gain * (1 - k * 0.22),
      wave: 'square', duty: 0.5,
      a: 0.003, d: 0.02, s: 0.75, r: 0.035,
    });
  }
}

// 每个 OfflineAudioContext（= 每次渲染）独立的「小节序号」计数：
// chord 回调不传 bar，用它推出当前是版块内第几小节（0/1/2）
const _barOfCtx = new WeakMap();
function nextBar(ctx) {
  const k = _barOfCtx.get(ctx) || 0;
  _barOfCtx.set(ctx, k + 1);
  return k;
}

// 上行方波琶音（金币 / 跳跃 / 1UP 音效）
function chipRun(ctx, dest, t, f0, n, step, dt, gain) {
  for (let k = 0; k < n; k++) {
    S.blip(ctx, dest, t + k * dt, {
      freq: f0 * Math.pow(2, (k * step) / 12),
      dur: dt * 0.9, gain: gain * (1 - k * 0.07),
      wave: 'square', duty: 0.5,
      a: 0.003, d: 0.02, s: 0.8, r: 0.04,
    });
  }
}

export default {
  gain: 0.98,
  legato: 0.92,
  chordOct: -1,

  // ---- 主旋律：方波主声道 ----
  lead(ctx, io, t, freq, dur, vel, bar) {
    const g = 0.24 * vel;
    // 长音（>= 0.6s）：本体只奏前半，后半交给十六分同音重复
    if (dur >= 0.6) {
      chip(ctx, io.out, t, freq, dur * 0.52, g);
      const n = dur >= 1.2 ? 4 : 3;
      chipTail(ctx, io.out, t + dur * 0.55, freq, g * 0.5, n);
    } else {
      chip(ctx, io.out, t, freq, dur, g);
    }
    // 轻微的低八度衬底，让方波不至于太单薄（NES 常见的双通道叠音）
    if (bar === 1) {
      S.blip(ctx, io.out, t, {
        freq: freq / 2, dur: Math.min(dur, 0.3), gain: 0.045 * vel,
        wave: 'square', duty: 0.25, a: 0.004, d: 0.03, s: 0.85, r: 0.05,
      });
    }
  },

  // ---- 贝斯：三角波低音声道，传统 NES 的八分走动 ----
  bass(ctx, io, t, freq, dur, vel) {
    // 红线段：bass 音量不超过 lead 的 60%（lead 0.24 → bass 上限 0.144）
    const g = 0.14 * vel;
    const seed = t * 7.31;
    // 第一步用传进来的根音，其后在 根音 / 五度 / 八度 之间跳
    const steps = [0];
    for (let k = 1; k < 4; k++) {
      const r = prand(seed + k * 3.7);
      steps.push(r < 0.4 ? 0 : r < 0.75 ? 7 : 12);
    }
    for (let k = 0; k < 4; k++) {
      S.blip(ctx, io.out, t + k * E, {
        freq: freq * Math.pow(2, steps[k] / 12),
        dur: E * 0.88, gain: g * (k === 0 ? 1 : 0.82),
        wave: 'triangle',
        a: 0.006, d: 0.05, s: 0.9, r: 0.06,
      });
    }
  },

  // ---- 和声：第二个方波声道（窄脉冲 25%），只在高光小节给 ----
  chord(ctx, io, t, freqs, dur, vel) {
    if (nextBar(ctx) !== 1) return;   // 只在高光小节给第二个方波声部
    for (let i = 0; i < freqs.length; i++) {
      S.blip(ctx, io.out, t + i * 0.012, {
        freq: freqs[i], dur: 0.25, gain: 0.05 * vel,
        wave: 'square', duty: 0.25,
        a: 0.004, d: 0.03, s: 0.9, r: 0.05,
      });
    }
  },

  // ---- 打击：噪声通道 ----
  perc(ctx, io, t, bar, vel) {
    // hi-hat：八分网格，高光小节最密
    const dens = bar === 1 ? 1 : 0.72;
    for (let k = 0; k < 8; k++) {
      const acc = k % 2 === 0 ? 1 : 0.6;
      S.noise(ctx, io.out, t + k * E, {
        dur: 0.04, gain: 0.06 * vel * acc * dens,
        a: 0.001,
        filter: { type: 'highpass', freq: 6000, q: 0.7 },
      });
    }
    // kick：1、3 拍
    for (const b of [0, 2]) {
      S.drum(ctx, io.out, t + b * BEAT, {
        kind: 'kick', gain: 0.30 * vel, dur: 0.16, from: 150, to: 55,
      });
    }
    // 高光小节：噪声爆炸（低通下扫），像吃到道具 / 打中敌人
    if (bar === 1) {
      S.noise(ctx, io.out, t + 3 * BEAT + E, {
        dur: 0.35, gain: 0.10 * vel, a: 0.002, curve: 0.5,
        filter: { type: 'lowpass', freq: 4200, q: 0.8 }, sweepTo: 260,
      });
      S.drum(ctx, io.out, t + 3 * BEAT + E, {
        kind: 'kick', gain: 0.22 * vel, dur: 0.22, from: 120, to: 48,
      });
    }
    // 驶出小节：十六分的收尾碎音（像素碎片散开）
    if (bar === 2) {
      for (let k = 0; k < 4; k++) {
        S.noise(ctx, io.out, t + 3.5 * BEAT + k * S16, {
          dur: 0.05, gain: (0.05 - k * 0.008) * vel,
          filter: { type: 'highpass', freq: 5200 + k * 700, q: 0.7 },
        });
      }
    }
  },

  // ---- 特色：金币 / 1UP 音效 ----
  flavor(ctx, io, t0) {
    // 金币：6 音上行、跨两个八度（每步 4 个半音）
    chipRun(ctx, io.out, t0 + 0.05, 987.77, 6, 4, 0.05, 0.08);
    chipRun(ctx, io.out, t0 + 4.05, 987.77, 6, 4, 0.05, 0.075);
    // 1UP：更短更急的上行（4 个音，纯四度跳）
    chipRun(ctx, io.out, t0 + 2.05, 659.25, 4, 5, 0.045, 0.07);
    // 收尾：通关式的下行碎音 + 主机「断电」下滑音 + 过关和弦，余韵带进过框
    chipRun(ctx, io.out, t0 + 5.30, 1567.98, 6, -4, 0.062, 0.075);
    S.blip(ctx, io.out, t0 + 5.40, {
      freq: 233.08, dur: 0.46, gain: 0.085, wave: 'square', duty: 0.5,
      a: 0.004, d: 0.10, s: 0.55, r: 0.22, slideTo: 116.54,
    });
    for (const f of [440, 523.25, 659.25]) {
      S.blip(ctx, io.out, t0 + 5.80, {
        freq: f, dur: 0.30, gain: 0.11, wave: 'square', duty: 0.5,
        a: 0.004, d: 0.06, s: 0.7, r: 0.30,
      });
    }
  },
};
