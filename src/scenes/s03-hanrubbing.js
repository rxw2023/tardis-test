// ============================================================
// s03-hanrubbing.js — 第 03 格：汉画像石拓片（约100）
//
// 黑底（#171512）+ 纸白（#e8e2d2）拓痕：
//   · 外框 40 单位宽的菱形连纹边饰 + 上下垂幔纹
//   · 上格：云气纹带 + 两只朝向相反的长尾朱雀状鸟
//   · 下格：车马出行队列从右向左行进（8fps 量化），与时空舱对撞
//   · 时空舱覆盖 drawVehicle：白线剪影车厢 + 四枚云气轮 + 两朵云气拉车
//   · 梗：队列里每辆车都有马，只有它前面是云；亭长扛棨戟拿过短的缰绳追它
//
// 参考仅限「汉画像石拓片」这一公有领域品类，不描摹任何具体文物构图。
// ============================================================

import { mulberry32, catmull } from '../kit/kit.js';
import {
  TAU, BAR, swirlAngle, routeU, hoverY, smooth, clamp01,
  nearestCrossingDist, SCENES_START, SCENE_LEN,
} from '../beat/beats.js';

// ---- 调色 ----
const BG = [0x17, 0x15, 0x12];
const INK = [0xe8, 0xe2, 0xd2];
const GREY = [0x9a, 0x94, 0x84];
const OCHRE = [0x8a, 0x6a, 0x4a];

// ---- 版面几何 ----
const GROUND = 676;   // 队列所立地线
const FR_T = 38;      // 上边框带中线
const FR_B = 712;     // 下边框带中线
const FR_L = 38;
const FR_R = 962;
const DIV1 = 116;     // 第一道分层横线
const DIV2 = 334;     // 第二道分层横线

// 每帧复写的两个跨函数状态（同一帧内 render → drawVehicle，可重入）
let BOOST = 0;        // 过框提亮 0..0.15
let SPEC = null;      // 拓包噪点缓存层
let HALO = false;     // halo 通道：把线加宽一圈，从拥挤队列里"挖空"主体

// ------------------------------------------------------------
// 小工具
// ------------------------------------------------------------
function lerp(a, b, u) { return a + (b - a) * u; }
function q8(x) { return Math.floor(x * 8) / 8; }   // 8fps 量化

function inkRGB() {
  const k = BOOST;
  return [lerp(INK[0], 255, k), lerp(INK[1], 253, k), lerp(INK[2], 246, k)];
}
function greyRGB() {
  const k = BOOST;
  return [lerp(GREY[0], 244, k), lerp(GREY[1], 240, k), lerp(GREY[2], 232, k)];
}

// 点列加密（让"吃掉"缺口的粒度稳定在几单位）
function densify(pts, step = 5) {
  if (!pts || pts.length < 2) return pts || [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(d / step));
    for (let j = 1; j <= k; j++) {
      out.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]);
    }
  }
  return out;
}

// 圆弧 / 整圆采样
function arcPts(cx, cy, rx, ry, a0, a1, n = 22) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
function circPts(cx, cy, r, n = 40, a0 = 0, a1 = TAU) {
  return arcPts(cx, cy, r, r, a0, a1, n);
}

// ------------------------------------------------------------
// 拓片线：沿点列分段画，按固定种子随机"吃掉" 5%~15% 的段
// ------------------------------------------------------------
function gapPoly(g, pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const {
    w = 6, w0 = null, w1 = null, seed = 1, eat = 0.10, closed = false,
    rgb = inkRGB(), alpha = 1, grey = 0.18,
  } = o;
  const n = pts.length;
  const segs = closed ? n : n - 1;
  const rnd = mulberry32(seed);
  // rgb 传 BG（阴刻/halo 通道）时不做浓淡变化
  const gr = (grey > 0 && rgb !== BG) ? greyRGB() : rgb;
  g.push();
  g.noFill();
  g.strokeCap(g.ROUND);
  for (let i = 0; i < segs; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const r = rnd();
    rnd();                                  // 保持随机流对齐
    if (r < eat) continue;                  // 缺口
    const u = segs > 1 ? i / (segs - 1) : 0;
    const ww = (w0 != null && w1 != null) ? w0 + (w1 - w0) * u : w;
    const c = (r < eat + grey) ? gr : rgb;  // 浓淡
    const j = rnd();
    g.stroke(c[0], c[1], c[2], Math.min(255, 255 * alpha * (0.78 + j * 0.3)));
    g.strokeWeight(Math.max(0.5, (HALO ? ww + 9 : ww) * (0.85 + rnd() * 0.3)));
    g.line(p[0], p[1], q[0], q[1]);
  }
  g.pop();
}

