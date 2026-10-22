// ============================================================
// a05-songshan.js — 第 5 格：宋代山水（约 1000）
// 音色：箫（长音）/ 古琴（短音点）+ 古琴低弦 + 极轻弓弦铺底
//       + 水滴 / 落石 + 六秒山风
// 美学：高远、留白、空气感 —— 全片最「空」的一格：
//       音符疏、织体薄，靠混响与气声撑出余韵。
// ============================================================

import S, { prand } from '../synth.js';

const BAR = 2.0;   // 120BPM / 4-4：一小节 2 秒

// ------------------------------------------------------------
// 局部辅助 1：山风
// 一段 6 秒的带通噪声，300Hz → 600Hz 线性缓慢上扫，
// 起落都用长斜坡，听感像山口的气流而不是「噪音音效」。
// ------------------------------------------------------------
function mountainWind(ctx, dest, t0, dur, gain = 0.05) {
  const src = ctx.createBufferSource();
  src.buffer = S.noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(300, t0);
  f.frequency.linearRampToValueAtTime(600, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.30);
  g.gain.setValueAtTime(gain, t0 + dur * 0.66);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0, prand(t0 * 1.7 + 3.1));
  src.stop(t0 + dur + 0.05);
  return g;
}

// ------------------------------------------------------------
// 局部辅助 2：远处的水滴 / 落石
// 极短的 FM 点击（非整数比 → 泛音不成谐音列，像水珠打在石面），
// 再叠一点高通噪声当作溅开的水花。
// ------------------------------------------------------------
function waterDrop(ctx, dest, t, gain, freq) {
  S.fm(ctx, dest, t, {
    freq, dur: 0.25, gain, ratio: 4.2, index: 3.2, decay: 0.32, bright: 5200, a: 0.002,
  });
  S.noise(ctx, dest, t, {
    dur: 0.05, gain: gain * 0.35, a: 0.001,
    filter: { type: 'highpass', freq: 4200, q: 0.7 },
  });
}

// ------------------------------------------------------------
// 局部辅助 3：和声只在高光小节（bar1）出现，靠调用时序判断
// chord() 每小节被调用一次，间隔恒为 BAR；因此用「与上一次的间隔」
// 还原出小节序号，bar0 / bar2 直接留白。
// ------------------------------------------------------------
let chordSeq = -1;
let chordPrev = -1;
function chordBar(t) {
  chordSeq = (chordPrev >= 0 && Math.abs(t - chordPrev - BAR) < 1e-3) ? chordSeq + 1 : 0;
  chordPrev = t;
  return chordSeq % 3;
}

export default {
  gain: 0.65,      // 刻意的留白：整体压低，靠混响撑空间
  legato: 1.6,     // 时值拉长：箫要「一口气」
  bassLen: 1.15,   // 低弦余韵拖长

  // ---- 主旋律：箫（长音） / 古琴点（短音） ----
  lead(ctx, io, t, freq, dur, vel, bar) {
    if (dur >= 1.0) {
      // 长音：箫——慢起、气声很重、音色极暗、尾巴很长
      S.reed(ctx, io.out, t, {
        freq, dur: dur * 0.92, gain: 0.34 * vel, wave: 'sine',
        breath: 0.5, bite: 900, a: 0.12, s: 0.88, r: 0.35,
        vib: { rate: 4.6 + bar * 0.2, depth: 5 },
      });
      // 箫管极轻的八度泛音（只是空气感，不抢基频）
      S.tone(ctx, io.out, t + 0.02, {
        freq: freq * 2, dur: dur * 0.55, type: 'sine', gain: 0.05 * vel,
        a: 0.16, d: 0.20, s: 0.45, r: 0.30,
      });
    } else {
      // 短音：古琴轻轻一「点」，箫只留一层淡到几乎只剩气声的影子
      S.pluck(ctx, io.out, t, {
        freq, dur: Math.max(1.1, dur * 1.9), gain: 0.30 * vel,
        partials: 4, bright: 1.9, damp: 0.35, body: 1400, noiseAtk: 0.30, a: 0.005,
      });
      S.reed(ctx, io.out, t, {
        freq, dur: dur * 0.85, gain: 0.13 * vel, wave: 'sine',
        breath: 0.6, bite: 760, a: 0.09, s: 0.80, r: 0.28,
        vib: { rate: 4.4, depth: 4 },
      });
    }
  },

  // ---- 低音：古琴低弦，每小节一次，余韵拖长 ----
  bass(ctx, io, t, freq, dur, vel) {
    S.pluck(ctx, io.out, t, {
      freq, dur: dur * 1.15, gain: 0.085 * vel,
      partials: 4, bright: 2.0, damp: 0.9, body: 900, noiseAtk: 0.22, a: 0.006,
    });
  },

  // ---- 和声：留白。只在 bar1 给一次极轻的两音铺底 ----
  chord(ctx, io, t, freqs, dur, vel) {
    if (chordBar(t) !== 1) return;
    const pick = [freqs[0], freqs[freqs.length - 1]];
    for (let k = 0; k < pick.length; k++) {
      S.bow(ctx, io.out, t + k * 0.18, {
        freq: pick[k], dur: dur * 0.85, gain: 0.03 * vel, wave: 'triangle',
        bright: 800, scratch: 0.05, a: 0.30, s: 0.90, r: 0.50,
        vib: { rate: 3.6, depth: 3 },
      });
    }
  },

  // ---- 打击：几乎无。只有两声水滴，位置用 prand 散布 ----
  perc(ctx, io, t, bar, vel) {
    if (bar === 1) return;                       // 高光小节留给箫，不加点击
    const off = 0.35 + prand(bar * 17.3 + 4.1) * 1.15;
    S.drum(ctx, io.out, t + off, {
      kind: 'rim', gain: 0.055 * vel, freq: 3000, body: 1500,
    });
  },

  // ---- 版块特色：六秒山风 + 三声远处水滴 / 落石 ----
  flavor(ctx, io, t0, index) {
    mountainWind(ctx, io.out, t0, 6.0, 0.04);
    for (let k = 0; k < 3; k++) {
      const tt = t0 + 0.9 + k * 1.7 + prand(k * 7.3 + index * 2.1) * 0.6;
      waterDrop(ctx, io.out, tt, 0.028 + prand(k * 3.1 + 5.5) * 0.010,
        1500 + prand(k * 5.7 + 1.3) * 900);
    }
  },
};
