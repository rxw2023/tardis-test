// ============================================================
// s04-tangline.js — 第 04 版块：唐代白描（约 750，"吴带当风"）
//
// 美术口径：全幅只有三样东西——宣纸、墨、一枚朱印。
//   纸：base #efe6d3，纤维拉到 1.2，画面 60% 以上是空白纸
//   线：一条飘带 = 主线 + 两条伴线（夹出"带宽"），波峰每拍前移半个波长
//   舱：纯线稿——只勾外形，内部全空（露出纸色），线宽 1.2~2.0
//   梗：飘带太长 → 卷走右下角那株小树的树冠；最上面一条缠住右上印章的系绳
//
// 版面限制：路面带 y 770..940 由主调度在场景之后盖上去（沥青是黑的），
//           所以所有静态笔墨都住在 y < 770；舱体下半截靠"把纸色补回来"才看得见。
//
// 三条硬规则：paper 走缓存；随机数一律 mulberry32(seed)；采样点数恒定（保证飞白序列稳定）。
// ============================================================

import { TAU, BEAT, swirlAngle, routeU, hoverY, smooth } from '../beat/beats.js';
import { mulberry32, lerp, catmull } from '../kit/kit.js';
import { paper, inkStroke, dryLine, seal, highlight } from '../kit/ink.js';

// ---- 只有三种颜色 ----
const INK = [28, 26, 23];              // 浓墨 #1c1a17
const RED = [176, 52, 42];             // 朱印 #b0342a
const PAPER_OPT = { seed: 404, base: [239, 230, 211], fiber: 1.2, mottle: 0.6, scale: 2 };
const ZH = '"KaiTi","STKaiti","SimSun",serif';

const RIDE_Y = 890;
const ROAD_TOP = 770;
const N_PT = 80;                       // 飘带采样数：必须恒定，否则 dry 的随机序列逐帧乱跳

// ---- 舱体线稿尺寸（与 rig/capsule.js 的 DEFAULT_CAPSULE 对齐）----
const CW = 178, CH = 196;
const EAVE_W = 204, EAVE_H = 22, RIDGE_W = 82;
const LAMP_R = 19, LAMP_DY = 52;
const BASE_W = 192, BASE_H = 12;

// ---- 固定布置 ----
const TREE = { x: 884, y: 768 };
const SEALU = { x: 896, y: 110, s: 1.55, ch: '風' };
const COLOPHON = { x: 152, y: 154, size: 22, gap: 31, dx: 44 };
const VERSE = ['风起于青萍之末', '浪成于微澜之间'];   // 自撰中性句，右起竖排
const SIGN = '白描一帧';

// ============================================================
// 主入口
// ============================================================
export function render(g, meta, local) {
  g.image(paper(g, PAPER_OPT), 0, 0, 1000, 1000);

  // 留白处补一点光，避免大片纸面发死
  highlight(g, 60, 200, 560, 480, 0.20);
  highlight(g, 330, 330, 620, 440, 0.13);

  const gust = gustOf(local);
  const bump = lineBump(local);
  const cx = routeU(local) * 1000;

  drawWindLines(g, local, gust, bump);
  drawTreeUnit(g, local, gust, bump);
  drawColophon(g);
  drawSealUnit(g, local, gust, bump);
  drawTrailRibbons(g, cx, local, gust, bump);
}

// 本版块自己的时空舱：纯线稿（外壳烘焙成一张静态层，逐帧只贴图）
export function drawVehicle(g, { x, y, local, t, wave }) {
  const P = poseOf(x, local);
  g.image(ensureShell(g), P.cx - SHELL_PAD_L, P.topY - SHELL_PAD_T, SHELL_W, SHELL_H);
  drawSwirl(g, P, t);                     // 灯内漩涡 + 刻度盘指针（随全局时间转）
  drawDriverLines(g, P, t, wave, lineBump(local));
}

// ---- 烘焙：纸色补底 + 舱体全部静态墨线，只做一次 ----
const SHELL_PAD_L = 112, SHELL_PAD_T = 84, SHELL_W = 224, SHELL_H = 292;
let shellLayer = null;

