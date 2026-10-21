// ============================================================
// s02-egypt.js — 第 02 格 · 埃及壁画（约前1300）
//
// 新王国墓室壁画的平面装饰体系：
//   · 赭黄平涂底 + 粗黑均匀轮廓（画线，不是运笔）+ 上下分带
//   · 人物一律正面律：头侧面 / 眼正面 / 肩胸正面 / 腿脚侧面
//   · 上带象形文字框（自创几何符号，不写真实圣书体）
//   · 中带：贵族立像 + 纸莎草沼泽 + 两个书吏在纸草卷上画三视图（梗）
//   · 下带：供奉行列 + 两株纸莎草
//   · 打格底稿：10×10 红色网格，部分显现、右下更明显
//
// 只画 y < 770（路面带由主调度绘制）。所有随机走 mulberry32(固定种子)。
// ============================================================

import { TAU, swirlAngle, hoverY, smooth } from '../beat/beats.js';
import { mulberry32, rrFill, rrStroke } from '../kit/kit.js';

// ---- 调色（briefs/02-egypt.md）----
const C = {
  bg:    [217, 192, 138],
  ink:   [38, 34, 28],
  red:   [164, 85, 45],
  blue:  [43, 106, 138],
  gold:  [212, 165, 49],
  turq:  [63, 138, 122],
  white: [239, 230, 207],
  wood:  [138, 106, 58],
  black: [47, 42, 34],
  grid:  [176, 64, 42],
  teal:  [31, 138, 148],
  tealD: [20, 96, 106],
  brass: [201, 151, 63],
  lamp:  [255, 217, 122],
  glass: [13, 57, 64],
  marsh: [79, 138, 106],
};

// ---- 版面 ----
const BAND_TOP_A = 92;      // 上边框条纹
const BAND_TOP_B = 228;     // 下边框条纹
const CARTOUCHE_Y = 158;    // 椭圆环中心
const REG_LINE = 648;       // 中带/下带 分带线
const HORIZON = 766;        // 地平线
const SCROLL = { x0: 654, x1: 896, y0: 462, y1: 582 };
const CELLS = [708, 775, 842];   // 三视图格子中心 x

// ============================================================
// 基础绘制小工具
// ============================================================
function fl(g, c, a) { g.fill(c[0], c[1], c[2], a == null ? 255 : a); }
// 过框时整幅壁画的轮廓线一起加深一次（全局线宽倍率）
let INK_BOOST = 1;
function st(g, c, w, a) {
  g.stroke(c[0], c[1], c[2], a == null ? 255 : a);
  g.strokeWeight(w * INK_BOOST);
}
function pline(g, pts) {
  g.beginShape();
  for (let i = 0; i < pts.length; i++) g.vertex(pts[i][0], pts[i][1]);
  g.endShape();
}
function shape(g, pts, fillC, sw, strokeC) {
  if (fillC) fl(g, fillC); else g.noFill();
  if (sw > 0) st(g, strokeC || C.ink, sw); else g.noStroke();
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  g.beginShape();
  for (let i = 0; i < pts.length; i++) g.vertex(pts[i][0], pts[i][1]);
  g.endShape(g.CLOSE);
}
function limb(g, pts, w, colr, ow) {
  g.noFill();
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  st(g, C.ink, w + ow);
  pline(g, pts);
  st(g, colr, w);
  pline(g, pts);
}
function disc(g, cx, cy, r, colr, ow) {
  g.noStroke();
  fl(g, colr);
  g.circle(cx, cy, r * 2);
  if (ow > 0) {
    g.noFill();
    st(g, C.ink, ow);
    g.circle(cx, cy, r * 2);
  }
}

// ============================================================
// 打格底稿：10×10 红色网格（部分显现，右下更明显）
// ============================================================
const GRID = (function buildGrid() {
  const rnd = mulberry32(90210);
  const seg = [];
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j < 8; j++) {
      const y1 = j * 100, y2 = Math.min(HORIZON, (j + 1) * 100);
      if (y1 >= HORIZON) continue;
      const bias = (i / 10) * 0.5 + (j / 8) * 0.5;
      const v = rnd();
      if (v > 0.34 + bias * 0.55) continue;
      seg.push({ x1: i * 100, y1, x2: i * 100, y2, a: 0.062 + 0.082 * (0.45 * bias + 0.55 * rnd()) });
    }
  }
  for (let j = 0; j <= 7; j++) {
    const y = j * 100;
    if (y >= HORIZON) continue;
    for (let i = 0; i < 10; i++) {
      const bias = ((i + 0.5) / 10) * 0.5 + (j / 8) * 0.5;
      const v = rnd();
      if (v > 0.34 + bias * 0.55) continue;
      seg.push({ x1: i * 100, y1: y, x2: (i + 1) * 100, y2: y, a: 0.062 + 0.082 * (0.45 * bias + 0.55 * rnd()) });
    }
  }
  return seg;
})();

function drawGrid(g, boost) {
  g.noFill();
  g.strokeCap(g.SQUARE);
  st(g, C.grid, 2.2);
  for (let i = 0; i < GRID.length; i++) {
    const s = GRID[i];
    st(g, C.grid, 2.2, 255 * Math.min(0.36, s.a * boost));
    g.line(s.x1, s.y1, s.x2, s.y2);
  }
}

// ============================================================
// 静态纹理层（模块级缓存，只建一次）
// ============================================================
let L = null;

// kit.grain() 走 g.OVERLAY，在 p5.Graphics 上取不到常量 → 自己烘颗粒
function speckle(pg, seed, amt) {
  pg.loadPixels();
  const rnd = mulberry32(seed);
  const n = pg.width * pg.height;
  for (let i = 0; i < n; i++) {
    const v = (rnd() - 0.5) * amt;
    const o = i * 4;
    pg.pixels[o] = Math.max(0, Math.min(255, pg.pixels[o] + v));
    pg.pixels[o + 1] = Math.max(0, Math.min(255, pg.pixels[o + 1] + v));
    pg.pixels[o + 2] = Math.max(0, Math.min(255, pg.pixels[o + 2] + v));
  }
  pg.updatePixels();
}

