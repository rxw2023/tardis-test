// ============================================================
// s10-wayang.js — 第 10 版块：爪哇皮影戏（Wayang Kulit，约 1800）
//
// 美术口径：
//   整幅是一块背光幕布（中心 #ffe0a0 → 边缘 #c07a30 的径向暖光 + 织物横纹）
//   皮影 = 深棕黑实心剪影 + 镂空雕花（挖空处透出 #ffd97a 背光）+ 极细金边
//          + 固定种子的皮革划痕 + 偏移的柔和暗影
//   下沿 y700 一根香蕉木横杆 gawangan，所有皮影靠中杆"插"在横杆上
//   四个自创围观皮影（侧脸尖鼻 / 高冠 / 细长手臂 / 下摆尖角）朝中间看
//   时空舱 = 镂空皮影版：四坡短檐 + 舱身 + 宽底座，内部全镂空，
//           3×2 横窗是六个透亮长方孔，顶部六角灯笼是独立镂空挂件，三根操纵杆可见
//   梗：本格所有运动量化到 8fps（1/8 秒阶跃）—— 漩涡、位移、手臂、飞蛾全部一顿一顿；
//       每小节强拍 dalang 敲 kepyak：幕布提亮一下 + 三根操纵杆抖 2 度再弹回
// 版权：所有角色（含舱体版皮影、4 个围观者、飞蛾）均为本片自创造型，
//       不复制任何真实 wayang 角色；幕布上无文字、无真实标识
// ============================================================

import { TAU, BAR, routeU, hoverY, swirlAngle, smooth } from '../beat/beats.js';
import { mulberry32 } from '../kit/kit.js';

// ---- 调色 ----
const SKIN = '#3a2a14';        // 皮革剪影
const GLOW = '#ffd97a';        // 镂空处透出的背光
const GOLD = '#c9973f';        // 极细金边
const GOLD_D = '#8a5a20';      // 窗棂（压在亮孔里，稍深一点才看得见）
const WOOD = '#4a3418';        // 香蕉木横杆

// ---- 版面几何 ----
const BEAM_Y = 700, BEAM_H = 14, BEAM_B = 714;   // gawangan
const FIG_Y = 674;                               // 围观皮影脚底（悬在横杆上方，靠中杆插住）
const CAP_Y = 656;                               // 舱体皮影底（不含悬浮起伏）
const ROD_B = 716;                               // 操纵杆底端（穿过横杆）

// 四个围观皮影：站在两侧，朝中间看
const CROWD = [
  { x: 118, s: 1.12, flip: 1, seed: 1103 },
  { x: 258, s: 0.97, flip: 1, seed: 2711 },
  { x: 748, s: 1.00, flip: -1, seed: 4231 },
  { x: 884, s: 1.14, flip: -1, seed: 5903 },
];

// ============================================================
// 基础形状工具（全部走原生 ctx：一个 path 里多个子路径，
// 重叠部分只填一次，暗影才不会出现"叠深"的补丁）
// ============================================================

function addPath(ctx, shapes) {
  ctx.beginPath();
  for (const s of shapes) {
    if (s.poly) {
      const p = s.poly;
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
    } else if (s.c) {
      ctx.moveTo(s.c[0] + s.r, s.c[1]);
      ctx.arc(s.c[0], s.c[1], s.r, 0, TAU);
    } else if (s.rr) {
      const r = Math.min(s.rr[4], s.rr[2] * 0.5 - 0.1, s.rr[3] * 0.5 - 0.1);
      ctx.roundRect(s.rr[0], s.rr[1], s.rr[2], s.rr[3], Math.max(0, r));
    }
  }
}

