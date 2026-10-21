// ============================================================
// s16-8bit.js — 第 16 版块：8-bit 像素游戏（1980s 横版过关）
// 美术简报：briefs/s16-8bit.md
//
// 三条铁律：
//   1 一切对齐 P=8 网格，只用 g.rect() 画方块（无椭圆/圆弧/渐变/半透明）
//   2 调色板只用简报列出的 12 色（云白与白同色 → 11 个唯一色）
//   3 内部时间量化到 10fps：q = floor(local*10)/10
// 版权：不复制任何真实游戏的角色/敌人/关卡布局
//       金币是自绘竖条、问号箱是自绘砖块、HUD 只用 SCORE/TIME/1UP/×0N
// ============================================================

import { routeU } from '../beat/beats.js';

const P = 8;

// ---- 调色板（简报 12 色，去重复白 → 11 个唯一色）----
const C_SKY = '#5c94fc';   // 天蓝
const C_WHT = '#fcfcfc';   // 云白 / 白
const C_MTN = '#008000';   // 山绿
const C_GRS = '#00a800';   // 草绿
const C_BRK = '#c84c0c';   // 砖
const C_BRD = '#7c2c00';   // 砖暗
const C_GLD = '#e8a03a';   // 金
const C_GLDD = '#a86400';  // 金暗
const C_CEL = '#1f8a94';   // 青瓷（舱体）
const C_BRS = '#c9973f';   // 黄铜（舱体）
const C_BLK = '#1a1a1a';   // 黑

// ---- 版面（全部落在 8 单位网格上）----
const HUD_H = 120;          // HUD 条
const GROUND_Y = 700;       // 地面顶（舱体脚底）
const GROUND_B = 776;       // 地面砖底（再往下是公路带）
const GRASS_Y = 664;        // 草坡带顶
const BUSH_Y = 632;         // 灌木带顶
const PIT_A = [296, 400];   // 坑洞 1
const PIT_B = [616, 704];   // 坑洞 2
const PIT_FLOOR = 744;      // 坑洞黑底到这一行，再往下是深色
const BOX_Y = 456;          // 问号箱顶（64×64）
const BOX_XS = [240, 520, 800];

// 金币弧线（7 枚，中间最高）
const COIN_XS = [200, 288, 376, 464, 552, 640, 728];
const COIN_YS = [600, 584, 568, 560, 568, 584, 600];
const COIN_W = [32, 24, 8, 24, 32];   // 旋转 5 档（宽 8→6→2→6→8 的比例）
const COIN_H = 48;

// 跳跃段（按舱体中心 x）：跨坑 1 / 小跳顶箱子 / 跨坑 2
const JUMPS = [
  { x0: 240, x1: 456, h: 112 },
  { x0: 460, x1: 532, h: 64 },
  { x0: 560, x1: 760, h: 112 },
];

// ============================================================
// 时间 ↔ 位置：routeU 单调，二分求出"舱体中心到达 x"的局部时刻
// ============================================================
function timeAtX(x) {
  let lo = 0, hi = 6;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (routeU(m) * 1000 < x) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

const q10 = (v) => Math.floor(v * 10) / 10;
const snap = (v) => Math.round(v / P) * P;

// 小跳的顶点正对中间那个问号箱 → 顶箱时刻 = 到达跳顶点的时刻
const HOP = JUMPS[1];
const BOX_T = q10(timeAtX((HOP.x0 + HOP.x1) / 2));

function inPit(x) {
  return (x > PIT_A[0] && x < PIT_A[1]) || (x > PIT_B[0] && x < PIT_B[1]);
}

// 每枚金币被吃到的时刻（舱体中心越过金币 x）
const COIN_EAT = COIN_XS.map((x) => q10(timeAtX(x)));

// ============================================================
// 5×7 点阵字模（自绘，不用 text()）
// ============================================================
const FONT = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const textW = (str, u) => str.length * 6 * u - u;

function drawText(g, str, x, y, u, col) {
  g.fill(col);
  let cx = x;
  for (const ch of str) {
    const gl = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      const row = gl[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === '#') g.rect(cx + c * u, y + r * u, u, u);
      }
    }
    cx += 6 * u;
  }
}

// ============================================================
// 像素精灵位图（模块级常量）
// ============================================================
const KEYMAP = {
  W: C_WHT, M: C_MTN, G: C_GRS, S: C_GLD,
  B: C_BRK, D: C_BRD, Y: C_GLD, O: C_GLDD,
  T: C_CEL, R: C_BRS, K: C_BLK,
};