// 实心拓痕（剪影）：边缘带固定种子的轻微抖动
function solidPoly(g, pts, o = {}) {
  if (!pts || pts.length < 3) return;
  const { rgb = inkRGB(), alpha = 1, wob = 1.0, seed = 5 } = o;
  const rnd = mulberry32(seed);
  g.push();
  g.noStroke();
  if (HALO) { g.stroke(rgb[0], rgb[1], rgb[2], 255 * alpha); g.strokeWeight(10); }
  g.fill(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.beginShape();
  for (let i = 0; i < pts.length; i++) {
    g.vertex(pts[i][0] + (rnd() - 0.5) * wob, pts[i][1] + (rnd() - 0.5) * wob);
  }
  g.endShape(g.CLOSE);
  g.pop();
}

function disc(g, x, y, r, o = {}) {
  const { rgb = inkRGB(), alpha = 1 } = o;
  g.push();
  g.noStroke();
  g.fill(rgb[0], rgb[1], rgb[2], 255 * alpha);
  g.circle(x, y, r * 2);
  g.pop();
}

// 阴刻细线（在白色剪影内部刻出的黑线）
function incise(g, pts, o = {}) {
  const { w = 3.2, seed = 9, eat = 0.12, closed = false, alpha = 1 } = o;
  gapPoly(g, pts, { w, seed, eat, closed, rgb: BG, alpha, grey: 0 });
}

// 关节折线 → 带粗细渐变的实心肢体（腿、臂、尾、辕）
function limb(joints, w0, w1) {
  const pts = densify(catmull(joints, 6), 5);
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const u = pts.length > 1 ? i / (pts.length - 1) : 0;
    const hw = (w0 + (w1 - w0) * u) * 0.5;
    L.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    R.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  return L.concat(R.reverse());
}

// ------------------------------------------------------------
// 拓包噪点：整幅一层极淡白点（上疏下密）+ 剪影上的剥落黑点
// ------------------------------------------------------------
function rubSpeck(g) {
  if (!SPEC) {
    const pg = g.createGraphics(1000, 1000);
    pg.pixelDensity(1);
    pg.clear();
    const rnd = mulberry32(0x5eed01);
    pg.noStroke();
    for (let i = 0; i < 6400; i++) {          // 白点：拓包拍打
      const x = rnd() * 1000;
      const y = 1000 * Math.pow(rnd(), 0.52); // 上疏下密
      pg.fill(232, 226, 210, 10 + rnd() * 44);
      pg.circle(x, y, 0.6 + rnd() * 2.1);
    }
    for (let i = 0; i < 4600; i++) {          // 黑点：剪影上的剥落
      const x = rnd() * 1000;
      const y = 1000 * Math.pow(rnd(), 0.52);
      pg.fill(19, 17, 14, 24 + rnd() * 96);
      pg.circle(x, y, 0.7 + rnd() * 2.6);
    }
    for (let i = 0; i < 620; i++) {           // 大块剥落（石花）
      const x = rnd() * 1000;
      const y = 1000 * Math.pow(rnd(), 0.52);
      pg.fill(21, 19, 16, 40 + rnd() * 110);
      pg.circle(x, y, 2.5 + rnd() * 7.5);
    }
    SPEC = pg;
  }
  g.push();
  g.image(SPEC, 0, 0, 1000, 1000);
  g.pop();
}

// ------------------------------------------------------------
// 边饰：菱形连纹 + 垂幔纹
// ------------------------------------------------------------
function diamondChain(g, x0, y0, x1, y1, cells, pitch, seed, litF) {
  let dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const hw = pitch * 0.40, hh = pitch * 0.34;
  const ink = inkRGB();
  for (let i = 0; i < cells; i++) {
    const cx = x0 + ux * (pitch * i), cy = y0 + uy * (pitch * i);
    const dia = [
      [cx + ux * hw, cy + uy * hw],
      [cx + px * hh, cy + py * hh],
      [cx - ux * hw, cy - uy * hw],
      [cx - px * hh, cy - py * hh],
    ];
    const lit = Math.exp(-Math.pow((i - litF) / 1.15, 2));
    const ochreFixed = (i % 7 === 3) ? 1 : 0;
    if (lit > 0.02 || ochreFixed) {
      const a = Math.min(1, ochreFixed ? 0.55 : lit);
      g.push();
      g.noStroke();
      g.fill(OCHRE[0], OCHRE[1], OCHRE[2], 255 * a * 0.9);
      g.beginShape();
      for (const p of dia) g.vertex(p[0], p[1]);
      g.endShape(g.CLOSE);
      g.pop();
    }
    const w = 4.4 + lit * 3.4;
    gapPoly(g, dia, { w, seed: seed + i * 17, eat: 0.08, closed: true, rgb: ink, grey: 0 });
    if (i < cells - 1) {
      const nx = cx + ux * pitch, ny = cy + uy * pitch;
      gapPoly(g, [[cx + ux * hw, cy + uy * hw], [nx - ux * hw, ny - uy * hw]],
        { w: 4.0 + lit * 3.0, seed: seed + i * 31 + 5, eat: 0.10, rgb: ink });
    }
  }
}

function valance(g, yTop, x0, x1, pitch, depth, seed, dir = 1) {
  const ink = inkRGB();
  gapPoly(g, densify([[x0, yTop], [x1, yTop]], 12), { w: 5.2, seed, eat: 0.07, rgb: ink });
  let i = 0;
  for (let x = x0 + pitch * 0.5; x < x1; x += pitch, i++) {
    const s = seed + i * 23;
    gapPoly(g, arcPts(x, yTop, pitch * 0.52, depth * dir, 0, Math.PI, 16),
      { w: 5.0, seed: s, eat: 0.10, rgb: ink });
    // 幔下的小铃 / 垂饰
    gapPoly(g, [[x, yTop + depth * dir], [x, yTop + (depth + 11) * dir]],
      { w: 4.2, seed: s + 7, eat: 0.16, rgb: ink });
    if (i % 3 === 1) disc(g, x, yTop + (depth + 17) * dir, 4.2, { rgb: ink, alpha: 0.95 });
  }
}

// ------------------------------------------------------------
// 云气纹（卷云）：一条由内向外、粗细渐收的涡卷
// ------------------------------------------------------------
function cloudScroll(g, x, y, r, dir, seed, o = {}) {
  const { turns = 1.62, w0 = 11, w1 = 2.4, alpha = 1, rgb = inkRGB(), fillHead = true } = o;
  const pts = [];
  const n = 34;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * turns * TAU * dir;
    const rr = r * (0.08 + 0.92 * Math.pow(u, 0.86)) * (dir < 0 ? 1 : 1);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78]);
  }
  gapPoly(g, pts, { w0, w1, seed, eat: 0.09, rgb, alpha });
  if (fillHead) disc(g, x, y, r * 0.085, { rgb, alpha });
}

