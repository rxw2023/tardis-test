// ============================================================
// s12-starrynight.js — 第 12 版块：星月夜（1889 · 后印象派漩涡星空母题）
//
// 只取母题：漩涡星空 + 一棵深色的树 + 山下的村庄 + 一轮月。
// 全部形态自绘：流场、山脊、房舍、树形、星位均为本文件内生成，
// 不描摹任何具体作品的旋涡布局 / 树形 / 村庄轮廓与位置关系。
//
// 笔法（本格命脉）：厚涂短笔触。每一笔是一条粗短弧形色块
//   （长 26~52，宽 9~17），沿自绘流场排布，笔笔可见、互不融合。
//   实现为"变宽度闭合多边形填充"（不走 line()，避免串珠感），
//   约三成笔触另加一道侧向高光棱，读作颜料的厚度。
// 全幅约 2100 笔，一次烘焙进模块级 createGraphics 静态层。
//
// 梗（第 2 小节）：舱体的时间漩涡与这片星空同频。
//   半径 220 内的笔触被"带跑"：转速由 0.5 圈/2拍 提到 1.5 圈/2拍，
//   方向逐步倒向舱体漩涡的切向；舱体走后 1 秒阻尼回原速。
//   共振最强的一刻，村中小教堂的尖顶被卷歪 6 度再弹回。
// ============================================================

import { TAU, BEAT, SCENE_LEN, hoverY, swirlAngle, smooth, routeU } from '../beat/beats.js';
import { mulberry32, inPoly, vignette, grain } from '../kit/kit.js';
import { drawCapsule } from '../rig/capsule.js';

// ---- 调色（简报给定）----
const DEEP = [26, 42, 82];      // 深蓝
const COBALT = [42, 74, 138];   // 钴蓝
const YELLOW = [232, 217, 106]; // 亮黄
const PALE = [216, 232, 240];   // 白
const DGREEN = [20, 40, 28];    // 暗绿
const INDIGO = [58, 58, 122];   // 靛

// 天空色阶（按亮度参数 v 取色）
const SKY_RAMP = [
  [0.00, [13, 21, 50]],
  [0.30, [24, 40, 80]],
  [0.55, [34, 56, 110]],
  [0.78, [42, 74, 138]],
  [0.98, [58, 62, 122]],
  [1.20, [104, 136, 182]],
  [1.42, [156, 186, 216]],
  [1.70, [206, 224, 238]],
];
// 山脊色阶（蓝紫，比夜空亮半档，读作一条横带）
const MT_RAMP = [
  [0.00, [26, 30, 62]],
  [0.40, [38, 44, 84]],
  [0.70, [56, 60, 108]],
  [1.00, [80, 88, 138]],
];
// 树色阶（深绿黑 → 冷青受光）
const TREE_RAMP = [
  [0.00, [7, 13, 10]],
  [0.34, [14, 28, 20]],
  [0.60, [20, 40, 28]],
  [0.84, [28, 56, 44]],
  [1.05, [44, 74, 64]],
];

const MOON = { x: 822, y: 142, r: 54, bx: 850, by: 130, br: 51 };

// ---- 流场：2 个大漩涡 + 6 个小涡流 + 噪声扰动 ----
// 位置与转向全部自排，与任何既有作品无关
const BIG = [
  { x: 296, y: 208, r: 336, s: 1.60, d: -1 },
  { x: 706, y: 332, r: 306, s: 1.42, d: 1 },
];
const EDDY = [
  { x: 150, y: 126, r: 98, s: 0.95, d: 1 },
  { x: 512, y: 136, r: 86, s: 0.86, d: -1 },
  { x: 906, y: 292, r: 94, s: 0.80, d: 1 },
  { x: 392, y: 452, r: 80, s: 0.72, d: -1 },
  { x: 648, y: 468, r: 74, s: 0.66, d: 1 },
  { x: 836, y: 156, r: 76, s: 0.80, d: -1 },
];

function flow(x, y) {
  const n = 0.60 * Math.sin(x * 0.0121 + y * 0.0067)
    + 0.38 * Math.sin(y * 0.0183 - x * 0.0043 + 1.7);
  const a0 = 0.12 * Math.sin(y * 0.0092) + n;
  let vx = Math.cos(a0);
  let vy = Math.sin(a0);
  for (let i = 0; i < BIG.length; i++) {
    const s = BIG[i];
    const dx = x - s.x, dy = y - s.y;
    const d = Math.hypot(dx, dy);
    if (d > s.r || d < 1e-3) continue;
    const w = s.s * Math.pow(1 - d / s.r, 0.72);
    const ta = Math.atan2(dy, dx) + s.d * Math.PI / 2;
    vx += Math.cos(ta) * w;
    vy += Math.sin(ta) * w;
  }
  for (let i = 0; i < EDDY.length; i++) {
    const s = EDDY[i];
    const dx = x - s.x, dy = y - s.y;
    const d = Math.hypot(dx, dy);
    if (d > s.r || d < 1e-3) continue;
    const w = s.s * Math.pow(1 - d / s.r, 0.7);
    const ta = Math.atan2(dy, dx) + s.d * Math.PI / 2;
    vx += Math.cos(ta) * w;
    vy += Math.sin(ta) * w;
  }
  return Math.atan2(vy, vx);
}

