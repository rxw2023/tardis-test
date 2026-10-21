// ============================================================
// s09-bada.js — 第 09 版块：八大山人写意（约1690）
//
// 一句话美术口径：一张宣纸，四处墨，其余全是空白。
//
//   纸：米黄宣纸满铺（纤维 + 云斑，缓存层）
//   墨：四处而已 —— 中间偏上翻白眼的方盒子（＝本格时空舱）、
//       左下一丛三笔兰草、右下一条更小的翻白眼鱼、右上角一枚朱印，
//       外加最右侧一列极小淡墨竖排自撰小字
//   笔：一笔成形，涩笔飞白（dry 0.42~0.62 / taper 0.6~0.85 / weight 5~14），
//       全格墨笔 16 笔，绝不加第二遍修改性复笔
//   梗：两个白眼隔着大片空白互相瞪着，谁也不动；
//       强拍上鱼尾一摆、眼珠抖一下（2 单位位移弹回）、兰草微微一晃
//   过框：全幅墨色统一加深 12% 再收回
//
// 版权：只取"清初大写意"这一公有领域笔法概念，不临摹任何具体作品，
//       不署名，印章内是自创抽象符号。
// ============================================================

import { TAU, BAR, SCENE_LEN, hoverY } from '../beat/beats.js';
import { catmull, vignette } from '../kit/kit.js';
import { paper, inkStroke, seal } from '../kit/ink.js';

const PAPER = [236, 231, 219];
const INK = [34, 32, 29];
const SEAL = [154, 58, 42];
const ZH = '"KaiTi","STKaiti","SimSun",serif';

// 舱体不落公路：整只盒子悬在留白里（八大式"无地"），
// 竖直位置由贴地线 y(890) 上抬 420 得到，悬浮起伏取 0.6 倍（更慢更慵懒）
const HOVER_UP = 420;
const TILT = -0.028;                 // 盒子整体微微歪斜（奇崛）

// ---- 方盒子：局部坐标（原点 = 盒心，+x 右，+y 下）----
// 一笔框：上宽下窄，角点用重复点收紧（方盒感），左边收笔留断锋
const BOX_OUT = [
  [-116, -112], [2, -124],
  [120, -120], [120, -120],
  [116, -6], [100, 114], [100, 114],
  [8, 126], [-84, 124], [-84, 124],
  [-106, 4], [-114, -88],
];
// 底部鱼尾状一撇（宽底座）：比盒身更宽、略脱开，右端出挑收飞白
const BOX_TAIL = [[-124, 152], [-56, 144], [30, 148], [122, 128]];
// 两只眼白（留白，只用两条椭圆线围出形状）+ 靠上翻的偏心眼珠
const EYE_L = { x: -50, y: -46, rx: 33, ry: 24, px: -57, py: -60 };
const EYE_R = { x: 54, y: -50, rx: 33, ry: 24, px: 61, py: -64 };

// ---- 左下一丛兰草（三笔）----
const GRASS_PIVOT = [256, 664];
const GRASS = [
  { ctrl: [[258, 660], [236, 622], [210, 588], [194, 562]], w: 9.0, s: 61 },
  { ctrl: [[256, 662], [268, 624], [276, 582], [271, 550]], w: 8.4, s: 63 },
  { ctrl: [[250, 664], [284, 648], [314, 630], [328, 610]], w: 7.2, s: 65 },
];

// ---- 右下一条更小的翻白眼鱼（五笔：背 / 腹 / 尾 / 眼 / 珠）----
const FISH_TAIL_PIVOT = [786, 644];
const FISH_BACK = [[702, 663], [732, 637], [762, 633], [788, 643]];
const FISH_BELLY = [[788, 645], [762, 671], [730, 681], [708, 673]];
const FISH_TAIL = [[786, 644], [800, 630], [792, 666]];
const FISH_EYE = { x: 720, y: 653, rx: 8.5, ry: 6.8, px: 717.5, py: 647.5 };

let paperLayer = null;

// ------------------------------------------------------------
export function render(g, meta, local) {
  g.image(ensurePaper(g), 0, 0, 1000, 1000);
  vignette(g, 0, 0, 1000, 1000, 16);

  const glow = crossGlow(local);

  drawGrass(g, local, glow);
  drawFish(g, local, glow);
  drawSealMark(g);
  drawColophon(g);

  // 过框：全幅墨色统一加深 12%（读作镜头推近），随即收回
  if (glow > 0.01) {
    g.push();
    g.noStroke();
    g.fill(INK[0], INK[1], INK[2], 255 * 0.12 * glow);
    g.rect(0, 0, 1000, 1000);
    g.pop();
  }
}

