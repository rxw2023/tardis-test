// ============================================================
// s11-ukiyoe.js — 第 11 版块：浮世绘 · 东海道风景版画（1830s）
//
// 美术口径（只取「歌川派东海道风景版画」这一公有领域品类，自绘全部母题）：
//   单点透视：所有地平线方向的平行线交汇于灭点 VP(1500, 297)，水平线 y=297
//   天空：横向ぼかし（淡蓝→靛蓝→地平线暖米黄，5 段软边色带）
//   远景：自绘圆锥雪山（雪顶锯齿 + 山脚一道雾带）
//   中景：东海道从左下斜向右上遁入纵深（宽 124→48）；路两侧是水田条带
//   近景：左下路边茶馆（茅草顶 + 长凳 + 茶炉 + 抽象圆纹灯笼）、两株松树
//   笔法三件套：粗黑轮廓线（3~5.5）＋ 完全平涂色块 ＋ 和纸竖向木纹
//           ＋ 4 处「套色错位」（山体／路面／茶馆屋顶／舱体，色块溢出轮廓 2~4）
//   梗（第 2 小节）：路人抬头波随舱体推进传递；前排一人斗笠被吹翻滚动两圈（8fps）；
//          小狗朝舱体吠（8fps 两档）；水田两人直腰、一人秧苗落水；茶馆探出半个人
//   节奏：全部动态量化到 8fps；第 1/5/9 拍一阵风扫过（松枝摆、灯笼晃、落叶走一格）
//   版权：无题跋、无地名、灯笼只画抽象圆纹；全部造型自绘
// ============================================================

import { TAU, routeU, hoverY, swirlAngle, smooth } from '../beat/beats.js';
import { mulberry32, rrFill, rrStroke, grain, vignette, lerp } from '../kit/kit.js';

// ============================================================
// 调色（取自 briefs/11-ukiyoe.md）
// ============================================================
const WASHI = '#e9dfc8';   // 和纸
const SUMI = '#21323e';   // 墨
const SUMI_D = '#16242c';   // 深墨
const SUMI_L = '#3b5361';   // 淡墨
const AIZURI = '#4a7a96';   // 蓝摺
const MIZU = '#8fb4c4';   // 淡蓝
const OCHRE = '#c08a50';   // 赭
const MIDORI = '#6a8a5a';   // 绿
const SHU = '#b04a3a';   // 朱（灯笼与衣饰点缀）
const BRASS = '#c9973f';   // 黄铜
const YUKI = '#f4efe0';   // 雪
const PAPER_D = '#d8cbab';   // 和纸暗部
const HADA = '#e6d2ab';   // 肤色

// 田块派生色（仍属同一套版画颜料）
const RICE = '#7d9a63';
const RICE_D = '#4f6a44';
const WATER = '#84aec0';
const WATER_D = '#5f8ea3';
const DAICHI = '#b8a882';   // 畦／土
const ROAD_F = '#d9bd8b';   // 路面（赭系亮）
const ROAD_D = '#c19a63';   // 路面暗部

// ============================================================
// 透视几何：所有地面平行线过灭点 VP(1500, 297)
// ============================================================
const VPX = 1500, VPY = 297;
const HORIZON = VPY;
const STEP = 22;                       // 边缘采样步长

function fPersp(x, y0) { return VPY + (y0 - VPY) * (1 - x / VPX); }
const roadFar = (x) => fPersp(x, 620);
const roadNear = (x) => fPersp(x, 770);
const roadCtr = (x) => fPersp(x, 695);
const roadHalf = (x) => 62 * (1 - x / VPX);
// 人物缩放：取透视的一部分（版画习惯压缩纵深差，保证最小的人也读得出）
const figScale = (x) => 0.52 + 0.48 * (1 - x / VPX);
// 路宽度方向的横向定位 lat∈[-1,1]
const onRoad = (x, lat) => roadCtr(x) + lat * roadHalf(x) * 0.72;

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
// 8fps 量化（短片动画一律一顿一顿）
const Q = (t) => Math.floor(t * 8) / 8;

// ============================================================
// 基本画笔（全部走原生 ctx，避开 p5 2.x 的形状坑）
// ============================================================
function pathOf(ctx, pts, ox = 0, oy = 0) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  ctx.closePath();
}
function fillPoly(ctx, pts, col, ox = 0, oy = 0) {
  pathOf(ctx, pts, ox, oy);
  ctx.fillStyle = col;
  ctx.fill();
}
function linePoly(ctx, pts, col, w, ox = 0, oy = 0, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  if (close) ctx.closePath();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
// 粗黑轮廓 + 平涂（木版画的基本单元）
function block(ctx, pts, fill, ox = 0, oy = 0, lw = 4) {
  fillPoly(ctx, pts, fill, ox, oy);
  linePoly(ctx, pts, SUMI, lw);
}
function openLine(ctx, pts, col, w) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
function disc(ctx, cx, cy, r, col) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = col;
  ctx.fill();
}
function ring(ctx, cx, cy, r, col, w) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
}

// ============================================================
// 静态几何：山、树冠、田垄行
// ============================================================
// 自绘圆锥雪山（纯折线，故意不用任何名作山形）
const MTN = [
  [688, 300], [722, 272], [746, 250], [770, 226], [790, 204], [810, 180],
  [828, 156], [844, 138], [860, 130], [876, 142], [892, 162], [910, 188],
  [928, 214], [948, 244], [966, 270], [982, 300],
];
// 雪冠：上半条山脊 + 一道锯齿雪线
const MTN_SNOW = [
  [794, 198], [812, 180], [830, 154], [846, 136], [862, 130], [878, 142],
  [894, 160], [912, 186], [921, 197],
  [905, 182], [891, 201], [877, 180], [865, 201], [851, 178], [839, 199],
  [825, 180], [812, 200],
];
// 右侧阴面（仍为平涂单色）
const MTN_DARK = [
  [862, 130], [878, 142], [894, 162], [910, 188], [928, 214], [948, 244],
  [966, 270], [982, 300], [864, 300],
];

// 松树针叶团：确定性起伏的横向团块（不用随机，避免逐帧抖动）
function needleBlob(cx, cy, w, h, seed) {
  const pts = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const wob = 0.86 + 0.16 * Math.sin(i * 2.7 + seed) + 0.09 * Math.sin(i * 5.3 + seed * 1.7);
    const squash = Math.sin(a) < 0 ? 0.52 : 1.0;   // 上缘鼓、下缘平（松针团的经典剪影）
    pts.push([cx + Math.cos(a) * w * 0.5 * wob, cy + Math.sin(a) * h * 0.5 * wob * squash]);
  }
  return pts;
}

// 一条地面平行线 → 采样点列
function perspLine(x0, x1, b, dy = 0) {
  const pts = [];
  for (let x = x0; x <= x1; x += STEP) pts.push([x, fPersp(x, b) + dy]);
  return pts;
}
// 两条平行线之间的一垄田
function rowPoly(bA, bB) {
  const pts = [];
  for (let x = -60; x <= 1060; x += STEP) pts.push([x, fPersp(x, bA)]);
  for (let x = 1060; x >= -60; x -= STEP) pts.push([x, fPersp(x, bB)]);
  return pts;
}
// 远侧（路的上边以外）的水田垄 hanging from 620 向地平线收敛
const FAR_ROWS = [];
for (let i = 0; i < 9; i++) {
  const bA = VPY + (620 - VPY) * Math.pow(0.775, i);
  const bB = VPY + (620 - VPY) * Math.pow(0.775, i + 1);
  FAR_ROWS.push([bA, bB]);
}
// 近侧（路的下边以外）的水田垄 由 770 向下（更近）
const NEAR_ROWS = [];
for (let i = 0; i < 6; i++) {
  const bA = VPY + (770 - VPY) * Math.pow(1.27, i);
  const bB = VPY + (770 - VPY) * Math.pow(1.27, i + 1);
  NEAR_ROWS.push([bA, bB]);
}
const FAR_COL = [
  [WATER, RICE], [RICE, WATER], [WATER_D, RICE], [RICE, WATER],
  [WATER, RICE], [RICE, WATER], [WATER_D, RICE], [RICE, WATER], [WATER, RICE],
];
const NEAR_COL = [
  [RICE, WATER], [WATER_D, RICE], [RICE, WATER], [WATER, RICE], [RICE, WATER], [WATER_D, RICE],
];

