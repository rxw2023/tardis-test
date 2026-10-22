// ============================================================
// a18-vaporwave.js — 第 18 格：蒸汽波（tape 型版块）
//
// 三步磁带处理：
//   1) 素材用 151.2 BPM 生成（= 120 × 1.26），音高预先升 4 个半音；
//      主时间轴以 playbackRate 0.7937 播放 → 音高降回主调、速度降回 120BPM
//   2) 大混响 + 4kHz 低通 + 0.5Hz 摇晃（wow&flutter）+ 磁带底噪
//   3) 进入时速率 1.0→0.7937（减速），离开时 0.7937→1.0（加速）；
//      第 2 小节每个音重复两遍（跳针循环），时长守恒
// ============================================================

import S, { prand } from '../synth.js';
import { sceneThemeNotes, themeBarsForScene, PROGRESSION } from '../melody.js';
import { themeFreq, snapToScale, chordTones, stof } from '../theory.js';

const UP = Math.pow(2, 4 / 12);   // 1.259921 —— 素材预先升 4 个半音
const RATE = 0.7937;              // 1 / 1.26 —— 主时间轴播放速率
const T_IN = 1.0, T_STEADY = 3.6, T_OUT = 1.4;   // 变速三段（版块内局部秒）
const LEN = 6;

// ∫rate dt（0~6s）：素材必须正好这么长，播放才刚好占满 6 秒
const INTEGRAL = 0.5 * (1 + RATE) * T_IN + RATE * T_STEADY + 0.5 * (RATE + 1) * T_OUT;
const Lm = INTEGRAL;                 // 5.0098s 素材
const LEAD = Lm * 1.26 - LEN;        // 素材头部多出来的音乐时间（磁带启动用）

const m2t = (mt) => (mt + LEAD) / 1.26;   // 音乐时间(120BPM) → 素材时间(151.2BPM)
const d2t = (d) => d / 1.26;              // 时值同样压缩

// ---- 素材里的乐器（都是"未降速"的原始音色） ----
function rhodes(ctx, dest, t, freq, dur, vel) {
  S.fm(ctx, dest, t, {
    freq, dur: dur * 1.5, gain: 0.34 * vel, ratio: 1.0, index: 3.2,
    decay: 0.7, bright: 2600, a: 0.006,
  });
  S.tone(ctx, dest, t, {
    freq, dur: dur * 1.2, type: 'sine', gain: 0.14 * vel,
    a: 0.008, d: 0.15, s: 0.45, r: 0.25,
  });
}

function slowBass(ctx, dest, t, freq, dur, vel) {
  S.tone(ctx, dest, t, {
    freq: freq * 2, dur: 0.06, type: 'sine', gain: 0.24 * vel,
    a: 0.004, d: 0.03, s: 0.2, r: 0.05, slideTo: freq,
  });
  S.tone(ctx, dest, t, {
    freq, dur: dur * 0.9, type: 'sine', gain: 0.24 * vel,
    a: 0.01, d: 0.18, s: 0.6, r: 0.16, filter: { type: 'lowpass', freq: 380, q: 0.8 },
  });
}

function padChord(ctx, dest, t, freqs, dur, vel) {
  for (const f of freqs) {
    for (const det of [-8, 8]) {
      S.tone(ctx, dest, t, {
        freq: f, dur: dur * 0.95, type: 'sawtooth', gain: 0.032 * vel, detune: det,
        a: 0.06, d: 0.2, s: 0.7, r: 0.22, filter: { type: 'lowpass', freq: 1300, q: 0.7 },
      });
    }
  }
}

