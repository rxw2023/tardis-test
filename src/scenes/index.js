// ============================================================
// index.js — 场景注册表
// 每个版块可提供自己的模块：
//   render(g, meta, local, index)    必须
//   camera(local) → { z, fx, fy }    可选：版块内推镜
//   drawVehicle(g, opts)             可选：本版块自己的时空舱画法
// 未注册的版块自动退回占位场景 + 默认时空舱
// ============================================================

import * as sahara from './s01-sahara.js';
import * as egypt from './s02-egypt.js';
import * as hanrubbing from './s03-hanrubbing.js';
import * as tangline from './s04-tangline.js';
import * as songshan from './s05-songshan.js';
import * as qingming from './s06-qingming.js';
import * as maya from './s07-maya.js';
import * as mughal from './s08-mughal.js';
import * as bada from './s09-bada.js';
import * as wayang from './s10-wayang.js';
import * as ukiyoe from './s11-ukiyoe.js';
import * as starrynight from './s12-starrynight.js';
import * as scream from './s13-scream.js';
import * as nosferatu from './s14-nosferatu.js';
import * as oscilloscope from './s15-oscilloscope.js';
import * as bit8 from './s16-8bit.js';
import * as chatwindow from './s17-chatwindow.js';
import * as vaporwave from './s18-vaporwave.js';
import * as vertical from './s19-vertical.js';
import * as codeaesthetic from './s20-codeaesthetic.js';

const REGISTRY = {
  0: sahara,          // 01 撒哈拉岩画
  1: egypt,           // 02 埃及壁画
  2: hanrubbing,      // 03 汉画像石拓片
  3: tangline,        // 04 唐代白描
  4: songshan,        // 05 宋代山水
  5: qingming,        // 06 清明上河图
  6: maya,            // 07 玛雅抄本
  7: mughal,          // 08 莫卧儿细密画
  8: bada,            // 09 八大山人写意
  9: wayang,          // 10 爪哇皮影
  10: ukiyoe,         // 11 浮世绘
  11: starrynight,    // 12 星月夜
  12: scream,         // 13 呐喊
  13: nosferatu,      // 14 诺斯费拉图
  14: oscilloscope,   // 15 示波器
  15: bit8,           // 16 8-bit 像素
  16: chatwindow,     // 17 聊天窗口
  17: vaporwave,      // 18 蒸汽波
  18: vertical,       // 19 竖屏短视频
  19: codeaesthetic,  // 20 代码美学
};

export function moduleFor(i) {
  const m = REGISTRY[i];
  return m && m.render ? m : null;
}
