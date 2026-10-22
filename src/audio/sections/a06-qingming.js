// ============================================================
// a06-qingming.js — 第 6 格：清明上河图（约 1100）
// 汴京市井：琵琶（轮指）+ 三弦低音 + 笙管短和音 + 竹板/小鼓
//           + 街市底噪 / 人声嗡鸣 / 叫卖滑音 / 车马辘辘
// 全片最「闹」的一格，但主题始终在最上层
// ============================================================

import S, { prand } from '../synth.js';

const PENT = [0, 2, 4, 7, 9];   // 五声宫调（半音，相对主音）
const GAP = 0.055;              // 轮指间隔

// 琵琶基本音色
function pipa(ctx, dest, t, freq, dur, gain, bend = 0) {
  return S.pluck(ctx, dest, t, {
    freq, dur, gain, bend,
    partials: 9, bright: 1.0, damp: 0.5, noiseAtk: 0.4, body: 3000,
  });
}

// 轮指：起手 4~6 个间隔 0.055s 的密拨，其后用稀疏的续拨把长音托住
function lunzhi(ctx, dest, t, freq, dur, gain) {
  const reps = Math.max(4, Math.min(6, Math.round(dur / 0.22)));
  for (let k = 0; k < reps; k++) {
    pipa(ctx, dest, t + k * GAP, freq, 0.30 + dur * 0.16, gain * (1 - k * 0.05));
  }
  const end = dur * 1.55;                    // 续拨把长音托到音符时值的 1.55 倍
  for (let tt = 0.30; tt < end; tt += 0.19) {
    pipa(ctx, dest, t + tt, freq, 0.42, gain * 1.30 * (1 - 0.35 * (tt / end)));
  }
}

// 市井长噪音：缓慢起伏的一大片背景（bandpass 噪声）
function crowd(ctx, dest, t, dur, gain, lo, hi, seed) {
  S.noise(ctx, dest, t, {
    dur, gain, env: true,
    a: 0.8 + prand(seed) * 0.6, d: dur * 0.25, s: 0.74, r: 0.55,
    filter: { type: 'bandpass', freq: lo, q: 0.55 },
    sweepTo: hi,
  });
}