// ============================================================
// 路上行人（8 个）
// ============================================================
const WALKERS = [
  { x0: 62, lat: -0.42, dir: 1, robe: SHU, sash: WASHI, item: 'bundle', ph: 0 },
  { x0: 152, lat: 0.36, dir: 1, robe: MIDORI, sash: BRASS, item: 0, ph: 1 },
  { x0: 238, lat: -0.32, dir: -1, robe: AIZURI, sash: WASHI, item: 'staff', ph: 2 },
  { x0: 346, lat: 0.42, dir: 1, robe: OCHRE, sash: SUMI, item: 0, ph: 3 },
  { x0: 452, lat: -0.36, dir: 1, robe: MIZU, sash: SHU, item: 'bundle', ph: 4 },
  { x0: 584, lat: 0.30, dir: -1, robe: AIZURI, sash: WASHI, item: 0, ph: 5 },
  { x0: 726, lat: -0.28, dir: -1, robe: MIDORI, sash: BRASS, item: 0, ph: 6 },
  { x0: 866, lat: 0.34, dir: 1, robe: OCHRE, sash: SUMI, item: 'staff', ph: 7 },
];

// ============================================================
// 缓存层：天空ぼかし渐变 / 和纸纹理
// ============================================================
let skyGrad = null;
let washiLayer = null;

// ============================================================
// render
// ============================================================
export function render(g, meta, local, index) {
  // 过框距离（本版块边界为 local 0 与 6）
  const crossD = Math.min(local, 6 - local);
  const glow = Math.exp(-Math.pow(crossD / 0.34, 2));
  const L = Q(local);                       // 8fps 量化的排演时间
  const gust = gustEnv(L);                  // 风：第 1/5/9 拍

  g.push();
  drawPaper(g, meta);
  drawSky(g);
  drawMountain(g, glow);
  drawLand(g);
  drawFarRows(g);
  drawPines(g, gust);
  drawTeahouse(g, L, gust);
  drawNearRows(g, L);
  drawRoad(g);
  drawPlanters(g, L);
  drawDog(g, L);
  drawWalkers(g, L);
  drawLeaves(g, L, gust);
  drawWashi(g);
  g.pop();

  grain(g, 0, 0, 1000, 1000, 1171, 16);
  vignette(g, 0, 0, 1000, 1000, 38);
}

// 阵风包络：0.5 / 2.5 / 4.5 三个强拍各来一阵
function gustEnv(local) {
  let e = 0;
  for (const t0 of [0.5, 2.5, 4.5]) {
    const d = (local - t0) / 0.30;
    e += Math.exp(-d * d);
  }
  return clamp01(e);
}

// ------------------------------------------------------------
// 和纸底 + 天空ぼかし
// ------------------------------------------------------------
function drawPaper(g, meta) {
  g.push();
  g.noStroke();
  g.fill(meta.bg || WASHI);
  g.rect(0, 0, 1000, 1000);
  g.pop();
}

function drawSky(g) {
  const ctx = g.drawingContext;
  if (!skyGrad) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, 400);
    skyGrad.addColorStop(0.00, '#a9c6d1');   // ─ 段 1 淡蓝
    skyGrad.addColorStop(0.13, '#a9c6d1');
    skyGrad.addColorStop(0.18, '#8fb4c4');
    skyGrad.addColorStop(0.30, '#7ba9bd');   // ─ 段 2 浅蓝摺
    skyGrad.addColorStop(0.36, '#4a7a96');   // ─ 段 3 靛蓝
    skyGrad.addColorStop(0.48, '#3b6680');
    skyGrad.addColorStop(0.56, '#2f5a72');   // ─ 段 4 深靛
    skyGrad.addColorStop(0.64, '#6f8692');
    skyGrad.addColorStop(0.71, '#a9a68f');   // ─ 过渡
    skyGrad.addColorStop(0.79, '#cdbd97');   // ─ 段 5 地平线暖米黄
    skyGrad.addColorStop(0.89, '#dfd2ae');
    skyGrad.addColorStop(1.00, WASHI);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 1000, 400);
  ctx.fillStyle = skyGrad;
  ctx.fill();
  ctx.restore();

  // 天顶几道极淡的横云（ぼかし的横向痕迹）
  g.push();
  g.noStroke();
  const rnd = mulberry32(4471);
  for (let i = 0; i < 6; i++) {
    const y = 96 + rnd() * 150;
    g.fill(252, 250, 240, 20 + rnd() * 26);
    g.ellipse(120 + rnd() * 760, y, 180 + rnd() * 300, 7 + rnd() * 12);
  }
  g.pop();

  // 空红题框（版画的署名框：留白 + 一笔抽象波纹，不写任何文字）
  ctx.save();
  ctx.fillStyle = 'rgba(176,74,58,0.92)';
  rrFill(g, 84, 108, 152, 62, 3);
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 3.6;
  rrStroke(g, 84, 108, 152, 62, 3);
  ctx.strokeStyle = 'rgba(244,239,224,0.85)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const wx = 104 + u * 112;
    const wy = 139 + Math.sin(u * Math.PI * 2) * 9;
    if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
  }
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------
// 远景：自绘圆锥雪山
// ------------------------------------------------------------
function drawMountain(g, glow) {
  const ctx = g.drawingContext;

  // 套色错位 #1：山体色块整体上移 3 单位，露出下方一道和纸底色
  fillPoly(ctx, MTN, '#5c86a2', 0, -3);
  fillPoly(ctx, MTN_DARK, '#466d88', 0, -3);
  fillPoly(ctx, MTN_SNOW, YUKI, 0, -3);

  // 轮廓：粗黑、折线顿笔
  linePoly(ctx, MTN, SUMI, 4.6);
  linePoly(ctx, MTN_SNOW, SUMI, 3.4);

  // 过框：雪线提亮一次（读作「换了新版」）
  linePoly(ctx, MTN_SNOW, `rgba(255,255,255,${(0.22 + 0.62 * glow).toFixed(3)})`,
    2.2 + 2.6 * glow);
  // 山阴面转折线
  openLine(ctx, MTN_DARK.slice(0, 8), `rgba(33,50,62,0.55)`, 2.2);

  // 山脚雾带：三道横向白带
  const ctxx = ctx;
  for (let i = 0; i < 3; i++) {
    const y = 282 + i * 11;
    const x0 = 652 + i * 14;
    const w = 330 - i * 26;
    ctxx.fillStyle = `rgba(246,242,230,${0.78 - i * 0.16})`;
    rrFill(g, x0, y, w, 13 - i * 2, 6);
  }
}

// ------------------------------------------------------------
// 地面（地平线以下全部土地底色）
// ------------------------------------------------------------
function drawLand(g) {
  const ctx = g.drawingContext;
  // 远处的土坡：地平线略起伏
  const pts = [];
  const rnd = mulberry32(881);
  for (let x = -60; x <= 1060; x += 40) {
    pts.push([x, HORIZON + 2 + Math.sin(x * 0.011) * 3 + (rnd() - 0.5) * 2.2]);
  }
  pts.push([1060, 800], [-60, 800]);
  fillPoly(ctx, pts, '#c8bd95');
  openLine(ctx, pts.slice(0, pts.length - 2), 'rgba(33,50,62,0.45)', 2.4);
}

