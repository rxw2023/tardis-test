// ============================================================
// synth.js — Web Audio 合成原语（零采样、零素材，全部程序合成）
// 约定：所有发声函数签名均为 (ctx, dest, time, opts)
//        time 为 AudioContext 时间轴上的绝对秒
// ============================================================

const EPS = 0.0001;

// 确定性伪随机（0..1）——保证每次渲染出来的音乐完全一致
export function prand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ---------- 基础工具 ----------
export function gainNode(ctx, v = 1) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

const _noiseCache = new WeakMap();
export function noiseBuffer(ctx, seconds = 2) {
  let b = _noiseCache.get(ctx);
  if (b && b.duration >= seconds) return b;
  const len = Math.ceil(ctx.sampleRate * Math.max(seconds, 2));
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x3fffffff) - 1;
  }
  _noiseCache.set(ctx, b);
  return b;
}

// 指数衰减包络（attack → decay 到 sustain → release）
// 返回 gain 节点；调用者负责 connect
export function env(ctx, time, dur, o = {}) {
  const a = o.a ?? 0.005;
  const d = o.d ?? 0.08;
  const s = o.s ?? 0.0;
  const r = o.r ?? 0.08;
  const peak = o.peak ?? 1;
  const hold = Math.max(0.001, dur - a - d);
  const g = ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(EPS, time);
  p.exponentialRampToValueAtTime(Math.max(peak, EPS), time + a);
  const sl = Math.max(peak * s, EPS);
  p.exponentialRampToValueAtTime(sl, time + a + d);
  p.setValueAtTime(sl, time + a + d + hold);
  p.exponentialRampToValueAtTime(EPS, time + a + d + hold + r);
  return g;
}

// 简易两阶段包络（percussive）：快起 + 指数衰减
export function decayEnv(ctx, time, a, dur, peak = 1, mid = 0.25) {
  const g = ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(EPS, time);
  p.exponentialRampToValueAtTime(Math.max(peak, EPS), time + a);
  // 二分段指数：中途落一点，尾巴比单段指数更自然
  p.exponentialRampToValueAtTime(Math.max(peak * mid, EPS), time + a + dur * 0.30);
  p.exponentialRampToValueAtTime(EPS, time + a + dur);
  return g;
}

function filt(ctx, o) {
  if (!o) return null;
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'lowpass';
  f.frequency.value = o.freq ?? 2000;
  if (o.q !== undefined) f.Q.value = o.q;
  return f;
}

function vibrato(ctx, param, rate, depth, time, dur) {
  if (!depth) return null;
  const lfo = ctx.createOscillator();
  const lg = ctx.createGain();
  lfo.frequency.value = rate;
  lg.gain.value = depth;
  lfo.connect(lg).connect(param);
  lfo.start(time);
  lfo.stop(time + dur + 0.2);
  return lfo;
}

// ------------------------------------------------------------
// tone：最通用的一个「带包络的振荡器」
// ------------------------------------------------------------
export function tone(ctx, dest, time, o = {}) {
  const { freq = 440, dur = 0.5, type = 'sine', gain = 0.4, detune = 0 } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  osc.detune.value = detune;
  if (o.glideFrom) {
    osc.frequency.setValueAtTime(o.glideFrom, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + (o.glideTime ?? 0.08));
  }
  if (o.slideTo) {
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(o.slideTo, time + dur);
  }
  const g = env(ctx, time, dur, { ...o, peak: o.peak ?? gain });
  let node = osc;
  const f = filt(ctx, o.filter);
  if (f) { osc.connect(f); node = f; }
  node.connect(g).connect(dest);
  if (o.vib) vibrato(ctx, osc.frequency, o.vib.rate ?? 5, o.vib.depth ?? 4, time, dur);
  osc.start(time);
  osc.stop(time + dur + (o.r ?? 0.08) + 0.15);
  return g;
}

