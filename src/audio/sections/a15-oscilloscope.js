// ============================================================
// a15-oscilloscope.js — 第 15 格：示波器（1950s）
// 音色：正弦测试音 / 方波低频 / 环形调制和音 / 噪声示波 / 扫描线
// 纯电子实验室：没有任何声学乐器，全部由振荡器与噪声合成
// 主题小节：bar6(C5-D5-E5) → bar7(A4 长音) → bar8(E5-F5-G5-A5-G5-E5)
// ============================================================

import S, { prand } from '../synth.js';

// 示波器扫描亮点：极短的高通噪声"沙"点（局部辅助，不进 synth.js）
function scopeTick(ctx, dest, t, g) {
  S.noise(ctx, dest, t, {
    dur: 0.06, gain: g, a: 0.002, curve: 0.25,
    filter: { type: 'highpass', freq: 3000, q: 0.7 },
  });
}

// 校准滴声：短促的正弦"哔"（局部辅助）
function calBlip(ctx, dest, t, freq, g) {
  S.blip(ctx, dest, t, {
    freq, dur: 0.05, gain: g, wave: 'sine',
    a: 0.002, d: 0.012, s: 0.55, r: 0.03,
  });
}

export default {
  gain: 0.95,
  legato: 0.92,     // 测试音短促、颗粒清楚
  bassLen: 0.90,
  chordLen: 0.92,

  // 主音：正弦测试音 + 二次/三次谐波（示波器上看到的"干净波形"）
  lead(ctx, io, t, freq, dur, vel, bar) {
    S.blip(ctx, io.out, t, {
      freq, dur, gain: 0.26 * vel, wave: 'sine',
      a: 0.008, d: 0.05, s: 0.85, r: 0.08,
    });
    S.tone(ctx, io.out, t, {
      freq: freq * 2, dur: dur * 0.85, type: 'sine', gain: 0.05 * vel,
      a: 0.010, d: 0.05, s: 0.70, r: 0.07,
    });
    S.tone(ctx, io.out, t, {
      freq: freq * 3, dur: dur * 0.60, type: 'triangle', gain: 0.025 * vel,
      a: 0.012, d: 0.06, s: 0.55, r: 0.06,
    });
  },

  // 低频方波（duty 0.35，低通 500）—— 电源变压器的"方波校准"底
  bass(ctx, io, t, freq, dur, vel) {
    S.blip(ctx, io.out, t, {
      freq, dur: dur * 0.88, gain: 0.12 * vel, wave: 'square', duty: 0.35,
      a: 0.01, d: 0.04, s: 0.88, r: 0.06,
      filter: { type: 'lowpass', freq: 500, q: 0.8 },
    });
    S.tone(ctx, io.out, t, {
      freq, dur: dur * 0.92, type: 'sine', gain: 0.03 * vel,
      a: 0.02, d: 0.06, s: 0.85, r: 0.10,
    });
  },

  // 和声：环形调制感（每个音叠一个纯五度上的 1.5 倍分音），慢起、不成厚墙
  chord(ctx, io, t, freqs, dur, vel) {
    for (const f of freqs) {
      S.tone(ctx, io.out, t, {
        freq: f, dur: dur * 0.95, type: 'sine', gain: 0.03 * vel,
        a: 0.06, d: 0.10, s: 0.75, r: 0.16,
      });
      S.tone(ctx, io.out, t, {
        freq: f * 1.5, dur: dur * 0.80, type: 'sine', gain: 0.02 * vel,
        a: 0.06, d: 0.12, s: 0.60, r: 0.16,
      });
    }
  },

  // 打击：十六分网格上的噪声示波 + 小节头校准 click
  perc(ctx, io, t, bar, vel) {
    const E = 0.125;
    const PAT = [
      [1.0, 0.45, 0.70, 0.45, 1.0, 0.45, 0.70, 0.50,
       1.0, 0.45, 0.70, 0.45, 1.0, 0.50, 0.70, 0.45],
      [1.0, 0.60, 0.80, 0.60, 1.0, 0.60, 0.80, 0.60,
       1.0, 0.70, 0.85, 0.70, 1.0, 0.75, 0.90, 0.80],
      [1.0, 0.00, 0.70, 0.00, 1.0, 0.00, 0.60, 0.35,
       1.0, 0.00, 0.70, 0.00, 0.80, 0.50, 0.60, 0.40],
    ];
    const pat = PAT[bar] || PAT[0];
    for (let k = 0; k < 16; k++) {
      const w = pat[k];
      if (!w) continue;
      const jitter = (prand(bar * 17 + k * 3.1) - 0.5) * 0.006;
      scopeTick(ctx, io.out, t + k * E + jitter, 0.07 * w * vel);
    }

    // 小节头：2400Hz 校准滴
    S.drum(ctx, io.out, t, { kind: 'click', gain: 0.16 * vel, freq: 2400, body: 1600 });

    if (bar === 1) {
      // 高光：一串加速的 click（间隔按 0.74 递减，像扫描锁定）
      let tt = t + 1.0, dt = 0.18;
      for (let k = 0; k < 8; k++) {
        S.drum(ctx, io.out, tt, {
          kind: 'click', gain: (0.09 + k * 0.012) * vel,
          freq: 2400 + k * 160, body: 1200,
        });
        tt += dt;
        dt *= 0.74;
      }
    }
    if (bar === 2) {
      // 驶出：减速的两记收束滴声
      calBlip(ctx, io.out, t + 3.5 * 0.5, 1568, 0.07 * vel);
      calBlip(ctx, io.out, t + 3.5 * 0.5 + 0.22, 1046, 0.06 * vel);
    }
  },

  // 开机（0~0.5s）+ 每小节一次扫描线 + 贯穿全段的 50Hz 交流声
  flavor(ctx, io, t0) {
    // 开机：1000Hz 校准滴声 + 一段扫频噪声（电子管点亮）
    // 滴声收得很快，避免盖住 0.5s 处进入的 C5 主题音
    S.blip(ctx, io.out, t0 + 0.02, {
      freq: 1000, dur: 0.22, gain: 0.14, wave: 'sine',
      a: 0.004, d: 0.03, s: 0.55, r: 0.05,
    });
    S.noise(ctx, io.out, t0 + 0.01, {
      dur: 0.44, gain: 0.055, a: 0.02,
      filter: { type: 'bandpass', freq: 260, q: 1.1 },
      sweepTo: 5200,
    });

    // 扫描线：每小节一次，400 → 6000Hz 上扫
    for (let k = 0; k < 3; k++) {
      S.noise(ctx, io.out, t0 + k * 2, {
        dur: 0.5, gain: 0.05, a: 0.02,
        filter: { type: 'bandpass', freq: 400, q: 2.0 },
        sweepTo: 6000,
      });
    }

    // 驶出：一次下扫（扫描线回扫 / 收束）
    S.noise(ctx, io.out, t0 + 5.4, {
      dur: 0.55, gain: 0.045, a: 0.03,
      filter: { type: 'bandpass', freq: 5000, q: 1.8 },
      sweepTo: 300,
    });

    // 50Hz 交流声：贯穿全段的变压器底噪
    S.tone(ctx, io.out, t0, {
      freq: 50, dur: 6.4, gain: 0.012, type: 'sine',
      a: 0.25, d: 0.30, s: 0.90, r: 0.90,
    });
  },
};