// ------------------------------------------------------------
// 水田（远侧 / 近侧条带）：垄 + 横向 S 水波 + 秧苗点
// ------------------------------------------------------------
function drawFarRows(g) {
  const ctx = g.drawingContext;
  ctx.save();
  for (let i = 0; i < FAR_ROWS.length; i++) {
    const [bA, bB] = FAR_ROWS[i];
    const poly = rowPoly(bA, bB);
    fillPoly(ctx, poly, FAR_COL[i][0]);
    linePoly(ctx, perspLine(-60, 1060, bA), 'rgba(74,70,52,0.55)', 1.6, 0, 0, false);
    if (FAR_COL[i][0] === WATER || FAR_COL[i][0] === WATER_D) {
      rowS(g, bA, bB, 0.5, 2.4, i * 1.9, 'rgba(38,62,74,0.42)', 1.5, 130);
    } else {
      rowSeedlings(g, bA, bB, 0.62, i, 2.0, 118);
    }
  }
  ctx.restore();
}

function drawNearRows(g, L) {
  const ctx = g.drawingContext;
  ctx.save();
  // 只画到 y=768：再往下由主调度的公路覆盖
  ctx.beginPath();
  ctx.rect(0, 0, 1000, 768);
  ctx.clip();
  for (let i = 0; i < NEAR_ROWS.length; i++) {
    const [bA, bB] = NEAR_ROWS[i];
    const poly = rowPoly(bA, bB);
    fillPoly(ctx, poly, NEAR_COL[i][0]);
    linePoly(ctx, perspLine(-60, 1060, bA), DAICHI, 3.4, 0, 0, false);
    linePoly(ctx, perspLine(-60, 1060, bA), SUMI, 1.6, 0, 2.6, false);
    if (NEAR_COL[i][0] === WATER || NEAR_COL[i][0] === WATER_D) {
      rowS(g, bA, bB, 0.42, 4.2, i * 2.3, 'rgba(33,50,62,0.34)', 2.2, 96);
      rowS(g, bA, bB, 0.70, 3.0, i * 2.3 + 2.1, 'rgba(33,50,62,0.28)', 1.8, 128);
    } else {
      rowSeedlings(g, bA, bB, 0.55, i, 3.4, 86);
      rowSeedlings(g, bA, bB, 0.86, i * 3 + 1, 2.6, 104);
    }
  }
  ctx.restore();
}

// 垄内的横向"S"水波线
function rowS(g, bA, bB, f, amp, phase, col, w, gap) {
  const ctx = g.drawingContext;
  const seg = [];
  let x = -40 + ((Math.abs(phase * 37) | 0) % gap);
  while (x < 1020) {
    const x2 = Math.min(1020, x + gap * 0.72);
    const pts = [];
    for (let xx = x; xx <= x2; xx += 14) {
      const k = 1 - xx / VPX;
      const yA = fPersp(xx, bA), yB = fPersp(xx, bB);
      pts.push([xx, lerp(yA, yB, f) + Math.sin(xx * 0.055 + phase) * amp * (0.4 + k)]);
    }
    if (pts.length > 2) {
      const thin = Math.max(0.8, w * (1 - ((x - (-40)) / VPX) * 0.55));
      openLine(ctx, pts, col, thin);
    }
    seg.push(1);
    x += gap;
  }
}

// 垄内的秧苗点（三根一撮）
function rowSeedlings(g, bA, bB, f, seedIdx, size, gap) {
  const ctx = g.drawingContext;
  let x = -20 + ((seedIdx * 53) % gap);
  while (x < 1020) {
    const k = 1 - x / VPX;
    const yA = fPersp(x, bA), yB = fPersp(x, bB);
    const y = lerp(yA, yB, f);
    const s = size * k;
    if (s > 0.7 && y < 772) {
      ctx.strokeStyle = '#3f5c33';
      ctx.lineWidth = Math.max(0.7, s * 0.30);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - s * 0.7, y - s * 1.5);
      ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.8);
      ctx.moveTo(x, y); ctx.lineTo(x + s * 0.7, y - s * 1.5);
      ctx.stroke();
    }
    x += gap;
  }
}

// ------------------------------------------------------------
// 东海道：斜向遁入纵深的路
// ------------------------------------------------------------
function drawRoad(g) {
  const ctx = g.drawingContext;
  const pts = [];
  for (let x = -60; x <= 1060; x += STEP) pts.push([x, roadFar(x)]);
  for (let x = 1060; x >= -60; x -= STEP) pts.push([x, roadNear(x)]);
  // 套色错位 #2：土色块整体左移 2、上移 3
  fillPoly(ctx, pts, ROAD_F, -2, -3);
  linePoly(ctx, pts, SUMI, 4.6);

  // 两条车辙（同样收向灭点）
  for (const b of [652, 738]) {
    linePoly(ctx, perspLine(-60, 1060, b), 'rgba(140,104,64,0.7)', 2.2, 0, 0, false);
  }
  // 路面上的碎石点（固定种子）
  const rnd = mulberry32(3313);
  for (let i = 0; i < 90; i++) {
    const x = -20 + rnd() * 1040;
    const lat = (rnd() * 2 - 1) * 0.85;
    const y = roadCtr(x) + lat * roadHalf(x) * 0.72;
    if (y > 772) continue;
    const r = (0.8 + rnd() * 1.6) * (1 - x / VPX * 0.6);
    ctx.fillStyle = 'rgba(120,90,58,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r, 0, 0, TAU);
    ctx.fill();
  }
}

// ------------------------------------------------------------
// 两株松树（自绘，树干扭曲 + 三团横向针叶块）
// ------------------------------------------------------------
function drawPines(g, gust) {
  // 风过一次：针叶块整体摆一下再回弹（包络本身就是一次摆动）
  const swayA = 0.07 * gust;
  drawPine(g, 336, fPersp(336, 545), 0.86, 11, swayA, 262, 1);
  drawPine(g, 486, fPersp(486, 508), 0.72, 29, swayA * 0.8, 150, -1);
}

function drawPine(g, bx, by, s, seed, sway, height, leanSign) {
  const ctx = g.drawingContext;
  const H = height * s;
  // 树干：扭曲的两侧边形
  const trunk = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const y = by - u * H * 0.78;
    const x = bx + Math.sin(u * 2.6 + seed) * 9 * s * leanSign + u * u * 7 * s * leanSign;
    const w = (5.6 - 3.4 * u) * s;
    trunk.push([x - w, y]);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N;
    const y = by - u * H * 0.78;
    const x = bx + Math.sin(u * 2.6 + seed) * 9 * s * leanSign + u * u * 7 * s * leanSign;
    const w = (5.6 - 3.4 * u) * s;
    trunk.push([x + w, y]);
  }
  fillPoly(ctx, trunk, '#7b5a3c');
  linePoly(ctx, trunk, SUMI, Math.max(2.4, 3.4 * s));

  // 三层横向针叶块（下宽上窄、左右错开，风过时整体摆一次）
  const cl = [
    { u: 0.40, w: 150, h: 54, dx: -22 },
    { u: 0.72, w: 122, h: 48, dx: 26 },
    { u: 1.00, w: 86, h: 40, dx: -6 },
  ];
  const topX = bx + Math.sin(2.6 + seed) * 9 * s * leanSign + 7 * s * leanSign;
  const topY = by - 0.78 * H;
  g.push();
  g.translate(topX, topY + H * 0.06);
  g.rotate(sway);
  g.translate(-topX, -(topY + H * 0.06));
  for (let i = 0; i < cl.length; i++) {
    const c = cl[i];
    const cx = topX + c.dx * s * leanSign;
    const cy = topY - (c.u - 0.40) * H * 0.62;
    const pts = needleBlob(cx, cy, c.w * s, c.h * s, seed + i * 3.7);
    fillPoly(ctx, pts, i === 2 ? '#5d7d4d' : MIDORI);
    linePoly(ctx, pts, SUMI, Math.max(2.6, 3.6 * s));
    // 团内的短针线
    openLine(ctx, [[cx - c.w * s * 0.3, cy + 3 * s], [cx + c.w * s * 0.3, cy + 3 * s]],
      'rgba(33,50,62,0.35)', Math.max(1.2, 1.8 * s));
  }
  g.pop();
}

