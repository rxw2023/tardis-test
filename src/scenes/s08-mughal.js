// ============================================================
// s08-mughal.js — 第 08 版块：莫卧儿细密画（约 1600）
//
// 构图：金色卷草花边外框 + 四分园（charbagh）俯视平面 + 远景白色宫亭与柏树
//       + 大理石镂空栏杆；四角宾客用四种视角同时围观悬浮在八角水池上的时空舱
// 技术：静态内容（花边/花园/树/亭/栏杆/宾客/金粉）一次性烘焙进 p5.Graphics 缓存，
//       每帧只画喷泉、孔雀开屏、汇聚视线、过框花边闪光与舱体。
//       随机一律固定种子；闭合多边形一律「首尾顶点重复」，避开 p5 2.x 的
//       bezierVertex 报错与 CLOSE 常量差异；渐变只用 ctx 路径填充。
// 版权：只致敬「莫卧儿细密画」这一公有领域品类，不描摹任何具体作品；
//       建筑为自绘通用莫卧儿样式（穹顶+拱廊+凉亭），不复制具体建筑；无真实品牌。
// ============================================================

import { TAU, BEAT, smooth, hoverY, routeU, swirlAngle } from '../beat/beats.js';
import { mulberry32 } from '../kit/kit.js';

// ---- 矿物色板 ----
const GOLD = [212, 165, 49];
const GOLD_D = [140, 106, 30];
const GOLD_L = [243, 222, 158];
const GRN = [39, 91, 70];
const GRN_D = [22, 56, 44];
const GRN_M = [31, 74, 58];
const GRN_L = [74, 130, 98];
const VERM = [192, 57, 43];
const PINK = [224, 138, 154];
const CYAN = [74, 138, 154];
const CYAN_D = [42, 100, 116];
const CYAN_L = [96, 164, 176];
const CREAM = [240, 230, 210];
const NAVY = [31, 58, 90];
const NAVY_D = [20, 40, 66];
const WHT = [250, 246, 236];
const SAND = [208, 188, 148];
const SKIN = [230, 190, 146];
const SKIN_D = [166, 120, 82];
const FLWR = [VERM, PINK, CREAM, [236, 200, 84]];
const BEDF = [VERM, [168, 46, 40], PINK, PINK, CREAM, [238, 198, 76]];

// ---- 版面几何（画页下沿压在公路带 y=770 之上，四边花边都可见）----
const FR = { x0: 34, y0: 34, x1: 966, y1: 770 };     // 花边外沿
const BAND = 46;                                      // 花边宽
const INX0 = 92, INX1 = 908, INY0 = 92, INY1 = 718;   // 画心

const SKY = { y0: 92, y1: 236 };                      // 远景天空带
const WALK_T = 300;                                   // 上方园路底边
const GAR = { x0: 96, y0: 300, x1: 904, y1: 648 };    // 四分园
const CHX0 = 460, CHX1 = 540;                         // 纵向水渠
const CHY0 = 430, CHY1 = 510;                         // 横向水渠
const POOL = { x: 500, y: 470, r: 62 };               // 八角水池
const WALK_B = 682;                                   // 下方园路底边
const RAIL = { x0: 92, x1: 908, y0: 682, y1: 718 };   // 大理石栏杆

const CAP = { w: 178, h: 196, s: 0.9 };

// ---- 四角宾客（四种视角并置）----
const GUESTS = [
  { x: 146, y: 294, h: 88, view: 'front', flip: 1, robe: VERM, turban: GOLD },
  { x: 196, y: 296, h: 66, view: 'front', flip: 1, robe: CYAN, turban: PINK },
  { x: 854, y: 294, h: 86, view: 'side', flip: -1, robe: PINK, turban: VERM },
  { x: 804, y: 296, h: 64, view: 'side', flip: -1, robe: GOLD_L, turban: GRN_M },
  { x: 144, y: 668, h: 84, view: 'back', flip: 1, robe: CYAN, turban: VERM },
  { x: 194, y: 670, h: 64, view: 'back', flip: 1, robe: VERM, turban: GOLD },
  { x: 856, y: 668, h: 86, view: 'up', flip: 1, robe: PINK, turban: CYAN, book: true },
  { x: 806, y: 670, h: 66, view: 'up', flip: 1, robe: CYAN, turban: PINK },
];
const PEACOCK = { x: 626, y: 574 };

// ============================================================
// 小工具
// ============================================================
function fillC(p, c, a = 255) { p.noStroke(); p.fill(c[0], c[1], c[2], a); }
function strokeC(p, c, w, a = 255) { p.stroke(c[0], c[1], c[2], a); p.strokeWeight(w); }
function rectF(p, c, x, y, w, h, a = 255) { fillC(p, c, a); p.rect(x, y, w, h); }
function rectS(p, c, x, y, w, h, wgt, a = 255) { p.noFill(); strokeC(p, c, wgt, a); p.rect(x, y, w, h); }

function polyF(p, pts, c, a = 255) {
  fillC(p, c, a);
  p.beginShape();
  for (const q of pts) p.vertex(q[0], q[1]);
  p.vertex(pts[0][0], pts[0][1]);
  p.endShape();
}
function polyL(p, pts, c, w, a = 255) {
  p.noFill();
  strokeC(p, c, w, a);
  p.beginShape();
  for (const q of pts) p.vertex(q[0], q[1]);
  p.vertex(pts[0][0], pts[0][1]);
  p.endShape();
}

// 四瓣小花
function flower4(p, x, y, r, col, core) {
  p.noStroke();
  p.fill(col[0], col[1], col[2], 242);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    p.push();
    p.translate(x + Math.cos(a) * r * 0.56, y + Math.sin(a) * r * 0.56);
    p.rotate(a);
    p.ellipse(0, 0, r * 1.28, r * 0.76);
    p.pop();
  }
  p.fill(core[0], core[1], core[2], 246);
  p.circle(x, y, r * 0.60);
}

// 尖叶
function leaf(p, x, y, len, ang, col, edge) {
  p.push();
  p.translate(x, y);
  p.rotate(ang);
  p.noStroke();
  p.fill(col[0], col[1], col[2], 238);
  p.beginShape();
  p.vertex(0, 0);
  p.bezier(len * 0.28, -len * 0.30, len * 0.72, -len * 0.24, len, 0);
  p.bezier(len * 0.72, len * 0.24, len * 0.28, len * 0.30, 0, 0);
  p.vertex(0, 0);
  p.endShape();
  if (edge) {
    p.noFill();
    strokeC(p, edge, 0.8, 190);
    p.beginShape();
    p.vertex(0, 0);
    p.bezier(len * 0.28, -len * 0.30, len * 0.72, -len * 0.24, len, 0);
    p.bezier(len * 0.72, len * 0.24, len * 0.28, len * 0.30, 0, 0);
    p.endShape();
  }
  p.pop();
}

function spiral(p, cx, cy, r, turns, dir, col, lw, a) {
  p.noFill();
  strokeC(p, col, lw, a);
  p.beginShape();
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const ang = dir * u * turns * TAU;
    p.vertex(cx + Math.cos(ang) * r * u, cy + Math.sin(ang) * r * u);
  }
  p.endShape();
}

// 程序化卷草纹：波状主茎 + 涡卷 + 叶 + 小花
function vineField(p, x, y, w, h, cell, rnd, o = {}) {
  const stem = o.stem || GOLD;
  const lw = o.lw ?? 1.1;
  const sa = o.sa ?? 205;
  const flower = o.flower ?? 0.28;
  const cols = Math.max(1, Math.round(w / cell));
  const rows = Math.max(1, Math.round(h / cell));
  const cw = w / cols, ch = h / rows;

  p.noFill();
  strokeC(p, stem, lw, sa);
  for (let r = 0; r <= rows; r++) {
    const y0 = y + r * ch;
    p.beginShape();
    for (let xx = 0; xx <= w; xx += 6) {
      p.vertex(x + xx, y0 + Math.sin((xx / cw) * TAU + r * 1.1) * ch * 0.26);
    }
    p.endShape();
  }
  if (h > cell * 1.5) {
    for (let c = 0; c <= cols; c++) {
      const x0 = x + c * cw;
      p.beginShape();
      for (let yy = 0; yy <= h; yy += 6) {
        p.vertex(x0 + Math.sin((yy / ch) * TAU + c * 0.9) * cw * 0.24, y + yy);
      }
      p.endShape();
    }
  }

  const u = Math.min(cw, ch);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + (c + 0.5) * cw, cy = y + (r + 0.5) * ch;
      const k = rnd();
      spiral(p, cx - cw * 0.21, cy - ch * 0.14, u * 0.26, 1.5, k > 0.5 ? 1 : -1, stem, lw * 0.95, sa);
      leaf(p, cx - u * 0.32, cy + ch * 0.27, u * 0.50, 0.62 + (k - 0.5) * 0.7, o.leaf || GRN_L, null);
      leaf(p, cx + u * 0.32, cy + ch * 0.27, u * 0.50, -0.62 + (k - 0.5) * 0.7, o.leaf || GRN_L, null);
      if (o.spark !== false) flower4(p, cx + cw * 0.05, cy - ch * 0.11, u * flower,
        FLWR[Math.floor(k * FLWR.length) % FLWR.length], GOLD_D);
    }
  }
}

// 尖拱轮廓点：y(u)=top+0.45h·|2u-1|^0.7，u=0.5 处成尖
function archPath(p, cx, topY, w, h, steps = 20) {
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    p.vertex(cx - w / 2 + w * u, topY + h * 0.45 * Math.pow(Math.abs(2 * u - 1), 0.7));
  }
}

