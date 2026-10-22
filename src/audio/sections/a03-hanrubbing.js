// ============================================================
// a03-hanrubbing.js — 第 3 格：汉画像石拓片（约 100）
// 画面是黑底白纹的拓片：金石、庄重、余韵长。
// 音色：编钟（非整数比 FM + 基频嗡鸣）+ 大钟低音 + 磬的稀疏点缀
//       + 建鼓 / 柷敔木响 / 石片相击 + 石室回声（gong + 低频气流）
// 织体：极稀疏、留白多，只在高光小节（bar1）略微加密。
// ============================================================

import S, { prand } from '../synth.js';

// ------------------------------------------------------------
// 局部辅助 1：编钟一击
// 金属部分交给非整数比 FM（ratio 3.4/2.76），音高交给正弦「嗡」音，
// 这样钟声有金石感，但谱峰仍落在基频上，主题听得清。
// ------------------------------------------------------------
function bianzhong(ctx, dest, t, freq, dur, gain, o = {}) {
  S.fm(ctx, dest, t, {
    freq,
    dur: Math.min(dur * 1.15, 2.0),
    gain: gain * 0.62,
    ratio: o.ratio ?? 3.4,
    index: o.index ?? 4.2,
    decay: o.decay ?? 0.55,
    bright: o.bright ?? 5200,
  });
  S.tone(ctx, dest, t, {
    freq, dur: dur * 1.25, type: 'sine', gain: gain * 0.38,
    a: 0.018, d: 0.30, s: 0.42, r: 0.42,
  });
}

// ------------------------------------------------------------
// 局部辅助 2：石室低频气流（6 秒，极轻）
// ------------------------------------------------------------
function caveRumble(ctx, dest, t0, dur = 6) {
  const src = ctx.createBufferSource();
  src.buffer = S.noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(150, t0);
  f.frequency.linearRampToValueAtTime(300, t0 + dur * 0.55);
  f.frequency.linearRampToValueAtTime(190, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.035, t0 + 1.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// 和声没有 bar 参数，用调用次序推：每版块固定 3 次 → 0/1/2 循环
let _chordBar = 0;

export default {
  gain: 1.0,
  legato: 1.0,     // 钟声要长，时值不打折
  bassLen: 0.9,
  bassOct: 0,      // 抵消 PRESET 的 octave -1，低音落在 C3/A3 一带
  chordOct: 0,     // 和声落在 C4/E4 一带（磬的音区再手动 ×2）

  // 主旋律：编钟
  lead(ctx, io, t, freq, dur, vel, bar) {
    const D = Math.max(dur, 0.85);
    bianzhong(ctx, io.out, t, freq, D, 0.48 * vel, {
      ratio: 3.4, index: 4.0 + bar * 0.35, bright: 4800 + bar * 400,
    });
    // 编钟的第二个振动模式：近八度的高音分音，很轻
    S.tone(ctx, io.out, t, {
      freq: freq * 2.004, dur: D * 0.6, type: 'sine', gain: 0.055 * vel,
      a: 0.012, d: 0.20, s: 0.20, r: 0.24,
    });
  },

  // 低音：大钟/镈的低音（不超过 lead 的 60%）
  bass(ctx, io, t, freq, dur, vel) {
    S.fm(ctx, io.out, t, {
      freq, dur: 1.25, gain: 0.115 * vel,
      ratio: 2.4, index: 3.2, decay: 0.5, bright: 900,
    });
    S.sub(ctx, io.out, t, {
      freq, dur: dur * 0.72, gain: 0.062 * vel, wave: 'sine', bright: 400,
      a: 0.02, s: 0.75, r: 0.28,
    });
  },

  // 和声：磬与编钟的稀疏点缀（bar1 高光给两声，其余只给一声）
  chord(ctx, io, t, freqs, dur, vel) {
    const bar = _chordBar++ % 3;
    const top = freqs[freqs.length - 1] * 2;      // 抬到磬的音区
    const low = freqs[0] * 2;
    const g = bar === 1 ? 0.05 : 0.032;
    S.fm(ctx, io.out, t, {
      freq: top, dur: 0.6, gain: g * vel, ratio: 2.76, index: 3.4, decay: 0.45, bright: 6400,
    });
    if (bar === 1) {
      S.fm(ctx, io.out, t + 0.16, {
        freq: low, dur: 0.6, gain: 0.05 * vel, ratio: 2.76, index: 3.4, decay: 0.45, bright: 5200,
      });
    }
  },

  // 打击：建鼓（tom）+ 柷敔木响（woodblock）+ 石片相击（rim）
  perc(ctx, io, t, bar, vel) {
    // 建鼓落小节头，三小节都在，力度随包络走
    S.drum(ctx, io.out, t, { kind: 'tom', gain: 0.24 * vel, dur: 0.5, from: 120, to: 55 });

    if (bar === 0) {
      S.drum(ctx, io.out, t + 1.0, { kind: 'woodblock', gain: 0.065 * vel, freq: 720 });
      S.drum(ctx, io.out, t + 1.75, { kind: 'rim', gain: 0.05 * vel, freq: 1800, body: 900 });
    } else if (bar === 1) {
      // 高光：第 3 拍再来一下建鼓，木响与石片填空
      S.drum(ctx, io.out, t + 0.5, { kind: 'woodblock', gain: 0.075 * vel, freq: 700 });
      S.drum(ctx, io.out, t + 1.0, { kind: 'tom', gain: 0.18 * vel, dur: 0.45, from: 112, to: 52 });
      S.drum(ctx, io.out, t + 1.5, { kind: 'rim', gain: 0.10 * vel, freq: 1800, body: 900 });
      S.drum(ctx, io.out, t + 1.75, { kind: 'rim', gain: 0.065 * vel, freq: 1720, body: 860 });
    } else {
      S.drum(ctx, io.out, t + 1.0, { kind: 'rim', gain: 0.07 * vel, freq: 1780, body: 880 });
      S.drum(ctx, io.out, t + 1.5, { kind: 'woodblock', gain: 0.055 * vel, freq: 680 });
    }
  },

  // 石室回声：三次零散的 gong + 一段极轻的低频气流
  flavor(ctx, io, t0) {
    caveRumble(ctx, io.out, t0, 6);
    const spots = [0.75, 2.65, 4.85];
    for (let k = 0; k < spots.length; k++) {
      const tt = t0 + spots[k] + prand(k * 4.3 + 1.7) * 0.5;
      S.drum(ctx, io.out, tt, {
        kind: 'gong', freq: 88 + prand(k * 7.1) * 26,
        dur: 1.2, gain: 0.06, bright: 2200,
      });
    }
  },
};
