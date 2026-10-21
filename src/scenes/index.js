// ============================================================
// index.js — 场景注册表
// 每个版块可提供自己的模块：
//   render(g, meta, local, index)    必须
//   camera(local) → { z, fx, fy }    可选：版块内推镜
//   drawVehicle(g, opts)             可选：本版块自己的时空舱画法
// 未注册的版块自动退回占位场景 + 默认时空舱
// ============================================================

import * as sahara from './s01-sahara.js';
import * as songshan from './s05-songshan.js';

const REGISTRY = {
  0: sahara,      // 01 撒哈拉岩画
  4: songshan,    // 05 宋代山水
};

export function moduleFor(i) {
  const m = REGISTRY[i];
  return m && m.render ? m : null;
}