// 云气团（拉车的两朵云）：涡卷 + 实心卷头 + 飘尾
function cloudSteed(g, x, y, r, seed, o = {}) {
  const { dir = 1, drift = 0, alpha = 1, rgb = inkRGB() } = o;
  cloudScroll(g, x + drift, y, r, dir, seed, { w0: r * 0.30, w1: r * 0.07, alpha, rgb });
  // 卷头实心鼓包
  disc(g, x + drift - dir * r * 0.30, y + r * 0.10, r * 0.20, { rgb, alpha });
  // 飘尾：三条向外拖曳的卷线
  for (let k = 0; k < 3; k++) {
    const a0 = dir * (0.55 + k * 0.42);
    const tp = [];
    for (let i = 0; i <= 22; i++) {
      const u = i / 22;
      const a = a0 + dir * u * 0.55 * TAU;
      const rr = r * (0.72 + u * 0.66);
      tp.push([x + drift + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * 0.52 - u * r * 0.16]);
    }
    gapPoly(g, tp, { w0: r * 0.15, w1: r * 0.05, seed: seed + 40 + k * 9, eat: 0.12, rgb, alpha });
  }
}

// ------------------------------------------------------------
// 人物（着袍剪影；可拱手 / 持物 / 奔跑 / 戴冠 / 扭头）
// ------------------------------------------------------------
function person(g, x, y, s, o = {}) {
  const {
    h = 70, seed = 7, run = 0, phase = 0, look = -1,
    arms = 'hold', item = null, halo = false, alpha = 1, crown = 1,
  } = o;
  const F = halo ? BG : inkRGB();
  const hr = h * 0.115;
  const hy = -h + hr * 1.25;
  const shY = -h + hr * 2.6;
  const hemY = run > 0 ? -h * 0.44 : 0;

  g.push();
  g.translate(x, y);
  g.scale(s, s);

  // 袍（下摆略张）
  solidPoly(g, [
    [-hr * 1.30, shY],
    [hr * 1.30, shY],
    [hr * 1.95, -h * 0.58],
    [hr * 2.25, hemY],
    [-hr * 2.05, hemY],
    [-hr * 1.75, -h * 0.58],
  ], { seed, rgb: F, wob: 0.9, alpha });

  // 腿（奔跑时露出）
  if (run > 0) {
    const sw = [1, -1][phase % 2] * 1;
    const k1 = [[-3, hemY], [-10 - sw * 7, -h * 0.24], [-14 - sw * 13, 0]];
    const k2 = [[5, hemY], [12 + sw * 7, -h * 0.24], [16 + sw * 13, -2]];
    solidPoly(g, limb(k1, h * 0.12, h * 0.06), { seed: seed + 3, rgb: F, wob: 0.5, alpha });
    solidPoly(g, limb(k2, h * 0.12, h * 0.06), { seed: seed + 4, rgb: F, wob: 0.5, alpha });
  } else {
    solidPoly(g, [[-hr * 1.7, -6], [hr * 1.7, -6], [hr * 1.9, 0], [-hr * 1.9, 0]],
      { seed: seed + 5, rgb: F, alpha });
  }

  // 手臂
  const ay = shY + h * 0.06;
  if (arms === 'raise') {
    solidPoly(g, limb([[0, ay], [look * -6, ay - h * 0.14], [look * -17, ay - h * 0.30]],
      h * 0.13, h * 0.07), { seed: seed + 6, rgb: F, wob: 0.5, alpha });
  } else if (arms === 'salute') {
    solidPoly(g, limb([[0, ay], [look * -11, ay + h * 0.10], [look * -3, ay + h * 0.16]],
      h * 0.13, h * 0.08), { seed: seed + 6, rgb: F, wob: 0.5, alpha });
  } else {
    solidPoly(g, limb([[0, ay], [look * -12, ay + h * 0.13], [look * -24, ay + h * 0.05]],
      h * 0.13, h * 0.07), { seed: seed + 6, rgb: F, wob: 0.5, alpha });
  }

  // 头（侧脸圆 + 鼻突）
  const hx = look * hr * 0.22;
  disc(g, hx, hy, hr, { rgb: F, alpha });
  solidPoly(g, [
    [hx + look * hr * 0.72, hy - hr * 0.18],
    [hx + look * hr * 1.30, hy + hr * 0.06],
    [hx + look * hr * 0.70, hy + hr * 0.34],
  ], { seed: seed + 8, rgb: F, alpha });
  // 冠
  if (crown) {
    solidPoly(g, [
      [hx - hr * 0.95, hy - hr * 0.55],
      [hx + hr * 0.95, hy - hr * 0.62],
      [hx + hr * 1.05, hy - hr * 1.45],
      [hx - hr * 0.85, hy - hr * 1.30],
    ], { seed: seed + 9, rgb: F, alpha });
  }
  // 眼（阴刻）
  if (!halo) {
    disc(g, hx + look * hr * 0.42, hy - hr * 0.12, hr * 0.17, { rgb: BG, alpha: 0.9 });
  }

  // 持物
  if (item === 'ji' || item === 'qiJi') {
    // 棨戟 / 戟：长杆 + 顶部戈勾
    const top = -h * (item === 'qiJi' ? 1.62 : 1.55);
    const gx = look * -hr * 0.9;
    solidPoly(g, limb([[gx, -h * 0.10], [gx + look * -3, -h * 0.62], [gx + look * -6, top + h * 0.20]],
      h * 0.055, h * 0.035), { seed: seed + 11, rgb: F, alpha });
    gapPoly(g, densify([
      [gx + look * -6, top + h * 0.20],
      [gx + look * -6, top],
      [gx + look * -6 + look * -13, top - h * 0.03],
    ], 4), { w: h * 0.075, seed: seed + 12, eat: 0.08, rgb: F, alpha });
    gapPoly(g, densify([
      [gx + look * -6, top + h * 0.06],
      [gx + look * -6 + look * 11, top + h * 0.02],
      [gx + look * -6 + look * 15, top - h * 0.10],
    ], 4), { w: h * 0.065, seed: seed + 13, eat: 0.08, rgb: F, alpha });
  }
  g.pop();
}