function drawArch(p, cx, topY, w, h, col, goldLine = true) {
  fillC(p, col, 255);
  p.beginShape();
  p.vertex(cx - w / 2, topY + h);
  archPath(p, cx, topY, w, h);
  p.vertex(cx + w / 2, topY + h);
  p.vertex(cx - w / 2, topY + h);
  p.endShape();
  if (goldLine) {
    p.noFill();
    strokeC(p, GOLD, 1.2, 240);
    p.beginShape();
    archPath(p, cx, topY, w, h);
    p.endShape();
    strokeC(p, GOLD, 1.1, 210);
    p.line(cx - w / 2, topY + h, cx - w / 2, topY + h * 0.45);
    p.line(cx + w / 2, topY + h, cx + w / 2, topY + h * 0.45);
  }
}

// 洋葱穹顶
function domePath(p, cx, baseY, R, H, N = 22) {
  p.vertex(cx - R, baseY);
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    p.vertex(cx - R * Math.pow(1 - Math.pow(u, 3.0), 0.42), baseY - H * u);
  }
  p.vertex(cx, baseY - H);
  for (let i = N; i >= 1; i--) {
    const u = i / N;
    p.vertex(cx + R * Math.pow(1 - Math.pow(u, 3.0), 0.42), baseY - H * u);
  }
  p.vertex(cx + R, baseY);
}

function drawDome(p, cx, baseY, R, H, c, gold = true) {
  fillC(p, c, 255);
  p.beginShape();
  domePath(p, cx, baseY, R, H);
  p.vertex(cx - R, baseY);
  p.endShape();
  if (gold) {
    p.noFill();
    strokeC(p, GOLD, 1.3, 245);
    p.beginShape();
    domePath(p, cx, baseY, R, H);
    p.endShape();
    strokeC(p, GOLD, 1.5, 250);
    p.line(cx, baseY - H, cx, baseY - H - 13);
    p.noStroke();
    fillC(p, GOLD, 250);
    p.circle(cx, baseY - H - 15, 5.0);
    p.circle(cx, baseY - H - 9, 3.0);
  }
}

function drawChhatri(p, cx, baseY, w, h) {
  p.noStroke();
  fillC(p, WHT, 255);
  p.rect(cx - w / 2, baseY - h, w, 4);
  for (let i = 0; i < 4; i++) {
    const px = cx - w / 2 + 3 + i * ((w - 6) / 3);
    p.rect(px - 1.5, baseY - h + 4, 3.0, h - 4);
  }
  p.noFill();
  strokeC(p, GOLD, 1.0, 235);
  p.rect(cx - w / 2, baseY - h, w, 4);
  drawDome(p, cx, baseY - h, w * 0.60, h * 0.66, WHT);
}

function dashLine(p, x1, y1, x2, y2, dash, gap, col, w, a) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  strokeC(p, col, w, a);
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    p.line(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
  }
}

// ============================================================
// 静态层：整页细密画（只烘焙一次）
// ============================================================
let PAGE = null;

function ensurePage(g) {
  if (PAGE) return PAGE;
  const p = g.createGraphics(1000, 1000);
  p.pixelDensity(1);
  p.strokeCap(p.ROUND);
  p.strokeJoin(p.ROUND);
  const rnd = mulberry32(16000808);

  drawGround(p);
  drawFrameBand(p, rnd);
  drawMountLines(p);
  drawSky(p);
  drawFarZone(p, rnd);
  drawWalkways(p, rnd);
  drawCharbagh(p, rnd);
  drawRailing(p);
  drawGuestGroups(p, rnd);
  drawGoldDust(p, rnd);
  PAGE = p;
  return p;
}

// ---- 画页外底色 + 公路带下方沙地 ----
function drawGround(p) {
  rectF(p, NAVY_D, 0, 0, 1000, 1000);
  rectF(p, SAND, 0, 764, 1000, 236);
  p.noStroke();
  for (let i = 0; i < 46; i++) {
    p.fill(178, 158, 120, 90);
    p.circle((i * 137) % 1000, 770 + ((i * 53) % 220), 6 + (i % 4) * 2.5);
  }
  rectF(p, [226, 212, 182], 0, 760, 1000, 8);
  rectF(p, GOLD, 0, 758, 1000, 2, 150);
}

// ---- 金色卷草花边外框 ----
function drawFrameBand(p, rnd) {
  const deep = [23, 38, 66];
  rectF(p, deep, FR.x0, FR.y0, FR.x1 - FR.x0, BAND);
  rectF(p, deep, FR.x0, FR.y1 - BAND, FR.x1 - FR.x0, BAND);
  rectF(p, deep, FR.x0, FR.y0 + BAND, BAND, FR.y1 - FR.y0 - BAND * 2);
  rectF(p, deep, FR.x1 - BAND, FR.y0 + BAND, BAND, FR.y1 - FR.y0 - BAND * 2);

  const runs = [
    { cx: 500, cy: 57, rot: 0, w: 932 },
    { cx: 500, cy: 747, rot: Math.PI, w: 932 },
    { cx: 57, cy: 401, rot: Math.PI / 2, w: 712 },
    { cx: 943, cy: 401, rot: -Math.PI / 2, w: 712 },
  ];
  for (const r of runs) {
    p.push();
    p.translate(r.cx, r.cy);
    p.rotate(r.rot);
    vineField(p, -r.w / 2, -BAND / 2, r.w, BAND, 45, rnd,
      { lw: 1.4, sa: 235, stem: GOLD_L, flower: 0.30 });
    p.pop();
  }

  rectS(p, GOLD, FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0, 2.4, 245);
  rectS(p, GOLD, FR.x0 + BAND, FR.y0 + BAND, FR.x1 - FR.x0 - BAND * 2, FR.y1 - FR.y0 - BAND * 2, 2.4, 245);

  for (const c of [[57, 57], [943, 57], [57, 747], [943, 747]]) cornerRosette(p, c[0], c[1]);
}

function cornerRosette(p, x, y) {
  p.push();
  p.translate(x, y);
  fillC(p, [23, 38, 66], 255);
  p.circle(0, 0, 46);
  for (let i = 0; i < 8; i++) {
    p.push();
    p.rotate((i / 8) * TAU);
    fillC(p, i % 2 ? VERM : PINK, 248);
    p.ellipse(0, -11, 9.5, 15);
    p.noFill();
    strokeC(p, GOLD, 1.1, 245);
    p.ellipse(0, -11, 9.5, 15);
    p.pop();
  }
  fillC(p, CREAM, 252);
  p.circle(0, 0, 13);
  fillC(p, GOLD, 252);
  p.circle(0, 0, 6.5);
  p.noFill();
  strokeC(p, GOLD_D, 1.1, 235);
  p.circle(0, 0, 22);
  p.pop();
}

// ---- 花边内侧：朱红细线 + 深蓝细线 ----
function drawMountLines(p) {
  rectS(p, VERM, INX0 - 12, INY0 - 12, INX1 - INX0 + 24, INY1 - INY0 + 24, 3.2, 245);
  rectS(p, NAVY, INX0 - 6, INY0 - 6, INX1 - INX0 + 12, INY1 - INY0 + 12, 2.4, 245);
}

// ---- 远景天空 ----
function drawSky(p) {
  const ctx = p.drawingContext;
  const grad = ctx.createLinearGradient(0, SKY.y0, 0, SKY.y1);
  grad.addColorStop(0, 'rgb(214,188,138)');
  grad.addColorStop(0.55, 'rgb(238,216,172)');
  grad.addColorStop(1, 'rgb(250,242,220)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(INX0, SKY.y0, INX1 - INX0, SKY.y1 - SKY.y0);
  ctx.fill();
  ctx.restore();
  // 地平线一道暖线
  strokeC(p, [196, 160, 104], 1.2, 150);
  p.line(INX0, SKY.y1 - 1, INX1, SKY.y1 - 1);
}

// ---- 远景：柏树 + 白色宫亭 ----
function drawFarZone(p, rnd) {
  const CYP = [216, 250, 284, 318, 682, 716, 750, 784];
  for (let i = 0; i < CYP.length; i++) {
    const sd = i * 41 + 13;
    drawCypress(p, CYP[i], SKY.y1, 96 + ((sd * 13) % 40), 20 + ((sd * 7) % 8), rnd);
  }
  drawPavilion(p);
}

function drawCypress(p, x, baseY, h, w, rnd) {
  const N = 20;
  const hw = (u) => (w / 2) * Math.pow(1 - u, 0.72) * (0.94 + 0.06 * Math.sin(u * 15));
  // 剪影
  fillC(p, GRN_D, 252);
  p.beginShape();
  p.vertex(x, baseY - h);
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    p.vertex(x + hw(1 - u), baseY - h * (1 - u));
  }
  p.vertex(x, baseY);
  for (let i = N; i >= 1; i--) {
    const u = i / N;
    p.vertex(x - hw(1 - u), baseY - h * (1 - u));
  }
  p.endShape();
  // 叶簇：一层层小 V
  p.noFill();
  for (let i = 1; i <= 9; i++) {
    const u = i / 10;
    const y = baseY - h * u;
    const hh = hw(u) * 0.96;
    strokeC(p, i % 2 ? GRN_L : GRN, 1.0, 165);
    p.beginShape();
    p.vertex(x - hh, y);
    p.vertex(x - hh * 0.45, y - 4.2);
    p.vertex(x, y - 6.4);
    p.vertex(x + hh * 0.45, y - 4.2);
    p.vertex(x + hh, y);
    p.endShape();
  }
  // 受光侧
  p.noStroke();
  fillC(p, GRN_L, 90);
  p.beginShape();
  p.vertex(x - hw(0.05) * 0.5, baseY - h * 0.02);
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    p.vertex(x - hw(u) * 0.55, baseY - h * u);
  }
  for (let i = 10; i >= 1; i--) {
    const u = i / 10;
    p.vertex(x - hw(u) * 0.14, baseY - h * u);
  }
  p.vertex(x - hw(0.05) * 0.5, baseY - h * 0.02);
  p.endShape();
  // 金边 + 树尖
  p.noFill();
  strokeC(p, GOLD, 1.1, 200);
  p.beginShape();
  p.vertex(x, baseY - h);
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    p.vertex(x + hw(1 - u), baseY - h * (1 - u));
  }
  p.endShape();
  strokeC(p, GOLD, 1.4, 240);
  p.line(x, baseY - h, x, baseY - h - 5);
  fillC(p, GOLD, 250);
  p.circle(x, baseY - h - 6.5, 4.0);
  // 树干
  strokeC(p, [104, 78, 50], 2.0, 210);
  p.line(x, baseY, x, baseY - 10);
}