// ---- 山脊线（自排）----
const RIDGE = [
  [-20, 604], [70, 556], [150, 576], [240, 528], [330, 552],
  [420, 514], [520, 548], [610, 504], [700, 540], [790, 510],
  [880, 548], [960, 528], [1020, 566],
];

function ridgeY(x) {
  if (x <= RIDGE[0][0]) return RIDGE[0][1];
  for (let i = 1; i < RIDGE.length; i++) {
    if (x <= RIDGE[i][0]) {
      const p = RIDGE[i - 1], q = RIDGE[i];
      return p[1] + (q[1] - p[1]) * ((x - p[0]) / (q[0] - p[0]));
    }
  }
  return RIDGE[RIDGE.length - 1][1];
}

// ---- 左侧那棵树：火焰状纵贯（自绘形态）----
const TREE_ROOT_Y = 732;
const TREE_SPAN = 588;

function treeSpine(u) {
  const y = TREE_ROOT_Y - u * TREE_SPAN;
  const x = 196 + 30 * Math.sin(u * 3.4) + 13 * Math.sin(u * 7.1 + 1.2);
  return [x, y];
}

function treeWidth(u) {
  const taper = 1 - 0.78 * u;
  const bulge = 0.74 + 0.30 * Math.sin(u * 5.2 + 0.4) + 0.12 * Math.sin(u * 11 + 2.0);
  return Math.max(4, 74 * taper * bulge);
}

function treeU(y) {
  return Math.min(1, Math.max(0, (TREE_ROOT_Y - y) / TREE_SPAN));
}

// 树的火焰方向：整体向上，随高度左右摆，越靠外缘越向外撇
function treeFlow(x, y) {
  const u = treeU(y);
  const sx = treeSpine(u)[0];
  const wig = 0.62 * Math.sin(u * 4.6) + 0.30 * Math.sin(x * 0.021 + u * 9.0);
  return -Math.PI / 2 + wig * 0.66 + (x - sx) * 0.0045;
}

// 树的轮廓：两条边各自带火焰状的舔边（不对称、高频摆动），避免读成圆锥杉
const TREE_POLY = (() => {
  const L = [], R = [];
  const N = 34;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = treeSpine(u);
    const w = treeWidth(u);
    const wl = w * (1 + 0.17 * Math.sin(u * 9.3) + 0.10 * Math.sin(u * 17 + 1.1));
    const wr = w * (1 + 0.17 * Math.sin(u * 8.1 + 2.2) + 0.10 * Math.sin(u * 15.7 + 0.6));
    L.push([p[0] - Math.max(3, wl), p[1]]);
    R.push([p[0] + Math.max(3, wr), p[1]]);
  }
  R.reverse();
  return L.concat(R);
})();

function inTree(x, y) {
  if (x < 80 || x > 300 || y < 130 || y > 740) return false;
  return inPoly(x, y, TREE_POLY);
}

// ---- 村庄（自绘简笔房舍：方盒 + 尖顶，其中一个带尖顶教堂）----
const HOUSES = [
  { x: 228, w: 58, h: 48, g: 18 },
  { x: 294, w: 46, h: 56, g: 20 },
  { x: 406, w: 60, h: 46, g: 17 },
  { x: 476, w: 44, h: 62, g: 22 },
  { x: 528, w: 64, h: 44, g: 16 },
  { x: 600, w: 48, h: 58, g: 21 },
  { x: 656, w: 56, h: 48, g: 18 },
  { x: 720, w: 50, h: 60, g: 20 },
  { x: 778, w: 52, h: 46, g: 17 },
  { x: 838, w: 46, h: 52, g: 19 },
];
const CHURCH = { x: 346, w: 54, h: 72, spire: 88 };

function groundY(x) { return 642 + 6 * Math.sin(x * 0.005); }