// ------------------------------------------------------------
// 马（剪影 + 阴刻细节；四蹄按 8fps 换姿势）
// ------------------------------------------------------------
const HOOF_F = [[-58, 0], [-34, -7], [-13, -14], [-41, -3]];
const HOOF_H = [[64, 0], [55, -5], [39, -12], [58, -3]];

function horse(g, x, y, s, o = {}) {
  const { seed = 21, pose = 0, rear = 0, halo = false, alpha = 1 } = o;
  const F = halo ? BG : inkRGB();
  const k = ((pose % 4) + 4) % 4;
  const k2 = (k + 2) % 4;
  const lift = rear * 26;   // 前蹄扬起

  g.push();
  g.translate(x, y);
  g.scale(s, s);
  g.translate(0, -lift);

  const body = catmull([
    [58, -58], [40, -74], [6, -78], [-16, -76],
    [-26, -92], [-40, -108], [-56, -116], [-74, -112],
    [-81, -100], [-72, -90], [-57, -90], [-44, -80],
    [-37, -58], [-38, -30], [-20, -21], [10, -23],
    [34, -31], [56, -45],
  ], 5);

  // 四腿
  const fh = HOOF_F[k], fh2 = HOOF_F[k2];
  const hh = HOOF_H[k], hh2 = HOOF_H[k2];
  const legs = [
    [[-26, -50], [(-26 - 40) / 2 + 8, -30], [fh[0], fh[1]]],          // 前近
    [[-22, -50], [(-22 + fh2[0] + 10) / 2 + 8, -30], [fh2[0] + 10, fh2[1]]],
    [[36, -50], [(36 + hh[0]) / 2 - 10, -30], [hh[0], hh[1]]],        // 后近
    [[30, -50], [(30 + hh2[0] - 8) / 2 - 10, -30], [hh2[0] - 8, hh2[1]]],
  ];
  // 扬蹄时前腿抬高
  if (lift > 1) { legs[0][2] = [-46, -lift * 0.35]; legs[1][2] = [-30, -lift * 0.62]; }

  for (let i = 0; i < legs.length; i++) {
    solidPoly(g, limb(legs[i], i < 2 ? 11 : 13, 5), { seed: seed + i * 5, rgb: F, wob: 0.6, alpha });
    const e = legs[i][2];
    solidPoly(g, [[e[0] - 6, e[1] - 5], [e[0] + 6, e[1] - 5], [e[0] + 7, e[1] + 1], [e[0] - 7, e[1] + 1]],
      { seed: seed + 30 + i, rgb: F, alpha });
  }

  // 躯干
  solidPoly(g, body, { seed, rgb: F, wob: 1.0, alpha });

  // 鬃毛
  for (let i = 0; i < 6; i++) {
    const u = i / 5;
    const bx = lerp(-30, -8, u), by = lerp(-92, -74, u);
    solidPoly(g, [[bx, by], [bx - 9, by - 11], [bx + 3, by - 3]],
      { seed: seed + 40 + i, rgb: F, alpha });
  }
  // 尾
  solidPoly(g, limb([[56, -62], [76, -52], [88, -26]], 10, 2.5), { seed: seed + 50, rgb: F, alpha });
  // 耳
  solidPoly(g, [[-50, -112], [-56, -124], [-44, -116]], { seed: seed + 51, rgb: F, alpha });

  // 阴刻细节：眼、口、胸带、辔
  if (!halo) {
    disc(g, -63, -107, 2.6, { rgb: BG, alpha: 0.95 });
    incise(g, densify([[-78, -96], [-66, -93]], 4), { w: 2.6, seed: seed + 61 });
    incise(g, densify([[-34, -60], [-30, -34]], 5), { w: 3.0, seed: seed + 62 });
    incise(g, densify([[6, -76], [20, -30]], 6), { w: 3.0, seed: seed + 63 });
  }
  g.pop();
}

