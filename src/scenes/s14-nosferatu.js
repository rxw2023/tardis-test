// ============================================================
// s14-nosferatu.js — 第 14 版块：诺斯费拉图（1922 德国表现主义默片）
//   哥特楼梯间 · 高反差三级阶调 · 胶片颗粒 / 划痕 / 帧间闪烁
//   本格核心：只画时空舱的「影子」，本体永不出现（影子比本体早到）
//   local 5.40→6.00：影子「通电」→ 示波器绿线描图形（#33ff66），与第 15 格无缝衔接
// 简报：briefs/14-nosferatu.md   技术契约：briefs/API.md
// 版权：只取 1922 表现主义默片风格；人物与场景全部自绘，不复制任何影片具体造型
// ============================================================

import { mulberry32, vignette } from '../kit/kit.js';
import { smooth } from '../beat/beats.js';

// ---------------- 调色：三级阶调 + 月光冷白 + 唯一非中性暗红 ----------------
const BLACK = '#0a0a0c';
const MID = '#4a4a52';
const WHITE = '#e8e6e0';
const MOON = '#c8d4e0';
const RED = '#5a1a1a';
const GREEN_RGB = '51,255,102';   // #33ff66（与第 15 格 ink 一致，硬编码）

// ---------------- 楼梯几何 ----------------
const SX0 = 90, SY0 = 756;        // 最低一级踏板前缘
const RISE = 48, RUN = 62;        // 每级高 48 深 62
const NSTEP = 9;                  // 9 级
const DX = 18, DY = 24;           // 踏板进深（微伪透视）
const WALL_X = 660;               // 右侧石墙左边界
const FLOOR_Y = 772;              // 楼梯实体下沿（公路从 770 起）

// 尖拱窗
const WIN = { l: 700, r: 900, sill: 290, spring: 230, apex: 57, cx: 800 };

// ---------------- 影子几何（本体 178×196，纵向拉长 1.8 倍后整体缩到 0.7）----------------
const SHW = 124;                  // 影宽
const SHB = 247;                  // 影身高（196 × 1.8 × 0.7）
const SHS = 60;                   // 灯笼尖头
const SHN = 54;                   // 喷口尖刺
const SHTOT = SHB + SHS;
const DRAPE = 0.5;                // 台阶折角量（1=完全按台阶折，0=平滑斜线）
const WALL_LEAN = 0.25;           // 上墙后影子的倾斜率

// ============================================================
// 静态层：石墙 + 楼梯 + 尖拱窗 + 月光（整格不变，烘焙一次）
// ============================================================
let setLayer = null;

function ensureSet(g) {
  if (setLayer) return setLayer;
  const pg = g.createGraphics(1000, 1000);
  pg.pixelDensity(1);
  const ctx = pg.drawingContext;

  pg.noStroke();
  pg.fill(BLACK);
  pg.rect(0, 0, 1000, 1000);

  // ---- 楼梯背后的暗墙（竖木板，暗灰，给影子和人物剪影一块可读的幕布）----
  pg.fill(38, 38, 48);
  pg.rect(0, 0, WALL_X + 6, FLOOR_Y);
  const rb = mulberry32(3311);
  for (let i = 0; i < 18; i++) {
    const x = rb() * (WALL_X + 20);
    pg.stroke(26, 26, 34, 210);
    pg.strokeWeight(1 + rb() * 1.4);
    pg.line(x, 0, x + (rb() - 0.5) * 7, FLOOR_Y);
  }
  pg.noStroke();

  // ---- 右侧粗糙石墙 ----
  pg.fill(MID);
  pg.rect(WALL_X, 0, 1000 - WALL_X, FLOOR_Y);
  const rs = mulberry32(77123);
  const seams = [];
  let y = -34;
  while (y < FLOOR_Y + 20) {
    const rh = 46 + rs() * 40;
    let x = WALL_X - 44;
    while (x < 1000) {
      const bw = 78 + rs() * 88;
      const t = rs();
      const v = t < 0.32 ? 57 : (t < 0.68 ? 74 : 93);
      pg.fill(v, v, v + 8);
      pg.rect(x + 1, y + 1, bw - 2, rh - 2);
      if (x > WALL_X - 30) seams.push([x, y, x, Math.min(y + rh, FLOOR_Y)]);
      x += bw;
    }
    seams.push([WALL_X - 30, y, 1000, y]);
    y += rh;
  }
  // 石缝：细、不规则、浅灰 alpha 0.12
  const rj = mulberry32(90210);
  pg.noFill();
  for (const s of seams) {
    pg.stroke(232, 230, 224, 31);
    pg.strokeWeight(1.1 + rj() * 0.5);
    wobbleLine(pg, s[0], s[1], s[2], s[3], rj, 3.2);
  }
  // 几道裂缝
  for (let i = 0; i < 5; i++) {
    const cx0 = WALL_X + 30 + rj() * 280;
    const cy0 = rj() * 300;
    pg.stroke(8, 8, 10, 130);
    pg.strokeWeight(1.6);
    wobbleLine(pg, cx0, cy0, cx0 + (rj() - 0.5) * 90, cy0 + 60 + rj() * 120, rj, 9);
  }
  pg.noStroke();

  // ---- 尖拱窗 ----
  drawWindowUnit(pg, ctx);

  // ---- 楼梯 ----
  drawStairUnit(pg);

  // ---- 扭曲木扶手 + 立柱 ----
  drawRailUnit(pg);

  // ---- 月光梯形亮区（唯一高光，允许一次线性渐变）----
  drawMoonShaft(pg, ctx);

  setLayer = pg;
  return pg;
}