// ------------------------------------------------------------
// noise：噪声（打击、风声、嘶声）
// ------------------------------------------------------------
export function noise(ctx, dest, time, o = {}) {
  const { dur = 0.2, gain = 0.3 } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const off = prand(time * 3.7 + 1.3) * 1.0;
  const f = filt(ctx, o.filter || { type: 'bandpass', freq: 2000, q: 1 });
  const g = o.env ? env(ctx, time, dur, { ...o, peak: gain }) : decayEnv(ctx, time, o.a ?? 0.004, dur, gain, o.curve ?? 0.4);
  let node = src;
  if (f) {
    if (o.sweepTo) {
      f.frequency.setValueAtTime(o.filter?.freq ?? 800, time);
      f.frequency.exponentialRampToValueAtTime(o.sweepTo, time + dur);
    }
    src.connect(f); node = f;
  }
  node.connect(g).connect(dest);
  src.start(time, off);
  src.stop(time + dur + 0.25);
  return g;
}

// ------------------------------------------------------------
// pluck：拨弦（加法合成——泛音各自衰减，避免反馈延迟线的音高误差）
// 适用：古琴 / 琵琶 / 三味线 / 吉他 / 竖琴 / 鲁特
// ------------------------------------------------------------
export function pluck(ctx, dest, time, o = {}) {
  const {
    freq = 440, dur = 1.2, gain = 0.35, partials = 8,
    bright = 1.1,        // 泛音亮度（越大高频越多）
    damp = 0.55,         // 高次泛音衰减倍率
    bend = 0,            // 起音滑音（半音，正值上滑）
    noiseAtk = 0.35,     // 拨片噪声量
    body = 1800,         // 共鸣箱低通
  } = o;
  const a = o.a ?? 0.004;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  const bodyF = filt(ctx, { type: 'lowpass', freq: body, q: 0.7 });
  amp.connect(bodyF).connect(dest);

  for (let i = 1; i <= partials; i++) {
    const pf = freq * i * (1 + (o.stretch ?? 0) * i * i);
    if (pf > ctx.sampleRate * 0.45) break;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pf * (bend ? Math.pow(2, -bend / 12) : 1), time);
    if (bend) osc.frequency.exponentialRampToValueAtTime(pf, time + 0.05);
    const d = dur / (1 + (i - 1) * damp);
    const g = ctx.createGain();
    const amp_i = Math.pow(i, -bright) * (i % 2 === 0 ? 0.72 : 1);
    g.gain.setValueAtTime(EPS, time);
    g.gain.exponentialRampToValueAtTime(Math.max(amp_i, EPS), time + a + i * 0.0015);
    g.gain.exponentialRampToValueAtTime(EPS, time + d);
    osc.connect(g).connect(amp);
    osc.start(time);
    osc.stop(time + d + 0.05);
  }
  if (noiseAtk > 0) {
    noise(ctx, amp, time, {
      dur: 0.05, gain: gain * noiseAtk, a: 0.001,
      filter: { type: 'bandpass', freq: Math.min(freq * 3, 6000), q: 0.9 },
    });
  }
  return amp;
}

// ------------------------------------------------------------
// fm：金属 / 钟 / 锣 / 甘美兰 / 电钢 / 铃
// ------------------------------------------------------------
export function fm(ctx, dest, time, o = {}) {
  const {
    freq = 440, dur = 1.6, gain = 0.3,
    ratio = 2.76,        // 非整数比 → 金属感
    index = 6,           // 调制深度（× 载波频率）
    decay = 0.6,         // 调制衰减时间比
    type = 'sine',
    bright = 4000,
  } = o;
  const car = ctx.createOscillator();
  car.type = type;
  car.frequency.value = freq;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = freq * ratio;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(freq * index, time);
  mg.gain.exponentialRampToValueAtTime(Math.max(freq * index * 0.02, EPS), time + dur * decay);
  mod.connect(mg).connect(car.frequency);

  const g = ctx.createGain();
  const a = o.a ?? 0.003;
  g.gain.setValueAtTime(EPS, time);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, EPS), time + a);
  g.gain.exponentialRampToValueAtTime(EPS, time + dur);
  const f = filt(ctx, { type: 'lowpass', freq: bright, q: 0.6 });
  car.connect(g).connect(f).connect(dest);
  car.start(time); car.stop(time + dur + 0.1);
  mod.start(time); mod.stop(time + dur + 0.1);
  return g;
}

