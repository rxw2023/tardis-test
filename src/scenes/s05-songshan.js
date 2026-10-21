// ============================================================
// s05-songshan.js — 第 5 版块：宋代山水（约 1000，水墨，致敬《溪山行旅图》）
//
// 一句话美术口径：靠"层"和"雾"出纵深，不靠肌理堆砌。
//
//   形：三重山影从前到后叠压——远山（极淡）、中山（淡）、主峰（浓）
//      每重的上缘都是锯齿状的岩脊，内部只是一片干净的墨面渐变
//   笔：笔触只出现在轮廓边上——沿脊线向下的一圈短皴 + 苔点 + 飞白
//   雾：每重山脚下压一条横向雾带，山影从雾里立起来
//   梗：时空舱在巨峰下小到几乎看不见；第 2 小节镜头推近，
//      才在路边找见那个青瓷色小点，旁边一队行旅正抬头看它
//
// 限制：路面带固定占 y 770..940，静态元素全部画在 770 以上
// 性能：整幅山水烘焙成 2400×2400 超采样静态层，逐帧只 drawImage
// ============================================================

import { TAU, smooth, BEAT, routeU } from '../beat/beats.js';
import { mulberry32, catmull, inPoly } from '../kit/kit.js';
import { paperInto, inkStroke, dryLine, blot } from '../kit/ink.js';
import { drawCapsule } from '../rig/capsule.js';

const INK = [24, 23, 21];
const PAPER = [233, 226, 208];
const S = 2.6;
const BASE_Y = 770;

// ---- 主峰脊线（浑厚穹顶，两壁笔直）----
const RIDGE_CTRL = [
  [-60, 500], [24, 462], [86, 420], [140, 368], [180, 306],
  [212, 240], [240, 180], [264, 128], [288, 96],
  [314, 74], [342, 62], [372, 62], [400, 74],
  [426, 92], [452, 116], [476, 148], [500, 184],
  [524, 226], [548, 272], [576, 318], [610, 360], [652, 396],
  [704, 426], [764, 452], [830, 472], [900, 486], [970, 498],
  [1060, 512],
];
const RIDGE = catmull(RIDGE_CTRL, 10);

// ---- 中山脊线（在主峰之后）----
const MID_CTRL = [
  [-60, 430], [40, 396], [110, 340], [160, 300], [196, 322],
  [240, 286], [300, 254], [360, 276], [430, 300],
  [520, 316], [610, 290], [700, 306], [790, 282],
  [870, 300], [950, 322], [1060, 356],
];
const MID = catmull(MID_CTRL, 9);

// ---- 远山脊线 ----
const FAR_CTRL = [
  [-60, 404], [60, 380], [160, 356], [260, 372], [360, 344],
  [470, 360], [580, 338], [690, 356], [800, 336],
  [910, 358], [1010, 344], [1060, 350],
];
const FAR = catmull(FAR_CTRL, 9);

// ---- 前景坡石 ----
const ROCK_L = [[-40, 646], [6, 656], [38, 684], [64, 718], [84, 752], [94, 772], [-40, 772]];
const ROCK_R = [[1040, 636], [996, 650], [964, 682], [940, 720], [924, 754], [918, 772], [1040, 772]];

// ---- 松 ----
const PINES = [
  { x: 20, y: 688, h: 132, lean: -0.20, seed: 21 },
  { x: 62, y: 724, h: 98, lean: 0.12, seed: 37 },
];

// ---- 行旅 ----
const TREKKERS = [
  { x: 316, y: 764, s: 1.06, ride: false },
  { x: 344, y: 767, s: 0.98, ride: true },
  { x: 372, y: 764, s: 0.94, ride: false },
  { x: 396, y: 768, s: 0.86, ride: true },
];

const FOCUS = { x: 430, y: 812 };
let layer = null;

// ------------------------------------------------------------
export function render(g, meta, local) {
  g.image(ensureLayer(g), 0, 0, 1000, 1000);
  drawMistFlow(g, local);
  drawTrekkers(g, local, routeU(local) * 1000);
  drawSpray(g, local);
}