// ------------------------------------------------------------
// 轺车（一马一车一御者一乘者）
// ------------------------------------------------------------
function chariot(g, x, y, s, o = {}) {
  const { seed = 101, pose = 0, look = 1, rear = 0, halo = false, alpha = 1 } = o;
  const F = halo ? BG : inkRGB();
  const ink = F;
  const GR = halo ? 0 : 0.18;

  g.push();
  g.translate(x, y);
  g.scale(s, s);

  // ---- 轮 ----
  const wy = -52, wr = 50;
  gapPoly(g, circPts(0, wy, wr, 32), { w: 8.5, seed: seed + 1, eat: 0.08, closed: true, rgb: ink, alpha, grey: GR });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    gapPoly(g, densify([[Math.cos(a) * 8, wy + Math.sin(a) * 8],
      [Math.cos(a) * (wr - 4), wy + Math.sin(a) * (wr - 4)]], 6),
      { w: 5.2, seed: seed + 70 + i * 13, eat: 0.10, rgb: ink, alpha, grey: GR });
  }
  disc(g, 0, wy, 12, { rgb: ink, alpha });
  if (!halo) disc(g, 0, wy, 4.5, { rgb: BG, alpha: 0.9 });

  // ---- 舆（车厢栏板，白线勾出，内里露出黑底）----
  gapPoly(g, densify(catmull([
    [-38, -72], [42, -72], [42, -110], [30, -120], [-38, -100],
  ], 6), 5), { w: 7.0, seed: seed + 2, eat: 0.10, rgb: ink, alpha });
  gapPoly(g, densify([[-38, -86], [40, -94]], 8), { w: 4.2, seed: seed + 3, eat: 0.14, rgb: ink, alpha });

  // ---- 御者 / 乘者（立於舆中）----
  person(g, -14, -72, 1, { h: 72, seed: seed + 200, look: -look, arms: 'hold', halo, alpha });
  person(g, 20, -72, 1, { h: 68, seed: seed + 210, look: -look * 0.4, arms: 'salute', halo, alpha });

  // ---- 盖（伞盖）+ 盖柄 ----
  gapPoly(g, arcPts(4, -152, 104, 42, Math.PI, TAU, 22), { w: 9.0, seed: seed + 4, eat: 0.08, rgb: ink, alpha });
  gapPoly(g, arcPts(4, -150, 92, 32, Math.PI, TAU, 18), { w: 4.4, seed: seed + 5, eat: 0.14, rgb: ink, alpha });
  gapPoly(g, densify([[4, -152], [4, -110]], 8), { w: 6.0, seed: seed + 6, eat: 0.10, rgb: ink, alpha });
  gapPoly(g, densify([[-100, -152], [-110, -138]], 3), { w: 5.5, seed: seed + 7, eat: 0.12, rgb: ink, alpha });
  gapPoly(g, densify([[108, -152], [118, -138]], 3), { w: 5.5, seed: seed + 8, eat: 0.12, rgb: ink, alpha });

  // ---- 辕 + 衡 ----
  gapPoly(g, densify(catmull([[-38, -88], [-100, -78], [-168, -70]], 8), 5),
    { w: 6.5, seed: seed + 9, eat: 0.10, rgb: ink, alpha });
  gapPoly(g, densify([[-176, -84], [-176, -56]], 5), { w: 5.0, seed: seed + 10, eat: 0.12, rgb: ink, alpha });

  g.pop();

  // ---- 马（在车前）----
  horse(g, x - 165 * s, y, s, { seed: seed + 300, pose, rear, halo, alpha });

  // ---- 辔（缰）----
  if (!halo) {
    gapPoly(g, densify(catmull([
      [x - 165 * s - 76 * s, y - 98 * s - rear * 26 * s],
      [x - 110 * s, y - 92 * s], [x - 40 * s, y - 78 * s],
    ], 8), 5), { w: 3.4, seed: seed + 11, eat: 0.14, rgb: ink });
  }
}

// ------------------------------------------------------------
// 骑吏（马 + 持戟骑者）
// ------------------------------------------------------------
function rider(g, x, y, s, o = {}) {
  const { seed = 301, pose = 0, halo = false, alpha = 1, look = 1 } = o;
  horse(g, x, y, s * 0.66, { seed, pose, halo, alpha });
  person(g, x + 2 * s, y - 74 * s, s * 0.92, {
    h: 62, seed: seed + 5, look: -look, arms: 'hold', item: 'ji', halo, alpha,
  });
}

// ------------------------------------------------------------
// 鸟（抽象长尾朱雀，不描摹具体文物）
// ------------------------------------------------------------
function bird(g, x, y, s, dir, seed, o = {}) {
  const { flap = 0, halo = false, alpha = 1 } = o;
  const F = halo ? BG : inkRGB();
  const ink = F;
  g.push();
  g.translate(x, y);
  g.scale(s * dir, s);

  // 长尾羽：三条向后上方拖曳的弧形卷羽
  for (let k = 0; k < 3; k++) {
    const tp = catmull([
      [-16, -30 - k * 4],
      [-52, -28 - k * 11],
      [-88 - k * 9, -24 - k * 24],
      [-116 - k * 9, -14 - k * 30],
    ], 8);
    gapPoly(g, tp, { w0: 9.5 - k * 1.2, w1: 2.6, seed: seed + 10 + k * 7, eat: 0.08, rgb: ink, alpha });
    // 羽端小卷
    const tip = tp[tp.length - 1];
    gapPoly(g, arcPts(tip[0] - 5, tip[1] - 5, 7, 7, -1.2, 1.6, 12),
      { w: 3.0, seed: seed + 60 + k, eat: 0.14, rgb: ink, alpha });
  }
  // 尾下短羽
  gapPoly(g, catmull([[-18, -20], [-52, -8], [-80, -2]], 7),
    { w0: 7.0, w1: 2.2, seed: seed + 70, eat: 0.10, rgb: ink, alpha });

  // 身
  solidPoly(g, catmull([
    [-26, -26], [-6, -42], [16, -40], [28, -28], [24, -12], [-4, -6], [-24, -12],
  ], 5), { seed, rgb: F, wob: 0.9, alpha });

  // 翼（随拍轻扇）
  g.push();
  g.translate(2, -30);
  g.rotate(-0.18 + flap * 0.24);
  solidPoly(g, [[-22, 4], [4, -8], [22, -2], [14, 14], [-14, 14]], { seed: seed + 3, rgb: F, alpha });
  if (!halo) {
    incise(g, densify([[-14, 8], [8, 0]], 5), { w: 2.6, seed: seed + 4 });
    incise(g, densify([[-10, 12], [10, 5]], 5), { w: 2.6, seed: seed + 5 });
  }
  g.pop();

  // 颈 + 头
  solidPoly(g, limb([[16, -38], [26, -54], [34, -66]], 13, 8), { seed: seed + 6, rgb: F, alpha });
  disc(g, 40, -72, 12, { rgb: F, alpha });
  // 冠羽
  for (let i = 0; i < 3; i++) {
    gapPoly(g, densify([[38 + i * 5, -82], [34 + i * 7, -96 - i * 3]], 3),
      { w: 4.2, seed: seed + 20 + i, eat: 0.12, rgb: ink, alpha });
  }
  // 喙
  solidPoly(g, [[50, -74], [66, -68], [50, -62]], { seed: seed + 7, rgb: F, alpha });
  // 腿
  gapPoly(g, densify([[2, -10], [6, 0]], 3), { w: 5.0, seed: seed + 8, eat: 0.10, rgb: ink, alpha });
  gapPoly(g, densify([[-8, -10], [-12, 0]], 3), { w: 5.0, seed: seed + 9, eat: 0.10, rgb: ink, alpha });
  if (!halo) disc(g, 44, -75, 2.6, { rgb: BG, alpha: 0.95 });
  g.pop();
}