// ------------------------------------------------------------
// reed：带气声的管乐（笛 / 箫 / 埙 / 尺八 / 双簧）
// ------------------------------------------------------------
export function reed(ctx, dest, time, o = {}) {
  const {
    freq = 440, dur = 0.6, gain = 0.3,
    wave = 'triangle',      // triangle 柔 / sawtooth 亮 / square 芦笛
    breath = 0.32,          // 气声比例
    bite = 3200,            // 明亮度低通
    vib = { rate: 5, depth: 5 },
  } = o;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = freq;
  const g = env(ctx, time, dur, { a: o.a ?? 0.05, d: 0.08, s: o.s ?? 0.85, r: o.r ?? 0.12, peak: gain });
  const f = filt(ctx, { type: 'lowpass', freq: bite, q: 0.9 });
  osc.connect(f).connect(g).connect(dest);
  vibrato(ctx, osc.frequency, vib.rate, vib.depth, time, dur);
  if (breath > 0) {
    noise(ctx, g, time, {
      dur, gain: gain * breath, env: true,
      filter: { type: 'bandpass', freq: Math.min(freq * 2.2, 7000), q: 0.7 },
      a: 0.04, d: 0.1, s: 0.5, r: 0.14, peak: gain * breath,
    });
  }
  osc.start(time); osc.stop(time + dur + (o.r ?? 0.12) + 0.15);
  return g;
}

// ------------------------------------------------------------
// bow：弓弦（小提琴 / 西塔琴共鸣 / 弦乐群 / 管风琴长音）
// ------------------------------------------------------------
export function bow(ctx, dest, time, o = {}) {
  const {
    freq = 440, dur = 1.2, gain = 0.25,
    wave = 'sawtooth', bright = 2200,
    vib = { rate: 5.2, depth: 6 },
    scratch = 0.10,
  } = o;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = freq;
  const g = env(ctx, time, dur, { a: o.a ?? 0.14, d: 0.12, s: o.s ?? 0.9, r: o.r ?? 0.18, peak: gain });
  const f = filt(ctx, { type: 'lowpass', freq: bright, q: 0.8 });
  osc.connect(f).connect(g).connect(dest);
  vibrato(ctx, osc.frequency, vib.rate, vib.depth, time, dur);
  if (scratch > 0) {
    noise(ctx, g, time, {
      dur, gain: gain * scratch, env: true,
      filter: { type: 'bandpass', freq: freq * 3, q: 1.4 },
      a: 0.12, d: 0.2, s: 0.35, r: 0.2, peak: gain * scratch,
    });
  }
  osc.start(time); osc.stop(time + dur + (o.r ?? 0.18) + 0.2);
  return g;
}