function drawPavilion(p) {
  const cx = 500, baseY = SKY.y1;
  // 台基
  rectF(p, WHT, 380, baseY - 13, 240, 13);
  rectF(p, [216, 202, 176], 380, baseY - 5, 240, 5);
  rectS(p, GOLD, 380, baseY - 13, 240, 13, 1.3, 240);

  // 两侧翼楼
  for (const s of [-1, 1]) {
    const wx = cx + s * 158;
    rectF(p, WHT, wx - 46, baseY - 48, 92, 35);
    for (let i = 0; i < 2; i++) drawArch(p, wx - 22 + i * 44, baseY - 36, 24, 23, NAVY_D);
    rectS(p, GOLD, wx - 46, baseY - 48, 92, 35, 1.2, 235);
    drawDome(p, wx, baseY - 48, 28, 28, WHT);
  }

  // 主楼
  rectF(p, WHT, 406, baseY - 78, 188, 65);
  for (let i = 0; i < 5; i++) drawArch(p, 424 + i * 38, baseY - 56, 27, 43, NAVY_D);
  // 檐口 + 齿饰
  rectF(p, [246, 236, 216], 398, baseY - 86, 204, 8);
  rectS(p, GOLD, 398, baseY - 86, 204, 8, 1.3, 240);
  p.noStroke();
  fillC(p, GOLD, 220);
  for (let i = 0; i < 21; i++) p.circle(402 + i * 9.6, baseY - 82, 2.6);
  rectS(p, GOLD, 406, baseY - 78, 188, 65, 1.2, 230);

  // 鼓座 + 主穹顶
  rectF(p, WHT, 456, baseY - 104, 88, 18);
  rectS(p, GOLD, 456, baseY - 104, 88, 18, 1.3, 235);
  drawDome(p, cx, baseY - 104, 46, 36, WHT);
  // 屋顶两座小凉亭
  drawChhatri(p, 420, baseY - 78, 32, 30);
  drawChhatri(p, 580, baseY - 78, 32, 30);
}

// ---- 上下两条园路（浅色铺石 + 灌木）----
function drawWalkways(p, rnd) {
  const bands = [[SKY.y1, WALK_T], [GAR.y1, WALK_B]];
  for (const [y0, y1] of bands) {
    rectF(p, SAND, INX0, y0, INX1 - INX0, y1 - y0);
    // 铺石缝
    p.noStroke();
    p.fill(172, 152, 114, 80);
    for (let yy = y0 + 7; yy < y1 - 2; yy += 9) {
      const odd = Math.round((yy - y0) / 9) % 2;
      for (let xx = INX0 + (odd ? 10 : 0); xx < INX1 - 4; xx += 20) p.rect(xx, yy, 16, 1.2);
    }
    // 小菱形纹
    fillC(p, GOLD, 70);
    for (let yy = y0 + 4; yy < y1 - 2; yy += 9) {
      for (let xx = INX0 + 6; xx < INX1 - 4; xx += 20) {
        p.push();
        p.translate(xx, yy);
        p.rotate(Math.PI / 4);
        p.rect(-1.6, -1.6, 3.2, 3.2);
        p.pop();
      }
    }
    strokeC(p, GOLD, 1.2, 190);
    p.line(INX0, y0 + 0.9, INX1, y0 + 0.9);
    p.line(INX0, y1 - 1.2, INX1, y1 - 1.2);
  }
  // 园路两端的小灌木（避开四角宾客）
  for (const b of [[118, SKY.y1 + 16], [884, SKY.y1 + 16], [118, GAR.y1 + 16], [884, GAR.y1 + 16]]) {
    drawShrub(p, b[0], b[1], 15, rnd);
  }
}

function drawShrub(p, x, y, r, rnd) {
  p.noStroke();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    fillC(p, i % 3 === 0 ? GRN_L : (i % 3 === 1 ? GRN : GRN_D), 250);
    p.circle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.34, r * 0.95);
  }
  fillC(p, GRN_L, 250);
  p.circle(x - r * 0.2, y - r * 0.2, r * 0.7);
  // 叶尖小亮点（不用整体描边，免得像盘子）
  p.noStroke();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9;
    fillC(p, [96, 156, 118], 210);
    p.circle(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.50, 2.6);
  }
  for (let i = 0; i < 5; i++) {
    flower4(p, x - r * 0.7 + i * r * 0.35, y - r * 0.2 + (i % 2) * r * 0.3, 3.2,
      FLWR[(i + 1) % FLWR.length], GOLD_D);
  }
}

// ---- 四分园（charbagh）----
function drawCharbagh(p, rnd) {
  rectF(p, GRN_M, GAR.x0, GAR.y0, GAR.x1 - GAR.x0, GAR.y1 - GAR.y0);

  // 水渠（先铺，浅色石缘后画）
  rectF(p, CYAN_D, CHX0, GAR.y0, CHX1 - CHX0, GAR.y1 - GAR.y0);
  rectF(p, CYAN_D, GAR.x0, CHY0, GAR.x1 - GAR.x0, CHY1 - CHY0);
  rectF(p, CYAN, CHX0 + 4, GAR.y0, CHX1 - CHX0 - 8, GAR.y1 - GAR.y0);
  rectF(p, CYAN, GAR.x0, CHY0 + 4, GAR.x1 - GAR.x0, CHY1 - CHY0 - 8);
  drawRipples(p, CHX0, GAR.y0, CHX1 - CHX0, GAR.y1 - GAR.y0, rnd);
  drawRipples(p, GAR.x0, CHY0, GAR.x1 - GAR.x0, CHY1 - CHY0, rnd);

  // 四块花坛（每块外一圈浅色园径，让四分结构一眼可辨）
  const beds = [
    [GAR.x0, GAR.y0, CHX0 - GAR.x0, CHY0 - GAR.y0],
    [CHX1, GAR.y0, GAR.x1 - CHX1, CHY0 - GAR.y0],
    [GAR.x0, CHY1, CHX0 - GAR.x0, GAR.y1 - CHY1],
    [CHX1, CHY1, GAR.x1 - CHX1, GAR.y1 - CHY1],
  ];
  const M = 8;
  for (let b = 0; b < beds.length; b++) {
    const [bx, by, bw, bh] = beds[b];
    rectF(p, [222, 206, 170], bx, by, bw, bh);
    rectF(p, GRN, bx + M, by + M, bw - M * 2, bh - M * 2);
    flowerField(p, bx + M + 2, by + M + 2, bw - M * 2 - 4, bh - M * 2 - 4, 20260808 + b * 977);
    // 深色墨线 + 金线，四分结构才够脆
    rectS(p, [58, 44, 30], bx - 0.6, by - 0.6, bw + 1.2, bh + 1.2, 1.2, 190);
    rectS(p, GOLD, bx + M, by + M, bw - M * 2, bh - M * 2, 1.3, 240);
    rectS(p, GOLD, bx + 0.8, by + 0.8, bw - 1.6, bh - 1.6, 1.0, 200);
    // 四角小铆钉
    p.noStroke();
    fillC(p, GOLD, 235);
    for (const c of [[bx + 3.4, by + 3.4], [bx + bw - 3.4, by + 3.4],
      [bx + 3.4, by + bh - 3.4], [bx + bw - 3.4, by + bh - 3.4]]) p.circle(c[0], c[1], 3.4);
  }

  // 水渠石缘
  rectS(p, GOLD, CHX0, GAR.y0, CHX1 - CHX0, GAR.y1 - GAR.y0, 1.4, 240);
  rectS(p, GOLD, GAR.x0, CHY0, GAR.x1 - GAR.x0, CHY1 - CHY0, 1.4, 240);

  drawPool(p);
  // 水面荷叶（俯视圆片 + 叶脉）
  for (const pad of [[376, 466, 13], [636, 450, 15], [500, 336, 11], [500, 566, 14], [764, 494, 11], [232, 486, 10]]) {
    const px = pad[0], py = pad[1], pr = pad[2];
    fillC(p, GRN_L, 232);
    p.ellipse(px, py, pr * 2, pr * 1.68);
    p.noFill();
    strokeC(p, [116, 178, 136], 0.8, 205);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      p.line(px, py, px + Math.cos(a) * pr * 0.88, py + Math.sin(a) * pr * 0.74);
    }
    p.noStroke();
    fillC(p, [72, 136, 96], 200);
    p.circle(px, py, pr * 0.34);
  }
  for (const l of [[300, 462], [706, 478], [500, 356], [500, 596], [212, 470], [788, 470]]) {
    lotusFloat(p, l[0], l[1], 11);
  }
}

function drawRipples(p, x, y, w, h, rnd) {
  // 俯视水面：一律横向细波纹（与渠轴垂直的读法），间距 11
  const n = Math.max(4, Math.round(h / 11));
  p.noFill();
  for (let i = 0; i < n; i++) {
    const yy = y + (i + 0.5) * (h / n);
    const ph = rnd() * 6;
    strokeC(p, CREAM, 1.0, 112 + (i % 3) * 42);
    p.beginShape();
    for (let s = 0; s <= w; s += 6) {
      p.vertex(x + s, yy + Math.sin(s * 0.055 + ph) * 2.3 + Math.sin(s * 0.019 + ph * 2) * 1.8);
    }
    p.endShape();
  }
  p.noStroke();
  for (let i = 0; i < 60; i++) {
    fillC(p, WHT, 60 + rnd() * 90);
    p.rect(x + rnd() * w, y + rnd() * h, 4 + rnd() * 10, 1.2);
  }
  // 渠壁阴影
  strokeC(p, [16, 52, 64], 2.4, 110);
  p.line(x + 2, y, x + 2, y + h);
  p.line(x + w - 2, y, x + w - 2, y + h);
}