// 抖动折线（只用 vertex，避开 p5 2.x 的 bezierVertex 坑）
function wobbleLine(pg, x1, y1, x2, y2, rnd, amp) {
  const n = 4;
  pg.beginShape();
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const j = (k === 0 || k === n) ? 0 : 1;
    pg.vertex(
      x1 + (x2 - x1) * t + (rnd() - 0.5) * amp * j,
      y1 + (y2 - y1) * t + (rnd() - 0.5) * amp * j
    );
  }
  pg.endShape();
}

// ---------------- 尖拱窗（窗外冷蓝白月光，窗棂为十字 + 尖拱黑粗线）----------------
function drawWindowUnit(pg, ctx) {
  const { l, r, sill, spring, apex, cx } = WIN;
  // 真二心尖拱：左弧圆心在右弹簧线端，右弧圆心在左弹簧线端，半径 = 跨度
  const SPAN = r - l, R = SPAN, crx = r, clx = l, cy = spring;
  const arch = [];
  const arc = (ccx, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      arch.push([ccx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
  };
  arc(crx, Math.PI, Math.PI * 4 / 3, 14);   // (l,spring) → (cx,apex)
  arc(clx, -Math.PI / 3, 0, 14);            // (cx,apex) → (r,spring)
  // 内圈尖拱窗棂（同心，半径内缩）
  const Ri = R - 17;
  const inner = [];
  const arcI = (ccx, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      inner.push([ccx + Math.cos(a) * Ri, cy + Math.sin(a) * Ri]);
    }
  };
  arcI(crx, Math.PI, Math.PI * 4 / 3, 14);
  arcI(clx, -Math.PI / 3, 0, 14);

  // 窗洞填充：自上而下的一次线性渐变（冷蓝白）
  const grad = ctx.createLinearGradient(0, apex, 0, sill);
  grad.addColorStop(0, 'rgba(200,212,224,1)');
  grad.addColorStop(1, 'rgba(148,162,178,1)');
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(l, sill);
  ctx.lineTo(l, spring);
  for (const p of arch) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(r, sill);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 暗红门帘（唯一非中性色，只占一小块）
  ctx.beginPath();
  ctx.moveTo(l, sill);
  ctx.lineTo(l, spring);
  ctx.lineTo(l + 7, spring - 16);
  ctx.lineTo(l + 20, spring - 36);
  ctx.lineTo(l + 32, spring + 12);
  ctx.lineTo(l + 36, sill);
  ctx.closePath();
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.restore();

  // 窗棂：外框黑粗线 + 内圈尖拱 + 十字
  pg.push();
  pg.noFill();
  pg.stroke(BLACK);
  pg.strokeWeight(9);
  pg.beginShape();
  pg.vertex(l, sill);
  pg.vertex(l, spring);
  for (const p of arch) pg.vertex(p[0], p[1]);
  pg.vertex(r, spring);
  pg.vertex(r, sill);
  pg.endShape();
  // 内圈尖拱
  pg.strokeWeight(7);
  pg.beginShape();
  for (const p of inner) pg.vertex(p[0], p[1]);
  pg.endShape();
  // 十字：竖挺 + 横档
  pg.strokeWeight(8);
  pg.line(cx, sill, cx, apex + 12);
  pg.line(l + 4, 252, r - 4, 252);
  // 窗台
  pg.strokeWeight(10);
  pg.line(l - 12, sill + 5, r + 12, sill + 5);
  pg.pop();
}

// ---------------- 楼梯：实体块 + 踏板 + 前缘硬白线 ----------------
function drawStairUnit(pg) {
  // 实体块（暗灰，影子投上去才读得出）
  pg.push();
  pg.noStroke();
  pg.fill(60, 60, 70);
  pg.beginShape();
  pg.vertex(SX0, SY0);
  for (let i = 0; i < NSTEP; i++) {
    const X = SX0 + RUN * i, Y = SY0 - RISE * i;
    pg.vertex(X + RUN, Y);
    pg.vertex(X + RUN, Y - RISE);
  }
  pg.vertex(SX0 + RUN * NSTEP + DX, SY0 - RISE * NSTEP + DY);
  pg.vertex(SX0 + RUN * NSTEP + DX, FLOOR_Y);
  pg.vertex(SX0 + DX, FLOOR_Y);
  pg.endShape(pg.CLOSE);

  // 竖板（背光面，比实体更暗一档，让台阶结构清楚）
  for (let i = 0; i < NSTEP; i++) {
    const X = SX0 + RUN * i, Y = SY0 - RISE * i;
    pg.fill(36, 36, 45);
    pg.beginShape();
    pg.vertex(X + RUN, Y);
    pg.vertex(X + RUN, Y - RISE);
    pg.vertex(X + RUN + DX, Y - RISE + DY);
    pg.vertex(X + RUN + DX, Y + DY);
    pg.endShape(pg.CLOSE);
  }

  // 踏板（被月光照到的面）
  for (let i = 0; i < NSTEP; i++) {
    const X = SX0 + RUN * i, Y = SY0 - RISE * i;
    pg.fill(136, 136, 150);
    pg.beginShape();
    pg.vertex(X, Y);
    pg.vertex(X + RUN, Y);
    pg.vertex(X + RUN + DX, Y + DY);
    pg.vertex(X + DX, Y + DY);
    pg.endShape(pg.CLOSE);
  }
  // 顶部小平台（接上石墙）
  pg.fill(136, 136, 150);
  pg.beginShape();
  pg.vertex(SX0 + RUN * NSTEP, SY0 - RISE * NSTEP);
  pg.vertex(WALL_X + 14, SY0 - RISE * NSTEP);
  pg.vertex(WALL_X + 14 + DX, SY0 - RISE * NSTEP + DY);
  pg.vertex(SX0 + RUN * NSTEP + DX, SY0 - RISE * NSTEP + DY);
  pg.endShape(pg.CLOSE);

  // 前缘硬白线（weight 5，笔直）
  pg.noFill();
  pg.stroke(WHITE);
  pg.strokeWeight(5);
  for (let i = 0; i < NSTEP; i++) {
    const X = SX0 + RUN * i, Y = SY0 - RISE * i;
    pg.line(X, Y, X + RUN, Y);
    pg.line(X + RUN, Y, X + RUN + DX, Y + DY);
  }
  // 起步立柱（望柱）
  pg.noStroke();
  pg.fill(MID);
  pg.rect(SX0 + 4, SY0 - 128, 15, 128);
  pg.fill(BLACK);
  pg.rect(SX0 + 15, SY0 - 128, 4, 128);
  pg.pop();
}

// ---------------- 扭曲木扶手 + 每隔一级一根立柱 ----------------
function drawRailUnit(pg) {
  const rnd = mulberry32(4200);
  const rail = [];
  for (let i = 0; i <= NSTEP; i++) {
    const X = SX0 + RUN * i + DX * 0.5;
    const Y = SY0 - RISE * i + DY * 0.5;
    rail.push([
      X + Math.sin(i * 0.86) * 8 + (rnd() - 0.5) * 9,
      Y - 98 + Math.sin(i * 1.27) * 7 + (rnd() - 0.5) * 7,
    ]);
  }
  pg.push();
  // 立柱（每隔一级）
  pg.stroke(MID);
  pg.strokeWeight(5);
  for (let i = 0; i <= NSTEP; i += 2) {
    const fx = SX0 + RUN * i + 31 + DX * 0.6;
    const fy = SY0 - RISE * i + DY * 0.6;
    pg.line(fx, fy, rail[i][0], rail[i][1]);
  }
  // 扶手：暗底 + 中灰主体 + 白色高光
  pg.noFill();
  pg.stroke(16, 16, 20);
  pg.strokeWeight(12);
  pg.beginShape();
  for (const p of rail) pg.vertex(p[0], p[1]);
  pg.endShape();
  pg.stroke(MID);
  pg.strokeWeight(7);
  pg.beginShape();
  for (const p of rail) pg.vertex(p[0] - 1, p[1] - 2);
  pg.endShape();
  pg.stroke(232, 230, 224, 110);
  pg.strokeWeight(2);
  pg.beginShape();
  for (const p of rail) pg.vertex(p[0] - 2, p[1] - 5);
  pg.endShape();
  pg.pop();
}

// ---------------- 月光梯形亮区 ----------------
function drawMoonShaft(pg, ctx) {
  const pts = [[712, WIN.sill + 4], [888, WIN.sill + 4], [826, 668], [596, 668]];
  const grad = ctx.createLinearGradient(0, WIN.sill, 0, 668);
  grad.addColorStop(0, 'rgba(200,212,224,0.46)');
  grad.addColorStop(1, 'rgba(200,212,224,0.05)');
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// ============================================================
// 噪点层：约 3000 个 1~2 像素黑白点（固定种子，只做一次）
// ============================================================
let noiseLayer = null;

function ensureNoise(g) {
  if (noiseLayer) return noiseLayer;
  const img = g.createImage(1000, 1000);
  img.loadPixels();
  const rnd = mulberry32(5511);
  for (let i = 0; i < 3000; i++) {
    const x = Math.floor(rnd() * 998);
    const y = Math.floor(rnd() * 998);
    const s = rnd() < 0.35 ? 2 : 1;
    const v = rnd() < 0.5 ? 0 : 255;
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        const xx = x + dx, yy = y + dy;
        const k = 4 * (yy * 1000 + xx);
        img.pixels[k] = v; img.pixels[k + 1] = v; img.pixels[k + 2] = v; img.pixels[k + 3] = 255;
      }
    }
  }
  img.updatePixels();
  noiseLayer = img;
  return img;
}

