// ============================================================
// s18-vaporwave.js — 第 18 版块：蒸汽波（2010s）
//
// 构图：粉紫青渐变天 + 横条纹落日 + 透视网格地面 + 低多边形棕榈
//       + 前景几何化大理石胸像 + CRT 扫描线 + RGB 色差（全部自绘）
// 梗  ：local 2.0~3.0 磁带跳针 —— 画面卡住循环半拍，盒子照常往前走
//
// 分层：render 画天空/落日/网格/棕榈（地面以上，y<770 为主）
//      drawVehicle 在公路之上补：路面青色高光、前景胸像、舱体与拖影、
//      VHS 噪点带、CRT 扫描线、亮度闪
// ============================================================

import { hoverY, routeU } from '../beat/beats.js';
import { mulberry32 } from '../kit/kit.js';
import { drawCapsule, DEFAULT_CAPSULE } from '../rig/capsule.js';

// ---- 版面常量（单位空间 1000×1000）----
const HZ = 470;                    // 地平线
const VPX = 500;                   // 消失点 x
const SUNX = 500, SUNY = 420, SUNR = 180;
const VL_N = 17;                   // 网格纵向线
const HL_N = 15;                   // 网格横向线
const ROAD_T = 770, ROAD_B = 940;  // 公路带（主调度绘制，本格再叠高光）
const CAP_Y = 620, CAP_S = 0.86;   // 舱体悬浮基准线与缩放

