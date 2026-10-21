// ============================================================
// s13-scream.js — 第 13 格：呐喊（1893 表现主义母题）
//
// 一句话美术口径：宽笔横扫的血色天空，对撞硬直线的强透视木桥。
//
//   天空：橙红 / 血红 / 土黄 七道宽笔色带横向贯穿（weight 26~64、
//         长弧线、dry 0.2~0.35 的毛糙边缘），舱体经过处被时间漩涡
//         吸出一道漩涡。
//   桥  ：左下 → 右上强透视木桥，四条主线向消失点 (1050,470) 收束，
//         全用 weight 5~8 的方头硬直线；桥面木板线带 1~2 单位正弦扰动。
//   水  ：蓝黑峡湾的横向扭曲线 + 两艘极简黑船（硬直线）。
//   人  ：三个自绘极简扭曲剪影。主人物双手捂脸、指缝留两道缝，缝里
//         两只小眼偷看舱体；中段一人伸手指舱体、一人抱头蹲下。
//   舱  ：飞过桥上方（中心 y≈440，尺寸 0.8），所有直线变波浪线
//         （振幅 4~8）；一圈半径 130 的可见扭曲光环把色带吸出波纹。
//
// 版权：只取 1893 公有领域的"呐喊"母题（扭曲血色天空 + 斜向木桥 +
//       捂脸的人）。构图、桥的走向与角度、人物位置、峡湾形状全部自绘，
//       不描摹原作头部造型；人物为极简剪影，眼睛只画两个小点。
// ============================================================

import { TAU, BAR, SCENE_LEN, routeU, hoverY, swirlAngle, smooth } from '../beat/beats.js';
import { catmull, grain, vignette, mulberry32 } from '../kit/kit.js';
import { inkStroke, paper } from '../kit/ink.js';

// ---- 调色 ----
const ORANGE = [217, 74, 42];    // 橙红 #d94a2a
const BLOOD = [166, 60, 42];     // 血红 #a63c2a
const OCHRE = [217, 138, 74];    // 土黄 #d98a4a
const NAVY = [26, 36, 48];      // 深蓝黑 #1a2430
const INDIGO = [42, 58, 90];     // 靛 #2a3a5a
const PALE = [216, 192, 160];    // 苍白 #d8c0a0
const WOOD = [74, 48, 32];       // 暗棕 #4a3020
const WOOD_D = [40, 26, 17];
const BOAT = [12, 17, 23];

// ---- 桥的透视：消失点 (850,470)，近端 x=40，画到 x=730 ----
const VPX = 850, VPY = 470, X0 = 40, X1 = 730;
const PIVOT = [40, 660];           // 强拍抖动支点（桥的近端）
// v：桥横截面参数。v=0 甲板远边（栏杆落脚线），v=1 甲板近边，
//    v=-0.30 栏杆上扶手，v=1.14 桥底横梁
const V_RAIL_TOP = -0.30, V_DECK_FAR = 0.0, V_DECK_NEAR = 1.0, V_BEAM = 1.14;

function yAt(v, x) {
  const y0 = 580 + 170 * v;
  return y0 - (y0 - VPY) * (x - X0) / (VPX - X0);
}

// ---- 舱体飞行高度（drawVehicle 与 render 必须一致）----
const FLY_UP = 450;               // 890 - 450 = 440
function vehCY(local) { return 440 + hoverY(local) * 1.2; }

// ---- 天空色带 ----
const BANDS = [
  { y: 74, w: 40, rgb: BLOOD, a: 0.52, amp: 15, k: 1.6, s: 11 },
  { y: 124, w: 30, rgb: OCHRE, a: 0.60, amp: 21, k: 1.2, s: 13 },
  { y: 174, w: 54, rgb: ORANGE, a: 0.62, amp: 25, k: 1.0, s: 17 },
  { y: 236, w: 32, rgb: OCHRE, a: 0.54, amp: 22, k: 1.5, s: 19 },
  { y: 296, w: 46, rgb: BLOOD, a: 0.58, amp: 27, k: 0.9, s: 23 },
  { y: 358, w: 58, rgb: ORANGE, a: 0.56, amp: 19, k: 1.3, s: 29 },
  { y: 430, w: 40, rgb: OCHRE, a: 0.50, amp: 15, k: 1.7, s: 31 },
];
const STREAKS = [
  { y: 208, w: 11, rgb: NAVY, a: 0.30, amp: 26, k: 1.1, s: 37 },
  { y: 396, w: 13, rgb: NAVY, a: 0.26, amp: 18, k: 1.4, s: 41 },
];

let paperLayer = null;

