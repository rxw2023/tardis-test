// ============================================================
// s01-sahara.js — 第 1 版块：撒哈拉岩画（塔西里风格，约前 4000）
//
// 美术口径：
//   岩壁：赭石底色 + 深浅斑块 + 断裂状裂纹 + 细密颗粒，像风化砂岩
//   颜料：赭红与白两色，剪影式涂绘，白色描边压在外沿（岩画典型"重描"做法）
//   内容：牧人与牛群停下来围观一个"不合时代的方盒子"
//   梗：四个牧人的手实时指着公路上的舱体，头顶冒注意符；牛群歪头
//   时空舱：本版块改为"被岩画画上去的版本"——同构（3×2 窗 + 刻度盘 +
//           六角灯）但无金属反光、无发光，只有赭红剪影 + 白描边
// ============================================================

import { TAU, smooth, BEAT, hoverY, routeU } from '../beat/beats.js';
import { mulberry32 } from '../kit/kit.js';

const WALL_L = '#c19a68';    // 亮斑
const WALL_D = '#9a7043';    // 暗斑
const PIG_RED = '#7c3b1e';   // 赭红颜料
const PIG_WHITE = '#e9dcc0'; // 白颜料

// ---- 固定构图（手排，不随机）----
const CATTLE = [
  { x: 138, y: 700, s: 1.00, flip: false },
  { x: 292, y: 748, s: 0.76, flip: true },
  { x: 452, y: 654, s: 1.10, flip: false },
  { x: 618, y: 748, s: 0.84, flip: true },
  { x: 806, y: 662, s: 1.02, flip: false },
  { x: 918, y: 744, s: 0.72, flip: false },
  { x: 214, y: 566, s: 0.52, flip: true },   // 远处小牛，拉开纵深
  { x: 842, y: 552, s: 0.46, flip: false },
];
const HERDERS = [
  { x: 200, y: 776, h: 1.00, side: 1 },
  { x: 344, y: 788, h: 0.84, side: 1 },
  { x: 668, y: 774, h: 1.06, side: -1 },
  { x: 812, y: 790, h: 0.78, side: -1 },
];
const SPIRALS = [
  { x: 96, y: 286, r: 32 },
  { x: 922, y: 236, r: 24 },
];
const HAND = { x: 132, y: 470, s: 1.0 };

// ---- 岩壁底图只生成一次 ----
let wallG = null;
function ensureWall(g) {
  if (wallG) return wallG;
  const pg = g.createGraphics(1000, 1000);
  pg.pixelDensity(1);
  const rnd = mulberry32(20261022);

  pg.background(176, 138, 90);
  // 大块深浅斑
  pg.noStroke();
  for (let i = 0; i < 52; i++) {
    const light = rnd() > 0.5;
    pg.fill(light ? WALL_L : WALL_D);
    pg.drawingContext.globalAlpha = 0.10 + rnd() * 0.16;
    pg.ellipse(rnd() * 1000, rnd() * 1000, 70 + rnd() * 260, 50 + rnd() * 190);
  }
  pg.drawingContext.globalAlpha = 1;

  // 横向层理
  for (let i = 0; i < 9; i++) {
    pg.noFill();
    pg.stroke(120, 88, 52, 22 + rnd() * 20);
    pg.strokeWeight(1.5 + rnd() * 2.5);
    pg.beginShape();
    const y0 = 60 + rnd() * 860;
    for (let x = -20; x <= 1020; x += 90) {
      pg.vertex(x, y0 + Math.sin(x * 0.011 + i) * 14 + (rnd() - 0.5) * 10);
    }
    pg.endShape();
  }

  // 断裂状裂纹：短段 + 拐角，不做长蛇形
  for (let i = 0; i < 26; i++) {
    pg.noFill();
    pg.stroke(88, 62, 38, 30 + rnd() * 34);
    pg.strokeWeight(1 + rnd() * 1.8);
    let x = rnd() * 1000, y = rnd() * 1000;
    const seg = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < seg; k++) {
      const nx = x + (rnd() - 0.5) * 46;
      const ny = y + 20 + rnd() * 46;
      pg.line(x, y, nx, ny);
      x = nx; y = ny;
    }
  }

  // 颗粒
  pg.noStroke();
  for (let i = 0; i < 4200; i++) {
    const v = rnd();
    pg.fill(v > 0.5 ? 230 : 70, v > 0.5 ? 210 : 55, v > 0.5 ? 170 : 40, 16 + rnd() * 26);
    pg.circle(rnd() * 1000, rnd() * 1000, 1 + rnd() * 2.6);
  }

  wallG = pg;
  return pg;
}