// ------------------------------------------------------------
// 近景左下：路边茶馆（茅草顶 + 长凳 + 茶炉 + 抽象圆纹灯笼）
// ------------------------------------------------------------
function drawTeahouse(g, L, gust) {
  const ctx = g.drawingContext;
  // 地面基线：沿透视平行线（b=560，在路的上边之外 → 小店在路的对侧）
  const g0 = (x) => fPersp(x, 560);
  const X0 = 62, X1 = 302;
  const yL = g0(X0), yR = g0(X1);
  const eaveL = yL - 96, eaveR = yR - 96;

  // 土台
  const plat = [[X0 - 6, yL], [X1 + 6, yR], [X1 + 6, yR + 9], [X0 - 6, yL + 9]];
  fillPoly(ctx, plat, '#a8946e');
  linePoly(ctx, plat, SUMI, 3.2);

  // 后柱（先画，被屋顶与前柱压住）
  const posts = [74, 132, 190, 248, 290];
  for (let i = 0; i < posts.length; i++) {
    const px = posts[i];
    const topY = fPersp(px, 560) - 96;
    const botY = g0(px);
    const w = 6.5;
    const p = [[px - w, topY], [px + w, topY], [px + w, botY], [px - w, botY]];
    fillPoly(ctx, p, '#8a6a44');
    linePoly(ctx, p, SUMI, 2.6);
  }

  // ---- 套色错位 #3：茅草屋顶色块右移 3、上移 2 ----
  const roof = [
    [X0 - 22, eaveL + 4], [X1 + 22, eaveR + 4],
    [X1 + 6, eaveR - 30], [X0 - 6, eaveL - 30],
  ];
  // 茅草下缘的锯齿
  const thatch = [[X0 - 22, eaveL + 4]];
  for (let x = X0 - 22; x <= X1 + 22; x += 16) {
    const u = (x - (X0 - 22)) / (X1 + 22 - (X0 - 22));
    const yy = lerp(eaveL, eaveR, u);
    thatch.push([x, yy + 14 + Math.sin(x * 0.45) * 3]);
  }
  thatch.push([X1 + 22, eaveR + 4]);
  fillPoly(ctx, roof, '#c9a866', 3, -2);
  fillPoly(ctx, thatch, '#c9a866', 3, -2);
  linePoly(ctx, roof, SUMI, 4.4, 3, -2);
  linePoly(ctx, thatch, SUMI, 4.0, 3, -2);
  // 屋脊
  openLine(ctx, [[X0 - 6, eaveL - 30], [X1 + 6, eaveR - 30]], SUMI, 4.6);
  // 茅草的横向压条
  for (let i = 1; i <= 3; i++) {
    const dy = -i * 8;
    openLine(ctx, [[X0 - 18, eaveL + dy], [X1 + 18, eaveR + dy]], 'rgba(110,84,50,0.7)', 2.0);
  }

  // 檐下横梁
  const beam = [[X0 - 16, eaveL + 6], [X1 + 16, eaveR + 6], [X1 + 16, eaveR + 13], [X0 - 16, eaveL + 13]];
  fillPoly(ctx, beam, '#8a6a44');
  linePoly(ctx, beam, SUMI, 3.0);

  // ---- 檐下灯笼（抽象圆纹，无文字）----
  const hangX = 258;
  const hangY = fPersp(hangX, 560) - 96 + 8;
  g.push();
  g.translate(hangX, hangY);
  g.rotate(0.30 * gust * Math.sin(L * 9.2));
  g.translate(-hangX, -hangY);
  openLine(ctx, [[hangX, hangY], [hangX, hangY + 12]], SUMI, 3.0);
  const LW = 26, LH = 40;
  const lam = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const a = -Math.PI / 2 + u * Math.PI;
    lam.push([hangX - LW / 2 + Math.cos(a) * 0 + LW * (u), hangY + 12 + Math.sin(a) * 4 + LH * (i > 5 ? 0 : 0)]);
  }
  // 灯笼体：竖向椭圆柱（平涂朱色）
  ctx.beginPath();
  ctx.ellipse(hangX, hangY + 12 + LH / 2, LW / 2, LH / 2, 0, 0, TAU);
  ctx.fillStyle = SHU;
  ctx.fill();
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 3.6;
  ctx.stroke();
  // 上下盖
  for (const dy of [12, 12 + LH]) {
    const cap = [[hangX - 8, hangY + dy - 3], [hangX + 8, hangY + dy - 3],
    [hangX + 8, hangY + dy + 3], [hangX - 8, hangY + dy + 3]];
    fillPoly(ctx, cap, SUMI);
  }
  // 竹骨横线
  for (let i = 1; i < 4; i++) {
    openLine(ctx, [[hangX - LW / 2 + 1, hangY + 12 + i * LH / 4], [hangX + LW / 2 - 1, hangY + 12 + i * LH / 4]],
      'rgba(33,50,62,0.5)', 1.6);
  }
  // 抽象圆纹（不写字）
  ring(ctx, hangX, hangY + 12 + LH / 2, 7.5, WASHI, 2.4);
  disc(ctx, hangX, hangY + 12 + LH / 2, 2.6, WASHI);
  g.pop();

  // ---- 梗：茶馆里探出半个身子也在看（画在长凳后，先画人再画凳）----
  const peek = smooth(1.35, 2.0, L);
  if (peek > 0.01) {
    const px = 196;
    const py = fPersp(px, 560) - 26;          // 长凳面
    const rise = 14 * peek;
    const body = [[px - 15, py + 30], [px + 15, py + 30], [px + 11, py - 4 - rise], [px - 11, py - 4 - rise]];
    fillPoly(ctx, body, AIZURI);
    linePoly(ctx, body, SUMI, 3.2);
    disc(ctx, px + 2, py - 16 - rise, 9.5, HADA);
    ring(ctx, px + 2, py - 16 - rise, 9.5, SUMI, 3.0);
    disc(ctx, px - 3, py - 25 - rise, 5, SUMI);           // 发髻
    openLine(ctx, [[px + 13, py + 2 - rise], [px + 24, py + 14 - rise]], SUMI, 3.2);  // 扶凳的手
  }

  // ---- 长凳 ----
  const benchY0 = (x) => fPersp(x, 560) - 26;
  const bench = [[82, benchY0(82)], [268, benchY0(268)], [268, benchY0(268) + 8], [82, benchY0(82) + 8]];
  fillPoly(ctx, bench, '#a8834f');
  linePoly(ctx, bench, SUMI, 3.2);
  for (const bx of [96, 250]) {
    const by0 = benchY0(bx) + 8, by1 = g0(bx);
    const leg = [[bx - 4, by0], [bx + 4, by0], [bx + 5, by1], [bx - 5, by1]];
    fillPoly(ctx, leg, '#8a6a44');
    linePoly(ctx, leg, SUMI, 2.6);
  }

  // ---- 茶炉 + 壶 + 蒸汽 ----
  const sx = 118;
  const sy = g0(sx);
  const stove = [[sx - 22, sy - 30], [sx + 22, sy - 30], [sx + 18, sy], [sx - 18, sy]];
  fillPoly(ctx, stove, '#6a5140');
  linePoly(ctx, stove, SUMI, 3.4);
  disc(ctx, sx, sy - 34, 15, SUMI_L);
  ring(ctx, sx, sy - 34, 15, SUMI, 3.2);
  // 壶嘴
  openLine(ctx, [[sx + 13, sy - 40], [sx + 24, sy - 46]], SUMI, 3.0);
  // 炉口火光（朱色点缀）
  fillPoly(ctx, [[sx - 10, sy - 6], [sx + 10, sy - 6], [sx + 7, sy - 20], [sx - 7, sy - 20]], SHU);

  // 蒸汽：两缕向上的卷云（压在檐下，不越出屋顶）
  for (let i = 0; i < 2; i++) {
    const ph = Math.floor(L * 8) * 0.35 + i * 1.6;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      pts.push([sx - 12 + i * 24 + Math.sin(u * 4 + ph) * 8 * u, sy - 46 - u * 30]);
    }
    openLine(ctx, pts, 'rgba(252,248,236,0.42)', 3.0 - i * 0.5);
  }
}