// ============================================================
export function render(g, meta, local) {
  g.image(ensurePaper(g), 0, 0, 1000, 1000);

  const cx = routeU(local) * 1000;
  const cy = vehCY(local);
  const glow = crossGlow(local);

  drawSkyBase(g);
  drawBands(g, local, cx, cy);
  drawSkyBlots(g);
  drawWater(g, local);
  drawBoats(g, local);
  drawCanyonShadow(g);

  const rot = bridgeShake(local);
  drawBridge(g, rot);
  drawFigures(g, local, cx, cy, rot);

  // 全幅颜料颗粒 + 晕影
  grain(g, 0, 0, 1000, 1000, 1313, 24);
  vignette(g, 0, 0, 1000, 1000, 78);

  // 过框：色带整体提亮 10% 再收回（读作镜头推近）
  if (glow > 0.01) {
    g.push();
    g.noStroke();
    g.fill(255, 226, 176, 255 * 0.10 * glow);
    g.rect(0, 0, 1000, 1000);
    g.pop();
  }
}

// 第 2 小节推近 16%，焦点落在捂脸偷看的人身上
export function camera(local) {
  const u = smooth(1.6, 2.3, local) * (1 - smooth(3.6, 4.2, local));
  return { z: 1 + 0.16 * u, fx: 300, fy: 560 };
}

// ============================================================
// 一、天空：底色 + 七道宽笔色带 + 漩涡抽吸
// ============================================================
function ensurePaper(g) {
  if (paperLayer) return paperLayer;
  paperLayer = paper(g, {
    w: 1000, h: 1000, scale: 2, seed: 1313,
    base: [206, 158, 108], fiber: 1.3, mottle: 0.6,
  });
  return paperLayer;
}

function drawSkyBase(g) {
  const ctx = g.drawingContext;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, 530);
  grad.addColorStop(0, 'rgb(104,38,32)');
  grad.addColorStop(0.45, 'rgb(178,84,44)');
  grad.addColorStop(1, 'rgb(212,140,80)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1000, 530);
  ctx.restore();
}

function bandCtrl(spec, phase) {
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const x = -90 + i * 200;
    const y = spec.y
      + spec.amp * Math.sin(i * 0.85 + phase)
      + 9 * Math.sin(i * 0.33 - phase * 0.7);
    pts.push([x, y]);
  }
  return pts;
}

function drawBands(g, local, cx, cy) {
  const base = local * 0.55 + kickPhase(local);
  for (const b of BANDS) {
    const ctrl = bandCtrl(b, base * (1 + b.k * 0.12) + b.k * 2);
    const pts = catmull(ctrl.map((p) => swirlPt(p, cx, cy)), 8);
    // 主笔：宽笔横扫（填充式宽带，无串珠）
    wideBrush(g, pts, b.w, b.rgb, b.a, b.s, 0.1);
    // 复笔：更宽更糙的低透明层，做出毛边与飞白
    wideBrush(g, pts, b.w * 1.18, b.rgb, b.a * 0.42, b.s + 101, 0.34);
  }
  for (const s of STREAKS) {
    const ctrl = bandCtrl(s, base * (1 + s.k * 0.12) + s.k * 2);
    wideBrush(g, catmull(ctrl.map((p) => swirlPt(p, cx, cy)), 8), s.w, s.rgb, s.a, s.s, 0.28);
  }
}

// 宽笔横扫：沿点列两侧法向铺成填充多边形，边缘带噪声毛糙
function wideBrush(g, pts, w, rgb, alpha, seed, rough) {
  const n = pts.length;
  const top = [], bot = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)], r = pts[Math.max(0, i - 1)];
    let tx = q[0] - r[0], ty = q[1] - r[1];
    const L = Math.hypot(tx, ty) || 1;
    const nx = -ty / L, ny = tx / L;
    const phz = i * 0.31 + seed * 0.7;
    const wob = Math.sin(phz) * 0.5 + Math.sin(phz * 2.7 + 1.3) * 0.3
      + Math.sin(phz * 5.9 + 2.1) * 0.2;
    const half = (w / 2) * (1 + rough * wob) + rough * 3;
    top.push([p[0] + nx * half, p[1] + ny * half]);
    bot.push([p[0] - nx * half, p[1] - ny * half]);
  }
  g.push();
  g.noStroke();
  g.fill(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.beginShape();
  for (const p of top) g.vertex(p[0], p[1]);
  for (let i = n - 1; i >= 0; i--) g.vertex(bot[i][0], bot[i][1]);
  g.endShape(g.CLOSE);
  g.pop();
}

function offY(pts, d) { return pts.map((p) => [p[0], p[1] + d]); }