function flowerField(p, x, y, w, h, seed) {
  const r2 = mulberry32(seed);
  // 底层：碎叶与土色小点，让花间的空隙有质感而不是平涂
  p.noStroke();
  for (let i = 0; i < 260; i++) {
    const k = r2();
    p.fill(k > 0.6 ? GRN_L[0] : GRN_D[0], k > 0.6 ? GRN_L[1] : GRN_D[1],
      k > 0.6 ? GRN_L[2] : GRN_D[2], 70 + r2() * 80);
    p.circle(x + r2() * w, y + r2() * h, 1.4 + r2() * 2.8);
  }
  // 花
  const sx = 23, sy = 19;
  let row = 0;
  for (let yy = y + sy * 0.58; yy < y + h - 3; yy += sy, row++) {
    const off = (row % 2) * sx * 0.5;
    for (let xx = x + sx * 0.5 + off; xx < x + w - 3; xx += sx) {
      const jx = xx + (r2() - 0.5) * 7.5;
      const jy = yy + (r2() - 0.5) * 5.5;
      const fr = 4.2 + r2() * 2.2;
      leaf(p, jx - 5.2, jy + 4.4, 9.0 + r2() * 3, 0.66 + (r2() - 0.5) * 0.9, GRN_L, null);
      leaf(p, jx + 5.2, jy + 4.4, 9.0 + r2() * 3, -0.66 + (r2() - 0.5) * 0.9, GRN_L, null);
      const c = BEDF[Math.floor(r2() * BEDF.length) % BEDF.length];
      flower4(p, jx, jy, fr, c, GOLD_D);
    }
  }
  // 花间金点
  p.noStroke();
  for (let i = 0; i < 90; i++) {
    fillC(p, GOLD_L, 80 + r2() * 90);
    p.circle(x + r2() * w, y + r2() * h, 1.5);
  }
}

function drawPool(p) {
  const { x, y, r } = POOL;
  const oct = (rad, rot = Math.PI / 8) => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + rot;
      pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
    }
    return pts;
  };
  // 大理石池沿
  polyF(p, oct(r + 9), [230, 219, 198]);
  polyL(p, oct(r + 9), GOLD, 1.6, 250);
  polyL(p, oct(r + 3), GOLD, 1.0, 205);
  // 池沿上的小铆钉
  p.noStroke();
  fillC(p, GOLD, 240);
  for (const q of oct(r + 6)) p.circle(q[0], q[1], 3.0);
  // 水面
  polyF(p, oct(r), CYAN_L);
  polyF(p, oct(r - 9), CYAN);
  polyF(p, oct(r - 26), CYAN_D);
  // 同心波纹
  for (let i = 1; i <= 2; i++) polyL(p, oct(r * (1 - i * 0.26)), CREAM, 1.0, 130);
  // 水面反光
  p.noStroke();
  for (let i = 0; i < 20; i++) {
    const a = (i * 2.399) % TAU;
    const rr = 16 + ((i * 37) % 40);
    fillC(p, WHT, 55);
    p.ellipse(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9, 9, 1.6);
  }
  polyL(p, oct(r), GOLD, 1.8, 250);
  // 中央喷泉口
  fillC(p, GOLD, 250);
  p.circle(x, y, 10);
  fillC(p, PINK, 250);
  p.circle(x, y, 5.6);
  p.noFill();
  strokeC(p, GOLD_D, 1.1, 235);
  p.circle(x, y, 14);
}

function lotusFloat(p, x, y, r) {
  p.push();
  p.translate(x, y);
  p.noStroke();
  for (let i = 0; i < 6; i++) {
    p.push();
    p.rotate((i / 6) * TAU);
    fillC(p, i % 2 ? PINK : WHT, 242);
    p.ellipse(0, -r * 0.55, r * 0.52, r * 0.9);
    p.pop();
  }
  fillC(p, GOLD, 245);
  p.circle(0, 0, r * 0.44);
  p.pop();
}

// ---- 白色大理石镂空栏杆 ----
function drawRailing(p) {
  const { x0, x1, y0, y1 } = RAIL;
  rectF(p, WHT, x0, y0, x1 - x0, y1 - y0);
  // 压顶
  rectF(p, [252, 248, 236], x0, y0, x1 - x0, 7);
  strokeC(p, GOLD, 1.3, 240);
  p.line(x0, y0 + 0.8, x1, y0 + 0.8);
  p.line(x0, y0 + 7, x1, y0 + 7);
  // 镂空带
  const step = 18;
  for (let x = x0 + 10; x < x1 - 10; x += step) {
    drawArch(p, x, y0 + 10, 10, 20, [30, 66, 54], false);
    p.noFill();
    strokeC(p, GOLD, 0.9, 215);
    p.beginShape();
    archPath(p, x, y0 + 10, 10, 20, 12);
    p.endShape();
    p.noStroke();
    fillC(p, GOLD, 205);
    p.circle(x, y0 + 9.2, 1.8);
    // 墩间小菱形
    p.push();
    p.translate(x + step * 0.5, y0 + 20);
    p.rotate(Math.PI / 4);
    fillC(p, [222, 210, 190], 255);
    p.rect(-2.6, -2.6, 5.2, 5.2);
    strokeC(p, GOLD, 0.8, 220);
    p.rect(-2.6, -2.6, 5.2, 5.2);
    p.pop();
  }
  // 基座
  rectF(p, [246, 238, 220], x0, y0 + 30, x1 - x0, 6);
  strokeC(p, GOLD, 1.3, 240);
  p.line(x0, y0 + 30, x1, y0 + 30);
  p.line(x0, y0 + 36, x1, y0 + 36);
}

// ---- 四角宾客 ----
function drawGuestGroups(p) {
  const rugs = [[171, 296], [829, 296], [169, 670], [831, 670]];
  for (const r of rugs) {
    p.push();
    p.translate(r[0], r[1] + 4);
    rectF(p, NAVY, -46, -8, 92, 16);
    rectF(p, VERM, -40, -5.6, 80, 11.2);
    rectS(p, GOLD, -46, -8, 92, 16, 1.1, 235);
    p.noStroke();
    fillC(p, GOLD, 215);
    for (let i = 0; i < 11; i++) p.circle(-40 + i * 8, 0, 2.2);
    fillC(p, GOLD_L, 150);
    p.rect(-40, -4.4, 80, 1.0);
    p.pop();
  }
  for (const sp of GUESTS) drawFigure(p, sp);
}