function tex(g) {
  if (L) return L;

  // ---- 底：赭黄平涂 + 大块面不匀 ----
  const base = g.createGraphics(1000, HORIZON);
  base.pixelDensity(1);
  base.noStroke();
  base.background(C.bg[0], C.bg[1], C.bg[2]);
  const rnd = mulberry32(4242);
  const mot = [[207, 180, 124], [227, 203, 153], [201, 173, 120], [222, 198, 146]];
  for (let i = 0; i < 38; i++) {
    const x = rnd() * 1000, y = rnd() * HORIZON, r = 95 + rnd() * 185;
    const c = mot[Math.floor(rnd() * mot.length)];
    base.fill(c[0], c[1], c[2], 26 + rnd() * 22);
    base.ellipse(x, y, r * 2, r * 1.5);
  }
  speckle(base, 33, 26);

  // ---- 剥落层（叠在最上面，露出底下更浅的黄）----
  const flake = g.createGraphics(1000, HORIZON);
  flake.pixelDensity(1);
  flake.clear();
  const r2 = mulberry32(777);
  let placed = 0, guard = 0;
  while (placed < 15 && guard++ < 600) {
    // 沿 100 单位的格线位置落点 → 像灰泥接缝处的起皮
    const gx = 1 + Math.floor(r2() * 8);
    const gy = 3 + Math.floor(r2() * 4);
    const x = gx * 100 + (r2() - 0.5) * 52;
    const y = gy * 100 + (r2() - 0.5) * 52;
    if (x > 580 && y > 430) continue;      // 别糊在书吏与三视图上
    if (x < 20 || x > 980 || y < 260 || y > 740) continue;
    const r = 9 + r2() * 15;
    const n = 5 + Math.floor(r2() * 3);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r2() * 0.35;
      const rr2 = r * (0.55 + r2() * 0.6);
      pts.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * 0.72]);
    }
    flake.fill(233, 216, 174, 100);
    flake.stroke(176, 140, 92, 95);
    flake.strokeWeight(1.8);
    flake.strokeJoin('round');
    flake.beginShape();
    for (let i = 0; i < pts.length; i++) flake.vertex(pts[i][0], pts[i][1]);
    flake.endShape('close');
    placed++;
  }

  L = { base, flake };
  return L;
}

// ============================================================
// 自创几何符号（不写真实圣书体）
// ============================================================
function glyphAt(g, kind, cx, cy, w, h, col) {
  const hw = w / 2, hh = h / 2;
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  switch (kind % 9) {
    case 0: { // 日轮 + 心点
      const d = Math.min(w, h) * 0.95;
      disc(g, cx, cy, d / 2, col, 2.2);
      g.noStroke(); fl(g, C.ink); g.circle(cx, cy, d * 0.17);
      break;
    }
    case 1: { // 羽
      shape(g, [[cx - hw * 0.18, cy - hh], [cx + hw * 0.52, cy - hh * 0.34],
                [cx + hw * 0.22, cy + hh], [cx - hw * 0.54, cy + hh * 0.22]], col, 2.2);
      g.noFill(); st(g, C.ink, 2);
      pline(g, [[cx - hw * 0.22, cy - hh * 0.44], [cx + hw * 0.24, cy - hh * 0.40]]);
      pline(g, [[cx - hw * 0.32, cy + hh * 0.06], [cx + hw * 0.14, cy + hh * 0.10]]);
      pline(g, [[cx - hw * 0.40, cy + hh * 0.52], [cx + hw * 0.02, cy + hh * 0.56]]);
      break;
    }
    case 2: { // 水波（三道折线）
      for (let k = 0; k < 3; k++) {
        const y = cy - hh * 0.62 + k * hh * 0.62;
        const p = [[cx - hw, y], [cx - hw * 0.33, y - hh * 0.30],
                   [cx + hw * 0.33, y + hh * 0.30], [cx + hw, y - hh * 0.08]];
        g.noFill(); st(g, C.ink, 5.5); pline(g, p);
        st(g, col, 3.2); pline(g, p);
      }
      break;
    }
    case 3: { // 眼形
      const pts = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([cx - hw + u * w, cy - Math.sin(u * Math.PI) * hh * 0.78]); }
      for (let i = 10; i >= 0; i--) { const u = i / 10; pts.push([cx - hw + u * w, cy + Math.sin(u * Math.PI) * hh * 0.78]); }
      shape(g, pts, C.white, 2.2);
      g.noStroke(); fl(g, C.ink); g.circle(cx, cy, Math.max(3, hh * 0.62));
      break;
    }
    case 4: { // 棒
      shape(g, [[cx - hw * 0.58, cy - hh], [cx - hw * 0.14, cy - hh],
                [cx - hw * 0.14, cy + hh * 0.12], [cx - hw * 0.58, cy + hh * 0.12]], col, 2);
      shape(g, [[cx + hw * 0.14, cy - hh], [cx + hw * 0.58, cy - hh],
                [cx + hw * 0.58, cy + hh * 0.12], [cx + hw * 0.14, cy + hh * 0.12]], col, 2);
      shape(g, [[cx - hw * 0.82, cy + hh * 0.34], [cx + hw * 0.82, cy + hh * 0.34],
                [cx + hw * 0.82, cy + hh * 0.78], [cx - hw * 0.82, cy + hh * 0.78]], col, 2);
      break;
    }
    case 5: { // 半圆拱
      const pts = [[cx - hw, cy + hh * 0.66]];
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI - (i / 14) * Math.PI;
        pts.push([cx + Math.cos(a) * hw * 0.92, cy + hh * 0.66 - Math.sin(a) * hh * 1.34]);
      }
      pts.push([cx + hw, cy + hh * 0.66]);
      shape(g, pts, col, 2.2);
      break;
    }
    case 6: { // 三角 + 点
      shape(g, [[cx, cy - hh], [cx + hw * 0.92, cy + hh * 0.86], [cx - hw * 0.92, cy + hh * 0.86]], col, 2.2);
      g.noStroke(); fl(g, C.ink); g.circle(cx, cy + hh * 0.36, Math.max(3, hh * 0.34));
      break;
    }
    case 7: { // 螺旋
      const p = [];
      for (let i = 0; i <= 42; i++) {
        const a = i * 0.46, r = hh * 0.95 * (1 - i / 48);
        p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.88]);
      }
      g.noFill(); st(g, C.ink, 5.4); pline(g, p);
      st(g, col, 3); pline(g, p);
      break;
    }
    default: { // 方 + 点 + 尾
      shape(g, [[cx - hw * 0.70, cy - hh * 0.66], [cx + hw * 0.70, cy - hh * 0.66],
                [cx + hw * 0.70, cy + hh * 0.50], [cx - hw * 0.70, cy + hh * 0.50]], col, 2.2);
      g.noStroke(); fl(g, C.ink); g.circle(cx, cy - hh * 0.08, Math.max(3, hh * 0.34));
      g.noFill(); st(g, C.ink, 2.4);
      pline(g, [[cx + hw * 0.32, cy + hh * 0.50], [cx + hw * 0.92, cy + hh * 0.92]]);
      break;
    }
  }
}