// 时间漩涡把色带吸出波纹：绕舱体旋一角并径向内吸
function swirlPt(p, cx, cy) {
  const dx = p[0] - cx, dy = p[1] - cy;
  const d = Math.hypot(dx, dy);
  if (d > 340 || d < 1) return p;
  const f = 1 - d / 340;
  const ang = f * f * 0.95;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
  const s = Math.max(14, d - f * f * 26) / d;
  return [cx + rx * s, cy + ry * s];
}

function drawSkyBlots(g) {
  const rnd = mulberry32(8081);
  g.push();
  g.noStroke();
  for (let i = 0; i < 7; i++) {
    const x = 90 + rnd() * 840, y = 90 + rnd() * 380;
    const r = 60 + rnd() * 130;
    const c = i % 2 ? ORANGE : BLOOD;
    g.fill(c[0], c[1], c[2], 26);
    g.ellipse(x, y, r * 2.1, r * 1.5);
  }
  g.pop();
}

// 第 3 拍（local 1.0 / 3.0 / 5.0）：色带扭曲相位推进一个波
function kickPhase(local) {
  let k = 0;
  for (const t0 of [1.0, 3.0, 5.0]) k += 0.9 * smooth(t0, t0 + 0.28, local);
  return k;
}

// ============================================================
// 二、峡湾：横向扭曲线 + 两艘极简黑船
// ============================================================
function drawWater(g, local) {
  const ctx = g.drawingContext;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 468, 0, 780);
  grad.addColorStop(0, 'rgb(40,54,74)');
  grad.addColorStop(0.55, 'rgb(24,34,48)');
  grad.addColorStop(1, 'rgb(14,20,28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 468, 1000, 312);
  ctx.restore();

  const rnd = mulberry32(4242);
  for (let i = 0; i < 10; i++) {
    const y0 = 486 + i * 30 + (rnd() - 0.5) * 8;
    const amp = 8 + rnd() * 14;
    const ctrl = [];
    for (let j = 0; j < 6; j++) {
      const x = -60 + j * 224;
      ctrl.push([x, y0
        + amp * Math.sin(j * 0.8 + i * 1.1 + local * 0.5)
        + 5 * Math.sin(j * 1.9 - local * 0.8)]);
    }
    const rgb = i % 3 === 0 ? INDIGO : (i % 3 === 1 ? [22, 32, 44] : [34, 48, 66]);
    inkStroke(g, catmull(ctrl, 7), {
      rgb, alpha: 0.52, weight: 7 + (i % 3) * 4,
      taper: 0.3, dry: 0.16, wobble: 3, seed: 60 + i,
    });
  }
}

function drawBoats(g, local) {
  const bob = Math.sin(local * 1.6) * 2.4;
  boat(g, 826, 588 + bob, 1.0);
  boat(g, 916, 614 + bob * 0.8, 0.72);
}

function boat(g, bx, by, s) {
  g.push();
  g.strokeCap(g.SQUARE);
  g.strokeJoin(g.MITER);
  // 船身：一条硬折线 + 一道底边（方头端点）
  g.stroke(BOAT[0], BOAT[1], BOAT[2], 238);
  g.strokeWeight(7 * s);
  g.line(bx - 40 * s, by, bx - 30 * s, by + 13 * s);
  g.line(bx - 30 * s, by + 13 * s, bx + 30 * s, by + 13 * s);
  g.line(bx + 30 * s, by + 13 * s, bx + 40 * s, by);
  g.line(bx - 40 * s, by, bx + 40 * s, by);
  // 桅与旗
  g.strokeWeight(5 * s);
  g.line(bx + 4 * s, by, bx + 4 * s, by - 34 * s);
  g.strokeWeight(4 * s);
  g.line(bx + 4 * s, by - 34 * s, bx + 22 * s, by - 27 * s);
  // 水面倒影：几道短硬横笔
  g.stroke(PALE[0], PALE[1], PALE[2], 60);
  g.strokeWeight(4 * s);
  for (let i = 0; i < 3; i++) {
    const yy = by + 22 * s + i * 9 * s;
    const hw = (30 - i * 7) * s;
    g.line(bx - hw, yy, bx + hw, yy);
  }
  g.pop();
}

function drawCanyonShadow(g) {
  const ctx = g.drawingContext;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 700, 0, 1000);
  grad.addColorStop(0, 'rgba(10,14,20,0)');
  grad.addColorStop(0.35, 'rgba(10,14,20,0.55)');
  grad.addColorStop(1, 'rgba(8,11,16,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 700, 1000, 300);
  ctx.restore();
}

// ============================================================
// 三、木桥：四条硬主线 + 木板线 + 栏杆立柱
// ============================================================
function rotp(p, rot) {
  if (!rot) return p;
  const c = Math.cos(rot), s = Math.sin(rot);
  const dx = p[0] - PIVOT[0], dy = p[1] - PIVOT[1];
  return [PIVOT[0] + dx * c - dy * s, PIVOT[1] + dx * s + dy * c];
}

