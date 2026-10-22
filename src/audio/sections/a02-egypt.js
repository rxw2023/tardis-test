// ============================================================
// a02-egypt.js — 第 2 格：埃及壁画（约前 1300）
// 音色：ney 笛（气声三角波）+ 竖琴式拨弦低音 + 平行四度笛群
//       + 达布卡手鼓（doum / tek）+ 叉铃 sistrum + 墓室空气
// 全程序合成 / 零采样；随机一律走 S.prand(seed)，渲染结果可复现
// ============================================================

import S, { prand } from '../synth.js';

const FOURTH = Math.pow(2, 5 / 12); // 纯四度（古埃及 / 中东常用的平行叠置）

// ------------------------------------------------------------
// 局部辅助 1：叉铃 sistrum —— 金属薄片的极短碎响
// 高通噪声给「沙」，非整数比 FM 给「金属」，两者都是毫秒级
// ------------------------------------------------------------
function sistrum(ctx, dest, t, g) {
  S.noise(ctx, dest, t, {
    dur: 0.07, gain: g, a: 0.002, curve: 0.3,
    filter: { type: 'highpass', freq: 6000, q: 0.8 },
  });
  S.fm(ctx, dest, t, {
    freq: 1620, dur: 0.09, gain: g * 0.45, ratio: 5.1,
    index: 2.0, decay: 0.3, bright: 9000,
  });
}

// ------------------------------------------------------------
// 局部辅助 2：石室轻响 —— 石头或金属被碰了一下
// ------------------------------------------------------------
function relic(ctx, dest, t, g, seed) {
  const f = 470 + prand(seed) * 880;
  S.drum(ctx, dest, t, { kind: 'woodblock', gain: g, freq: f });
  S.fm(ctx, dest, t + 0.014, {
    freq: f * 2.7, dur: 0.45, gain: g * 0.3, ratio: 2.41,
    index: 3, decay: 0.5, bright: 5200,
  });
}

