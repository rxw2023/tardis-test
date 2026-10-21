// ============================================================
// s06-qingming.js — 第 06 版块：清明上河图（约1100，北宋风俗长卷 / 界画）
//
// 一句话美术口径：界尺直线搭木构，细笔曲线写水与舟，人物只是剪影。
//
//   形：高视平线俯瞰（视平线约 y300）。自下而上——河面 → 自绘木拱桥
//       （叠梁拱）→ 两岸街市瓦房 → 远处淡墨城楼与柳林。
//   笔：建筑 / 桥 / 栏杆一律界尺直线（weight 1.6~2.6，端点方）；
//       船、树、水波用细笔曲线；人物 = 3.5 单位圆点头 + 一两笔身子（高 12~18）。
//   色：绢底打底，墨线勾形，屋瓦船身衣衫薄罩淡赭 / 淡青（alpha 0.12~0.28）。
//   梗：时空舱低空掠过桥顶。桥上所有人齐刷刷回头——人头是单独圆点，
//       随舱体 x 依次转向，形成一道与拍同速的"抬头波"；驴四腿绷直、
//       脖子伸向舱体；桥下船夫仰头、篙杆脱手斜插进水里，乘客探出船篷；
//       两岸店铺各有一人探窗看。
//
// 版权：只取"北宋市井风俗画"这一公有领域品类。桥与船一律自绘简化形态
//       （叠梁拱为自绘的直木条交错），幌子字号全部虚构，不指向任何真实商号。
//
// 版面：河面 y 580..770；远岸水线 y580；石驳岸 y756..770 接公路。
// 性能：绢底 + 建筑 + 桥 + 水波烘焙成 2400×2400 静态层，逐帧只 drawImage。
// ============================================================

import { TAU, BEAT, smooth, routeU, hoverY } from '../beat/beats.js';
import { mulberry32, catmull } from '../kit/kit.js';
import { paperInto, inkStroke, dryLine, blot, mistBand } from '../kit/ink.js';

// ---- 调色 ----
const SILK = [227, 217, 194];   // 绢底 #e3d9c2
const INK = [58, 53, 44];       // 墨   #3a352c
const OCHRE = [168, 137, 90];   // 淡赭 #a8895a
const CYAN = [107, 138, 138];   // 淡青 #6b8a8a
const RED = [154, 74, 58];      // 朱   #9a4a3a
const ZH = '"KaiTi","STKaiti","SimSun",serif';

const S = 2.4;                  // 静态层超采样
const SHORE = 580;              // 远岸水线
const BR_X0 = 168, BR_X1 = 652, BR_AX = 410, BR_HW = 242;
const DECK_T = 30;              // 桥面投影厚度
const RAIL_H = 14;              // 桥栏高（压低，别抢人物）
const ARCH_T = 52;              // 拱圈厚
const ABUT_BOT = 654;           // 桥台落到水里
const CAP_Y = 400;              // 舱体底面（桥栏顶 438，净空 14~34）
const CAP_S = 0.85;

// 桥面（远侧边缘）抛物线：两端 548，桥顶 452
function deckY(x) { const u = (x - BR_AX) / BR_HW; return 452 + 96 * u * u; }
function archOutY(x) { return deckY(x) + DECK_T; }
function archInY(x) { return deckY(x) + DECK_T + ARCH_T; }

// ---- 瓦房（界尺直线）----
// far = 后排（更淡）；up = 带二层
const HOUSES = [
  { x: 26, base: 558, w: 84, wall: 40, roof: 28, tone: OCHRE, seed: 11 },
  { x: 116, base: 568, w: 68, wall: 34, roof: 24, tone: CYAN, seed: 12 },
  { x: 58, base: 522, w: 56, wall: 26, roof: 18, tone: OCHRE, seed: 13, far: true },
  { x: 672, base: 560, w: 92, wall: 44, roof: 30, tone: OCHRE, seed: 21, up: true },
  { x: 786, base: 570, w: 78, wall: 36, roof: 26, tone: CYAN, seed: 22 },
  { x: 878, base: 526, w: 64, wall: 26, roof: 19, tone: OCHRE, seed: 23, far: true },
];

// ---- 幌子（字号全部虚构）----
const BANNERS = [
  { x: 96, y: 520, h: 44, w: 19, text: '孙记', seed: 31 },
  { x: 168, y: 536, h: 34, w: 18, text: '茶', seed: 32 },
  { x: 748, y: 518, h: 44, w: 20, text: '正店', seed: 33 },
  { x: 848, y: 536, h: 62, w: 19, text: '王家纸马', seed: 34 },
];

// ---- 桥上人群（u 为桥面位置 0..1）----
const CROWD = [
  { u: 0.085, kind: 'man', s: 1.10, tone: OCHRE, hat: 1 },
  { u: 0.140, kind: 'man', s: 1.04, tone: CYAN, hat: 0 },
  { u: 0.205, kind: 'man', s: 1.08, tone: INK, hat: 2 },
  { u: 0.275, kind: 'porter', s: 1.06, tone: OCHRE },
  { u: 0.345, kind: 'man', s: 1.12, tone: OCHRE, hat: 1 },
  { u: 0.415, kind: 'man', s: 0.84, tone: RED },
  { u: 0.480, kind: 'donkey', s: 1.00, tone: INK },
  { u: 0.545, kind: 'man', s: 1.10, tone: CYAN, hat: 1 },
  { u: 0.615, kind: 'porter', s: 1.04, tone: INK },
  { u: 0.690, kind: 'man', s: 1.08, tone: OCHRE, hat: 0 },
  { u: 0.770, kind: 'man', s: 1.06, tone: CYAN, hat: 1 },
  { u: 0.850, kind: 'man', s: 1.10, tone: OCHRE, hat: 2 },
  { u: 0.920, kind: 'man', s: 1.04, tone: INK, hat: 0 },
];

// ---- 岸上行人 / 泊船船夫 ----
const FOLK = [
  { x: 40, y: 572, s: 0.96, tone: CYAN, hat: 1 },
  { x: 74, y: 574, s: 0.98, tone: OCHRE, hat: 1 },
  { x: 134, y: 578, s: 1.02, tone: CYAN },
  { x: 216, y: 576, s: 0.94, tone: INK, hat: 2 },
  { x: 700, y: 578, s: 1.00, tone: OCHRE, hat: 1 },
  { x: 758, y: 580, s: 0.96, tone: INK, hat: 0 },
  { x: 822, y: 578, s: 1.04, tone: CYAN },
  { x: 908, y: 572, s: 0.96, tone: INK, hat: 1 },
  { x: 946, y: 570, s: 0.94, tone: OCHRE, hat: 2 },
  { x: 128, y: 664, s: 1.02, tone: INK },
  { x: 828, y: 696, s: 1.04, tone: OCHRE, hat: 2 },
];

// ---- 店铺窗口探头看的人 ----
const WATCHERS = [{ x: 62, y: 536 }, { x: 706, y: 530 }];

// ---- 柳树（卷首卷尾各一株：点叶树冠 + 垂丝；枝条逐帧摆动）----
const WILLOWS = [
  { x: 24, y: 582, h: 88, seed: 41 },
  { x: 956, y: 584, h: 92, seed: 42 },
];

// ---- 泊在两侧的船 ----
const MOORED = [
  { x: 56, y: 668, L: 122, H: 21, seed: 51 },
  { x: 762, y: 700, L: 134, H: 23, seed: 52 },
];

let layer = null;

// ============================================================
// 主入口
// ============================================================
export function render(g, meta, local) {
  g.image(ensureLayer(g), 0, 0, 1000, 1000);
  const capX = routeU(local) * 1000;
  const ferryX = 386 + 40 * smooth(0.4, 5.2, local);

  drawGateFlash(g, local);        // 过框：城楼轮廓提亮一次
  drawFerry(g, local, capX, ferryX);  // 正穿桥洞的船：船夫仰头 / 篙杆脱手 / 乘客探头（含第 1 拍水波）
  drawCrowd(g, local, capX);      // 桥上人群回头波 + 货担 + 驴
  drawFolk(g, local, capX);       // 岸上行人
  drawWatchers(g, capX);          // 窗口探头
  drawBanners(g, local);          // 幌子翻面
  drawWillowStrands(g, local);    // 第 5 拍：柳枝摆动一次
  drawDrift(g, local);            // 水面浮雾
}

export function camera(local) {
  const p = smooth(1.9, 2.9, local) * (1 - smooth(3.9, 4.8, local));
  return { z: 1 + 0.08 * p, fx: 500, fy: 520 };
}