// ============================================================
// render：石墙 / 楼梯 / 窗 / 月光（静态层）+ 端蜡烛的人
// ============================================================
export function render(g, meta, local, index) {
  g.push();
  g.noStroke();
  g.image(ensureSet(g), 0, 0);
  drawCandleBearer(g, local);
  g.pop();
}

// ---------------- 端蜡烛的人（自绘剪影）----------------
function drawCandleBearer(g, local) {
  const q8 = Math.floor(local * 8) / 8;               // 8fps 量化
  const back = q8 >= 2.5 ? 1 : 0;                     // 看见影子爬上来 → 后退一级
  const step = 2 - back;
  const px = SX0 + RUN * step + 40;
  const py = SY0 - RISE * step + 12;

  // 火苗：第 3 拍（local 1.0）跳一下，1.5 倍高度衰减；另有 10fps 微抖
  const jump = 0.5 * Math.exp(-Math.pow((local - 1.0) / 0.16, 2));
  const q10 = Math.floor(local * 10);
  const flick = 1 + (mulberry32(q10 * 613 + 11)() - 0.5) * 0.22;
  const fs = (1 + jump) * flick;

  const cx = px + 30;
  const cy = py - 122;

  g.push();
  g.noStroke();
  // 黑袍
  g.fill(BLACK);
  g.beginShape();
  g.vertex(px - 20, py + 2);
  g.vertex(px - 13, py - 70);
  g.vertex(px - 9, py - 88);
  g.vertex(px - 1, py - 95);
  g.vertex(px + 8, py - 90);
  g.vertex(px + 12, py - 72);
  g.vertex(px + 19, py + 2);
  g.endShape(g.CLOSE);
  // 头（兜帽）
  g.circle(px + 1, py - 102, 22);
  // 举蜡烛的手臂
  g.stroke(BLACK);
  g.strokeWeight(9);
  g.strokeCap(g.ROUND);
  g.line(px + 5, py - 78, px + 28, py - 96);
  g.noStroke();
  g.circle(px + 29, py - 97, 11);
  // 蜡烛
  g.fill(WHITE);
  g.rect(cx - 3, cy - 4, 6, 24);
  // 月光边缘（让剪影在暗处也读得出轮廓）
  g.noFill();
  g.stroke(232, 230, 224, 78);
  g.strokeWeight(1.8);
  g.beginShape();
  g.vertex(px + 19, py + 2);
  g.vertex(px + 12, py - 72);
  g.vertex(px + 8, py - 90);
  g.vertex(px - 1, py - 95);
  g.endShape();
  // 火苗光晕
  g.noStroke();
  g.fill(232, 230, 224, 26);
  g.circle(cx, cy - 8, 46 * fs);
  g.fill(232, 230, 224, 44);
  g.circle(cx, cy - 8, 26 * fs);
  // 火苗本体（泪滴形：椭圆 + 上挑尖）
  const fh = 17 * fs;
  g.fill(WHITE);
  g.push();
  g.translate(cx, cy - 6);
  g.beginShape();
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rx = fh * 0.42, ry = fh * 0.62;
    const vx = Math.cos(a) * rx, vy = Math.sin(a) * ry;
    if (vy < -fh * 0.3) g.vertex(vx * 0.45, vy - fh * 0.55);
    else g.vertex(vx, vy);
  }
  g.endShape(g.CLOSE);
  g.pop();
  g.pop();
}