export default {
  tape: true,
  gain: 1,

  // ---------- 第一步：渲染 151.2BPM 的素材 ----------
  async renderTapeSource(sr, index = 17) {
    const ctx = new OfflineAudioContext(2, Math.ceil(Lm * sr), sr);
    const out = S.gainNode(ctx, 0.92);
    const fx = S.delayFx(ctx, out, { time: 0.28 / 1.26, feedback: 0.24, mix: 0.20, bright: 2600 });
    out.connect(ctx.destination);
    const busIn = fx.input;

    const notes = sceneThemeNotes(index);
    const bars = themeBarsForScene(index);
    const BGAIN = [0.80, 1.00, 0.72];

    // 磁带启动：一小段和弦 swell + 起音噪声（占素材头部 LEAD 的音乐时间）
    const swellT = 0, swellD = LEAD;
    if (swellD > 0.02) {
      const [r0] = PROGRESSION[bars[0]];
      for (const s of chordTones(r0, PROGRESSION[bars[0]][1], 'minor')) {
        S.tone(ctx, busIn, swellT, {
          freq: stof(s, -1) * UP, dur: swellD, type: 'sawtooth', gain: 0.05,
          a: swellD * 0.7, d: swellD * 0.2, s: 0.6, r: swellD * 0.3,
          filter: { type: 'lowpass', freq: 900, q: 0.7 },
        });
      }
      S.noise(ctx, busIn, swellT, {
        dur: swellD, gain: 0.05, a: swellD * 0.3,
        filter: { type: 'highpass', freq: 2200, q: 0.6 },
      });
    }

    // 主题（第 2 小节跳针：每个音重复两遍，各占一半时值）
    for (const n of notes) {
      const mt = n.bar * 2 + n.beat * 0.5;
      const d = n.dur * 0.5 * 0.96;
      const f = themeFreq(n.semis, 'minor', 0) * UP;
      const vel = n.vel * BGAIN[n.bar];
      if (n.bar === 1) {
        const seg = d / 2;
        rhodes(ctx, busIn, m2t(mt), f, d2t(seg), vel);
        rhodes(ctx, busIn, m2t(mt + seg), f, d2t(seg), vel * 0.82);
      } else {
        rhodes(ctx, busIn, m2t(mt), f, d2t(d), vel);
      }
    }

    // 低音 / 和声 / 鼓（按素材时间轴排）
    for (let k = 0; k < 3; k++) {
      const [rootSemi, quality] = PROGRESSION[bars[k]];
      const root = snapToScale(rootSemi, 'minor');
      const t = m2t(k * 2);
      const vel = BGAIN[k];
      slowBass(ctx, busIn, t, stof(root, -2) * UP, d2t(2 * 0.92), vel);
      padChord(ctx, busIn, t, chordTones(rootSemi, quality, 'minor').map((s) => stof(s, -1) * UP), d2t(2 * 0.95), vel * 0.8);

      // slowed hiphop 鼓：素材里是 151.2BPM，降速后听着是被拖慢的
      const E = 0.5 / 1.26;   // 素材里的一拍
      S.drum(ctx, busIn, t, { kind: 'kick', gain: 0.38 * vel, dur: 0.30, from: 165, to: 48, click: true });
      S.drum(ctx, busIn, t + 2 * E, { kind: 'kick', gain: 0.26 * vel, dur: 0.26 });
      S.drum(ctx, busIn, t + 1 * E, { kind: 'clap', gain: 0.18 * vel });
      S.drum(ctx, busIn, t + 3 * E, { kind: 'clap', gain: 0.20 * vel });
      for (let j = 0; j < 8; j++) {
        S.drum(ctx, busIn, t + j * E * 0.5, { kind: 'hat', gain: (j % 2 ? 0.045 : 0.07) * vel, dur: 0.05 });
      }
      if (k === 1) S.drum(ctx, busIn, t + 3.5 * E, { kind: 'openhat', gain: 0.10 * vel, dur: 0.22 });
    }

    return await ctx.startRendering();
  },

  // ---------- 第二/三步：在主时间轴上做磁带处理 ----------
  renderTape(ctx, bus, io, t0, index, buf) {
    if (!buf) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(1.0, t0);
    src.playbackRate.linearRampToValueAtTime(RATE, t0 + T_IN);
    src.playbackRate.setValueAtTime(RATE, t0 + T_IN + T_STEADY);
    src.playbackRate.linearRampToValueAtTime(1.0, t0 + LEN);

    // wow & flutter：0.5Hz 调制一条 20ms 的延迟线
    const dl = ctx.createDelay(0.5);
    dl.delayTime.value = 0.02;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoG = S.gainNode(ctx, 0.0022);
    lfo.connect(lfoG).connect(dl.delayTime);
    lfo.start(t0); lfo.stop(t0 + LEN + 0.2);

    // 磁带整体电平摇晃
    const wob = S.gainNode(ctx, 1);
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.5;
    const wlfoG = S.gainNode(ctx, 0.06);
    wlfo.connect(wlfoG).connect(wob.gain);
    wlfo.start(t0); wlfo.stop(t0 + LEN + 0.2);

    // 4kHz 低通 + 输出
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4000;
    lp.Q.value = 0.6;
    const hp = ctx.createBiquadFilter();   // 顺便削掉一点浑浊低频
    hp.type = 'highpass';
    hp.frequency.value = 45;

    const level = S.gainNode(ctx, 0.95);
    src.connect(dl).connect(wob).connect(lp).connect(hp).connect(level);
    level.connect(io.out);

    // 大混响发送
    const rv = S.gainNode(ctx, 0.55);
    level.connect(rv).connect(bus.verbs.hall.input);
    const rv2 = S.gainNode(ctx, 0.18);
    level.connect(rv2).connect(bus.verbs.plate.input);

    src.start(t0);
    src.stop(t0 + LEN + 0.05);

    // 磁带底噪：嘶声 + 低频 hum（只在版块内）
    const nz = ctx.createBufferSource();
    nz.buffer = S.noiseBuffer(ctx);
    nz.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass'; nf.frequency.value = 3200; nf.Q.value = 0.5;
    const ng = S.gainNode(ctx, 0.0001);
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.014, t0 + 0.4);
    ng.gain.setValueAtTime(0.014, t0 + LEN - 0.5);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + LEN);
    nz.connect(nf).connect(ng).connect(io.out);
    nz.start(t0); nz.stop(t0 + LEN + 0.05);

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 50;
    const hg = S.gainNode(ctx, 0.0001);
    hg.gain.setValueAtTime(0.0001, t0);
    hg.gain.exponentialRampToValueAtTime(0.010, t0 + 0.5);
    hg.gain.setValueAtTime(0.010, t0 + LEN - 0.5);
    hg.gain.exponentialRampToValueAtTime(0.0001, t0 + LEN);
    hum.connect(hg).connect(io.out);
    hum.start(t0); hum.stop(t0 + LEN + 0.05);
  },
};
