// ============================================================
// index.js — 场景注册表
// 每个版块可提供自己的模块：
//   { render(g, meta, local, index),  drawVehicle?(g, opts) }
// 未提供的版块自动退回占位场景 + 默认时空舱
// ============================================================

import * as sahara from './s01-sahara.js';

export const SCENE_MODULES = [
  sahara,           // 01 撒哈拉岩画
];

export function moduleFor(i) {
  const m = SCENE_MODULES[i];
  return m && m.render ? m : null;
}