// 云 6×5
const SPR_CLOUD = [
  '..WW..',
  '.WWWW.',
  'WWWWWW',
  'WWWWWW',
  '.WWWW.',
];

// 大山 14×10（u=16 → 224×160）
const SPR_MTN = [
  '......MM......',
  '.....MMMM.....',
  '....MMGGMM....',
  '...MMGGGGMM...',
  '..MMGGGGGGMM..',
  '.MMGGGGGGGGMM.',
  'MMGGGGGGGGGGMM',
  'MMGGGGGGGGGGMM',
  'MMGGGGGGGGGGMM',
  'MMGGGGGGGGGGMM',
];

// 小山 10×6（u=16 → 160×96）
const SPR_MTN2 = [
  '....MM....',
  '...MMMM...',
  '..MMGGMM..',
  '.MMGGGGMM.',
  'MMGGGGGGMM',
  'MMGGGGGGMM',
];

// 灌木 8×4
const SPR_BUSH = [
  '..GGGG..',
  '.GGGGGG.',
  'GGGGGGGG',
  'MMMMMMMM',
];

// 问号箱 8×8（外框金暗 + 砖面金 + 中间问号点阵）
const SPR_QUESTION = [
  'OOOOOOOO',
  'O.KKK.YO',
  'OK...KYO',
  'O....KYO',
  'O..KK.YO',
  'O..K..YO',
  'O..K..YO',
  'OOOOOOOO',
];

// ---- 时空舱：14 宽 × 18 高（112 × 144 单位）----
// T 青瓷 / R 黄铜 / K 窗黑 / Y 灯金 / S 驾驶员肤色 / O 喷口金暗
const SPR_CAPSULE = [
  '......Y.......',
  '.....YYY......',
  '.....YYY......',
  '......Y.......',
  '......R.......',
  '.....RRR......',
  '....RRRRR.....',
  '...RRRRRRR....',
  '.RRRRRRRRRRRR.',
  '.TTTTTTTTTTTT.',
  '.TTKKTKKTKKTT.',
  '.TTKKTSSTKKTT.',
  '.TTTTTTTTTTTT.',
  '.TTKKTKKTKKTT.',
  '.TTKKTKKTKKTT.',
  '.TTTTTTTTTTTT.',
  '.TRRTTTTRRTTT.',
  '.ROTTOTTOTTOR.',
];

// 跳跃帧：底部收缩 2 像素块
const SPR_CAPSULE_JUMP = [
  '......Y.......',
  '.....YYY......',
  '.....YYY......',
  '......Y.......',
  '......R.......',
  '.....RRR......',
  '....RRRRR.....',
  '...RRRRRRR....',
  '.RRRRRRRRRRRR.',
  '.TTTTTTTTTTTT.',
  '.TTKKTKKTKKTT.',
  '.TTKKTSSTKKTT.',
  '.TTTTTTTTTTTT.',
  '.TTKKTKKTKKTT.',
  '.TTKKTKKTKKTT.',
  '.TTTTTTTTTTTT.',
  '..TTTTTTTTTT..',
  '..O..O..O..O..',
];

// 落地压扁帧：由正常帧派生 —— 去掉底部 2 行，舱身左右各加 1 列（宽 +2 / 高 -2）
function makeSquash(spr) {
  return spr.slice(0, spr.length - 2).map((row) => {
    const i0 = row.indexOf('T');
    const i1 = row.lastIndexOf('T');
    if (i0 < 0) return '.' + row + '.';
    return row.slice(0, i0) + 'T' + row.slice(i0, i1 + 1) + 'T' + row.slice(i1 + 1);
  });
}
const SPR_CAPSULE_SQUASH = makeSquash(SPR_CAPSULE);
const CAP_W = 14;              // 正常帧宽（块）
const CAP_H = 18;              // 正常帧高（块）

// 逐格画块：px,py 为左上角单位坐标，u 为每格边长
// bright=true 时把绿/白两对调色板色各提亮一档（过框闪光），舱体色不变
function drawSprite(g, spr, px, py, u, bright) {
  for (let r = 0; r < spr.length; r++) {
    const row = spr[r];
    for (let c = 0; c < row.length; c++) {
      const k = row[c];
      if (k === '.') continue;
      g.fill(bright ? brightMap(k) : KEYMAP[k]);
      g.rect(px + c * u, py + r * u, u, u);
    }
  }
}

