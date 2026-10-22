// ============================================================
// a11-ukiyoe.js — 第 11 格：浮世绘（1830s）
// 音色：三味线 + 低弦 + 尺八 + 太鼓 / 边击 / 拍子木 + 町屋环境
// ============================================================

import S, { prand } from '../synth.js';

export default {
  gain: 1.0,
  legato: 0.90,
  bassLen: 0.72,

  // 三味线：亮而干的拨弦，以短促上滑模拟「さわり」
  lead(ctx, io, t, freq, dur, vel, bar, semis) {
    const bend = 1 + prand(110 + bar * 19 + Math.abs(semis) * 0.7);
    S.pluck(ctx, io.out, t, {
      freq, dur, gain: 0.32 * vel, partials: 8,
      bright: 1.0, damp: 0.55, body: 2600, noiseAtk: 0.5, bend,
    });

    // 长音补一次弱拨，维持三味线的颗粒感而不盖过首次起音
    if (dur >= 0.8) {
      const dt = Math.min(0.38, dur * 0.44);
      S.pluck(ctx, io.out, t + dt, {
        freq, dur: Math.max(0.28, dur - dt), gain: 0.128 * vel, partials: 8,
        bright: 1.0, damp: 0.55, body: 2600, noiseAtk: 0.35, bend: 1,
      });
    }
  },

  // 三味线低弦：每小节一次，保持在主旋律六成音量以内
  bass(ctx, io, t, freq, dur, vel) {
    S.pluck(ctx, io.out, t, {
      freq, dur: dur * 0.86, gain: 0.15 * vel, partials: 4,
      bright: 1.7, damp: 0.8, body: 900, noiseAtk: 0.28, bend: 1,
    });
  },

  // 尺八：和弦头尾两音形成稀薄、持续的气声
  chord(ctx, io, t, freqs, dur, vel) {
    const voices = [freqs[0], freqs[freqs.length - 1]];
    for (let k = 0; k < voices.length; k++) {
      S.reed(ctx, io.out, t + k * 0.045, {
        freq: voices[k], dur: dur * 0.94, gain: 0.05 * vel, wave: 'sine',
        breath: 0.5, bite: 1000, a: 0.14, s: 0.82, r: 0.22,
        vib: { rate: 4.2 + k * 0.25, depth: 5 },
      });
    }
  },

  // 小节头太鼓；边击由八分推进，高光加密至十六分，驶出逐步收弱
  perc(ctx, io, t, bar, vel) {
    S.drum(ctx, io.out, t - 0.06, {
      kind: 'woodblock', freq: 1600, gain: 0.17 * vel, dur: 0.07,
    });
    S.drum(ctx, io.out, t, {
      kind: 'tom', from: 165, to: 62, dur: 0.42, gain: 0.27 * vel,
    });

    const step = bar === 1 ? 0.125 : 0.25;
    const count = bar === 1 ? 16 : 8;
    for (let k = 1; k < count; k++) {
      const fade = bar === 2 ? 1 - k / (count + 1) : 1;
      const accent = k % (bar === 1 ? 4 : 2) === 0 ? 1.16 : 0.86;
      S.drum(ctx, io.out, t + k * step, {
        kind: 'rim', freq: 1500,
        gain: (bar === 1 ? 0.085 : 0.075) * accent * fade * vel,
      });
    }
  },

  // 木造町屋的窄带底噪，加三次远处木屐声
  flavor(ctx, io, t0) {
    S.noise(ctx, io.out, t0, {
      dur: 6, gain: 0.025, env: true,
      filter: { type: 'bandpass', freq: 600, q: 0.65 }, sweepTo: 1200,
      a: 0.45, d: 0.3, s: 0.78, r: 0.5,
    });

    for (let k = 0; k < 3; k++) {
      const tt = t0 + 0.82 + k * 1.66 + prand(311 + k * 23) * 0.24;
      S.drum(ctx, io.out, tt, {
        kind: 'woodblock', freq: 2300 + prand(401 + k * 29) * 950,
        gain: 0.05, dur: 0.06,
      });
    }
  },
};