export function camera(local) {
  const push = smooth(1.8, 2.8, local) * (1 - smooth(3.95, 4.7, local));
  return { z: 1 + push * 1.5, fx: FOCUS.x, fy: FOCUS.y };
}

export function drawVehicle(g, { x, y, local, t, wave }) {
  g.push();
  g.noStroke();
  for (let i = 3; i >= 1; i--) {
    g.fill(255, 214, 140, 15 * i);
    g.circle(x, y - 96 * 0.24, 40 * i);
  }
  drawCapsule(g, x, y, 0.24, { t, hoverLocal: local, driverPose: { t, wave } });
  g.pop();
}

// ============================================================
// 静态层
// ============================================================
function ensureLayer(g) {
  if (layer) return layer;
  const pg = g.createGraphics(Math.round(1000 * S), Math.round(1000 * S));
  pg.pixelDensity(1);
  pg.scale(S);

  paperInto(pg, 1000, 1000, { seed: 515, base: PAPER, fiber: 1.2, mottle: 1.3 });

  drawRange(pg, FAR, 0.13, 330, 640, 0.6);
  drawMistBand(pg, 392, 40, 0.55);
  drawRange(pg, MID, 0.26, 250, 720, 0.9);
  drawMistBand(pg, 470, 46, 0.7);
  drawMainPeak(pg);
  drawWaterfall(pg);
  drawMistBand(pg, 646, 60, 0.85);
  drawTreeline(pg);
  drawRocks(pg, ROCK_L, 1);
  drawRocks(pg, ROCK_R, -1);
  for (const p of PINES) drawPine(pg, p);
  drawColophon(pg);

  layer = pg;
  return layer;
}

// 把一条脊线变成锯齿状的山形多边形（小起伏 = 岩脊的破碎感）
function rangePoly(ridge, bottom, seedNum) {
  const rnd = mulberry32(seedNum);
  const pts = [];
  for (let i = 0; i < ridge.length - 1; i++) {
    const [x, y] = ridge[i];
    pts.push([x, y]);
    // 两个小凹口
    pts.push([x + 2.4, y + 3 + rnd() * 3]);
    pts.push([x + 4.6, y - 1 - rnd() * 2.4]);
  }
  pts.push([ridge[ridge.length - 1][0], ridge[ridge.length - 1][1]]);
  return [[-60, bottom], ...pts, [1060, bottom]];
}