function ensureShell(g) {
  if (shellLayer) return shellLayer;
  const pg = g.createGraphics(SHELL_W * 2, SHELL_H * 2);
  pg.pixelDensity(1);
  pg.scale(2);
  pg.translate(SHELL_PAD_L, SHELL_PAD_T);

  const P = { cx: 0, topY: 0, baseY: CH, lampY: -LAMP_DY };

  // 公路压在场景之上；舱体下半截会掉进黑色沥青里，
  // 这里把舱体轮廓内的纸色补回来（内部全空 = 露出纸色）。
  const ctx = pg.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(P.cx - BASE_W / 2, P.baseY - BASE_H, BASE_W, BASE_H, 3);
  ctx.roundRect(P.cx - CW / 2, P.topY, CW, CH, 10);
  ctx.moveTo(P.cx - EAVE_W / 2, P.topY);
  ctx.lineTo(P.cx - RIDGE_W / 2, P.topY - EAVE_H);
  ctx.lineTo(P.cx + RIDGE_W / 2, P.topY - EAVE_H);
  ctx.lineTo(P.cx + EAVE_W / 2, P.topY);
  ctx.closePath();
  ctx.rect(P.cx - 3, P.topY - 38, 6, 18);
  const hx = hexPts(P.cx, P.lampY, LAMP_R);
  ctx.moveTo(hx[0][0], hx[0][1]);
  for (let i = 1; i < hx.length; i++) ctx.lineTo(hx[i][0], hx[i][1]);
  ctx.closePath();
  ctx.clip();
  pg.image(paper(g, PAPER_OPT), -SHELL_PAD_L, -SHELL_PAD_T, 1000, 1000);
  ctx.restore();

  drawShellLines(pg, P);
  shellLayer = pg;
  return shellLayer;
}

function drawShellLines(g, P) {
  const { cx, baseY, topY, lampY } = P;

  // 宽底座
  ink(g, rrectPts(cx - 96, baseY - 12, 192, 12, 3), 1.7, 0.8, 101);
  ink(g, [[cx - 92, baseY - 9], [cx + 92, baseY - 9]], 1.1, 0.4, 102, { taper: 0.6, dry: 0.2 });

  // 舱体外形
  ink(g, rrectPts(cx - 89, topY, 178, 196, 10, 5), 2.0, 0.9, 103);

  // 四坡短檐
  ink(g, [
    [cx - 102, topY], [cx - 41, topY - 22], [cx + 41, topY - 22], [cx + 102, topY],
  ], 1.9, 0.88, 104);
  ink(g, [[cx - 104, topY + 4], [cx, topY + 5], [cx + 104, topY + 4]],
    1.2, 0.42, 105, { taper: 0.7, dry: 0.24 });

  // 屋脊小鳍 + 吊杆
  ink(g, [[cx, topY - 22], [cx + 1.5, topY - 36]], 1.3, 0.7, 106);
  ink(g, [[cx - 2.5, topY - 38], [cx - 2.5, topY - 23]], 1.1, 0.6, 107);
  ink(g, [[cx + 2.5, topY - 38], [cx + 2.5, topY - 23]], 1.1, 0.6, 108);

  // 六角灯笼
  ink(g, hexPts(cx, lampY, LAMP_R), 1.8, 0.88, 109);

  // 3×2 横窗框线
  const winX0 = cx - 73, winTop = topY + 18, cw = 45.33, chh = 43.5;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = winX0 + c * (cw + 5), wy = winTop + r * (chh + 5);
      ink(g, rrectPts(wx, wy, cw, chh, 3, 3), 1.3, 0.72, 120 + r * 3 + c);
      ink(g, [[wx + cw / 2, wy + 3], [wx + cw / 2, wy + chh - 3]], 1.0, 0.42, 130 + r * 3 + c,
        { taper: 0.6, dry: 0.22 });
    }
  }

  // 下半部门板：中缝 + 三道百叶 + 把手
  const doorTop = topY + 118, doorBot = baseY - 16;
  ink(g, [[cx, doorTop], [cx, doorBot]], 1.5, 0.66, 140);
  for (let i = 0; i < 3; i++) {
    const yy = doorTop + 12 + i * 12;
    ink(g, [[cx - 70, yy], [cx - 22, yy - 1]], 1.1, 0.45, 141 + i, { taper: 0.65, dry: 0.24 });
  }
  ink(g, [[cx + 8, doorTop + 26], [cx + 8, doorTop + 42]], 1.2, 0.5, 145);

  // 圆形时间刻度盘 + 十二道刻度
  const dx = cx + 39, dy = doorTop + 30, dr = 15;
  ink(g, circlePts(dx, dy, dr, 18), 1.5, 0.75, 150);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ink(g, [
      [dx + Math.cos(a) * dr * 0.72, dy + Math.sin(a) * dr * 0.72],
      [dx + Math.cos(a) * dr * 0.94, dy + Math.sin(a) * dr * 0.94],
    ], 1.0, 0.5, 160 + i, { taper: 0.6, dry: 0.2 });
  }
}