// ---- 11 颗星（自排星位）----
const STARS = [
  { x: 408, y: 104, r: 21 }, { x: 566, y: 148, r: 17 }, { x: 686, y: 86, r: 24 },
  { x: 452, y: 258, r: 15 }, { x: 618, y: 292, r: 22 }, { x: 772, y: 246, r: 16 },
  { x: 336, y: 152, r: 13 }, { x: 508, y: 402, r: 18 }, { x: 664, y: 418, r: 14 },
  { x: 878, y: 336, r: 19 }, { x: 372, y: 348, r: 12 },
];

// ============================================================
// 色阶 / 小工具
// ============================================================
function rampAt(stops, v) {
  if (v <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (v >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const u = (v - a[0]) / (b[0] - a[0]);
      return [
        a[1][0] + (b[1][0] - a[1][0]) * u,
        a[1][1] + (b[1][1] - a[1][1]) * u,
        a[1][2] + (b[1][2] - a[1][2]) * u,
      ];
    }
  }
  return last[1];
}

function mixc(a, b, u) {
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
}

function angLerp(a, b, u) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * u;
}

// ---- 厚涂短笔触：变宽度闭合多边形（纯 ctx，避开 p5 形状坑）----
// bend 为弓形量（正=向法向鼓起），两端钝收，中段饱满 —— 读作一笔颜料
const _ix = new Float64Array(8);
const _iy = new Float64Array(8);
const _iw = new Float64Array(8);

function impasto(g, x, y, ang, len, wid, rgb, alpha, bend) {
  const ctx = g.drawingContext;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const px = -sa, py = ca;
  const N = 6;
  const half = len * 0.5;
  const hw0 = wid * 0.5;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = -1 + (2 * i) / N;
    const bow = bend * (1 - u * u) * len;
    _ix[i] = x + ca * (u * half) + px * bow;
    _iy[i] = y + sa * (u * half) + py * bow;
    _iw[i] = hw0 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 6)), 0.22);
  }
  ctx.moveTo(_ix[0] + px * _iw[0], _iy[0] + py * _iw[0]);
  for (let i = 1; i <= N; i++) ctx.lineTo(_ix[i] + px * _iw[i], _iy[i] + py * _iw[i]);
  for (let i = N; i >= 0; i--) ctx.lineTo(_ix[i] - px * _iw[i], _iy[i] - py * _iw[i]);
  ctx.closePath();
  ctx.fillStyle = 'rgba(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ',' + alpha.toFixed(3) + ')';
  ctx.fill();
}

// 粗弧（星的同心笔触 / 共振环）：给定圆心、半径、中心角、跨度
function arcBlade(g, cx, cy, R, aMid, span, wid, rgb, alpha) {
  const sag = Math.tan(span / 4) * 0.5;          // 圆弧对应的弓形量
  const chord = 2 * R * Math.sin(span / 2);
  const mx = cx + Math.cos(aMid) * R * Math.cos(span / 2);
  const my = cy + Math.sin(aMid) * R * Math.cos(span / 2);
  impasto(g, mx, my, aMid + Math.PI / 2, chord, wid, rgb, alpha, sag);
}