// ============================================================
// 时空舱：界画版（直线勾出 + 淡青罩染 + 檐下两道椽头 + 底下四朵小云）
// ============================================================
export function drawVehicle(g, { x, local, t, wave }) {
  const s = CAP_S;
  const W = 178 * s, H = 196 * s;
  const baseY = CAP_Y + hoverY(local) * 0.55;
  const topY = baseY - H;
  const half = W / 2;

  // 行进速度 → 云尾长度
  const u0 = routeU(Math.max(0, local - 0.06));
  const u1 = routeU(Math.min(6, local + 0.06));
  const tail = 7 + 20 * Math.min(1, Math.abs(u1 - u0) * 1000 / 240);

  g.push();

  // ---- 底下四朵向下的小云（喷口）----
  for (let i = 0; i < 4; i++) {
    const jx = x + (i % 2 === 0 ? -1 : 1) * W * 0.31;
    const jy = baseY + 7 + Math.sin(t * 2.4 + i * 1.7) * 1.6;
    g.push();
    g.noStroke();
    g.fill(CYAN[0], CYAN[1] + 26, CYAN[2] + 24, 34);
    g.ellipse(jx - tail * 0.25, jy + 1, 30 + tail, 11);
    g.pop();
    cloudJet(g, jx, jy, tail);
  }

  g.strokeCap(g.SQUARE);

  // ---- 舱体：淡青罩染 ----
  g.noStroke();
  g.fill(31, 138, 148, 236);
  g.rect(x - half, topY, W, H);
  g.fill(CYAN[0], CYAN[1], CYAN[2], 46);
  g.rect(x - half, topY, W, H);
  g.fill(255, 255, 255, 16);
  g.rect(x - half, topY, W * 0.16, H);
  rule(g, x - half, topY, x - half, baseY, 2.6, 0.9);
  rule(g, x + half, topY, x + half, baseY, 2.6, 0.9);
  rule(g, x - half, baseY, x + half, baseY, 2.2, 0.75);
  rule(g, x - half + 3, topY, x - half + 3, baseY, 1.6, 0.55, [199, 151, 63]);
  rule(g, x + half - 3, topY, x + half - 3, baseY, 1.6, 0.55, [199, 151, 63]);

  // ---- 四坡短檐（直线）----
  const eaveW = W + 24, eaveH = 20, ridgeW = W * 0.46;
  g.noStroke();
  g.fill(20, 96, 106);
  g.beginShape();
  g.vertex(x - eaveW / 2, topY);
  g.vertex(x - ridgeW / 2, topY - eaveH);
  g.vertex(x + ridgeW / 2, topY - eaveH);
  g.vertex(x + eaveW / 2, topY);
  g.endShape(g.CLOSE);
  rule(g, x - eaveW / 2, topY, x + eaveW / 2, topY, 2.6, 0.9);
  rule(g, x - eaveW / 2, topY, x - ridgeW / 2, topY - eaveH, 2.0, 0.8);
  rule(g, x + eaveW / 2, topY, x + ridgeW / 2, topY - eaveH, 2.0, 0.8);
  rule(g, x - ridgeW / 2, topY - eaveH, x + ridgeW / 2, topY - eaveH, 2.4, 0.85);
  rule(g, x - eaveW / 2, topY, x + eaveW / 2, topY, 2.0, 0.9, [199, 151, 63]);
  // 檐下两道椽头（飞子）
  for (let r = 0; r < 2; r++) {
    const yy = topY + 5 + r * 7;
    for (let xx = x - eaveW / 2 + 6; xx < x + eaveW / 2 - 3; xx += 9) {
      rule(g, xx, yy, xx, yy + 4.5, 1.5, 0.5);
    }
  }

  // ---- 檐上六角灯笼 ----
  const lampY = topY - eaveH - 27, lampR = 17;
  g.noStroke();
  for (let i = 3; i >= 1; i--) {
    g.fill(255, 217, 122, 22 * i);
    g.circle(x, lampY, lampR * 2 + i * 14);
  }
  g.fill(199, 151, 63);
  g.rect(x - 2.2, topY - eaveH - 16, 4.4, 16);
  rule(g, x, topY - eaveH, x, topY - eaveH - 12, 2.2, 0.8);
  g.noStroke();
  g.fill(255, 217, 122);
  g.beginShape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    g.vertex(x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR);
  }
  g.endShape(g.CLOSE);
  g.push();
  g.noFill();
  g.strokeCap(g.ROUND);
  g.stroke(150, 96, 22, 220);
  g.strokeWeight(2.4);
  const a0 = (t / (2 * BEAT)) * TAU;
  g.arc(x, lampY, lampR * 1.3, lampR * 1.3, a0, a0 + 2.0);
  g.arc(x, lampY, lampR * 0.72, lampR * 0.72, a0 + Math.PI, a0 + Math.PI + 2.0);
  g.pop();
  g.strokeCap(g.SQUARE);
  g.noFill();
  g.stroke(199, 151, 63);
  g.strokeWeight(2.2);
  g.beginShape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    g.vertex(x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR);
  }
  g.endShape(g.CLOSE);

  // ---- 窗格 3 列 × 2 行 ----
  const padX = 14, winW = W - padX * 2, winTop = topY + 22, winH = 88, gap = 5;
  const cw = (winW - gap * 2) / 3, ch = (winH - gap) / 2;
  let driver = null;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = x - half + padX + c * (cw + gap);
      const wy = winTop + r * (ch + gap);
      g.noStroke();
      g.fill(13, 57, 64);
      g.rect(wx, wy, cw, ch);
      g.fill(255, 255, 255, 20);
      g.rect(wx + 2, wy + 2, cw * 0.34, ch - 4);
      g.noFill();
      g.stroke(INK[0], INK[1], INK[2], 220);
      g.strokeWeight(1.8);
      g.rect(wx, wy, cw, ch);
      rule(g, wx + cw / 2, wy, wx + cw / 2, wy + ch, 1.2, 0.45, [199, 151, 63]);
      if (r === 0 && c === 1) driver = { x: wx + cw / 2, y: wy + ch * 0.72 };
    }
  }

  // ---- 驾驶员（上排中窗；第 2 小节挥手）----
  if (driver) {
    g.push();
    g.noStroke();
    g.fill(10, 28, 34, 240);
    g.circle(driver.x, driver.y - 6, 9);
    g.stroke(10, 28, 34, 240);
    g.strokeCap(g.ROUND);
    g.strokeWeight(3.4);
    if (wave) {
      const wig = Math.sin((t || 0) * 9) * 3;
      g.line(driver.x + 3, driver.y - 1, driver.x + 11, driver.y - 13 + wig);
    } else {
      g.line(driver.x + 3, driver.y - 1, driver.x + 9, driver.y + 3);
    }
    g.strokeCap(g.SQUARE);
    g.pop();
  }

  // ---- 门板：中缝 + 百叶 + 时间刻度盘 ----
  const doorTop = winTop + winH + 8;
  const doorH = baseY - 16 - doorTop;
  rule(g, x, doorTop, x, doorTop + doorH, 2.0, 0.6);
  rule(g, x + 8, doorTop + doorH * 0.4, x + 8, doorTop + doorH * 0.62, 2.6, 0.85, [199, 151, 63]);
  g.noStroke();
  g.fill(20, 96, 106);
  for (let i = 0; i < 3; i++) g.rect(x - half + 18, doorTop + 9 + i * 10, W * 0.26, 5);
  const dx = x + W * 0.21, dy = doorTop + doorH * 0.46, dr = 13;
  g.fill(20, 96, 106);
  g.circle(dx, dy, dr * 2);
  const na = (t / (2 * BEAT)) * TAU - Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    rule(g, dx + Math.cos(a) * dr * 0.7, dy + Math.sin(a) * dr * 0.7,
      dx + Math.cos(a) * dr * 0.92, dy + Math.sin(a) * dr * 0.92, 1.2, 0.7, [199, 151, 63]);
  }
  g.noFill();
  g.stroke(199, 151, 63);
  g.strokeWeight(1.5);
  g.circle(dx, dy, dr * 2);
  rule(g, dx, dy, dx + Math.cos(na) * dr * 0.64, dy + Math.sin(na) * dr * 0.64, 2.0, 0.95, [255, 235, 190]);

  // ---- 宽底座 ----
  g.noStroke();
  g.fill(20, 96, 106);
  g.rect(x - half - 6, baseY - 11, W + 12, 11);
  rule(g, x - half - 6, baseY - 11, x + half + 6, baseY - 11, 2.0, 0.8, [199, 151, 63]);

  g.pop();
}

// 一朵向下的小云：祥云三卷 + 向后飘的云尾
function cloudJet(g, cx, cy, tail) {
  g.push();
  g.noFill();
  g.strokeCap(g.ROUND);
  g.stroke(CYAN[0] - 24, CYAN[1] + 22, CYAN[2] + 20, 220);
  g.strokeWeight(1.8);
  g.arc(cx, cy, 13, 9, Math.PI, TAU);
  g.arc(cx - 6.5, cy + 1.5, 9, 7, Math.PI, TAU);
  g.arc(cx + 6.5, cy + 1.5, 9, 7, Math.PI, TAU);
  g.stroke(CYAN[0] - 24, CYAN[1] + 22, CYAN[2] + 20, 150);
  g.strokeWeight(1.3);
  for (let i = 0; i < 3; i++) {
    const yy = cy + 2 + (i - 1) * 3;
    g.line(cx - 7, yy, cx - 7 - tail * (0.55 + i * 0.22), yy + (i - 1) * 1.4);
  }
  g.pop();
}