// 灯内漩涡 + 指针：全片唯一随全局时间转的舱体部件
function drawSwirl(g, P, t) {
  const { cx, topY, lampY } = P;
  const a0 = swirlAngle(t);
  ink(g, arcPts(cx, lampY, 12, a0, a0 + 2.0, 10), 1.2, 0.5, 110, { taper: 0.55, dry: 0.16 });
  ink(g, arcPts(cx, lampY, 6.5, a0 + Math.PI, a0 + Math.PI + 2.0, 8), 1.0, 0.42, 111, { taper: 0.6, dry: 0.2 });
  const dx = cx + 39, dy = topY + 148, dr = 15;
  const na = a0 - Math.PI / 2;
  ink(g, [[dx, dy], [dx + Math.cos(na) * dr * 0.66, dy + Math.sin(na) * dr * 0.66]], 1.4, 0.8, 175);
}

// ============================================================
// 时间驱动的几个量
// ============================================================

// 风势：第 2 小节最猛（梗在这里），第 3 小节略收，但始终留三成底风
function gustOf(local) {
  return 0.30 + 0.70 * smooth(1.5, 2.6, local) * (1 - 0.34 * smooth(4.2, 5.8, local));
}

// 过框：所有线宽统一加粗 0.6 再收回（读作镜头推近的呼吸）
function lineBump(local) {
  const a = Math.exp(-Math.pow(local / 0.32, 2));
  const b = Math.exp(-Math.pow((6 - local) / 0.32, 2));
  return 0.6 * (a + b);
}

// 每拍一次的冲击 → 阻尼摆动（印章歪角用）
function beatRing(local, period, decay) {
  const n = Math.floor(local / BEAT);
  let s = 0;
  for (let k = 0; k < 3; k++) {
    const age = local - (n - k) * BEAT;
    if (age < 0 || age > 2.2) continue;
    s += Math.pow(0.52, k) * Math.exp(-age / decay) * Math.sin(TAU * age / period);
  }
  return s;
}

// 舱体在这一帧的位置（与 beats 的悬浮起伏同步）
function poseOf(x, local) {
  const baseY = RIDE_Y + hoverY(local);
  const topY = baseY - CH;
  return { cx: x, baseY, topY, lampY: topY - LAMP_DY };
}

// ============================================================
// 笔：所有线都从这里出去
// ============================================================
function ink(g, pts, weight, alpha, seed, extra) {
  inkStroke(g, pts, {
    rgb: INK, alpha, weight, taper: 0.42, dry: 0.08, seed, ...extra,
  });
}

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// 圆角矩形 → 点列
function rrectPts(x, y, w, h, r, per = 4) {
  const pts = [];
  const push = (px, py) => pts.push([px, py]);
  const arc = (ax, ay, a0) => {
    for (let i = 0; i <= per; i++) {
      const a = a0 + (Math.PI / 2) * (i / per);
      push(ax + Math.cos(a) * r, ay + Math.sin(a) * r);
    }
  };
  push(x + r, y);
  push(x + w - r, y);
  arc(x + w - r, y + r, -Math.PI / 2);
  push(x + w, y + h - r);
  arc(x + w - r, y + h - r, 0);
  push(x + r, y + h);
  arc(x + r, y + h - r, Math.PI / 2);
  push(x, y + r);
  arc(x + r, y + r, Math.PI);
  return pts;
}