function polyPath(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

// 一层山影：竖向渐变填充
function drawRange(pg, ridge, alpha, yTop, yBot) {
  const poly = rangePoly(ridge, 820, Math.round(ridge[0][0] + ridge.length * 7 + alpha * 1000));
  const ctx = pg.drawingContext;
  ctx.save();
  polyPath(ctx, poly);
  const gd = ctx.createLinearGradient(0, yTop, 0, yBot);
  gd.addColorStop(0, `rgba(${INK[0]},${INK[1]},${INK[2]},${alpha})`);
  gd.addColorStop(0.55, `rgba(${INK[0]},${INK[1]},${INK[2]},${alpha * 0.62})`);
  gd.addColorStop(1, `rgba(${INK[0]},${INK[1]},${INK[2]},${alpha * 0.18})`);
  ctx.fillStyle = gd;
  ctx.fill();
  ctx.restore();

  // 沿脊线的轮廓笔：一圈向下的短皴 + 一道细线
  const rnd = mulberry32(Math.round(alpha * 10000) + 7);
  for (let i = 0; i < ridge.length; i += 2) {
    const [x, y] = ridge[i];
    const len = 5 + rnd() * 16;
    dryLine(pg, x, y + 2, x + (rnd() - 0.5) * 4, y + len, {
      rgb: INK, alpha: alpha * 2.2 + rnd() * 0.08,
      weight: 1.0 + rnd() * 1.4, dry: 0.35, seed: 300 + i,
    });
  }
  inkStroke(pg, ridge, {
    rgb: INK, alpha: Math.min(0.75, alpha * 2.6),
    weight: 1.6 + alpha * 5, taper: 0.5, dry: 0.06, wobble: 0.9, seed: 41,
  });
}

// 横向雾带（柔边）
function drawMistBand(pg, y, h, alpha) {
  const rnd = mulberry32(Math.round(y));
  pg.push();
  pg.noStroke();
  for (let i = 0; i < 14; i++) {
    pg.fill(PAPER[0], PAPER[1], PAPER[2], 255 * alpha * (0.25 + rnd() * 0.4));
    pg.ellipse(-60 + rnd() * 1120, y + (rnd() - 0.5) * h * 0.7,
      360 + rnd() * 320, h * (0.3 + rnd() * 0.5));
  }
  pg.pop();
}

// ---- 主峰 ----
function drawMainPeak(pg) {
  const rnd = mulberry32(505050);
  const poly = rangePoly(RIDGE, 820, 4242);

  // 墨面：顶浓，山根入雾
  const ctx = pg.drawingContext;
  ctx.save();
  polyPath(ctx, poly);
  const gd = ctx.createLinearGradient(0, 50, 0, 760);
  gd.addColorStop(0.00, 'rgba(24,23,21,0.58)');
  gd.addColorStop(0.26, 'rgba(24,23,21,0.44)');
  gd.addColorStop(0.56, 'rgba(24,23,21,0.28)');
  gd.addColorStop(0.84, 'rgba(24,23,21,0.14)');
  gd.addColorStop(1.00, 'rgba(24,23,21,0.06)');
  ctx.fillStyle = gd;
  ctx.fill();
  ctx.restore();

  // 侧光：一道横向渐变塑体积（左中受光、右壁压暗），没有硬边
  {
    const c = pg.drawingContext;
    c.save();
    polyPath(c, poly);
    c.clip();
    const gd = c.createLinearGradient(-60, 0, 1060, 0);
    gd.addColorStop(0.00, `rgba(${PAPER[0] + 14},${PAPER[1] + 14},${PAPER[2] + 14},0.06)`);
    gd.addColorStop(0.20, `rgba(${PAPER[0] + 14},${PAPER[1] + 14},${PAPER[2] + 14},0.34)`);
    gd.addColorStop(0.40, `rgba(${PAPER[0] + 14},${PAPER[1] + 14},${PAPER[2] + 14},0.12)`);
    gd.addColorStop(0.60, 'rgba(24,23,21,0.05)');
    gd.addColorStop(0.82, 'rgba(24,23,21,0.14)');
    gd.addColorStop(1.00, 'rgba(24,23,21,0.24)');
    c.fillStyle = gd;
    c.fillRect(-60, 0, 1120, 900);
    c.restore();
  }

  // 局部皴：只点三处，给崖面一点粗糙
  for (const c of [{ x: 300, y: 300, n: 40 }, { x: 470, y: 240, n: 34 }, { x: 600, y: 400, n: 28 }]) {
    for (let i = 0; i < c.n; i++) {
      const x = c.x + (rnd() - 0.5) * 130;
      const y = c.y + (rnd() - 0.5) * 120;
      if (!inPoly(x, y, poly)) continue;
      const len = 5 + rnd() * 12;
      dryLine(pg, x, y, x + (rnd() - 0.5) * 3, y + len, {
        rgb: INK, alpha: 0.12 + rnd() * 0.2,
        weight: 1.2 + rnd() * 1.6, dry: 0.4, seed: 700 + i,
      });
    }
  }

  // 脊线：浓墨主线 + 略偏的辅线
  inkStroke(pg, RIDGE, {
    rgb: INK, alpha: 0.8, weight: 6, taper: 0.46, dry: 0.26, wobble: 1.4, seed: 41,
  });
  const ridge2 = RIDGE.map((p, i) => [p[0] + 3, p[1] + 4 - (i % 5) * 0.5]);
  inkStroke(pg, ridge2, {
    rgb: INK, alpha: 0.26, weight: 2.2, taper: 0.72, dry: 0.58, seed: 43,
  });

  // 苔点
  for (let i = 4; i < RIDGE.length - 4; i += 4) {
    const [x, y] = RIDGE[i];
    const c = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < c; k++) {
      pg.push();
      pg.noStroke();
      pg.fill(INK[0], INK[1], INK[2], 140 + rnd() * 110);
      pg.ellipse(x + (rnd() - 0.5) * 22, y + 2 + rnd() * 13,
        2.8 + rnd() * 3.8, 1.8 + rnd() * 2.6);
      pg.pop();
    }
  }
}