// ============================================================
// drawVehicle：本格只画影子，不画本体
// ============================================================
export function drawVehicle(g, { x, y, local, t, wave }) {
  const st = shadowState(local);
  const G = shadowGeom(st);

  // ---- 通电转场：5.40→6.00 ----
  const e1 = smooth(5.40, 5.75, local);   // 描边变绿
  const e2 = smooth(5.75, 5.98, local);   // 内部变空
  const dim = smooth(5.62, 5.98, local);  // 实景压暗 → 只剩示波器

  g.push();
  g.noStroke();

  // 1) 实景压暗 + 示波器网格淡入（在影子之下，不遮绿线）
  if (dim > 0.004) {
    g.fill(4, 6, 5, 238 * dim);
    g.rect(0, 0, 1000, 1000);
    const ga = 44 * smooth(5.68, 6.0, local);
    if (ga > 0.5) {
      g.stroke(`rgba(${GREEN_RGB},${(ga / 255).toFixed(3)})`);
      g.strokeWeight(1.4);
      for (let i = 1; i < 10; i++) {
        g.line(i * 100, 60, i * 100, 940);
        g.line(30, i * 100, 970, i * 100);
      }
      g.noStroke();
    }
  }

  // 2) 影子本体（带 10fps 扫描抖动）
  const jit = smooth(5.75, 5.86, local);
  const jx = jit > 0 ? (mulberry32(Math.floor(local * 10) * 977 + 5)() - 0.5) * 4 * jit : 0;
  g.translate(jx, 0);

  const ctx = g.drawingContext;
  const blackA = 210 * (1 - e2);
  if (blackA > 2) {
    // 纯黑影：体块 + 尖头 + 四道下刺，窗格以 evenodd 挖成洞
    fillPolys(ctx, [G.body, G.spike, G.noz[0], G.noz[1], G.noz[2], G.noz[3], ...G.wins],
      '10,10,12', blackA, 'evenodd');
    // 窗玻璃：比实体淡的半影
    for (const w of G.wins) fillPolys(ctx, [w], '10,10,12', 94 * (1 - e2 * 0.6), 'nonzero');
    // 窗框与竖挺
    strokePolys(g, G.wins, '10,10,12', 5, blackA);
    strokeSegs(g, G.mull, '10,10,12', 4, blackA);
  }

  // 3) 绿色描边 + 余辉拖尾
  if (e1 > 0.01) {
    for (let k = 0; k < 3; k++) {
      const a = (0.34 - k * 0.11) * e1;   // 三层递减 alpha，向下偏移 3/6/9
      g.push();
      g.translate(0, 3 + k * 3);
      strokeShadowSet(g, G, GREEN_RGB, 2.0, a);
      g.pop();
    }
    strokeShadowSet(g, G, GREEN_RGB, 11, 30 * e1);   // 光晕
    strokeShadowSet(g, G, GREEN_RGB, 5.5, 78 * e1);
    strokeShadowSet(g, G, GREEN_RGB, 2.2, 235 * e1);
  }

  // 4) 横向扫描亮线（每 0.25 秒从上扫到下一次）
  if (local >= 5.75) {
    const sy = ((local / 0.25) % 1) * 1000;
    g.noStroke();
    g.fill(51, 255, 102, 18);
    g.rect(0, sy - 16, 1000, 16);
    g.stroke(51, 255, 102, 130);
    g.strokeWeight(2.4);
    g.line(0, sy, 1000, sy);
    g.noStroke();
  }

  g.pop();

  // 5) 默片后期：噪点 → 划痕 → 闪烁 → 重暗角
  filmPost(g, local);
}