function circlePts(cx, cy, r, n = 18, a0 = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + TAU * (i / n);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function hexPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function arcPts(cx, cy, r, a0, a1, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// ============================================================
// 风：几条极淡的长痕，交代"风从哪来"
// ============================================================
function drawWindLines(g, local, gust, bump) {
  const rnd = mulberry32(9021);
  for (let i = 0; i < 3; i++) {
    const y0 = 250 + i * 130 + (rnd() - 0.5) * 30;
    const pts = [];
    for (let k = 0; k < 40; k++) {
      const u = k / 39;
      const amp = (6 + i * 2) * (0.6 + 0.4 * gust);
      pts.push([
        -50 + u * 1120,
        y0 - u * (46 + i * 18) + Math.sin(TAU * (1.15 * u - local) + i * 1.4) * amp,
      ]);
    }
    inkStroke(g, pts, {
      rgb: INK, alpha: 0.035 + 0.085 * gust, weight: 1.6 + bump * 0.4,
      taper: 0.6, dry: 0.1, seed: 310 + i,
    });
  }
}

// ============================================================
// 右下角小树：一株被风偃倒的树，枝干被飘带拉向右，叶一簇簇朝右飞散
// ============================================================
const TRUNK = [[0, 0], [3, -48], [9, -94], [16, -132], [22, -162]];
const BRANCHES = [
  [[6, -62], [20, -76], [34, -84]],
  [[12, -100], [30, -118], [46, -126]],
  [[19, -138], [36, -158], [50, -168]],
  [[22, -162], [36, -184], [48, -196]],
  [[22, -162], [10, -188], [0, -200]],   // 一枝回望左，破一下单调
];

function windBend(local, gust) {
  // 第 3 拍（local 1.75 前后）摆到极值
  const swing = 0.62 + 0.38 * Math.sin(TAU * (local - 1.25) / 2);
  return 48 * gust * swing;
}

function shearPts(pts, bend) {
  const H = 210;
  return pts.map(([x, y]) => {
    const h = Math.min(H, Math.max(0, TREE.y - y));
    const k = Math.pow(h / H, 1.4);
    return [x + bend * k, y - bend * 0.24 * k];
  });
}

function drawTreeUnit(g, local, gust, bump) {
  const bend = windBend(local, gust);
  const P = (p) => [TREE.x + p[0], TREE.y + p[1]];
  const W = 1 + bump * 0.25;

  const trunk = shearPts(TRUNK.map(P), bend);
  inkStroke(g, catmull(trunk, 8), {
    rgb: INK, alpha: 0.86, weight: 6.2 * W, taper: 0.5, dry: 0.12, seed: 611,
  });
  // 树身一道淡墨皴，给干一点体积
  inkStroke(g, catmull(trunk.map(([x, y]) => [x + 3.5, y + 1]), 8), {
    rgb: INK, alpha: 0.22, weight: 1.6, taper: 0.75, dry: 0.45, seed: 612,
  });

  const tips = [];
  for (let i = 0; i < BRANCHES.length; i++) {
    const br = shearPts(BRANCHES[i].map(P), bend);
    const cur = catmull(br, 8);
    inkStroke(g, cur, {
      rgb: INK, alpha: 0.78, weight: (3.4 - i * 0.25) * W, taper: 0.55, dry: 0.16, seed: 620 + i,
    });
    tips.push(cur[cur.length - 1]);
  }

  // 树冠：一簇簇"个字点"短线，风一大统一倒向右上
  for (let i = 0; i < tips.length; i++) {
    leafFan(g, tips[i][0], tips[i][1], 7, 22, gust, 700 + i * 13, 0.66);
  }
  // 叶被卷走：几簇脱离枝头，朝右飞
  const rnd = mulberry32(1717);
  for (let i = 0; i < 7; i++) {
    const src = tips[i % tips.length];
    const travel = gust * (36 + 92 * rnd());
    const flutter = Math.sin(TAU * (local * 1.1 + i * 0.37)) * 8 * gust;
    const x = src[0] + travel;
    const y = src[1] - travel * 0.32 + flutter;
    leafFan(g, x, y, 5, 20, 1, 800 + i * 11, 0.5 * (1 - 0.4 * travel / 130));
  }

  // 树根：几笔淡墨横皴，压住地面
  for (let i = 0; i < 4; i++) {
    const a = rnd();
    dryLine(g, TREE.x - 26 + i * 14, TREE.y + 1, TREE.x - 12 + i * 15 + a * 6, TREE.y + 2, {
      rgb: INK, alpha: 0.28 + a * 0.2, weight: 1.7 + a, dry: 0.3, seed: 850 + i,
    });
  }
}

// 一簇叶：从一个点向风向扇形张开（个字/介字点），白描画叶的老办法
function leafFan(g, cx, cy, n, spread, gust, seed0, alpha) {
  const rnd = mulberry32(seed0);
  const WIND = -0.32;                       // 叶尖统一朝向：右上
  const ox = (rnd() - 0.5) * spread * 0.5;
  const oy = (rnd() - 0.5) * spread * 0.4;
  for (let i = 0; i < n; i++) {
    const rest = -0.32 + (i / (n - 1) - 0.5) * 2.2;
    const a = lerp(rest, WIND + (rnd() - 0.5) * 0.5, 0.88 * gust);
    const len = 11 + rnd() * 10;
    const x = cx + ox + (rnd() - 0.5) * spread * 0.6;
    const y = cy + oy + (rnd() - 0.5) * spread * 0.5;
    dryLine(g, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, {
      rgb: INK, alpha: alpha * (0.55 + rnd() * 0.5),
      weight: 1.7 + rnd() * 1.2, dry: 0, seed: seed0 * 7 + i,
    });
  }
}

// ============================================================
// 左上：两行竖排小字（中性自撰）
// ============================================================
function drawColophon(g) {
  const rnd = mulberry32(4471);
  g.push();
  g.noStroke();
  g.textFont(ZH);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(COLOPHON.size);
  for (let c = 0; c < VERSE.length; c++) {
    const txt = VERSE[c];
    const x = COLOPHON.x - c * COLOPHON.dx;
    for (let i = 0; i < txt.length; i++) {
      g.fill(INK[0], INK[1], INK[2], 104 + rnd() * 48);
      g.text(txt[i], x + (rnd() - 0.5) * 2.4, COLOPHON.y + i * COLOPHON.gap);
    }
  }
  g.textSize(13);
  for (let i = 0; i < SIGN.length; i++) {
    g.fill(INK[0], INK[1], INK[2], 88 + rnd() * 26);
    g.text(SIGN[i], COLOPHON.x - 2 * COLOPHON.dx, COLOPHON.y + 24 + i * 19);
  }
  g.pop();
}

// ============================================================
// 右上：朱红印章 + 被飘带缠住的系绳（歪角随相位摆）
// ============================================================
function drawSealUnit(g, local, gust, bump) {
  const { x, y, s, ch } = SEALU;
  const pivot = [x + 17 * s, y + 17.5 * s];
  const tilt = 0.085 * gust + 0.062 * beatRing(local, 0.52, 0.26);

  g.push();
  g.translate(pivot[0], pivot[1]);
  g.rotate(tilt);
  g.translate(-pivot[0], -pivot[1]);
  g.textFont(ZH);
  seal(g, x, y, s, ch, { rgb: RED });
  drawSealCord(g, x, y, s, local, gust, bump);
  g.pop();
}

// 系绳：从印底垂下，末端朝飘带走的方向勾过去
function drawSealCord(g, x, y, s, local, gust, bump) {
  const n = 30;
  const len = 46 + 58 * gust;
  const x0 = x + 8 * s, y0 = y + 34 * s;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const sway = Math.sin(TAU * (0.9 * u - local) + 0.6) * (9 + 15 * gust) * u;
    pts.push([x0 + sway + u * (24 + 30 * gust), y0 + len * u]);
  }
  inkStroke(g, pts, {
    rgb: RED, alpha: 0.7, weight: 2.0 + bump * 0.3, taper: 0.5, dry: 0.06, seed: 902,
  });
  inkStroke(g, pts.map((p, i) => [p[0] + 2.6, p[1] - 1.4 + i * 0.05]), {
    rgb: RED, alpha: 0.32, weight: 1.2, taper: 0.7, dry: 0.25, seed: 903,
  });
}

// ============================================================
// 三条主飘带 + 两条短飘带
// ============================================================
function drawTrailRibbons(g, cx, local, gust, bump) {
  const P = poseOf(cx, local);
  const crown = [TREE.x + 30 + 34 * gust, TREE.y - 130];

  const specs = [
    {                                   // 上：灯笼顶 → 右上印章系绳
      s: [P.cx + 9, P.topY - 66],
      t: [944, 214],
      half: 13, amp: 58, waves: 1.55, ph: 0.0, bow: -18,
      w: 4.2, dry: 0.08, seed: 211,
    },
    {                                   // 中：檐右端 → 横贯出右画框
      s: [P.cx + 96, P.topY + 8],
      t: [1000, 470],
      half: 11, amp: 50, waves: 1.75, ph: 1.9, bow: 12,
      w: 3.8, dry: 0.09, seed: 231,
    },
    {                                   // 下：舱体右腰 → 卷进右下角树冠
      s: [P.cx + 90, P.topY + 52],
      t: crown,
      half: 12, amp: 54, waves: 1.45, ph: 3.4, bow: 26,
      w: 4.0, dry: 0.085, seed: 251,
    },
  ];
  for (const sp of specs) drawRibbon(g, sp, local, gust, bump);

  // 两条短飘带：一条垂直下坠，一条长长地甩在舱后（第 3 小节撑住画面）
  drawHangRibbon(g, [P.cx - 96, P.topY + 12], local, gust, bump, 281, 3.0, 7.5, 1, 78);
  drawTrailBack(g, P, local, gust, bump);
}

// 飘带骨架：直线主势 + 弓形 + 双频正弦；phOff 让伴线与主线错一点相位（带面拧劲）
function guidePts(S, T, sp, local, gust, phOff = 0) {
  const ex = 1018;                                     // 末端一律送出右画框
  const slope = (T[1] - S[1]) / Math.max(70, T[0] - S[0]);
  const E = [ex, Math.min(940, Math.max(30, S[1] + slope * (ex - S[0])))];
  const dx = E[0] - S[0], dy = E[1] - S[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const amp = sp.amp * (0.72 + 0.28 * gust);

  const pts = [];
  for (let i = 0; i < N_PT; i++) {
    const u = i / (N_PT - 1);
    const env = Math.pow(Math.sin(Math.PI * u), 0.5);
    const w1 = amp * env * Math.sin(TAU * (sp.waves * u - local) + sp.ph + phOff);
    const w2 = amp * 0.34 * env * Math.sin(TAU * (sp.waves * 1.9 * u - local * 1.5) + sp.ph * 1.7 + 1.1 + phOff);
    const bow = sp.bow * Math.pow(Math.sin(Math.PI * u), 0.9);
    const o = w1 + w2 + bow;
    pts.push([S[0] + dx * u + nx * o, S[1] + dy * u + ny * o]);
  }
  return pts;
}

// 带宽剖面：起笔窄 → 中段最宽 → 收尾略窄
function bandProf(u, gust) {
  const grow = Math.min(1, 0.34 + u * 5.2);
  const tail = 1 - 0.42 * Math.max(0, (u - 0.72) / 0.28);
  return grow * tail * (0.82 + 0.18 * gust);
}

function shiftBand(pts, fn) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const L = Math.hypot(tx, ty) || 1;
    tx /= L; ty /= L;
    const d = fn(i / (n - 1));
    out.push([pts[i][0] - ty * d, pts[i][1] + tx * d]);
  }
  return out;
}

