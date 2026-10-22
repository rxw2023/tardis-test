// ============================================================
// engine.js — 音频总线 + 全片编排（唯一入口 renderFilmAudio）
//
// 时间轴完全来自 beats.js：Intro 0~5 / 版块 i: 5+6i 起 6s / Outro 125~137
// 每个版块只决定「用什么乐器演奏同一条主旋律」，旋律本身由引擎统一喂给。
// ============================================================

import { TOTAL, SCENES_START, SCENE_LEN, N_SCENES, OUTRO_START, BAR, BEAT } from '../beat/beats.js';
import { sceneThemeNotes, sceneBarGain, PROGRESSION, themeBarsForScene } from './melody.js';
import { themeFreq, snapToScale, chordTones, stof, mtof } from './theory.js';
import S from './synth.js';
import { audioModuleFor } from './sections/index.js';
import { renderIntroAudio } from './sections/intro.js';
import { renderOutroAudio } from './sections/outro.js';

// ------------------------------------------------------------
// 总线
// ------------------------------------------------------------
// 软限幅曲线：把 ±1 以外的部分压回来，保证成片不削顶
function softClipCurve(amount = 1.7, n = 4096) {
  const c = new Float32Array(n);
  const k = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / k;
  }
  return c;
}

function buildBuses(ctx) {
  const master = S.gainNode(ctx, 0.55);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 16;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.16;

  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve(1.7);
  shaper.oversample = '4x';
  const outGain = S.gainNode(ctx, 0.86);

  master.connect(comp).connect(shaper).connect(outGain).connect(ctx.destination);

  // 空间总线（数量固定，避免 20 个卷积器）
  const verbs = {
    hall:  S.reverb(ctx, master, { seconds: 2.2, decay: 2.4, wet: 0.9 }),
    room:  S.reverb(ctx, master, { seconds: 0.8, decay: 3.2, wet: 0.8 }),
    plate: S.reverb(ctx, master, { seconds: 1.6, decay: 1.6, wet: 0.75 }),
    cave:  S.reverb(ctx, master, { seconds: 3.0, decay: 2.0, wet: 0.85 }),
  };
  const delay = S.delayFx(ctx, master, { time: 0.375, feedback: 0.32, mix: 0.5, bright: 3000 });

  return { master, comp, verbs, delay, dry: master };
}

// 为一个版块开出 IO：out（干声入口）+ 按 sends 配置的空间发送
function makeSectionIO(ctx, bus, sends = {}) {
  const out = S.gainNode(ctx, 1);
  out.connect(bus.dry);
  for (const k of ['hall', 'room', 'plate', 'cave']) {
    const amt = sends[k] || 0;
    if (amt > 0) {
      const g = S.gainNode(ctx, amt);
      out.connect(g).connect(bus.verbs[k].input);
    }
  }
  if (sends.delay) {
    const g = S.gainNode(ctx, sends.delay);
    out.connect(g).connect(bus.delay.input);
  }
  return { out, bus };
}

// ------------------------------------------------------------
// 过框转场音（21 次）：风声 + 金属拨响 + 低频推力
// ------------------------------------------------------------
function crossingSound(ctx, bus, t, opts = {}) {
  const g = opts.gain ?? 1;
  S.whoosh(ctx, bus.dry, t - 0.34, { dur: 0.40, gain: 0.16 * g, up: true, from: 260, to: 5600, q: 1.3 });
  S.fm(ctx, bus.dry, t, {
    freq: 1244.5, dur: 0.9, gain: 0.10 * g, ratio: 3.16, index: 5, decay: 0.45, bright: 7000,
  });
  S.drum(ctx, bus.dry, t, { kind: 'kick', gain: 0.42 * g, dur: 0.32, from: 165, to: 44, click: true });
  const rv = S.gainNode(ctx, 0.5);
  rv.connect(bus.verbs.hall.input);
  S.fm(ctx, rv, t, { freq: 1244.5, dur: 1.4, gain: 0.08 * g, ratio: 3.16, index: 5, decay: 0.5, bright: 6000 });
}

// ------------------------------------------------------------
// 版块内：把同一条主旋律交给该版块的乐器
// ------------------------------------------------------------
function arrangeScene(ctx, bus, io, index, t0, mod) {
  if (!mod) return;
  const scale = mod.scale || 'minor';
  const oct = mod.octave || 0;
  const notes = sceneThemeNotes(index);
  const bars = themeBarsForScene(index);

  for (const n of notes) {
    const t = t0 + n.bar * BAR + n.beat * BEAT;
    const dur = n.dur * BEAT * (mod.legato ?? 0.96);
    const freq = themeFreq(n.semis, scale, oct);
    const vel = n.vel * sceneBarGain(n.bar) * (mod.gain ?? 1);
    if (mod.lead) mod.lead(ctx, io, t, freq, dur, vel, n.bar, n.semis);
  }

  // 低音 / 和声铺底
  for (let k = 0; k < 3; k++) {
    const tb = bars[k];
    const [rootSemi, quality] = PROGRESSION[tb];
    const t = t0 + k * BAR;
    const vel = sceneBarGain(k) * (mod.gain ?? 1);
    const root = snapToScale(rootSemi, scale);
    if (mod.bass) {
      mod.bass(ctx, io, t, stof(root, (mod.bassOct ?? -2) + oct), BAR * (mod.bassLen ?? 0.92), vel);
    }
    if (mod.chord) {
      const tones = chordTones(rootSemi, quality, scale).map((s) => stof(s, (mod.chordOct ?? -1) + oct));
      mod.chord(ctx, io, t, tones, BAR * (mod.chordLen ?? 0.95), vel * 0.72);
    }
    if (mod.perc) mod.perc(ctx, io, t, k, vel, { root: stof(root, -2) });
  }
  if (mod.flavor) mod.flavor(ctx, io, t0, index);
}