// ---- 调色 ----
function hx(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const C_CYAN = hx('#01cdfe');   // 网格青
const C_NEON = hx('#05ffa1');   // 亮青
const C_MAG = hx('#ff71ce');   // 品红
const C_RED = hx('#ff2a6d');   // 色差红
const C_ORG = hx('#ff9a3c');   // 落日橙
const C_SILH = '#1a0a2a';      // 棕榈剪影近黑紫

// ---- 棕榈：左右各 3 棵（远 → 近）----
const PALMS = [
  { x: 246, y: 656, s: 0.62, ph: 0.4 },
  { x: 160, y: 700, s: 0.80, ph: 1.7 },
  { x: 70, y: 748, s: 1.00, ph: 3.0 },
  { x: 754, y: 656, s: 0.62, ph: 2.2 },
  { x: 840, y: 700, s: 0.80, ph: 0.9 },
  { x: 930, y: 748, s: 1.00, ph: 2.6 },
];

// ---- 胸像轮廓（自绘几何化侧脸，面朝右）----
// 0..12 前额→鼻→唇→颏→颈前（受光边），13..16 肩部，17..21 后脑与颈背
const BUST = [
  [238, 570], [264, 594], [268, 616], [254, 624], [296, 654], [264, 666],
  [278, 676], [260, 682], [276, 690], [264, 706], [242, 718], [252, 728],
  [264, 742], [320, 800], [324, 818], [136, 818], [140, 800],
  [210, 744], [196, 716], [186, 700], [162, 672], [152, 618], [170, 578],
];
const BUST_FRONT = BUST.slice(0, 13);
const PLINTH_CAP = [[132, 818], [328, 818], [334, 836], [126, 836]];
const PLINTH = [[148, 836], [312, 836], [312, 858], [148, 858]];
const HAIR = [[170, 578], [240, 569], [266, 598], [252, 610], [200, 606], [182, 644], [156, 650], [152, 598]];
const HAIR_F = [
  [[170, 578], [240, 569], [200, 606]],
  [[200, 606], [266, 598], [252, 610]],
  [[182, 644], [200, 606], [156, 650]],
];
const FACE_F = [
  [[254, 624], [268, 616], [280, 638], [258, 644]],
  [[258, 644], [280, 638], [264, 666], [240, 660]],
  [[240, 660], [264, 666], [242, 718], [198, 698]],
];

// ============================================================
// 时间：跳针（第 2 小节）
// ============================================================

// 有效时间：2.0~3.0 之间画面卡在半拍里循环
function effTime(local) {
  return (local >= 2.0 && local < 3.0) ? 2.0 + ((local - 2.0) % 0.25) : local;
}
function isJump(local) { return local >= 2.0 && local < 3.0; }

// 画面整体水平位移 ±6（12fps 阶跃）
function shiftX(local) {
  if (!isJump(local)) return 0;
  return (Math.floor(local * 12) % 2 === 0) ? 6 : -6;
}

// 色差偏移：过框加倍到 ±5 再收回
function chromaOff(local) {
  const d = Math.min(local, 6 - local);
  const boost = Math.exp(-Math.pow(d / 0.35, 2));
  return 2.5 * (1 + boost);
}

function clamp01(x) { return Math.min(1, Math.max(0, x)); }

// ============================================================
// 小工具
// ============================================================

// 三层递减 alpha 的同形描边 = 发光（不用 ctx.filter）
function glowLine(g, x1, y1, x2, y2, c, a, w) {
  g.stroke(c[0], c[1], c[2], a * 0.14); g.strokeWeight(w * 3.4); g.line(x1, y1, x2, y2);
  g.stroke(c[0], c[1], c[2], a * 0.32); g.strokeWeight(w * 1.9); g.line(x1, y1, x2, y2);
  g.stroke(c[0], c[1], c[2], a); g.strokeWeight(w); g.line(x1, y1, x2, y2);
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function openPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

// ============================================================
// 落日（横条纹自下而上递减 18/14/11/8/6/4）
// ============================================================
function sunStripes(te) {
  const hs = [18, 14, 11, 8, 6, 4];
  const gp = [14, 13, 12, 11, 10];
  const drift = 3 * Math.sin(te * 0.9);
  const out = [];
  let bot = HZ + drift;
  for (let i = 0; i < 6; i++) {
    const top = bot - hs[i];
    out.push([top, hs[i]]);
    if (i < 5) bot = top - gp[i];
  }
  return out;
}

function drawSun(g, te) {
  const ctx = g.drawingContext;
  // 光晕（径向渐变，非模糊）
  const hg = ctx.createRadialGradient(SUNX, SUNY, SUNR * 0.7, SUNX, SUNY, SUNR * 1.85);
  hg.addColorStop(0, 'rgba(255,154,60,0.30)');
  hg.addColorStop(0.5, 'rgba(255,113,206,0.13)');
  hg.addColorStop(1, 'rgba(255,113,206,0)');
  ctx.save();
  ctx.fillStyle = hg;
  ctx.fillRect(150, 150, 700, 400);
  ctx.restore();

  // 本体
  ctx.save();
  ctx.beginPath();
  ctx.arc(SUNX, SUNY, SUNR, 0, Math.PI * 2);
  ctx.clip();
  const sg = ctx.createLinearGradient(0, SUNY - SUNR, 0, SUNY + SUNR);
  sg.addColorStop(0, '#ffb45a');
  sg.addColorStop(0.45, '#ff9a3c');
  sg.addColorStop(1, '#ff71ce');
  ctx.fillStyle = sg;
  ctx.fillRect(SUNX - SUNR, SUNY - SUNR, SUNR * 2, SUNR * 2);
  // 横黑纹
  ctx.fillStyle = 'rgba(16,6,26,0.93)';
  for (const s of sunStripes(te)) ctx.fillRect(SUNX - SUNR, s[0], SUNR * 2, s[1]);
  ctx.restore();
}

// 色差 ghost：even-odd 挖掉条纹，保证暗纹不被加亮
function drawSunGhost(g, te, dx, c, a) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.translate(dx, 0);
  ctx.beginPath();
  ctx.arc(SUNX, SUNY, SUNR, 0, Math.PI * 2);
  for (const s of sunStripes(te)) ctx.rect(SUNX - SUNR, s[0], SUNR * 2, s[1]);
  ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a / 255})`;
  ctx.fill('evenodd');
  ctx.restore();
}

// ============================================================
// 网格地面
// ============================================================
function drawGroundBase(g) {
  const ctx = g.drawingContext;
  const gg = ctx.createLinearGradient(0, HZ, 0, 1000);
  gg.addColorStop(0, '#2a1440');
  gg.addColorStop(0.32, '#1c0a2e');
  gg.addColorStop(1, '#120620');
  ctx.save();
  ctx.fillStyle = gg;
  ctx.fillRect(0, HZ, 1000, 1000 - HZ);
  ctx.restore();
}

// glow=true 时三层发光，false 时单层（色差 ghost 用）
function drawGridLines(g, te, c, a, dx, glow) {
  g.push();
  g.translate(dx, 0);
  g.noFill();

  // 纵向线：消失点向下发散，17 条
  for (let i = 0; i < VL_N; i++) {
    const xb = VPX + (i - (VL_N - 1) / 2) * 150;
    if (glow) glowLine(g, VPX, HZ, xb, 1000, c, a, 1.5);
    else { g.stroke(c[0], c[1], c[2], a); g.strokeWeight(1.4); g.line(VPX, HZ, xb, 1000); }
  }

  // 横向线：y = 470 + 530*(i/n)^2.4，随时间向前滚动并回卷
  const phase = te * 0.35;
  for (let k = 0; k < HL_N; k++) {
    const u = ((k + phase) % HL_N) / HL_N;
    const y = HZ + 530 * Math.pow(u, 2.4);
    if (y > 1002) continue;
    const fa = a * (0.30 + 0.70 * u);
    const w = 0.8 + 2.0 * u;
    if (glow) glowLine(g, 0, y, 1000, y, c, fa, w);
    else { g.stroke(c[0], c[1], c[2], fa); g.strokeWeight(w); g.line(0, y, 1000, y); }
  }
  g.pop();
}

// ============================================================
// 色差（SCREEN 叠加两遍红/青，用完立刻还原）
// ============================================================
function drawChroma(g, te, off) {
  const ctx = g.drawingContext;
  g.push();
  g.blendMode(g.SCREEN);
  // 落日 ghost 只叠在地平线以上（地平线以下是网格的地盘）
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 1000, HZ);
  ctx.clip();
  drawSunGhost(g, te, -off, C_RED, 0.28 * 255);
  drawSunGhost(g, te, off, C_NEON, 0.28 * 255);
  ctx.restore();
  drawGridLines(g, te, C_RED, 0.28 * 255, -off, false);
  drawGridLines(g, te, C_NEON, 0.28 * 255, off, false);
  g.blendMode(g.BLEND);
  g.pop();
}

// ============================================================
// 地平线亮青发光线（第 1 拍闪一下）
// ============================================================
function drawHorizon(g, local) {
  const fl = Math.exp(-Math.pow((local % 2) / 0.2, 2));
  const a = 200 * (1 + 0.8 * fl);
  glowLine(g, 0, HZ, 1000, HZ, C_NEON, Math.min(255, a), 1.8);
  // 地平线下的一层粉色大气
  const ctx = g.drawingContext;
  const gg = ctx.createLinearGradient(0, HZ, 0, HZ + 150);
  gg.addColorStop(0, `rgba(255,113,206,${0.16 + 0.12 * fl})`);
  gg.addColorStop(1, 'rgba(255,113,206,0)');
  ctx.save();
  ctx.fillStyle = gg;
  ctx.fillRect(0, HZ, 1000, 150);
  ctx.restore();
}

// ============================================================
// 低多边形棕榈（折线干 + 6 片三角叶，近黑紫剪影 + 青色边缘光）
// ============================================================
function drawPalm(g, p, te) {
  const ctx = g.drawingContext;
  const s = p.s;
  const sway = Math.sin(te * 1.1 + p.ph) * 0.05;
  const H = 250 * s;
  const N = 5;
  const spine = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    spine.push([p.x + (26 * s) * u * u + sway * H * u * u * 0.7, p.y - H * u]);
  }
  // 树干（锥形多边形）
  const trunk = [];
  for (let i = 0; i <= N; i++) {
    const w = (13 - 6 * (i / N)) * s;
    trunk.push([spine[i][0] - w, spine[i][1]]);
  }
  for (let i = N; i >= 0; i--) {
    const w = (13 - 6 * (i / N)) * s;
    trunk.push([spine[i][0] + w, spine[i][1]]);
  }

  // 叶：6 片，从树冠扇形张开、叶尖明显下垂
  const C0 = spine[N];
  const leaves = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI + 0.16 + (k / 5) * (Math.PI - 0.36) + sway * 0.9;
    const L = (88 + (k % 2) * 26 + 10 * Math.sin(k * 2.1 + p.ph)) * s;
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx;
    const tip = [C0[0] + dx * L, C0[1] + dy * L + 46 * s];
    leaves.push([
      C0,
      [C0[0] + dx * L * 0.5 + px * 9 * s, C0[1] + dy * L * 0.5 + py * 9 * s],
      [tip[0] + px * 2.5 * s, tip[1] + py * 2.5 * s],
      [tip[0] - px * 2.5 * s, tip[1] - py * 2.5 * s],
      [C0[0] + dx * L * 0.5 - px * 9 * s, C0[1] + dy * L * 0.5 - py * 9 * s],
    ]);
  }

  // 剪影
  ctx.save();
  ctx.fillStyle = C_SILH;
  poly(ctx, trunk); ctx.fill();
  for (const lf of leaves) { poly(ctx, lf); ctx.fill(); }
  // 青色边缘光（两层）
  ctx.strokeStyle = 'rgba(5,255,161,0.22)';
  ctx.lineWidth = 3.2 * s;
  poly(ctx, trunk); ctx.stroke();
  for (const lf of leaves) { poly(ctx, lf); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(5,255,161,0.72)';
  ctx.lineWidth = 1.1 * s;
  poly(ctx, trunk); ctx.stroke();
  for (const lf of leaves) { poly(ctx, lf); ctx.stroke(); }
  ctx.restore();
}

// ============================================================
// 前景大理石胸像（drawVehicle 里画，压在公路之上）
// ============================================================
function drawBust(g, local) {
  const ctx = g.drawingContext;

  // 落在地面上的影子
  ctx.save();
  ctx.fillStyle = 'rgba(18,6,28,0.34)';
  ctx.beginPath();
  ctx.ellipse(244, 864, 164, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 基座：宽檐 + 方座
  const pg = ctx.createLinearGradient(0, 818, 0, 858);
  pg.addColorStop(0, '#cfc2c6');
  pg.addColorStop(0.5, '#a494a4');
  pg.addColorStop(1, '#6f6178');
  ctx.save();
  poly(ctx, PLINTH_CAP); ctx.fillStyle = pg; ctx.fill();
  poly(ctx, PLINTH); ctx.fillStyle = 'rgba(96,82,104,0.9)'; ctx.fill();
  ctx.restore();

  // 本体米白 + 紫调暗部
  ctx.save();
  poly(ctx, BUST);
  const bg = ctx.createLinearGradient(0, 560, 0, 820);
  bg.addColorStop(0, '#f2e8de');
  bg.addColorStop(0.45, '#ddd0c8');
  bg.addColorStop(1, '#8f8098');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();

  // 发/后脑块面
  ctx.fillStyle = 'rgba(104,88,118,0.62)';
  poly(ctx, HAIR); ctx.fill();
  const hairTone = ['rgba(148,130,160,0.6)', 'rgba(104,88,118,0.6)', 'rgba(80,66,94,0.65)'];
  for (let i = 0; i < HAIR_F.length; i++) {
    ctx.fillStyle = hairTone[i];
    poly(ctx, HAIR_F[i]); ctx.fill();
  }

  // 面部低多边形面（额-颧-颌）
  const faceTone = ['rgba(126,104,142,0.30)', 'rgba(126,104,142,0.22)', 'rgba(96,78,116,0.26)'];
  for (let i = 0; i < FACE_F.length; i++) {
    ctx.fillStyle = faceTone[i];
    poly(ctx, FACE_F[i]); ctx.fill();
  }

  // 左侧暗部（背光）
  const sg = ctx.createLinearGradient(140, 0, 320, 0);
  sg.addColorStop(0, 'rgba(58,26,78,0.58)');
  sg.addColorStop(0.55, 'rgba(58,26,78,0.14)');
  sg.addColorStop(1, 'rgba(58,26,78,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(130, 550, 210, 290);

  // 底部来自网格的青色反光
  const cg = ctx.createLinearGradient(0, 730, 0, 818);
  cg.addColorStop(0, 'rgba(5,255,161,0)');
  cg.addColorStop(1, 'rgba(5,255,161,0.34)');
  ctx.fillStyle = cg;
  ctx.fillRect(130, 730, 210, 88);

  // 眼（一条几何短线）
  ctx.strokeStyle = 'rgba(52,38,64,0.55)';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(248, 634); ctx.lineTo(272, 631);
  ctx.stroke();
  // 肩部结构线
  ctx.strokeStyle = 'rgba(72,56,88,0.32)';
  ctx.lineWidth = 2;
  openPoly(ctx, [[148, 788], [320, 784]]); ctx.stroke();
  openPoly(ctx, [[140, 806], [324, 802]]); ctx.stroke();

  // 第 3 拍：面颊反光扫过（0.3s 斜向亮带）
  const sp = (local - 1.0) / 0.3;
  if (sp >= 0 && sp <= 1) {
    const amp = Math.sin(Math.PI * clamp01(sp));
    const cx = 90 + 300 * clamp01(sp);
    ctx.save();
    ctx.translate(cx, 720);
    ctx.rotate(0.55);
    const wg = ctx.createLinearGradient(-30, 0, 30, 0);
    wg.addColorStop(0, 'rgba(255,255,255,0)');
    wg.addColorStop(0.5, `rgba(255,242,226,${0.8 * amp})`);
    wg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(-30, -800, 60, 1600);
    ctx.restore();
  }
  ctx.restore();

  // 右侧（朝落日）的暖色轮廓光
  const rim = C_ORG;
  g.push();
  g.noFill();
  for (let i = 0; i < BUST_FRONT.length - 1; i++) {
    glowLine(g, BUST_FRONT[i][0], BUST_FRONT[i][1], BUST_FRONT[i + 1][0], BUST_FRONT[i + 1][1],
      rim, 150, 1.5);
  }
  // 底边青色反光
  glowLine(g, 132, 818, 328, 818, C_NEON, 120, 1.4);
  g.pop();
}

// ============================================================
// 公路融入：网格之上的青色路面高光（drawVehicle 里画，压在公路之后）
// ============================================================
function drawRoadSheen(g) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, ROAD_T, 1000, ROAD_B - ROAD_T);
  ctx.clip();
  // 网格纵线延续到路面上
  g.push();
  g.noFill();
  g.stroke(C_CYAN[0], C_CYAN[1], C_CYAN[2], 78);
  g.strokeWeight(1.4);
  for (let i = 0; i < VL_N; i++) {
    const xb = VPX + (i - (VL_N - 1) / 2) * 150;
    g.line(VPX, HZ, xb, 1000);
  }
  g.pop();
  const rg = ctx.createLinearGradient(0, ROAD_T, 0, ROAD_B);
  rg.addColorStop(0, 'rgba(5,255,161,0.17)');
  rg.addColorStop(0.5, 'rgba(1,205,254,0.09)');
  rg.addColorStop(1, 'rgba(1,205,254,0.15)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, ROAD_T, 1000, ROAD_B - ROAD_T);
  ctx.restore();
  // 上下边线发光
  glowLine(g, 0, ROAD_T, 1000, ROAD_T, C_NEON, 150, 1.6);
  glowLine(g, 0, ROAD_B, 1000, ROAD_B, C_NEON, 110, 1.4);
}

// ============================================================
// VHS 噪点带（跳针期间）+ 扫描线 + 慢滚亮带 + 接回闪光
// ============================================================
function drawNoiseBand(g, local) {
  if (!isJump(local)) return;
  const ctx = g.drawingContext;
  const seed = Math.floor(local * 12);
  const rnd = mulberry32(seed * 7919 + 13);
  const y0 = 400 + (local - 2.0) * 280;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0, 1000, 60);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  ctx.fillRect(0, y0, 1000, 60);
  for (let i = 0; i < 58; i++) {
    const yy = y0 + rnd() * 58;
    const w = 20 + rnd() * 280;
    const xx = rnd() * 1040 - 40;
    const h = 1 + rnd() * 3.2;
    const k = rnd();
    const a = 0.10 + rnd() * 0.28;
    ctx.fillStyle = k < 0.45
      ? `rgba(255,255,255,${a})`
      : (k < 0.74 ? `rgba(5,255,161,${a})` : `rgba(255,113,206,${a})`);
    ctx.fillRect(xx, yy, w, h);
  }
  // 少量黑色失落
  ctx.fillStyle = 'rgba(8,4,14,0.5)';
  for (let i = 0; i < 10; i++) ctx.fillRect(rnd() * 1000, y0 + rnd() * 58, 30 + rnd() * 160, 1 + rnd() * 2.4);
  ctx.restore();

  // 带上下沿
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillRect(0, y0, 1000, 1.2);
  ctx.fillStyle = 'rgba(255,113,206,0.26)';
  ctx.fillRect(0, y0 + 59, 1000, 1.2);
  ctx.restore();
}

function drawScanlines(g) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.055)';
  for (let y = 0; y < 1000; y += 3) ctx.fillRect(0, y, 1000, 1.3);
  ctx.restore();
}

// 慢滚亮带：周期 4s，第 5 拍（local 2.0）抵达底部
function drawScanBand(g, te) {
  const ctx = g.drawingContext;
  const u = (te / 4 + 0.5) % 1;
  const y = u * 1080 - 40;
  const bg = ctx.createLinearGradient(0, y, 0, y + 40);
  bg.addColorStop(0, 'rgba(255,255,255,0)');
  bg.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  bg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, 1000, 40);
  ctx.restore();
}

function drawFlash(g, local) {
  if (local < 3.0) return;
  const f = Math.exp(-Math.pow((local - 3.0) / 0.15, 2));
  if (f < 0.02) return;
  const ctx = g.drawingContext;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${0.10 * f})`;
  ctx.fillRect(0, 0, 1000, 1000);
  ctx.restore();
}