// ============================================================
// 静态层：绢底 / 远景 / 街市 / 桥 / 水
// ============================================================
function ensureLayer(g) {
  if (layer) return layer;
  const pg = g.createGraphics(Math.round(1000 * S), Math.round(1000 * S));
  pg.pixelDensity(1);
  pg.scale(S);
  pg.textFont(ZH);

  paperInto(pg, 1000, 1000, { seed: 606, base: SILK, fiber: 1.15, mottle: 1.25 });

  drawGround(pg);
  drawFarHaze(pg);              // 更远的平野树影（填出纵深，不抢主体）
  drawFarBand(pg);              // 远处树 + 城楼
  mistBand(pg, -20, 396, 1060, 56, 0.46, 6061);
  drawFence(pg);
  drawHouses(pg);
  drawWillowTrunks(pg);
  drawShore(pg);
  drawWater(pg);
  for (const b of MOORED) drawBoat(pg, b);
  drawBridge(pg);
  drawColophon(pg);
  creases(pg);
  silkGrain(pg);

  layer = pg;
  return layer;
}

// ---- 界尺直线（端点方）----
function rule(g, x1, y1, x2, y2, w = 2, a = 0.85, rgb = INK) {
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * a);
  g.strokeWeight(w);
  g.line(x1, y1, x2, y2);
}

// ---- 折线（每段都是直线，保住界尺味）----
function poly(g, pts, w = 2, a = 0.85, rgb = INK) {
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * a);
  g.strokeWeight(w);
  for (let i = 1; i < pts.length; i++) {
    g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
}

function strokeRect(g, x, y, w, h, wt, a, rgb = INK) {
  g.noFill();
  g.stroke(rgb[0], rgb[1], rgb[2], 255 * a);
  g.strokeWeight(wt);
  g.rect(x, y, w, h);
  g.noStroke();
}

// 沿桥面平移 offset 的折线采样
function deckLine(off, step = 11) {
  const pts = [];
  for (let x = BR_X0; x <= BR_X1 + 0.01; x += step) pts.push([x, deckY(x) + off]);
  pts.push([BR_X1, deckY(BR_X1) + off]);
  return pts;
}

// ---- 地面：淡赭薄罩 ----
function drawGround(pg) {
  const ctx = pg.drawingContext;
  ctx.save();
  const gd = ctx.createLinearGradient(0, 300, 0, SHORE);
  gd.addColorStop(0, 'rgba(168,137,90,0.00)');
  gd.addColorStop(0.55, 'rgba(168,137,90,0.05)');
  gd.addColorStop(1, 'rgba(168,137,90,0.13)');
  ctx.fillStyle = gd;
  ctx.beginPath();
  ctx.rect(0, 300, 1000, SHORE - 300);
  ctx.fill();
  ctx.restore();
}

// ---- 更远的平野树影（极淡，把上部绢面填出纵深）----
function drawFarHaze(pg) {
  const rnd = mulberry32(4477);
  pg.push();
  pg.noStroke();
  // 树影：小团，压得很淡（不做硬边色块）
  for (let i = 0; i < 40; i++) {
    const x = -10 + i * 26 + rnd() * 18;
    const y = 232 + rnd() * 26;
    const r = 6 + rnd() * 10;
    pg.fill(INK[0], INK[1], INK[2], 255 * (0.022 + rnd() * 0.026));
    pg.ellipse(x, y - r, r * 2.6, r * 1.6);
    pg.ellipse(x + (rnd() - 0.5) * 10, y - r * 1.5, r * 1.8, r * 1.2);
    pg.fill(INK[0], INK[1], INK[2], 255 * 0.035);
    pg.rect(x - 0.7, y - r, 1.4, r);
  }
  // 极淡的远堤（断成几段，不要一条通线）
  for (let i = 0; i < 5; i++) {
    const x0 = rnd() * 900, len = 90 + rnd() * 180;
    pg.fill(INK[0], INK[1], INK[2], 255 * 0.035);
    pg.rect(x0, 268 + rnd() * 4, len, 2);
  }
  pg.pop();
}

// ---- 远景：淡墨树 + 自绘城楼 ----
function drawFarBand(pg) {
  const A = 0.34;
  const rnd = mulberry32(2202);

  const gx = 706, gw = 168, gb = 404;
  pg.push();
  pg.strokeCap(pg.SQUARE);

  // 城墙
  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.055);
  pg.beginShape();
  pg.vertex(gx, gb);
  pg.vertex(gx + 9, gb - 58);
  pg.vertex(gx + gw - 9, gb - 58);
  pg.vertex(gx + gw, gb);
  pg.endShape(pg.CLOSE);
  // 城门洞（拱形，暗）
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.26);
  pg.beginShape();
  pg.vertex(gx + gw / 2 - 21, gb);
  pg.vertex(gx + gw / 2 - 21, gb - 26);
  pg.vertex(gx + gw / 2 - 12, gb - 34);
  pg.vertex(gx + gw / 2 + 12, gb - 34);
  pg.vertex(gx + gw / 2 + 21, gb - 26);
  pg.vertex(gx + gw / 2 + 21, gb);
  pg.endShape(pg.CLOSE);
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.045);
  pg.rect(gx + 14, gb - 86, gw - 28, 28);

  // 城墙轮廓 + 垛口
  rule(pg, gx, gb, gx + 9, gb - 58, 2.2, A);
  rule(pg, gx + gw, gb, gx + gw - 9, gb - 58, 2.2, A);
  rule(pg, gx + 9, gb - 58, gx + gw - 9, gb - 58, 2.2, A);
  for (let x = gx + 9; x < gx + gw - 12; x += 15) {
    rule(pg, x, gb - 58, x, gb - 65, 1.6, A * 0.85);
    rule(pg, x, gb - 65, x + 9, gb - 65, 1.6, A * 0.85);
    rule(pg, x + 9, gb - 65, x + 9, gb - 58, 1.6, A * 0.85);
  }
  // 门洞轮廓
  rule(pg, gx + gw / 2 - 21, gb, gx + gw / 2 - 21, gb - 26, 1.8, A);
  rule(pg, gx + gw / 2 + 21, gb, gx + gw / 2 + 21, gb - 26, 1.8, A);
  rule(pg, gx + gw / 2 - 21, gb - 26, gx + gw / 2 - 12, gb - 34, 1.6, A);
  rule(pg, gx + gw / 2 + 21, gb - 26, gx + gw / 2 + 12, gb - 34, 1.6, A);
  rule(pg, gx + gw / 2 - 12, gb - 34, gx + gw / 2 + 12, gb - 34, 1.6, A);

  // 平坐栏杆 + 楼身
  for (let x = gx + 16; x < gx + gw - 14; x += 11) rule(pg, x, gb - 58, x, gb - 64, 1.1, A * 0.7);
  rule(pg, gx + 14, gb - 58, gx + gw - 14, gb - 58, 1.8, A);
  rule(pg, gx + 14, gb - 86, gx + gw - 14, gb - 86, 1.8, A);
  rule(pg, gx + 14, gb - 86, gx + 14, gb - 58, 1.6, A * 0.85);
  rule(pg, gx + gw - 14, gb - 86, gx + gw - 14, gb - 58, 1.6, A * 0.85);
  for (let i = 0; i < 3; i++) {
    const wx = gx + 40 + i * 34;
    strokeRect(pg, wx, gb - 80, 18, 14, 1.2, A * 0.8);
    rule(pg, wx + 9, gb - 80, wx + 9, gb - 66, 0.9, A * 0.6);
  }
  // 歇山顶
  const ey = gb - 86, ry = ey - 42, eave = 22, rw = (gw - 28) * 0.54;
  const rx = gx + 14 + ((gw - 28) - rw) / 2;
  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.17);
  pg.beginShape();
  pg.vertex(rx - eave, ey);
  pg.vertex(rx + 7, ry);
  pg.vertex(rx + rw - 7, ry);
  pg.vertex(rx + rw + eave, ey);
  pg.endShape(pg.CLOSE);
  for (let i = 0; i <= 9; i++) {
    const u = i / 9;
    rule(pg, rx - eave + (rw + 2 * eave) * u, ey + 2, rx + 7 + (rw - 14) * u, ry + 2, 0.9, A * 0.55);
  }
  rule(pg, rx - eave, ey, rx + rw + eave, ey, 2.4, A);
  rule(pg, rx + 7, ry, rx + rw - 7, ry, 2.6, A);
  rule(pg, rx - eave, ey, rx + 7, ry, 1.8, A * 0.9);
  rule(pg, rx + rw + eave, ey, rx + rw - 7, ry, 1.8, A * 0.9);
  for (let xx = rx - eave + 4; xx < rx + rw + eave - 2; xx += 8) rule(pg, xx, ey + 2, xx, ey + 6, 1.1, A * 0.6);
  rule(pg, rx + rw / 2, ry, rx + rw / 2, ry - 10, 2.0, A);
  rule(pg, rx + rw / 2 - 8, ry - 10, rx + rw / 2 + 8, ry - 10, 1.6, A * 0.8);
  pg.pop();

  // 远处树丛（淡墨团 + 细笔树干）
  for (let i = 0; i < 26; i++) {
    const x = 24 + rnd() * 620;
    const y = 404 - rnd() * 26;
    const r = 10 + rnd() * 16;
    blot(pg, x, y - r * 0.5, r, { rgb: INK, alpha: 0.09 + rnd() * 0.08, layers: 5, seed: 300 + i });
    rule(pg, x, y + r * 0.3, x + (rnd() - 0.5) * 4, y + r * 0.3 + 12 + rnd() * 10, 1.3, 0.24 + rnd() * 0.12);
    for (let k = 0; k < 3; k++) {
      dryLine(pg, x, y - r * 0.3, x + (rnd() - 0.5) * r * 1.4, y - r * 0.3 - r * (0.4 + rnd() * 0.5),
        { rgb: INK, alpha: 0.14, weight: 1.1, dry: 0.4, seed: 1200 + i * 3 + k });
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = 898 + rnd() * 92;
    const y = 404 - rnd() * 22;
    const r = 10 + rnd() * 14;
    blot(pg, x, y - r * 0.5, r, { rgb: INK, alpha: 0.08 + rnd() * 0.06, layers: 5, seed: 400 + i });
    rule(pg, x, y + r * 0.3, x + (rnd() - 0.5) * 4, y + r * 0.3 + 10, 1.2, 0.20);
  }
  rule(pg, 540, 404, gx, 404, 1.6, 0.24);
  rule(pg, gx + gw, 404, 1000, 404, 1.6, 0.24);

  // 更远的一层淡影（把上部绢面填出纵深）
  for (let i = 0; i < 12; i++) {
    const x = 40 + i * 82 + rnd() * 40;
    const h = 18 + rnd() * 16;
    pg.noStroke();
    pg.fill(INK[0], INK[1], INK[2], 255 * 0.035);
    pg.ellipse(x, 300 - rnd() * 26, 120 + rnd() * 90, h);
  }
}