function drawRibbon(g, sp, local, gust, bump) {
  // 舱体快出右画框时飘带整体淡出，避免端头往回拐
  const fade = clamp01((sp.t[0] - 30 - sp.s[0]) / 200);
  if (fade <= 0.01) return;

  const prof = (u) => sp.half * bandProf(u, gust);
  const A = (alpha0) => alpha0 * fade;

  // 主线（最粗，读作"有风"）
  inkStroke(g, guidePts(sp.s, sp.t, sp, local, gust, 0), {
    rgb: INK, alpha: A(0.92), weight: sp.w + bump, taper: 0.4,
    dry: sp.dry, wobble: 0.5, seed: sp.seed,
  });
  // 两条伴线：夹出带宽，比主线细而淡，相位稍错开（带面有拧劲）
  for (const [sgn, po, sd] of [[1, 0.26, sp.seed + 1], [-1, -0.26, sp.seed + 2]]) {
    inkStroke(g, shiftBand(guidePts(sp.s, sp.t, sp, local, gust, po), (u) => sgn * prof(u)), {
      rgb: INK, alpha: A(0.66), weight: sp.w * 0.68 + bump * 0.6, taper: 0.5,
      dry: sp.dry + 0.05, wobble: 0.8, seed: sd,
    });
  }
  // 带内一道折纹（极淡，只为了让带面不空）
  inkStroke(g, shiftBand(guidePts(sp.s, sp.t, sp, local, gust, 0.55), (u) => prof(u) * 0.32), {
    rgb: INK, alpha: A(0.16), weight: 1.3, taper: 0.7, dry: 0.42, seed: sp.seed + 3,
  });
}