// ------------------------------------------------------------
// 队列整体位移（8fps 量化；每小节开头一次顿挫推进）
// ------------------------------------------------------------
function queueDrift(local) {
  const q = Math.floor(local * 8) / 8;
  const lurch = Math.floor(smooth(0, 0.30, q % BAR) * 6) / 6;
  return -(q * 24 + lurch * 26);
}

// ------------------------------------------------------------
// 主渲染
// ------------------------------------------------------------
export function render(g, meta, local, index) {
  const t = SCENES_START + SCENE_LEN * index + local;
  BOOST = 0.15 * Math.exp(-Math.pow(nearestCrossingDist(t) / 0.30, 2));
  const ink = inkRGB();
  const tq = q8(t);
  const pose = Math.floor(tq * 8) % 4;
  const drift = queueDrift(local);
  const capX = routeU(local) * 1000;

  // ---- 底 ----
  g.push();
  g.noStroke();
  g.fill(BG[0], BG[1], BG[2]);
  g.rect(0, 0, 1000, 1000);
  g.pop();

  // ---- 外框 ----
  drawFrame(g, local);

  // ---- 第一格：云气 + 双鸟 ----
  drawSkyBand(g, local, pose);

  // ---- 第二格：车马出行队列（右 → 左）----
  drawGround(g);
  drawProcession(g, local, drift, pose, capX);

  // ---- 拓包噪点 ----
  rubSpeck(g);
}

// ------------------------------------------------------------
// 外框：菱形连纹 + 垂幔
// ------------------------------------------------------------
function drawFrame(g, local) {
  const ink = inkRGB();
  // 内外界栏
  gapPoly(g, densify([[12, 12], [988, 12], [988, 988], [12, 988]], 14),
    { w: 5.5, seed: 900, eat: 0.06, closed: true, rgb: ink });
  gapPoly(g, densify([[66, 66], [934, 66], [934, 934], [66, 934]], 14),
    { w: 4.6, seed: 901, eat: 0.08, closed: true, rgb: ink });

  // 菱形连纹：逐个向右传递点亮（每 2 秒走完一圈）
  const pass = (local % 2) / 2;
  const litF = pass * 19;
  diamondChain(g, 78, FR_T, 922, FR_T, 19, 46, 910, litF);
  diamondChain(g, 78, FR_B, 922, FR_B, 19, 46, 940, litF);
  diamondChain(g, FR_L, 78, FR_L, 668, 13, 46, 970, pass * 13);
  diamondChain(g, FR_R, 78, FR_R, 668, 13, 46, 980, pass * 13);

  // 垂幔纹（上下各一道）
  valance(g, 70, 74, 926, 48, 26, 950, 1);
  valance(g, 736, 74, 926, 48, -22, 960, -1);
}

// ------------------------------------------------------------
// 第一格：云气纹带 + 两只朝向相反的长尾鸟
// ------------------------------------------------------------
function drawSkyBand(g, local, pose) {
  const ink = inkRGB();
  // 分层横线
  gapPoly(g, densify([[70, DIV1], [930, DIV1]], 14), { w: 5.0, seed: 800, eat: 0.07, rgb: ink });
  gapPoly(g, densify([[70, DIV2], [930, DIV2]], 14), { w: 5.0, seed: 801, eat: 0.07, rgb: ink });

  // 横向云气带
  const rnd = mulberry32(3303);
  for (let i = 0; i < 9; i++) {
    const x = 96 + i * 96 + (rnd() - 0.5) * 22;
    const y = 158 + Math.sin(i * 1.1) * 26 + (rnd() - 0.5) * 10;
    const r = 24 + rnd() * 16;
    cloudScroll(g, x, y, r, i % 2 === 0 ? 1 : -1, 400 + i * 13, { w0: r * 0.32, w1: r * 0.07 });
  }
  // 飘带连线
  gapPoly(g, densify(catmull([[86, 172], [300, 148], [520, 186], [740, 152], [930, 180]], 10), 6),
    { w: 3.6, seed: 410, eat: 0.16, rgb: ink });

  // 两只长尾鸟（朝向相反）
  const flap = 0.5 + 0.5 * Math.sin(pose * 1.57);
  bird(g, 262, 318, 1.02, 1, 500, { flap });
  bird(g, 736, 312, 0.94, -1, 560, { flap: 1 - flap });

  // 中腹稀疏云气
  for (let i = 0; i < 6; i++) {
    const x = 110 + i * 152;
    const y = 380 + Math.sin(i * 1.7) * 44;
    cloudScroll(g, x, y, 20 + (i % 3) * 7, i % 2 ? 1 : -1, 600 + i * 11, { w0: 6.4, w1: 1.8 });
  }
}

// ------------------------------------------------------------
// 地线
// ------------------------------------------------------------
function drawGround(g) {
  const ink = inkRGB();
  gapPoly(g, densify([[70, GROUND], [930, GROUND]], 16), { w: 8.0, seed: 820, eat: 0.07, rgb: ink });
  gapPoly(g, densify([[70, GROUND - 11], [930, GROUND - 11]], 16), { w: 3.4, seed: 821, eat: 0.16, rgb: ink });
}