// ---- 远处篱笆（界尺横线 + 立柱）----
function drawFence(pg) {
  for (const seg of [[22, 160], [640, 980]]) {
    const y = 462;
    rule(pg, seg[0], y, seg[1], y, 1.6, 0.22);
    rule(pg, seg[0], y + 5, seg[1], y + 5, 1.2, 0.14);
    for (let x = seg[0]; x <= seg[1]; x += 16) rule(pg, x, y, x, y + 11, 1.2, 0.18);
  }
}

// ---- 瓦房 ----
function drawHouses(pg) {
  for (const h of HOUSES) drawHouse(pg, h);
}

function drawHouse(pg, h) {
  const A = h.far ? 0.60 : 1;
  pg.push();
  pg.strokeCap(pg.SQUARE);

  // 台基
  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.10 * A);
  pg.rect(h.x - 4, h.base - 5, h.w + 8, 6);

  // 墙体（薄罩）+ 檐下暗影
  pg.fill(h.tone[0], h.tone[1], h.tone[2], 255 * 0.20 * A);
  pg.rect(h.x, h.base - h.wall, h.w, h.wall);
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.10 * A);
  pg.rect(h.x + 2, h.base - h.wall, h.w - 4, 7);
  rule(pg, h.x, h.base, h.x, h.base - h.wall, 2.4, 0.90 * A);
  rule(pg, h.x + h.w, h.base, h.x + h.w, h.base - h.wall, 2.4, 0.90 * A);
  rule(pg, h.x, h.base, h.x + h.w, h.base, 2.0, 0.62 * A);

  // 门（朱）
  const dw = Math.min(24, h.w * 0.3), dx = h.x + h.w * 0.5 - dw / 2;
  pg.noStroke();
  pg.fill(RED[0], RED[1], RED[2], 255 * 0.20 * A);
  pg.rect(dx, h.base - h.wall * 0.72, dw, h.wall * 0.72);
  strokeRect(pg, dx, h.base - h.wall * 0.72, dw, h.wall * 0.72, 1.6, 0.7 * A);

  // 窗（直棂）
  for (let i = 0; i < 2; i++) {
    const wx = i === 0 ? h.x + h.w * 0.10 : h.x + h.w * 0.70;
    const ww = h.w * 0.20, wy = h.base - h.wall * 0.84, wh = h.wall * 0.34;
    strokeRect(pg, wx, wy, ww, wh, 1.4, 0.6 * A);
    for (let k = 1; k < 4; k++) rule(pg, wx + (ww * k) / 4, wy, wx + (ww * k) / 4, wy + wh, 0.9, 0.36 * A);
    rule(pg, wx, wy + wh * 0.5, wx + ww, wy + wh * 0.5, 0.9, 0.36 * A);
  }

  roof(pg, h.x, h.base - h.wall, h.w, h.roof, A);

  // 二层（重檐）
  if (h.up) {
    const b2 = h.base - h.wall - h.roof - 2;
    const w2 = h.w * 0.72, x2 = h.x + (h.w - w2) / 2;
    pg.noStroke();
    pg.fill(h.tone[0], h.tone[1], h.tone[2], 255 * 0.13 * A);
    pg.rect(x2, b2 - 26, w2, 26);
    rule(pg, x2, b2, x2, b2 - 26, 2.0, 0.76 * A);
    rule(pg, x2 + w2, b2, x2 + w2, b2 - 26, 2.0, 0.76 * A);
    rule(pg, x2, b2, x2 + w2, b2, 1.8, 0.6 * A);
    rule(pg, x2, b2 + 5, x2 + w2, b2 + 5, 1.8, 0.6 * A);
    for (let x = x2 + 3; x < x2 + w2 - 2; x += 9) rule(pg, x, b2 + 5, x, b2 + 11, 1.1, 0.45 * A);
    for (let i = 0; i < 3; i++) {
      strokeRect(pg, x2 + w2 * (0.12 + i * 0.3), b2 - 22, w2 * 0.16, 14, 1.3, 0.6 * A);
    }
    roof(pg, x2, b2 - 26, w2, h.roof * 0.78, A);
  }
  pg.pop();
}

// 屋顶：梯形瓦顶 + 瓦垄 + 檐下椽头
function roof(pg, x, ey, w, rh, A) {
  const eave = rh * 0.34 + 4;
  const ry = ey - rh;
  const rw = w * 0.5;
  const rx = x + (w - rw) / 2;
  const x0 = x - eave, x1 = x + w + eave;

  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.25 * A);
  pg.beginShape();
  pg.vertex(x0, ey);
  pg.vertex(rx, ry);
  pg.vertex(rx + rw, ry);
  pg.vertex(x1, ey);
  pg.endShape(pg.CLOSE);

  for (let i = 0; i <= 9; i++) {
    const u = i / 9;
    rule(pg, x0 + (x1 - x0) * u, ey + 2, rx + rw * u, ry + 2, 1.1, 0.38 * A);
  }
  rule(pg, x0, ey, x1, ey, 2.6, 0.92 * A);
  rule(pg, rx, ry, rx + rw, ry, 3.0, 0.92 * A);
  rule(pg, x0, ey, rx, ry, 2.0, 0.76 * A);
  rule(pg, x1, ey, rx + rw, ry, 2.0, 0.76 * A);
  for (let xx = x0 + 4; xx < x1 - 2; xx += 7) rule(pg, xx, ey + 2, xx, ey + 7.5, 1.3, 0.50 * A);
}

// ---- 柳树：树干与点叶入静态层，垂丝逐帧摆动 ----
function drawWillowTrunks(pg) {
  for (const w of WILLOWS) {
    const rnd = mulberry32(w.seed);
    const top = w.y - w.h;
    inkStroke(pg, catmull([
      [w.x, w.y],
      [w.x + (rnd() - 0.5) * 7, w.y - w.h * 0.4],
      [w.x + (rnd() - 0.5) * 9, w.y - w.h * 0.72],
      [w.x + (rnd() - 0.5) * 6, top],
    ], 8), { rgb: INK, alpha: 0.78, weight: 3.8, taper: 0.58, dry: 0.1, seed: w.seed });
    // 主枝
    for (let i = 0; i < 4; i++) {
      const a = -1.9 + i * 0.55 + (rnd() - 0.5) * 0.3;
      const L = 16 + rnd() * 16;
      dryLine(pg, w.x, top + 6, w.x + Math.cos(a) * L, top + 6 + Math.sin(a) * L * 0.7,
        { rgb: INK, alpha: 0.55, weight: 1.8, dry: 0.2, seed: w.seed + i });
    }
    // 点叶：一小簇一小簇的短笔，读作叶团（不用大块晕染）
    for (let i = 0; i < 46; i++) {
      const a = rnd() * TAU;
      const rr = Math.sqrt(rnd());
      const cx = w.x + Math.cos(a) * rr * 30;
      const cy = top + 4 - Math.abs(Math.sin(a)) * rr * 16 + (rnd() - 0.5) * 16;
      dryLine(pg, cx, cy, cx + (rnd() - 0.5) * 8, cy + 3 + rnd() * 6, {
        rgb: rnd() > 0.55 ? INK : [74, 96, 88], alpha: 0.18 + rnd() * 0.16,
        weight: 1.3 + rnd() * 1.1, dry: 0.35, seed: w.seed * 7 + i,
      });
    }
  }
}