// ============================================================
// 影子状态：8fps 量化爬楼梯（每 0.5 秒一级），上墙后立起来
// ============================================================
function shadowState(local) {
  const q8 = Math.floor(local * 8) / 8;
  const idx = Math.min(11, Math.floor(q8 * 2));      // 0.5s 一级
  const w = smooth(5.5, 9.0, idx);                   // 0=贴在楼梯上，1=立到石墙上
  let fx, fy;
  if (idx <= 8) {
    fx = SX0 + RUN * idx + 55;
    fy = SY0 - RISE * idx + DY * 0.35;
  } else {
    const k = idx - 8;
    fx = 646 + 20 * k;
    fy = 366 - 13 * k;
  }
  return { fx, fy, w, idx };
}

// 影子局部坐标 (a,b) → 世界坐标；b 每越过一级台阶，横向跳一次（折角弯折）
function shMap(st, a, b) {
  const stairOff = RUN * Math.floor(b / RISE);
  const diagOff = (RUN / RISE) * b;
  const off = st.w * (WALL_LEAN * b)
    + (1 - st.w) * (DRAPE * stairOff + (1 - DRAPE) * diagOff);
  return [st.fx + a + off, st.fy - b];
}

// 影子轮廓宽度剖面（底座宽 → 檐部外张 → 屋脊收窄）
const PROF = [[0, 1.00], [0.06, 1.08], [0.20, 1.02], [0.55, 1.05],
              [0.72, 1.14], [0.80, 1.10], [0.90, 0.82], [1.00, 0.62]];
