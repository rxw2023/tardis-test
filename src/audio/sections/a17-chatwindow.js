// ============================================================
// a17-chatwindow.js — 第 17 格：聊天窗口（2000s）
// 音色：早期数字铃音（正弦+窄脉冲）+ 软波表贝斯 + 软 pad
//       + 轻电子节拍（kick/hat/clap）+ 系统提示音（收到消息/上线/敲键盘）
// 全部「塑料感」：无真实乐器、无采样，来自 2000 年代初的桌面音箱
// ============================================================

import S, { prand } from '../synth.js';

// 半音 → 频率比
const SEM = (n) => Math.pow(2, n / 12);

// ---- 局部辅助：系统提示音 ----
// 「收到消息」：小三度上行的两声短铃（自创动机，非任何真实产品提示音）
function notifyPair(ctx, dest, t, base, gain) {
  S.blip(ctx, dest, t, {
    freq: base, dur: 0.10, gain, wave: 'sine',
    a: 0.004, d: 0.03, s: 0.5, r: 0.06,
  });
  S.blip(ctx, dest, t + 0.09, {
    freq: base * SEM(3), dur: 0.17, gain: gain * 0.9, wave: 'sine',
    a: 0.004, d: 0.04, s: 0.45, r: 0.11,
  });
}

// 「上线」：三音上行（根音 → 大三度 → 纯五度），比收到消息更亮更慢
function onlineTriple(ctx, dest, t, base, gain) {
  const steps = [0, 4, 7];
  for (let i = 0; i < steps.length; i++) {
    S.blip(ctx, dest, t + i * 0.085, {
      freq: base * SEM(steps[i]), dur: 0.22 - i * 0.03, gain, wave: 'sine',
      a: 0.003, d: 0.05, s: 0.4, r: 0.13,
    });
  }
}

// 机械键盘：稀疏的几下敲击
function keyClicks(ctx, dest, t, n, seed, gain) {
  for (let i = 0; i < n; i++) {
    const tt = t + prand(seed + i * 4.7) * 1.6 + i * 0.11;
    S.drum(ctx, dest, tt, {
      kind: 'click', gain: gain * (0.7 + prand(seed + i * 9.3) * 0.6),
      freq: 2600 + prand(seed + i * 2.9) * 900,
    });
  }
}

