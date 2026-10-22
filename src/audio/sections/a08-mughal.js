// ============================================================
// a08-mughal.js — 第 8 格：莫卧儿细密画（约 1600）
// 音色：西塔琴（pluck + 装饰音） / 坦普拉持续低音 / 共鸣弦嗡鸣
//       塔布拉鼓（bayan 低鼓 + dayan 高鼓） / 庭院空气 + 铃铛
// 音阶 bhairav（小二度 + 增四度），主题小节 9 / 10 / 11（B 段）
// ============================================================

import S, { prand } from '../synth.js';

// ---- 局部辅助：西塔琴的一声（共鸣箱 2200，余韵长） ----
function sitar(ctx, dest, t, freq, dur, gain, bright) {
  return S.pluck(ctx, dest, t, {
    freq,
    dur,
    gain,
    partials: 9,
    bright: bright ?? 1.1,
    damp: 0.45,      // 高次泛音衰减慢 → 余韵长
    bend: 0.5,       // 起音微上滑（meend）
    noiseAtk: 0.3,   // jawari 拨片噪声
    body: 2200,
  });
}

// ---- 局部辅助：装饰音（主音前的 2~3 个快速邻音，上行/下行） ----
// dir = +1 从上方下行落到主音，-1 从下方上行推到主音
function grace(ctx, dest, t, freq, mainGain, dir, seed) {
  const steps = [3, 2, 1];                       // 距主音的半音（由远及近）
  for (let k = 0; k < steps.length; k++) {
    const semi = dir * steps[k];
    const g = mainGain * (0.18 + k * 0.06);      // 越靠近主音越响
    sitar(ctx, dest, t - 0.13 + k * 0.038, freq * Math.pow(2, semi / 12), 0.20, g, 1.3);
  }
}