// ---- 远岸水线（石砌驳岸）----
function drawShore(pg) {
  const rnd = mulberry32(707);
  inkStroke(pg, catmull([
    [-20, SHORE + 2], [140, SHORE - 3], [330, SHORE + 1],
    [520, SHORE - 2], [720, SHORE + 2], [900, SHORE - 1], [1020, SHORE + 2],
  ], 10), { rgb: INK, alpha: 0.55, weight: 2.4, taper: 0.3, dry: 0.1, wobble: 1.0, seed: 71 });
  for (let x = 6; x < 1000; x += 17) {
    rule(pg, x, SHORE + 1, x + (rnd() - 0.5) * 3, SHORE + 7 + rnd() * 4, 1.0, 0.22);
  }
  // 近岸驳岸（接公路）
  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.13);
  pg.rect(0, 756, 1000, 14);
  rule(pg, 0, 756, 1000, 756, 2.4, 0.62);
  for (let x = 8; x < 1000; x += 26) rule(pg, x, 757, x, 769, 1.2, 0.30);
}

// ---- 河面：淡青薄罩 + 一排排 S 形水波 ----
function drawWater(pg) {
  const ctx = pg.drawingContext;
  ctx.save();
  const gd = ctx.createLinearGradient(0, SHORE, 0, 770);
  gd.addColorStop(0, 'rgba(107,138,138,0.08)');
  gd.addColorStop(0.45, 'rgba(107,138,138,0.16)');
  gd.addColorStop(1, 'rgba(107,138,138,0.24)');
  ctx.fillStyle = gd;
  ctx.beginPath();
  ctx.rect(0, SHORE, 1000, 770 - SHORE);
  ctx.fill();
  ctx.restore();

  const rnd = mulberry32(8181);
  pg.push();
  pg.noFill();
  pg.strokeCap(pg.ROUND);
  for (let y = SHORE + 6; y < 768; y += (y < 640 ? 14 : y < 700 ? 11 : 8.5)) {
    let x = -30 + rnd() * 30;
    while (x < 1010) {
      const w = 26 + rnd() * 24;
      const amp = 1.3 + rnd() * 1.7;
      const a = 0.18 + rnd() * 0.22;
      const cy = y + (rnd() - 0.5) * 3;
      const ph = rnd() * TAU;
      pg.stroke(72, 102, 102, 255 * a);
      pg.strokeWeight(1.1 + rnd() * 0.7);
      let px = x, py = cy + Math.sin(ph) * amp;
      for (let k = 1; k <= 8; k++) {
        const nx = x + (w * k) / 8;
        const ny = cy + Math.sin(ph + (k / 8) * TAU) * amp;
        pg.line(px, py, nx, ny);
        px = nx; py = ny;
      }
      x += w + 10 + rnd() * 26;
    }
  }
  // 几道长的水面横纹（压住碎波，读作水）
  for (let i = 0; i < 9; i++) {
    const y = SHORE + 14 + rnd() * 170;
    const x = rnd() * 700;
    const len = 90 + rnd() * 200;
    pg.stroke(72, 102, 102, 90);
    pg.strokeWeight(1.1);
    pg.line(x, y, x + len, y + (rnd() - 0.5) * 2);
  }
  pg.pop();

  // 芦苇（远岸水边）
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 1000;
    if (x > 180 && x < 640) continue;
    const y = SHORE + 2 + rnd() * 8;
    dryLine(pg, x, y, x + (rnd() - 0.5) * 6, y - 10 - rnd() * 10,
      { rgb: CYAN, alpha: 0.30, weight: 1.2, dry: 0.35, seed: 900 + i });
  }
}

// ---- 舟（细笔曲线）：平底月牙船身 + 弧形船篷 ----
function drawBoat(pg, o) {
  const { x, y, L, H, awning = true, seed = 5, a = 1 } = o;
  const bow = [x, y - 7];
  const stern = [x + L, y - 8];
  const top = (u) => [x + u * L, y - 7 + 8 * u * u - 1.5 * Math.sin(Math.PI * u)];
  const bot = (u) => [x + u * L, y + H * Math.pow(Math.sin(Math.PI * u), 0.62) * (0.95 + 0.06 * u)];

  const topPts = [], botPts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    topPts.push(top(u));
    botPts.push(bot(u));
  }

  pg.push();
  // 船身
  pg.noStroke();
  pg.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * 0.38 * a);
  pg.beginShape();
  for (const p of topPts) pg.vertex(p[0], p[1]);
  for (let i = botPts.length - 1; i >= 0; i--) pg.vertex(botPts[i][0], botPts[i][1]);
  pg.endShape(pg.CLOSE);
  // 舷板（深一点的带）
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.16 * a);
  pg.beginShape();
  for (const p of topPts) pg.vertex(p[0], p[1]);
  for (let i = topPts.length - 1; i >= 0; i--) pg.vertex(topPts[i][0], topPts[i][1] + 6);
  pg.endShape(pg.CLOSE);

  poly(pg, topPts, 2.2, 0.92 * a);
  poly(pg, botPts, 2.2, 0.88 * a);
  // 板缝
  for (let i = 2; i <= 10; i += 3) {
    const u = i / 12;
    rule(pg, top(u)[0], top(u)[1] + 3, bot(u)[0], bot(u)[1] - 1, 0.9, 0.26 * a);
  }
  // 两头翘起的首尾柱
  rule(pg, bow[0], bow[1], bow[0] + 1.5, bow[1] - 6, 1.6, 0.7 * a);
  rule(pg, stern[0], stern[1], stern[0] - 1.5, stern[1] - 6, 1.6, 0.7 * a);

  if (awning) {
    const ax = x + L * 0.26, aw = L * 0.46, ah = 18;
    const ay = y - 5;
    const arc = Array.from({ length: 11 }, (_, i) => {
      const u = i / 10;
      return [ax + aw * u, ay - ah * Math.sin(Math.PI * u)];
    });
    pg.noStroke();
    pg.fill(CYAN[0], CYAN[1], CYAN[2], 255 * 0.34 * a);
    pg.beginShape();
    for (const p of arc) pg.vertex(p[0], p[1]);
    pg.vertex(ax + aw, ay);
    pg.vertex(ax, ay);
    pg.endShape(pg.CLOSE);
    poly(pg, arc, 1.9, 0.82 * a);
    rule(pg, ax, ay, ax + aw, ay, 1.8, 0.68 * a);
    for (let i = 1; i < 5; i++) {
      const u = i / 5;
      rule(pg, ax + aw * u, ay + 1, ax + aw * u, ay - ah * Math.sin(Math.PI * u), 1.0, 0.46 * a);
    }
    // 篷顶压条
    rule(pg, ax + aw * 0.12, ay - ah * 0.96, ax + aw * 0.88, ay - ah * 0.96, 1.0, 0.3 * a);
  }

  // 舵
  rule(pg, x + L - 3, y - 2, x + L + 13, y + 7, 1.5, 0.62 * a);
  rule(pg, x + L + 7, y + 3, x + L + 15, y + 17, 1.7, 0.58 * a);
  pg.pop();
}