// ------------------------------------------------------------
// drum：打击乐
// kind: kick | snare | hat | openhat | tom | clap | rim | shaker | gong | woodblock
// ------------------------------------------------------------
export function drum(ctx, dest, time, o = {}) {
  const kind = o.kind || 'kick';
  const gain = o.gain ?? 0.5;
  const dur = o.dur ?? 0.3;
  switch (kind) {
    case 'kick': {
      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      const f0 = o.from ?? 150, f1 = o.to ?? 46;
      osc.frequency.setValueAtTime(f0, time);
      osc.frequency.exponentialRampToValueAtTime(f1, time + dur * 0.55);
      const g = ctx.createGain();
      g.gain.setValueAtTime(EPS, time);
      g.gain.exponentialRampToValueAtTime(gain, time + 0.006);
      g.gain.exponentialRampToValueAtTime(EPS, time + dur);
      osc.connect(g).connect(dest);
      osc.start(time); osc.stop(time + dur + 0.05);
      if (o.click) {
        noise(ctx, dest, time, { dur: 0.02, gain: gain * 0.5, filter: { type: 'highpass', freq: 1800 } });
      }
      return g;
    }
    case 'snare':
    case 'brush': {
      const isBrush = kind === 'brush';
      noise(ctx, dest, time, {
        dur, gain, a: 0.002,
        filter: { type: isBrush ? 'highpass' : 'bandpass', freq: o.freq ?? (isBrush ? 3000 : 1900), q: isBrush ? 0.6 : 0.9 },
      });
      if (!isBrush) {
        tone(ctx, dest, time, { freq: o.body ?? 185, dur: dur * 0.55, type: 'triangle', gain: gain * 0.5, a: 0.002, d: 0.05, s: 0.1, r: 0.05 });
      }
      return null;
    }
    case 'hat':
    case 'openhat': {
      const d = kind === 'openhat' ? (dur || 0.28) : (dur || 0.055);
      noise(ctx, dest, time, {
        dur: d, gain, a: 0.001, curve: 0.15,
        filter: { type: 'highpass', freq: o.freq ?? 7800, q: 0.7 },
      });
      return null;
    }
    case 'tom': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(o.from ?? 260, time);
      osc.frequency.exponentialRampToValueAtTime(o.to ?? 120, time + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(EPS, time);
      g.gain.exponentialRampToValueAtTime(gain, time + 0.005);
      g.gain.exponentialRampToValueAtTime(EPS, time + dur);
      osc.connect(g).connect(dest);
      osc.start(time); osc.stop(time + dur + 0.05);
      noise(ctx, dest, time, { dur: 0.03, gain: gain * 0.3, filter: { type: 'bandpass', freq: 900 } });
      return g;
    }
    case 'clap': {
      for (let i = 0; i < 4; i++) {
        noise(ctx, dest, time + i * 0.011, {
          dur: i === 3 ? 0.16 : 0.035, gain: gain * (i === 3 ? 1 : 0.55), a: 0.001,
          filter: { type: 'bandpass', freq: 1250, q: 1.1 },
        });
      }
      return null;
    }
    case 'rim':
    case 'click': {
      noise(ctx, dest, time, { dur: 0.035, gain, a: 0.001, filter: { type: 'bandpass', freq: o.freq ?? 2400, q: 3 } });
      tone(ctx, dest, time, { freq: o.body ?? 800, dur: 0.03, type: 'square', gain: gain * 0.35, a: 0.001, d: 0.01, s: 0.05, r: 0.02 });
      return null;
    }
    case 'shaker': {
      noise(ctx, dest, time, {
        dur: 0.09, gain, a: 0.004, curve: 0.5,
        filter: { type: 'highpass', freq: o.freq ?? 5200, q: 0.8 },
      });
      return null;
    }
    case 'woodblock': {
      tone(ctx, dest, time, { freq: o.freq ?? 900, dur: 0.07, type: 'square', gain, a: 0.001, d: 0.02, s: 0.05, r: 0.04, filter: { type: 'bandpass', freq: o.freq ?? 900, q: 6 } });
      noise(ctx, dest, time, { dur: 0.02, gain: gain * 0.4, filter: { type: 'highpass', freq: 3000 } });
      return null;
    }
    case 'gong':
    case 'tam': {
      fm(ctx, dest, time, {
        freq: o.freq ?? 90, dur: dur || 2.4, gain, ratio: o.ratio ?? 3.41,
        index: o.index ?? 7, decay: 0.5, bright: o.bright ?? 3000,
      });
      noise(ctx, dest, time, { dur: 0.25, gain: gain * 0.5, filter: { type: 'bandpass', freq: 1600, q: 0.5 } });
      return null;
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------
// blip：电子音（方波 / 脉冲 / 三角）—— 8-bit、示波器、UI 音
// ------------------------------------------------------------
export function blip(ctx, dest, time, o = {}) {
  const { freq = 440, dur = 0.18, gain = 0.3, wave = 'square', duty = 0.5 } = o;
  if (wave === 'pulse' || duty !== 0.5) {
    // 用两个相位错开的锯齿近似窄脉冲（PeriodicWave）
    const osc = ctx.createOscillator();
    const n = 24;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
    }
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: false }));
    osc.frequency.value = freq;
    const g = env(ctx, time, dur, { a: o.a ?? 0.004, d: 0.03, s: o.s ?? 0.9, r: o.r ?? 0.05, peak: gain });
    const f = filt(ctx, o.filter || { type: 'lowpass', freq: 6000, q: 0.7 });
    osc.connect(f).connect(g).connect(dest);
    osc.start(time); osc.stop(time + dur + 0.12);
    return g;
  }
  return tone(ctx, dest, time, { ...o, wave: undefined, type: wave });
}

