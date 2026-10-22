// ============================================================
// a14-nosferatu.js — 第 14 格：诺斯费拉图（1922）
// 音色：低音管风琴高音栓（主题）+ 管风琴踏板（低音）+ 钢琴低音颤奏（和声）
//       + 心跳（唯一的"鼓"）+ 地窖空气 / 弦乐滑音
// 无声电影：没有鼓组、没有镲，只有脉搏；末段埋一段电流，接下一格的示波器
// ============================================================

import S, { prand } from '../synth.js';
import { stof } from '../theory.js';

// ------------------------------------------------------------
// 局部辅助 1：弦乐上行滑音
// synth.js 的 S.bow 不支持 slideTo，这里用「带共振峰的锯齿 + 弓噪」
// 复刻同一个音色，并让音高在 dur 内滑上去（glissando）
// ------------------------------------------------------------
function bowSlide(ctx, dest, t, o) {
  const a = o.a ?? 0.2;
  const r = o.r ?? 0.30;
  S.tone(ctx, dest, t, {
    freq: o.freq, dur: o.dur, type: 'sawtooth', gain: o.gain,
    a, d: 0.15, s: 0.86, r,
    filter: { type: 'lowpass', freq: o.bright ?? 1800, q: 0.8 },
    slideTo: o.to,
    vib: { rate: 4.8, depth: 4 },
  });
  S.noise(ctx, dest, t, {
    dur: o.dur, gain: o.gain * 0.30, env: true,
    a, d: 0.20, s: 0.45, r,
    filter: { type: 'bandpass', freq: o.freq * 3, q: 1.3 },
    sweepTo: o.to * 3,
  });
}

// ------------------------------------------------------------
// 局部辅助 2：钢琴低音颤奏（tremolo）
// 无声电影惊悚片的招牌：把一个和弦音拆成一串等间隔的极短 pluck，
// 单音很轻（0.03），靠重复把紧张感推起来。
// 个数随 vel（小节包络 0.8/1.0/0.72）在 8~12 之间浮动：进场 9 / 高光 12 / 驶出 8
// ------------------------------------------------------------
function pianoTremolo(ctx, dest, t, freq, dur, vel, seed) {
  const STEP = 0.075;
  const n = Math.max(8, Math.min(12, Math.round(vel * 15)));
  for (let k = 0; k < n; k++) {
    const tt = t + k * STEP;
    if (tt - t > dur) break;
    const v = 0.72 + prand(seed + k * 3.1) * 0.50;   // 手指力度起伏
    S.pluck(ctx, dest, tt, {
      freq, dur: 0.42, gain: 0.03 * vel * v,
      partials: 6, bright: 2.0, damp: 0.9, body: 700, noiseAtk: 0.24,
    });
  }
}