// ============================================================
// render：天空 / 落日 / 网格 / 色差 / 棕榈 / 地平线
// ============================================================
export function render(g, meta, local) {
  const ctx = g.drawingContext;
  const te = effTime(local);

  g.push();
  g.noStroke();
  g.fill(meta.bg);
  g.rect(0, 0, 1000, 1000);
  g.pop();

  // 跳针时画面整体水平位移
  g.push();
  g.translate(shiftX(local), 0);

  // 天空：深紫 → 紫蓝 → 品红 → 橙粉
  const sg = ctx.createLinearGradient(0, 0, 0, HZ);
  sg.addColorStop(0, '#2a1440');
  sg.addColorStop(0.32, '#6a2f8f');
  sg.addColorStop(0.56, '#b967ff');
  sg.addColorStop(0.80, '#ff71ce');
  sg.addColorStop(1, '#ff9a3c');
  ctx.save();
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, 1000, HZ);
  ctx.restore();

  drawSun(g, te);
  drawGroundBase(g);
  drawGridLines(g, te, C_CYAN, 215, 0, true);
  drawChroma(g, te, chromaOff(local));
  drawHorizon(g, local);

  for (const p of PALMS) drawPalm(g, p, te);

  g.pop();
}

// ============================================================
// drawVehicle：路面高光 / 前景胸像 / 舱体与拖影 / CRT 后期
// ============================================================
export function drawVehicle(g, { x, local, t, wave }) {
  const ctx = g.drawingContext;
  const te = effTime(local);

  g.push();
  g.translate(shiftX(local), 0);

  drawRoadSheen(g);

  // ---- 舱体：悬浮在网格上方，位移用 local（画面卡，盒子照走）----
  const hover = hoverY(te);
  const cy = CAP_Y + hover * 1.8;
  const lift = clamp01((hover * 1.8 + 14) / 30);

  // 粉色拉长投影
  ctx.save();
  ctx.fillStyle = `rgba(255,113,206,${0.25 * (1 - lift * 0.42)})`;
  ctx.beginPath();
  ctx.ellipse(x, 800, 96 * CAP_S * (1 + lift * 0.26), 15 * CAP_S * (1 - lift * 0.16), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 录像带拖影：三个半透明暗色副本，位置取自 te（跳针时与本体脱开）
  const GHOST_CAP = {
    body: '#1fa9b4', bodyDark: '#177f8a', trim: '#8a6d2f',
    lamp: '#b09a5a', glass: '#0a3238',
  };
  const trailA = [0.22, 0.14, 0.08];
  for (let k = trailA.length - 1; k >= 0; k--) {
    const tk = Math.max(0, te - 0.13 * (k + 1));
    const tx = routeU(tk) * 1000;
    const ty = CAP_Y + hoverY(tk) * 1.8;
    ctx.save();
    ctx.globalAlpha = trailA[k] * (0.86 + 0.14 * Math.sin(te * 6 + k));
    drawCapsule(g, tx, ty, CAP_S, { t, capsule: GHOST_CAP, driverPose: null });
    ctx.restore();
  }

  // 本体
  drawCapsule(g, x, cy, CAP_S, { t, driverPose: { t, wave } });

  // 粉/青环境反光（裁剪在机身 + 屋檐内）
  const W = DEFAULT_CAPSULE.w * CAP_S, H = DEFAULT_CAPSULE.h * CAP_S;
  const topY = cy - H;
  const eaveW = (DEFAULT_CAPSULE.w + 26) * CAP_S, eaveH = 22 * CAP_S;
  const ridgeW = DEFAULT_CAPSULE.w * 0.46 * CAP_S;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - W / 2, topY, W, H, 10 * CAP_S);
  ctx.moveTo(x - eaveW / 2, topY);
  ctx.lineTo(x - ridgeW / 2, topY - eaveH);
  ctx.lineTo(x + ridgeW / 2, topY - eaveH);
  ctx.lineTo(x + eaveW / 2, topY);
  ctx.closePath();
  ctx.clip();
  const lr = ctx.createLinearGradient(x - W / 2, 0, x + W / 2, 0);
  lr.addColorStop(0, 'rgba(255,113,206,0.16)');
  lr.addColorStop(0.5, 'rgba(255,113,206,0)');
  lr.addColorStop(1, 'rgba(5,255,161,0.16)');
  ctx.fillStyle = lr;
  ctx.fillRect(x - W, topY - eaveH - 10, W * 2, H + eaveH + 20);
  const bt = ctx.createLinearGradient(0, cy, 0, cy - H * 0.42);
  bt.addColorStop(0, 'rgba(5,255,161,0.20)');
  bt.addColorStop(1, 'rgba(5,255,161,0)');
  ctx.fillStyle = bt;
  ctx.fillRect(x - W, cy - H * 0.42, W * 2, H * 0.42);
  ctx.restore();

  // ---- 前景胸像（压在舱体之前，是"旁观者"）----
  drawBust(g, local);

  g.pop();

  // ---- 全屏后期（不随画面位移）----
  drawNoiseBand(g, local);
  drawScanlines(g);
  drawScanBand(g, te);
  drawFlash(g, local);
}