function brightMap(k) {
  if (k === 'W') return C_SKY;    // 云白 → 天蓝
  if (k === 'M') return C_GRS;    // 山绿 → 草绿
  if (k === 'G') return C_GLD;    // 草绿 → 金
  return KEYMAP[k];
}

// ============================================================
// 地形
// ============================================================
function drawGround(g, bright) {
  const base = bright ? C_GLD : C_BRK;
  const seam = bright ? C_BRK : C_BRD;
  for (let y = GROUND_Y; y < GROUND_B; y += P) {
    for (let x = 0; x < 1000; x += P) {
      const cx = x + P / 2;
      if (inPit(cx)) g.fill(y < PIT_FLOOR ? C_BLK : C_BRD);
      else g.fill(base);
      g.rect(x, y, P, P);
    }
    // 横缝
    g.fill(seam);
    for (let x = 0; x < 1000; x += P) {
      if (inPit(x + P / 2) && y < PIT_FLOOR) continue;
      g.rect(x, y, P, 2);
    }
  }
  // 竖缝（错缝砌法）
  let row = 0;
  for (let y = GROUND_Y; y < GROUND_B; y += P, row++) {
    const off = row % 2 === 0 ? 0 : P;
    g.fill(seam);
    for (let x = off; x < 1000; x += 2 * P) {
      if (inPit(x + P / 2) && y < PIT_FLOOR) continue;
      g.rect(x, y, 2, P);
    }
  }
}

// 公路带（770..940）会被主调度盖住，这里画成砖地的向下延伸（稍暗）
function drawDeep(g) {
  g.fill(C_BRD);
  g.rect(0, GROUND_B, 1000, 1000 - GROUND_B);
  g.fill(C_BLK);
  for (let y = GROUND_B; y < 1000; y += P) g.rect(0, y, 1000, 2);
  let row = 0;
  for (let y = GROUND_B; y < 1000; y += P, row++) {
    const off = row % 2 === 0 ? 0 : P;
    for (let x = off; x < 1000; x += 2 * P) g.rect(x, y, 2, P);
  }
}

// ============================================================
// 主渲染
// ============================================================
export function render(g, meta, local, index) {
  const q = q10(local);
  // 过框：调色板整体提亮一档再收回
  const lift = Math.max(
    Math.exp(-Math.pow(local / 0.22, 2)),
    Math.exp(-Math.pow((6 - local) / 0.22, 2)),
  );
  const bright = lift > 0.4;

  g.push();
  g.noStroke();

  // ---- 天空 ----
  g.fill(bright ? C_WHT : C_SKY);
  g.rect(0, 0, 1000, 1000);

  // ---- 三团像素云（随 q 向左漂移）----
  const clouds = [{ x: 96, y: 200 }, { x: 456, y: 144 }, { x: 792, y: 248 }];
  for (let i = 0; i < clouds.length; i++) {
    let cx = clouds[i].x - q * (12 + i * 6);
    cx = ((cx % 1160) + 1160) % 1160 - 80;
    drawSprite(g, SPR_CLOUD, snap(cx), clouds[i].y, P, bright);
  }

  // ---- 两座像素山（山脚正好落在草坡上）----
  drawSprite(g, SPR_MTN, 96, 504, 16, bright);
  drawSprite(g, SPR_MTN2, 688, 568, 16, bright);

  // ---- 草坡带 + 一排灌木 ----
  g.fill(bright ? C_GLD : C_GRS);
  g.rect(0, GRASS_Y, 1000, GROUND_Y - GRASS_Y);
  const bushXs = [40, 152, 264, 376, 488, 600, 712, 824, 936];
  for (const bx of bushXs) drawSprite(g, SPR_BUSH, bx, BUSH_Y, P, bright);

  // ---- 砖块地面（含两个坑洞）+ 向下的暗砖延伸 ----
  drawGround(g, bright);
  drawDeep(g);

  // ---- 坑洞口：左右各一块金砖提示"这里有坑" ----
  for (const pit of [PIT_A, PIT_B]) {
    g.fill(C_GLD);
    g.rect(pit[0], GROUND_Y, P, P);
    g.rect(pit[1] - P, GROUND_Y, P, P);
  }

  // ---- 3 个问号箱 ----
  const bump = boxBump(q);
  for (let i = 0; i < BOX_XS.length; i++) {
    const bx = BOX_XS[i] - 4 * P;       // 64 宽的箱子以 BOX_XS 为中心
    const by = BOX_Y - (i === 1 ? bump : 0);
    if (i === 1 && q >= BOX_T + 0.3) {
      // 顶过的箱子变"用过的"：金暗壳 + 砖暗芯
      g.fill(C_GLDD);
      g.rect(bx, by, 8 * P, 8 * P);
      g.fill(C_BRD);
      g.rect(bx + P, by + P, 6 * P, 6 * P);
    } else {
      drawSprite(g, SPR_QUESTION, bx, by, P);
    }
  }

  // ---- 顶箱子弹出的金币（5 帧）----
  const pop = boxPopCoin(q);
  if (pop) drawCoin(g, BOX_XS[1], pop.y, pop.w);

  // ---- 7 枚金币 ----
  for (let i = 0; i < COIN_XS.length; i++) {
    const st = coinState(i, q);
    if (st.visible) drawCoin(g, COIN_XS[i], COIN_YS[i], st.w);
  }

  // ---- HUD ----
  drawHUD(g, q);

  g.pop();
}