// ============================================================
// 上带：条纹边框 + 一排象形文字框（cartouche）
// ============================================================
function stripeRow(g, y, h) {
  const cols = [C.blue, C.gold, C.white, C.turq];
  g.noStroke();
  for (let i = 0; i < 25; i++) { fl(g, cols[i % 4]); g.rect(i * 40, y, 40, h); }
  g.noFill(); st(g, C.ink, 3.5);
  g.line(0, y, 1000, y);
  g.line(0, y + h, 1000, y + h);
  st(g, C.ink, 1.3);
  for (let i = 1; i < 25; i++) g.line(i * 40, y, i * 40, y + h);
}

function drawTopBand(g, set) {
  stripeRow(g, BAND_TOP_A, 18);
  for (let i = 0; i < 7; i++) {
    const cx = 104 + i * 132;
    // 垂尾（先画，被椭圆压住上端）
    shape(g, [[cx - 10, 188], [cx + 10, 188], [cx + 10, 222], [cx - 10, 222]], C.gold, 3.5);
    // 椭圆环
    g.noStroke(); fl(g, C.white);
    g.ellipse(cx, CARTOUCHE_Y, 116, 84);
    g.noFill(); st(g, C.ink, 3.6);
    g.ellipse(cx, CARTOUCHE_Y, 116, 84);
    st(g, C.gold, 7);
    g.ellipse(cx, CARTOUCHE_Y, 104, 72);
    // 三格自创符号
    for (let k = 0; k < 3; k++) {
      const kind = (set * 3 + i * 2 + k * 5) % 9;
      const gw = k === 1 ? 52 : 36;
      const gh = k === 1 ? 21 : 17;
      glyphAt(g, kind, cx, CARTOUCHE_Y - 27 + k * 27, gw, gh, k === 1 ? C.blue : C.red);
    }
  }
  stripeRow(g, BAND_TOP_B, 18);
}

// 左侧竖列：贵族的"名条"（自创符号柱）
function drawGlyphColumn(g, set) {
  const x0 = 42, x1 = 88, y0 = 292, y1 = 628;
  g.noFill(); st(g, C.ink, 3);
  g.line(x0, y0, x1, y0);
  g.line(x0, y1, x1, y1);
  g.line(x0, y0, x0, y1);
  g.line(x1, y0, x1, y1);
  st(g, C.ink, 1.8, 190);
  for (let k = 1; k < 5; k++) g.line(x0 + 3, y0 + k * 67, x1 - 3, y0 + k * 67);
  for (let k = 0; k < 5; k++) {
    const kind = (set * 4 + k * 3 + 1) % 9;
    glyphAt(g, kind, (x0 + x1) / 2, y0 + 34 + k * 67, 32, 30, k % 2 === 0 ? C.blue : C.red);
  }
}

// ============================================================
// 正面律：头侧面 + 眼正面（共用）
// ============================================================
function headFrontalEyeProfile(g, HX, T, H, dir, skin, ow, cap, band) {
  const p = (dx, dy) => [HX + dir * dx * H, T + dy * H];
  const pts = [
    p(0.30, 0.28), p(0.16, 0.03), p(-0.18, 0.01), p(-0.36, 0.30),
    p(-0.40, 0.62), p(-0.33, 0.86), p(-0.20, 0.97), p(0.05, 1.00),
    p(0.24, 0.96), p(0.38, 0.91), p(0.44, 0.79), p(0.55, 0.68),
    p(0.35, 0.60), p(0.38, 0.50), p(0.34, 0.36),
  ];
  shape(g, pts, skin, ow);
  // 眼（正面）
  const ex = HX + dir * 0.06 * H, ey = T + 0.53 * H;
  g.noStroke(); fl(g, C.white); g.ellipse(ex, ey, 0.44 * H, 0.245 * H);
  g.noFill(); st(g, C.ink, Math.max(2, ow * 0.62)); g.ellipse(ex, ey, 0.44 * H, 0.245 * H);
  g.noStroke(); fl(g, C.ink); g.circle(ex + dir * 0.02 * H, ey, 0.185 * H);
  // 眉 + 眼线
  g.noFill(); st(g, C.ink, Math.max(2.2, 0.072 * H));
  pline(g, [p(-0.24, 0.42), p(0.02, 0.37), p(0.31, 0.45)]);
  st(g, C.ink, Math.max(1.8, 0.05 * H));
  pline(g, [p(-0.22, 0.57), p(-0.44, 0.63)]);
  // 头饰（假发：后脑一团 + 额带 + 竖纹）
  if (cap) {
    shape(g, [p(0.22, 0.28), p(0.12, -0.06), p(-0.20, -0.04), p(-0.40, 0.26),
              p(-0.47, 0.70), p(-0.48, 1.18), p(-0.16, 1.12), p(-0.28, 0.62), p(-0.20, 0.32)],
      cap, ow * 0.9);
    g.noFill(); st(g, C.ink, Math.max(1.4, 0.035 * H), 170);
    pline(g, [p(-0.30, 0.34), p(-0.36, 0.74), p(-0.35, 1.10)]);
    pline(g, [p(-0.38, 0.30), p(-0.43, 0.72), p(-0.42, 1.12)]);
    if (band) {
      shape(g, [p(0.26, 0.24), p(0.32, 0.37), p(-0.37, 0.33), p(-0.34, 0.21)], C.gold, ow * 0.62);
      disc(g, HX + dir * 0.30 * H, T + 0.17 * H, Math.max(2.5, 0.085 * H), C.gold, Math.max(1.6, ow * 0.5));
    }
  }
}