export default {
  gain: 1.36,
  legato: 0.98,
  bassLen: 0.90,
  chordLen: 0.50,   // 笙管的和音很短促，不压主题
  chordOct: -1,

  // 琵琶：亮而干的拨弦；长音走轮指
  lead(ctx, io, t, freq, dur, vel, bar) {
    const g = 0.50 * vel;
    pipa(ctx, io.out, t, freq, Math.max(0.60, dur * 1.6), g, dur > 1.0 ? 0.4 : 0);
    if (dur >= 0.85) {
      lunzhi(ctx, io.out, t, freq, dur, g * 0.35);
    } else {
      // 弹挑：短音补一下，市井里手不停
      pipa(ctx, io.out, t + 0.065, freq, Math.max(0.35, dur), g * 0.22);
    }
    // 指甲触弦的一点清脆余韵
    S.tone(ctx, io.out, t + 0.01, {
      freq: freq * 2, dur: Math.min(0.45, dur * 0.6), type: 'triangle', gain: 0.070 * vel,
      a: 0.006, d: 0.10, s: 0.20, r: 0.16,
    });
  },

  // 低音琵琶 / 三弦：每小节一声，音量压在主题的 60% 以内
  bass(ctx, io, t, freq, dur, vel) {
    S.pluck(ctx, io.out, t, {
      freq, dur: dur * 0.45, gain: 0.22 * vel,
      partials: 5, bright: 1.6, damp: 0.8, noiseAtk: 0.3, body: 1200,
    });
    S.sub(ctx, io.out, t, { freq, dur: dur * 0.34, gain: 0.040 * vel, wave: 'sine', bright: 380 });
  },

  // 笙管合奏：两三支管子互失谐，短促一撮
  chord(ctx, io, t, freqs, dur, vel) {
    if (!freqs || !freqs.length) return;
    const root = freqs[0];
    const fifth = freqs.length >= 3 ? freqs[2] : freqs[freqs.length - 1];
    const spec = [[root, -8], [root, 9], [fifth, 5]];
    for (const [f, det] of spec) {
      S.tone(ctx, io.out, t, {
        freq: f, dur: dur * 0.98, type: 'sawtooth', gain: 0.075 * vel, detune: det,
        a: 0.04, d: 0.18, s: 0.55, r: 0.14,
        filter: { type: 'lowpass', freq: 1600, q: 0.8 },
        vib: { rate: 5.4, depth: 4 },
      });
    }
  },

  // 打击：竹板走八分网格 + 小鼓在强拍
  perc(ctx, io, t, bar, vel) {
    const E = 0.25, B = 0.5;
    const PAT = [
      [2, 1, 1, 1, 2, 1, 1, 1],   // 进场：steady 板
      [2, 1, 2, 1, 2, 2, 2, 1],   // 高光：更密
      [2, 1, 0, 1, 1, 0, 1, 0],   // 驶出：渐收
    ];
    const pat = PAT[bar] || PAT[0];
    for (let k = 0; k < 8; k++) {
      const v = pat[k];
      if (!v) continue;
      const tt = t + k * E + (prand(bar * 17 + k) - 0.5) * 0.008;
      let g = (v === 2 ? 0.240 : 0.140) * vel;
      if (bar === 2) g *= Math.max(0.35, 1 - k * 0.075);
      S.drum(ctx, io.out, tt, {
        kind: 'woodblock', gain: g,
        freq: 1300 + (v === 2 ? 60 : 0) + prand(bar * 31 + k) * 70,
      });
      // 沙锤似的市井碎响，垫在板点之间
      if (k % 2 === 1) {
        S.drum(ctx, io.out, t + k * E + E * 0.5, {
          kind: 'shaker', gain: (bar === 2 ? 0.055 : 0.085) * vel, freq: 4800,
        });
      }
    }
    // 高光：板点加密到十六分 + 拍手
    if (bar === 1) {
      for (let k = 4; k < 8; k++) {
        S.drum(ctx, io.out, t + k * E + E * 0.5, {
          kind: 'woodblock', gain: 0.088 * vel, freq: 1180,
        });
      }
      S.drum(ctx, io.out, t + 2 * B, { kind: 'clap', gain: 0.30 * vel });
      S.drum(ctx, io.out, t + 3 * B + E, { kind: 'clap', gain: 0.20 * vel });
    }
    // 小鼓：强拍
    const tomG = [0.52, 0.58, 0.30][bar] ?? 0.40;
    S.drum(ctx, io.out, t, {
      kind: 'tom', gain: tomG * vel, dur: 0.30, from: 220, to: 140,
    });
    if (bar !== 2) {
      S.drum(ctx, io.out, t + 2 * B, {
        kind: 'tom', gain: tomG * 0.65 * vel, dur: 0.24, from: 200, to: 132,
      });
    }
  },

  // 汴京街市：底噪 + 人声嗡鸣 + 三声叫卖 + 一次车马
  flavor(ctx, io, t0) {
    // 街市底噪（两层：近处人声带 + 远处嘈杂）
    crowd(ctx, io.out, t0, 5.8, 0.142, 520, 900, 1.7);
    crowd(ctx, io.out, t0 + 0.3, 5.4, 0.065, 1300, 2100, 4.2);
    // 人流 / 车马的低频轰隆（只在中低频，不挡主题）
    S.noise(ctx, io.out, t0, {
      dur: 5.8, gain: 0.100, env: true,
      a: 1.0, d: 1.4, s: 0.78, r: 0.6,
      filter: { type: 'lowpass', freq: 210, q: 0.7 },
    });
    // 离场时街道的余音（很轻，收在版块内，不渗进下一格）
    S.noise(ctx, io.out, t0 + 5.2, {
      dur: 0.5, gain: 0.100, env: true,
      a: 0.10, d: 0.10, s: 0.80, r: 0.20,
      filter: { type: 'bandpass', freq: 700, q: 0.5 },
    });

    // 隐约的人声嗡鸣（两个人，五声音阶内随机音高）
    for (let k = 0; k < 2; k++) {
      const s = PENT[Math.floor(prand(k * 7.3 + 2.1) * PENT.length) % PENT.length];
      S.bow(ctx, io.out, t0 + 0.2 + k * 2.7, {
        freq: 220 * Math.pow(2, s / 12), dur: k ? 3.2 : 5.6,
        gain: 0.016, wave: 'triangle', bright: 700,
        a: 0.9, s: 0.9, r: 0.8, scratch: 0.03,
        vib: { rate: 4.2 + k * 0.6, depth: 5 },
      });
    }

    // 叫卖：三声「上挑—落下」的短滑音
    const CALLS = [0.85, 2.65, 4.55];
    for (let k = 0; k < 3; k++) {
      const base = 300 + prand(k * 5.7 + 1.1) * 90;
      const tt = t0 + CALLS[k] + prand(k * 3.3 + 0.7) * 0.20;
      S.tone(ctx, io.out, tt, {
        freq: base, dur: 0.20, type: 'sawtooth', gain: 0.108,
        a: 0.035, d: 0.05, s: 0.75, r: 0.08, slideTo: base * 1.5,
        filter: { type: 'lowpass', freq: 1800, q: 0.9 },
      });
      S.tone(ctx, io.out, tt + 0.20, {
        freq: base * 1.5, dur: 0.34, type: 'sawtooth', gain: 0.094,
        a: 0.025, d: 0.08, s: 0.60, r: 0.14, slideTo: base * 0.8,
        filter: { type: 'lowpass', freq: 1500, q: 0.9 },
      });
    }

    // 车马：一次低沉的辘辘声
    S.noise(ctx, io.out, t0 + 3.15, {
      dur: 1.1, gain: 0.078, env: true,
      a: 0.35, d: 0.30, s: 0.70, r: 0.45,
      filter: { type: 'lowpass', freq: 280, q: 0.8 },
    });
  },
};