export default {
  gain: 1.2,
  legato: 0.84,      // 短一点，像一条条弹出来的消息
  bassLen: 0.9,
  chordOct: -1,

  // 主旋律：早期数字铃音（正弦主体 + 窄脉冲泛音），音尾带一点点下坠
  lead(ctx, io, t, freq, dur, vel, bar) {
    const d = Math.max(0.10, dur * 0.94);
    S.blip(ctx, io.out, t, {
      freq, dur: d, gain: 0.22 * vel, wave: 'sine',
      a: 0.006, d: 0.06, s: 0.7, r: 0.12,
    });
    // 窄脉冲层：只占一半时值，做出 MIDI 铃音的塑料边
    S.blip(ctx, io.out, t, {
      freq, dur: d * 0.5, gain: 0.06 * vel, wave: 'square', duty: 0.3,
      a: 0.004, d: 0.03, s: 0.45, r: 0.06,
    });
    // 音尾轻下滑（「收到消息」的下坠感）
    S.tone(ctx, io.out, t + d * 0.62, {
      freq, dur: Math.max(0.09, d * 0.55), type: 'sine', gain: 0.055 * vel,
      a: 0.004, d: 0.03, s: 0.35, r: 0.07,
      slideTo: freq * 0.965,
    });
    if (bar === 1) {
      // 高光小节：一点点八度上方的细闪
      S.blip(ctx, io.out, t + 0.012, {
        freq: freq * 2, dur: d * 0.3, gain: 0.03 * vel, wave: 'sine',
        a: 0.003, d: 0.02, s: 0.3, r: 0.05,
      });
    }
  },

  // 软波表贝斯：三角波 + 低通，稳稳托住，音量不超过主音的 60%
  bass(ctx, io, t, freq, dur, vel) {
    S.tone(ctx, io.out, t, {
      freq, dur: dur * 0.9, type: 'triangle', gain: 0.10 * vel,
      a: 0.01, d: 0.09, s: 0.85, r: 0.1,
      filter: { type: 'lowpass', freq: 600, q: 0.8 },
    });
    S.tone(ctx, io.out, t, {
      freq, dur: dur * 0.2, type: 'sine', gain: 0.04 * vel,
      a: 0.004, d: 0.05, s: 0.4, r: 0.06,
    });
  },

  // 软 pad：每个和弦音两个失谐锯齿
  chord(ctx, io, t, freqs, dur, vel) {
    for (const f of freqs) {
      for (const det of [-8, 8]) {
        S.tone(ctx, io.out, t, {
          freq: f, dur: dur * 0.96, type: 'sawtooth', gain: 0.06 * vel, detune: det,
          a: 0.06, d: 0.16, s: 0.72, r: 0.18,
          filter: { type: 'lowpass', freq: 1800, q: 0.7 },
        });
      }
    }
  },

  // 轻电子节拍：bar0 只有 kick（+ 极轻反拍 hat），bar1 加 clap，bar2 只剩 hat
  perc(ctx, io, t, bar, vel) {
    const B = 0.5, E = 0.25;

    if (bar !== 2) {
      for (const b of [0, 2]) {
        S.drum(ctx, io.out, t + b * B, {
          kind: 'kick', gain: (bar === 1 ? 0.46 : 0.38) * vel, dur: 0.22, from: 145, to: 52,
        });
      }
    }

    // 八分 hat：bar0 只在反拍（进场留白），bar1/2 走满
    for (let k = 0; k < 8; k++) {
      if (bar === 0 && k % 2 === 0) continue;
      const g = (k % 2 === 0 ? 0.075 : 0.052) * (bar === 2 ? 1.15 : 1) * vel;
      S.drum(ctx, io.out, t + k * E, { kind: 'hat', gain: g, dur: 0.05 });
    }

    if (bar === 1) {
      S.drum(ctx, io.out, t + 1 * B, { kind: 'clap', gain: 0.16 * vel });
      S.drum(ctx, io.out, t + 3 * B, { kind: 'clap', gain: 0.16 * vel });
      S.drum(ctx, io.out, t + 3.5 * B, { kind: 'hat', gain: 0.055 * vel, dur: 0.045 });
    }
  },

  // 系统提示音：3 次「收到消息」+ 1 次「上线」+ 稀疏键盘敲击
  flavor(ctx, io, t0) {
    // 收到消息 ×3，散布在版块内的空档里
    const spots = [1.72, 3.54, 4.74];
    for (let i = 0; i < spots.length; i++) {
      const tt = t0 + spots[i] + prand(i * 7.3 + 2.1) * 0.18;
      notifyPair(ctx, io.out, tt, 1046.5 * SEM(i * 2), 0.07);
    }
    // 上线：驶出前的一串上行三音
    onlineTriple(ctx, io.out, t0 + 5.35, 1174.7, 0.06);
    // 键盘敲击：两小簇
    keyClicks(ctx, io.out, t0 + 0.55, 5, 11.3, 0.035);
    keyClicks(ctx, io.out, t0 + 3.05, 4, 27.9, 0.035);
    // 机箱风扇 + CRT 底噪（极轻，收在版块内）
    S.noise(ctx, io.out, t0, {
      dur: 5.5, gain: 0.0085, env: true,
      a: 0.25, d: 0.5, s: 0.8, r: 0.4,
      filter: { type: 'bandpass', freq: 1150, q: 0.45 },
    });
    // 连接余音：极轻的高频短尾，让版块自然淡出而不是硬切
    S.tone(ctx, io.out, t0 + 5.35, {
      freq: 1568, dur: 0.4, type: 'sine', gain: 0.016,
      a: 0.02, d: 0.15, s: 0.4, r: 0.2,
    });
  },
};
