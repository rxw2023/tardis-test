// ============================================================
// outro.js — 片尾 125~137s（6 小节）：新闻发布会
// 主题 B 段全奏 → 再现 A 段首句（配闪光灯）→ A 主音收束 + 原创着陆铃
// ============================================================

import S from '../synth.js';
import { themeFreq, stof, snapToScale, chordTones } from '../theory.js';
import { THEME, PROGRESSION } from '../melody.js';
import { makeSectionIO } from '../engine.js';

const BARS = [8, 9, 10, 11, 0, 11];   // 前 4 小节 B 段，再现，收束

export function renderOutroAudio(ctx, bus, t0) {
  const io = makeSectionIO(ctx, bus, { hall: 0.42, plate: 0.22, cave: 0.18 });

  // ---- 主题全奏 ----
  for (let k = 0; k < 6; k++) {
    const tb = BARS[k];
    const barT = t0 + k * 2;
    const fade = k === 5 ? 0.55 : 1;

    for (const n of THEME) {
      if (n[0] !== tb) continue;
      const t = barT + n[1] * 0.5;
      const dur = n[2] * 0.5;
      const f = themeFreq(n[3], 'minor', 0);
      const vel = n[4] * fade;
      // 弦乐群
      S.bow(ctx, io.out, t, {
        freq: f, dur, gain: 0.17 * vel, wave: 'sawtooth', bright: 2500,
        a: 0.10, s: 0.85, r: 0.22, scratch: 0.06, vib: { rate: 5.0, depth: 5 },
      });
      // 铜管（稍晚一点，像另一排席位）
      S.tone(ctx, io.out, t + 0.015, {
        freq: f, dur: dur * 0.95, type: 'sawtooth', gain: 0.075 * vel,
        a: 0.05, d: 0.12, s: 0.8, r: 0.18, filter: { type: 'lowpass', freq: 3600, q: 0.9 },
      });
      // 钟琴（高八度微光）
      S.fm(ctx, io.out, t, {
        freq: f * 2, dur: Math.min(1.2, dur * 1.6), gain: 0.045 * vel,
        ratio: 3.02, index: 2.2, decay: 0.5, bright: 9000,
      });
    }

    // 和声 / 低音
    const [rootSemi, quality] = PROGRESSION[tb];
    const tones = chordTones(rootSemi, quality, 'minor').map((s) => stof(s, -1));
    for (const f of tones) {
      S.bow(ctx, io.out, barT, {
        freq: f, dur: 1.85, gain: 0.05 * fade, wave: 'sawtooth', bright: 1400,
        a: 0.16, s: 0.85, r: 0.3, vib: { rate: 4.4, depth: 3 },
      });
    }
    S.sub(ctx, io.out, barT, { freq: stof(snapToScale(rootSemi, 'minor'), -2), dur: 1.8, gain: 0.30 * fade, a: 0.02, s: 0.85, r: 0.2, bright: 480 });

    // 打击：定音鼓 + 大镲
    S.drum(ctx, io.out, barT, { kind: 'tom', gain: 0.30 * fade, dur: 0.55, from: 110, to: 58 });
    if (k % 2 === 1) S.drum(ctx, io.out, barT + 1.0, { kind: 'tom', gain: 0.18 * fade, dur: 0.4, from: 130, to: 70 });
    if (k === 3 || k === 5) {
      S.drum(ctx, io.out, barT, { kind: 'gong', gain: 0.16 * fade, dur: 2.0, freq: 84 });
    }
    if (k === 3) {
      for (let j = 0; j < 12; j++) {
        S.drum(ctx, io.out, barT + 1.0 + j * 0.0625, { kind: 'snare', gain: (0.03 + j * 0.012) * fade, dur: 0.08 });
      }
    }
  }

  // ---- 第 5 小节：新闻发布会闪光灯（6 次快门）----
  const flashT = t0 + 8;
  for (let j = 0; j < 6; j++) {
    const t = flashT + j * 0.26;
    S.noise(ctx, io.out, t, { dur: 0.05, gain: 0.11, a: 0.001, filter: { type: 'highpass', freq: 4200, q: 0.6 } });
    S.drum(ctx, io.out, t, { kind: 'click', gain: 0.10, freq: 3200, body: 1400 });
    S.tone(ctx, io.out, t, { freq: 2400, dur: 0.03, type: 'square', gain: 0.03, a: 0.001, d: 0.01, s: 0.1, r: 0.02 });
  }

  // ---- 收束：原创着陆铃（135.6s）+ 渐弱 ----
  const land = t0 + 10.6;
  S.fm(ctx, io.out, land, {
    freq: 659.3, dur: 2.4, gain: 0.20, ratio: 3.44, index: 4.5, decay: 0.55, bright: 8000,
  });
  S.tone(ctx, io.out, land, {
    freq: 440, dur: 0.34, type: 'sine', gain: 0.13, a: 0.01, d: 0.1, s: 0.6, r: 0.12, slideTo: 880,
  });
  S.drum(ctx, io.out, land, { kind: 'kick', gain: 0.34, dur: 0.5, from: 190, to: 44, click: true });
  S.whoosh(ctx, io.out, land - 0.5, { dur: 0.55, gain: 0.12, up: false, from: 5200, to: 300 });

  // 尾音渐弱（混响尾巴自然延续）
  const g = io.out.gain;
  g.setValueAtTime(1, t0 + 11.6);
  g.exponentialRampToValueAtTime(0.0001, t0 + 12.0);
}