// ============================================================
// HUD：y 0..120，深蓝底（#1a1a1a），三栏
// ============================================================
function drawHUD(g, q) {
  g.fill(C_BLK);
  g.rect(0, 0, 1000, HUD_H);
  g.fill(C_BRS);
  g.rect(0, HUD_H, 1000, P);          // 与天空的分隔线

  const U = P;                        // 每点 8 单位 → 字高 56
  const eaten = coinsEaten(q);

  // 左：SCORE / 001350（吃一枚 +200）
  drawText(g, 'SCORE', 24, 8, U, C_WHT);
  const score = 1350 + 200 * eaten;
  drawText(g, String(score).padStart(6, '0'), 24, 64, U, C_GLD);

  // 中：金币图标 + ×0N
  drawCoin(g, 452, 40, 32);
  const n = 3 + eaten + (q >= 4.0 ? 1 : 0);   // 第三次 1UP 那拍再 +1
  drawText(g, '×' + String(n).padStart(2, '0'), 496, 8, U, C_GLD);

  // 右：TIME / 118 → 117
  drawText(g, 'TIME', 976 - textW('TIME', U), 8, U, C_WHT);
  drawText(g, q >= 4.0 ? '117' : '118', 976 - textW('118', U), 64, U, C_WHT);
}

// ============================================================
// 金币：自绘 8-bit 竖条（绝不用真实金币造型）
// ============================================================
function drawCoin(g, cx, cy, w) {
  const h = COIN_H;
  const x = snap(cx - w / 2);
  const y = snap(cy - h / 2);
  g.fill(C_GLDD);
  g.rect(x, y, w, h);
  const inset = w >= 24 ? 4 : 0;
  g.fill(C_GLD);
  g.rect(x + inset, y + 4, w - inset * 2, h - 8);
  if (w >= 24) {
    g.fill(C_WHT);
    g.rect(x + w / 2 - 2, y + 12, 4, h - 24);
  }
}

// 旋转相位：每拍推进一帧
function spinW(q, i) {
  const f = Math.floor(q * 10) + i * 2 + Math.floor(q / 0.5);
  return COIN_W[((f % COIN_W.length) + COIN_W.length) % COIN_W.length];
}

// 第 i 枚金币：没吃到 → 旋转；吃到 → 5 档收缩后消失
function coinState(i, q) {
  const d = q - COIN_EAT[i];
  if (d < 0) return { visible: true, w: spinW(q, i) };
  const f = Math.floor(d / 0.1 + 1e-6);
  if (f >= 5) return { visible: false, w: 0 };
  return { visible: true, w: COIN_W[f] };
}

function coinsEaten(q) {
  let n = 0;
  for (let i = 0; i < COIN_XS.length; i++) if (q >= COIN_EAT[i]) n++;
  return n;
}

// 箱子被顶起：3 帧（顶起 32 单位再落回）
function boxBump(q) {
  if (q < BOX_T || q > BOX_T + 0.3) return 0;
  const f = Math.min(2, Math.floor((q - BOX_T) / 0.1 + 1e-6));
  return [32, 16, 0][f];
}