// ------------------------------------------------------------
// 车马出行队列
// ------------------------------------------------------------
function drawProcession(g, local, drift, pose, capX) {
  const ink = inkRGB();
  const X = (b) => b + drift;

  // 迎谒者（躬身）
  const welcomer = X(150);
  person(g, welcomer, GROUND, 0.98, {
    h: 74, seed: 505, look: -1, arms: 'salute', run: 0, pose,
  });

  // 两名持戟骑吏
  rider(g, X(292), GROUND, 0.98, { seed: 303, pose, look: 1 });
  rider(g, X(392), GROUND, 0.98, { seed: 404, pose: pose + 2, look: 1 });

  // 两辆轺车（最右）；御者扭头回看舱体，舱体靠近时马受惊扬蹄
  const nearB = clamp01(1 - Math.abs(capX - X(700)) / 330);
  const nearA = clamp01(1 - Math.abs(capX - X(1075)) / 330);
  chariot(g, X(700), GROUND, 0.95, {
    seed: 202, pose, look: capX > X(700) ? 1 : -1, rear: nearB * 0.9,
  });
  chariot(g, X(1075), GROUND, 0.95, {
    seed: 101, pose: pose + 2, look: capX > X(1075) ? 1 : -1, rear: nearA * 0.35,
  });

  // 扛棨戟的亭长：追舱体，手里一根明显过短的缰绳
  const chaseA = smooth(0.9, 1.7, local) * (1 - smooth(5.0, 5.7, local));
  if (chaseA > 0.02) {
    const bx = capX - 152;
    const gy = GROUND;
    const kx = Math.floor(local * 8) % 2;
    person(g, bx, gy, 1.0, {
      h: 76, seed: 707, look: 1, arms: 'raise', run: 1, phase: kx, item: 'qiJi', alpha: chaseA,
    });
    if (chaseA > 0.3) {
      // 过短的缰绳：才甩出这么点，够不着那两朵云
      const hy = gy - 62;
      gapPoly(g, densify(catmull([
        [bx + 18, hy], [bx + 34, hy - 6], [bx + 50, hy + 2], [bx + 58, hy - 4],
      ], 6), 4), { w: 4.4, seed: 760, eat: 0.14, rgb: ink, alpha: chaseA });
      for (let i = 1; i <= 3; i++) {
        disc(g, bx + 62 + i * 15, hy - 2 + i * 2, 3.0 - i * 0.5, { rgb: ink, alpha: 0.6 * chaseA });
      }
    }
  }
}

// ------------------------------------------------------------
// 版块内推镜：第 2 小节轻微推近看那个"混进来的方盒子"
// ------------------------------------------------------------
export function camera(local) {
  const k = smooth(1.8, 2.6, local) * (1 - smooth(3.6, 4.4, local));
  return { z: 1 + 0.06 * k, fx: 500, fy: 580 };
}

// ============================================================
// 时空舱：画像石里的车 —— 白线剪影车厢 + 四枚云气轮 + 两朵云气拉车
// ============================================================
export function drawVehicle(g, { x, local, t }) {
  const tq = q8(t);
  BOOST = 0.15 * Math.exp(-Math.pow(nearestCrossingDist(t) / 0.30, 2));
  const ang = swirlAngle(tq);
  const bp = local % BAR;
  const whip = Math.exp(-Math.pow((bp - 1.0) / 0.30, 2));   // 第 3 拍：卷尾甩动
  const gy = GROUND + hoverY(q8(local)) * 0.45;

  // 先画一圈放大的黑底"挖空"版，把舱体从拥挤的队列里摘出来
  HALO = true;
  capsuleChariot(g, x, gy, { ang, whip, halo: true });
  HALO = false;
  capsuleChariot(g, x, gy, { ang, whip, halo: false });
  rubSpeck(g);
}