// ---- 瀑布 ----
function drawWaterfall(pg) {
  const cx = 690;
  const pts = [];
  for (let y = 320; y <= 748; y += 16) pts.push([cx + Math.sin(y * 0.026) * 2, y]);
  inkStroke(pg, pts, { rgb: [250, 248, 240], alpha: 0.6, weight: 5, taper: 0.36, dry: 0.16, seed: 12 });
  inkStroke(pg, pts.map(([x, y]) => [x + 2.4, y]), {
    rgb: [252, 250, 243], alpha: 0.32, weight: 2.4, taper: 0.4, dry: 0.3, seed: 15,
  });
  blot(pg, cx, 752, 40, { rgb: [246, 244, 236], alpha: 0.3, layers: 6, seed: 88 });
}

// ---- 暗林剪影 ----
function drawTreeline(pg) {
  const rnd = mulberry32(3131);
  const topY = (x) => 706 + Math.sin(x * 0.0125) * 9 + Math.sin(x * 0.0047 + 2) * 13;

  for (const seg of [[-40, 262], [412, 1050]]) {
    const pts = [];
    for (let x = seg[0]; x <= seg[1]; x += 5) {
      const bump =
        Math.abs(Math.sin(x * 0.31)) * 3.5 +
        Math.abs(Math.sin(x * 0.13 + 1.3)) * 6 +
        Math.abs(Math.sin(x * 0.071 + 0.4)) * 9;
      const dip = Math.min(1, Math.max(0, (x - 262) / 46, (412 - x) / 46));
      pts.push([x, topY(x) - bump * (0.45 + 0.55 * dip) + dip * 6]);
    }
    pg.push();
    pg.noStroke();
    pg.fill(20, 19, 18, 196);
    pg.beginShape();
    for (const p of pts) pg.vertex(p[0], p[1]);
    pg.vertex(seg[1], 800);
    pg.vertex(seg[0], 800);
    pg.endShape(pg.CLOSE);
    pg.pop();
  }

  for (let i = 0; i < 14; i++) {
    const x = -20 + rnd() * 1060;
    if (x > 250 && x < 424) continue;
    const baseY = topY(x) - 4;
    const h = 34 + rnd() * 42;
    const lean = (rnd() - 0.5) * 0.24;
    inkStroke(pg, catmull([
      [x, baseY], [x + lean * h * 0.55, baseY - h * 0.62], [x + lean * h, baseY - h],
    ], 5), {
      rgb: INK, alpha: 0.62 + rnd() * 0.26,
      weight: 2.6 + rnd() * 2.0, taper: 0.62, dry: 0.18, seed: 4000 + i,
    });
    for (let b = 0; b < 4; b++) {
      const u = 0.35 + b * 0.16;
      const bx = x + lean * h * u;
      const by = baseY - h * u;
      const dir = rnd() > 0.5 ? 1 : -1;
      dryLine(pg, bx, by, bx + dir * (4 + rnd() * 7), by + 3 + rnd() * 5, {
        rgb: INK, alpha: 0.4 + rnd() * 0.3,
        weight: 1.6 + rnd() * 1.4, dry: 0.3, seed: 6000 + b,
      });
    }
  }
}