// ------------------------------------------------------------
// 全片时间引擎底噪（贯穿 intro→outro，作为时空舱的引擎标识）
// ------------------------------------------------------------
function engineDrone(ctx, bus) {
  const g = S.gainNode(ctx, 0.0);
  g.connect(bus.master);
  const t0 = 0, t1 = TOTAL;
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(0.055, 6);
  g.gain.setValueAtTime(0.055, OUTRO_START + 2);
  g.gain.exponentialRampToValueAtTime(0.0001, TOTAL);

  for (const [f, a, det] of [[55, 1, 0], [110, 0.45, 4], [82.4, 0.22, -6], [27.5, 0.6, 0]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = det;
    const og = S.gainNode(ctx, a * 0.5);
    o.connect(og).connect(g);
    o.start(t0); o.stop(t1);
  }
  // 缓慢起伏（漩涡）
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.25;
  const lg = S.gainNode(ctx, 8);
  lfo.connect(lg);
  lfo.start(0); lfo.stop(TOTAL);
  // 极轻的高频嘶声
  const nz = ctx.createBufferSource();
  nz.buffer = S.noiseBuffer(ctx);
  nz.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass'; nf.frequency.value = 5200; nf.Q.value = 0.5;
  const ng = S.gainNode(ctx, 0.006);
  nz.connect(nf).connect(ng).connect(g);
  nz.start(0); nz.stop(TOTAL);
  return g;
}

// ------------------------------------------------------------
// 主入口
// ------------------------------------------------------------
export async function renderFilmAudio(opts = {}) {
  const sr = opts.sampleRate || 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(TOTAL * sr), sr);
  const bus = buildBuses(ctx);

  // 预处理：磁带型版块（蒸汽波）先渲染素材 buffer
  const tapeBufs = {};
  for (let i = 0; i < N_SCENES; i++) {
    const m = audioModuleFor(i);
    if (m && m.tape && m.renderTapeSource) {
      tapeBufs[i] = await m.renderTapeSource(sr, i);
    }
  }

  engineDrone(ctx, bus);

  renderIntroAudio(ctx, bus, 0);

  for (let i = 0; i < N_SCENES; i++) {
    const t0 = SCENES_START + i * SCENE_LEN;
    const mod = audioModuleFor(i);
    let io;
    if (mod && mod.tape) {
      io = makeSectionIO(ctx, bus, {});
      if (mod.renderTape) mod.renderTape(ctx, bus, io, t0, i, tapeBufs[i]);
    } else {
      io = makeSectionIO(ctx, bus, (mod && mod.sends) || {});
      arrangeScene(ctx, bus, io, i, t0, mod);
    }
    // 版块收尾：0.18s 快速收掉，避免长音串到下一框
    if (mod && mod.silenceTail !== false) {
      // 由各乐句自身 release 处理，这里不做硬切，保证过框时节奏连续
    }
    // 过框（第 i 版块结束 = 第 i+1 版块开始）
    crossingSound(ctx, bus, t0, { gain: i === 0 ? 1.15 : 0.92 });
  }
  crossingSound(ctx, bus, OUTRO_START, { gain: 1.0 });

  renderOutroAudio(ctx, bus, OUTRO_START);

  const buf = await ctx.startRendering();
  return buf;
}

// ------------------------------------------------------------
// 单版块试听（子代理调试用）：只渲染第 index 个版块的 6 秒
// ------------------------------------------------------------
export async function renderSceneAudio(index, opts = {}) {
  const sr = opts.sampleRate || 48000;
  const lead = opts.lead ?? 0.4;
  const len = lead + SCENE_LEN + (opts.tail ?? 1.4);
  const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  const bus = buildBuses(ctx);
  const mod = audioModuleFor(index);
  let tapeBuf = null;
  if (mod && mod.tape && mod.renderTapeSource) tapeBuf = await mod.renderTapeSource(sr, index);
  const io = makeSectionIO(ctx, bus, (mod && !mod.tape && mod.sends) || {});
  if (mod && mod.tape && mod.renderTape) mod.renderTape(ctx, bus, io, lead, index, tapeBuf);
  else arrangeScene(ctx, bus, io, index, lead, mod);
  crossingSound(ctx, bus, lead, { gain: 0.95 });
  return ctx.startRendering();
}

export { buildBuses, makeSectionIO, crossingSound, arrangeScene };