// ------------------------------------------------------------
// 路上行人：抬头波（随舱体位置从近到远传递）
// ------------------------------------------------------------
function drawWalkers(g, L) {
  const ctx = g.drawingContext;
  const capX = routeU(L) * 1000;
  const capY = 520 + hoverY(L) * 1.3;

  for (let i = 0; i < WALKERS.length; i++) {
    const w = WALKERS[i];
    // 沿路缓行（速度随透视缩放）
    const drift = w.dir * (local_drift(L, w));
    const x = w.x0 + drift;
    const foot = onRoad(x, w.lat);
    const s = figScale(x) * 0.70;
    // 抬头：舱体经过就有人抬头，走远了慢慢放下（自然形成一道从近到远的波）
    const pass = (capX - (x - 34)) / 90;
    const look = clamp01(smooth(0, 1, pass) * (1 - smooth(4.2, 6.2, capX - x)));
    if (x > -40 && x < 1040 && foot < 776) {
      drawWalker(g, {
        x, foot, s, dir: w.dir, robe: w.robe, sash: w.sash,
        item: w.item, phase: w.ph, look, capX, capY,
        hatLost: (i === 0), L, scale: s,
      });
    }
  }
  // 前排那顶被吹翻的斗笠（单独画，因为已经离开头顶）
  drawLostHat(g, L, WALKERS[0], capX);
}

function local_drift(L, w) {
  // 每段位移量化到 8fps 的小步进（走路是一顿一顿的）
  const step = Math.floor(L * 8) * 0.55;
  return step * (w.ph % 2 === 0 ? 1 : 0.92);
}

// 单个行人（本地坐标：脚在 0，向上为负）
function drawWalker(g, o) {
  const ctx = g.drawingContext;
  const { x, foot, dir, robe, sash, item, phase, look, capX, capY, L } = o;
  const walking = look < 0.45;
  // 两步循环，量化到 8fps
  const gait = walking ? Math.floor(L * 8 + phase) % 2 : 0;
  const swing = walking ? (gait === 0 ? 1 : -1) : 0;

  g.push();
  g.translate(x, foot);
  g.scale(o.s);

  // 影子
  ctx.fillStyle = 'rgba(60,48,34,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 20, 5, 0, 0, TAU);
  ctx.fill();

  // ---- 腿 ----
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const legA = 6 * swing * dir, legB = -6 * swing * dir;
  ctx.beginPath();
  ctx.moveTo(-4, -22); ctx.lineTo(-4 + legA, -2);
  ctx.moveTo(4, -22); ctx.lineTo(4 + legB, -2);
  ctx.stroke();
  ctx.strokeStyle = HADA;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-4, -22); ctx.lineTo(-4 + legA, -2);
  ctx.moveTo(4, -22); ctx.lineTo(4 + legB, -2);
  ctx.stroke();

  // ---- 和服主体（梯形，平涂）----
  const bodyLean = look * 0.10 * Math.sign(capX - x || 1);
  const body = [[-15, -2], [15, -2], [10 + bodyLean * 6, -54], [-10 + bodyLean * 6, -54]];
  fillPoly(ctx, body, robe, bodyLean * 5, 0);
  linePoly(ctx, body, SUMI, 4.4, bodyLean * 5, 0);
  // 衣襟
  openLine(ctx, [[-4 - dir * 2, -54], [-6 - dir * 2, -2]], 'rgba(233,223,200,0.9)', 2.4);
  // 下摆的第二层（套色的深色）
  const hem = [[-15, -2], [15, -2], [13, -12], [-13, -12]];
  fillPoly(ctx, hem, sash);
  linePoly(ctx, hem, SUMI, 2.6);
  // 腰带
  const obi = [[-13, -30], [13, -30], [12, -24], [-12, -24]];
  fillPoly(ctx, obi, sash);
  linePoly(ctx, obi, SUMI, 2.8);

  // ---- 袖子 / 手 ----
  const armAng = look > 0.3 ? -0.5 : 0.15 * swing;
  g.push();
  g.translate(dir * 9, -50);
  g.rotate(dir * armAng);
  const sleeve = [[-6, 0], [6, 0], [8, 22], [-8, 22]];
  fillPoly(ctx, sleeve, robe);
  linePoly(ctx, sleeve, SUMI, 3.2);
  g.pop();

  // ---- 随身物（包袱／拐杖）----
  if (item === 'bundle') {
    const b = [[-dir * 18, -46], [-dir * 30, -46], [-dir * 30, -36], [-dir * 18, -36]];
    fillPoly(ctx, b, OCHRE);
    linePoly(ctx, b, SUMI, 3.0);
  } else if (item === 'staff') {
    openLine(ctx, [[dir * 16, -48], [dir * 19, 2]], SUMI, 3.4);
    openLine(ctx, [[dir * 16, -48], [dir * 19, 2]], '#8a6a44', 1.8);
  }

  // ---- 头 + 斗笠（头与笠是一组，随视线抬起）----
  const neckY = -58;
  const toCap = Math.sign(capX - x || 1);
  const tilt = look * 0.42 * -toCap;
  g.push();
  g.translate(0, neckY);
  g.rotate(tilt);
  // 颈
  ctx.fillStyle = HADA;
  ctx.fillRect(-3, -8, 6, 12);
  // 头
  disc(ctx, 0, -12, 8.4, HADA);
  ring(ctx, 0, -12, 8.4, SUMI, 3.2);
  // 朝舱体的侧脸：一个点 + 一道下颌线
  disc(ctx, toCap * 3.4, -13.5, 1.5, SUMI);
  // 抬头时露出的下巴线（读作"仰视"）
  if (look > 0.3) openLine(ctx, [[toCap * 2, -6], [toCap * 7, -9]], SUMI, 2.0);
  g.pop();

  // 斗笠（单独的圆盘/浅锥）
  if (!(o.hatLost && L > 2.55)) {
    const lift = look * 15;
    const tiltHat = look * 0.62 * -toCap;
    g.push();
    g.translate(-toCap * look * 4, neckY - lift);
    g.rotate(tiltHat);
    const kasa = [[-21, -22], [21, -22], [12, -34], [-12, -34]];
    fillPoly(ctx, kasa, PAPER_D);
    linePoly(ctx, kasa, SUMI, 3.6);
    openLine(ctx, [[-21, -22], [21, -22]], SUMI, 3.0);
    g.pop();
  } else {
    // 斗笠被吹翻后露出头顶的发髻
    disc(ctx, 0, neckY - 20, 4.6, SUMI);
  }

  g.pop();
}