function drawFigure(p, sp) {
  const h = sp.h;
  p.push();
  p.translate(sp.x, sp.y);
  p.scale(h / 100);
  if (sp.view === 'up') { p.translate(0, -50); p.rotate(Math.PI); p.translate(0, 50); }
  p.scale(sp.flip || 1, 1);
  const r2 = mulberry32(Math.round(sp.x * 31 + sp.y * 7 + h));

  const halfW = (yy) => 12.5 + 6 * Math.pow(Math.min(1, Math.max(0, -yy / 77)), 2);
  const robeD = [sp.robe[0] * 0.60, sp.robe[1] * 0.60, sp.robe[2] * 0.60];

  // 影子
  p.noStroke();
  fillC(p, [30, 40, 30], 80);
  p.ellipse(0, 2, 34, 6);

  // ---- 长袍 ----
  fillC(p, sp.robe, 255);
  p.beginShape();
  p.vertex(-12.5, -77);
  for (let i = 1; i <= 6; i++) { const u = i / 6; p.vertex(-halfW(-77 + 77 * u), -77 + 77 * u); }
  for (let i = 6; i >= 1; i--) { const u = i / 6; p.vertex(halfW(-77 + 77 * u), -77 + 77 * u); }
  p.vertex(12.5, -77);
  p.vertex(-12.5, -77);
  p.endShape();
  p.noFill();
  strokeC(p, GOLD, 1.2, 230);
  p.beginShape();
  p.vertex(-12.5, -77);
  for (let i = 1; i <= 6; i++) { const u = i / 6; p.vertex(-halfW(-77 + 77 * u), -77 + 77 * u); }
  for (let i = 6; i >= 1; i--) { const u = i / 6; p.vertex(halfW(-77 + 77 * u), -77 + 77 * u); }
  p.vertex(12.5, -77);
  p.endShape();

  // 衣褶
  p.noFill();
  strokeC(p, robeD, 0.9, 205);
  for (let k = -2; k <= 2; k++) {
    p.bezier(k * 4.0, -73, k * 4.7, -46, k * 6.7, -22, k * 6.2, -3);
  }
  // 袍上碎花
  for (let i = 0; i < 7; i++) {
    flower4(p, (r2() - 0.5) * 21, -68 + r2() * 56, 3.0,
      FLWR[Math.floor(r2() * FLWR.length) % FLWR.length], GOLD_D);
  }
  // 背面：一道中缝 + 大披巾边
  if (sp.view === 'back') {
    strokeC(p, GOLD, 1.0, 200);
    p.line(0, -73, 0, -4);
    p.noFill();
    strokeC(p, GOLD_L, 1.1, 170);
    p.bezier(-12, -74, -8, -50, -11, -26, -6, -6);
    p.bezier(12, -74, 8, -50, 11, -26, 6, -6);
  }
  // 下摆金线
  strokeC(p, GOLD, 1.1, 230);
  p.line(-halfW(-2), -2, halfW(-2), -2);

  // ---- 腰带（颜色按袍色明度取反，保证看得见）----
  const lum = (sp.robe[0] * 0.3 + sp.robe[1] * 0.59 + sp.robe[2] * 0.11) / 255;
  const sashC = lum > 0.45 ? VERM : GOLD_L;
  const s0 = halfW(-42), s1 = halfW(-32);
  polyF(p, [[-s0, -42], [s0, -42], [s1, -32], [-s1, -32]], sashC, 252);
  strokeC(p, GOLD, 1.1, 240);
  p.line(-s0, -42, s0, -42);
  p.line(-s1, -32, s1, -32);
  // 腰间小匕首
  strokeC(p, GOLD, 1.5, 245);
  p.line(-s1 - 1, -36, -s1 - 9, -30);
  p.noStroke();
  fillC(p, GOLD, 245);
  p.circle(-s1 - 10, -29, 2.8);

  // ---- 手臂（先描深色轮廓，才不会和躯干糊在一起）----
  strokeC(p, robeD, 7.0, 255);
  p.line(11, -74, 16.5, -58);
  p.line(16.5, -58, 19.5, -46);
  p.line(-11, -74, -15.5, -56);
  p.line(-15.5, -56, -17.5, -49);
  strokeC(p, sp.robe, 5.2, 255);
  p.line(11, -74, 16.5, -58);
  p.line(16.5, -58, 19.5, -46);
  p.line(-11, -74, -15.5, -56);
  p.line(-15.5, -56, -17.5, -49);
  strokeC(p, GOLD, 1.0, 235);
  p.line(17.0, -49.5, 21.2, -48.5);
  p.line(-19.6, -52.5, -15.4, -53.4);
  p.noStroke();
  fillC(p, SKIN, 255);
  p.ellipse(20.5, -45, 5.6, 4.6);
  p.ellipse(-18.5, -48, 5.2, 4.4);

  // ---- 脚（鞋底浅色，倒看时能一眼看出"脚朝上"）----
  fillC(p, [96, 68, 44], 255);
  p.ellipse(-6.8, 0.2, 10.2, 5.8);
  p.ellipse(6.8, 0.2, 10.2, 5.8);
  fillC(p, [214, 188, 148], 255);
  p.ellipse(-6.8, 1.9, 8.8, 2.4);
  p.ellipse(6.8, 1.9, 8.8, 2.4);

  // ---- 颈 / 头 ----
  fillC(p, SKIN, 255);
  p.rect(-3.8, -80.5, 7.6, 6.5);
  p.ellipse(0, -87.6, 15.6, 19);

  if (sp.view !== 'back') {
    drawFace(p, sp.view, SKIN);
  } else {
    // 背面：后脑 + 发髻
    strokeC(p, SKIN_D, 1.1, 200);
    p.noFill();
    p.arc(0, -85, 14, 16, 0.30 * Math.PI, 1.0 * Math.PI);
    p.noStroke();
    fillC(p, [58, 40, 28], 225);
    p.ellipse(-1.5, -81.0, 10.4, 6.6);
  }

  // ---- 缠头（深色轮廓打底，任何底色上都分得开）----
  const tb = sp.turban;
  const tbD = [tb[0] * 0.52, tb[1] * 0.52, tb[2] * 0.52];
  p.noStroke();
  fillC(p, tbD, 255);
  p.ellipse(0, -95.4, 21.0, 12.6);
  fillC(p, tb, 255);
  p.ellipse(0, -95.6, 18.8, 10.8);
  p.ellipse(-6.4, -93.2, 9.4, 8.6);
  p.noFill();
  strokeC(p, GOLD, 1.2, 245);
  p.ellipse(0, -95.6, 18.8, 10.8);
  strokeC(p, tbD, 1.0, 235);
  p.bezier(-9, -93.8, -4, -98.0, 3, -97.7, 9, -94.6);
  p.bezier(-8.6, -91.2, -3, -94.4, 4, -94.3, 8.6, -91.8);
  if (sp.view === 'back') {
    p.noStroke();
    fillC(p, GOLD, 250);
    p.circle(-7.5, -93.0, 3.8);
    strokeC(p, GOLD, 1.1, 235);
    p.line(-7.5, -93.0, -12.5, -96.2);
  } else {
    strokeC(p, GOLD, 1.1, 240);
    p.line(5.5, -100.0, 12.5, -105.0);
    p.noStroke();
    fillC(p, VERM, 245);
    p.ellipse(13.6, -105.8, 5.4, 2.8);
  }

  // ---- 画中画：倒着看那位捧着的小画册 ----
  if (sp.book) drawBooklet(p, 30, -46, 38, 46, sp.view === 'up' ? Math.PI : 0);

  p.pop();
}

function drawFace(p, view, skin) {
  const SH = [52, 36, 24];
  if (view === 'front' || view === 'up') {
    p.noFill();
    strokeC(p, SH, 1.0, 245);
    p.bezier(-6.0, -90.0, -4.0, -91.4, -1.9, -91.1, -1.0, -89.9);
    p.bezier(1.0, -89.9, 1.9, -91.1, 4.0, -91.4, 6.0, -90.0);
    almondEye(p, -3.5, -87.4, 5.2, 2.8);
    almondEye(p, 3.5, -87.4, 5.2, 2.8);
    strokeC(p, SKIN_D, 1.0, 235);
    p.line(0, -87.4, 1.6, -82.6);
    p.line(1.6, -82.6, -0.6, -82.2);
    strokeC(p, SH, 1.0, 235);
    p.bezier(-3.2, -83.0, -1.8, -82.0, -0.4, -82.4, -0.1, -83.5);
    p.bezier(0.1, -83.5, 0.4, -82.4, 1.8, -82.0, 3.2, -83.0);
    strokeC(p, [150, 48, 44], 1.1, 240);
    p.bezier(-2.2, -80.9, -0.8, -80.2, 0.8, -80.2, 2.2, -80.9);
  } else {
    p.noFill();
    strokeC(p, SH, 1.0, 245);
    p.bezier(-1.4, -90.4, 0.9, -91.4, 2.9, -90.8, 4.4, -89.8);
    almondEye(p, 2.6, -87.6, 5.0, 2.6);
    // 尖鼻（侧面）
    p.noStroke();
    fillC(p, skin, 255);
    polyF(p, [[0.6, -88.9], [8.2, -82.3], [1.2, -81.7]], skin, 255);
    strokeC(p, SKIN_D, 1.0, 235);
    p.line(0.8, -88.5, 7.8, -82.5);
    strokeC(p, SH, 1.0, 235);
    p.bezier(0.4, -83.0, 2.1, -81.9, 4.9, -82.3, 6.2, -83.3);
    strokeC(p, [150, 48, 44], 1.1, 240);
    p.line(1.8, -81.0, 5.0, -80.8);
    p.noStroke();
    fillC(p, skin, 255);
    p.ellipse(-4.9, -86.2, 4.8, 6.0);
    strokeC(p, SKIN_D, 1.0, 215);
    p.ellipse(-4.9, -86.2, 4.8, 6.0);
    p.noStroke();
    fillC(p, GOLD, 235);
    p.circle(-4.9, -85.4, 2.4);
  }
}

function almondEye(p, x, y, w, h) {
  p.noStroke();
  p.fill(252, 250, 244);
  p.push();
  p.translate(x, y);
  p.rotate(-0.12);
  p.ellipse(0, 0, w, h);
  p.pop();
  p.fill(28, 20, 16);
  p.circle(x, y + h * 0.05, Math.min(w, h) * 0.70);
  p.noFill();
  strokeC(p, [40, 28, 18], 0.8, 245);
  p.push();
  p.translate(x, y);
  p.rotate(-0.12);
  p.arc(0, 0, w, h, Math.PI, TAU);
  p.pop();
}

// ---- 画中画：更小的细密画册（画着一只同款舱体）----
function drawBooklet(p, x, y, w, h, spin = 0) {
  p.push();
  p.translate(x, y);
  p.rotate(-0.10 + spin);
  // 小手指
  p.noStroke();
  fillC(p, SKIN, 255);
  p.ellipse(-w * 0.42, h * 0.50, 6.6, 5.2);
  p.ellipse(w * 0.42, h * 0.50, 6.6, 5.2);
  // 封皮
  fillC(p, [70, 44, 28], 255);
  p.rect(-w / 2 - 3.2, -h / 2 - 3.2, w + 6.4, h + 6.4, 1.6);
  fillC(p, GOLD, 250);
  p.rect(-w / 2 - 1.4, -h / 2 - 1.4, w + 2.8, h + 2.8, 1.2);
  // 页面：白纸 + 一小块花园绿 + 一道水渠
  fillC(p, [248, 241, 226], 255);
  p.rect(-w / 2 + 1.2, -h / 2 + 1.2, w - 2.4, h - 2.4);
  fillC(p, GRN, 250);
  p.rect(-w / 2 + 2.4, h * 0.14, w - 4.8, h * 0.34);
  fillC(p, CYAN, 235);
  p.rect(-w / 2 + 2.4, h * 0.02, w - 4.8, h * 0.12);
  p.noFill();
  strokeC(p, GOLD_D, 1.0, 225);
  p.rect(-w / 2 + 2.4, -h / 2 + 2.4, w - 4.8, h - 4.8);
  drawTinyCapsule(p, 0, -1.5, 1.0);
  // 装订线
  strokeC(p, GOLD_D, 1.6, 235);
  p.line(-w / 2 - 2.4, -h / 2 - 2, -w / 2 - 2.4, h / 2 + 2);
  p.pop();
}