// 径向柔光（纯 ctx）
function radialGlow(g, x, y, r, rgb, alpha) {
  if (alpha <= 0.004 || r <= 0) return;
  const ctx = g.drawingContext;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  const c = (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0);
  gr.addColorStop(0, 'rgba(' + c + ',' + alpha.toFixed(3) + ')');
  gr.addColorStop(0.42, 'rgba(' + c + ',' + (alpha * 0.40).toFixed(3) + ')');
  gr.addColorStop(1, 'rgba(' + c + ',0)');
  ctx.save();
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ============================================================
// 取色：按位置决定这是天空笔触还是山体笔触
// ============================================================
function skyValue(x, y, r1) {
  let v = 0.52
    + 0.26 * Math.sin(x * 0.0104 - y * 0.0071 + 0.6)
    + 0.17 * Math.sin(y * 0.0155 + x * 0.0035);
  for (let i = 0; i < BIG.length; i++) {
    const s = BIG[i];
    const d = Math.hypot(x - s.x, y - s.y);
    if (d < s.r) v += 0.30 * (1 - d / s.r);
  }
  for (let i = 0; i < EDDY.length; i++) {
    const s = EDDY[i];
    const d = Math.hypot(x - s.x, y - s.y);
    if (d < s.r) v += 0.20 * (1 - d / s.r);
  }
  // 星与月的邻域提亮
  for (let i = 0; i < STARS.length; i++) {
    const d = Math.hypot(x - STARS[i].x, y - STARS[i].y);
    if (d < 130) v += 0.34 * (1 - d / 130);
  }
  const dm = Math.hypot(x - MOON.x, y - MOON.y);
  if (dm < 190) v += 0.30 * (1 - dm / 190);
  return v + (r1 - 0.5) * 0.34;
}

function skyColor(x, y, r1) {
  const v = skyValue(x, y, r1);
  let c = rampAt(SKY_RAMP, v);
  // 星与月附近染黄
  let warm = 0;
  for (let i = 0; i < STARS.length; i++) {
    const d = Math.hypot(x - STARS[i].x, y - STARS[i].y);
    if (d < 105) warm = Math.max(warm, 0.42 * (1 - d / 105));
  }
  const dm = Math.hypot(x - MOON.x, y - MOON.y);
  if (dm < 160) warm = Math.max(warm, 0.40 * (1 - dm / 160));
  if (warm > 0) c = mixc(c, YELLOW, warm * 0.55);
  return c;
}

function mountColor(x, y, r1) {
  let v = 0.40 + 0.26 * Math.sin(x * 0.013 + y * 0.019) + (r1 - 0.5) * 0.42;
  const dy = y - ridgeY(x);
  if (dy < 30) v += 0.30 * (1 - dy / 30);          // 山脊受光的一线
  return rampAt(MT_RAMP, v);
}

function strokeColor(x, y, r1) {
  return y < ridgeY(x) ? skyColor(x, y, r1) : mountColor(x, y, r1);
}

// ============================================================
// 静态层（烘焙一次）
// ============================================================
let layer = null;
let resPool = null;

function ensure(g) {
  if (layer) return layer;
  layer = g.createGraphics(1000, 1000);
  layer.pixelDensity(1);
  bake(layer);
  resPool = buildResPool();
  return layer;
}

function bake(pg) {
  const ctx = pg.drawingContext;
  ctx.save();
  const gr = ctx.createLinearGradient(0, 0, 0, 760);
  gr.addColorStop(0, 'rgb(11,17,42)');
  gr.addColorStop(0.40, 'rgb(21,33,74)');
  gr.addColorStop(0.76, 'rgb(31,45,86)');
  gr.addColorStop(1, 'rgb(15,19,38)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 1000, 1000);
  ctx.restore();

  bakeSky(pg);
  bakeMoon(pg);
  bakeMountains(pg);
  bakeVillage(pg);
  bakeTree(pg);
  bakeField(pg);
}

// ---- 天空：约 1300 笔厚涂短笔触 ----
function bakeSky(pg) {
  const rnd = mulberry32(12071);
  const step = 22;
  for (let gy = 26; gy < 552; gy += step) {
    for (let gx = 6; gx < 1000; gx += step) {
      if (rnd() < 0.05) continue;
      const x = gx + (rnd() - 0.5) * step * 0.92;
      const y = gy + (rnd() - 0.5) * step * 0.92;
      if (y > ridgeY(x) + 4) continue;
      if (inTree(x, y)) continue;
      const a = flow(x, y);
      const len = 26 + rnd() * 24;
      const wid = 9 + rnd() * 7.5;
      const c = strokeColor(x, y, rnd());
      // 顶部门框区（y<80）笔触渐隐，避免与发光门柱打架
      const fade = 0.34 + 0.66 * smooth(12, 72, y);
      const al = (0.74 + rnd() * 0.24) * fade;
      impasto(pg, x, y, a, len, wid, c, al, (rnd() - 0.5) * 0.22);
      // 两成笔触加一道受光的高光棱（朝上那一侧）
      if (rnd() < 0.22) {
        const px = -Math.sin(a), py = Math.cos(a);
        const s = py < 0 ? 1 : -1;
        impasto(pg, x + px * s * wid * 0.30, y + py * s * wid * 0.30,
          a, len * 0.74, wid * 0.34, mixc(c, PALE, 0.6), al * 0.46,
          (rnd() - 0.5) * 0.18);
      }
    }
  }
}

// ---- 一弯月（右上）----
function bakeMoon(pg) {
  const poly = crescentPoly(MOON.x, MOON.y, MOON.r, MOON.bx, MOON.by, MOON.br);
  const ctx = pg.drawingContext;
  // 月晕（烘焙进静态层）
  radialGlow(pg, MOON.x, MOON.y, 210, [238, 226, 156], 0.28);
  radialGlow(pg, MOON.x, MOON.y, 108, [252, 242, 190], 0.42);
  if (poly) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(236,226,150,0.96)';
    ctx.fill();
    ctx.restore();
    // 月面上几笔厚涂（沿月缘方向）
    const rnd = mulberry32(3301);
    for (let i = 0; i < 22; i++) {
      const u = rnd();
      const idx = Math.floor(u * (poly.length - 1));
      const p = poly[idx];
      const a = Math.atan2(p[1] - MOON.y, p[0] - MOON.x) + Math.PI / 2;
      const c = rnd() < 0.4 ? [255, 250, 214] : YELLOW;
      impasto(pg, p[0], p[1], a, 14 + rnd() * 12, 7 + rnd() * 5, c, 0.82, 0.12);
    }
  }
}

function crescentPoly(cx, cy, R, bx, by, Rb) {
  const n = 72;
  const outer = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    if (Math.hypot(x - bx, y - by) >= Rb) outer.push([x, y]);
  }
  const inner = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = bx + Math.cos(a) * Rb, y = by + Math.sin(a) * Rb;
    if (Math.hypot(x - cx, y - cy) <= R) inner.push([x, y]);
  }
  if (outer.length < 3 || inner.length < 3) return null;
  const rot = (arr, cxx, cyy) => {
    const angs = arr.map((p) => Math.atan2(p[1] - cyy, p[0] - cxx));
    let gi = 0, gmax = -1;
    for (let i = 0; i < angs.length; i++) {
      const j = (i + 1) % angs.length;
      let d = angs[j] - angs[i];
      if (d < 0) d += TAU;
      if (d > gmax) { gmax = d; gi = j; }
    }
    const out = [];
    for (let k = 0; k < arr.length; k++) out.push(arr[(gi + k) % arr.length]);
    return out;
  };
  const O = rot(outer, cx, cy);
  let I = rot(inner, bx, by);
  const pe = O[O.length - 1];
  if (Math.hypot(I[0][0] - pe[0], I[0][1] - pe[1]) > Math.hypot(I[I.length - 1][0] - pe[0], I[I.length - 1][1] - pe[1])) {
    I = I.slice().reverse();
  }
  return O.concat(I);
}