// 被风吹翻的那顶斗笠：飞出 → 落地 → 滚两圈（全程 8fps）
function drawLostHat(g, L, w, capX) {
  if (L < 2.55) return;
  const ctx = g.drawingContext;
  const drift = local_drift(L, w);
  const x0 = w.x0 + drift;
  const foot0 = onRoad(x0, w.lat);
  const s = figScale(x0) * 0.70;
  const headY = foot0 - 66 * s;
  const landX = x0 + 58, landY = onRoad(x0 + 58, w.lat * 0.4) + 2;

  let hx, hy, rot, hidden = false;
  const tf = (L - 2.55) / 0.85;
  if (tf <= 1) {
    // 飞行：抛物线 + 翻转
    const u = clamp01(tf);
    hx = lerp(x0 + 4, landX, u);
    hy = lerp(headY, landY, u) - 72 * Math.sin(Math.PI * u) * s;
    rot = u * TAU * 1.25;
  } else if (L < 2.55 + 0.85 + 1.05) {
    // 滚动两圈
    const u = clamp01((L - 3.40) / 1.05);
    hx = landX + 78 * u * s;
    hy = landY - Math.abs(Math.sin(u * TAU * 2)) * 5 * s;
    rot = Math.PI * 0.5 + u * TAU * 2;
  } else {
    // 停住
    hx = landX + 78 * s;
    hy = landY;
    rot = Math.PI * 0.5;
  }

  g.push();
  g.translate(hx, hy);
  g.scale(s);
  g.rotate(rot);
  const kasa = [[-24, -3], [24, -3], [13, -15], [-13, -15]];
  fillPoly(ctx, kasa, '#f0e8d2');
  linePoly(ctx, kasa, SUMI, 3.6);
  // 滚动时的速度线（读得出它在滚）
  if (L > 3.40 && L < 4.45) {
    openLine(ctx, [[-30, -6], [-38, -2]], 'rgba(33,50,62,0.5)', 2.2);
    openLine(ctx, [[30, -6], [38, -2]], 'rgba(33,50,62,0.5)', 2.2);
  }
  g.pop();
  if (hidden) return;
}

// ------------------------------------------------------------
// 小狗：朝舱体吠（第 5 拍 = local 2.5，8fps 两档嘴）
// ------------------------------------------------------------
function drawDog(g, L) {
  const ctx = g.drawingContext;
  const x = 322;
  const y = roadNear(x) + 26;
  const s = figScale(x) * 0.72;
  const capX = routeU(L) * 1000;
  const face = capX > x ? 1 : -1;

  // 吠：local 2.5 / 4.5 各一次，每次三段
  let bark = 0;
  for (const t0 of [2.5, 4.5]) {
    const d = L - t0;
    if (d >= 0 && d < 0.62) {
      const k = Math.floor(d / 0.125) % 2;          // 8fps 两档
      bark = Math.max(bark, (1 - d / 0.62) * (k === 0 ? 1 : 0.35));
    }
  }
  const open = bark > 0.5;

  g.push();
  g.translate(x, y);
  g.scale(s * face, s);

  // 影子
  ctx.fillStyle = 'rgba(60,48,34,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 24, 5, 0, 0, TAU);
  ctx.fill();

  // 腿
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -12); ctx.lineTo(-13, 0);
  ctx.moveTo(-6, -12); ctx.lineTo(-7, 0);
  ctx.moveTo(8, -12); ctx.lineTo(9, 0);
  ctx.moveTo(14, -12); ctx.lineTo(15, 0);
  ctx.stroke();

  // 身（横向的卵形，平涂赭色）
  fillPoly(ctx, [[-14, -12], [12, -14], [16, -22], [-12, -22]], OCHRE);
  linePoly(ctx, [[-14, -12], [12, -14], [16, -22], [-12, -22]], SUMI, 3.2);
  // 翘起的尾巴
  openLine(ctx, [[-13, -20], [-22, -30], [-19, -38]], SUMI, 3.4);
  openLine(ctx, [[-13, -20], [-22, -30], [-19, -38]], OCHRE, 1.8);

  // 头（朝舱体抬起）
  const lift = 4 * bark;
  g.push();
  g.translate(13, -22 - lift);
  g.rotate(-0.25 - 0.2 * bark);
  fillPoly(ctx, [[-7, -7], [9, -9], [12, 0], [-6, 3]], OCHRE);
  linePoly(ctx, [[-7, -7], [9, -9], [12, 0], [-6, 3]], SUMI, 3.2);
  fillPoly(ctx, [[4, -1], [12, 0], [12, 4], [4, 3]], OCHRE);   // 吻部
  linePoly(ctx, [[4, -1], [12, 0], [12, 4], [4, 3]], SUMI, 2.6);
  disc(ctx, 10.5, 1.6, 1.6, SUMI);                              // 鼻
  disc(ctx, 3, -4, 1.5, SUMI);                                  // 眼
  // 耳朵
  fillPoly(ctx, [[-4, -7], [0, -15], [4, -6]], SUMI);
  if (open) {
    // 张嘴
    fillPoly(ctx, [[6, 2], [13, 1], [12, 8], [6, 7]], SUMI_D);
    // 吠声波纹（一圈极淡的弧）
    ctx.strokeStyle = `rgba(33,50,62,${(0.30 * bark).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 3, 10 + 8 * (1 - bark), -0.9, 0.9);
    ctx.stroke();
  }
  g.pop();
  g.pop();
}

// ------------------------------------------------------------
// 水田里的两个插秧人：直腰看，其中一个手里的秧苗掉进水里
// ------------------------------------------------------------
function drawPlanters(g, L) {
  drawPlanter(g, 566, fPersp(566, 903), 0.78, L, 2.35, true, 1);
  drawPlanter(g, 704, fPersp(704, 1120), 0.66, L, 2.60, false, -1);
}

function drawPlanter(g, x, foot, s, L, tStraight, dropFace, faceDir) {
  const ctx = g.drawingContext;
  const st = smooth(tStraight, tStraight + 0.5, L);   // 0=弯腰 1=直腰
  const capX = routeU(L) * 1000;
  const look = smooth(tStraight + 0.1, tStraight + 0.6, L);

  g.push();
  g.translate(x, foot);
  g.scale(s);

  // 影子
  ctx.fillStyle = 'rgba(40,50,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 22, 6, 0, 0, TAU);
  ctx.fill();

  // 躯干：髋部固定，肩部从"前伸插秧"转到"直立"
  const lean = lerp(0.92, 0.10, st);
  const hip = [0, -24];
  const dir = [Math.sin(lean) * faceDir, -Math.cos(lean)];
  const sh = [hip[0] + dir[0] * 36, hip[1] + dir[1] * 36];
  const perp = [Math.cos(lean) * faceDir, Math.sin(lean)];
  const wH = 11, wS = 8;
  const torso = [
    [hip[0] - perp[0] * wH, hip[1] - perp[1] * wH],
    [hip[0] + perp[0] * wH, hip[1] + perp[1] * wH],
    [sh[0] + perp[0] * wS, sh[1] + perp[1] * wS],
    [sh[0] - perp[0] * wS, sh[1] - perp[1] * wS],
  ];
  // 腿
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -2); ctx.lineTo(hip[0] - 4, hip[1]);
  ctx.moveTo(6, -2); ctx.lineTo(hip[0] + 4, hip[1]);
  ctx.stroke();
  fillPoly(ctx, torso, AIZURI);
  linePoly(ctx, torso, SUMI, 4.0);
  // 腰带（垂直于躯干方向）
  const obiMid = [hip[0] + dir[0] * 12, hip[1] + dir[1] * 12];
  fillPoly(ctx, [
    [obiMid[0] - perp[0] * 9, obiMid[1] - perp[1] * 9],
    [obiMid[0] + perp[0] * 9, obiMid[1] + perp[1] * 9],
    [obiMid[0] + perp[0] * 9 + dir[0] * 7, obiMid[1] + perp[1] * 9 + dir[1] * 7],
    [obiMid[0] - perp[0] * 9 + dir[0] * 7, obiMid[1] - perp[1] * 9 + dir[1] * 7],
  ], SHU);

  // 手：弯腰时伸向前下方水里，直腰时收在身前
  const hand = [
    lerp(faceDir * 42, faceDir * 20, st),
    lerp(-14, -50, st),
  ];
  openLine(ctx, [[sh[0], sh[1]], [hand[0], hand[1]]], SUMI, 3.6);

  // 头（在肩的延长线上）
  const headC = [sh[0] + dir[0] * 11, sh[1] + dir[1] * 11];
  g.push();
  g.translate(headC[0], headC[1]);
  g.rotate(look * 0.25 * (capX > x ? -faceDir : faceDir));
  disc(ctx, 0, 0, 8, HADA);
  ring(ctx, 0, 0, 8, SUMI, 3.0);
  const lift = look * 6;
  const kasa = [[-18, -9 - lift], [18, -9 - lift], [10, -20 - lift], [-10, -20 - lift]];
  fillPoly(ctx, kasa, '#d8c9a0');
  linePoly(ctx, kasa, SUMI, 3.4);
  g.pop();

  // 秧苗（在手的位置；local 3.0 之后脱手落水）
  const tDrop = 3.0;
  const seedPt = [hand[0] + faceDir * 2, hand[1] + 4];
  if (L >= tDrop) {
    const p = clamp01((L - tDrop) / 0.55);
    const fx = seedPt[0] + 12 * p * faceDir;
    const fy = seedPt[1] + (26 - seedPt[1]) * p * p;
    fillPoly(ctx, [[fx - 5, fy - 6], [fx + 5, fy - 6], [fx + 4, fy + 2], [fx - 4, fy + 2]], '#5f8048');
    linePoly(ctx, [[fx - 5, fy - 6], [fx + 5, fy - 6], [fx + 4, fy + 2], [fx - 4, fy + 2]], SUMI, 2.4);
    // 落水水纹
    if (p >= 1) {
      const age = L - tDrop - 0.55;
      const rr2 = (age * 34) % 66 + 8;
      const al = clamp01(1 - age / 1.5);
      ctx.strokeStyle = `rgba(250,247,236,${(0.55 * al).toFixed(3)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(fx, 8, rr2, rr2 * 0.34, 0, 0, TAU);
      ctx.stroke();
    }
  } else {
    fillPoly(ctx, [[seedPt[0] - 5, seedPt[1] - 6], [seedPt[0] + 5, seedPt[1] - 6],
    [seedPt[0] + 4, seedPt[1] + 1], [seedPt[0] - 4, seedPt[1] + 1]], '#5f8048');
    linePoly(ctx, [[seedPt[0] - 5, seedPt[1] - 6], [seedPt[0] + 5, seedPt[1] - 6],
    [seedPt[0] + 4, seedPt[1] + 1], [seedPt[0] - 4, seedPt[1] + 1]], SUMI, 2.4);
  }
  g.pop();
}