function drawTinyCapsule(p, x, y, s) {
  p.push();
  p.translate(x, y);
  p.scale(s);
  const w = 24, hh = 27;
  // 檐
  polyF(p, [[-w / 2 - 4, -hh / 2 - 1.4], [-w * 0.24, -hh / 2 - 7], [w * 0.24, -hh / 2 - 7], [w / 2 + 4, -hh / 2 - 1.4]],
    [18, 84, 94], 255);
  // 舱体
  fillC(p, [30, 122, 132], 255);
  p.rect(-w / 2, -hh / 2 - 1.4, w, hh);
  // 窗 3×2
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      fillC(p, [12, 40, 46], 255);
      p.rect(-w / 2 + 2.4 + c * 7.0, -hh / 2 + 2.6 + r * 9.4, 5.6, 7.6);
      p.noFill();
      strokeC(p, VERM, 0.8, 245);
      p.rect(-w / 2 + 2.4 + c * 7.0, -hh / 2 + 2.6 + r * 9.4, 5.6, 7.6);
    }
  }
  p.noFill();
  strokeC(p, GOLD, 1.1, 250);
  p.rect(-w / 2, -hh / 2 - 1.4, w, hh);
  strokeC(p, GOLD, 1.0, 245);
  p.line(-w / 2 - 4, -hh / 2 - 1.4, w / 2 + 4, -hh / 2 - 1.4);
  // 灯 + 光芒
  p.noStroke();
  fillC(p, GOLD_L, 120);
  p.circle(0, -hh / 2 - 12, 15);
  fillC(p, [255, 246, 220], 255);
  p.circle(0, -hh / 2 - 12, 7.4);
  strokeC(p, GOLD, 1.0, 250);
  p.circle(0, -hh / 2 - 12, 7.4);
  p.line(0, -hh / 2 - 12, 0, -hh / 2 - 7.6);
  // 莲花座
  p.noStroke();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    p.push();
    p.translate(Math.cos(a) * 6.4, hh / 2 + 2.2 + Math.sin(a) * 3.0);
    p.rotate(a);
    fillC(p, i % 2 ? PINK : WHT, 252);
    p.ellipse(0, 0, 7.6, 3.6);
    p.pop();
  }
  p.pop();
}

// ---- 极淡金粉噪点 ----
function drawGoldDust(p, rnd) {
  p.noStroke();
  for (let i = 0; i < 230; i++) {
    fillC(p, GOLD_L, 55 + rnd() * 95);
    p.rect(INX0 + rnd() * (INX1 - INX0), INY0 + rnd() * (INY1 - INY0), 1, 1);
  }
  for (let i = 0; i < 70; i++) {
    fillC(p, GOLD_L, 45 + rnd() * 75);
    p.rect(FR.x0 + rnd() * (FR.x1 - FR.x0), FR.y0 + rnd() * (FR.y1 - FR.y0), 1, 1);
  }
}

// ============================================================
// 每帧
// ============================================================
export function render(g, meta, local) {
  g.image(ensurePage(g), 0, 0);
  drawFountain(g, local);
  drawPeacock(g, PEACOCK.x, PEACOCK.y, fanAmt(local));
  drawSightlines(g, local);
  drawFrameFlash(g, local);
}

// ---- 强拍 1：八角水池喷泉（周期两拍）----
function drawFountain(g, local) {
  const cx = POOL.x, cy = POOL.y;
  const u = local % (2 * BEAT);
  g.noFill();
  for (let k = 0; k < 3; k++) {
    const uu = (u + k * 0.34) % 1;
    const rr = 14 + uu * 48;
    strokeC(g, CREAM, 1.1, 110 * (1 - uu));
    g.ellipse(cx, cy, rr * 2, rr * 1.15);
  }
  const H = 92 * Math.exp(-u * 3.2);
  if (H < 2) return;

  // 柔光
  g.noStroke();
  fillC(g, WHT, 26);
  g.circle(cx, cy, 96);
  fillC(g, WHT, 30);
  g.circle(cx, cy, 56);

  // 九道细喷（断续线段 = 水花，不是水柱）
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.135;
    const R = 24 + Math.abs(i - 4) * 5.5;
    for (let s = 0; s < 13; s++) {
      const t0 = s / 13, t1 = (s + 0.58) / 13;
      const pt = (t) => [cx + Math.cos(a) * R * t,
      cy + Math.sin(a) * R * t * 0.30 - H * 0.88 * (4 * t * (1 - t))];
      const p0 = pt(t0), p1 = pt(t1);
      strokeC(g, WHT, 1.5, 205 - t0 * 70);
      g.line(p0[0], p0[1], p1[0], p1[1]);
    }
    g.noStroke();
    for (let d = 0; d < 3; d++) {
      const t = 0.26 + d * 0.26;
      const px = cx + Math.cos(a) * R * t;
      const py = cy + Math.sin(a) * R * t * 0.30 - H * 0.88 * (4 * t * (1 - t));
      fillC(g, WHT, 215);
      g.circle(px, py, 2.2);
    }
  }
  // 中央细针
  strokeC(g, WHT, 2.6, 130);
  g.line(cx, cy, cx, cy - H * 1.02);
  strokeC(g, CREAM, 1.2, 170);
  g.line(cx, cy, cx, cy - H * 1.12);
  g.noStroke();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.34;
    fillC(g, WHT, 205);
    g.circle(cx + Math.cos(a) * 6, cy - H * 1.12 + Math.sin(a) * 4, 2.4);
  }
  // 池口金光
  g.noFill();
  strokeC(g, GOLD_L, 1.5, 110 * Math.min(1, H / 40));
  g.circle(cx, cy, 24);
}

// ---- 强拍 3：孔雀开屏 ----
function fanAmt(local) {
  const u = local % 2;
  return smooth(0.0, 1.15, u) * (1 - smooth(1.45, 2.0, u));
}

function drawPeacock(g, x, y, fan) {
  g.push();
  g.translate(x, y);
  const R = 60 * (0.46 + 0.54 * fan);

  // 收屏时的拖尾长羽
  if (fan < 0.95) {
    const k = 1 - fan;
    for (let i = 0; i < 5; i++) {
      g.noFill();
      strokeC(g, GRN_D, 1.6, 210 * k);
      g.bezier(-4, -18, 12 + i * 4, -8, 24 + i * 5, 2, 30 + i * 6, 14 + i * 2);
      g.noStroke();
      fillC(g, GRN_D, 225 * k);
      g.circle(30 + i * 6, 14 + i * 2, 5.6);
      fillC(g, GOLD, 235 * k);
      g.circle(30 + i * 6, 14 + i * 2, 2.4);
    }
  }

  // 尾屏
  if (fan > 0.03) {
    g.noStroke();
    fillC(g, [26, 66, 54], 245 * fan);
    g.arc(0, -6, R * 2, R * 1.98, Math.PI + 0.07, TAU - 0.07);
    fillC(g, [38, 92, 72], 215 * fan);
    g.arc(0, -6, R * 1.62, R * 1.60, Math.PI + 0.16, TAU - 0.16);
    g.noFill();
    strokeC(g, GOLD, 1.8, 240 * fan);
    g.arc(0, -6, R * 2, R * 1.98, Math.PI + 0.07, TAU - 0.07);
    const N = 15;
    // 扇贝羽尖
    for (let i = 0; i < N; i++) {
      const a = Math.PI + 0.07 + ((i + 0.5) / N) * (Math.PI - 0.14);
      g.noFill();
      strokeC(g, GOLD_L, 0.9, 190 * fan);
      g.arc(Math.cos(a) * R * 0.96, -6 + Math.sin(a) * R * 0.96, 13, 13,
        a + Math.PI * 0.30, a + Math.PI * 1.70);
    }
    for (let i = 0; i < N; i++) {
      const a = Math.PI + 0.10 + (i / (N - 1)) * (Math.PI - 0.20);
      const L = R * (0.90 + 0.10 * Math.sin(i * 2.1));
      strokeC(g, GRN_L, 1.2, 235 * fan);
      g.line(Math.cos(a) * R * 0.10, -6 + Math.sin(a) * R * 0.08,
        Math.cos(a) * L * 0.92, -6 + Math.sin(a) * L * 0.92);
      const ex = Math.cos(a) * L * 0.86, ey = -6 + Math.sin(a) * L * 0.86;
      g.push();
      g.translate(ex, ey);
      g.rotate(a + Math.PI / 2);
      g.noStroke();
      fillC(g, [34, 104, 86], 250 * fan);
      g.ellipse(0, 0, 12.5, 15.5);
      fillC(g, NAVY_D, 250 * fan);
      g.ellipse(0, 0, 8.6, 10.8);
      fillC(g, [72, 190, 170], 250 * fan);
      g.ellipse(0, 0, 5.4, 6.6);
      fillC(g, GOLD_L, 252 * fan);
      g.circle(0, -1.2, 2.8);
      g.noFill();
      strokeC(g, GOLD, 1.0, 245 * fan);
      g.ellipse(0, 0, 12.5, 15.5);
      g.pop();
    }
  }

  // 鸟身（朝左）
  g.push();
  g.scale(-1, 1);
  strokeC(g, [126, 100, 64], 1.8, 245);
  g.line(-3, -16, -5, 0);
  g.line(4, -16, 6, 0);
  strokeC(g, [126, 100, 64], 1.4, 245);
  g.line(-8, 0, -2, 0);
  g.line(3, 0, 9, 0);
  // 尾羽根部
  g.noStroke();
  fillC(g, GRN_D, 255);
  g.ellipse(-9, -22, 16, 20);
  // 身
  fillC(g, [52, 92, 140], 255);
  polyF(g, [[2, -44], [10, -37], [14, -23], [9, -11], [0, -8], [-9, -13], [-10, -27], [-4, -38]],
    [52, 92, 140], 255);
  polyL(g, [[2, -44], [10, -37], [14, -23], [9, -11], [0, -8], [-9, -13], [-10, -27], [-4, -38]],
    GOLD, 1.2, 245);
  // 翅（叶形 + 金羽枝）
  g.noStroke();
  fillC(g, [26, 54, 100], 255);
  polyF(g, [[-8, -40], [1, -38], [7, -28], [4, -18], [-4, -15], [-10, -22], [-12, -33]],
    [26, 54, 100], 255);
  polyL(g, [[-8, -40], [1, -38], [7, -28], [4, -18], [-4, -15], [-10, -22], [-12, -33]],
    GOLD, 0.9, 215);
  strokeC(g, GOLD, 0.8, 200);
  for (let i = 0; i < 4; i++) g.line(-9 + i * 4.4, -34, -7 + i * 4.4, -21);
  // 颈
  strokeC(g, [52, 92, 140], 6.4, 255);
  g.line(5, -41, 11, -55);
  strokeC(g, GOLD, 0.8, 130);
  g.line(3, -42, 9, -55);
  // 头
  g.noStroke();
  fillC(g, [26, 54, 96], 255);
  g.ellipse(12, -58, 12, 10);
  strokeC(g, GOLD, 1.1, 235);
  g.ellipse(12, -58, 12, 10);
  // 喙
  g.noStroke();
  fillC(g, GOLD, 250);
  polyF(g, [[17, -59.6], [24, -57.6], [17, -55.4]], GOLD, 250);
  // 冠羽
  strokeC(g, GOLD, 1.0, 240);
  for (let i = 0; i < 3; i++) g.line(10 + i * 2.2, -62, 11 + i * 2.8, -67.5);
  g.noStroke();
  fillC(g, GOLD, 245);
  for (let i = 0; i < 3; i++) g.circle(11 + i * 2.8, -68.2, 2.1);
  // 眼
  g.fill(252, 250, 244);
  g.circle(13.4, -59.4, 4.0);
  g.fill(30, 24, 18);
  g.circle(13.7, -59.4, 1.8);
  g.pop();

  g.pop();
}