// ---- 山脊：深蓝紫横向带，约 300 笔 ----
function bakeMountains(pg) {
  const rnd = mulberry32(5207);
  const ctx = pg.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(RIDGE[0][0], RIDGE[0][1]);
  for (let i = 1; i < RIDGE.length; i++) ctx.lineTo(RIDGE[i][0], RIDGE[i][1]);
  ctx.lineTo(1020, 720);
  ctx.lineTo(-20, 720);
  ctx.closePath();
  ctx.fillStyle = 'rgb(26,29,60)';
  ctx.fill();
  ctx.restore();

  const step = 18;
  for (let gy = 496; gy < 700; gy += step) {
    for (let gx = -14; gx < 1014; gx += step) {
      const x = gx + (rnd() - 0.5) * step;
      const y = gy + (rnd() - 0.5) * step;
      if (y < ridgeY(x) - 2) continue;
      if (inTree(x, y)) continue;
      const a = 0.10 + 0.42 * Math.sin(x * 0.019 + y * 0.011) + (rnd() - 0.5) * 0.20;
      const c = mountColor(x, y, rnd());
      impasto(pg, x, y, a, 28 + rnd() * 22, 10 + rnd() * 7, c, 0.82 + rnd() * 0.18, (rnd() - 0.5) * 0.14);
    }
  }
  // 山脊受光的一线：沿脊线叠一排更亮的横笔（把"带"读出来）
  for (let x = -10; x < 1010; x += 34) {
    const y = ridgeY(x) + 5 + rnd() * 16;
    const a = 0.06 + (rnd() - 0.5) * 0.16;
    impasto(pg, x, y, a, 26 + rnd() * 30, 9 + rnd() * 6,
      mixc([88, 98, 150], [136, 146, 190], rnd()), 0.48 + rnd() * 0.24, 0.06);
  }
}

// ---- 山下村庄：8~12 个简笔房舍（教堂尖顶留到每帧画）----
function bakeVillage(pg) {
  const rnd = mulberry32(6612);
  const ctx = pg.drawingContext;
  for (let i = 0; i < HOUSES.length; i++) paintHouse(pg, ctx, HOUSES[i], rnd, false);
  paintHouse(pg, ctx, CHURCH, rnd, true);
}