function fillShapes(ctx, shapes, color) {
  addPath(ctx, shapes);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeShapes(ctx, shapes, color, w) {
  addPath(ctx, shapes);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

// 形状整体变换（scale 再平移）
function xf(shapes, s, dx, dy) {
  const out = [];
  for (const sh of shapes) {
    if (sh.poly) out.push({ poly: sh.poly.map((p) => [p[0] * s + dx, p[1] * s + dy]) });
    else if (sh.c) out.push({ c: [sh.c[0] * s + dx, sh.c[1] * s + dy], r: sh.r * s });
    else if (sh.rr) out.push({ rr: [sh.rr[0] * s + dx, sh.rr[1] * s + dy, sh.rr[2] * s, sh.rr[3] * s, sh.rr[4] * s] });
  }
  return out;
}

function bbox(shapes) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const tk = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  for (const s of shapes) {
    if (s.poly) for (const p of s.poly) tk(p[0], p[1]);
    else if (s.c) { tk(s.c[0] - s.r, s.c[1] - s.r); tk(s.c[0] + s.r, s.c[1] + s.r); }
    else if (s.rr) { tk(s.rr[0], s.rr[1]); tk(s.rr[0] + s.rr[2], s.rr[1] + s.rr[3]); }
  }
  return [x0, y0, x1, y1];
}

// 由折线生成一条带宽度的带状多边形（细长手臂 / 操纵杆）
function ribbon(pts, widths) {
  const n = pts.length;
  const left = [], right = [];
  const at = (i) => widths[Math.min(widths.length - 1, Math.max(0, i))];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    const w = at(i) * 0.5;
    left.push([p[0] - dy * w, p[1] + dx * w]);
    right.push([p[0] + dy * w, p[1] - dx * w]);
  }
  return left.concat(right.reverse());
}

function diamond(cx, cy, r) {
  return { poly: [[cx, cy - r], [cx + r * 0.7, cy], [cx, cy + r], [cx - r * 0.7, cy]] };
}