function drawBridge(g, rot) {
  const far0 = rotp([X0, yAt(V_DECK_FAR, X0)], rot);
  const far1 = rotp([X1, yAt(V_DECK_FAR, X1)], rot);
  const near0 = rotp([X0, yAt(V_DECK_NEAR, X0)], rot);
  const near1 = rotp([X1, yAt(V_DECK_NEAR, X1)], rot);

  // 桥底横梁（v=1.14）
  hardLine(g, rotp([X0, yAt(V_BEAM, X0)], rot), rotp([X1, yAt(V_BEAM, X1)], rot), WOOD_D, 0.9, 7);

  // 甲板面（向阳的暖木色，远处被夕照提亮）
  g.push();
  g.noStroke();
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(X0, 0, X1, 0);
  grad.addColorStop(0, 'rgb(96,62,38)');
  grad.addColorStop(1, 'rgb(140,98,58)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(far0[0], far0[1]);
  ctx.lineTo(far1[0], far1[1]);
  ctx.lineTo(near1[0], near1[1]);
  ctx.lineTo(near0[0], near0[1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 木板线：沿透视方向的短笔，带 1~2 单位正弦扰动
  const rnd = mulberry32(5150);
  for (let i = 0; i < 7; i++) {
    const v = 0.12 + i * 0.13;
    for (let j = 0; j < 6; j++) {
      const xa = X0 + (X1 - X0) * (j / 6) * 0.97 + 4;
      const xb = X0 + (X1 - X0) * ((j + 0.86) / 6) * 0.97 + 4;
      const a = rnd() * 6.28;
      const seg = [];
      for (let k = 0; k < 3; k++) {
        const x = xa + (xb - xa) * (k / 2);
        const off = 1.8 * Math.sin(a + k * 1.25);
        seg.push(rotp([x, yAt(v, x) + off], rot));
      }
      g.push();
      g.noFill();
      g.strokeCap(g.SQUARE);
      g.stroke(WOOD_D[0], WOOD_D[1], WOOD_D[2], 120);
      g.strokeWeight(4);
      g.beginShape();
      for (const p of seg) g.vertex(p[0], p[1]);
      g.endShape();
      g.pop();
    }
  }

  // 栏杆立柱（透视间距递减）
  for (let i = 0; i <= 4; i++) {
    const z = Math.pow(0.75, i);
    const x = VPX - (VPX - X0) * z;
    if (x > X1 + 2) continue;
    hardLine(g, rotp([x, yAt(V_DECK_FAR, x)], rot), rotp([x, yAt(V_RAIL_TOP, x)], rot), WOOD, 0.95, 6);
  }

  // 四条主线（最硬的四笔）
  hardLine(g, rotp([X0, yAt(V_RAIL_TOP, X0)], rot), rotp([X1, yAt(V_RAIL_TOP, X1)], rot), WOOD, 1, 8);
  hardLine(g, far0, far1, WOOD, 1, 7);
  hardLine(g, near0, near1, WOOD, 1, 8);
  // 夕阳在扶手上的一道细亮边（硬线，不破对抗）
  hardLine(
    g,
    rotp([X0, yAt(V_RAIL_TOP, X0) - 5], rot),
    rotp([X1, yAt(V_RAIL_TOP, X1) - 3], rot),
    [244, 212, 152], 0.5, 3
  );
}

function hardLine(g, a, b, rgb, alpha, w) {
  g.push();
  g.noFill();
  g.strokeCap(g.SQUARE);
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.strokeWeight(w);
  g.line(a[0], a[1], b[0], b[1]);
  g.pop();
}

// 第 1 拍（local 0 / 2 / 4）：桥的透视角抖 1.5 度再弹回
function bridgeShake(local) {
  const ph = ((local % BAR) + BAR) % BAR;
  const p = Math.exp(-Math.pow(ph / 0.2, 2));
  return 0.0262 * p * Math.cos(ph * 34);
}

// ============================================================
// 四、桥上三个人
// ============================================================
function drawFigures(g, local, cx, cy, rot) {
  const jit = bodyShake(local);
  figureMain(g, 240, local, cx, cy, jit, rot);
  figurePointer(g, 432, local, cx, cy, jit, rot);
  figureCrouch(g, 586, local, cx, cy, jit, rot);
}

// 主人物：双手捂脸、指缝偷看，身体后仰成 S
function figureMain(g, x, local, cx, cy, jit, rot) {
  const feet = yAt(0.74, x);
  const H = 142;
  const top = feet - H;
  const hx = x + jit * 0.6;
  const headC = top + 27;
  const headX = hx - 9;                   // 后仰：肩胸收向身后（左）
  const fy = headC;
  const shake = jit;

  // 身体：S 形扭曲剪影（肩后仰、髋前送），苍白勾边保证读得出
  const outline = [
    [hx - 34, top + 48], [hx - 27, top + 80], [hx - 9, top + 112], [hx - 15, feet],
    [hx + 17, feet], [hx + 21, top + 112], [hx + 7, top + 80], [hx - 1, top + 48],
  ];
  const wob = [];
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    wob.push([p[0] + 3 * Math.sin(i * 1.6 + local * 1.4), p[1] + 1.5 * Math.sin(i * 2.3 - local)]);
  }
  fillPts(g, wob.map((p) => [p[0] + shake, p[1]]), NAVY, 0.94);
  strokePts(g, wob.map((p) => [p[0] + shake, p[1]]), [206, 178, 140], 0.6, 2.6, true);

  // 两条扭曲手臂：从肩到脸侧
  armStroke(g, [[headX - 4, top + 60], [headX - 22, top + 42], [headX - 20, fy + 10]], local, 10);
  armStroke(g, [[headX + 14, top + 60], [headX + 24, top + 42], [headX + 22, fy + 10]], local, 10);

  // 脸（苍白椭圆，表现主义式偏大）
  g.push();
  g.noStroke();
  g.fill(PALE[0], PALE[1], PALE[2], 250);
  g.ellipse(headX, fy, 56, 64);
  g.pop();

  // 十指捂脸：六道手指笔，留出 ±11 两道缝
  const fingers = [-33, -21, -2, 2, 21, 33];
  for (const d of fingers) {
    g.push();
    g.noFill();
    g.strokeCap(g.ROUND);
    g.stroke(NAVY[0], NAVY[1], NAVY[2], 246);
    g.strokeWeight(10);
    const bend = 2.6 * Math.sin(d * 0.2 + local * 1.2);
    g.line(headX + d, fy - 33, headX + d + bend, fy + 30);
    g.pop();
  }

  // 缝里的两只小眼，朝舱体看
  const gz = gaze(headX - 11, fy - 2, cx, cy, 3.0);
  const gz2 = gaze(headX + 11, fy - 2, cx, cy, 3.0);
  eyeDot(g, headX - 11 + gz[0], fy - 2 + gz[1], 4.2);
  eyeDot(g, headX + 11 + gz2[0], fy - 2 + gz2[1], 4.2);
}

// 中段：伸手指舱体的人
function figurePointer(g, x, local, cx, cy, jit, rot) {
  const feet = yAt(0.72, x);
  const H = 108;
  const top = feet - H;
  const hx = x + jit * 0.8;
  const headC = top + 23;

  // 身体（前倾的扭曲剪影）
  const outline = [
    [hx - 6, top + 42], [hx - 19, top + 68], [hx - 12, top + 90], [hx - 15, feet],
    [hx + 17, feet], [hx + 14, top + 90], [hx + 21, top + 68], [hx + 16, top + 42],
  ];
  const wob = [];
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    wob.push([p[0] + 2.4 * Math.sin(p[1] * 0.06 + local), p[1]]);
  }
  fillPts(g, wob.map((p) => [p[0] + jit, p[1]]), NAVY, 0.92);
  strokePts(g, wob.map((p) => [p[0] + jit, p[1]]), [206, 178, 140], 0.55, 2.4, true);

  // 头（朝舱体转）
  const tilt = Math.max(-0.34, Math.min(0.34, (cx - hx) * 0.0006));
  g.push();
  g.noStroke();
  g.fill(PALE[0], PALE[1], PALE[2], 248);
  g.ellipse(hx + tilt * 9, headC, 37, 42);
  g.pop();
  const gz = gaze(hx, headC - 1, cx, cy, 2.6);
  eyeDot(g, hx - 7 + gz[0], headC - 2 + gz[1], 3.0);
  eyeDot(g, hx + 7 + gz[0], headC - 2 + gz[1], 3.0);

  // 手臂：一条扭曲长线直指舱体
  const dx = cx - hx, dy = cy - (top + 52);
  const d = Math.hypot(dx, dy) || 1;
  const ax = hx + (dx / d) * 82, ay = (top + 52) + (dy / d) * 82;
  armStroke(g, [[hx + 4, top + 50], [hx + (ax - hx) * 0.45 + 15, top + 34],
    [hx + (ax - hx) * 0.8, ay - 13], [ax, ay]], local, 9);
  // 食指
  g.push();
  g.noFill();
  g.strokeCap(g.SQUARE);
  g.stroke(NAVY[0], NAVY[1], NAVY[2], 242);
  g.strokeWeight(6.5);
  g.line(ax, ay, ax + (dx / d) * 24, ay + (dy / d) * 24);
  g.pop();
}

// 中段：抱头蹲下的人
function figureCrouch(g, x, local, cx, cy, jit, rot) {
  const feet = yAt(0.76, x);
  const H = 68;
  const top = feet - H;
  const hx = x + jit * 0.5;
  const headC = top + 18;

  // 蹲伏的团块
  const body = [[hx - 21, feet], [hx - 24, top + 38], [hx - 15, top + 26],
    [hx + 13, top + 26], [hx + 23, top + 40], [hx + 20, feet]];
  const wob = [];
  for (let i = 0; i < body.length; i++) {
    const p = body[i];
    wob.push([p[0] + 2 * Math.sin(i * 1.7 + local * 1.1) + jit, p[1]]);
  }
  fillPts(g, wob, NAVY, 0.92);
  strokePts(g, wob, [206, 178, 140], 0.5, 2.2, true);

  // 头（缩在两臂之间）
  g.push();
  g.noStroke();
  g.fill(PALE[0], PALE[1], PALE[2], 246);
  g.ellipse(hx, headC, 32, 37);
  g.pop();
  const gz = gaze(hx, headC, cx, cy, 2.2);
  eyeDot(g, hx - 6 + gz[0], headC - 1 + gz[1], 2.7);
  eyeDot(g, hx + 6 + gz[0], headC - 1 + gz[1], 2.7);

  // 抱头的两条扭曲手臂
  armStroke(g, [[hx - 18, top + 38], [hx - 26, top + 18], [hx - 13, headC - 16]], local, 9);
  armStroke(g, [[hx + 18, top + 38], [hx + 26, top + 18], [hx + 13, headC - 16]], local, 9);
}

function armStroke(g, ctrl, local, w) {
  const pts = catmull(ctrl, 6);
  // 苍白衬边（在深色水上也读得出），再压主笔
  inkStroke(g, pts, {
    rgb: [206, 178, 140], alpha: 0.34, weight: w + 4,
    taper: 0.3, dry: 0.05, wobble: 1.2, seed: 97,
  });
  inkStroke(g, pts, {
    rgb: NAVY, alpha: 0.94, weight: w,
    taper: 0.42, dry: 0.08, wobble: 1.6, seed: 71,
  });
}

function eyeDot(g, x, y, r) {
  g.push();
  g.noStroke();
  g.fill(20, 16, 14, 235);
  g.ellipse(x, y, r * 2.1, r * 2.05);
  g.pop();
}

function gaze(hx, hy, tx, ty, k) {
  const dx = tx - hx, dy = ty - hy;
  const d = Math.hypot(dx, dy) || 1;
  return [(dx / d) * k, (dy / d) * k];
}

// 第 3 拍（local 1 / 3 / 5）：身体抖一下
function bodyShake(local) {
  const ph = (((local - BAR / 2) % BAR) + BAR) % BAR;
  return 3.4 * Math.exp(-Math.pow(ph / 0.2, 2)) * Math.cos(ph * 30);
}

function crossGlow(local) {
  const d = Math.min(local, SCENE_LEN - local);
  return Math.exp(-Math.pow(d / 0.42, 2));
}

// ============================================================
// 五、时空舱：飞过桥上方，所有直线变波浪线
// ============================================================
const CAP = {
  body: [31, 138, 148], bodyDark: [20, 96, 106],
  trim: [201, 151, 63], lamp: [255, 217, 122], glass: [13, 57, 64],
};

export function drawVehicle(g, { x, y, local, t, wave }) {
  const cx = x;
  const cy = y - FLY_UP + hoverY(local) * 1.2;   // y=890 → 440
  const s = 0.8;
  const W = 178 * s, H = 196 * s;
  const topY = cy - H / 2, baseY = cy + H / 2;
  const ph = swirlAngle(t);

  drawSwirlRing(g, cx, cy, ph, local);
  drawWarpCapsule(g, cx, topY, baseY, W, H, s, ph, local, wave);
}

// 一圈可见的扭曲光环：把周围天空色带吸出波纹
function drawSwirlRing(g, cx, cy, ph, local) {
  const p = ringPulse(local);
  const R = 130 * (1 + 0.54 * p);

  // 光环内的暖光（纯 ctx，不与 p5 形状混用）
  const ctx = g.drawingContext;
  ctx.save();
  const grd = ctx.createRadialGradient(cx, cy, R * 0.35, cx, cy, R * 1.2);
  grd.addColorStop(0, `rgba(255,226,170,${0.16 * (1 - p * 0.5)})`);
  grd.addColorStop(1, 'rgba(255,226,170,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.2, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 三圈扭曲环（半径随角度轻微起伏）
  ringPath(g, cx, cy, R, 9, 3, ph, [255, 232, 186], 0.34 - 0.16 * p, 3.2);
  ringPath(g, cx, cy, R * 0.74, 7, 4, -ph * 1.3, [255, 216, 156], 0.26 - 0.12 * p, 2.4);
  ringPath(g, cx, cy, R * 1.14, 7, 5, ph * 0.8, PALE, 0.18 - 0.08 * p, 1.8);

  // 抽吸弧：四道朝环心收的短弧
  g.push();
  g.noFill();
  g.strokeCap(g.ROUND);
  for (let i = 0; i < 4; i++) {
    const a = ph + (i / 4) * TAU;
    g.stroke(255, 236, 196, 78 * (1 - p));
    g.strokeWeight(2.4);
    g.beginShape();
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      const r = R * (1.05 + 0.5 * p) - u * R * 0.3;
      const aa = a + u * 0.8;
      g.vertex(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r);
    }
    g.endShape();
  }
  g.pop();
}

function ringPath(g, cx, cy, R, amp, lobes, ph, rgb, alpha, w) {
  const n = 72;
  g.push();
  g.noFill();
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * Math.max(0, alpha));
  g.strokeWeight(w);
  g.beginShape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const r = R + amp * Math.sin(a * lobes + ph);
    g.vertex(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.endShape();
  g.pop();
}

// 第 5 拍（local 2.0 / 5.0）：光环从 130 扩到 200 再收回
function ringPulse(local) {
  const ph = (((local - 2.0) % 3.0) + 3.0) % 3.0;
  return Math.exp(-Math.pow(ph / 0.26, 2));
}

function drawWarpCapsule(g, cx, topY, baseY, W, H, s, ph, local, wave) {
  const jit = 5.5 + 2.5 * Math.sin(ph * 2);       // 波浪振幅 4~8
  const q = ph * 1.6;

  // 悬浮喷口
  g.push();
  g.noStroke();
  for (let i = 0; i < 4; i++) {
    g.fill(160, 240, 255, 40);
    g.ellipse(cx + (i % 2 === 0 ? -1 : 1) * W * 0.32, baseY + 5, 24, 8);
  }
  g.pop();

  // 舱体（波浪化的圆角方盒）
  const bodyPts = wobble(rectPerim(cx - W / 2, topY, W, H, 9), jit, q, 0.55);
  fillPts(g, bodyPts, CAP.body, 0.96);
  fillPts(g, wobble(rectPerim(cx - W / 2, topY, W * 0.17, H, 5), jit, q + 1, 0.55), [0, 0, 0], 0.18);
  strokePts(g, bodyPts, CAP.trim, 0.95, 4, true);

  // 四坡短檐（波浪梯形）
  const eaveW = W + 24, eaveH = 18, ridgeW = W * 0.46;
  const eave = wobble([
    [cx - eaveW / 2, topY], [cx - ridgeW / 2, topY - eaveH],
    [cx + ridgeW / 2, topY - eaveH], [cx + eaveW / 2, topY],
  ], jit * 0.7, q + 2, 0.7);
  fillPts(g, eave, CAP.bodyDark, 0.96);
  waveLine(g, cx - eaveW / 2, topY, cx + eaveW / 2, topY, jit * 0.8, q, 3, CAP.trim, 0.95, 3);

  // 檐下六角灯笼（含时间漩涡）
  const lampY = topY - (eaveH + 26);
  const lampR = 16;
  g.push();
  g.noStroke();
  for (let i = 3; i >= 1; i--) {
    g.fill(255, 217, 122, 22 * i);
    g.circle(cx, lampY, lampR * 2 + i * 14);
  }
  g.pop();
  waveLine(g, cx, topY - eaveH, cx, lampY + lampR, jit * 0.5, q + 4, 2, CAP.trim, 0.9, 3);
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    hex.push([cx + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR]);
  }
  const hexW = wobble(hex, 2.4, ph * 3, 1.1);
  fillPts(g, hexW, CAP.lamp, 0.95);
  strokePts(g, hexW, CAP.trim, 0.9, 2.4, true);
  g.push();
  g.noFill();
  g.stroke(150, 96, 22, 210);
  g.strokeWeight(2.2);
  g.arc(cx, lampY, lampR * 1.4, lampR * 1.4, ph, ph + 2.1);
  g.pop();

  // 3×2 窗：波浪框 + 玻璃
  const padX = 14, winX0 = cx - W / 2 + padX, winW = W - padX * 2;
  const winTop = topY + 16, winH = 74, gap = 4;
  const cw = (winW - gap * 2) / 3, ch = (winH - gap) / 2;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = winX0 + c * (cw + gap), wy = winTop + r * (ch + gap);
      const wp = wobble(rectPerim(wx, wy, cw, ch, 5), jit * 0.55, q + c * 1.3 + r * 2.1, 0.9);
      fillPts(g, wp, CAP.glass, 0.96);
      strokePts(g, wp, CAP.trim, 0.8, 2, true);
    }
  }
  // 驾驶员（中上窗）
  const dx0 = winX0 + (cw + gap), dy0 = winTop + ch * 0.62;
  g.push();
  g.noStroke();
  g.fill(10, 28, 34, 238);
  g.circle(dx0 + cw / 2, dy0 - 6, 13);
  g.ellipse(dx0 + cw / 2, dy0 + 5, 20, 12);
  g.stroke(10, 28, 34, 238);
  g.strokeWeight(4);
  g.strokeCap(g.ROUND);
  if (wave) {
    const wig = Math.sin(ph * 5) * 6;
    g.line(dx0 + cw / 2 + 4, dy0 + 2, dx0 + cw / 2 + 13, dy0 - 16 + wig);
  } else {
    g.line(dx0 + cw / 2 + 4, dy0 + 2, dx0 + cw / 2 + 12, dy0 + 7);
  }
  g.pop();

  // 门板：中缝 + 把手 + 时间刻度盘
  const doorTop = winTop + winH + 8;
  waveLine(g, cx, doorTop, cx, baseY - 14, jit * 0.7, q + 3, 2.4, [10, 60, 68], 0.7, 2.4);
  for (let i = 0; i < 3; i++) {
    waveLine(g, cx - W / 2 + 18, doorTop + 10 + i * 10, cx - W / 2 + 18 + W * 0.26,
      doorTop + 10 + i * 10, jit * 0.5, q + i, 2, CAP.bodyDark, 0.9, 5);
  }
  const dr = 13, ddx = cx + W * 0.22, ddy = doorTop + 22;
  fillPts(g, wobble(circlePts(ddx, ddy, dr, 16), 2.2, ph * 2, 1), CAP.bodyDark, 0.95);
  strokePts(g, wobble(circlePts(ddx, ddy, dr, 16), 2.2, ph * 2, 1), CAP.trim, 0.9, 1.6, true);

  // 宽底座
  const bp = wobble(rectPerim(cx - (W / 2 + 6), baseY - 11, W + 12, 11, 6), jit * 0.6, q + 5, 0.8);
  fillPts(g, bp, CAP.bodyDark, 0.96);
  waveLine(g, cx - (W / 2 + 6), baseY - 11, cx + (W / 2 + 6), baseY - 11, jit * 0.6, q + 6, 2.6, CAP.trim, 0.9, 2);
}

