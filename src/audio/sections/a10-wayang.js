// ============================================================
// a10-wayang.js — 第 10 格：爪哇皮影（约 1800）
// 音色：甘美兰 —— saron 铜排琴（主旋律）/ 低音排琴 + 大锣低端（低音）/
//       bonang 釜锣滚奏（和声点缀）/ kendang 鼓 + 小钹（节奏）/
//       gong ageng 句尾大锣 + 竹影幕布噪声（特色）
// 全片最「金属」的一格：一切声音都是敲出来的，没有长音包络。
// ============================================================

import S, { prand } from '../synth.js';

// 三小节的和声点缀是「依次落下」的滚奏，需要知道自己在第几小节。
// chord() 的签名里没有 bar，但引擎对每个版块固定按 0/1/2 各调一次，
// 因此用一个计数器取模即可（每次渲染都是 3 的倍数，渲染之间不会错位）。
let _chordTick = 0;

export default {
  gain: 1.05,
  legato: 1.0,      // 一锤一音，但长音让它把余韵拖满自己的时值

  // ---------------- 主旋律：saron 铜排琴 ----------------
  // 非整数比 FM 出金属泛音；基频另补一层正弦，保证主题音高不被边频埋掉
  lead(ctx, io, t, freq, dur, vel, bar) {
    // 不论长短音符都是「敲一下」，但金属排琴余韵很长：
    // 让长音的尾音盖过主题的休止区，避免休止处只剩鼓声成为最强峰
    const d = Math.min(2.3, Math.max(0.90, dur + 0.85));

    S.fm(ctx, io.out, t, {
      freq, dur: d, gain: 0.36 * vel, ratio: 3.1, index: 4.2, decay: 0.40, bright: 5200,
    });
    // 排琴的「键体」：基频正弦，敲响后拖住一段余韵（金属谱峰很散，靠它把音高钉住）
    S.tone(ctx, io.out, t, {
      freq, dur: d * 0.95, type: 'sine', gain: 0.21 * vel,
      a: 0.002, d: 0.16, s: 0.42, r: 0.26,
    });
    // 上方八度的一层薄铜片（高光小节更亮一点）
    S.fm(ctx, io.out, t + 0.006, {
      freq: freq * 2, dur: d * 0.45, gain: (bar === 1 ? 0.070 : 0.052) * vel,
      ratio: 2.4, index: 3.0, decay: 0.28, bright: 6400,
    });
    // 木槌击打铜键的瞬态
    S.noise(ctx, io.out, t, {
      dur: 0.028, gain: 0.05 * vel, a: 0.001,
      filter: { type: 'bandpass', freq: Math.min(freq * 5, 7000), q: 1.2 },
    });
  },

  // ---------------- 低音：低音排琴 + 大锣的低端 ----------------
  bass(ctx, io, t, freq, dur, vel) {
    S.fm(ctx, io.out, t, {
      freq, dur: 1.6, gain: 0.13 * vel, ratio: 2.2, index: 2.6, decay: 0.55, bright: 1800,
    });
    S.sub(ctx, io.out, t, { freq, dur: 1.5, gain: 0.06 * vel, wave: 'sine', bright: 420 });
  },

  // ---------------- 和声：bonang 釜锣滚奏 ----------------
  // 不给和弦长音，只在高光小节撒 6 个依次落下的短音，其余小节减半
  chord(ctx, io, t, freqs, dur, vel) {
    const bar = _chordTick++ % 3;
    const n = bar === 1 ? 6 : 3;
    const src = freqs && freqs.length ? freqs : [220];
    for (let k = 0; k < n; k++) {
      const f = src[k % src.length] * (k >= src.length ? 2 : 1);
      S.fm(ctx, io.out, t + k * 0.09, {
        freq: f, dur: 0.30, gain: 0.035 * vel,
        ratio: 4.4, index: 3.2, decay: 0.45, bright: 7000,
      });
    }
  },

  // ---------------- 打击：kendang 鼓 + 小钹 ----------------
  // 鼓点写成「拍位, 音色」：1 = 低音 tung（掌心），2 = 高音 tak（指尖）
  perc(ctx, io, t, bar, vel) {
    const B = 0.5;
    const KENDANG = [
      [[0, 1], [1.0, 2], [1.5, 2], [2.0, 1], [2.5, 2], [3.0, 1]],              // 进场：六声，稳（主题长音留白处由鼓补拍）
      [[0, 1], [0.75, 2], [1.0, 1], [1.75, 2], [2.0, 1], [2.5, 2], [3.0, 1], [3.5, 2]], // 高光：八声，密
      [[0, 1], [1.0, 2], [1.5, 1], [2.5, 2], [3.0, 1]],                          // 驶出：五声，收
    ];
    const pat = KENDANG[bar] || KENDANG[0];
    for (let k = 0; k < pat.length; k++) {
      const [beat, tone] = pat[k];
      const jitter = (prand(bar * 7.3 + k * 2.1) - 0.5) * 0.010;
      if (tone === 1) {
        S.drum(ctx, io.out, t + beat * B + jitter, {
          kind: 'tom', gain: 0.34 * vel, dur: 0.36, from: 175, to: 82,
        });
      } else {
        S.drum(ctx, io.out, t + beat * B + jitter, {
          kind: 'tom', gain: 0.21 * vel, dur: 0.20, from: 268, to: 148,
        });
      }
    }

    // 小钹：八分（高光小节加密到十六分），重音在正拍
    const dense = bar === 1;
    const step = dense ? 0.125 : 0.25;
    const n = dense ? 16 : 8;
    for (let k = 0; k < n; k++) {
      const acc = (k % (dense ? 4 : 2)) === 0 ? 1.0 : 0.55;
      S.noise(ctx, io.out, t + k * step, {
        dur: 0.08, gain: 0.055 * acc * vel, a: 0.001,
        filter: { type: 'highpass', freq: 5000, q: 0.7 },
      });
    }
  },

  // ---------------- 特色：句尾大锣 + 竹影幕布 ----------------
  flavor(ctx, io, t0) {
    // 最后一小节末尾落下 gong ageng，余韵拖到出框
    S.drum(ctx, io.out, t0 + 5.4, {
      kind: 'gong', freq: 72, dur: 2.2, gain: 0.16, ratio: 2.7, index: 6, bright: 2400,
    });

    // 皮影在幕布后晃动的极轻竹影噪声（全程 6 秒）
    const src = ctx.createBufferSource();
    src.buffer = S.noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(2600, t0);
    f.frequency.linearRampToValueAtTime(3300, t0 + 3.0);
    f.frequency.linearRampToValueAtTime(2800, t0 + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.028, t0 + 1.2);
    g.gain.setValueAtTime(0.028, t0 + 4.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6);
    src.connect(f).connect(g).connect(io.out);
    src.start(t0); src.stop(t0 + 6.05);
  },
};
