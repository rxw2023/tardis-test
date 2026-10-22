// ============================================================
// neutral.js — 兜底音色（尚未定制乐器的版块先用它出声）
// 中性拨弦 + 正弦低音 + 轻铺底 + 基本鼓组，保证整片任何时候都有音乐
// ============================================================

import S from '../synth.js';

export default function neutral(index, preset = {}) {
  return {
    gain: 0.9,
    lead(ctx, io, t, freq, dur, vel, bar) {
      S.pluck(ctx, io.out, t, {
        freq, dur: Math.max(0.5, dur * 1.8), gain: 0.42 * vel,
        partials: 7, bright: 1.25, damp: 0.6, body: 2800, noiseAtk: 0.25,
      });
      S.tone(ctx, io.out, t, {
        freq, dur, type: 'triangle', gain: 0.15 * vel,
        a: 0.012, d: 0.09, s: 0.55, r: 0.14, filter: { type: 'lowpass', freq: 3200, q: 0.7 },
      });
    },
    bass(ctx, io, t, freq, dur, vel) {
      S.sub(ctx, io.out, t, { freq, dur: dur * 0.94, gain: 0.26 * vel, wave: 'sine', bright: 520 });
    },
    chord(ctx, io, t, freqs, dur, vel) {
      for (const f of freqs) {
        S.bow(ctx, io.out, t, {
          freq: f, dur: dur * 0.92, gain: 0.055 * vel, wave: 'sawtooth',
          bright: 1500, a: 0.13, s: 0.8, r: 0.2, scratch: 0.05, vib: { rate: 4.6, depth: 3 },
        });
      }
    },
    perc(ctx, io, t, bar, vel) {
      const B = 0.5;
      S.drum(ctx, io.out, t, { kind: 'kick', gain: 0.34 * vel, dur: 0.28 });
      S.drum(ctx, io.out, t + 2 * B, { kind: 'kick', gain: 0.24 * vel, dur: 0.24 });
      if (bar !== 0) {
        S.drum(ctx, io.out, t + 1 * B, { kind: 'hat', gain: 0.10 * vel });
        S.drum(ctx, io.out, t + 3 * B, { kind: 'hat', gain: 0.10 * vel });
      }
      if (bar >= 1) {
        for (let k = 0; k < 8; k++) {
          if (k % 2 === 0) continue;
          S.drum(ctx, io.out, t + k * B * 0.5, { kind: 'hat', gain: 0.055 * vel, dur: 0.04 });
        }
      }
      if (bar === 1) S.drum(ctx, io.out, t + 2 * B, { kind: 'snare', gain: 0.20 * vel, dur: 0.17 });
    },
  };
}