export function drawVehicle(g, { x, y, local }) {
  const cy = y - HOVER_UP + hoverY(local) * 0.6;
  drawBox(g, x, cy, local);
}

// ============================================================
// 纸
// ============================================================
function ensurePaper(g) {
  if (paperLayer) return paperLayer;
  paperLayer = paper(g, {
    w: 1000, h: 1000, scale: 2, seed: 909,
    base: PAPER, fiber: 1.4, mottle: 0.7,
  });
  return paperLayer;
}

// ============================================================
// 一、翻白眼的方盒子（时空舱）—— 8 笔
// ============================================================
function drawBox(g, cx, cy, local) {
  const glow = crossGlow(local);
  const A = (a) => inkA(a, glow);
  const flick = pulse(local, BAR, 0);          // 第 1 拍：尾一摆
  const shake = jitter(local, BAR, 1.0);       // 第 3 拍：眼珠抖一下（位移 2，弹回）

  g.push();
  g.translate(cx, cy);
  g.rotate(TILT);

  // 1 一笔歪斜方框（起笔重、收笔断锋）
  brush(g, BOX_OUT, 11, { a: A(0.95), w: 11, t: 0.74, d: 0.16, wb: 1.0, s: 21 });

  // 2、3 两块眼白：只是两条线围出的留白
  brush(g, oval(EYE_L.x, EYE_L.y, EYE_L.rx, EYE_L.ry, 5), 4,
    { a: A(0.82), w: 5.4, t: 0.62, d: 0.22, s: 33 });
  brush(g, oval(EYE_R.x, EYE_R.y, EYE_R.rx, EYE_R.ry, 5), 4,
    { a: A(0.82), w: 5.4, t: 0.62, d: 0.24, s: 37 });

  // 4、5 两颗偏心小黑眼珠（靠上翻）＋ 强拍上抖一下
  inkDot(g, EYE_L.px + shake * 1.6, EYE_L.py - shake, 6.2, A(0.95));
  inkDot(g, EYE_R.px + shake * 1.6, EYE_R.py - shake, 6.2, A(0.95));

  // 6 头顶呆毛（一笔短竖）
  brush(g, [[-2, -120], [2, -136], [8, -148]], 3,
    { a: A(0.86), w: 5.2, t: 0.72, d: 0.2, s: 41 });
  // 7 呆毛挑着的一点（六角灯笼）
  inkDot(g, 9, -158, 5.4, A(0.9));

  // 8 底部鱼尾状一撇（宽底座）＋ 强拍上一摆
  brush(g, rotateCtrl(BOX_TAIL, -124, 152, 0.055 * flick), 6,
    { a: A(0.92), w: 11, t: 0.83, d: 0.2, wb: 0.8, s: 51 });

  g.pop();
}

// ============================================================
// 二、左下一丛兰草 —— 3 笔（第 5 拍整体轻晃 0.5°）
// ============================================================
function drawGrass(g, local, glow) {
  const sway = 0.0087 * pulse(local, 4, 2);
  for (const leaf of GRASS) {
    const ctrl = rotateCtrl(leaf.ctrl, GRASS_PIVOT[0], GRASS_PIVOT[1], sway);
    brush(g, ctrl, 4, {
      a: inkA(0.8, glow), w: leaf.w, t: 0.85, d: 0.24, wb: 1.0, s: leaf.s,
    });
  }
}

// ============================================================
// 三、右下一条更小的翻白眼鱼 —— 5 笔（强拍上鱼尾一摆）
// ============================================================
function drawFish(g, local, glow) {
  const flick = pulse(local, BAR, 0);

  // 背：一笔自头沿背脊到尾根
  brush(g, FISH_BACK, 4, { a: inkA(0.9, glow), w: 8.0, t: 0.7, d: 0.26, wb: 0.6, s: 71 });
  // 腹：一笔自尾根沿腹部收回（头端留一点嘴缝）
  brush(g, FISH_BELLY, 4, { a: inkA(0.78, glow), w: 6.4, t: 0.74, d: 0.3, wb: 0.6, s: 72 });
  // 尾：一笔分叉，强拍上摆一下并淡重画一次
  const tail = rotateCtrl(FISH_TAIL, FISH_TAIL_PIVOT[0], FISH_TAIL_PIVOT[1], 0.14 * flick);
  brush(g, tail, 3, { a: inkA(0.8, glow), w: 6.6, t: 0.8, d: 0.34, s: 73 });
  if (flick > 0.02) {
    brush(g, rotateCtrl(FISH_TAIL, FISH_TAIL_PIVOT[0], FISH_TAIL_PIVOT[1], 0.28 * flick), 3,
      { a: inkA(0.4 * flick, glow), w: 5.4, t: 0.85, d: 0.62, s: 75 });
  }
  // 眼（一圈）＋ 靠上翻的珠
  brush(g, oval(FISH_EYE.x, FISH_EYE.y, FISH_EYE.rx, FISH_EYE.ry, 5), 2,
    { a: inkA(0.8, glow), w: 4.0, t: 0.6, d: 0.22, s: 77 });
  inkDot(g, FISH_EYE.px, FISH_EYE.py, 3.2, inkA(0.95, glow));
}

