// ============================================================
// a04-tangline.js — 第 4 格：唐代白描（约 750）
// 白描 = 只有线、没有块面 → 织体线性、连绵、少打击
// 音色：古琴（拨弦 + 延迟正弦余韵「吟猱」）+ 古琴低弦/低音笙
//        + 笙的和音（慢起锯齿）+ 拍板（极简）+ 云锣一点 + 卷轴摩擦
// 主题小节：12 小节主题的第 9 / 10 / 11 小节（B 段，音符较密）
// ============================================================

import S, { prand } from '../synth.js';

// ---- 局部辅助（不动 synth.js）----

// 卷轴徐徐展开的摩擦声：带通噪声 + 缓慢起伏，避免用打击式的快包络
function scrollFriction(ctx, dest, t0, dur, gain) {
  const src = ctx.createBufferSource();
  src.buffer = S.noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(2400, t0);
  f.frequency.linearRampToValueAtTime(3200, t0 + dur * 0.45);
  f.frequency.linearRampToValueAtTime(2600, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.20);
  g.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + dur * 0.58);
  g.gain.exponentialRampToValueAtTime(gain * 0.95, t0 + dur * 0.80);
  // 一直铺到卷末才收，末段不提前淡出——留给混响去做余韵
  g.gain.setValueAtTime(gain * 0.95, t0 + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.15);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.20);
}

export default {
  gain: 1.06,
  legato: 0.98,     // 连绵：时值尽量铺满，点与点之间不留断口
  bassLen: 1.00,
  chordOct: -1,
  chordLen: 0.96,

  // ---- 主旋律：古琴 ----
  // 音头 = 拨弦（指甲触弦的噪声 + 泛音各自衰减）
  // 音尾 = 0.06s 后叠一个弱正弦，做「吟猱」的余韵，把点连成线
  lead(ctx, io, t, freq, dur, vel, bar) {
    S.pluck(ctx, io.out, t, {
      freq,
      dur: dur * 2.2 + 0.55,          // 低弦长鸣：泛音按 damp 递减
      gain: 0.26 * vel,
      partials: 8, bright: 1.5, damp: 0.75,
      noiseAtk: 0.15, body: 1600,
      bend: bar === 1 ? 0.28 : 0.16,  // 高光小节上滑更明显（进复/退复）
    });
    // 收束小节（bar 2）是长音：余韵再拖长一截，让这条线真正连绵到卷末
    const last = bar === 2;
    S.tone(ctx, io.out, t + 0.06, {
      freq, dur: last ? dur * 1.42 : Math.max(0.18, dur * 1.15),
      type: 'sine', gain: 0.085 * vel,
      a: 0.06, d: 0.10, s: last ? 0.68 : 0.55, r: last ? 0.50 : 0.20,
      vib: { rate: 4.6, depth: 2.2 },
    });
  },

  // ---- 低音：古琴低弦（拨弦 + 正弦托底）----
  // gain 合计约为 lead 的 54%，保证主旋律始终在最上层
  bass(ctx, io, t, freq, dur, vel) {
    S.pluck(ctx, io.out, t, {
      freq, dur: dur * 1.25, gain: 0.115 * vel,
      partials: 6, bright: 1.9, damp: 0.9,
      noiseAtk: 0.10, body: 820,
    });
    S.tone(ctx, io.out, t + 0.03, {
      freq, dur: dur * 0.9, type: 'sine', gain: 0.035 * vel,
      a: 0.09, d: 0.18, s: 0.60, r: 0.24,
    });
  },

  // ---- 和声：笙（3 个音，各自 ±6 音分失谐，慢起，低通 1200）----
  chord(ctx, io, t, freqs, dur, vel) {
    const pick = freqs.slice(0, 3);
    for (let k = 0; k < pick.length; k++) {
      for (const det of [-6, 6]) {
        S.tone(ctx, io.out, t + k * 0.012, {
          freq: pick[k], dur: dur * 0.9, type: 'sawtooth', gain: 0.030 * vel, detune: det,
          a: 0.08, d: 0.25, s: 0.72, r: 0.42,   // 笙：慢起也慢收
          filter: { type: 'lowpass', freq: 1200, q: 0.7 },
        });
      }
    }
  },

  // ---- 打击：只有拍板（木），落板 / 落眼；高光小节加一记云锣 ----
  perc(ctx, io, t, bar, vel) {
    const B = 0.5;
    const HITS = [
      [[0, 0.17], [2, 0.10]],   // 进场：一板一眼
      [[0, 0.20], [2, 0.13]],   // 高光：加重
      [[0, 0.15]],              // 驶出：收，只留一板
    ];
    for (const [b, g] of (HITS[bar] || HITS[0])) {
      S.drum(ctx, io.out, t + b * B, { kind: 'woodblock', gain: g * vel, freq: 1100, dur: 0.07 });
    }
    if (bar === 1) {
      // 云锣：非整数比 FM，一点点金属，不铺满
      S.fm(ctx, io.out, t + 2 * B, {
        freq: 1180, dur: 0.8, gain: 0.060 * vel, ratio: 3.02, index: 3.2, decay: 0.5, bright: 6000,
      });
    }
  },

  // ---- 特色：卷轴摩擦 + 两三下极轻的木轴响 ----
  flavor(ctx, io, t0) {
    scrollFriction(ctx, io.out, t0, 6, 0.026);
    for (let k = 0; k < 3; k++) {
      const tt = t0 + 0.9 + k * 1.7 + prand(k * 4.3 + 1.7) * 0.55;
      S.drum(ctx, io.out, tt, {
        kind: 'woodblock', gain: 0.030 + prand(k * 7.9 + 2.1) * 0.022,
        freq: 820 + prand(k * 3.1 + 5.5) * 620,
      });
    }
  },
};
