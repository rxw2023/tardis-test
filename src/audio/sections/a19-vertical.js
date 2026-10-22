// ============================================================
// a19-vertical.js — 第 19 格：竖屏短视频（2020s）
// 音色：合成 pluck + 808 低音 + 宽 pad + 四踩鼓组 + 短视频 UI 音效
// ============================================================

import S, { prand } from '../synth.js';

export default {
  gain: 0.92,
  legato: 0.55,     // 短促，像短视频 BGM 的切分
  bassLen: 0.85,

  // 主音：双锯齿失谐 pluck，滤波器带包络
  lead(ctx, io, t, freq, dur, vel, bar) {
    for (const det of [-7, 7]) {
      S.tone(ctx, io.out, t, {
        freq, dur: Math.max(0.12, dur * 0.75), type: 'sawtooth', gain: 0.13 * vel, detune: det,
        a: 0.006, d: 0.09, s: 0.35, r: 0.10,
        filter: { type: 'lowpass', freq: 3400, q: 1.1 },
      });
    }
    S.tone(ctx, io.out, t, {
      freq: freq * 2, dur: Math.max(0.08, dur * 0.4), type: 'triangle', gain: 0.05 * vel,
      a: 0.004, d: 0.06, s: 0.2, r: 0.06,
    });
  },

  // 808：正弦 + 快速下滑 + 长尾
  bass(ctx, io, t, freq, dur, vel) {
    S.tone(ctx, io.out, t, {
      freq: freq * 2, dur: dur * 0.16, type: 'sine', gain: 0.36 * vel,
      a: 0.004, d: 0.05, s: 0.2, r: 0.08, slideTo: freq,
    });
    S.tone(ctx, io.out, t, {
      freq, dur: dur * 0.92, type: 'sine', gain: 0.28 * vel,
      a: 0.008, d: 0.20, s: 0.55, r: 0.14, filter: { type: 'lowpass', freq: 320, q: 0.8 },
    });
  },

  // 宽 pad（两个失谐锯齿）
  chord(ctx, io, t, freqs, dur, vel) {
    for (const f of freqs) {
      for (const det of [-9, 9]) {
        S.tone(ctx, io.out, t, {
          freq: f, dur: dur * 0.95, type: 'sawtooth', gain: 0.035 * vel, detune: det,
          a: 0.05, d: 0.15, s: 0.7, r: 0.18,
          filter: { type: 'lowpass', freq: 1500, q: 0.7 },
        });
      }
    }
  },

  perc(ctx, io, t, bar, vel) {
    const B = 0.5, E = 0.125;
    for (let b = 0; b < 4; b++) {
      S.drum(ctx, io.out, t + b * B, { kind: 'kick', gain: 0.42 * vel, dur: 0.26, from: 160, to: 48, click: true });
    }
    if (bar === 0) {
      for (let k = 0; k < 8; k++) {
        S.drum(ctx, io.out, t + k * 0.25, { kind: 'hat', gain: (k % 2 ? 0.055 : 0.085) * vel, dur: 0.045 });
      }
    } else {
      for (let k = 0; k < 16; k++) {
        const g = (k % 4 === 0) ? 0.075 : (k % 2 === 0 ? 0.05 : 0.032);
        S.drum(ctx, io.out, t + k * E, { kind: 'hat', gain: g * vel, dur: 0.04 });
      }
      S.drum(ctx, io.out, t + 1 * B, { kind: 'clap', gain: 0.20 * vel });
      S.drum(ctx, io.out, t + 3 * B, { kind: 'clap', gain: 0.22 * vel });
    }
    if (bar === 2) {
      S.drum(ctx, io.out, t + 3.5 * B, { kind: 'openhat', gain: 0.11 * vel, dur: 0.22 });
      for (let k = 0; k < 4; k++) {
        S.drum(ctx, io.out, t + 3.75 * B + k * E * 0.5, { kind: 'snare', gain: (0.06 + k * 0.03) * vel, dur: 0.10 });
      }
    }
  },

  // 短视频 UI：进入的滑刷声 + 结尾的提示音
  flavor(ctx, io, t0) {
    S.whoosh(ctx, io.out, t0, { dur: 0.22, gain: 0.10, up: true, from: 900, to: 6500, q: 2 });
    S.blip(ctx, io.out, t0 + 5.55, {
      freq: 1568, dur: 0.16, gain: 0.09, wave: 'sine', a: 0.004, d: 0.05, s: 0.3, r: 0.10,
    });
  },
};