// ------------------------------------------------------------
// 路面上的 3 片落叶：强拍的风把它们往前推一格
// ------------------------------------------------------------
function drawLeaves(g, L, gust) {
  const ctx = g.drawingContext;
  const LEAVES = [
    { x0: 196, lat: -0.30, seed: 3, cell: 46 },
    { x0: 452, lat: 0.34, seed: 17, cell: 38 },
    { x0: 668, lat: -0.22, seed: 29, cell: 30 },
  ];
  for (let i = 0; i < LEAVES.length; i++) {
    const lf = LEAVES[i];
    // 每次风过推进一格
    let cells = 0;
    for (let k = 0; k < 3; k++) {
      if (L >= 0.5 + k * 2) cells++;
    }
    const hop = gust * Math.sin(L * 7 + i);
    const x = lf.x0 + cells * lf.cell;
    if (x > 1020) continue;
    const y = onRoad(x, lf.lat) - hop * 5;
    const s = figScale(x) * 0.6;
    g.push();
    g.translate(x, y);
    g.rotate(hop * 0.9 + i);
    g.scale(s);
    const leaf = [[-8, 0], [0, -5], [8, 0], [0, 5]];
    fillPoly(ctx, leaf, i === 1 ? SHU : OCHRE);
    linePoly(ctx, leaf, SUMI, 2.6);
    g.pop();
  }
}

// ------------------------------------------------------------
// 和纸：竖向木纹 + 纤维 + 斑点 + 三道折痕（缓存层）
// ------------------------------------------------------------
function drawWashi(g) {
  if (!washiLayer) washiLayer = buildWashi(g);
  g.push();
  g.image(washiLayer, 0, 0, 1000, 1000);
  g.pop();
}

function buildWashi(g) {
  const pg = g.createGraphics(1000, 1000);
  pg.pixelDensity(1);
  pg.clear();
  const rnd = mulberry32(20433);

  // 竖向木纹（和纸的楮纤维走向）
  pg.noFill();
  for (let i = 0; i < 320; i++) {
    const x = rnd() * 1010 - 5;
    const a = 4 + rnd() * 10;
    pg.stroke(96, 78, 54, a);
    pg.strokeWeight(0.55 + rnd() * 1.5);
    const y0 = -20 - rnd() * 40;
    const len = 780 + rnd() * 320;
    pg.line(x, y0, x + (rnd() - 0.5) * 3.5, y0 + len);
  }
  // 短纤维（斜一点点）
  for (let i = 0; i < 150; i++) {
    const x = rnd() * 1000;
    const y = rnd() * 1000;
    pg.stroke(84, 68, 48, 4 + rnd() * 10);
    pg.strokeWeight(0.5 + rnd() * 0.9);
    pg.line(x, y, x + (rnd() - 0.5) * 4, y + 8 + rnd() * 26);
  }
  // 横向板目（很淡）
  for (let i = 0; i < 26; i++) {
    const y = rnd() * 1000;
    pg.stroke(96, 78, 54, 3 + rnd() * 6);
    pg.strokeWeight(0.6);
    pg.line(0, y, 1000, y + (rnd() - 0.5) * 6);
  }
  // 纸面斑点
  pg.noStroke();
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 1000, y = rnd() * 1000;
    pg.fill(104, 88, 62, 4 + rnd() * 16);
    pg.rect(x, y, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
  }
  // 三处轻微折痕
  pg.noFill();
  const creases = [[212, 0, 262, 1000], [640, 0, 700, 1000], [0, 604, 1000, 640]];
  for (let i = 0; i < creases.length; i++) {
    const [x0, y0, x1, y1] = creases[i];
    pg.stroke(70, 56, 40, 16);
    pg.strokeWeight(1.2);
    pg.beginShape();
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      pg.vertex(lerp(x0, x1, u) + Math.sin(u * 6 + i) * 4, lerp(y0, y1, u) + Math.cos(u * 5 + i) * 3);
    }
    pg.endShape();
  }
  return pg;
}