// ============================================================
// 站立人物（正面律）
// ============================================================
function figure(g, o) {
  const cx = o.cx, footY = o.footY, h = o.h, dir = o.dir;
  const skin = o.skin || C.red;
  const ow = Math.max(2.4, h * 0.0165);
  const top = footY - h;
  const shY = top + 0.225 * h;
  const waistY = top + 0.455 * h;
  const kneeY = top + 0.700 * h;
  const shW = 0.150 * h, hipW = 0.100 * h;

  // 后腿 + 脚
  const bAnk = [cx - dir * 0.135 * h, footY - 0.035 * h];
  limb(g, [[cx - dir * 0.015 * h, waistY - 0.01 * h], [cx - dir * 0.105 * h, kneeY], bAnk], 0.085 * h, skin, ow * 1.7);
  footShape(g, bAnk, dir, h, skin, ow);
  // 前腿 + 脚
  const fAnk = [cx + dir * 0.195 * h, footY - 0.035 * h];
  limb(g, [[cx + dir * 0.025 * h, waistY - 0.01 * h], [cx + dir * 0.135 * h, kneeY], fAnk], 0.088 * h, skin, ow * 1.7);
  footShape(g, fAnk, dir, h, skin, ow);

  // 远臂（在躯干之后）
  if (o.farHand) {
    limb(g, [[cx - dir * shW * 0.72, shY + 0.030 * h],
             [cx - dir * (shW * 0.80 + 0.02 * h), shY + 0.150 * h], o.farHand],
      0.046 * h, skin, ow * 1.5);
  }
  // 颈
  shape(g, [[cx - 0.052 * h, shY + 0.02 * h], [cx + 0.052 * h, shY + 0.02 * h],
            [cx + 0.048 * h, top + 0.14 * h], [cx - 0.048 * h, top + 0.14 * h]], skin, ow);
  // 躯干（正面）
  shape(g, [[cx - shW, shY], [cx + shW, shY],
            [cx + hipW, waistY + 0.012 * h], [cx - hipW, waistY + 0.012 * h]], skin, ow);
  // 短裙
  shape(g, [[cx - hipW * 1.10, waistY - 0.005 * h], [cx + hipW * 1.10, waistY - 0.005 * h],
            [cx + hipW * 1.62, kneeY - 0.030 * h], [cx - hipW * 1.62, kneeY - 0.030 * h]],
    o.kilt || C.white, ow);
  shape(g, [[cx - hipW * 1.18, waistY - 0.048 * h], [cx + hipW * 1.18, waistY - 0.048 * h],
            [cx + hipW * 1.20, waistY + 0.006 * h], [cx - hipW * 1.20, waistY + 0.006 * h]], C.gold, ow * 0.7);
  // 宽项圈（半圆，下缘微垂）
  if (o.collar) {
    const cc = [C.gold, C.blue, C.turq];
    for (let k = 0; k < 3; k++) {
      const y0 = shY + 0.012 * h + k * 0.030 * h, y1 = y0 + 0.028 * h;
      const w0 = (0.116 + k * 0.009) * h, w1 = (0.144 + k * 0.006) * h;
      const sag = 0.011 * h;
      const p = [[cx - w0, y0], [cx + w0, y0], [cx + w1, y1 - sag * 0.4]];
      for (let i = 1; i < 4; i++) {
        const u = i / 4;
        p.push([cx + w1 - 2 * w1 * u, y1 + Math.sin(u * Math.PI) * sag - sag * 0.4]);
      }
      p.push([cx - w1, y1 - sag * 0.4]);
      shape(g, p, cc[k], ow * 0.7);
    }
  }
  // 近臂
  if (o.nearHand) {
    limb(g, [[cx + dir * shW * 0.72, shY + 0.030 * h],
             [cx + dir * (shW * 0.80 + 0.03 * h), shY + 0.155 * h], o.nearHand],
      0.048 * h, skin, ow * 1.5);
  }
  // 头
  headFrontalEyeProfile(g, cx + dir * 0.012 * h, top, 0.174 * h, dir, skin, ow, o.cap, o.band !== false);
}

function footShape(g, ank, dir, h, skin, ow) {
  const L = 0.118 * h, T = 0.030 * h;
  shape(g, [[ank[0] - dir * 0.03 * h, ank[1] - T],
            [ank[0] + dir * (L - 0.03 * h), ank[1] - T * 0.82],
            [ank[0] + dir * L, footYOf(ank, h)],
            [ank[0] - dir * 0.045 * h, footYOf(ank, h)]], skin, ow);
}
function footYOf(ank, h) { return ank[1] + 0.035 * h; }

// ============================================================
// 中带：贵族立像
// ============================================================
function drawNoble(g, local) {
  const cx = 190, footY = 642, h = 340;
  const staffX = cx + 0.30 * h;
  const shY = footY - h + 0.225 * h;
  // 权杖（先画，被手压住）
  g.noFill();
  st(g, C.ink, 11); g.line(staffX, shY - 0.07 * h, staffX, footY);
  st(g, C.wood, 6.5); g.line(staffX, shY - 0.07 * h, staffX, footY);
  disc(g, staffX, shY - 0.085 * h, 8, C.gold, 3);
  figure(g, {
    cx, footY, h, dir: 1, skin: C.red, kilt: C.white,
    collar: true, cap: C.blue, band: true,
    nearHand: [staffX, shY + 0.175 * h],
    farHand: [cx - 0.125 * h, footY - h + 0.545 * h],
  });
}

// ============================================================
// 中带：纸莎草沼泽（背景，舱体会从前面经过）
// ============================================================
function drawMarsh(g) {
  const rnd = mulberry32(1313);
  const xs = [352, 396, 440, 486, 528];
  for (let i = 0; i < xs.length; i++) {
    const bx = xs[i] + (rnd() - 0.5) * 12;
    const th = 190 + rnd() * 82;
    const topY = REG_LINE - 2 - th;
    const lean = (rnd() - 0.5) * 26;
    const stem = [[bx, REG_LINE], [bx + lean * 0.4, topY + 62], [bx + lean, topY]];
    g.noFill();
    st(g, C.ink, 9.5); pline(g, stem);
    st(g, C.marsh, 5.5); pline(g, stem);
    // 伞状花序
    const n = 9;
    g.noStroke(); fl(g, C.gold, 150);
    g.ellipse(bx + lean, topY + 6, 34, 12);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.25;
      const L = 20 + rnd() * 11;
      const ex = bx + lean + Math.cos(a) * L;
      const ey = topY + Math.sin(a) * L;
      g.noFill(); st(g, C.ink, 6); g.line(bx + lean, topY, ex, ey);
      st(g, C.gold, 3.2); g.line(bx + lean, topY, ex, ey);
      disc(g, ex, ey, 4.2, C.blue, 1.8);
    }
  }
}