// ---- 木拱桥（自绘叠梁拱：粗直木条交错，读作"木"，不是钢桁架）----
function drawBridge(pg) {
  pg.push();
  pg.strokeCap(pg.SQUARE);

  const N = 10;
  const outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const x = BR_X0 + ((BR_X1 - BR_X0) * i) / N;
    outer.push([x, archOutY(x)]);
    inner.push([x, archInY(x)]);
  }

  // 桥台（两端落到水里，石砌）
  for (const s of [-1, 1]) {
    const bx = s < 0 ? BR_X0 : BR_X1;
    const x0 = s < 0 ? bx - 8 : bx - 40;
    const xw = 48;
    pg.noStroke();
    pg.fill(INK[0], INK[1], INK[2], 255 * 0.18);
    pg.beginShape();
    pg.vertex(x0, archOutY(bx) - 4);
    pg.vertex(x0 + xw, archOutY(bx) - 4);
    pg.vertex(x0 + xw + 6, ABUT_BOT);
    pg.vertex(x0 - 6, ABUT_BOT);
    pg.endShape(pg.CLOSE);
    rule(pg, x0, archOutY(bx) - 4, x0 - 6, ABUT_BOT, 2.6, 0.85);
    rule(pg, x0 + xw, archOutY(bx) - 4, x0 + xw + 6, ABUT_BOT, 2.6, 0.85);
    rule(pg, x0 - 6, ABUT_BOT, x0 + xw + 6, ABUT_BOT, 2.4, 0.7);
    for (let y = archOutY(bx) + 6; y < ABUT_BOT; y += 14) {
      rule(pg, x0 - 5, y, x0 + xw + 5, y + 1.5, 1.2, 0.32);
    }
  }

  // 拱圈底色：整片厚木
  pg.noStroke();
  pg.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * 0.30);
  pg.beginShape();
  for (const p of outer) pg.vertex(p[0], p[1]);
  for (let i = inner.length - 1; i >= 0; i--) pg.vertex(inner[i][0], inner[i][1]);
  pg.endShape(pg.CLOSE);
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.05);
  pg.beginShape();
  for (const p of outer) pg.vertex(p[0], p[1]);
  for (let i = inner.length - 1; i >= 0; i--) pg.vertex(inner[i][0], inner[i][1]);
  pg.endShape(pg.CLOSE);

  // 叠梁：四道跟拱圈同形的纵向木骨 + 节点竖木（叠梁拱的"层"，不做钢桁架斜撑）
  const chains = [0.0, 0.34, 0.67, 1.0].map((f) =>
    outer.map((p, i) => [p[0], p[1] + (inner[i][1] - p[1]) * f])
  );
  for (let k = 0; k < 3; k++) {
    poly(pg, chains[k], 2.6, 0.72);
  }
  // 节点竖木
  for (let i = 0; i <= N; i++) {
    for (let k = 0; k < 3; k++) {
      rule(pg, chains[k][i][0], chains[k][i][1], chains[k + 1][i][0], chains[k + 1][i][1], 2.0, 0.52);
    }
  }
  // 梁头：每个节点上一道短出头，读作"一层层叠起来的直木"
  for (let i = 0; i <= N; i++) {
    for (let k = 0; k < 3; k++) {
      const cx = chains[k][i][0], cy = chains[k][i][1];
      rule(pg, cx - 5, cy - 1.2, cx + 5, cy + 1.2, 2.0, 0.42);
    }
  }
  // 拱圈上下缘
  poly(pg, outer, 3.4, 0.94);
  poly(pg, inner, 3.4, 0.90);
  rule(pg, outer[0][0], outer[0][1], inner[0][0], inner[0][1], 2.8, 0.85);
  const L = outer.length - 1;
  rule(pg, outer[L][0], outer[L][1], inner[L][0], inner[L][1], 2.8, 0.85);

  // 桥面
  const deckFar = deckLine(0);
  const deckNear = deckLine(DECK_T);
  pg.noStroke();
  pg.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * 0.22);
  pg.beginShape();
  for (const p of deckFar) pg.vertex(p[0], p[1]);
  for (let i = deckNear.length - 1; i >= 0; i--) pg.vertex(deckNear[i][0], deckNear[i][1]);
  pg.endShape(pg.CLOSE);
  // 檐下阴影：桥面底的一道暗带
  pg.fill(INK[0], INK[1], INK[2], 255 * 0.10);
  pg.beginShape();
  for (const p of deckNear) pg.vertex(p[0], p[1]);
  for (let i = deckNear.length - 1; i >= 0; i--) pg.vertex(deckNear[i][0], deckNear[i][1] + 7);
  pg.endShape(pg.CLOSE);
  poly(pg, deckFar, 3.2, 0.95);
  poly(pg, deckNear, 2.8, 0.88);
  poly(pg, deckLine(DECK_T * 0.48), 1.1, 0.26);
  // 桥面板缝
  for (let x = BR_X0 + 10; x < BR_X1 - 6; x += 18) {
    rule(pg, x, deckY(x) + 2, x, deckY(x) + DECK_T - 2, 0.9, 0.22);
  }

  // 桥栏（远侧）：立柱 + 两道横栏（压淡，别跟人群抢）
  poly(pg, deckLine(-RAIL_H), 2.0, 0.66);
  poly(pg, deckLine(-RAIL_H * 0.5), 1.4, 0.40);
  pg.noStroke();
  for (let x = BR_X0 + 10; x < BR_X1 - 40; x += 48) {
    pg.fill(CYAN[0], CYAN[1], CYAN[2], 255 * 0.09);
    pg.beginShape();
    pg.vertex(x, deckY(x));
    pg.vertex(x + 48, deckY(x + 48));
    pg.vertex(x + 48, deckY(x + 48) - RAIL_H);
    pg.vertex(x, deckY(x) - RAIL_H);
    pg.endShape(pg.CLOSE);
  }
  for (let x = BR_X0 + 10; x < BR_X1; x += 48) {
    rule(pg, x, deckY(x), x, deckY(x) - RAIL_H - 1, 1.5, 0.46);
  }

  // 桥头华表（两根，界尺直线）
  for (const s of [-1, 1]) {
    const bx = s < 0 ? BR_X0 - 14 : BR_X1 + 14;
    const by = deckY(s < 0 ? BR_X0 : BR_X1) + DECK_T;
    rule(pg, bx, by, bx, by - 56, 2.4, 0.80);
    rule(pg, bx - 7, by - 56, bx + 7, by - 56, 2.0, 0.72);
    rule(pg, bx - 5, by - 46, bx + 5, by - 46, 1.6, 0.55);
    pg.noStroke();
    pg.fill(INK[0], INK[1], INK[2], 255 * 0.10);
    pg.circle(bx, by - 63, 9);
  }
  pg.pop();
}

// ---- 落款 + 印章 ----
function drawColophon(pg) {
  const cx = 886;
  pg.push();
  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 150);
  pg.textAlign(pg.CENTER, pg.CENTER);
  pg.textSize(21);
  const txt = '清明上河';
  for (let i = 0; i < txt.length; i++) pg.text(txt[i], cx, 88 + i * 27);
  pg.textSize(13);
  pg.fill(INK[0], INK[1], INK[2], 110);
  pg.text('摹', cx, 88 + txt.length * 27 + 2);
  pg.pop();

  // 印章（避开舱体出画的右侧）
  const rgb = RED;
  const sx = cx - 16, sy = 210;
  pg.push();
  pg.noFill();
  pg.stroke(rgb[0], rgb[1], rgb[2], 205);
  pg.strokeWeight(2.2);
  pg.rect(sx, sy, 32, 32, 2);
  pg.strokeWeight(0.9);
  pg.stroke(rgb[0], rgb[1], rgb[2], 130);
  pg.rect(sx + 3, sy + 3, 26, 26, 1.5);
  pg.noStroke();
  pg.fill(rgb[0], rgb[1], rgb[2], 220);
  pg.textAlign(pg.CENTER, pg.CENTER);
  pg.textSize(18);
  pg.text('摹', sx + 16, sy + 17);
  pg.pop();
}

// ---- 绢面横向折痕 ----
function creases(pg) {
  const rnd = mulberry32(909);
  for (let i = 0; i < 4; i++) {
    const y = 150 + i * 200 + (rnd() - 0.5) * 40;
    const o = (rnd() - 0.5) * 7;
    inkStroke(pg, [[-20, y], [1020, y + o]], {
      rgb: INK, alpha: 0.045, weight: 1.5, taper: 0.8, dry: 0.12, seed: 700 + i,
    });
    inkStroke(pg, [[-20, y + 3], [1020, y + 3 + o]], {
      rgb: [255, 252, 244], alpha: 0.20, weight: 1.7, taper: 0.8, dry: 0.12, seed: 800 + i,
    });
  }
}

// ---- 绢面颗粒 ----
function silkGrain(pg) {
  const rnd = mulberry32(1313);
  pg.push();
  pg.noStroke();
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 1000, y = rnd() * 1000;
    if (rnd() > 0.5) pg.fill(255, 253, 246, 10 + rnd() * 12);
    else pg.fill(INK[0], INK[1], INK[2], 8 + rnd() * 12);
    pg.circle(x, y, 0.6 + rnd() * 1.1);
  }
  pg.pop();
}

// ============================================================
// 逐帧动态层
// ============================================================

// 回头波波前：与拍同速，自左向右扫过全桥
function waveFront(local) { return 130 + 560 * smooth(0.7, 3.6, local); }
function turnOf(px, local) { return smooth(px - 58, px + 22, waveFront(local)); }
function lookOf(px, capX) { return Math.max(-1, Math.min(1, (capX - px) / 200)); }