// ---- 前景坡石 ----
function drawRocks(pg, poly, dir) {
  const rnd = mulberry32(dir > 0 ? 991 : 992);
  pg.push();
  pg.noStroke();
  for (let i = 0; i < 3; i++) {
    pg.fill(INK[0], INK[1], INK[2], 54);
    pg.beginShape();
    for (const p of poly) pg.vertex(p[0], p[1]);
    pg.endShape(pg.CLOSE);
  }
  pg.pop();

  for (let gy = 620; gy < 786; gy += 11) {
    for (let gx = -40; gx < 1060; gx += 11) {
      const x = gx + (rnd() - 0.5) * 9;
      const y = gy + (rnd() - 0.5) * 9;
      if (!inPoly(x, y, poly)) continue;
      const a = (dir > 0 ? 0.6 : 2.56) + (rnd() - 0.5) * 0.5;
      const len = 8 + rnd() * 18;
      dryLine(pg, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, {
        rgb: INK, alpha: 0.14 + rnd() * 0.28,
        weight: 1.4 + rnd() * 2.2, dry: 0.38, seed: 1200 + gx,
      });
    }
  }
  inkStroke(pg, catmull(poly.slice(0, 6), 10), {
    rgb: INK, alpha: 0.6, weight: 4.4, taper: 0.45, dry: 0.26, wobble: 1.3, seed: 77,
  });
}

// ---- 松 ----
function drawPine(pg, p) {
  const rnd = mulberry32(p.seed);
  const baseX = p.x, baseY = p.y, H = p.h;
  const topX = baseX + p.lean * H;

  const trunk = catmull([
    [baseX, baseY],
    [baseX + p.lean * H * 0.28 + (rnd() - 0.5) * 8, baseY - H * 0.34],
    [baseX + p.lean * H * 0.62 + (rnd() - 0.5) * 10, baseY - H * 0.66],
    [topX, baseY - H],
  ], 10);
  inkStroke(pg, trunk, { rgb: INK, alpha: 0.8, weight: 5.6, taper: 0.6, dry: 0.14, seed: p.seed });

  for (const b of [
    { at: 0.40, dx: -38, dy: -16 }, { at: 0.56, dx: 44, dy: -18 },
    { at: 0.74, dx: -32, dy: -12 }, { at: 0.90, dx: 28, dy: -10 },
  ]) {
    const i = Math.floor(b.at * (trunk.length - 1));
    const [bx, by] = trunk[i];
    const ex = bx + b.dx, ey = by + b.dy;
    inkStroke(pg, catmull([[bx, by], [(bx + ex) / 2, (by + ey) / 2 - 5], [ex, ey]], 6), {
      rgb: INK, alpha: 0.7, weight: 3, taper: 0.55, dry: 0.22, seed: p.seed + i,
    });
    for (let k = 0; k < 16; k++) {
      const a = (rnd() - 0.5) * 3.0;
      const len = 9 + rnd() * 15;
      dryLine(pg, ex, ey, ex + Math.cos(a) * len, ey + Math.sin(a) * len, {
        rgb: INK, alpha: 0.38 + rnd() * 0.34, weight: 1.0 + rnd() * 1.0, dry: 0.42, seed: 2000 + k,
      });
    }
  }
  for (let k = 0; k < 22; k++) {
    const a = (rnd() - 0.5) * 3.2;
    const len = 10 + rnd() * 17;
    dryLine(pg, topX, baseY - H, topX + Math.cos(a) * len, baseY - H + Math.sin(a) * len, {
      rgb: INK, alpha: 0.38 + rnd() * 0.34, weight: 1.0 + rnd() * 1.0, dry: 0.42, seed: 3000 + k,
    });
  }
}

// ---- 落款 + 印章 ----
function drawColophon(pg) {
  pg.push();
  pg.noStroke();
  pg.fill(INK[0], INK[1], INK[2], 170);
  pg.textAlign(pg.CENTER, pg.CENTER);
  pg.textFont('"KaiTi","STKaiti","SimSun",serif');
  pg.textSize(23);
  const txt = '溪山行旅';
  for (let i = 0; i < txt.length; i++) pg.text(txt[i], 916, 58 + i * 30);
  pg.textSize(14);
  pg.fill(INK[0], INK[1], INK[2], 115);
  pg.text('摹', 916, 58 + txt.length * 30 + 4);
  pg.pop();
  sealLocal(pg, 900, 208, 1.0, '摹');
}