export default {
  gain: 1.0,
  legato: 1.02,     // 管风琴是持续音，时值拉满并稍微粘一点
  bassLen: 0.98,
  bassOct: -1,      // 踏板音落在 E2/F2/A2 一带（比主题低一个八度）
  chordOct: 0,      // 颤奏在 E3~C4，正好垫在主题下方

  // lead：低音管风琴上的高音栓 —— 基音 + 八度 + 十二度，慢起，一点点风声
  // 三层增益 0.16/0.06/0.03，基音始终压过泛音
  lead(ctx, io, t, freq, dur, vel, bar) {
    // 第 1 小节只有一个长音（E3），把它一直拉到小节末：
    // 管风琴是持续音乐器，而且不能让第 2 小节前出现「只剩踏板音」的空隙
    const d = dur * (bar === 0 ? 1.38 : 1.0);
    S.tone(ctx, io.out, t, {
      freq, dur: d, type: 'sine', gain: 0.16 * vel,
      a: 0.10, d: 0.12, s: 0.90, r: 0.30,
    });
    S.tone(ctx, io.out, t, {
      freq: freq * 2, dur: d, type: 'sine', gain: 0.06 * vel,
      a: 0.10, d: 0.14, s: 0.90, r: 0.30,
    });
    S.tone(ctx, io.out, t, {
      freq: freq * 3, dur: d, type: 'sine', gain: 0.03 * vel,
      a: 0.12, d: 0.14, s: 0.88, r: 0.28,
    });
    // 管风琴的风箱声
    S.noise(ctx, io.out, t, {
      dur: d, gain: 0.02 * vel, env: true,
      filter: { type: 'bandpass', freq: Math.min(freq * 4, 5000), q: 3.5 },
      a: 0.12, d: 0.16, s: 0.55, r: 0.26,
    });
    if (bar === 1) {
      // 高光小节：给主题加一层轻微的 4' 栓（高八度）让它更"亮"
      S.tone(ctx, io.out, t + 0.02, {
        freq: freq * 4, dur: dur * 0.8, type: 'sine', gain: 0.022 * vel,
        a: 0.14, d: 0.14, s: 0.85, r: 0.26,
      });
    }
  },

  // bass：管风琴踏板音（16' + 8'），时值拉满一小节
  // 两层合计 0.115，约为 lead 三层合计 0.25 的 46%（红线：≤60%），主题不会被埋
  bass(ctx, io, t, freq, dur, vel) {
    S.tone(ctx, io.out, t, {
      freq, dur, type: 'sine', gain: 0.085 * vel,
      a: 0.14, d: 0.10, s: 0.92, r: 0.28,
      filter: { type: 'lowpass', freq: 260, q: 0.7 },
    });
    S.tone(ctx, io.out, t + 0.012, {
      freq, dur, type: 'sawtooth', gain: 0.030 * vel,
      a: 0.16, d: 0.12, s: 0.92, r: 0.28,
      filter: { type: 'lowpass', freq: 260, q: 0.7 },
    });
  },

  // chord：钢琴低音颤奏
  chord(ctx, io, t, freqs, dur, vel) {
    for (let k = 0; k < freqs.length; k++) {
      pianoTremolo(ctx, io.out, t + k * 0.018, freqs[k], dur, vel, 7.3 + k * 5.9);
    }
  },

  // perc：只有心跳 —— 小节头一记 lub + 0.26s 后一记轻的 dub；
  //       高光小节（bar 1）中途再补一记，让脉搏加速
  perc(ctx, io, t, bar, vel) {
    S.drum(ctx, io.out, t, { kind: 'kick', gain: 0.30 * vel, dur: 0.6, from: 130, to: 38 });
    S.drum(ctx, io.out, t + 0.26, { kind: 'kick', gain: 0.15 * vel, dur: 0.45, from: 112, to: 36 });
    if (bar === 1) {
      S.drum(ctx, io.out, t + 1.00, { kind: 'kick', gain: 0.22 * vel, dur: 0.6, from: 130, to: 38 });
    }
  },

  // flavor：地窖空气 + 两次弦乐滑音 + 第 3 小节末尾的电流伏笔
  flavor(ctx, io, t0) {
    // 地窖空气：6 秒的低频气流，150 → 400Hz 缓慢上行
    S.noise(ctx, io.out, t0, {
      dur: 6, gain: 0.04, a: 0.90, curve: 0.55,
      filter: { type: 'bandpass', freq: 150, q: 0.7 },
      sweepTo: 400,
    });

    // 两次弦乐上行滑音：像地窖里有什么东西在靠近
    bowSlide(ctx, io.out, t0 + 1.20, {
      freq: stof(-5, -1), to: stof(0, -1), dur: 0.95, gain: 0.05, bright: 1800, a: 0.20,
    });
    bowSlide(ctx, io.out, t0 + 4.50, {
      freq: stof(-4, -1), to: stof(2, -1), dur: 1.00, gain: 0.045, bright: 1600, a: 0.24,
    });

    // 电流的伏笔（下一格墙上的影子要通电成示波器）：
    // 高频嘶声缓慢渐强 + 一记高频金属 ping
    S.noise(ctx, io.out, t0 + 5.20, {
      dur: 0.9, gain: 0.02, env: true,
      a: 0.62, d: 0.05, s: 1.0, r: 0.28,
      filter: { type: 'highpass', freq: 4000, q: 0.7 },
    });
    S.fm(ctx, io.out, t0 + 5.62, {
      freq: 1200, ratio: 5.5, index: 3.2, dur: 0.5, gain: 0.03, decay: 0.5, bright: 9000,
    });
  },
};