// ---- 桥上人群 ----
function drawCrowd(g, local, capX) {
  for (const c of CROWD) {
    const px = BR_X0 + c.u * (BR_X1 - BR_X0);
    const py = deckY(px) + 23;
    const turn = turnOf(px, local);
    const look = lookOf(px, capX);
    const s = c.s * 1.2;
    if (c.kind === 'donkey') drawDonkey(g, px, py, c.s * 1.25, look, turn);
    else if (c.kind === 'porter') drawPorter(g, px, py, s, c.tone, look, turn);
    else drawFigure(g, px, py, { s, tone: c.tone, hat: c.hat, look, turn, lean: look * 1.3 * turn });
  }
}

// ---- 岸上行人 / 船夫 ----
function drawFolk(g, local, capX) {
  for (const f of FOLK) {
    const turn = smooth(f.x - 110, f.x + 40, waveFront(local));
    const look = lookOf(f.x, capX);
    drawFigure(g, f.x, f.y, { s: f.s * 1.06, tone: f.tone, hat: f.hat || 0, look, turn: turn * 0.85 });
  }
}

// ---- 极简人物剪影：头 = 3.5 单位圆点，身子一笔墨剪影（高 12~18）----
// 小尺寸下要"看得见"，靠三件事：实心墨剪影、头与肩之间留一道颈、头单独转
function drawFigure(g, x, y, o) {
  const { s = 1, tone = OCHRE, hat = 0, look = 0, turn = 0, lean = 0 } = o;
  const H = 10.2 * s;                       // 肩高
  const hx = x + look * 5.8 * turn;         // 头：单独圆点，随舱体 x 转向
  const hy = y - H - 3.1 * s - 1.3 * turn;  // 头紧接双肩（小尺寸不能留大缝）
  const sx = x + lean * 0.6 * s;

  g.push();
  g.noStroke();
  // 衣：薄罩淡赭 / 淡青（比剪影宽一圈）
  g.fill(tone[0], tone[1], tone[2], 255 * 0.40);
  g.beginShape();
  g.vertex(x - 5.6 * s, y);
  g.vertex(sx - 3.9 * s, y - H);
  g.vertex(sx + 3.9 * s, y - H);
  g.vertex(x + 5.6 * s, y);
  g.endShape(g.CLOSE);

  // 墨剪影：袍（带开衩）
  g.fill(INK[0], INK[1], INK[2], 244);
  g.beginShape();
  g.vertex(sx - 3.5 * s, y - H);
  g.vertex(sx + 3.5 * s, y - H);
  g.vertex(x + 4.9 * s, y - 0.4 * s);
  g.vertex(x + 1.2 * s, y - 0.4 * s);
  g.vertex(x + 0.4 * s, y - 4.0 * s);
  g.vertex(x - 0.4 * s, y - 4.0 * s);
  g.vertex(x - 1.2 * s, y - 0.4 * s);
  g.vertex(x - 4.9 * s, y - 0.4 * s);
  g.endShape(g.CLOSE);

  // 臂 + 颈
  g.stroke(INK[0], INK[1], INK[2], 240);
  g.strokeCap(g.ROUND);
  g.strokeWeight(1.9 * s);
  g.line(sx, y - H + 3.6 * s, sx + (3.8 + look * 2.8 * turn) * s, y - H + 7.8 * s);
  g.strokeWeight(2.0 * s);
  g.line(sx, y - H + 0.4 * s, hx, hy + 2.8 * s);

  // 头
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 250);
  g.circle(hx, hy, 7.4 * s);

  if (hat === 1) {          // 幞头：实心小帽（比头窄一点，别把头做成方块）
    g.fill(INK[0], INK[1], INK[2], 238);
    g.rect(hx - 3.2 * s, hy - 4.9 * s, 6.4 * s, 2.3 * s, 1.0 * s);
  } else if (hat === 2) {   // 斗笠：宽而扁
    g.fill(INK[0], INK[1], INK[2], 230);
    g.beginShape();
    g.vertex(hx - 7.6 * s, hy - 1.4 * s);
    g.vertex(hx, hy - 5.6 * s);
    g.vertex(hx + 7.6 * s, hy - 1.4 * s);
    g.endShape(g.CLOSE);
  }
  g.pop();
}

// ---- 挑担：人 + 扁担 + 两只箩筐 ----
function drawPorter(g, x, y, s, tone, look, turn) {
  drawFigure(g, x, y, { s, tone, hat: 2, look, turn, lean: look * 0.5 });
  g.push();
  g.strokeCap(g.SQUARE);
  const sy = y - 11.8 * s;
  rule(g, x - 15 * s, sy - 1.5, x + 15 * s, sy + 1.5, 2.0, 0.82);
  for (const sgn of [-1, 1]) {
    const bx = x + sgn * 13 * s;
    rule(g, bx, sy, bx, sy + 4 * s, 1.4, 0.66);
    g.noStroke();
    g.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * 0.40);
    g.beginShape();
    g.vertex(bx - 4.6 * s, sy + 4 * s);
    g.vertex(bx + 4.6 * s, sy + 4 * s);
    g.vertex(bx + 3.6 * s, sy + 11 * s);
    g.vertex(bx - 3.6 * s, sy + 11 * s);
    g.endShape(g.CLOSE);
    strokeRect(g, bx - 4.6 * s, sy + 4 * s, 9.2 * s, 7 * s, 1.5, 0.78);
  }
  g.pop();
}

// ---- 驴：四腿绷直，脖子伸向舱体 ----
function drawDonkey(g, x, y, s, look, turn) {
  const dir = look >= 0 ? 1 : -1;
  const reach = 0.55 + 0.45 * turn;
  const nx = x + dir * (9 + 8 * reach) * s;
  const ny = y - 17.5 * s - 2.2 * s * turn;

  g.push();
  g.strokeCap(g.ROUND);
  // 四腿绷直
  g.stroke(INK[0], INK[1], INK[2], 236);
  g.strokeWeight(1.9 * s);
  g.line(x - 8 * s, y - 9 * s, x - 11 * s, y);
  g.line(x - 5 * s, y - 9 * s, x - 6 * s, y);
  g.line(x + 6 * s, y - 9 * s, x + 8 * s, y);
  g.line(x + 9 * s, y - 9 * s, x + 12 * s, y);
  // 身
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 232);
  g.ellipse(x + 0.5 * s, y - 13 * s, 23 * s, 9.5 * s);
  // 驮包
  g.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * 0.28);
  g.rect(x - 7 * s, y - 19 * s, 14 * s, 6 * s, 1.2 * s);
  // 脖子 + 头
  g.stroke(INK[0], INK[1], INK[2], 232);
  g.strokeWeight(3.4 * s);
  g.line(x + dir * 8 * s, y - 14.5 * s, nx, ny + 1.5 * s);
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 236);
  g.ellipse(nx + dir * 2 * s, ny, 9 * s, 6 * s);
  // 双耳
  g.stroke(INK[0], INK[1], INK[2], 230);
  g.strokeWeight(1.4 * s);
  g.line(nx + dir * 0.5 * s, ny - 2.6 * s, nx + dir * 1.5 * s, ny - 7.5 * s);
  g.line(nx + dir * 3.5 * s, ny - 2.4 * s, nx + dir * 4.5 * s, ny - 7.0 * s);
  // 尾
  g.line(x - 11 * s, y - 15 * s, x - 15 * s, y - 10 * s);
  g.pop();
}