// ---- 每拍亮一次、第 2 小节最亮：四组视线汇聚到舱体 ----
function drawSightlines(g, local) {
  const cx = routeU(local) * 1000;
  // 汇聚点落在莲花座下沿，既「汇聚到舱体」又不会被舱体完全挡住
  const cy = 470 + hoverY(local) * 1.4 + 10;
  const beatPh = (local % BEAT) / BEAT;
  const flash = Math.exp(-Math.pow(beatPh / 0.20, 2));
  const hype = smooth(1.5, 2.1, local) * (1 - smooth(3.9, 4.4, local));
  const a = 52 + 54 * hype + 120 * flash * (0.30 + 0.70 * hype);

  for (const sp of GUESTS) {
    const e = eyeOf(sp);
    dashLine(g, e[0], e[1], cx, cy, 8.5, 6.5, GOLD, 1.2, a);
  }
  dashLine(g, PEACOCK.x - 13, PEACOCK.y - 62, cx, cy, 7, 8, GOLD, 1.0, a * 0.75);

  g.noStroke();
  fillC(g, GOLD_L, Math.min(255, a * 1.6));
  g.circle(cx, cy, 4.5 + 5 * flash);
  g.noFill();
  strokeC(g, GOLD, 1.1, Math.min(255, a * 1.35));
  g.circle(cx, cy, 11 + 9 * flash);
}

function eyeOf(sp) {
  const h = sp.h;
  if (sp.view === 'up') return [sp.x, sp.y - h * 0.105];
  return [sp.x, sp.y - h * 0.895];
}

// ---- 过框：金色花边整体亮一次 ----
function drawFrameFlash(g, local) {
  const d = Math.min(local, 6 - local);
  const glow = Math.exp(-Math.pow(d / 0.16, 2));
  if (glow < 0.01) return;
  g.noStroke();
  fillC(g, GOLD_L, 66 * glow);
  g.rect(FR.x0, FR.y0, FR.x1 - FR.x0, BAND);
  g.rect(FR.x0, FR.y1 - BAND, FR.x1 - FR.x0, BAND);
  g.rect(FR.x0, FR.y0 + BAND, BAND, FR.y1 - FR.y0 - BAND * 2);
  g.rect(FR.x1 - BAND, FR.y0 + BAND, BAND, FR.y1 - FR.y0 - BAND * 2);
  // 内外沿一道亮金线，读作"画页翻过"
  g.noFill();
  strokeC(g, WHT, 1.6, 150 * glow);
  g.rect(FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0);
  strokeC(g, GOLD_L, 2.4, 190 * glow);
  g.rect(FR.x0 + BAND, FR.y0 + BAND, FR.x1 - FR.x0 - BAND * 2, FR.y1 - FR.y0 - BAND * 2);
}

// ============================================================
// 本版块时空舱：细密画版（莲花座 + 满布卷草 + 灯笼火焰光芒）
// ============================================================
let CAPG = null;
const CAPW = 320, CAPH = 330, CAP_OX = 150, CAP_OY = 272;

function ensureCap(g) {
  if (CAPG) return CAPG;
  const p = g.createGraphics(CAPW, CAPH);
  p.pixelDensity(1);
  p.strokeCap(p.ROUND);
  p.strokeJoin(p.ROUND);
  const rnd = mulberry32(88061008);

  const s = CAP.s;
  const W = CAP.w * s, H = CAP.h * s;
  const x = CAP_OX, baseY = CAP_OY;
  const topY = baseY - H;

  // ---- 莲花座（八瓣，粉白）----
  drawLotusSeat(p, x, baseY + 8, 37 * s);

  // ---- 舱体 ----
  p.noStroke();
  p.fill(30, 122, 132);
  p.rect(x - W / 2, topY, W, H, 8 * s);
  p.fill(0, 0, 0, 42);
  p.rect(x - W / 2, topY, W * 0.15, H, 8 * s);

  // 卷草纹只铺在窗面板以外的边饰带与门板上（避免糊住窗）
  vineField(p, x - W / 2 + 2, topY + 2, W - 4, 26, 26, rnd,
    { lw: 1.0, sa: 205, stem: GOLD_L, flower: 0.30, spark: false });
  vineField(p, x - W / 2 + 2, winBottomGuess(topY) + 2, 18, 62, 22, rnd,
    { lw: 0.9, sa: 190, stem: GOLD_L, flower: 0.34, spark: false });
  vineField(p, x + W / 2 - 20, winBottomGuess(topY) + 2, 18, 62, 22, rnd,
    { lw: 0.9, sa: 190, stem: GOLD_L, flower: 0.34, spark: false });

  // ---- 窗（3 列 × 2 行横长窗）----
  const padX = 26, winTop = topY + 30, winW = W - padX * 2, winH = 70;
  const gap = 5 * s;
  const cw = (winW - gap * 2) / 3, ch = (winH - gap) / 2;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = x - W / 2 + padX + c * (cw + gap);
      const wy = winTop + r * (ch + gap);
      p.noStroke();
      p.fill(14, 48, 54);
      p.rect(wx, wy, cw, ch, 2);
      p.fill(255, 255, 255, 26);
      p.push();
      p.translate(wx + cw / 2, wy + ch / 2);
      p.rotate(-0.42);
      p.rect(-cw * 0.24, -ch, cw * 0.10, ch * 2);
      p.pop();
      // 朱红窗框 + 金线
      p.noFill();
      strokeC(p, VERM, 2.2, 250);
      p.rect(wx, wy, cw, ch, 2);
      strokeC(p, GOLD, 0.9, 210);
      p.rect(wx - 1.7, wy - 1.7, cw + 3.4, ch + 3.4, 3);
      strokeC(p, [12, 60, 70], 1.0, 150);
      p.line(wx + cw / 2, wy, wx + cw / 2, wy + ch);
    }
  }
  // 窗面板金框
  p.noFill();
  strokeC(p, GOLD, 1.3, 240);
  p.rect(x - W / 2 + padX - 5, winTop - 5, winW + 10, winH + 10, 3);
  strokeC(p, GOLD_L, 0.8, 180);
  p.rect(x - W / 2 + padX - 7.5, winTop - 7.5, winW + 15, winH + 15, 4);

  // ---- 门板：左三道百叶 + 右刻度盘 ----
  const doorTop = winTop + winH + 8;
  const doorH = baseY - 12 - doorTop;
  // 门板底
  p.noStroke();
  fillC(p, [24, 104, 114], 255);
  p.rect(x - W / 2 + 8, doorTop, W - 16, doorH, 2);
  vineField(p, x - W / 2 + 9, doorTop + 1, W - 18, doorH - 2, 24, rnd,
    { lw: 0.9, sa: 175, stem: GOLD_L, flower: 0.30, spark: false });
  p.noFill();
  strokeC(p, GOLD, 1.2, 235);
  p.rect(x - W / 2 + 8, doorTop, W - 16, doorH, 2);
  strokeC(p, [12, 60, 70], 2.0, 190);
  p.line(x, doorTop, x, doorTop + doorH);
  for (let i = 0; i < 3; i++) {
    p.noStroke();
    fillC(p, [18, 86, 96], 255);
    p.rect(x - W / 2 + 20, doorTop + 7 + i * 10, W * 0.24, 4.6, 2);
    p.noFill();
    strokeC(p, GOLD, 1.0, 235);
    p.rect(x - W / 2 + 20, doorTop + 7 + i * 10, W * 0.24, 4.6, 2);
  }
  const dx = x + W * 0.23, dy = doorTop + doorH * 0.46, dr = 15 * s;
  p.noStroke();
  fillC(p, [14, 62, 72], 255);
  p.circle(dx, dy, dr * 2);
  p.noFill();
  strokeC(p, GOLD, 1.6, 245);
  p.circle(dx, dy, dr * 2);
  strokeC(p, GOLD_L, 1.0, 225);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    p.line(dx + Math.cos(a) * dr * 0.70, dy + Math.sin(a) * dr * 0.70,
      dx + Math.cos(a) * dr * 0.94, dy + Math.sin(a) * dr * 0.94);
  }
  strokeC(p, GOLD, 2.2, 240);
  p.line(x + 6, doorTop + doorH * 0.40, x + 6, doorTop + doorH * 0.62);

  // ---- 宽底座 ----
  p.noStroke();
  fillC(p, [18, 84, 94], 255);
  p.rect(x - (W / 2 + 7), baseY - 12, W + 14, 12, 3);
  p.noFill();
  strokeC(p, GOLD, 2.0, 245);
  p.line(x - (W / 2 + 7), baseY - 12, x + (W / 2 + 7), baseY - 12);
  strokeC(p, GOLD, 1.3, 230);
  p.line(x - (W / 2 + 7), baseY - 1, x + (W / 2 + 7), baseY - 1);
  p.noStroke();
  for (let i = 0; i < 7; i++) {
    flower4(p, x - W / 2 + 12 + i * ((W - 24) / 6), baseY - 6, 3.4,
      FLWR[(i + 2) % FLWR.length], GOLD_D);
  }

  // ---- 四坡短檐 ----
  const eaveW = (CAP.w + 26) * s, eaveH = 22 * s, ridgeW = CAP.w * 0.46 * s;
  p.noStroke();
  fillC(p, [18, 84, 94], 255);
  polyF(p, [[x - eaveW / 2, topY], [x - ridgeW / 2, topY - eaveH],
    [x + ridgeW / 2, topY - eaveH], [x + eaveW / 2, topY]], [18, 84, 94], 255);
  p.noFill();
  strokeC(p, GOLD, 3.2, 250);
  p.line(x - eaveW / 2, topY, x + eaveW / 2, topY);
  strokeC(p, GOLD, 1.4, 240);
  p.beginShape();
  p.vertex(x - eaveW / 2, topY);
  p.vertex(x - ridgeW / 2, topY - eaveH);
  p.vertex(x + ridgeW / 2, topY - eaveH);
  p.vertex(x + eaveW / 2, topY);
  p.endShape();
  p.noStroke();
  for (let i = 0; i < 11; i++) {
    flower4(p, x - eaveW / 2 + 8 + i * ((eaveW - 16) / 10), topY - eaveH * 0.44, 3.6,
      FLWR[(i + 1) % FLWR.length], GOLD_D);
  }
  strokeC(p, GOLD, 2.4, 245);
  p.line(x, topY - eaveH, x, topY - eaveH - 12 * s);
  p.noStroke();
  fillC(p, GOLD, 245);
  p.circle(x, topY - eaveH - 13 * s, 4.4 * s);

  // ---- 六角灯笼本体（用近白灯芯 + 金边，从光芒里跳出来）----
  const lampY = topY - (eaveH + 27 * s);
  const lampR = 19 * s;
  strokeC(p, GOLD, 2.8 * s, 245);
  p.line(x, topY - eaveH, x, lampY + lampR);
  p.noStroke();
  fillC(p, [70, 46, 24], 255);
  p.circle(x, lampY, lampR * 2 + 5);
  fillC(p, [255, 246, 220], 255);
  p.beginShape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    p.vertex(x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR);
  }
  p.vertex(x, lampY - lampR);
  p.endShape();
  // 六个面里的金色小菱形
  fillC(p, GOLD_L, 255);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    p.circle(x + Math.cos(a) * lampR * 0.52, lampY + Math.sin(a) * lampR * 0.52, 3.4);
  }
  p.noFill();
  strokeC(p, GOLD, 2.6, 250);
  p.beginShape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    p.vertex(x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR);
  }
  p.vertex(x, lampY - lampR);
  p.endShape();
  // 灯顶小珠
  p.noStroke();
  fillC(p, GOLD, 250);
  p.circle(x, lampY, 2.6);

  CAPG = p;
  return p;
}