function paintHouse(pg, ctx, h, rnd, isChurch) {
  const gy = groundY(h.x + h.w / 2);
  const top = gy - h.h;
  ctx.save();
  ctx.fillStyle = isChurch ? 'rgb(36,40,76)' : 'rgb(30,32,62)';
  ctx.beginPath();
  ctx.rect(h.x, top, h.w, h.h);
  ctx.fill();
  // 尖顶
  ctx.fillStyle = isChurch ? 'rgb(22,24,48)' : 'rgb(19,20,42)';
  ctx.beginPath();
  ctx.moveTo(h.x - 4, top + 2);
  ctx.lineTo(h.x + h.w / 2, top - h.g);
  ctx.lineTo(h.x + h.w + 4, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 房身上的几笔厚涂（横竖交替，笔笔可见）
  const n = 6 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const x = h.x + rnd() * h.w;
    const y = top + rnd() * h.h;
    const vert = rnd() < 0.55;
    const a = vert ? Math.PI / 2 + (rnd() - 0.5) * 0.24 : (rnd() - 0.5) * 0.18;
    const c = rampAt(MT_RAMP, 0.42 + rnd() * 0.62);
    impasto(pg, x, y, a, 15 + rnd() * 15, 7 + rnd() * 5, c, 0.9, 0.05);
  }
  // 一两个暖黄小窗（村里的灯）
  const wn = 1 + (rnd() < 0.6 ? 1 : 0);
  for (let i = 0; i < wn; i++) {
    const wx = h.x + h.w * (0.26 + rnd() * 0.48);
    const wy = top + h.h * (0.30 + rnd() * 0.42);
    impasto(pg, wx, wy, Math.PI / 2, 9 + rnd() * 5, 7 + rnd() * 3, [240, 210, 120], 0.95, 0.02);
  }
  if (isChurch) {
    // 教堂圆窗（尖顶另画）
    impasto(pg, h.x + h.w / 2, top + 16, 0, 13, 11, [242, 218, 132], 0.92, 0.02);
  }
}

// ---- 左侧深绿黑的火焰状树 ----
function bakeTree(pg) {
  const ctx = pg.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(TREE_POLY[0][0], TREE_POLY[0][1]);
  for (let i = 1; i < TREE_POLY.length; i++) ctx.lineTo(TREE_POLY[i][0], TREE_POLY[i][1]);
  ctx.closePath();
  ctx.fillStyle = 'rgb(11,22,16)';
  ctx.fill();
  ctx.restore();

  const rnd = mulberry32(9403);
  const step = 16;
  for (let gy = 140; gy < 736; gy += step) {
    for (let gx = 80; gx < 302; gx += step) {
      const x = gx + (rnd() - 0.5) * step;
      const y = gy + (rnd() - 0.5) * step;
      if (!inPoly(x, y, TREE_POLY)) continue;
      const u = treeU(y);
      const sx = treeSpine(u)[0];
      const hw = Math.max(6, treeWidth(u));
      const side = Math.max(-1, Math.min(1, (x - sx) / hw));
      const a = treeFlow(x, y);
      const c = rampAt(TREE_RAMP, 0.30 + rnd() * 0.5 + 0.30 * side);
      impasto(pg, x, y, a, 24 + rnd() * 22, 9 + rnd() * 7, c, 0.86 + rnd() * 0.14, (rnd() - 0.5) * 0.26);
      if (rnd() < 0.16) {
        impasto(pg, x + 4, y - 2, a, 18 + rnd() * 14, 5 + rnd() * 3, mixc(c, [56, 92, 78], 0.7), 0.42, 0.1);
      }
    }
  }
}