// 短飘带：从舱体左肩垂下，末端被风带向一侧
function drawHangRibbon(g, S, local, gust, bump, seed, w, half, sgn, len0) {
  const tipY = Math.min(ROAD_TOP - 14, S[1] + len0 * (0.7 + 0.3 * gust));
  if (tipY - S[1] < 26) return;
  const n = 40, pts = [];
  const drift = (22 + 40 * gust) * sgn;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const sway = Math.sin(TAU * (1.1 * u - local) + seed) * (5 + 9 * gust) * u;
    pts.push([S[0] + drift * u + sway, S[1] + (tipY - S[1]) * u]);
  }
  const prof = (u) => half * Math.min(1, 0.4 + u * 3.4) * (1 - 0.5 * Math.max(0, (u - 0.7) / 0.3));
  inkStroke(g, pts, {
    rgb: INK, alpha: 0.86, weight: w + bump, taper: 0.45, dry: 0.05, seed,
  });
  for (const [k, sd] of [[1, seed + 1], [-1, seed + 2]]) {
    inkStroke(g, shiftBand(pts, (u) => k * prof(u)), {
      rgb: INK, alpha: 0.55, weight: w * 0.6 + bump * 0.5, taper: 0.55,
      dry: 0.14, seed: sd,
    });
  }
}

