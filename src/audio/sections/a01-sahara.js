// ============================================================
// a01-sahara.js — 第 1 格：撒哈拉岩画（约前 4000）
// 音色：骨笛（气声三角波）+ 人声哼唱 + 皮面手鼓 + 石击 + 沙风
// 无金属、无和声乐器：全部来自人体与岩石
// ============================================================

import S, { prand } from '../synth.js';

export default {
  gain: 0.98,
  legato: 0.94,

  // 骨笛：气声很重，音头慢，尾部有一点空洞的五度泛音
  lead(ctx, io, t, freq, dur, vel, bar) {
    S.reed(ctx, io.out, t, {
      freq, dur: dur * 0.98, gain: 0.30 * vel, wave: 'triangle',
      breath: 0.44, bite: 1850, a: 0.075, s: 0.80, r: 0.17,
      vib: { rate: 4.4 + bar * 0.3, depth: 7 },
    });
    S.tone(ctx, io.out, t, {
      freq: freq * 2.005, dur: dur * 0.7, type: 'sine', gain: 0.055 * vel,
      a: 0.10, d: 0.22, s: 0.28, r: 0.22,
    });
  },

  // 低音：牛吼器式的低音号角 + 手鼓底音
  bass(ctx, io, t, freq, dur, vel) {
    S.reed(ctx, io.out, t, {
      freq, dur: dur * 0.88, gain: 0.24 * vel, wave: 'sawtooth',
      breath: 0.38, bite: 400, a: 0.11, s: 0.72, r: 0.22,
      vib: { rate: 3.1, depth: 4 },
    });
    S.drum(ctx, io.out, t, { kind: 'tom', gain: 0.20 * vel, dur: 0.42, from: 128, to: 64 });
  },

  // 哼唱：两人，根音与五度，音头慢、音量低
  chord(ctx, io, t, freqs, dur, vel) {
    const pick = [freqs[0], freqs[freqs.length - 1]];
    for (let k = 0; k < pick.length; k++) {
      S.reed(ctx, io.out, t + k * 0.06, {
        freq: pick[k], dur: dur * 0.9, gain: 0.075 * vel, wave: 'sine',
        breath: 0.14, bite: 1100, a: 0.16, s: 0.85, r: 0.26,
        vib: { rate: 4.8, depth: 6 },
      });
    }
  },

  // 手鼓：掌心（tom）与指尖（rim）在八分网格上
  perc(ctx, io, t, bar, vel) {
    const E = 0.25;
    const PATTERNS = [
      [1, 0, 2, 2, 0, 2, 0, 0],
      [1, 0, 2, 2, 1, 0, 2, 2],
      [1, 2, 0, 2, 0, 0, 2, 0],
    ];
    const pat = PATTERNS[bar] || PATTERNS[0];
    for (let k = 0; k < 8; k++) {
      const v = pat[k];
      if (!v) continue;
      const tt = t + k * E;
      const jitter = (prand(bar * 13 + k) - 0.5) * 0.012;
      if (v === 1) {
        S.drum(ctx, io.out, tt + jitter, { kind: 'tom', gain: 0.26 * vel, dur: 0.30, from: 168, to: 78 });
      } else {
        S.drum(ctx, io.out, tt + jitter, { kind: 'rim', gain: 0.13 * vel, freq: 2100, body: 620 });
      }
    }
  },

  // 沙风 + 零星石击
  flavor(ctx, io, t0) {
    const src = ctx.createBufferSource();
    src.buffer = S.noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(420, t0);
    f.frequency.linearRampToValueAtTime(760, t0 + 2.2);
    f.frequency.linearRampToValueAtTime(380, t0 + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.055, t0 + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6);
    src.connect(f).connect(g).connect(io.out);
    src.start(t0); src.stop(t0 + 6.05);

    for (let k = 0; k < 5; k++) {
      const tt = t0 + 0.6 + k * 1.1 + prand(k * 3.7) * 0.5;
      S.drum(ctx, io.out, tt, {
        kind: 'woodblock', gain: 0.07 + prand(k * 9.1) * 0.05,
        freq: 620 + prand(k * 5.5) * 900,
      });
    }
  },
};
