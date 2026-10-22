// ============================================================
// a12-starrynight.js — 第 12 格：星月夜（1889）
// 后印象派：旋转的笔触 = 连绵的弦乐 + 竖琴琶音 + 钢片琴的星光
// 没有明确的鼓，律动靠定音鼓的小节头与弦乐起伏推
// ============================================================

import S, { prand } from '../synth.js';

// 半音（相对 A4）→ Hz
const hz = (s) => 440 * Math.pow(2, s / 12);

// ------------------------------------------------------------
// 局部辅助 1：带 detune 的弓弦声部
// S.bow 不接受 detune，弦乐群铺底需要左右失谐，这里用 S.tone 同构实现
// ------------------------------------------------------------
function bowDetune(ctx, dest, t, o) {
  const { freq, dur, gain, detune = 0, bright = 1500, a = 0.22, s = 0.88, r = 0.3 } = o;
  S.tone(ctx, dest, t, {
    freq, dur, type: 'sawtooth', gain, detune,
    a, d: 0.14, s, r,
    filter: { type: 'lowpass', freq: bright, q: 0.8 },
    vib: o.vib || { rate: 4.5, depth: 4 },
  });
  if (o.scratch) {
    S.noise(ctx, dest, t, {
      dur, gain: gain * o.scratch, env: true, peak: gain * o.scratch,
      a, d: 0.22, s: 0.35, r: 0.28,
      filter: { type: 'bandpass', freq: freq * 3, q: 1.3 },
    });
  }
}

// ------------------------------------------------------------
// 局部辅助 2：夜风（6 秒带通噪声，缓慢起伏）
// ------------------------------------------------------------
function nightWind(ctx, dest, t0, dur, peak) {
  const src = ctx.createBufferSource();
  src.buffer = S.noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(400, t0);
  f.frequency.linearRampToValueAtTime(900, t0 + dur * 0.45);
  f.frequency.linearRampToValueAtTime(520, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.30);
  g.gain.exponentialRampToValueAtTime(peak * 0.45, t0 + dur * 0.62);
  g.gain.exponentialRampToValueAtTime(peak * 0.9, t0 + dur * 0.84);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.3);
  src.connect(f).connect(g).connect(dest);
  src.start(t0, prand(t0 * 3.1 + 5.7) * 1.2);
  src.stop(t0 + dur + 0.35);
}

export default {
  gain: 0.94,
  legato: 0.98,     // 独奏小提琴：拉满，连成一笔
  bassLen: 1.0,     // 低音提琴长弓，一小节一次拉满
  chordOct: -1,
  chordLen: 0.98,

  // 主音：独奏小提琴（锯齿弓弦 + 一层三角波柔光）
  lead(ctx, io, t, freq, dur, vel, bar) {
    const d = Math.max(0.22, dur * 0.98);
    const a = d < 0.36 ? 0.055 : 0.09;   // 短音符（八分）起弓快一点
    S.bow(ctx, io.out, t, {
      freq, dur: d, gain: 0.38 * vel, wave: 'sawtooth', bright: 2600,
      scratch: 0.08, a, s: 0.90, r: 0.26,
      vib: { rate: 5.4 + bar * 0.2, depth: 7 },
    });
    S.tone(ctx, io.out, t, {
      freq, dur: d * 0.95, type: 'triangle', gain: 0.062 * vel,
      a: 0.14, d: 0.20, s: 0.72, r: 0.30,
    });
  },

  // 低音：低音提琴长弓，慢起、时值拉满（音量不超过 lead 的 60%）
  bass(ctx, io, t, freq, dur, vel) {
    S.bow(ctx, io.out, t, {
      freq, dur: dur * 0.99, gain: 0.15 * vel, wave: 'sawtooth', bright: 500,
      scratch: 0.05, a: 0.20, s: 0.92, r: 0.34,
      vib: { rate: 3.2, depth: 3 },
    });
  },

  // 和声：弦乐群铺底，每音两把失谐的琴，起弓很慢
  chord(ctx, io, t, freqs, dur, vel) {
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i];
      for (const det of [-7, 7]) {
        bowDetune(ctx, io.out, t + i * 0.05, {
          freq: f, dur: dur * 0.97, gain: 0.034 * vel, detune: det,
          bright: 1500, a: 0.22, s: 0.88, r: 0.34,
          vib: { rate: 4.3 + i * 0.25, depth: 4.5 },
        });
      }
    }
  },

  // 打击：定音鼓落在小节头（高光小节加一记）+ 钢片琴的星光
  perc(ctx, io, t, bar, vel, info) {
    S.drum(ctx, io.out, t, {
      kind: 'tom', gain: 0.36 * vel, dur: 0.7, from: 105, to: 58,
    });
    if (bar === 1) {
      S.drum(ctx, io.out, t + 1.0, {
        kind: 'tom', gain: 0.28 * vel, dur: 0.62, from: 118, to: 66,
      });
    }

    // 星光：该小节和弦音的高八度
    const root = (info && info.root) || 110;
    const base = root * 4;
    const n = [3, 4, 4][bar] || 3;
    const TONES = [0, 4, 7, 12];
    for (let k = 0; k < n; k++) {
      const seed = bar * 17 + k * 3.1;
      const off = TONES[Math.min(TONES.length - 1, Math.floor(prand(seed) * TONES.length))];
      const tt = t + 0.28 + k * 0.5 + prand(seed + 0.77) * 0.22;
      S.fm(ctx, io.out, tt, {
        freq: base * Math.pow(2, off / 12), dur: 0.9,
        gain: 0.045 * vel, ratio: 3.02, index: 2.4, decay: 0.6, bright: 6500,
      });
    }
  },

  // 版块特色：高光小节开头的竖琴上行琶音 + 贯穿的夜风
  flavor(ctx, io, t0) {
    const ARP = [-5, 2, 7, 11, 14, 19, 23, 26];
    for (let k = 0; k < ARP.length; k++) {
      S.pluck(ctx, io.out, t0 + 2.0 + k * 0.07, {
        freq: hz(ARP[k]), dur: 1.5 - k * 0.06, gain: 0.05 - k * 0.003,
        partials: 6, bright: 1.6, damp: 0.62, noiseAtk: 0.22, body: 3000,
      });
    }
    nightWind(ctx, io.out, t0 - 0.15, 6.5, 0.035);
  },
};