// 甩在舱后的那条：向左下垂再扬起，第 3 小节替画面撑住中段
function drawTrailBack(g, P, local, gust, bump) {
  const S = [P.cx - 98, P.topY + 6];
  const n = 60, pts = [];
  const span = 400 + 110 * gust;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const o = Math.sin(TAU * (1.3 * u - local) + 2.2) * (9 + 12 * gust) * Math.sin(Math.PI * u);
    pts.push([
      S[0] - span * u + o * 0.5,
      S[1] + 78 * Math.sin(Math.PI * u) - 66 * u + o,
    ]);
  }
  const prof = (u) => 8.5 * Math.min(1, 0.35 + u * 4.5) * (1 - 0.55 * Math.max(0, (u - 0.62) / 0.38));
  inkStroke(g, pts, {
    rgb: INK, alpha: 0.8, weight: 3.2 + bump, taper: 0.5, dry: 0.06, seed: 301,
  });
  for (const [k, sd] of [[1, 302], [-1, 303]]) {
    inkStroke(g, shiftBand(pts, (u) => k * prof(u)), {
      rgb: INK, alpha: 0.5, weight: 2.0 + bump * 0.5, taper: 0.6,
      dry: 0.16, seed: sd,
    });
  }
}

// 驾驶员：从上排中窗探出，衣纹朝风向飘
function drawDriverLines(g, P, t, wave, bump) {
  const { cx, topY } = P;
  const b = bump * 0.6;
  const hy = topY + 29;

  // 头（一笔圈成）
  ink(g, circlePts(cx, hy, 7.5, 16), 1.5 + b, 0.85, 181, { taper: 0.3, dry: 0.06 });
  // 巾/发：一道弧
  ink(g, arcPts(cx, hy, 7.5, Math.PI * 1.12, Math.PI * 1.88, 8), 1.2 + b, 0.6, 182, { taper: 0.6, dry: 0.18 });

  // 肩 / 身
  ink(g, catmull([[cx - 3, hy + 7], [cx - 7, hy + 18], [cx - 11, topY + 58]], 5), 1.6 + b, 0.8, 183);
  ink(g, catmull([[cx + 3, hy + 7], [cx + 7, hy + 18], [cx + 11, topY + 58]], 5), 1.6 + b, 0.8, 184);

  // 两条向后（往右上）飘的衣纹线
  for (let i = 0; i < 2; i++) {
    const y0 = topY + (44 + i * 9);
    const K = 30 + 16 * i + 10 * wave;
    ink(g, catmull([
      [cx - 8 - i * 3, y0],
      [cx + K * 0.45, y0 - 6 - i * 4],
      [cx + K, y0 - 12 - i * 6],
    ], 6), 1.3 + b, 0.55, 190 + i, { taper: 0.65, dry: 0.2 });
  }

  // 手臂：wave 时抬起来挥
  if (wave) {
    const wig = Math.sin(t * 9) * 0.3;
    ink(g, catmull([
      [cx + 5, topY + 44], [cx + 14, topY + 34], [cx + 22, topY + 14 + wig * 7],
    ], 5), 1.7 + b, 0.85, 195);
  } else {
    ink(g, [[cx + 5, topY + 44], [cx + 13, topY + 52]], 1.6 + b, 0.8, 196);
  }
}