export default {
  gain: 1.02,
  legato: 0.90,   // 略短，留出笛声的换气
  bassLen: 0.86,  // 竖琴拨弦比小节略短
  chordOct: -1,

  // ----------------------------------------------------------
  // 主题：ney 笛（斜吹竖笛）—— 气声很重的三角波 + 慢音头
  // ----------------------------------------------------------
  lead(ctx, io, t, freq, dur, vel, bar) {
    const d = dur * 0.96;
    S.reed(ctx, io.out, t, {
      freq, dur: d, gain: 0.36 * vel, wave: 'triangle',
      breath: 0.45, bite: 2200, a: 0.07, s: 0.82, r: 0.18,
      vib: { rate: 4.5 + bar * 0.3, depth: 8 },
    });
    // 弱八度泛音：给笛声一点「空」，不超过主体的 1/5
    S.tone(ctx, io.out, t, {
      freq: freq * 2.002, dur: d * 0.72, type: 'sine', gain: 0.062 * vel,
      a: 0.09, d: 0.20, s: 0.30, r: 0.22,
    });
  },

  // ----------------------------------------------------------
  // 低音：竖琴式拨弦（少泛音、大阻尼）+ 一层正弦垫底
  // 整体增益刻意压在主音的 60% 以内，不抢主题基频
  // ----------------------------------------------------------
  bass(ctx, io, t, freq, dur, vel) {
    S.pluck(ctx, io.out, t, {
      freq, dur: dur * 0.92, gain: 0.075 * vel,
      partials: 4, bright: 1.5, damp: 1.15, body: 950, noiseAtk: 0.5,
    });
    S.sub(ctx, io.out, t, {
      freq, dur: dur * 0.50, gain: 0.05 * vel, wave: 'sine', bright: 320,
    });
  },

  // ----------------------------------------------------------
  // 和声：平行四度的短促笛群 / 人声 —— 两下点状，不做和弦墙
  // ----------------------------------------------------------
  chord(ctx, io, t, freqs, dur, vel) {
    const root = freqs[0];
    const voices = [root, root * FOURTH];
    if (freqs.length >= 3) voices.push(freqs[2]);
    // 两次点状：小节头一次，第 3 拍一次更轻
    for (let hit = 0; hit < 2; hit++) {
      const tt = t + hit * 1.0;
      const hv = vel * (hit === 0 ? 1 : 0.62);
      for (let k = 0; k < voices.length; k++) {
        S.reed(ctx, io.out, tt + k * 0.045, {
          freq: voices[k], dur: 0.52, gain: 0.05 * hv, wave: 'sine',
          breath: 0.20, bite: 1200, a: 0.09, s: 0.70, r: 0.24,
          vib: { rate: 4.9, depth: 5 },
        });
      }
    }
  },

  // ----------------------------------------------------------
  // 打击：达布卡手鼓 + 叉铃
  //   1 = doum（掌心，低音）  2 = tek（指尖，边击）  3 = sistrum
  //   三小节层次：bar0 稀疏进场 / bar1 八分网格高光 / bar2 渐收驶出
  // ----------------------------------------------------------
  perc(ctx, io, t, bar, vel, info) {
    const E = 0.25; // 八分
    const PATTERNS = [
      [1, 0, 0, 0, 2, 0, 2, 3], // bar0：3 个鼓点 + 1 记叉铃
      [1, 2, 2, 2, 1, 2, 2, 3], // bar1：八分网格铺满，末尾叉铃点亮
      [1, 0, 2, 0, 0, 0, 2, 3], // bar2：留白驶出
    ];
    const pat = PATTERNS[bar] || PATTERNS[0];
    const root = (info && info.root) || 110;

    for (let k = 0; k < 8; k++) {
      const v = pat[k];
      if (!v) continue;
      // 渐收：bar2 越往后越轻；其余小节只有微弱的呼吸感
      const fade = bar === 2 ? Math.pow(0.78, k) : (1 - k * 0.02);
      const tt = t + k * E + (prand(bar * 17 + k) - 0.5) * 0.010;
      const g = vel * fade;

      if (v === 1) {
        // doum：掌心闷击，150 → 72
        S.drum(ctx, io.out, tt, { kind: 'tom', gain: 0.42 * g, dur: 0.30, from: 150, to: 72 });
      } else if (v === 2) {
        // tek：指尖边击，高频薄脆
        S.drum(ctx, io.out, tt, { kind: 'rim', gain: 0.155 * g, freq: 2600 });
      } else {
        sistrum(ctx, io.out, tt, 0.115 * g);
        // 叉铃摇一下：再补两粒更轻的碎响
        sistrum(ctx, io.out, tt + 0.055, 0.065 * g);
        sistrum(ctx, io.out, tt + 0.105, 0.038 * g);
      }
    }

    // bar1 高光：正中再补一记重 doum，把小节的支点顶出来
    if (bar === 1) {
      S.drum(ctx, io.out, t + 4 * E, {
        kind: 'tom', gain: 0.20 * vel, dur: 0.36, from: 165, to: 68,
      });
    }
    // bar2 驶出：末尾一记渐弱的叉铃，像走出墓道
    if (bar === 2) {
      sistrum(ctx, io.out, t + 7 * E + 0.18, 0.05 * vel);
      void root;
    }
  },

  // ----------------------------------------------------------
  // 版块特色：墓室空气 —— 6 秒极轻低频噪声 + 零星石 / 金属轻响
  // ----------------------------------------------------------
  flavor(ctx, io, t0) {
    // 空气：带宽 200~400Hz 的极轻噪声，缓慢起伏
    const src = ctx.createBufferSource();
    src.buffer = S.noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(210, t0);
    f.frequency.linearRampToValueAtTime(390, t0 + 2.6);
    f.frequency.linearRampToValueAtTime(250, t0 + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.040, t0 + 1.6);
    g.gain.exponentialRampToValueAtTime(0.040, t0 + 3.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6);
    src.connect(f).connect(g).connect(io.out);
    src.start(t0);
    src.stop(t0 + 6.05);

    // 4 次零星的石头 / 金属轻响
    for (let k = 0; k < 4; k++) {
      const tt = t0 + 0.55 + k * 1.35 + prand(k * 4.3 + 1.1) * 0.45;
      relic(ctx, io.out, tt, 0.045 + prand(k * 8.7) * 0.035, k * 2.9 + 0.7);
    }
  },
};