// ---- 正从桥洞下穿过的船：船夫仰头 / 篙杆脱手 / 乘客探身 ----
function drawFerry(g, local, capX, bx) {
  const by = 598;
  drawBoat(g, { x: bx, y: by, L: 170, H: 22, awning: true, seed: 61, a: 1 });

  // 船尾的横波（缓行的痕）
  g.push();
  g.noStroke();
  for (let i = 0; i < 3; i++) {
    g.fill(250, 247, 238, 70 - i * 18);
    g.ellipse(bx + 176, by + 14 + i * 3, 44 - i * 8, 5);
  }
  g.pop();

  const look = Math.max(-1, Math.min(1, (capX - (bx + 90)) / 200));
  const turn = smooth(360, 620, waveFront(local));

  // 船夫（船尾）：仰头看舱体
  const bxm = bx + 138, bym = by - 2;
  drawFigure(g, bxm, bym, { s: 1.06, tone: OCHRE, hat: 2, look, turn, lean: look * 0.6 });

  // 篙杆：先在手里点水，第 2 小节脱手 → 斜插进水里（竿梢落水 = 第 1 拍的水波源）
  const slip = smooth(2.0, 2.7, local);
  const mx = bxm + 4 - 30 * slip;
  const my = bym - 12 - 6 * slip;
  const tx = bxm - 24 + 72 * slip;
  const ty = 648 + 8 * slip;
  g.push();
  g.strokeCap(g.ROUND);
  g.stroke(INK[0], INK[1], INK[2], 228);
  g.strokeWeight(2.2);
  g.line(mx, my, tx, ty);
  // 竿上的两道箍
  g.strokeWeight(1.4);
  g.stroke(INK[0], INK[1], INK[2], 150);
  for (const u of [0.34, 0.62]) {
    g.line(mx + (tx - mx) * u, my + (ty - my) * u,
      mx + (tx - mx) * u + 4, my + (ty - my) * u - 3);
  }
  g.pop();

  // 水波：自竿梢一圈圈扩散（周期两拍）
  const ph = (local % (2 * BEAT)) / (2 * BEAT);
  g.push();
  g.noFill();
  for (let i = 0; i < 3; i++) {
    const u = (ph + i * 0.33) % 1;
    const r = 5 + 30 * u;
    g.stroke(72, 102, 102, 255 * 0.42 * (1 - u));
    g.strokeWeight(1.7 * (1 - u) + 0.6);
    g.ellipse(tx, ty + 3, r * 2, r * 0.62);
  }
  // 落水的小水花
  g.noStroke();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + local * 1.4;
    g.fill(255, 253, 246, 90 + 60 * slip);
    g.circle(tx + Math.cos(a) * 6, ty + Math.sin(a) * 2.4, 2.0);
  }
  g.pop();

  // 乘客：半个身子探出船篷（篷口最矮处，身体明确露在篷外）
  const pxp = bx + 116 + look * 4 * turn;
  const pyp = by - 2;
  const hxp = pxp + look * 4.4 * turn;
  g.push();
  g.noStroke();
  g.fill(CYAN[0], CYAN[1], CYAN[2], 255 * 0.34);
  g.beginShape();
  g.vertex(pxp - 5.2, pyp);
  g.vertex(pxp + 5.2, pyp);
  g.vertex(pxp + 3.8, pyp - 13);
  g.vertex(pxp - 3.8, pyp - 13);
  g.endShape(g.CLOSE);
  g.fill(INK[0], INK[1], INK[2], 240);
  g.beginShape();
  g.vertex(pxp - 3.4, pyp);
  g.vertex(pxp + 3.4, pyp);
  g.vertex(pxp + 2.6, pyp - 11);
  g.vertex(pxp - 2.6, pyp - 11);
  g.endShape(g.CLOSE);
  // 颈与头（转向舱体，仰头）
  g.stroke(INK[0], INK[1], INK[2], 240);
  g.strokeCap(g.ROUND);
  g.strokeWeight(1.8);
  g.line(pxp, pyp - 10, hxp, pyp - 16.6);
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 248);
  g.circle(hxp, pyp - 19, 7.6);
  g.pop();
}

// ---- 过框：城楼轮廓淡墨提亮一次 ----
function drawGateFlash(g, local) {
  const f = Math.max(
    smooth(0, 0.35, local) * (1 - smooth(0.55, 1.05, local)),
    smooth(5.55, 5.85, local) * (1 - smooth(5.9, 6, local))
  );
  if (f <= 0.01) return;
  g.push();
  g.noFill();
  g.strokeCap(g.SQUARE);
  const gx = 706, gw = 168, gb = 404;
  g.stroke(255, 252, 244, 255 * 0.55 * f);
  g.strokeWeight(2.6);
  g.rect(gx + 14, gb - 86, gw - 28, 28);
  g.stroke(INK[0], INK[1], INK[2], 255 * 0.30 * f);
  g.strokeWeight(2.0);
  g.beginShape();
  g.vertex(gx, gb);
  g.vertex(gx + 9, gb - 58);
  g.vertex(gx + gw - 9, gb - 58);
  g.vertex(gx + gw, gb);
  g.endShape();
  g.strokeWeight(1.6);
  const ey = gb - 86, ry = ey - 40, eave = 18, rw = (gw - 28) * 0.52;
  const rx = gx + 14 + ((gw - 28) - rw) / 2;
  g.line(rx - eave, ey, rx, ry);
  g.line(rx + rw + eave, ey, rx + rw, ry);
  g.line(rx, ry, rx + rw, ry);
  g.pop();
}

// ---- 幌子：随风摆；第 5 拍翻一次面 ----
function drawBanners(g, local) {
  for (const b of BANNERS) {
    const rnd = mulberry32(b.seed);
    const sway = Math.sin(local * 2.6 + b.seed) * 0.34;
    const flip = smooth(2.0, 2.55, local) * (1 - smooth(2.7, 3.25, local));
    const th = sway + flip * Math.PI;
    const ws = Math.cos(th);
    const w = b.w * ws;

    g.push();
    g.strokeCap(g.SQUARE);
    // 挑杆
    rule(g, b.x - 15, b.y - 9, b.x + 3, b.y - 9, 2.0, 0.78);
    rule(g, b.x - 15, b.y - 9, b.x - 15, b.y - 1, 2.4, 0.7);
    rule(g, b.x - 15, b.y - 9, b.x - 11, b.y - 15, 1.6, 0.6);
    // 布面
    g.noStroke();
    g.fill(RED[0], RED[1], RED[2], 255 * 0.46);
    g.beginShape();
    g.vertex(b.x - 15, b.y);
    g.vertex(b.x - 15 + w, b.y + 2);
    g.vertex(b.x - 15 + w * 0.86, b.y + b.h);
    g.vertex(b.x - 15, b.y + b.h - 2);
    g.endShape(g.CLOSE);
    strokeRect(g, b.x - 15, b.y, w, b.h, 1.6, 0.72);
    // 字号（虚构）
    const n = b.text.length;
    if (Math.abs(ws) > 0.32) {
      g.push();
      g.translate(b.x - 15 + w / 2, 0);
      g.scale(Math.sign(ws), 1);
      g.noStroke();
      g.fill(INK[0], INK[1], INK[2], 225);
      g.textAlign(g.CENTER, g.CENTER);
      g.textSize(Math.min(13, (b.h - 6) / n));
      for (let i = 0; i < n; i++) {
        g.text(b.text[i], 0, b.y + 6 + ((b.h - 8) * (i + 0.5)) / n);
      }
      g.pop();
    }
    g.pop();
  }
}

// ---- 柳枝：常态轻摆；第 5 拍整树摆动一次 ----
function drawWillowStrands(g, local) {
  const pulse = Math.sin((local - 2.0) * 2.1) * smooth(1.9, 2.3, local) * (1 - smooth(2.6, 3.2, local));
  for (const w of WILLOWS) {
    const rnd = mulberry32(w.seed * 31 + 7);
    const cx = w.x, cy = w.y - w.h;
    for (let i = 0; i < 10; i++) {
      const dx = (rnd() - 0.5) * 50;
      const len = 30 + rnd() * 32;
      const sw = Math.sin(local * 1.5 + i * 0.7) * 3.4 + pulse * 14;
      const pts = catmull([
        [cx + dx * 0.3, cy + 4],
        [cx + dx * 0.75 + sw * 0.28, cy + len * 0.42],
        [cx + dx + sw * 0.72, cy + len * 0.78],
        [cx + dx * 1.12 + sw, cy + len],
      ], 7);
      inkStroke(g, pts, {
        rgb: i % 3 === 0 ? [74, 96, 88] : INK, alpha: 0.34, weight: 1.15,
        taper: 0.68, dry: 0.14, seed: w.seed * 100 + i,
      });
      // 叶：细笔短点
      for (let k = 1; k < 4; k++) {
        const p = pts[Math.floor((pts.length - 1) * (k / 4))];
        dryLine(g, p[0], p[1], p[0] + (rnd() - 0.5) * 6, p[1] + 2.5 + rnd() * 4, {
          rgb: INK, alpha: 0.24, weight: 0.9, dry: 0.4, seed: w.seed * 50 + i * 4 + k,
        });
      }
    }
  }
}

// ---- 店铺窗口探头看的人 ----
function drawWatchers(g, capX) {
  for (const w of WATCHERS) {
    const look = Math.max(-1, Math.min(1, (capX - w.x) / 240));
    g.push();
    g.noStroke();
    // 肩
    g.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * 0.26);
    g.beginShape();
    g.vertex(w.x - 6, w.y + 9);
    g.vertex(w.x + 6, w.y + 9);
    g.vertex(w.x + 4.5, w.y - 4);
    g.vertex(w.x - 4.5, w.y - 4);
    g.endShape(g.CLOSE);
    g.stroke(INK[0], INK[1], INK[2], 225);
    g.strokeCap(g.ROUND);
    g.strokeWeight(3.8);
    g.line(w.x, w.y + 8, w.x + look * 2.2, w.y - 3);
    // 头（探出并转向舱体）
    g.noStroke();
    g.fill(INK[0], INK[1], INK[2], 242);
    g.circle(w.x + look * 4.2, w.y - 7, 7.4);
    g.pop();
  }
}

// ---- 水面浮雾 ----
function drawDrift(g, local) {
  g.push();
  g.noStroke();
  for (let i = 0; i < 5; i++) {
    const ph = (local * 0.026 + i * 0.21) % 1;
    g.fill(250, 247, 238, 26);
    g.ellipse(-90 + ph * 1180, 592 + Math.sin(i * 2.3) * 12, 240 + i * 26, 16 + (i % 3) * 6);
  }
  g.pop();
}