export function render(g, meta, local) {
  const wall = ensureWall(g);
  g.image(wall, 0, 0);

  // 底部岩台（公路前的阴影过渡）
  g.noStroke();
  g.fill(70, 48, 28, 90);
  g.rect(0, 730, 1000, 44);

  drawMotifs(g);
  for (const c of CATTLE) drawCattle(g, c.x, c.y, c.s, c.flip, local);

  // 舱体当前横坐标（牧人手指追着它）
  const capX = routeU(local) * 1000;
  for (const h of HERDERS) drawHerder(g, h, local, capX);

  // 注意力符号：第 2 小节围观最起劲
  const hype = smooth(2.0, 2.3, local) * (1 - smooth(3.8, 4.2, local));
  if (hype > 0.02) {
    for (const h of HERDERS) drawAttention(g, h.x, h.y - 132 * h.h, hype);
  }

  drawDust(g, local);
}

// ---- 装饰母题：螺旋、手印、点簇 ----
function drawMotifs(g) {
  for (const s of SPIRALS) {
    g.push();
    g.noFill();
    g.stroke(PIG_RED);
    g.strokeWeight(6);
    g.strokeCap(g.ROUND);
    g.beginShape();
    for (let i = 0; i < 70; i++) {
      const a = i * 0.22;
      const r = (i / 70) * s.r;
      g.vertex(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
    }
    g.endShape();
    g.pop();
  }

  // 手印：掌心 + 五根分开的手指（拇指外张）
  g.push();
  g.noStroke();
  g.fill(PIG_RED);
  g.drawingContext.globalAlpha = 0.74;
  const hs = HAND.s, hx = HAND.x, hy = HAND.y;
  g.ellipse(hx, hy, 52 * hs, 58 * hs);
  const fingers = [
    { a: -0.52, len: 56, w: 15 },
    { a: -0.20, len: 66, w: 15 },
    { a: 0.06, len: 70, w: 15 },
    { a: 0.32, len: 60, w: 14 },
  ];
  for (const f of fingers) {
    g.push();
    g.translate(hx, hy - 16 * hs);
    g.rotate(f.a);
    g.ellipse(0, -f.len * 0.5 * hs, f.w * hs, f.len * hs);
    g.pop();
  }
  g.push(); // 拇指
  g.translate(hx - 24 * hs, hy - 2 * hs);
  g.rotate(-1.05);
  g.ellipse(0, -24 * hs, 16 * hs, 50 * hs);
  g.pop();
  g.drawingContext.globalAlpha = 1;
  g.pop();

  // 点簇（不拉成地平线，只做一小撮）
  g.push();
  g.noStroke();
  g.fill(PIG_WHITE);
  g.drawingContext.globalAlpha = 0.5;
  for (let i = 0; i < 7; i++) {
    g.circle(196 + i * 15, 596 + Math.sin(i * 1.1) * 6, 5.5);
  }
  g.drawingContext.globalAlpha = 1;
  g.pop();
}

// ---- 牛：瘦长躯干、直立细腿、小钩角 ----
function drawCattle(g, cx, cy, s, flip, local) {
  const dir = flip ? -1 : 1;
  const sway = Math.sin((local / (2 * BEAT)) * TAU + cx * 0.013) * 2.2 * s;
  g.push();
  g.translate(cx, cy + sway);
  g.scale(dir * s, s);

  const pass = (isOutline) => {
    g.push();
    g.strokeCap(g.ROUND);
    // 腿先画（压在躯干下）
    if (isOutline) { g.stroke(PIG_WHITE); g.strokeWeight(9); }
    else { g.stroke(PIG_RED); g.strokeWeight(6); }
    for (const lx of [-42, -14, 26, 50]) {
      g.line(lx, 10, lx + (lx < 0 ? -3 : 3), 62);
    }
    // 躯干
    if (isOutline) { g.noFill(); g.stroke(PIG_WHITE); g.strokeWeight(8); }
    else { g.noStroke(); g.fill(PIG_RED); }
    g.ellipse(0, 0, 142, 52);
    // 颈 + 头
    if (isOutline) { g.stroke(PIG_WHITE); g.strokeWeight(8); }
    else { g.stroke(PIG_RED); g.strokeWeight(6); }
    g.line(-60, -6, -74, -10);
    if (isOutline) { g.noFill(); g.ellipse(-84, -10, 26, 18); }
    else { g.noStroke(); g.fill(PIG_RED); g.ellipse(-84, -10, 26, 18); }
    // 小钩角
    g.noFill();
    if (isOutline) g.stroke(PIG_WHITE);
    g.strokeWeight(isOutline ? 7 : 5);
    g.bezier(-90, -18, -98, -30, -86, -33, -79, -25);
    g.bezier(-78, -19, -86, -29, -76, -31, -71, -23);
    // 尾
    g.line(64, -6, 76, 10);
    g.pop();
  };
  pass(true);
  pass(false);
  g.pop();
}

// ---- 牧人：弯肘抬臂，手指实时指向舱体 ----
function drawHerder(g, h, local, capX) {
  const { x, y } = h;
  const H = 120 * h.h;
  const shoulderY = y - H * 0.62;
  const sx = x, sy = shoulderY;

  // 手指目标：公路上的舱体中段
  const tx = capX, ty = 868;
  const dx = tx - sx, dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const elbow = [sx + ux * 30 * h.h - uy * 15 * h.h, sy + uy * 30 * h.h + ux * 15 * h.h];
  const hand = [sx + ux * 56 * h.h, sy + uy * 56 * h.h];

  // 白描边一遍 + 赭红一遍（头单独实心绘制，避免画成空心圈）
  const pass = (isOutline) => {
    g.push();
    g.stroke(isOutline ? PIG_WHITE : PIG_RED);
    g.strokeCap(g.ROUND);
    g.strokeWeight(isOutline ? 14 : 8);
    // 躯干（略向舱体倾斜）
    g.line(x, y - H * 0.70, x + ux * 3, y - H * 0.30);
    // 双腿
    g.line(x, y - H * 0.30, x - 14 * h.h, y);
    g.line(x, y - H * 0.30, x + 16 * h.h, y);
    // 抬手：肩 → 肘 → 手
    g.line(sx, sy, elbow[0], elbow[1]);
    g.line(elbow[0], elbow[1], hand[0], hand[1]);
    // 另一手拄杖
    g.line(x - h.side * 6 * h.h, shoulderY + 8, x - h.side * 26 * h.h, y + 4 * h.h);
    g.pop();
  };
  pass(true);
  pass(false);

  // 头：实心 + 白描边
  g.push();
  g.noStroke();
  g.fill(PIG_RED);
  g.circle(x, y - H * 0.80, 18 * h.h);
  g.noFill();
  g.stroke(PIG_WHITE);
  g.strokeWeight(3);
  g.circle(x, y - H * 0.80, 18 * h.h);
  // 指尖小点（读作"指")
  g.noStroke();
  g.fill(PIG_WHITE);
  g.circle(hand[0], hand[1], 9 * h.h);
  g.fill(PIG_RED);
  g.circle(hand[0], hand[1], 5 * h.h);
  g.pop();
}

// ---- 注意符：头顶三道短辐射 ----
function drawAttention(g, x, y, a) {
  g.push();
  g.stroke(PIG_WHITE);
  g.strokeWeight(5);
  g.strokeCap(g.ROUND);
  for (let i = 0; i < 3; i++) {
    const ang = -Math.PI / 2 + (i - 1) * 0.62;
    const r0 = 17, r1 = 17 + 15 * a;
    g.line(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0,
      x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
  }
  g.pop();
}

// ---- 尘粒 ----
function drawDust(g, local) {
  g.push();
  g.noStroke();
  for (let i = 0; i < 14; i++) {
    const ph = (local * 0.12 + i * 0.37) % 1;
    const x = 100 + ((i * 137) % 800);
    const y = 760 - ph * 420;
    g.fill(240, 225, 190, 40 * (1 - ph));
    g.circle(x + Math.sin(ph * 4 + i) * 12, y, 2.4);
  }
  g.pop();
}

// ============================================================
// 本版块的时空舱：岩画版本（同一骨骼姿势，换成颜料绘法）
// ============================================================
export function drawVehicle(g, { x, y, local, t }) {
  const bodyW = 178, bodyH = 150;
  const bob = hoverY(local);
  const baseY = y + bob;
  const topY = baseY - bodyH;

  g.push();
  // 白点圈代替投影（岩画里没有透视）
  g.noStroke();
  g.fill(PIG_WHITE);
  g.drawingContext.globalAlpha = 0.5;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    g.circle(x + Math.cos(a) * 100, y + 8, 4.5);
  }
  g.drawingContext.globalAlpha = 1;

  const shape = (color, isOutline) => {
    if (isOutline) {
      g.stroke(PIG_WHITE); g.strokeWeight(9); g.noFill();
    } else {
      g.noStroke(); g.fill(PIG_RED);
    }
    g.rect(x - bodyW / 2, topY, bodyW, bodyH, 8);
    // 四坡檐
    g.beginShape();
    g.vertex(x - (bodyW / 2 + 12), topY);
    g.vertex(x - bodyW * 0.24, topY - 20);
    g.vertex(x + bodyW * 0.24, topY - 20);
    g.vertex(x + (bodyW / 2 + 12), topY);
    g.endShape(g.CLOSE);
  };
  shape(PIG_WHITE, true);
  shape(PIG_RED, false);

  // 六角灯笼
  const lampY = topY - 44, lampR = 17;
  g.noStroke(); g.fill(PIG_WHITE); g.circle(x, lampY, lampR * 2 + 8);
  g.fill(PIG_RED); g.circle(x, lampY, lampR * 2);
  g.noFill(); g.stroke(PIG_WHITE); g.strokeWeight(3.5);
  const a0 = (t / 1.0) * TAU;
  g.arc(x, lampY, lampR * 1.3, lampR * 1.3, a0, a0 + 2.1);
  g.line(x, topY - 20, x, lampY + lampR);

  // 3×2 窗格
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      g.noStroke(); g.fill(PIG_RED);
      g.rect(x - bodyW / 2 + 15 + c * 51, topY + 16 + r * 40, 44, 32, 3);
      g.noFill(); g.stroke(PIG_WHITE); g.strokeWeight(3.5);
      g.rect(x - bodyW / 2 + 15 + c * 51, topY + 16 + r * 40, 44, 32, 3);
    }

  // 门缝 + 刻度盘
  g.stroke(PIG_WHITE); g.strokeWeight(4);
  g.line(x, topY + 100, x, baseY - 12);
  g.noFill(); g.strokeWeight(3.5);
  g.circle(x + 42, baseY - 34, 26);
  g.stroke(PIG_RED); g.strokeWeight(2.4);
  g.line(x + 42, baseY - 34,
    x + 42 + Math.cos(a0) * 9, baseY - 34 + Math.sin(a0) * 9);

  // 底座
  g.noStroke(); g.fill(PIG_RED);
  g.rect(x - bodyW / 2 - 8, baseY - 12, bodyW + 16, 12, 3);
  g.noFill(); g.stroke(PIG_WHITE); g.strokeWeight(3.5);
  g.rect(x - bodyW / 2 - 8, baseY - 12, bodyW + 16, 12, 3);

  g.pop();
}
