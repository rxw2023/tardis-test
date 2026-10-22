// ============================================================
// a09-bada.js — 第 9 格：八大山人写意（约 1690）
// 一只鸟、一块石、几笔枯墨 —— 全片第二「空」的一格。
// 乐器只有：枯古琴（拨后不留余韵）、极低的一声散音、木鱼、纸面空白噪声、远处孤鸟。
// 没有和声（chord 刻意不发声），bar1 没有低音（留白）。
// ============================================================

import S, { prand } from '../synth.js';

// 局部辅助：极轻的「空白」噪声（宣纸/空气），缓慢起伏，没有音高
function blankAir(ctx, dest, t0, dur, gain = 0.02) {
  const src = ctx.createBufferSource();
  src.buffer = S.noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 800;
  f.Q.value = 0.6;
  f.frequency.setValueAtTime(800, t0);
  f.frequency.linearRampToValueAtTime(620, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.32);
  g.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + dur * 0.58);
  g.gain.exponentialRampToValueAtTime(gain * 0.85, t0 + dur * 0.80);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.5);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.6);
  return g;
}

export default {
  gain: 1.0,
  legato: 0.80,     // 短于拍长：每个音之后立刻留白
  bassLen: 0.26,    // 低音只点一下就收，不铺底
  bassOct: -2,      // 与 octave(-1) 叠加 → 极低的一声散音

  // 枯古琴：泛音少、衰减快、拨弦噪声明显，之后什么都不留
  lead(ctx, io, t, freq, dur, vel) {
    S.pluck(ctx, io.out, t, {
      freq,
      dur: Math.max(0.20, dur * 1.15),
      gain: 0.54 * vel,
      partials: 5,
      bright: 2.2,
      damp: 0.85,
      body: 1100,
      noiseAtk: 0.45,
    });
  },

  // 低音：只在 bar0 / bar2 的小节头给一次极低的散音；bar1 完全不响
  // （引擎不传 bar 给 bass，用 io 上每版块独立的计数器推出来）
  bass(ctx, io, t, freq, dur, vel) {
    const bar = io._bassBar || 0;
    io._bassBar = bar + 1;
    if (bar === 1) return;
    S.pluck(ctx, io.out, t, {
      freq,
      dur: Math.max(0.22, dur * 0.9),
      gain: 0.09 * vel,
      partials: 3,
      bright: 2.6,
      damp: 1.0,
      body: 600,
      noiseAtk: 0.25,
    });
  },

  // 这一格刻意没有和声
  chord() {
    return;
  },

  // 木鱼：全版块共 4 下，落在拍与拍之间的怪位置，极轻
  perc(ctx, io, t, bar, vel) {
    const COUNT = [2, 1, 1][bar] || 1;
    for (let k = 0; k < COUNT; k++) {
      const seed = bar * 7.3 + k * 3.1 + 0.7;
      // 两个「非正拍」落点区间：0.36~0.64 拍、1.14~1.42 拍
      const slot = prand(seed) < 0.5 ? 0.36 : 1.14;
      const beat = slot + prand(seed * 1.7) * 0.28;
      S.drum(ctx, io.out, t + beat * 0.5, {
        kind: 'woodblock',
        freq: 620,
        gain: (0.06 + prand(seed * 2.3) * 0.03) * vel,
      });
    }
  },

  // 纸面空白噪声（贯穿全版块）+ 一次远处的孤鸟
  flavor(ctx, io, t0) {
    io._bassBar = 0;
    blankAir(ctx, io.out, t0, 7.0, 0.022);

    // 孤鸟：一声短下滑，落在 bar1 的留白里
    const bt = t0 + 2.85 + prand(11.3) * 0.5;
    S.tone(ctx, io.out, bt, {
      freq: 1720, slideTo: 1210, dur: 0.20, type: 'sine', gain: 0.035,
      a: 0.018, d: 0.07, s: 0.30, r: 0.12,
    });
  },
};
