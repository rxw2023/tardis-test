// ============================================================
// a13-scream.js — 第 13 格：呐喊（1893）
// 音色：扭曲的弦乐+铜管（全音阶，无归属感）／低音铜管的咆哮
//       ／不协和的弦乐墙／心跳式大鼓（不规则落点）／桥上的风／两记远处的尖叫
// 全曲最不安的一格：允许"脏"，但主题基频始终是最强的谱峰。
// ============================================================

import S, { prand } from '../synth.js';

// 音分 → 频率（S.bow 没有 detune 参数，用频率微调做拍频）
function cents(f, c) {
  return f * Math.pow(2, c / 1200);
}

// 远处的一声尖叫：上行滑音锯齿 + 带通扫频 + 颤音
// （synth.js 的 tone 不支持滤波扫频，这里在本文件内局部实现）
function scream(ctx, dest, t, o) {
  const dur = o.dur ?? 0.9;
  const r = o.r ?? 0.30;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(o.from, t);
  osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = o.vibRate ?? 5.6;
  const lg = ctx.createGain();
  lg.gain.value = o.vibDepth ?? 14;
  lfo.connect(lg).connect(osc.frequency);

  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = o.q ?? 2.2;
  f.frequency.setValueAtTime(o.from * 1.15, t);
  f.frequency.exponentialRampToValueAtTime(o.to * 1.4, t + dur);

  const g = S.env(ctx, t, dur, {
    a: o.a ?? 0.10, d: 0.14, s: 0.78, r, peak: o.gain ?? 0.04,
  });
  osc.connect(f).connect(g).connect(dest);
  osc.start(t); osc.stop(t + dur + r + 0.2);
  lfo.start(t); lfo.stop(t + dur + r + 0.2);
  return g;
}

export default {
  gain: 1.06,
  legato: 0.94,
  bassLen: 0.88,
  chordOct: -1,
  chordLen: 0.95,

  // 主旋律：扭曲的弓弦（大幅颤音）+ 撕裂的失谐方波
  lead(ctx, io, t, freq, dur, vel, bar) {
    S.bow(ctx, io.out, t, {
      freq, dur: dur * 1.02, gain: 0.235 * vel, wave: 'sawtooth',
      bright: 3000, a: 0.06, d: 0.10, s: 0.90, r: 0.20, scratch: 0.15,
      vib: { rate: 6.2, depth: 16 },
    });
    // 撕裂感：±12 音分的方波，低通压暗只留锯齿般的金属边
    for (const d of [-12, 12]) {
      S.tone(ctx, io.out, t, {
        freq, dur: dur * 0.90, type: 'square', gain: 0.045 * vel, detune: d,
        a: 0.05, d: 0.10, s: 0.80, r: 0.16,
        filter: { type: 'lowpass', freq: 1800, q: 0.9 },
      });
    }
  },

  // 低音：低音铜管的咆哮（锯齿 + sub，总量控制在 lead 的 60% 以内）
  bass(ctx, io, t, freq, dur, vel) {
    S.tone(ctx, io.out, t, {
      freq, dur: dur * 0.94, gain: 0.125 * vel, type: 'sawtooth',
      a: 0.04, d: 0.12, s: 0.85, r: 0.18,
      filter: { type: 'lowpass', freq: 420, q: 1.0 },
      vib: { rate: 4.4, depth: 8 },
    });
    S.sub(ctx, io.out, t, {
      freq, dur: dur * 0.90, gain: 0.048 * vel, wave: 'sine', bright: 240,
    });
  },

  // 和声：不协和的弦乐墙（相邻音 ±14 音分失谐 → 拍频）
  chord(ctx, io, t, freqs, dur, vel) {
    for (let k = 0; k < freqs.length; k++) {
      S.bow(ctx, io.out, t + k * 0.035, {
        freq: cents(freqs[k], k % 2 === 0 ? -14 : 14),
        dur: dur * 0.98, gain: 0.035 * vel, wave: 'sawtooth',
        bright: 1200, a: 0.12, d: 0.20, s: 0.85, r: 0.24, scratch: 0.20,
        vib: { rate: 5.4, depth: 12 },
      });
    }
  },

  // 打击：心跳式大鼓，落点故意歪掉；第 2 小节一记镲
  perc(ctx, io, t, bar, vel, info) {
    const B = 0.5;
    const HITS = [
      [0, 1.5, 2.75],
      [0, 1.5, 2.75, 3.5],
      [0, 1.25, 2.75],
    ];
    const hits = HITS[bar] || HITS[0];
    for (let k = 0; k < hits.length; k++) {
      const jitter = (prand(bar * 17.3 + k * 3.1) - 0.5) * 0.035;
      const g = (0.28 + prand(bar * 5.7 + k * 2.3) * 0.10) * vel;
      S.drum(ctx, io.out, t + hits[k] * B + jitter, {
        kind: 'kick', gain: g, dur: 0.5, from: 175, to: 40,
      });
    }
    // 高光：一记闷镲（bar1 的长音处）
    if (bar === 1) {
      S.drum(ctx, io.out, t + 2 * B, {
        kind: 'gong', gain: 0.10 * vel, dur: 1.2, freq: 96, bright: 2600,
      });
    }
    // 木桥在低处的咯吱（极低音量的木头声，只在后两小节）
    if (bar > 0) {
      const n = bar === 1 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const b = 0.5 + prand(bar * 11.9 + k * 4.7) * 3;
        S.drum(ctx, io.out, t + b * B, {
          kind: 'woodblock', gain: 0.05 * vel, freq: 380 + prand(bar * 3.3 + k) * 260,
        });
      }
    }
  },

  // 桥上的风 + 两记远处的尖叫
  flavor(ctx, io, t0) {
    // 风：6 秒带通扫频，比别的版块明显
    S.noise(ctx, io.out, t0, {
      dur: 6.0, gain: 0.06, env: true,
      filter: { type: 'bandpass', freq: 700, q: 0.9 }, sweepTo: 1800,
      a: 0.9, d: 0.6, s: 0.85, r: 1.0,
    });

    // 两记尖叫：避开主题音头，落在乐句之间
    scream(ctx, io.out, t0 + 3.30, {
      from: 880, to: 1560, dur: 0.85, gain: 0.04, q: 2.4,
      vibRate: 5.6, vibDepth: 14, a: 0.12, r: 0.32,
    });
    scream(ctx, io.out, t0 + 5.55, {
      from: 660, to: 1180, dur: 0.95, gain: 0.036, q: 2.0,
      vibRate: 7.4, vibDepth: 18, a: 0.14, r: 0.34,
    });
  },
};