// ---- 波浪线工具 ----
function rectPerim(x, y, w, h, per) {
  const p = [];
  for (let i = 0; i < per; i++) p.push([x + (w * i) / per, y]);
  for (let i = 0; i < per; i++) p.push([x + w, y + (h * i) / per]);
  for (let i = 0; i < per; i++) p.push([x + w - (w * i) / per, y + h]);
  for (let i = 0; i < per; i++) p.push([x, y + h - (h * i) / per]);
  return p;
}

function circlePts(cx, cy, r, n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}

// 沿闭合折线法向做正弦扰动
function wobble(pts, amp, phase, freq) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const L = Math.hypot(tx, ty) || 1;
    const nx = ty / L, ny = -tx / L;        // 外法向（顺时针折线）
    const o = amp * Math.sin(phase + i * freq);
    return [p[0] + nx * o, p[1] + ny * o];
  });
}

function fillPts(g, pts, rgb, alpha) {
  if (!pts || pts.length < 3) return;
  g.push();
  g.noStroke();
  g.fill(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.beginShape();
  for (const p of pts) g.vertex(p[0], p[1]);
  g.endShape(g.CLOSE);
  g.pop();
}

function strokePts(g, pts, rgb, alpha, w, closed) {
  if (!pts || pts.length < 2) return;
  g.push();
  g.noFill();
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.strokeWeight(w);
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  g.beginShape();
  for (const p of pts) g.vertex(p[0], p[1]);
  g.endShape(closed ? g.CLOSE : undefined);
  g.pop();
}

// 一条被正弦推歪的"直线"（沿法向起伏，随舱体相位推进）
function waveLine(g, x1, y1, x2, y2, amp, phase, cycles, rgb, alpha, w) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const n = 16;
  g.push();
  g.noFill();
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.strokeWeight(w);
  g.strokeCap(g.ROUND);
  g.beginShape();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const o = amp * Math.sin(phase + u * cycles * TAU);
    g.vertex(x1 + dx * u + nx * o, y1 + dy * u + ny * o);
  }
  g.endShape();
  g.pop();
}