// ============================================================
// 纸莎草（下带两株）
// ============================================================
function papyrusPlant(g, cx, baseY, hgt, seed) {
  const rnd = mulberry32(seed);
  const topY = baseY - hgt;
  const lean = (rnd() - 0.5) * 14;
  const stem = [[cx, baseY], [cx + lean * 0.4, topY + hgt * 0.45], [cx + lean, topY]];
  g.noFill();
  st(g, C.ink, 8.5); pline(g, stem);
  st(g, C.marsh, 5); pline(g, stem);
  const n = 9;
  g.noStroke(); fl(g, C.turq, 140);
  g.ellipse(cx + lean, topY + hgt * 0.05, hgt * 0.34, hgt * 0.12);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.3;
    const L = hgt * (0.24 + rnd() * 0.10);
    const ex = cx + lean + Math.cos(a) * L, ey = topY + Math.sin(a) * L;
    g.noFill(); st(g, C.ink, 5.5); g.line(cx + lean, topY, ex, ey);
    st(g, C.turq, 3); g.line(cx + lean, topY, ex, ey);
    disc(g, ex, ey, 4, C.gold, 1.8);
  }
}

// ============================================================
// 梗：纸草卷上的三视图（正 / 侧 / 俯）
// ============================================================
// 卷子上方一行题记（自创符号），读作"给三视图写图的注"
function drawCaptionRow(g, set) {
  const y = 318, x0 = 608, x1 = 982;
  g.noFill(); st(g, C.ink, 2.6, 200);
  g.line(x0, y - 26, x1, y - 26);
  g.line(x0, y + 24, x1, y + 24);
  for (let k = 0; k < 7; k++) {
    const kind = (set + k * 4 + 2) % 9;
    glyphAt(g, kind, x0 + 30 + k * 54, y - 2, 34, 34, k % 2 === 0 ? C.blue : C.red);
  }
}

function drawScroll(g, cellAct, beatP, sec2) {
  const { x0, x1, y0, y1 } = SCROLL;
  // 纸草卷本体
  g.noStroke(); fl(g, C.white); g.rect(x0, y0, x1 - x0, y1 - y0);
  g.noFill(); st(g, C.ink, 4); g.rect(x0, y0, x1 - x0, y1 - y0);
  // 两端卷轴
  for (const rx of [x0, x1 - 16]) {
    g.noStroke(); fl(g, [226, 209, 168]); g.rect(rx, y0 - 6, 16, y1 - y0 + 12);
    g.noFill(); st(g, C.ink, 3.4); g.rect(rx, y0 - 6, 16, y1 - y0 + 12);
    st(g, C.ink, 2); g.line(rx + 5, y0 - 2, rx + 5, y1 + 2); g.line(rx + 11, y0 - 2, rx + 11, y1 + 2);
  }
  // 三格
  const cy = (y0 + y1) / 2;
  for (let i = 0; i < 3; i++) {
    const c = CELLS[i];
    const on = i === cellAct;
    const hl = (on ? 0.55 + 0.45 * sec2 : 0) * (0.45 + 0.55 * beatP);
    if (hl > 0.01) {
      g.noStroke(); fl(g, C.gold, 26 + 96 * hl);
      g.rect(c - 30, y0 + 6, 60, y1 - y0 - 12);
    }
    if (i < 2) { st(g, C.ink, 2.6); g.line(c + 35, y0 + 4, c + 35, y1 - 4); }
    // 三视图
    if (i === 0) viewFront(g, c, cy);
    else if (i === 1) viewSide(g, c, cy);
    else viewTop(g, c, cy);
    // 尺寸标注（工程制图的玩笑）
    st(g, C.ink, 1.8);
    g.line(c - 22, y1 - 14, c + 22, y1 - 14);
    g.line(c - 22, y1 - 18, c - 22, y1 - 10);
    g.line(c + 22, y1 - 18, c + 22, y1 - 10);
    // 笔尖墨点
    if (on) {
      const r = 2.6 + 2.6 * beatP;
      g.noStroke(); fl(g, C.ink); g.circle(c + 18, y0 + 26, r * 2);
    }
  }
}

function viewFront(g, cx, cy) {
  const w = 44, h = 50;
  const t = cy - 42;
  disc(g, cx, t + 6, 6.5, C.gold, 2.4);                       // 顶灯（正面日轮）
  shape(g, [[cx - w / 2 - 6, t + 12], [cx + w / 2 + 6, t + 12],
            [cx + w / 2, t + 20], [cx - w / 2, t + 20]], C.tealD, 2.4);   // 檐
  shape(g, [[cx - w / 2, t + 20], [cx + w / 2, t + 20],
            [cx + w / 2, t + 20 + h], [cx - w / 2, t + 20 + h]], C.teal, 2.6);
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const wx = cx - w / 2 + 4 + c * ((w - 8) / 3), ww = (w - 8) / 3 - 2.5;
      g.noStroke(); fl(g, C.glass);
      g.rect(wx, t + 24 + r * 20, ww, 16);
      g.noFill(); st(g, C.ink, 1.8); g.rect(wx, t + 24 + r * 20, ww, 16);
    }
  shape(g, [[cx - w / 2 - 3, t + 20 + h], [cx + w / 2 + 3, t + 20 + h],
            [cx + w / 2 + 3, t + 28 + h], [cx - w / 2 - 3, t + 28 + h]], C.tealD, 2.4);
  for (let i = 0; i < 4; i++) disc(g, cx - 18 + i * 12, t + 24 + h, 2.6, C.gold, 1.6);
}

function viewSide(g, cx, cy) {
  const w = 32, h = 46;
  const t = cy - 40;
  disc(g, cx, t + 5, 5.5, C.gold, 2.2);
  shape(g, [[cx - w / 2 - 7, t + 10], [cx + w / 2 + 7, t + 10],
            [cx + w / 2, t + 18], [cx - w / 2, t + 18]], C.tealD, 2.4);
  shape(g, [[cx - w / 2, t + 18], [cx + w / 2, t + 18],
            [cx + w / 2, t + 18 + h], [cx - w / 2, t + 18 + h]], C.teal, 2.6);
  for (let r = 0; r < 2; r++) {
    g.noStroke(); fl(g, C.glass); g.rect(cx - w / 2 + 5, t + 23 + r * 20, w - 10, 15);
    g.noFill(); st(g, C.ink, 1.8); g.rect(cx - w / 2 + 5, t + 23 + r * 20, w - 10, 15);
  }
  shape(g, [[cx - w / 2 - 3, t + 18 + h], [cx + w / 2 + 3, t + 18 + h],
            [cx + w / 2 + 3, t + 26 + h], [cx - w / 2 - 3, t + 26 + h]], C.tealD, 2.4);
  st(g, C.ink, 1.8); g.line(cx + w / 2 + 5, t + 26 + h, cx + w / 2 + 5, t + 18 + h);
}