function capsuleChariot(g, x, gy, o) {
  const { ang, whip, halo } = o;
  const F = halo ? BG : inkRGB();
  const ink = F;

  // ---------- 拉车的两朵云气（在车前方，一近一远）----------
  cloudSteed(g, x + 206, gy - 76, 42, 1201, { dir: 1, drift: Math.sin(ang) * 3, rgb: ink });
  cloudSteed(g, x + 252, gy - 142, 30, 1211, { dir: 1, drift: Math.sin(ang + 1.4) * 3, rgb: ink });

  // ---------- 辕 + 衡 ----------
  gapPoly(g, densify(catmull([
    [x + 74, gy - 96], [x + 122, gy - 88], [x + 176, gy - 82],
  ], 8), 5), { w: 7.0, seed: 1221, eat: 0.09, rgb: ink });
  gapPoly(g, densify([[x + 182, gy - 96], [x + 182, gy - 66]], 5),
    { w: 5.4, seed: 1222, eat: 0.12, rgb: ink });

  // ---------- 四枚云气轮 ----------
  cloudWheel(g, x - 24, gy - 66, 19, ang, whip, 1231, ink);
  cloudWheel(g, x + 24, gy - 66, 19, ang + 1.1, whip, 1241, ink);
  cloudWheel(g, x - 64, gy - 34, 34, ang, whip, 1251, ink);
  cloudWheel(g, x + 64, gy - 34, 34, ang + 1.1, whip, 1261, ink);

  // ---------- 车厢（实心白剪影）----------
  const bx0 = x - 78, bx1 = x + 78, by0 = gy - 168, by1 = gy - 60;
  solidPoly(g, [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], { seed: 1271, rgb: F, wob: 1.0 });

  // 3 × 2 横窗（镂空，露出黑底）
  const wx0 = x - 62, ww = 124, wy0 = by0 + 10, wh = 74;
  const cw = (ww - 12) / 3, ch = (wh - 8) / 2;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = wx0 + c * (cw + 6), cy = wy0 + r * (ch + 8);
      g.push();
      g.noStroke();
      g.fill(BG[0], BG[1], BG[2]);
      g.rect(cx, cy, cw, ch);
      g.pop();
      gapPoly(g, densify([[cx, cy], [cx + cw, cy], [cx + cw, cy + ch], [cx, cy + ch]], 6),
        { w: 4.0, seed: 1280 + r * 3 + c, eat: 0.10, closed: true, rgb: ink });
    }
  }

  // 下段门板：三道百叶 + 圆形时间刻度盘
  const dy0 = by0 + 96, dy1 = by1 - 4;
  for (let i = 0; i < 3; i++) {
    g.push();
    g.noStroke();
    g.fill(BG[0], BG[1], BG[2]);
    g.rect(x - 60, dy0 + 6 + i * 9, 42, 4.5);
    g.pop();
  }
  const dx = x + 34, dcy = (dy0 + dy1) / 2 + 2, dr = 13;
  disc(g, dx, dcy, dr, { rgb: F });
  if (!halo) {
    disc(g, dx, dcy, dr * 0.62, { rgb: BG });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      gapPoly(g, densify([
        [dx + Math.cos(a) * dr * 0.68, dcy + Math.sin(a) * dr * 0.68],
        [dx + Math.cos(a) * dr * 0.92, dcy + Math.sin(a) * dr * 0.92],
      ], 2), { w: 2.2, seed: 1300 + i, eat: 0.10, rgb: ink });
    }
    const na = ang - Math.PI / 2;
    gapPoly(g, densify([[dx, dcy], [dx + Math.cos(na) * dr * 0.58, dcy + Math.sin(na) * dr * 0.58]], 3),
      { w: 2.8, seed: 1320, eat: 0.08, rgb: ink });
  }

  // ---------- 檐（中段留缺口，让御者探出身）----------
  solidPoly(g, [[x - 104, gy - 168], [x - 34, gy - 168], [x - 62, gy - 192], [x - 104, gy - 192]],
    { seed: 1331, rgb: F });
  solidPoly(g, [[x + 34, gy - 168], [x + 104, gy - 168], [x + 104, gy - 192], [x + 62, gy - 192]],
    { seed: 1332, rgb: F });
  gapPoly(g, densify([[x - 104, gy - 168], [x + 104, gy - 168]], 12),
    { w: 5.0, seed: 1333, eat: 0.08, rgb: ink });

  // ---------- 六角灯笼（檐右端挑出）----------
  const lx = x + 96, ly = gy - 208;
  gapPoly(g, densify([[x + 96, gy - 192], [x + 96, gy - 196]], 2), { w: 5.0, seed: 1341, eat: 0.1, rgb: ink });
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    hex.push([lx + Math.cos(a) * 16, ly + Math.sin(a) * 16]);
  }
  solidPoly(g, hex, { seed: 1342, rgb: F, wob: 0.7 });
  if (!halo) {
    const sp = [];
    for (let i = 0; i <= 26; i++) {
      const u = i / 26;
      const a = ang + u * 1.4 * TAU;
      const rr = 11 * (1 - 0.85 * u);
      sp.push([lx + Math.cos(a) * rr, ly + Math.sin(a) * rr]);
    }
    incise(g, sp, { w: 2.6, seed: 1343, eat: 0.10 });
  }

  // ---------- 御者：从中间上排窗探出半个身子，手执缰绳状云纹 ----------
  person(g, x, gy - 168, 0.92, {
    h: 66, seed: 1351, look: 1, arms: 'hold', crown: 1,
  });
  // 缰绳状云纹：从御者手上一路牵到那两朵云
  gapPoly(g, densify(catmull([
    [x + 22, gy - 202], [x + 92, gy - 190], [x + 150, gy - 156], [x + 196, gy - 112],
  ], 8), 5), { w: 3.8, seed: 1361, eat: 0.14, rgb: ink });
  gapPoly(g, densify(catmull([
    [x + 20, gy - 188], [x + 86, gy - 168], [x + 160, gy - 178], [x + 232, gy - 152],
  ], 8), 5), { w: 3.2, seed: 1362, eat: 0.16, rgb: ink });
}

// ------------------------------------------------------------
// 云气轮：圆形漩涡 + 三条卷尾，随 swirlAngle 转，第 3 拍甩尾
// ------------------------------------------------------------
function cloudWheel(g, cx, cy, r, ang, whip, seed, ink) {
  // 轮辋
  gapPoly(g, circPts(cx, cy, r, 28), { w: 8.0, seed, eat: 0.09, closed: true, rgb: ink });
  // 内圈
  gapPoly(g, circPts(cx, cy, r * 0.72, 22), { w: 3.2, seed: seed + 11, eat: 0.16, closed: true, rgb: ink });
  // 漩涡
  const sp = [];
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    const a = ang + u * 1.5 * TAU;
    const rr = r * (0.86 - 0.74 * u);
    sp.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  gapPoly(g, sp, { w: 5.8, seed: seed + 3, eat: 0.10, rgb: ink });
  // 三条卷尾
  for (let k = 0; k < 3; k++) {
    const a0 = ang + (k * TAU) / 3;
    const tp = [];
    const r1 = r * (1.58 + whip * 0.46);
    for (let i = 0; i <= 19; i++) {
      const u = i / 19;
      const a = a0 + u * (0.60 + whip * 0.18) * TAU;
      const rr = r * 0.92 + (r1 - r * 0.92) * u;
      tp.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    gapPoly(g, tp, { w0: 5.4, w1: 2.2, seed: seed + 20 + k * 9, eat: 0.11, rgb: ink });
  }
  // 轴心
  disc(g, cx, cy, r * 0.17, { rgb: ink });
}