export default {
  gain: 1.06,
  legato: 0.92,     // 略短，给装饰音留出空间
  bassLen: 1.0,
  chordLen: 0.98,

  // 主音：西塔琴。长音（>=0.7s）前置一串装饰音——这一格的招牌
  lead(ctx, io, t, freq, dur, vel, bar, semis) {
    const g = 0.65 * vel;
    const ring = Math.max(1.10, Math.min(dur * 2.0, 2.6));   // 共鸣弦拖尾（西塔琴余韵很长）
    sitar(ctx, io.out, t, freq, ring, g);
    // 共鸣弦（taraf）的持续层：让音高在长音里一直站得住
    S.tone(ctx, io.out, t, {
      freq, dur: dur * 1.15, type: 'sine', gain: 0.17 * vel,
      a: 0.012, d: 0.22, s: 0.62, r: 0.25,
    });
    // 共鸣弦的第二层轻微失谐，制造细密画式的“描边”
    S.tone(ctx, io.out, t, {
      freq: freq * 2.002, dur: ring * 0.55, type: 'sine', gain: 0.035 * vel,
      a: 0.02, d: 0.18, s: 0.30, r: 0.22,
    });

    if (dur >= 0.7) {
      const seed = semis * 3.7 + bar * 11.3 + dur * 5.1;
      const dir = prand(seed) > 0.45 ? 1 : -1;
      grace(ctx, io.out, t, freq, g, dir, seed);
    }
  },

  // 低音：坦普拉——根音 + 五度的持续共鸣（每小节一次，时值拉满）
  bass(ctx, io, t, freq, dur, vel) {
    const d = dur * 0.99;
    S.tone(ctx, io.out, t, {
      freq, dur: d, type: 'sawtooth', gain: 0.032 * vel,
      a: 0.06, d: 0.20, s: 0.82, r: 0.26,
      filter: { type: 'lowpass', freq: 500, q: 0.8 },
      vib: { rate: 0.7, depth: 1.6 },
    });
    S.sub(ctx, io.out, t, { freq, dur: d, gain: 0.034 * vel, wave: 'sine', bright: 420, a: 0.05, s: 0.9, r: 0.24 });
    // 五度（坦普拉的持续音之一）
    S.tone(ctx, io.out, t + 0.04, {
      freq: freq * 1.5, dur: d * 0.96, type: 'triangle', gain: 0.022 * vel,
      a: 0.09, d: 0.22, s: 0.78, r: 0.26,
      filter: { type: 'lowpass', freq: 620, q: 0.7 },
    });
  },

  // 和声：西塔琴共鸣弦（taraf）的嗡鸣——三个互相失谐的锯齿
  chord(ctx, io, t, freqs, dur, vel) {
    const dets = [-5, 0, 5];
    for (let k = 0; k < 3; k++) {
      S.tone(ctx, io.out, t, {
        freq: freqs[k % freqs.length], dur: dur * 0.98, type: 'sawtooth',
        gain: 0.03 * vel, detune: dets[k],
        a: 0.10, d: 0.18, s: 0.80, r: 0.28,
        filter: { type: 'lowpass', freq: 1100, q: 0.7 },
      });
    }
  },

  // 打击：塔布拉（tintaal 简化）
  perc(ctx, io, t, bar, vel, info) {
    const B = 0.5, E = 0.25;
    const bayan = (tt, g) => S.drum(ctx, io.out, tt, { kind: 'tom', gain: g * vel, dur: 0.4, from: 150, to: 70 });
    const dayan = (tt, g) => S.drum(ctx, io.out, tt, { kind: 'rim', gain: g * vel, dur: 0.09, freq: 1900, body: 940 });

    if (bar === 0) {
      // 进场：四拍四个音（dha - ta - ta - dha 的骨架）
      bayan(t, 0.26);
      dayan(t + B, 0.15);
      dayan(t + 2 * B, 0.12);
      bayan(t + 3 * B, 0.20);
    } else if (bar === 1) {
      // 高光：八分网格 + 一串波音（快速连击）
      const pat = [1, 2, 2, 2, 1, 2, 2, 2];   // 1 = bayan，2 = dayan
      for (let k = 0; k < 8; k++) {
        const tt = t + k * E;
        const g = (k % 2 === 0) ? 0.20 : 0.13;
        if (pat[k] === 1) bayan(tt, g + 0.04); else dayan(tt, g);
      }
      // 波音：第 4 拍上的一串上行连击
      for (let k = 0; k < 6; k++) {
        dayan(t + 1.5 + k * 0.042, 0.07 + k * 0.018);
      }
      bayan(t + 1.5, 0.24);
      // 八度上翻的一记亮音
      S.drum(ctx, io.out, t + 1.5 + 6 * 0.042, { kind: 'rim', gain: 0.14 * vel, dur: 0.12, freq: 2600, body: 1300 });
    } else {
      // 驶出：渐收，只留前两拍与一记余响
      bayan(t, 0.22);
      dayan(t + B, 0.12);
      dayan(t + 1.5 * B, 0.09);
      bayan(t + 2 * B, 0.14);
      for (let k = 0; k < 3; k++) {
        dayan(t + 2.5 * B + k * 0.05, 0.05 - k * 0.012);
      }
    }
  },

  // 庭院空气 + 极轻的铃铛
  flavor(ctx, io, t0) {
    const src = ctx.createBufferSource();
    src.buffer = S.noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(1200, t0);
    f.frequency.linearRampToValueAtTime(2000, t0 + 3.2);
    f.frequency.linearRampToValueAtTime(1400, t0 + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.038, t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6);
    src.connect(f).connect(g).connect(io.out);
    src.start(t0); src.stop(t0 + 6.05);

    // 三记铃铛（ghungroo）：散在段落中，几乎只是点缀
    const bells = [1.15, 3.05, 4.75];
    for (let k = 0; k < bells.length; k++) {
      S.fm(ctx, io.out, t0 + bells[k] + prand(k * 4.7) * 0.25, {
        freq: 1568 * (k === 1 ? 1.5 : 1), dur: 0.5, gain: 0.03,
        ratio: 3.6, index: 3.2, decay: 0.45, bright: 6500,
      });
    }
  },
};