function viewTop(g, cx, cy) {
  const w = 50, h = 58;
  const t = cy - 40;
  shape(g, [[cx - w / 2, t + 12], [cx + w / 2, t + 12],
            [cx + w / 2, t + 12 + h], [cx - w / 2, t + 12 + h]], C.teal, 2.6);
  disc(g, cx, t + 12 + h / 2, 10, C.gold, 2.4);
  g.noFill(); st(g, C.ink, 1.8); g.circle(cx, t + 12 + h / 2, 6);
  for (let i = 0; i < 4; i++) {
    const jx = cx + (i % 2 === 0 ? -1 : 1) * 17;
    const jy = t + 12 + (i < 2 ? 10 : h - 10);
    disc(g, jx, jy, 4.4, C.lamp, 2);
  }
  st(g, C.ink, 1.6);
  g.line(cx - w / 2 + 3, t + 12 + h / 2, cx + w / 2 - 3, t + 12 + h / 2);
  g.line(cx, t + 15, cx, t + 9 + h);
}

// ============================================================
// 两个书吏（盘腿而坐，正面律，都朝左）
// ============================================================
function scribe(g, o) {
  const cx = o.cx, baseY = o.baseY, dir = o.dir, h = o.h;
  const skin = C.red;
  const ow = Math.max(2.4, h * 0.0165);
  const headTop = baseY - h;
  const shY = baseY - 0.620 * h;
  const waistY = baseY - 0.200 * h;
  const lean = dir * 9;                 // 向前倾（埃及书吏的姿势）

  // 腿体块（大部分会被白裙盖住）
  shape(g, [[cx - 54, baseY - 22], [cx - 34, baseY - 34], [cx + 2, baseY - 27],
            [cx + 32, baseY - 34], [cx + 54, baseY - 22],
            [cx + 50, baseY - 3], [cx - 50, baseY - 3]], skin, ow);
  // 交叉的小腿折线
  g.noFill(); st(g, C.ink, ow * 0.85);
  pline(g, [[cx - 46, baseY - 12], [cx - 10, baseY - 19], [cx + 22, baseY - 7]]);
  pline(g, [[cx + 44, baseY - 12], [cx + 8, baseY - 18], [cx - 24, baseY - 6]]);
  // 远臂（肘部用中点+下垂，避免折返）
  if (o.farHand) {
    const sh = [cx + lean - dir * 30, shY + 6];
    const hd = o.farHand;
    limb(g, [sh, [(sh[0] + hd[0]) / 2 - dir * 3, (sh[1] + hd[1]) / 2 + 15], hd], 11, skin, ow * 1.5);
  }
  // 颈 + 躯干
  shape(g, [[cx + lean - 15, shY + 4], [cx + lean + 15, shY + 4],
            [cx + lean + 14, shY - 14], [cx + lean - 14, shY - 14]], skin, ow);
  shape(g, [[cx + lean - 38, shY], [cx + lean + 38, shY],
            [cx + 26, waistY], [cx - 26, waistY]], skin, ow);
  // 大短裙：盖住大腿，直到地面
  shape(g, [[cx + lean - 32, waistY - 6], [cx + lean + 32, waistY - 6],
            [cx + 50, baseY - 13], [cx - 50, baseY - 13]], C.white, ow);
  shape(g, [[cx + lean - 34, waistY - 14], [cx + lean + 34, waistY - 14],
            [cx + lean + 34, waistY + 2], [cx + lean - 34, waistY + 2]], C.gold, ow * 0.7);
  // 裙前竖褶
  g.noFill(); st(g, C.ink, ow * 0.5, 150);
  pline(g, [[cx - 16, waistY + 6], [cx - 26, baseY - 16]]);
  pline(g, [[cx + 16, waistY + 6], [cx + 26, baseY - 16]]);
  // 膝盖：白裙下面顶起来的两个鼓包（只画上半圈折痕，避免白球）
  for (const s of [-1, 1]) {
    const kx = cx + s * 32, ky = baseY - 29, kr = 15;
    const arc = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      arc.push([kx + Math.cos(a) * kr, ky + Math.sin(a) * kr * 0.82]);
    }
    g.noFill(); st(g, C.ink, ow * 0.62, 205);
    pline(g, arc);
  }
  // 露出的双脚（两膝之间）
  shape(g, [[cx - 16, baseY - 9], [cx - 2, baseY - 10], [cx - 2, baseY - 1], [cx - 18, baseY - 1]], skin, ow * 0.75);
  shape(g, [[cx + 3, baseY - 10], [cx + 17, baseY - 9], [cx + 19, baseY - 1], [cx + 3, baseY - 1]], skin, ow * 0.75);
  // 项圈
  const cc = [C.gold, C.blue];
  for (let k = 0; k < 2; k++) {
    const y0 = shY + 6 + k * 15, y1 = y0 + 13;
    const w0 = 42 - k * 3, w1 = 44 - k * 3;
    shape(g, [[cx + lean - w0, y0], [cx + lean + w0, y0],
              [cx + lean + w1, y1], [cx + lean - w1, y1]], cc[k], ow * 0.7);
  }
  // 近臂
  if (o.nearHand) {
    const sh = [cx + lean + dir * 30, shY + 8];
    const hd = o.nearHand;
    limb(g, [sh, [(sh[0] + hd[0]) / 2 + dir * 4, (sh[1] + hd[1]) / 2 + 16], hd], 11.5, skin, ow * 1.5);
  }
  // 头
  headFrontalEyeProfile(g, cx + lean + dir * 0.03 * h, headTop, 0.30 * h, dir, skin, ow, o.cap || C.black, false);
}

function drawScribes(g, local, beatP, sec2) {
  // ---- 左：拿测量尺（cubit rod）对着舱体比划 ----
  scribe(g, { cx: 630, baseY: 640, h: 178, dir: -1, cap: C.black,
    nearHand: [598, 548], farHand: [664, 566] });
  // 测量尺
  const rodA = [598, 552], rodB = [545, 596];
  g.noFill();
  st(g, C.ink, 11); g.line(rodA[0], rodA[1], rodB[0], rodB[1]);
  st(g, C.wood, 6.5); g.line(rodA[0], rodA[1], rodB[0], rodB[1]);
  st(g, C.ink, 2.2);
  for (let i = 1; i < 6; i++) {
    const u = i / 6;
    const px = rodA[0] + (rodB[0] - rodA[0]) * u, py = rodA[1] + (rodB[1] - rodA[1]) * u;
    g.line(px - 3, py - 4, px + 3, py + 4);
  }

  // ---- 右：执笔记录 ----
  scribe(g, { cx: 908, baseY: 640, h: 178, dir: -1, cap: C.blue,
    nearHand: [876, 536], farHand: [852, 512] });
  // 笔
  const bA = [852, 512], bB = [834, 496];
  g.noFill();
  st(g, C.ink, 10); g.line(bA[0], bA[1], bB[0], bB[1]);
  st(g, [60, 44, 30], 5.5); g.line(bA[0], bA[1], bB[0], bB[1]);
  // 笔尖墨点
  const dr = 2.4 + 2.8 * beatP;
  g.noStroke(); fl(g, C.ink); g.circle(bB[0] - 2, bB[1] - 2, dr * 2);
  // 第 2 小节：卷子描一圈金边（读作"壁画里最重要的人物"）
  if (sec2 > 0.02) {
    g.noFill(); st(g, C.gold, 2 + 2.5 * sec2, 200 * sec2);
    g.rect(SCROLL.x0 - 5, SCROLL.y0 - 9, SCROLL.x1 - SCROLL.x0 + 10, SCROLL.y1 - SCROLL.y0 + 18);
  }
}