function sealLocal(g, x, y, s, text) {
  const rgb = [172, 50, 40];
  g.push();
  g.noFill();
  g.stroke(rgb[0], rgb[1], rgb[2], 200);
  g.strokeWeight(2.2 * s);
  g.rect(x, y, 32 * s, 32 * s, 2.5 * s);
  g.noStroke();
  g.fill(rgb[0], rgb[1], rgb[2], 215);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(18 * s);
  g.text(text, x + 16 * s, y + 16.5 * s);
  g.pop();
}

// ============================================================
// 动态层
// ============================================================
function drawMistFlow(g, local) {
  g.push();
  g.noStroke();
  for (let i = 0; i < 7; i++) {
    const ph = (local * 0.035 + i * 0.19) % 1;
    g.fill(246, 242, 232, 12);
    g.ellipse(-80 + ph * 1160, 640 + Math.sin(i * 2.1) * 26,
      280 + i * 22, 30 + (i % 3) * 10);
  }
  g.pop();
}

function drawSpray(g, local) {
  const k = 1 - (local / BEAT) % 1;
  g.push();
  g.noStroke();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + local * 0.6;
    g.fill(252, 250, 244, 34 + 34 * k);
    g.circle(690 + Math.cos(a) * (9 + 14 * k) + (i % 3) * 4,
      750 - 5 * k + Math.sin(a) * (4 + 8 * k), 2.2 + (i % 3) * 1.5);
  }
  g.pop();
}

// ---- 行旅 ----
function drawTrekkers(g, local, capX) {
  for (const tk of TREKKERS) {
    const s = tk.s;
    const look = Math.max(-0.55, Math.min(0.55, (capX - tk.x) / 500));
    const bob = Math.sin((local / BEAT) * Math.PI + tk.x * 0.05) * 1.1 * s;

    g.push();
    g.translate(tk.x, tk.y + bob);
    g.scale(s, s);
    g.strokeCap(g.ROUND);

    if (tk.ride) {
      // 驴：横躯干、短颈低首、短耳、驮包
      g.stroke(INK[0], INK[1], INK[2], 230);
      g.strokeWeight(2.4);
      g.line(-10, -11, -12, 0);
      g.line(-4, -11, -3, 0);
      g.line(6, -11, 5, 0);
      g.line(12, -11, 14, 0);
      g.noStroke();
      g.fill(INK[0], INK[1], INK[2], 235);
      g.ellipse(1, -15, 28, 11);
      // 头：低垂前伸
      g.beginShape();
      g.vertex(-12, -17);
      g.vertex(-21, -19 - look * 3);
      g.vertex(-26, -15 - look * 3);
      g.vertex(-15, -13);
      g.endShape(g.CLOSE);
      g.stroke(INK[0], INK[1], INK[2], 235);
      g.strokeWeight(1.8);
      g.line(-15, -18, -14, -23 - look * 3);
      g.line(-18, -18, -18, -22 - look * 3);
      g.line(14, -17, 17, -9);
      // 驮包
      g.noStroke();
      g.fill(INK[0], INK[1], INK[2], 170);
      g.rect(-6, -21, 13, 6, 1.2);
    } else {
      g.stroke(INK[0], INK[1], INK[2], 230);
      g.strokeWeight(2.4);
      g.line(-5, -2, -7, 0);
      g.line(5, -2, 7, 0);
      g.line(0, -21, 0, -3);
      g.noStroke();
      g.fill(INK[0], INK[1], INK[2], 235);
      g.ellipse(0, -22, 15, 11);
      g.ellipse(look * 4, -30 - Math.abs(look) * 1.8, 7, 8);
      g.fill(INK[0], INK[1], INK[2], 215);
      g.beginShape();
      g.vertex(-10.5, -32);
      g.vertex(0, -38.5);
      g.vertex(10.5, -32);
      g.endShape(g.CLOSE);
      g.stroke(INK[0], INK[1], INK[2], 175);
      g.strokeWeight(1.6);
      g.line(-14, -19, 14, -22);
      g.noStroke();
      g.fill(INK[0], INK[1], INK[2], 190);
      g.ellipse(-14, -13, 6.5, 5.6);
      g.ellipse(14, -16, 6.5, 5.6);
    }
    g.pop();
  }
}