// 卷草螺旋（透光刻线）
function spiralPts(cx, cy, r0, turns, a0, dir) {
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = a0 + dir * u * turns * TAU;
    const r = r0 * (1 - u * 0.80);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// 绕底端旋转一点角度（操纵杆的"抖"）
function tiltTop(pTop, pBot, ang) {
  const dx = pTop[0] - pBot[0], dy = pTop[1] - pBot[1];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return [pBot[0] + dx * ca - dy * sa, pBot[1] + dx * sa + dy * ca];
}

// ============================================================
// 时间：全部量化到 8fps
// ============================================================

// kepyak 敲击包络：每小节强拍 1 下，半小节轻一下，3/4 处点一下
function accentPulse(local) {
  const m = ((local % BAR) + BAR) % BAR;
  const a = Math.exp(-Math.pow(m / 0.30, 2));
  const b = Math.exp(-Math.pow((m - 1.0) / 0.30, 2));
  const c = Math.exp(-Math.pow((m - 1.5) / 0.20, 2));
  return Math.min(1, a + 0.55 * b + 0.28 * c);
}

// ============================================================
// 幕布（只生成一次）
// ============================================================

let backdrop = null;

function ensureBackdrop(g) {
  if (backdrop) return backdrop;
  const pg = g.createGraphics(1000, 1000);
  pg.pixelDensity(1);
  const ctx = pg.drawingContext;
  const rnd = mulberry32(10221030);

  // 背光：中心暖黄 → 边缘赭橙
  const grad = ctx.createRadialGradient(500, 430, 30, 500, 430, 900);
  grad.addColorStop(0.00, '#ffeccb');
  grad.addColorStop(0.26, '#ffe2a4');
  grad.addColorStop(0.55, '#f5c078');
  grad.addColorStop(0.80, '#dd9748');
  grad.addColorStop(1.00, '#c07a30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1000, 1000);

  // 背光热区：幕布后面那盏灯，皮影所在的横带更亮
  const hot = ctx.createRadialGradient(500, 545, 30, 500, 545, 540);
  hot.addColorStop(0.00, 'rgba(255,248,224,0.15)');
  hot.addColorStop(0.55, 'rgba(255,240,205,0.06)');
  hot.addColorStop(1.00, 'rgba(255,236,196,0)');
  ctx.fillStyle = hot;
  ctx.fillRect(0, 0, 1000, 1000);

  // 布面不匀（大块很轻的深浅）
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,238,196,0.020)' : 'rgba(118,70,24,0.020)';
    ctx.beginPath();
    ctx.ellipse(rnd() * 1000, rnd() * 780, 120 + rnd() * 280, 80 + rnd() * 200, rnd() * TAU, 0, TAU);
    ctx.fill();
  }

  // 织物横纹
  for (let y = 2; y < 1000; y += 4) {
    const w = rnd();
    ctx.strokeStyle = `rgba(122,74,26,${(0.035 + w * 0.065).toFixed(3)})`;
    ctx.lineWidth = w > 0.90 ? 1.8 : (w > 0.62 ? 1.0 : 0.8);
    const amp = 1.0 + rnd() * 2.0, ph = rnd() * TAU;
    ctx.beginPath();
    ctx.moveTo(-8, y);
    for (let x = 0; x <= 1010; x += 56) ctx.lineTo(x, y + Math.sin(x * 0.0062 + ph) * amp);
    ctx.stroke();
  }
  // 竖向接缝（两块布拼起来）
  for (const sx of [318, 686]) {
    ctx.strokeStyle = 'rgba(108,64,20,0.045)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + 7, 1000);
    ctx.stroke();
  }

  // 细噪点：打散径向渐变的色带（一次生成 180×180 平铺）
  const nz = g.createGraphics(180, 180);
  nz.pixelDensity(1);
  const nc = nz.drawingContext;
  const id = nc.createImageData(180, 180);
  const nr = mulberry32(778811);
  for (let i = 0; i < 180 * 180; i++) {
    const v = 128 + (nr() - 0.5) * 255;
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  nc.putImageData(id, 0, 0);
  const pat = ctx.createPattern(nz.canvas, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.085;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, 1000, 1000);
  ctx.restore();

  // 下沿暗部 + 一段深色台面（公路会盖在 y770 以下）
  const g2 = ctx.createLinearGradient(0, 700, 0, 1000);
  g2.addColorStop(0.00, 'rgba(48,29,12,0.55)');
  g2.addColorStop(0.30, 'rgba(32,19,8,0.90)');
  g2.addColorStop(1.00, 'rgba(22,13,6,1)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 700, 1000, 300);

  // 香蕉木横杆 gawangan
  ctx.fillStyle = WOOD;
  ctx.fillRect(0, BEAM_Y, 1000, BEAM_H);
  ctx.fillStyle = 'rgba(200,154,76,0.60)';
  ctx.fillRect(0, BEAM_Y, 1000, 3);
  ctx.fillStyle = 'rgba(16,9,4,0.55)';
  ctx.fillRect(0, BEAM_B - 4, 1000, 5);
  for (let i = 0; i < 22; i++) {
    ctx.strokeStyle = `rgba(22,13,6,${(0.10 + rnd() * 0.16).toFixed(3)})`;
    ctx.lineWidth = 0.9 + rnd() * 1.3;
    const yy = BEAM_Y + 2 + rnd() * (BEAM_H - 4);
    ctx.beginPath();
    ctx.moveTo(-6, yy);
    for (let x = 0; x <= 1010; x += 70) ctx.lineTo(x, yy + (rnd() - 0.5) * 1.3);
    ctx.stroke();
  }
  // 横杆投在下沿的暗影
  const g3 = ctx.createLinearGradient(0, BEAM_B, 0, BEAM_B + 92);
  g3.addColorStop(0, 'rgba(16,9,4,0.60)');
  g3.addColorStop(1, 'rgba(16,9,4,0)');
  ctx.fillStyle = g3;
  ctx.fillRect(0, BEAM_B, 1000, 92);

  backdrop = pg;
  return pg;
}

// ============================================================
// 皮影的通用上色流程：柔和暗影 → 实心 → 镂空 → 刻线 → 金边 → 皮革划痕
// ============================================================

function paintPuppet(g, solid, holes, curls, seed, opts = {}) {
  const ctx = g.drawingContext;
  const off = opts.off ?? 8;
  const sa = opts.shadowAlpha ?? 22;
  const nScratch = opts.scratches ?? 16;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 柔和暗影：四层同形低 alpha 递进微位移（不用 ctx.filter）
  for (let k = 0; k < 4; k++) {
    const o = off * (0.45 + 0.40 * k);
    ctx.fillStyle = `rgba(58,40,18,${Math.max(0, (sa - k * 5.4) / 255).toFixed(3)})`;
    fillShapes(ctx, xf(solid, 1, o, o * 0.72));
  }

  // 皮革实心
  fillShapes(ctx, solid, SKIN);

  // 镂空：挖空处直接露出背光的亮黄
  if (holes && holes.length) fillShapes(ctx, holes, GLOW);

  // 卷草刻线（也是透光的）
  if (curls) {
    for (const c of curls) {
      addPath(ctx, [{ poly: c.pts }]);
      ctx.strokeStyle = GLOW;
      ctx.lineWidth = c.w;
      ctx.stroke();
    }
  }

  // 极细金边
  strokeShapes(ctx, solid, 'rgba(201,151,63,0.52)', 1.3);
  if (holes && holes.length) strokeShapes(ctx, holes, 'rgba(201,151,63,0.30)', 0.9);
  if (opts.rimExtra) {
    for (const s of opts.rimExtra) {
      addPath(ctx, [s]);
      ctx.strokeStyle = 'rgba(201,151,63,0.40)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }
  }

  // 皮革质感：上缘受光 + 细密划痕（裁剪在剪影内）
  const bb = bbox(solid);
  ctx.save();
  addPath(ctx, solid);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, bb[1], 0, bb[1] + (bb[3] - bb[1]) * 0.34);
  sheen.addColorStop(0, 'rgba(255,240,208,0.20)');
  sheen.addColorStop(1, 'rgba(255,240,208,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);

  const rnd = mulberry32(seed);
  for (let i = 0; i < nScratch; i++) {
    const x = bb[0] + rnd() * (bb[2] - bb[0]);
    const y = bb[1] + rnd() * (bb[3] - bb[1]);
    const L = 10 + rnd() * 34;
    const a = -0.30 + rnd() * 0.60;
    ctx.strokeStyle = 'rgba(255,242,210,0.11)';
    ctx.lineWidth = 0.8 + rnd() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

// ============================================================
// 自创皮影角色：侧脸尖鼻 / 高冠 / 细长手臂 / 下摆尖角
// 局部坐标：脚底为 (0,0)，向上为负；flip = +1 朝右，-1 朝左
// ============================================================

const ARM_POSES = [
  [ // 档 0：两肘外张，手停在胯边（手臂与身体之间留出一块负形）
    [[17, -158], [35, -138], [41, -116], [36, -98]],
    [[-16, -156], [-31, -134], [-34, -112], [-29, -94]],
  ],
  [ // 档 1：前臂朝中间水平指出去
    [[17, -158], [37, -150], [57, -146], [71, -142]],
    [[-16, -156], [-31, -134], [-34, -112], [-29, -94]],
  ],
  [ // 档 2：前臂上举、后臂外张
    [[17, -158], [37, -150], [48, -168], [50, -186]],
    [[-16, -156], [-32, -132], [-37, -110], [-33, -90]],
  ],
];
const ARM_W = [8.8, 4.4, 3.4, 5.2];

function buildFigure(flip, pose, seed) {
  const P = (x, y) => [x * flip, y];
  const solid = [], holes = [], curls = [];

  // 下摆：外张的纱笼，后摆拖出一条长尖，前面两个小尖角
  solid.push({
    poly: [
      P(-20, -100), P(-31, -62), P(-52, -6),
      P(-30, -22), P(-6, -8),
      P(14, -26), P(36, -8),
      P(30, -60), P(19, -100),
    ],
  });
  // 腰带
  solid.push({ poly: [P(-24, -106), P(24, -106), P(25, -95), P(-25, -95)] });
  // 躯干
  solid.push({
    poly: [
      P(-18, -162), P(0, -166), P(18, -162), P(20, -134), P(16, -112),
      P(21, -105), P(-21, -105), P(-16, -112), P(-20, -134),
    ],
  });
  // 脖子（细，跟头分开看）
  solid.push({ poly: [P(-7, -168), P(6, -168), P(6, -182), P(-7, -182)] });
  // 头：侧脸，长而尖的鼻
  solid.push({
    poly: [
      P(-9, -180), P(-13, -186), P(-15, -196), P(-13, -206), P(-6, -213),
      P(1, -214), P(7, -210), P(9, -204), P(25, -198), P(12, -195),
      P(13, -192), P(10, -189), P(12, -186), P(8, -183), P(5, -179),
    ],
  });
  // 后脑发髻
  solid.push({ c: [-16 * flip, -192], r: 9 });
  // 高冠：圆顶 + 两片小火苗
  solid.push({
    poly: [
      P(-15, -210), P(10, -213), P(15, -224), P(13, -234), P(17, -241),
      P(7, -243), P(9, -251), P(-1, -247), P(-7, -252), P(-12, -241),
      P(-16, -228), P(-17, -218),
    ],
  });

  // 细长手臂
  const arms = ARM_POSES[((pose % 3) + 3) % 3];
  for (const a of arms) {
    const pts = a.map((p) => P(p[0], p[1]));
    const poly = ribbon(pts, ARM_W);
    solid.push({ poly });
    solid.push({ c: [pts[0][0], pts[0][1]], r: 4.6 });   // 肩
    holes.push({ c: [pts[1][0], pts[1][1]], r: 2.2 });
  }

  // ---- 镂空 ----
  for (const x of [-18, 0, 18]) holes.push(diamond(x * flip, -70, 8));
  for (let i = -1; i <= 1; i++) holes.push({ c: [i * 15 * flip, -38], r: 2.8 });
  holes.push(diamond(0, -148, 7.5));
  holes.push(diamond(0, -126, 7.5));
  holes.push({ c: [2 * flip, -203], r: 2.9 });          // 眼
  holes.push({ c: [0, -222], r: 3.4 });
  holes.push({ c: [1 * flip, -236], r: 2.8 });

  // ---- 卷草刻线 ----
  curls.push({ pts: spiralPts(-20 * flip, -46, 8, 1.75, 0.6, flip), w: 2.6 });
  curls.push({ pts: spiralPts(16 * flip, -48, 7, 1.65, 2.2, -flip), w: 2.4 });

  return { solid, holes, curls, seed };
}

function drawFigure(g, fx, fy, s, flip, pose, seed, off, accent) {
  const F = buildFigure(flip, pose, seed);
  const solid = xf(F.solid, s, fx, fy);
  const holes = xf(F.holes, s, fx, fy);
  const curls = F.curls.map((c) => ({
    pts: c.pts.map((p) => [p[0] * s + fx, p[1] * s + fy]),
    w: c.w * s,
  }));

  // 中杆：从脚底插到横木，强拍跟着抖 2 度
  const top = tiltTop([fx, fy + 2], [fx, ROD_B], 0.035 * accent);
  const rodPoly = ribbon([top, [fx, ROD_B]], [4.8, 3.4]);
  solid.push({ poly: rodPoly });

  paintPuppet(g, solid, holes, curls, seed, {
    off,
    shadowAlpha: 23,
    scratches: 15,
    rimExtra: [{ poly: rodPoly }],
  });
}

// ============================================================
// 皮影飞蛾（幕布右下角，8fps 扑棱）
// ============================================================

function mothShapes(flap) {
  const sy = flap ? 1.0 : 0.40;                 // 收翅时纵向压扁
  const sq = (pts) => pts.map((p) => [p[0], p[1] * sy]);
  const wl = sq([[-3, -8], [-15, -24], [-31, -26], [-37, -13], [-27, -2], [-10, 2]]);
  const wr = wl.map((p) => [-p[0], p[1]]);
  const solid = [
    { poly: wl }, { poly: wr },
    { poly: ribbon([[0, 9], [0, -6], [0, -14]], [4.4, 3.6, 3.0]) },   // 身体
    { c: [0, -16], r: 3.6 },                                          // 头
  ];
  // 触角
  solid.push({ poly: ribbon([[-1, -18], [-7, -26], [-13, -30]], [1.7, 1.3, 1.1]) });
  solid.push({ poly: ribbon([[1, -18], [7, -26], [13, -30]], [1.7, 1.3, 1.1]) });

  const holes = [
    diamond(-22, -16 * sy, 4.4),
    diamond(-31, -9 * sy, 3.0),
    diamond(22, -16 * sy, 4.4),
    diamond(31, -9 * sy, 3.0),
  ];
  return { solid, holes };
}

function drawMoth(g, q, step, off) {
  const mt = q - 1.1;
  if (mt <= 0) return;
  const mp = (mt % 2.6) / 2.6;
  const a = smooth(0, 0.10, mp) * (1 - smooth(0.80, 1.0, mp));
  if (a <= 0.02) return;

  const mx = 1018 - mp * 300;
  const my = 505 - mp * 145 + Math.sin(mp * 13) * 15;
  const M = mothShapes(step % 2);
  const s = 1.02;

  const ctx = g.drawingContext;
  ctx.save();
  ctx.globalAlpha = a;
  const ms = xf(M.solid, s, mx, my);
  paintPuppet(g, ms, xf(M.holes, s, mx, my), null, 7717, {
    off: off * 0.6,
    shadowAlpha: 14,
    scratches: 5,
  });
  // 一道金边：飞蛾掠过深色皮影时也不会消失
  strokeShapes(ctx, ms, 'rgba(255,217,122,0.62)', 1.4);
  ctx.restore();
}

// ============================================================
// 顶部三角旗（自创纯几何，无文字，8fps 轻摆）
// ============================================================

function drawFlags(g, q, accent) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.lineJoin = 'round';

  // 挂绳
  ctx.strokeStyle = 'rgba(74,52,24,0.75)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let x = 0; x <= 1000; x += 50) {
    const y = 104 + Math.sin(x * 0.0063) * 6;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const COL = ['#5a3f1c', '#7a5324', '#4a3418', '#6a4720'];
  for (let i = 0; i < 20; i++) {
    const x = 18 + i * 50;
    const y = 104 + Math.sin(x * 0.0063) * 6;
    const sway = Math.sin(q * 1.6 + i * 0.55) * 5 + accent * Math.sin(i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(x + sway, y + 38);
    ctx.closePath();
    ctx.fillStyle = COL[i % 4];
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,151,63,0.55)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // 旗尖小金点
    ctx.beginPath();
    ctx.arc(x + sway, y + 38, 2.4, 0, TAU);
    ctx.fillStyle = GOLD;
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================
// render
// ============================================================

export function render(g, meta, local, index) {
  const q = Math.floor(local * 8) / 8;
  const step = Math.floor(local * 8);
  const accent = accentPulse(local);
  const cross = Math.exp(-Math.pow(Math.min(local, 6 - local) / 0.28, 2));
  const off = 8 * (1 + cross);          // 过框时投影偏移量加倍再收回

  g.push();
  g.noStroke();
  g.image(ensureBackdrop(g), 0, 0);

  // kepyak 敲击 / 过框：幕布整体提亮一下
  const lift = 0.09 * accent + 0.12 * cross;
  if (lift > 0.002) {
    g.fill(255, 238, 196, 255 * Math.min(0.30, lift));
    g.rect(0, 0, 1000, 1000);
  }

  drawFlags(g, q, accent);

  // 四个自创围观皮影（手臂 3 档循环，每 1/8 秒换一档）
  for (let i = 0; i < CROWD.length; i++) {
    const c = CROWD[i];
    drawFigure(g, c.x, FIG_Y, c.s, c.flip, (step + i * 2) % 3, c.seed, off, accent);
  }

  // 幕布右下角的皮影飞蛾
  drawMoth(g, q, step, off);

  g.pop();
}

// ============================================================
// drawVehicle — 镂空皮影版时空舱
// 外形同构（四坡短檐 + 舱身 + 宽底座 + 六角灯笼 + 3×2 横窗），
// 内部全部镂空雕花；三根操纵杆从舱底伸到横木
// ============================================================

// 注意：传进来的 x / y 是主调度的连续量，这里刻意不用 ——
// x 由 routeU(q) 重算（8fps 阶跃），y 换成"插在横木上方"的皮影底 CAP_Y
export function drawVehicle(g, { local, t, wave }) {
  const q = Math.floor(local * 8) / 8;
  const step = Math.floor(local * 8);
  const accent = accentPulse(local);
  const cross = Math.exp(-Math.pow(Math.min(local, 6 - local) / 0.28, 2));
  const off = 8 * (1 + cross);

  const cx = routeU(q) * 1000;          // 位移也按 8fps 阶跃
  const baseY = CAP_Y + hoverY(q);
  const W = 178, H = 196;
  const topY = baseY - H;

  const solid = [], holes = [], curls = [], rimExtra = [];

  // ---- 三根操纵杆（底部握在横木处，强拍抖 2 度再弹回）----
  const ang = 0.035 * accent;
  const rodTop = [[cx - 56, baseY - 6], [cx, baseY], [cx + 56, baseY - 6]];
  const rodBot = [[cx - 48, ROD_B], [cx + 2, ROD_B + 2], [cx + 52, ROD_B]];
  for (let i = 0; i < 3; i++) {
    const tp = tiltTop(rodTop[i], rodBot[i], ang);
    const poly = ribbon([tp, rodBot[i]], [4.6, 3.2]);
    solid.push({ poly });
    rimExtra.push({ poly });
  }

  // ---- 宽底座（下缘做成皮影的尖角摆）----
  solid.push({
    poly: [
      [cx - 96, baseY - 14], [cx + 96, baseY - 14], [cx + 96, baseY - 6],
      [cx + 70, baseY + 8], [cx + 44, baseY - 6], [cx + 18, baseY + 9],
      [cx - 18, baseY + 9], [cx - 44, baseY - 6], [cx - 70, baseY + 8],
      [cx - 96, baseY - 6],
    ],
  });
  holes.push({ c: [cx - 56, baseY - 2], r: 5 });
  holes.push({ c: [cx, baseY - 2], r: 5.5 });
  holes.push({ c: [cx + 56, baseY - 2], r: 5 });

  // ---- 舱身 ----
  solid.push({ rr: [cx - W / 2, topY, W, H, 10] });
  // ---- 四坡短檐 ----
  solid.push({
    poly: [[cx - 102, topY], [cx - 41, topY - 22], [cx + 41, topY - 22], [cx + 102, topY]],
  });
  // 屋面镂空
  holes.push(diamond(cx - 58, topY - 8, 5));
  holes.push(diamond(cx + 58, topY - 8, 5));
  holes.push(diamond(cx - 82, topY - 4, 3.4));
  holes.push(diamond(cx + 82, topY - 4, 3.4));
  // 檐口锯齿镂空
  for (const s of [[-84, -6], [-66, -11], [66, -11], [84, -6]]) {
    holes.push({
      poly: [[cx + s[0] - 5, topY + s[1] + 4], [cx + s[0] + 5, topY + s[1] + 4], [cx + s[0], topY + s[1] - 4]],
    });
  }

  // ---- 屋脊小鳍 + 灯笼吊杆 ----
  solid.push({ rr: [cx - 3, topY - 38, 6, 20, 2] });
  const lampY = topY - 72, lampR = 19;
  const lampRod = ribbon([[cx, topY - 36], [cx, lampY + lampR - 2]], [4.2, 3.0]);
  solid.push({ poly: lampRod });
  rimExtra.push({ poly: lampRod });

  // ---- 顶部六角镂空挂件 ----
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    hex.push([cx + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR]);
  }
  solid.push({ poly: hex });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2 + Math.PI / 6;
    holes.push({ c: [cx + Math.cos(a) * 11.5, lampY + Math.sin(a) * 11.5], r: 3.7 });
  }
  holes.push(diamond(cx, lampY, 5));

  // ---- 3×2 横窗：六个透亮长方孔 ----
  const padX = 20;
  const winX0 = cx - W / 2 + padX;
  const winW = W - padX * 2;
  const winTop = topY + 20;
  const winH = 92, gap = 6;
  const cw = (winW - gap * 2) / 3;
  const ch = (winH - gap) / 2;
  const windows = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = winX0 + c * (cw + gap);
      const wy = winTop + r * (ch + gap);
      windows.push({ rr: [wx, wy, cw, ch, 3] });
    }
  }
  for (const w of windows) holes.push(w);

  // ---- 门板区：锯齿边 + 菱形网格 + 圆点 + 卷草 ----
  for (let i = 0; i < 11; i++) {
    const px = cx - 66 + i * 13.2;
    holes.push({ poly: [[px - 4.6, topY + 116], [px + 4.6, topY + 116], [px, topY + 125]] });
  }
  for (const xx of [-55, -33, -11, 11, 33, 55]) holes.push(diamond(cx + xx, topY + 142, 6.2));
  for (const xx of [-46, -23, 0, 23, 46]) holes.push({ c: [cx + xx, topY + 162], r: 3.4 });
  curls.push({ pts: spiralPts(cx - 70, topY + 160, 8, 1.7, 0.4, 1), w: 2.6 });
  curls.push({ pts: spiralPts(cx + 70, topY + 160, 8, 1.7, 0.4, -1), w: 2.6 });

  // ---- 侧边立边：菱形孔与圆孔交替 ----
  const sideYs = [topY + 38, topY + 60, topY + 82, topY + 104, topY + 126, topY + 148];
  for (let i = 0; i < sideYs.length; i++) {
    for (const sx of [-80, 80]) {
      if (i % 2 === 0) holes.push(diamond(cx + sx, sideYs[i], 5.4));
      else holes.push({ c: [cx + sx, sideYs[i]], r: 3.0 });
    }
  }
  curls.push({ pts: spiralPts(cx - 80, topY + 168, 5.5, 1.7, 0.4, 1), w: 2.2 });
  curls.push({ pts: spiralPts(cx + 80, topY + 168, 5.5, 1.7, 0.4, -1), w: 2.2 });

  // ---- 上色 ----
  const ctx = g.drawingContext;
  paintPuppet(g, solid, holes, curls, 3313, {
    off,
    shadowAlpha: 30,
    scratches: 24,
    rimExtra,
  });

  // ---- 檐口黄铜线 + 窗下横线 ----
  ctx.save();
  ctx.strokeStyle = 'rgba(201,151,63,0.85)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - 102, topY);
  ctx.lineTo(cx + 102, topY);
  ctx.stroke();
  // 六窗外面的细金框
  ctx.strokeStyle = 'rgba(201,151,63,0.42)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(cx - 74, topY + 15, 148, 102);
  ctx.strokeStyle = 'rgba(201,151,63,0.38)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - 74, topY + 14);
  ctx.lineTo(cx + 74, topY + 14);
  ctx.stroke();

  // ---- 六个窗孔里加一团更亮的灯芯：镂空处是"透光"，不是"涂黄" ----
  for (const w of windows) {
    ctx.save();
    addPath(ctx, [{ rr: w.rr }]);
    ctx.clip();
    const wx = w.rr[0] + w.rr[2] / 2, wy = w.rr[1] + w.rr[3] / 2;
    const lg = ctx.createRadialGradient(wx, wy, 2, wx, wy, w.rr[2] * 0.82);
    lg.addColorStop(0.00, 'rgba(255,253,236,0.88)');
    lg.addColorStop(0.55, 'rgba(255,242,196,0.38)');
    lg.addColorStop(1.00, 'rgba(255,217,122,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(w.rr[0], w.rr[1], w.rr[2], w.rr[3]);
    ctx.restore();
  }

  // ---- 窗棂：每个亮孔里一道细金线 ----
  ctx.strokeStyle = GOLD_D;
  ctx.lineWidth = 2;
  for (const w of windows) {
    const my = w.rr[1] + w.rr[3] * 0.20;
    ctx.beginPath();
    ctx.moveTo(w.rr[0] + 2, my);
    ctx.lineTo(w.rr[0] + w.rr[2] - 2, my);
    ctx.stroke();
  }

  // ---- 灯笼里的时间漩涡（每 1/8 秒跳一格）----
  const a0 = swirlAngle(Math.floor(t * 8) / 8);
  ctx.strokeStyle = GLOW;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(cx, lampY, 15, a0, a0 + 2.0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, lampY, 8, a0 + Math.PI, a0 + Math.PI + 2.0);
  ctx.stroke();

  // ---- 驾驶员：中间上排孔里的侧脸小人（尖鼻、高冠）----
  const dw = windows[1];
  drawMiniDriver(g, dw.rr[0] + dw.rr[2] / 2, dw.rr[1] + dw.rr[3] - 2, 0.66, wave, step);

  ctx.restore();
}

// 窗孔里的驾驶员剪影（自创，侧脸尖鼻 + 高冠）
function drawMiniDriver(g, cx, by, s, wave, step) {
  const shapes = [
    // 高冠
    { poly: [[-8, -24], [6, -26], [10, -38], [2, -44], [-7, -38], [-9, -30]] },
    // 头（尖鼻）
    { poly: [[-6, -22], [-7, -30], [-3, -35], [3, -35], [6, -31], [12, -28], [5, -26], [6, -23], [3, -20], [-4, -20]] },
    // 肩身
    { poly: [[-9, -19], [9, -19], [12, -6], [0, -2], [-12, -6]] },
  ];
  const arm = wave
    ? ribbon([[7, -17], [16, -23], [22, -31 + (step % 2 ? -3 : 3)]], [4, 3, 2.4])
    : ribbon([[7, -17], [13, -11], [15, -4]], [4, 3, 2.4]);
  shapes.push({ poly: arm });

  const S = xf(shapes, s, cx, by);
  const ctx = g.drawingContext;
  fillShapes(ctx, S, SKIN);
  strokeShapes(ctx, S, 'rgba(201,151,63,0.8)', 1.1);
}