// ============================================================
// 下带：供奉行列 + 分带线 + 地平线
// ============================================================
function drawRegister(g) {
  g.noFill(); st(g, C.ink, 5);
  g.line(0, REG_LINE, 1000, REG_LINE);
  st(g, C.gold, 2);
  g.line(0, REG_LINE - 6, 1000, REG_LINE - 6);
}

function drawProcession(g, stepQ) {
  const xs = [120, 210, 300, 390, 480, 570, 660];
  const adv = ((stepQ % 4) * 6) - 9;
  const swing = stepQ % 2;
  for (let i = 0; i < xs.length; i++) {
    const cx = xs[i] + adv;
    const kind = i % 3;
    const bob = swing === 0 ? 0 : -3;
    figure(g, {
      cx, footY: 764, h: 100, dir: 1, skin: C.red, kilt: C.white,
      collar: false, cap: C.black, band: false,
      nearHand: kind === 0 ? [cx + 12, 690] : [cx + 36, 706],
      farHand: [cx - 12, 718],
    });
    // 供品
    const top = 764 - 100 + bob;
    if (kind === 0) {          // 头顶陶罐
      g.noStroke(); fl(g, C.red); g.ellipse(cx, top - 9, 22, 20);
      g.noFill(); st(g, C.ink, 2.4); g.ellipse(cx, top - 9, 22, 20);
      st(g, C.gold, 2.6); g.line(cx - 11, top - 11, cx + 11, top - 11);
      g.noFill(); st(g, C.ink, 3); g.line(cx + 12, 690, cx + 5, top - 2);
    } else if (kind === 1) {   // 托盘 + 面包
      shape(g, [[cx + 16, 708], [cx + 56, 708], [cx + 56, 715], [cx + 16, 715]], C.gold, 2.4);
      for (let k = 0; k < 3; k++) disc(g, cx + 23 + k * 13, 703, 5.4, C.white, 2);
    } else {                   // 莲花
      g.noFill(); st(g, C.ink, 6); g.line(cx + 36, 708, cx + 42, 688);
      st(g, C.turq, 3.4); g.line(cx + 36, 708, cx + 42, 688);
      disc(g, cx + 42, 680, 6, C.blue, 2.2);
      disc(g, cx + 34, 685, 4.4, C.turq, 2);
      disc(g, cx + 50, 685, 4.4, C.turq, 2);
    }
  }
}

// ============================================================
// render
// ============================================================
export function render(g, meta, local) {
  const T = tex(g);
  const down = Math.exp(-Math.pow((local % 2) / 0.20, 2));      // 每小节第 1 拍
  const stepQ = Math.floor(local / 0.5);
  const beatP = Math.exp(-Math.pow((local % 0.5) / 0.12, 2));   // 拍内脉冲
  const glyphSet = Math.min(2, Math.floor(local / 2));          // 每两秒换一组符号
  const cellAct = stepQ % 3;
  const sec2 = smooth(1.9, 2.35, local) * (1 - smooth(3.65, 4.10, local));
  const cross = Math.max(smooth(5.5, 6.0, local), Math.exp(-Math.pow(local / 0.20, 2)));
  INK_BOOST = 1 + 0.5 * cross;

  g.push();
  g.noStroke();
  g.image(T.base, 0, 0);
  // 打格底稿：画在壁画下面（露出空白墙面的地方才看得见）
  drawGrid(g, 1 + 2.4 * down);

  drawTopBand(g, glyphSet);
  drawGlyphColumn(g, glyphSet);
  drawMarsh(g);
  drawNoble(g, local);
  drawCaptionRow(g, glyphSet);
  drawScroll(g, cellAct, beatP, sec2);
  drawScribes(g, local, beatP, sec2);
  drawRegister(g);
  drawProcession(g, stepQ);
  papyrusPlant(g, 45, 764, 112, 61);
  papyrusPlant(g, 790, 764, 118, 62);
  g.image(T.flake, 0, 0);

  g.noFill(); st(g, C.ink, 6);
  g.line(0, HORIZON, 1000, HORIZON);
  g.pop();
}

