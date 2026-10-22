// ============================================================
// sections/index.js — 20 个版块的「音乐皮肤」注册表
// 每个模块导出（全部可选，lead 缺失则用中性音色兜底）：
//   scale      : 音阶名（theory.js SCALES）
//   octave     : 主题移调八度
//   gain       : 整体音量系数
//   legato     : 主题时值系数
//   sends      : { hall, room, plate, cave, delay } 空间发送量
//   lead(ctx, io, t, freq, dur, vel, bar, semis)
//   bass(ctx, io, t, freq, dur, vel)
//   chord(ctx, io, t, freqs[], dur, vel)
//   perc(ctx, io, tBar, bar, vel, { root })
//   flavor(ctx, io, t0, index)
// ============================================================

import neutral from './neutral.js';

// ---AUTO-IMPORTS-START--- 由 tools/gen-audio-index.js 生成，勿手改
import m01 from './a01-sahara.js';
import m02 from './a02-egypt.js';
import m03 from './a03-hanrubbing.js';
import m04 from './a04-tangline.js';
import m05 from './a05-songshan.js';
import m06 from './a06-qingming.js';
import m07 from './a07-maya.js';
import m08 from './a08-mughal.js';
import m09 from './a09-bada.js';
import m10 from './a10-wayang.js';
import m11 from './a11-ukiyoe.js';
import m12 from './a12-starrynight.js';
import m13 from './a13-scream.js';
import m14 from './a14-nosferatu.js';
import m15 from './a15-oscilloscope.js';
import m16 from './a16-8bit.js';
import m17 from './a17-chatwindow.js';
import m18 from './a18-vaporwave.js';
import m19 from './a19-vertical.js';
import m20 from './a20-codeaesthetic.js';
// ---AUTO-IMPORTS-END---

// 各版块的音阶 / 八度 / 空间预设（未实现乐器的版块也先按这个走）
export const PRESET = [
  { scale: 'minorPent',  octave: 0,  sends: { room: 0.18, cave: 0.34 } },   // 01 撒哈拉
  { scale: 'hijaz',      octave: 0,  sends: { hall: 0.30, room: 0.12 } },   // 02 埃及
  { scale: 'majorPent',  octave: -1, sends: { cave: 0.42 } },               // 03 汉拓片
  { scale: 'majorPent',  octave: 0,  sends: { hall: 0.26 } },               // 04 唐白描
  { scale: 'majorPent',  octave: -1, sends: { cave: 0.46, hall: 0.16 } },   // 05 宋山水
  { scale: 'majorPent',  octave: 0,  sends: { room: 0.26 } },               // 06 清明上河
  { scale: 'minorPent',  octave: 0,  sends: { cave: 0.38, room: 0.10 } },   // 07 玛雅
  { scale: 'bhairav',    octave: 0,  sends: { hall: 0.36 } },               // 08 莫卧儿
  { scale: 'minorPent',  octave: -1, sends: { cave: 0.50, hall: 0.14 } },   // 09 八大
  { scale: 'pelog',      octave: 0,  sends: { hall: 0.30, room: 0.10 } },   // 10 皮影
  { scale: 'inScale',    octave: 0,  sends: { room: 0.26, hall: 0.10 } },   // 11 浮世绘
  { scale: 'lydian',     octave: 0,  sends: { hall: 0.46 } },               // 12 星月夜
  { scale: 'wholeTone',  octave: 0,  sends: { plate: 0.30, hall: 0.18 } },  // 13 呐喊
  { scale: 'harmonic',   octave: -1, sends: { cave: 0.48, plate: 0.14 } },  // 14 诺斯费拉图
  { scale: 'minor',      octave: 0,  sends: { plate: 0.18, delay: 0.30 } }, // 15 示波器
  { scale: 'minor',      octave: 0,  sends: { plate: 0.14 } },              // 16 8-bit
  { scale: 'minor',      octave: 0,  sends: { plate: 0.24 } },              // 17 聊天窗
  { scale: 'minor',      octave: 0,  sends: {} },                           // 18 蒸汽波（tape 自处理）
  { scale: 'minor',      octave: 0,  sends: { plate: 0.28, hall: 0.12 } },  // 19 竖屏
  { scale: 'dorian',     octave: 0,  sends: { plate: 0.20, delay: 0.24 } }, // 20 代码
];

// ---AUTO-SLOTS-START---
const SLOTS = [];
SLOTS[0] = m01;
SLOTS[1] = m02;
SLOTS[2] = m03;
SLOTS[3] = m04;
SLOTS[4] = m05;
SLOTS[5] = m06;
SLOTS[6] = m07;
SLOTS[7] = m08;
SLOTS[8] = m09;
SLOTS[9] = m10;
SLOTS[10] = m11;
SLOTS[11] = m12;
SLOTS[12] = m13;
SLOTS[13] = m14;
SLOTS[14] = m15;
SLOTS[15] = m16;
SLOTS[16] = m17;
SLOTS[17] = m18;
SLOTS[18] = m19;
SLOTS[19] = m20;
// ---AUTO-SLOTS-END---

export function audioModuleFor(i) {
  const m = SLOTS[i];
  const p = PRESET[i] || {};
  if (!m) return { ...p, ...neutral(i, p) };
  return { ...p, ...m };
}

export { neutral };