function profW(u) {
  for (let i = 0; i < PROF.length - 1; i++) {
    const A = PROF[i], B = PROF[i + 1];
    if (u <= B[0]) {
      const t = Math.min(1, Math.max(0, (u - A[0]) / (B[0] - A[0])));
      return A[1] + (B[1] - A[1]) * t;
    }
  }
  return PROF[PROF.length - 1][1];
}

// ---------------- 影子几何（固定种子毛糙边缘）----------------
function shadowGeom(st) {
  const rnd = mulberry32(19220414);
  const P = (a, b) => {
    const p = shMap(st, a, b);
    return [p[0] + (rnd() - 0.5) * 2.6, p[1] + (rnd() - 0.5) * 2.2];
  };

  // 体块
  const NS = 24;
  const body = [];
  for (let i = 0; i <= NS; i++) {
    const u = i / NS;
    body.push(P(-SHW * 0.5 * profW(u), u * SHB));
  }
  for (let i = NS; i >= 0; i--) {
    const u = i / NS;
    body.push(P(SHW * 0.5 * profW(u), u * SHB));
  }

  // 顶部六角灯笼 → 拉成尖头
  const hw0 = SHW * 0.5 * profW(1);
  const SP = [[-1.00, 0], [-0.90, 0.20], [-0.48, 0.58], [0.12, 1.0],
              [0.54, 0.58], [0.92, 0.20], [1.00, 0]];
  const spike = [];
  for (const s of SP) spike.push(P(s[0] * hw0 + s[1] * 9, SHB + s[1] * SHS));

  // 底座四喷口 → 四道向下尖刺
  const NZ = [[-0.44, 1.0], [-0.15, 0.74], [0.15, 0.74], [0.44, 1.0]];
  const noz = [];
  for (const n of NZ) {
    const a0 = n[0] * SHW * 0.5;
    const L = SHN * n[1];
    noz.push([P(a0 - 14, 0), P(a0 + 14, 0), P(a0 + 10 + n[0] * 12, -L)]);
  }

  // 3×2 窗格（平行四边形化）
  const wins = [];
  const mull = [];
  const ww = SHW * 0.27, wh = SHB * 0.20;
  for (const rb of [0.52, 0.755]) {
    for (const ca of [-0.30, 0, 0.30]) {
      const a0 = ca * SHW, b0 = rb * SHB;
      wins.push([
        P(a0 - ww / 2, b0 - wh / 2), P(a0 + ww / 2, b0 - wh / 2),
        P(a0 + ww / 2, b0 + wh / 2), P(a0 - ww / 2, b0 + wh / 2),
      ]);
      mull.push([P(a0, b0 - wh / 2), P(a0, b0 + wh / 2)]);
    }
  }

  return { body, spike, noz, wins, mull };
}