// ============================================================
// 时空舱：壁画版（平涂 + 粗黑轮廓 + 正面律对称姿势）
// ============================================================
export function drawVehicle(g, { x, y, local, t, wave }) {
  INK_BOOST = 1;                     // 舱体自己按 cross 加粗，避免双重加倍
  const hover = hoverY(local);
  const baseY = y + hover;
  const topY = baseY - 196;
  const down = Math.exp(-Math.pow((local % 2) / 0.20, 2));
  const cross = Math.max(smooth(5.55, 6.0, local), Math.exp(-Math.pow(local / 0.22, 2)));
  const sec2 = smooth(1.9, 2.35, local) * (1 - smooth(3.65, 4.10, local));
  const ow = 5.5 + 2.4 * cross;      // 过框时轮廓整体加深

  g.push();
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);

  // ---- 宽底座 ----
  shape(g, [[x - 96, baseY - 16], [x + 96, baseY - 16],
            [x + 96, baseY], [x - 96, baseY]], C.tealD, ow);
  // ---- 四个正面圆喷口（小铜环，别在底部堆成一排金块）----
  for (let i = 0; i < 4; i++) disc(g, x - 60 + i * 40, baseY - 8, 7, C.tealD, ow * 0.55);

  // ---- 舱身（平涂，无渐变无投影）----
  g.noStroke(); fl(g, C.teal);
  rrFill(g, x - 89, topY, 178, 180, 10);
  g.noFill(); st(g, C.ink, ow);
  rrStroke(g, x - 89, topY, 178, 180, 10);

  // ---- 顶部金色横带 ----
  shape(g, [[x - 89, topY + 10], [x + 89, topY + 10],
            [x + 89, topY + 24], [x - 89, topY + 24]], C.gold, ow * 0.7);
  // ---- 两侧黄铜立边 ----
  for (const s of [-1, 1]) {
    shape(g, [[x + s * 89 - 4, topY + 4], [x + s * 89 + 4, topY + 4],
              [x + s * 89 + 4, topY + 176], [x + s * 89 - 4, topY + 176]], C.brass, 3);
  }

  // ---- 3×2 横长窗 ----
  const winTop = topY + 34, winH = 72, wx0 = x - 70, ww = 140;
  const cw = (ww - 10) / 3, chh = (winH - 6) / 2;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = wx0 + c * (cw + 5), wy = winTop + r * (chh + 6);
      g.noStroke(); fl(g, C.glass);
      rrFill(g, wx, wy, cw, chh, 3);
      g.noFill(); st(g, C.ink, 3.6);
      rrStroke(g, wx, wy, cw, chh, 3);
    }
  }
  // 驾驶员：中间上排窗内（红棕小人，深色玻璃上才看得见）
  {
    const dx = x, dy = winTop + chh * 0.64;
    g.noFill(); st(g, C.ink, 5.4); g.strokeCap(g.ROUND);
    if (wave) {
      const wig = Math.sin(t * 9) * 0.4;
      g.line(dx + 6, dy + 3, dx + 17, dy - 12 + wig * 6);
      st(g, C.red, 3);
      g.line(dx + 6, dy + 3, dx + 17, dy - 12 + wig * 6);
    } else {
      g.line(dx + 6, dy + 3, dx + 12, dy + 10);
      st(g, C.red, 3);
      g.line(dx + 6, dy + 3, dx + 12, dy + 10);
    }
    // 躯干（白裙）
    shape(g, [[dx - 8, dy + 1], [dx + 8, dy + 1], [dx + 10, dy + 14], [dx - 10, dy + 14]], C.white, 2);
    // 头 + 假发
    g.noStroke(); fl(g, C.red); g.circle(dx, dy - 7, 13);
    g.noFill(); st(g, C.ink, 2); g.circle(dx, dy - 7, 13);
    g.noStroke(); fl(g, C.ink);
    g.circle(dx, dy - 10, 11);
  }

  // ---- 门洞：对称展开，露出时间刻度盘 ----
  const doorTop = topY + 114, doorBot = topY + 174, doorMid = (doorTop + doorBot) / 2;
  shape(g, [[x - 46, doorTop], [x + 46, doorTop],
            [x + 46, doorBot], [x - 46, doorBot]], C.glass, ow);
  // 刻度盘
  const dr = 18;
  disc(g, x, doorMid, dr + 4, C.tealD, ow * 0.55);
  disc(g, x, doorMid, dr, C.gold, ow * 0.5);
  g.noFill(); st(g, C.ink, 1.6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.line(x + Math.cos(a) * dr * 0.70, doorMid + Math.sin(a) * dr * 0.70,
           x + Math.cos(a) * dr * 0.92, doorMid + Math.sin(a) * dr * 0.92);
  }
  st(g, [70, 46, 18], 2.6);
  const na = swirlAngle(t) - Math.PI / 2;
  g.line(x, doorMid, x + Math.cos(na) * dr * 0.62, doorMid + Math.sin(na) * dr * 0.62);

  // 左右门板（对称外撇，带黄铜边框）
  for (const s of [-1, 1]) {
    g.push();
    g.translate(x + s * 64, doorMid);
    g.rotate(s * 0.075);
    shape(g, [[-19, -30], [19, -30], [19, 30], [-19, 30]], C.tealD, ow);
    g.noFill(); st(g, C.brass, 2.4);
    g.rect(-14, -25, 28, 50);
    for (let i = 0; i < 3; i++) {
      shape(g, [[-11, -16 + i * 16], [11, -16 + i * 16],
                [11, -11 + i * 16], [-11, -11 + i * 16]], C.brass, 2.2);
    }
    g.pop();
  }

  // ---- 四坡短檐 ----
  shape(g, [[x - 108, topY + 2], [x - 42, topY - 28], [x + 42, topY - 28], [x + 108, topY + 2]], C.tealD, ow);
  // 檐口黄铜线 + 屋脊
  g.noFill(); st(g, C.brass, 3);
  g.line(x - 108, topY + 2, x + 108, topY + 2);
  g.line(x - 42, topY - 28, x + 42, topY - 28);
  st(g, C.brass, 2.2);
  g.line(x - 42, topY - 28, x - 108, topY + 2);
  g.line(x + 42, topY - 28, x + 108, topY + 2);

  // ---- 太阳圆盘灯笼（正面 + 两道横向羽翼）----
  const sy = topY - 58;
  for (const s of [-1, 1]) {
    shape(g, [[x + s * 21, sy - 13], [x + s * 46, sy - 21], [x + s * 74, sy - 17],
              [x + s * 80, sy - 5], [x + s * 72, sy + 7], [x + s * 46, sy + 12],
              [x + s * 21, sy + 12]], C.gold, 4.5);
    g.noFill(); st(g, C.ink, 1.9);
    g.line(x + s * 28, sy - 7, x + s * 74, sy - 10);
    g.line(x + s * 28, sy + 1, x + s * 76, sy - 1);
  }
  disc(g, x, sy, 23, C.gold, ow * 0.55);
  disc(g, x, sy, 17, down > 0.25 ? [255, 248, 215] : C.lamp, 0);
  // 盘内时间漩涡（跨版块连续相位）
  const sp = [];
  for (let i = 0; i <= 22; i++) {
    const a = swirlAngle(t) + i * 0.48;
    const r = 1.5 + i * 0.62;
    sp.push([x + Math.cos(a) * r, sy + Math.sin(a) * r]);
  }
  st(g, C.red, 2.4); pline(g, sp);

  // ---- 第 2 小节：金色高光从舱顶扫过 ----
  if (sec2 > 0.01) {
    const u = Math.min(1, Math.max(0, (local - 2.0) / 2.0));
    const sweepY = topY - 6 + u * 192;
    const ctx = g.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 90, topY + 1, 180, 178);   // 只扫过舱身，不溢出到墙面
    ctx.clip();
    g.noStroke();
    fl(g, C.gold, 56 * sec2);
    g.rect(x - 90, sweepY - 28, 180, 56);
    fl(g, [255, 246, 214], 100 * sec2);
    g.rect(x - 90, sweepY - 4, 180, 8);
    ctx.restore();
  }

  g.pop();
}
