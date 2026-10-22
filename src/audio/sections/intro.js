// ============================================================
// intro.js — 片头 0~5s（2.5 小节）
// 时空舱点火 → 主题动机在漩涡里浮现 → 上行推进到第一道画框
// ============================================================

import S from '../synth.js';
import { themeFreq, stof } from '../theory.js';
import { INTRO_MOTIF } from '../melody.js';
import { makeSectionIO } from '../engine.js';

export function renderIntroAudio(ctx, bus, t0) {
  const io = makeSectionIO(ctx, bus, { hall: 0.55, cave: 0.35 });

  // 1) 点火：低频推力 + 启动噪声
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(28, t0);
  o.frequency.exponentialRampToValueAtTime(62, t0 + 1.6);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.34, t0 + 0.35);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
  o.connect(og).connect(bus.dry);
  o.start(t0); o.stop(t0 + 2.5);

  S.noise(ctx, io.out, t0, {
    dur: 1.2, gain: 0.09, a: 0.25,
    filter: { type: 'bandpass', freq: 900, q: 0.6 }, sweepTo: 2600,
  });

  // 2) 主题动机：漩涡音色（慢起正弦 + 旋转泛音，长混响）
  for (const n of INTRO_MOTIF) {
    const t = t0 + n[0] * 2 + n[1] * 0.5;
    const dur = n[2] * 0.5;
    const freq = themeFreq(n[3], 'minor', 0);
    const vel = n[4];
    S.tone(ctx, io.out, t, {
      freq, dur, type: 'sine', gain: 0.24 * vel,
      a: 0.12, d: 0.15, s: 0.75, r: 0.30,
      vib: { rate: 3.4, depth: 9 },
    });
    S.tone(ctx, io.out, t + 0.03, {
      freq: freq * 2, dur: dur * 0.8, type: 'triangle', gain: 0.07 * vel,
      a: 0.18, d: 0.2, s: 0.5, r: 0.3,
    });
    // 漩涡：五度上方的一点微光
    S.tone(ctx, io.out, t + 0.06, {
      freq: freq * 3, dur: dur * 0.5, type: 'sine', gain: 0.028 * vel,
      a: 0.2, d: 0.25, s: 0.3, r: 0.3,
    });
  }

  // 低音踏板（A1）
  S.sub(ctx, io.out, t0, { freq: stof(0, -3), dur: 4.2, gain: 0.16, wave: 'sine', a: 0.5, s: 0.9, r: 0.6, bright: 300 });

  // 3) 推进：上行 riser + 三连点击，落在 5.0s 强拍
  const r0 = t0 + 3.6;
  S.noise(ctx, io.out, r0, {
    dur: 1.35, gain: 0.14, a: 0.9,
    filter: { type: 'bandpass', freq: 400, q: 1.6 }, sweepTo: 7200,
  });
  for (let k = 0; k < 6; k++) {
    S.tone(ctx, io.out, r0 + k * 0.16, {
      freq: stof([0, 3, 7, 10, 12, 15][k], 0) * 2, dur: 0.12, type: 'sine', gain: 0.08,
      a: 0.004, d: 0.05, s: 0.2, r: 0.08,
    });
  }
  S.drum(ctx, bus.dry, t0 + 4.75, { kind: 'kick', gain: 0.30, dur: 0.4, from: 180, to: 46, click: true });
}