// 顶出的金币：向上弹出再落下（5 帧）
function boxPopCoin(q) {
  if (q < BOX_T || q > BOX_T + 0.5) return null;
  const f = Math.min(4, Math.floor((q - BOX_T) / 0.1 + 1e-6));
  const ys = [BOX_Y - 16, BOX_Y - 48, BOX_Y - 72, BOX_Y - 48, BOX_Y - 16];
  return { y: ys[f], w: COIN_W[f] };
}

// 1UP：local 2.0 / 3.0 / 4.0 各一次，升 60 单位后消失
function oneUpState(q) {
  for (const t0 of [2.0, 3.0, 4.0]) {
    if (q >= t0 && q < t0 + 0.7) {
      const f = Math.floor((q - t0) / 0.1 + 1e-6);
      return { f, rise: Math.min(6, f) * 10 };
    }
  }
  return null;
}

// ============================================================
// 舱体：像素精灵，沿地面前进，遇坑起跳
// ============================================================
export function drawVehicle(g, { x, local, wave }) {
  const q = q10(local);
  const px = snap(x);                 // 舱体中心（对齐 8 网格）
  const jp = jumpState(px);
  const squash = landingSquash(px);
  const airborne = jp.h > 0;
  const feetY = GROUND_Y - jp.h;

  g.push();
  g.noStroke();

  // ---- 1UP 弹出（舱顶上升 60 单位）----
  const up = oneUpState(q);
  if (up && up.f < 6) {
    const uw = textW('1UP', P);
    drawText(g, '1UP', snap(px - uw / 2), snap(feetY - CAP_H * P - 24 - up.rise), P,
      up.f < 4 ? C_WHT : C_GLD);
  }

  // ---- 尘土：起跳 / 落地各一次，3 帧 ----
  for (const d of dustPuffs(px)) {
    g.fill(C_WHT);
    g.rect(snap(px + d.dx), snap(GROUND_Y - d.r * P), P, P);
    g.fill(C_BRD);
    g.rect(snap(px + d.dx), snap(GROUND_Y - d.r * P + P), P, P);
  }

  // ---- 舱体精灵 ----
  let spr, left, top;
  if (squash && !airborne) {
    spr = SPR_CAPSULE_SQUASH;         // 16 宽 × 16 高
    left = px - 8 * P;
    top = feetY - 16 * P;
  } else {
    spr = airborne ? SPR_CAPSULE_JUMP : SPR_CAPSULE;
    left = px - (CAP_W / 2) * P;
    top = feetY - CAP_H * P;
  }
  drawSprite(g, spr, left, top, P);

  // ---- 驾驶员挥手（10fps 两档切换）----
  if (wave && !airborne) {
    const f = Math.floor(q * 10) % 2;
    const ax = left + 8 * P;
    const ay = top + 10 * P;
    g.fill(C_GLD);
    if (f === 0) {
      g.rect(ax, ay, P, P);
      g.rect(ax + P, ay - P, P, P);
    } else {
      g.rect(ax, ay - P, P, P);
      g.rect(ax + P, ay - 2 * P, P, P);
    }
  }

  // ---- 底部四喷口的火焰块 ----
  const fl = Math.floor(q * 10) % 2;
  g.fill(airborne ? C_GLD : C_BRS);
  for (let i = 0; i < 4; i++) {
    g.rect(left + (2 + i * 3) * P, feetY - (fl === 0 ? 0 : P), P, P);
  }

  g.pop();
}

// 跳跃：抛物线，量化到网格
function jumpState(px) {
  for (const j of JUMPS) {
    if (px >= j.x0 && px <= j.x1) {
      const u = (px - j.x0) / (j.x1 - j.x0);
      return { h: Math.max(0, snap(4 * j.h * u * (1 - u))) };
    }
  }
  return { h: 0 };
}

// 落地压扁一帧
function landingSquash(px) {
  for (const j of JUMPS) {
    if (px >= j.x1 - P && px <= j.x1 + P) return true;
  }
  return false;
}

// 尘土：起跳点与落地点各一次，3 帧
function dustPuffs(px) {
  const out = [];
  for (const j of JUMPS) {
    if (px >= j.x0 && px <= j.x0 + 3 * P) {
      const f = Math.floor((px - j.x0) / P);
      if (f < 3) out.push({ dx: -2 * P - f * P, r: 1 + f });
    }
    if (px >= j.x1 - 2 * P && px <= j.x1 + P) {
      const f = Math.floor((px - (j.x1 - 2 * P)) / P);
      if (f < 3) out.push({ dx: 2 * P + f * P, r: 1 + f });
    }
  }
  return out;
}