// ---- 近景暗色田野（横向短笔触；公路会盖在 y770..940 上）----
function bakeField(pg) {
  const ctx = pg.drawingContext;
  ctx.save();
  const gr = ctx.createLinearGradient(0, 620, 0, 1000);
  gr.addColorStop(0, 'rgb(15,19,32)');
  gr.addColorStop(1, 'rgb(8,10,18)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 620, 1000, 380);
  ctx.restore();

  const rnd = mulberry32(2213);
  for (let gy = 674; gy < 800; gy += 26) {
    for (let gx = -10; gx < 1010; gx += 32) {
      const x = gx + (rnd() - 0.5) * 26;
      const y = gy + (rnd() - 0.5) * 18;
      const a = (rnd() - 0.5) * 0.16;
      const c = rampAt([[0, [12, 16, 26]], [0.5, [18, 26, 32]], [1, [28, 38, 44]]], rnd());
      impasto(pg, x, y, a, 30 + rnd() * 22, 9 + rnd() * 6, c, 0.80 + rnd() * 0.18, 0.05);
    }
  }
}

// ============================================================
// 共振笔触候选池（每帧只画落进舱体半径 220 的那些）
// ============================================================
function buildResPool() {
  const rnd = mulberry32(8821);
  const out = [];
  const step = 25;
  for (let gy = 58; gy < 660; gy += step) {
    for (let gx = 8; gx < 1000; gx += step) {
      const x = gx + (rnd() - 0.5) * step;
      const y = gy + (rnd() - 0.5) * step;
      if (y > ridgeY(x) + 6) continue;      // 共振只在天空里卷，不扫过村庄
      if (inTree(x, y)) continue;
      out.push({
        x, y,
        a: flow(x, y),
        len: 26 + rnd() * 26,
        wid: 9.5 + rnd() * 7.5,
        c: strokeColor(x, y, rnd()),
        al: 0.72 + rnd() * 0.26,
        bend: (rnd() - 0.5) * 0.24,
      });
    }
  }
  return out;
}

// ============================================================
// 节拍小工具
// ============================================================
// 共振强度：第 2 小节（local 2~4）最强，第 3 拍（local 3.0）峰值，走后 1 秒阻尼回原速
function resonanceAt(local) {
  let v = smooth(1.2, 2.2, local);
  if (local > 4.0) v *= Math.exp(-(local - 4.0) / 0.45);
  const pk = Math.exp(-Math.pow((local - 3.0) / 0.22, 2));
  return Math.min(1, v * (0.80 + 0.28 * pk));
}

// 教堂尖顶被卷歪的角度（弧度）：峰值约 6 度，随后弹性衰减回正
function spireTilt(local) {
  const k = local - 3.0;
  if (k < 0 || k > 1.5) return 0;
  const env = (1 - Math.exp(-k / 0.045)) * Math.exp(-k / 0.34);
  return 0.175 * env * Math.cos(k * 2.6);
}

function crossGlow(local) {
  const d = Math.min(local, SCENE_LEN - local);
  return Math.exp(-Math.pow(d / 0.42, 2));
}

function beatPulse(local) {
  const ph = local % BEAT;
  return Math.exp(-Math.pow(ph / 0.16, 2));
}

// ============================================================
// 每帧
// ============================================================
export function render(g, meta, local) {
  g.push();
  g.noStroke();
  g.image(ensure(g), 0, 0, 1000, 1000);

  const x = routeU(local) * 1000;
  const yb = 520 + hoverY(local) * 1.5;
  const cy = yb - 76.4;                       // 舱体中心（与 drawVehicle 一致）

  drawResonance(g, x, cy, resonanceAt(local), local);
  drawMoonGlow(g, local);
  drawStars(g, local);
  drawChurchSpire(g, spireTilt(local));

  grain(g, 0, 0, 1000, 1000, 12, 13);
  vignette(g, 0, 0, 1000, 1000, 74);

  // 过框：全幅笔触亮度统一提 8% 再收回
  const gl = crossGlow(local);
  if (gl > 0.01) {
    const ctx = g.drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(23,23,19,' + (gl * 0.94).toFixed(3) + ')';
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.restore();
  }
  g.pop();
}

export function drawVehicle(g, { x, local, t, wave }) {
  // 舱体从画面中部飞过：正常配色（青瓷+黄铜）、尺寸 0.78，不落公路
  drawCapsule(g, x, 520 + hoverY(local) * 1.5, 0.78, {
    t,
    driverPose: { t, wave },
  });
}

// ============================================================
// 共振：舱体周围 220 内的笔触被带跑
// ============================================================
const RES_R = 220;

function drawResonance(g, cx, cy, res, t) {
  if (res < 0.02 || !resPool) return;
  const ctx = g.drawingContext;

  // 盘内压暗一档，让"被带跑"的笔触读得出来
  const gr = ctx.createRadialGradient(cx, cy, 18, cx, cy, RES_R);
  gr.addColorStop(0, 'rgba(7,11,28,' + (0.20 * res).toFixed(3) + ')');
  gr.addColorStop(1, 'rgba(7,11,28,' + (0.55 * res).toFixed(3) + ')');
  ctx.save();
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(cx, cy, RES_R, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 转速：原速 0.5 圈/2拍 → 共振区 1.5 圈/2拍（多出来的 1 圈/秒即为 spin）
  const spin = res * swirlAngle(t);
  for (let i = 0; i < resPool.length; i++) {
    const s = resPool[i];
    const dx = s.x - cx, dy = s.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > RES_R) continue;
    const f = 1 - smooth(0.12, 1.0, d / RES_R);          // 随距离平滑过渡
    const tw = res * (0.28 + 0.52 * f);                  // 倒向舱体漩涡的切向
    const tang = Math.atan2(dy, dx) + Math.PI / 2;       // 与舱体漩涡同向
    const a = angLerp(s.a + spin, tang + spin, tw);
    const bright = 0.10 + 0.32 * res * f;
    impasto(g, s.x, s.y, a, s.len * (1 + 0.10 * res), s.wid * (1 + 0.08 * res),
      mixc(s.c, PALE, bright), Math.min(1, s.al * (0.66 + 0.30 * res * f)), s.bend);
  }

  // 三圈跟着舱体走的被带跑弧（小漩涡）
  for (let k = 0; k < 3; k++) {
    const R = 96 + k * 58;
    const n = 9 + k * 3;
    const al = 0.30 * res * (1 - k * 0.22);
    for (let i = 0; i < n; i++) {
      const aMid = swirlAngle(t) * 1.5 + (i / n) * TAU;
      arcBlade(g, cx, cy, R, aMid, TAU / n * 0.62, 8 + k * 2.2, [178, 208, 238], al);
    }
  }
}

// ============================================================
// 月：每帧只补一层随呼吸的光晕（月体本身在静态层里）
// ============================================================
function drawMoonGlow(g, local) {
  const b = 0.10 + 0.035 * Math.sin(local * 1.7);
  radialGlow(g, MOON.x, MOON.y, 240, [244, 232, 168], b);
}

// ============================================================
// 11 颗星：同心黄白笔触 + 光晕；强拍上按拍依次闪（每拍 3 颗环绕推进）
// ============================================================
function drawStars(g, local) {
  const beatIdx = Math.floor(local / BEAT);
  const group = ((beatIdx % 4) + 4) % 4;
  const pulse = beatPulse(local);
  const rnd = mulberry32(7717);

  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const lit = i % 4 === group ? 1 : 0;
    const k = 0.40 + 0.60 * lit * pulse;                 // 亮起的量
    const boost = 1 + 0.08 * lit * pulse;

    // 光晕（两层）
    radialGlow(g, s.x, s.y, s.r * (3.4 + 1.8 * k), [234, 220, 128], 0.30 * k);
    radialGlow(g, s.x, s.y, s.r * 1.75, [255, 248, 210], 0.50 * k);

    // 同心黄白笔触：四圈粗弧
    for (let j = 0; j < 4; j++) {
      const R = s.r * (0.52 + 0.62 * j);
      const a0 = 0.9 + j * 1.35 + i * 0.4;
      const span = 1.9 + 0.45 * ((j + i) % 3) - 0.2;
      const c = j === 0 ? [255, 250, 214] : (j < 3 ? YELLOW : mixc(COBALT, YELLOW, 0.55));
      arcBlade(g, s.x, s.y, R, a0 + swirlAngle(local) * 0.25 * lit, span,
        s.r * (0.52 - 0.07 * j), c, (0.72 - 0.14 * j) * (0.55 + 0.45 * k));
    }
    // 核心
    const ctx = g.drawingContext;
    ctx.save();
    ctx.fillStyle = 'rgba(255,252,226,' + (0.62 + 0.34 * k).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.34 * boost, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 闪的那一拍：把周围的星空笔触也点亮几笔（光溢进流场）
    if (lit && pulse > 0.15) {
      for (let j = 0; j < 3; j++) {
        const ang = rnd() * TAU;
        const rr = s.r * (1.5 + rnd() * 1.2);
        const px = s.x + Math.cos(ang) * rr, py = s.y + Math.sin(ang) * rr;
        impasto(g, px, py, flow(px, py), 22 + rnd() * 18, 8 + rnd() * 4,
          mixc(YELLOW, PALE, 0.35), 0.42 * pulse, 0.12);
      }
    }
  }
}