// ============================================================
// 四、右上角朱印（自创抽象符号，不署名）
// ============================================================
function drawSealMark(g) {
  seal(g, 846, 92, 1.5, '');
  // 印内抽象刻符：三笔朱色短线，不成字
  g.push();
  g.noFill();
  g.strokeCap(g.SQUARE);
  g.stroke(SEAL[0], SEAL[1], SEAL[2], 215);
  g.strokeWeight(3.0);
  g.line(858, 106, 886, 103);
  g.line(871, 103, 869, 137);
  g.strokeWeight(2.6);
  g.line(861, 126, 880, 120);
  g.noStroke();
  g.fill(SEAL[0], SEAL[1], SEAL[2], 200);
  g.circle(860, 114, 4.2);
  g.pop();
}

// ============================================================
// 最右侧竖排极小自撰小字（淡墨）
// ============================================================
function drawColophon(g) {
  const txt = '翻白眼者，非鱼也';
  g.push();
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 116);
  g.textFont(ZH);
  g.textSize(16);
  g.textAlign(g.CENTER, g.CENTER);
  for (let i = 0; i < txt.length; i++) g.text(txt[i], 952, 596 + i * 19);
  g.pop();
}

// ============================================================
// 笔法 / 节拍 小工具
// ============================================================

// 一笔 = 同一路径画两遍（简报上限，不再多）：
//   主笔：全路径、近乎实心（kit 的 dry 是"整段跳过"，跳多了就成串珠），
//         浓淡靠 kit 自带的逐段 alpha 抖动
//   复笔：只取路径末段 40%、高干 —— 收笔化成断锋飞白尾巴
function brush(g, ctrl, perSeg, o) {
  const pts = catmull(ctrl, perSeg);
  inkStroke(g, pts, {
    rgb: INK, alpha: o.a, weight: o.w,
    taper: o.t, dry: 0.05, wobble: o.wb || 0, seed: o.s,
  });
  const k = Math.floor(pts.length * 0.6);
  inkStroke(g, pts.slice(k), {
    rgb: INK, alpha: o.a * 0.5, weight: o.w * 0.55,
    taper: 0.85, dry: 0.5, seed: o.s + 7,
  });
}

// 墨点（眼珠 / 灯笼）：实心核 + 一圈淡晕
function inkDot(g, x, y, r, alpha) {
  g.push();
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 255 * alpha * 0.5);
  g.ellipse(x + r * 0.2, y - r * 0.1, r * 2.55, r * 2.45);
  g.fill(INK[0], INK[1], INK[2], 255 * alpha);
  g.ellipse(x, y, r * 2.1, r * 2.05);
  g.pop();
}

function oval(cx, cy, rx, ry, n) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return p;
}

function rotateCtrl(ctrl, cx, cy, ang) {
  if (!ang) return ctrl;
  const c = Math.cos(ang), s = Math.sin(ang);
  return ctrl.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

// 强拍脉冲：命中即 1，随后快速衰减
function pulse(local, period, offset) {
  const ph = (((local - offset) % period) + period) % period;
  return Math.exp(-Math.pow(ph / 0.15, 2));
}

// 眼珠的"抖"：2 单位位移后弹回（震动而非转动）
function jitter(local, period, offset) {
  const ph = (((local - offset) % period) + period) % period;
  return 2 * Math.exp(-ph / 0.12) * Math.sin(ph * 44);
}

// 过框辉光 0..1
function crossGlow(local) {
  const d = Math.min(local, SCENE_LEN - local);
  return Math.exp(-Math.pow(d / 0.42, 2));
}

// 过框时墨色加深 12%
function inkA(a, glow) {
  return Math.min(1, a * (1 + 0.12 * glow));
}