function winBottomGuess(topY) { return topY + 100; }

function drawLotusSeat(p, x, y, r) {
  p.push();
  p.translate(x, y);
  // 底托
  p.noStroke();
  fillC(p, [18, 84, 94], 255);
  p.ellipse(0, -8, r * 1.9, r * 0.44);
  // 后圈大瓣（被舱体压住上半，只露出左右与下方）
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    p.push();
    p.rotate(a);
    fillC(p, PINK, 250);
    p.beginShape();
    p.vertex(0, 0);
    p.bezier(r * 0.26, -r * 0.30, r * 0.72, -r * 0.26, r, 0);
    p.bezier(r * 0.72, r * 0.26, r * 0.26, r * 0.30, 0, 0);
    p.vertex(0, 0);
    p.endShape();
    p.noFill();
    strokeC(p, GOLD, 0.9, 240);
    p.beginShape();
    p.vertex(0, 0);
    p.bezier(r * 0.26, -r * 0.30, r * 0.72, -r * 0.26, r, 0);
    p.bezier(r * 0.72, r * 0.26, r * 0.26, r * 0.30, 0, 0);
    p.endShape();
    p.noStroke();
    fillC(p, WHT, 180);
    p.ellipse(r * 0.50, 0, r * 0.42, r * 0.20);
    p.pop();
  }
  // 前圈小瓣（只画下半个，形成"杯子"感）
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i - 2.5) * 0.52;
    p.push();
    p.rotate(a);
    fillC(p, WHT, 252);
    p.beginShape();
    p.vertex(0, 0);
    p.bezier(r * 0.20, -r * 0.26, r * 0.56, -r * 0.22, r * 0.76, 0);
    p.bezier(r * 0.56, r * 0.22, r * 0.20, r * 0.26, 0, 0);
    p.vertex(0, 0);
    p.endShape();
    p.noFill();
    strokeC(p, GOLD, 0.8, 235);
    p.beginShape();
    p.vertex(0, 0);
    p.bezier(r * 0.20, -r * 0.26, r * 0.56, -r * 0.22, r * 0.76, 0);
    p.bezier(r * 0.56, r * 0.22, r * 0.20, r * 0.26, 0, 0);
    p.endShape();
    p.pop();
  }
  fillC(p, CREAM, 255);
  p.circle(0, 0, r * 0.56);
  fillC(p, GOLD, 248);
  p.circle(0, 0, r * 0.26);
  p.noFill();
  strokeC(p, GOLD_D, 1.1, 235);
  p.circle(0, 0, r * 0.56);
  // 与舱体之间的束腰金环
  p.noStroke();
  fillC(p, GOLD, 250);
  p.ellipse(0, -r * 0.12, r * 1.05, r * 0.30);
  fillC(p, GOLD_D, 255);
  p.ellipse(0, -r * 0.06, r * 0.92, r * 0.18);
  p.pop();
}

// 16 道金色火焰光芒（随漩涡旋转）
function drawFlameRays(g, cx, cy, s, t) {
  const a0 = swirlAngle(t);
  g.push();
  g.translate(cx, cy);
  g.noStroke();
  for (let i = 3; i >= 1; i--) {
    fillC(g, GOLD_L, 9 * i);
    g.circle(0, 0, (30 + i * 13) * s);
  }
  for (let i = 0; i < 16; i++) {
    const a = a0 + (i / 16) * TAU;
    const long = i % 2 === 0;
    const L = (long ? 36 : 24) * s;
    const w = (long ? 8 : 5.6) * s;
    const r0 = 26 * s;
    g.push();
    g.rotate(a);
    g.noStroke();
    fillC(g, GOLD, 80);
    polyF(g, [[r0, -w * 1.5], [r0 + L * 0.62, -w * 1.05], [r0 + L, 0],
      [r0 + L * 0.62, w * 1.05], [r0, w * 1.5]], GOLD, 80);
    fillC(g, GOLD_L, 235);
    polyF(g, [[r0 + 2, -w * 0.58], [r0 + L * 0.55, -w * 0.74], [r0 + L * 0.94, 0],
      [r0 + L * 0.55, w * 0.58], [r0 + 2, w * 0.58]], GOLD_L, 235);
    g.pop();
  }
  g.pop();
}

export function drawVehicle(g, { x, y, local, t, wave }) {
  const s = CAP.s;
  const baseY = 470 + hoverY(local) * 1.4;
  const topY = baseY - CAP.h * s;
  const lampY = topY - (22 * s + 27 * s);
  const lampR = 19 * s;

  // 池面上的淡淡投影 + 一圈水纹
  g.noStroke();
  fillC(g, [12, 44, 50], 40);
  g.ellipse(POOL.x, POOL.y + 6, 120, 22);
  g.noFill();
  strokeC(g, CREAM, 1.0, 60);
  g.ellipse(POOL.x, POOL.y + 6, 132, 26);

  drawFlameRays(g, x, lampY, s, t);
  g.image(ensureCap(g), x - CAP_OX, baseY - CAP_OY);

  // 灯内漩涡
  g.noFill();
  strokeC(g, GOLD_D, 2.4, 230);
  const a0 = swirlAngle(t);
  g.arc(x, lampY, lampR * 1.30, lampR * 1.30, a0, a0 + 2.0);
  g.arc(x, lampY, lampR * 0.70, lampR * 0.70, a0 + Math.PI, a0 + Math.PI + 2.0);

  // 刻度盘指针
  const dx = x + CAP.w * s * 0.23;
  const doorTop = topY + 30 + 70 + 8;
  const dy = doorTop + (baseY - 12 - doorTop) * 0.46;
  const dr = 15 * s;
  strokeC(g, CREAM, 1.9, 240);
  const na = swirlAngle(t) - Math.PI / 2;
  g.line(dx, dy, dx + Math.cos(na) * dr * 0.62, dy + Math.sin(na) * dr * 0.62);

  // 驾驶员（上排中窗）
  const cwv = (CAP.w * s - 52 - 5 * s * 2) / 3;
  const chv = (70 - 5 * s) / 2;
  drawDriver(g, x - CAP.w * s / 2 + 26 + (cwv + 5 * s) + cwv / 2,
    topY + 30 + chv * 0.68, s, wave, t);
}

function drawDriver(g, cx, cy, s, wave, t) {
  g.push();
  // 窗内是暖光，人读作浅色剪影
  g.noStroke();
  fillC(g, [248, 226, 182], 235);
  g.circle(cx, cy - 8 * s, 12.5 * s);
  g.ellipse(cx, cy + 5 * s, 18.5 * s, 11 * s);
  strokeC(g, [248, 226, 182], 4.2 * s, 235);
  if (wave) {
    const wig = Math.sin(t * 9) * 0.30;
    g.line(cx + 5 * s, cy + 2 * s, cx + 14 * s, cy - 17 * s + wig * 6 * s);
  } else {
    g.line(cx + 5 * s, cy + 2 * s, cx + 12 * s, cy + 6 * s);
  }
  // 朱红缠头 + 一点肤色
  g.noStroke();
  fillC(g, VERM, 250);
  g.ellipse(cx, cy - 12.5 * s, 14 * s, 6.4 * s);
  fillC(g, [30, 24, 18], 220);
  g.circle(cx + 3.2 * s, cy - 8 * s, 1.7 * s);
  g.pop();
}