// ============================================================
// 教堂尖顶（每帧画：共振最强时被卷歪再弹回）
// ============================================================
function drawChurchSpire(g, tilt) {
  const gy = groundY(CHURCH.x + CHURCH.w / 2);
  const top = gy - CHURCH.h;
  const cx = CHURCH.x + CHURCH.w / 2;
  const H = CHURCH.spire;
  const ctx = g.drawingContext;

  g.push();
  g.translate(cx, top);
  g.rotate(tilt);

  // 尖顶（细长三角形）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-CHURCH.w * 0.34, 2);
  ctx.lineTo(0, -H);
  ctx.lineTo(CHURCH.w * 0.34, 2);
  ctx.closePath();
  ctx.fillStyle = 'rgb(17,19,42)';
  ctx.fill();
  ctx.restore();

  // 尖顶上的两笔厚涂（受光侧偏冷）
  impasto(g, -4, -H * 0.45, Math.PI / 2 + 0.05, H * 0.62, 9, [40, 46, 92], 0.88, 0.06);
  impasto(g, 4, -H * 0.40, Math.PI / 2 - 0.05, H * 0.5, 7, [66, 74, 126], 0.62, 0.06);
  // 顶上的小尖（自创，无任何宗教符号）
  impasto(g, 0, -H - 6, Math.PI / 2, 12, 7, [232, 214, 130], 0.85, 0.02);

  g.pop();
}