// ------------------------------------------------------------
// sub：低音（正弦 / 方波 bass）
// ------------------------------------------------------------
export function sub(ctx, dest, time, o = {}) {
  const { freq = 110, dur = 0.4, gain = 0.4, wave = 'sine' } = o;
  return tone(ctx, dest, time, {
    freq, dur, gain, type: wave,
    a: o.a ?? 0.01, d: 0.06, s: o.s ?? 0.8, r: o.r ?? 0.08,
    filter: o.filter || { type: 'lowpass', freq: o.bright ?? 700, q: 0.8 },
  });
}

// ------------------------------------------------------------
// whoosh：转场风声（过画框用）
// ------------------------------------------------------------
export function whoosh(ctx, dest, time, o = {}) {
  const { dur = 0.55, gain = 0.22, up = true, from = 220, to = 5200 } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = o.q ?? 1.4;
  const a = up ? from : to, b = up ? to : from;
  f.frequency.setValueAtTime(a, time);
  f.frequency.exponentialRampToValueAtTime(b, time + dur * 0.8);
  f.frequency.exponentialRampToValueAtTime(a * 0.8, time + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, time);
  g.gain.exponentialRampToValueAtTime(gain, time + dur * 0.62);
  g.gain.exponentialRampToValueAtTime(EPS, time + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(time, prand(time * 5.3 + 7.1));
  src.stop(time + dur + 0.1);
  return g;
}

// ------------------------------------------------------------
// 效果：混响（程序生成 IR）/ 延迟 / 磁带
// ------------------------------------------------------------
export function reverb(ctx, dest, o = {}) {
  const { seconds = 2.2, decay = 2.6, wet = 1, spread = 0.9, preDelay = 0.012 } = o;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * seconds);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const envv = Math.pow(1 - x, decay);
      const n1 = prand(i + ch * 7919) * 2 - 1;
      const n2 = prand(i * 1.31 + ch * 104729) * 2 - 1;
      d[i] = (n1 * 0.75 + n2 * 0.25) * envv;
    }
    // 早期反射（几个稀疏脉冲，让空间更像房间而不是一团噪声）
    const taps = [0.011, 0.019, 0.031, 0.043, 0.062, 0.087];
    for (let k = 0; k < taps.length; k++) {
      const idx = Math.floor((preDelay + taps[k] * (1 + ch * 0.11 * spread)) * sr);
      if (idx < len) d[idx] += (0.55 - k * 0.07) * (ch ? -1 : 1);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const w = ctx.createGain();
  w.gain.value = wet;
  conv.connect(w).connect(dest);
  const input = ctx.createGain();
  input.connect(conv);
  return { input, output: w, node: conv };
}

export function delayFx(ctx, dest, o = {}) {
  const { time: dt = 0.28, feedback = 0.35, mix = 0.5, bright = 3200 } = o;
  const input = ctx.createGain();
  const dl = ctx.createDelay(2.0);
  dl.delayTime.value = dt;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = bright;
  const w = ctx.createGain();
  w.gain.value = mix;
  input.connect(dest);
  input.connect(dl);
  dl.connect(f).connect(fb).connect(dl);
  f.connect(w).connect(dest);
  return { input, output: w };
}

// 汇总导出
const S = {
  EPS, gainNode, noiseBuffer, env, decayEnv, prand,
  tone, noise, pluck, fm, reed, bow, drum, blip, sub, whoosh,
  reverb, delayFx,
};
export default S;