// ============================================================
// 时空舱：飞越东海道（y ≈ 520 + hover*1.3，尺寸 0.82）
// 木版画版：粗黑轮廓 + 平涂蓝摺；底部四个喷口 = 四朵版画云；后方横向云气带
// ============================================================
export function drawVehicle(g, { x, y, local, t, wave }) {
  const ctx = g.drawingContext;
  const s = 0.82;
  const W = 178 * s, H = 196 * s;
  const baseY = 520 + hoverY(local) * 1.3;
  const topY = baseY - H;

  // 投在路面的悬浮影（说明它飞在东海道上空）
  const shY = Math.min(766, fPersp(Math.max(0, Math.min(1000, x)), 770)) + 4;
  ctx.fillStyle = 'rgba(30,44,56,0.17)';
  ctx.beginPath();
  ctx.ellipse(x, shY, W * 0.52, 9, 0, 0, TAU);
  ctx.fill();

  // 后方的横向云气带（速度越快越长）
  const spd = Math.abs(routeU(Math.min(6, local + 0.02)) - routeU(Math.max(0, local - 0.02))) * 1000 / 0.04;
  const len = Math.max(90, Math.min(250, spd * 0.22));
  for (let i = 0; i < 3; i++) {
    const cy = topY + H * (0.28 + i * 0.25);
    const cw = len * (1 - i * 0.20);
    const cx = x - W * 0.46 - cw * 0.55;
    const pts = cloudPoly(cx, cy, cw, (26 - i * 4) * s, i * 2.3);
    ctx.globalAlpha = 0.95 - i * 0.15;
    fillPoly(ctx, pts, i % 2 ? MIZU : YUKI);
    linePoly(ctx, pts, SUMI, 2.8 * s);
    ctx.globalAlpha = 1;
  }

  // 底部四朵版画云（替代四个悬浮喷口）
  for (let i = 0; i < 4; i++) {
    const jx = x + (i - 1.5) * W * 0.30;
    const jw = (44 - i * 2) * s;
    const pts = cloudPoly(jx, baseY + 4, jw, 20 * s, i * 1.9);
    fillPoly(ctx, pts, YUKI);
    linePoly(ctx, pts, SUMI, 3.2 * s);
    // 卷云的涡
    openLine(ctx, [
      [jx - jw * 0.22, baseY - 2], [jx - jw * 0.06, baseY - 9],
      [jx + jw * 0.10, baseY - 4],
    ], SUMI, 2.0 * s);
  }

  // ---- 舱体：粗黑轮廓 + 平涂蓝摺（套色错位 #4：色块右上各溢出 2.5）----
  const bodyRect = [x - W / 2, topY, W, H];
  ctx.fillStyle = AIZURI;
  rrFill(g, bodyRect[0] + 2.5, bodyRect[1] - 2.5, W, H, 10 * s);
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 5 * s;
  rrStroke(g, bodyRect[0], bodyRect[1], W, H, 10 * s);
  // 平涂的暗面（左侧竖带，零渐变）
  ctx.fillStyle = '#3b6478';
  ctx.beginPath();
  ctx.rect(x - W / 2 + 3 * s, topY + 3 * s, W * 0.16, H - 6 * s);
  ctx.fill();

  // ---- 四坡短檐 ----
  const eaveW = W + 26 * s, eaveH = 22 * s, ridgeW = W * 0.46;
  const eave = [
    [x - eaveW / 2, topY], [x - ridgeW / 2, topY - eaveH],
    [x + ridgeW / 2, topY - eaveH], [x + eaveW / 2, topY],
  ];
  fillPoly(ctx, eave, '#3b6478');
  linePoly(ctx, eave, SUMI, 4.6 * s);
  openLine(ctx, [[x - eaveW / 2, topY], [x + eaveW / 2, topY]], BRASS, 3.2 * s);
  openLine(ctx, [[x, topY - eaveH], [x, topY - eaveH - 12 * s]], SUMI, 4.0 * s);
  // 屋脊鳍
  fillPoly(ctx, [[x - 5 * s, topY - eaveH - 12 * s], [x, topY - eaveH - 22 * s],
  [x + 5 * s, topY - eaveH - 12 * s]], BRASS);
  linePoly(ctx, [[x - 5 * s, topY - eaveH - 12 * s], [x, topY - eaveH - 22 * s],
  [x + 5 * s, topY - eaveH - 12 * s]], SUMI, 2.6 * s);

  // ---- 檐下六角灯笼（内含时间漩涡，8fps）----
  const lampY = topY - (eaveH / s + 30) * s;
  const lampR = 19 * s;
  openLine(ctx, [[x, topY - eaveH], [x, lampY + lampR]], BRASS, 3.4 * s);
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    hex.push([x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR]);
  }
  fillPoly(ctx, hex, '#ffd97a');
  linePoly(ctx, hex, SUMI, 3.6 * s);
  const aa = swirlAngle(Math.floor(t * 8) / 8);
  ring(ctx, x, lampY, lampR * 0.66, 'rgba(176,74,58,0.85)', 2.6 * s, );
  // 漩涡：两道弧
  ctx.strokeStyle = SHU;
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.arc(x, lampY, lampR * 0.62, aa, aa + 2.0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, lampY, lampR * 0.34, aa + Math.PI, aa + Math.PI + 2.0);
  ctx.stroke();

  // ---- 3 列 × 2 行横长窗（窗内平涂淡蓝，黄铜窗框）----
  const padX = 16 * s;
  const wx0 = x - W / 2 + padX;
  const winW = W - padX * 2;
  const winTop = topY + 20 * s;
  const winH = 92 * s;
  const gap = 5 * s;
  const cw = (winW - gap * 2) / 3;
  const ch = (winH - gap) / 2;
  let driverSlot = null;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = wx0 + c * (cw + gap);
      const wy = winTop + r * (ch + gap);
      ctx.fillStyle = MIZU;
      rrFill(g, wx, wy, cw, ch, 3 * s);
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 3.2 * s;
      rrStroke(g, wx, wy, cw, ch, 3 * s);
      // 中挺
      openLine(ctx, [[wx + cw / 2, wy + 2], [wx + cw / 2, wy + ch - 2]], BRASS, 2.0 * s);
      if (r === 0 && c === 1) driverSlot = { wx, wy, cw, ch };
    }
  }

  // 驾驶员（20 版块通用意象：中间上排窗内的小剪影）
  if (driverSlot) {
    const { wx, wy, cw: dw, ch: dh } = driverSlot;
    const cx2 = wx + dw / 2, cy2 = wy + dh * 0.62;
    disc(ctx, cx2, cy2 - 6 * s, 5.6 * s, SUMI_D);
    fillPoly(ctx, [[cx2 - 7 * s, cy2], [cx2 + 7 * s, cy2], [cx2 + 6 * s, cy2 + dh * 0.36], [cx2 - 6 * s, cy2 + dh * 0.36]], SUMI_D);
    const wiggle = wave ? Math.sin(Math.floor(t * 8) / 8 * 14) * 0.5 : 0;
    openLine(ctx, [
      [cx2 + 5 * s, cy2],
      wave ? [cx2 + 12 * s, cy2 - 12 * s + wiggle * 4 * s] : [cx2 + 9 * s, cy2 + 7 * s],
    ], SUMI_D, 3.4 * s);
  }

  // ---- 下半：门板（左三道铜百叶 / 右圆形刻度盘）----
  const doorTop = winTop + winH + 8 * s;
  const doorBot = baseY - 14 * s;
  for (let i = 0; i < 3; i++) {
    const ly = doorTop + 10 * s + i * 11 * s;
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.rect(x - W / 2 + 20 * s, ly, W * 0.28, 4.5 * s);
    ctx.fill();
  }
  const dx = x + W * 0.22, dy = doorTop + (doorBot - doorTop) * 0.46, dr = 14 * s;
  disc(ctx, dx, dy, dr, '#3b6478');
  ring(ctx, dx, dy, dr, BRASS, 2.4 * s);
  const na = swirlAngle(Math.floor(t * 8) / 8) - Math.PI / 2;
  openLine(ctx, [[dx, dy], [dx + Math.cos(na) * dr * 0.62, dy + Math.sin(na) * dr * 0.62]], WASHI, 2.4 * s);
  // 中缝
  openLine(ctx, [[x, doorTop], [x, doorBot]], SUMI_D, 2.4 * s);

  // ---- 宽底座 ----
  ctx.fillStyle = '#3b6478';
  rrFill(g, x - (W / 2 + 7 * s), baseY - 12 * s, W + 14 * s, 12 * s, 3 * s);
  ctx.strokeStyle = SUMI;
  ctx.lineWidth = 3.6 * s;
  rrStroke(g, x - (W / 2 + 7 * s), baseY - 12 * s, W + 14 * s, 12 * s, 3 * s);
  openLine(ctx, [[x - (W / 2 + 7 * s), baseY - 12 * s], [x + (W / 2 + 7 * s), baseY - 12 * s]], BRASS, 2.6 * s);
}

// 版画样式的卷云（先端ковъ的横向云）
function cloudPoly(cx, cy, w, h, seed) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const t = u * Math.PI;
    const bump = Math.pow(Math.sin(t), 0.62);
    const rip = Math.sin(u * Math.PI * 3 + seed) * 0.16 * h * bump;
    pts.push([cx + (u - 0.5) * w, cy - h * 0.55 * bump - rip]);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N;
    const scall = Math.sin(u * Math.PI * 4 + seed * 1.3) * h * 0.10;
    pts.push([cx + (u - 0.5) * w, cy + h * 0.30 * Math.pow(Math.sin(u * Math.PI), 0.7) + scall * Math.sin(u * Math.PI)]);
  }
  return pts;
}
