// ============================================================
// a20-codeaesthetic.js — 第 20 格：代码美学（2020s）
// 音色：窄脉冲 lead + 正弦 sub bass + 滤波扫和音 + 四踩鼓组 + 键盘敲击
// 审美：极简 techno / 开发者工具 —— 窄、干、稳，不留余响
// ============================================================

import S, { prand } from '../synth.js';

// chord 回调拿不到 bar，这里用 ctx 维度的计数器恢复「第几小节」
const _chordBar = new WeakMap();
function chordBar(ctx) {
  const n = _chordBar.get(ctx) || 0;
  _chordBar.set(ctx, n + 1);
  return n;
}

export default {
  gain: 1.24,
  legato: 0.90,     // B 段音符密，让每个音都站得住（仍能听出颗粒）
  bassLen: 1.0,     // sub 拉满整小节
  chordOct: -1,

  // 主音：窄脉冲（duty 0.16）+ 同频正弦 ping（窄脉冲基频弱，用正弦把音高顶出来）
  //        + 0.14s 后一个极轻回声
  lead(ctx, io, t, freq, dur, vel, bar) {
    S.blip(ctx, io.out, t, {
      freq, dur: Math.max(0.09, dur * 0.9), gain: 0.24 * vel, wave: 'square', duty: 0.16,
      a: 0.003, d: 0.05, s: 0.25, r: 0.07,
      filter: { type: 'lowpass', freq: 4200, q: 0.8 },
    });
    S.tone(ctx, io.out, t, {
      freq, dur: Math.max(0.08, dur * 0.8), type: 'sine', gain: 0.11 * vel,
      a: 0.003, d: 0.05, s: 0.45, r: 0.07,
    });
    // 回声：干声里的一记弱影，配合引擎的 delay 发送
    S.tone(ctx, io.out, t + 0.14, {
      freq, dur: Math.max(0.06, dur * 0.45), type: 'triangle', gain: 0.072 * vel,
      a: 0.004, d: 0.05, s: 0.18, r: 0.07,
      filter: { type: 'lowpass', freq: 3600, q: 0.7 },
    });
  },

  // 低音：正弦 sub，低通压到 240，只留地基
  // 注意：sub 的持续能量很容易盖掉主题基频，这里压到 lead 的 1/3 以下
  bass(ctx, io, t, freq, dur, vel) {
    S.tone(ctx, io.out, t, {
      freq, dur, type: 'sine', gain: 0.08 * vel,
      a: 0.008, d: 0.10, s: 0.50, r: 0.12,
      filter: { type: 'lowpass', freq: 240, q: 0.7 },
    });
  },

  // 和音：锯齿经低通，bar1（高光）把滤波打开到 2600
  chord(ctx, io, t, freqs, dur, vel) {
    const bar = chordBar(ctx);
    const cut = bar === 1 ? 2600 : 1200;
    for (const f of freqs) {
      for (const det of [-6, 6]) {
        S.tone(ctx, io.out, t, {
          freq: f, dur: dur * 0.92, type: 'sawtooth', gain: 0.045 * vel, detune: det,
          a: 0.08, d: 0.12, s: 0.70, r: 0.20,
          filter: { type: 'lowpass', freq: cut, q: 0.7 },
        });
      }
    }
  },

  // 鼓：四踩打底 + hat 密度做三小节层次
  perc(ctx, io, t, bar, vel) {
    const B = 0.5, E = 0.125;
    for (let b = 0; b < 4; b++) {
      S.drum(ctx, io.out, t + b * B, {
        kind: 'kick', gain: 0.56 * vel, dur: 0.24, from: 155, to: 48, click: true,
      });
    }
    if (bar === 1) {
      // 高光：十六分 hat 全开
      for (let k = 0; k < 16; k++) {
        const g = (k % 4 === 0) ? 0.112 : (k % 2 === 0 ? 0.082 : 0.056);
        S.drum(ctx, io.out, t + k * E, { kind: 'hat', gain: g * vel, dur: 0.04 });
      }
      S.drum(ctx, io.out, t + 1 * B, { kind: 'clap', gain: 0.25 * vel });
      S.drum(ctx, io.out, t + 3 * B, { kind: 'clap', gain: 0.28 * vel });
      // 一次上行滤波扫（编译/构建进度条）
      S.noise(ctx, io.out, t + 2 * B, {
        dur: 0.85, gain: 0.085 * vel, a: 0.02, curve: 0.6,
        filter: { type: 'bandpass', freq: 700, q: 1.3 }, sweepTo: 6800,
      });
    } else {
      // 进场（八分）/ 驶出（八分且更轻）
      const step = 0.25;
      const scale = bar === 2 ? 0.6 : 1.0;
      for (let k = 0; k < 8; k++) {
        const g = (k % 2 ? 0.064 : 0.105) * scale;
        S.drum(ctx, io.out, t + k * step, { kind: 'hat', gain: g * vel, dur: 0.045 });
      }
    }
  },

  // 键盘敲击 + 显示器电流嘶声
  flavor(ctx, io, t0) {
    // 打字：8 次确定性散布的 click
    const N = 8;
    for (let k = 0; k < N; k++) {
      const r1 = prand(k * 4.7 + 1.3);
      const r2 = prand(k * 9.1 + 5.7);
      const tt = t0 + 0.35 + (k + r1 * 0.8) * (5.4 / N);
      S.drum(ctx, io.out, tt, {
        kind: 'click', gain: (0.022 + r2 * 0.016), freq: 3000, body: 1500,
      });
    }
    // 显示器高频电流嘶声（极轻，收在版块内）
    S.noise(ctx, io.out, t0, {
      dur: 5.6, gain: 0.008, env: true,
      a: 0.35, d: 0.6, s: 0.85, r: 0.2,
      filter: { type: 'highpass', freq: 7000, q: 0.6 },
    });
  },
};