// ---------------- 描边/填充小工具 ----------------
function strokeShadowSet(g, G, rgb, weight, alpha) {
  strokePolys(g, [G.body, G.spike, G.noz[0], G.noz[1], G.noz[2], G.noz[3], ...G.wins], rgb, weight, alpha);
  strokeSegs(g, G.mull, rgb, weight * 0.8, alpha * 0.85);
}

function strokePolys(g, polys, rgb, weight, alpha) {
  if (alpha <= 0.6) return;
  g.push();
  g.noFill();
  g.stroke(`rgba(${rgb},${(Math.min(1, alpha / 255)).toFixed(3)})`);
  g.strokeWeight(weight);
  for (const p of polys) {
    g.beginShape();
    for (const v of p) g.vertex(v[0], v[1]);
    g.endShape(g.CLOSE);
  }
  g.pop();
}

function strokeSegs(g, segs, rgb, weight, alpha) {
  if (alpha <= 0.6) return;
  g.push();
  g.noFill();
  g.stroke(`rgba(${rgb},${(Math.min(1, alpha / 255)).toFixed(3)})`);
  g.strokeWeight(weight);
  for (const s of segs) g.line(s[0][0], s[0][1], s[1][0], s[1][1]);
  g.pop();
}

function fillPolys(ctx, polys, rgb, alpha, rule) {
  if (alpha <= 0.6) return;
  ctx.save();
  ctx.beginPath();
  for (const p of polys) {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
  }
  ctx.fillStyle = `rgba(${rgb},${(Math.min(1, alpha / 255)).toFixed(3)})`;
  ctx.fill(rule);
  ctx.restore();
}

// ============================================================
// 默片后期：噪点 / 竖向划痕 / 帧间闪烁（10fps 量化）/ 重暗角
// 全部放在影子之后，覆盖整格画面
// ============================================================
function filmPost(g, local) {
  // 1) 颗粒
  g.push();
  g.tint(255, 78);
  g.image(ensureNoise(g), 0, 0);
  g.pop();

  // 2) 竖向划痕：每 1.5 秒一条，持续 0.18s
  const si = Math.floor(local / 1.5);
  const ph = local - si * 1.5;
  if (ph < 0.18) {
    const r = mulberry32(9001 + si * 37);
    const x = 70 + r() * 860;
    const a = 150 * (1 - ph / 0.18);
    g.push();
    g.stroke(232, 230, 224, a);
    g.strokeWeight(1.7);
    g.line(x, 0, x + (r() - 0.5) * 9, 1000);
    g.stroke(232, 230, 224, a * 0.55);
    g.strokeWeight(1);
    g.line(x + 3 + r() * 3, 0, x + 3 + (r() - 0.5) * 9, 1000);
    g.pop();
  }

  // 3) 帧间闪烁：Math.floor(local*10) 取种子，±4%
  const fr = mulberry32(Math.floor(local * 10) * 7919 + 3)();
  const delta = (fr - 0.5) * 0.08;
  const flash = 46 * Math.exp(-Math.pow((local - 2.05) / 0.11, 2));   // 第 5 拍整体闪一次
  g.push();
  g.noStroke();
  if (delta >= 0) g.fill(255, 255, 255, Math.abs(delta) * 255);
  else g.fill(0, 0, 0, Math.abs(delta) * 255);
  g.rect(0, 0, 1000, 1000);
  if (flash > 0.6) {
    g.fill(232, 230, 224, flash);
    g.rect(0, 0, 1000, 1000);
  }
  g.pop();

  // 4) 重暗角
  vignette(g, 0, 0, 1000, 1000, 130);
}
