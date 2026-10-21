// ============================================================
// s15-oscilloscope.js — 第 15 示波器 版块（1950s 矢量显示）
// 美术简报：briefs/s15-oscilloscope.md
//
// 一切由「发光线条」构成：三层递减 alpha 同形描边 + 一条亮芯 + 余辉拖尾，
// 整体 x 方向 10fps 阶跃扫描抖动。除绿色系与中性灰外不出现其他颜色。
// ============================================================

import { TAU, swirlAngle, hoverY, clamp01, smooth } from '../beat/beats.js';
import { mulberry32, rrFill, rrStroke, vignette } from '../kit/kit.js';

// ---- 版面几何 ----
const CX = 500, CY = 470, R = 400;      // 圆形 CRT 屏
const BEZEL = 16;                        // 屏外金属圈宽度
const EN = '"Consolas","Lucida Console","Courier New",monospace';

// ---- 面板控件（手排固定值，全部落在圆屏之外、公路带 y<770 之上）----
const KNOBS = [
  { x: 858, y: 738, r: 21, ang: -0.55 },
  { x: 902, y: 738, r: 21, ang: 0.40 },
  { x: 946, y: 738, r: 21, ang: 0.95 },  // 右起第一只：被转错的那只
];
const TOGGLES = [
  { x: 958, y: 634, up: true },
  { x: 958, y: 682, up: false },
];
const TURN_KNOB = 2;

// ============================================================
// 缓存纹理：横向拉丝金属面板（模块级，只生成一次）
// ============================================================
let panelTex = null;

function panelTexture(g) {
  if (panelTex) return panelTex;
  const pg = g.createGraphics(1000, 1000);
  pg.pixelDensity(1);
  pg.background(48, 48, 43);
  const rnd = mulberry32(8153);
  pg.strokeWeight(1);
  for (let i = 0; i < 1100; i++) {
    const y = rnd() * 1000;
    const v = 48 + (rnd() * 2 - 1) * 26;
    pg.stroke(v, v, v * 0.92, 16 + rnd() * 26);
    const x0 = rnd() * 260 - 130;
    pg.line(x0, y, x0 + 380 + rnd() * 900, y + (rnd() - 0.5) * 0.7);
  }
  const c = pg.drawingContext;
  const lg = c.createLinearGradient(0, 0, 0, 1000);
  lg.addColorStop(0, 'rgba(255,255,255,0.05)');
  lg.addColorStop(0.45, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.30)');
  c.fillStyle = lg;
  c.fillRect(0, 0, 1000, 1000);
  vignette(pg, 0, 0, 1000, 1000, 95);
  panelTex = pg;
  return pg;
}

// ============================================================
// 发光线描核心：三层递减 alpha 同形描边 + 亮芯 + 向下余辉
// ============================================================
function pathAt(g, pts, closed, dy) {
  g.beginShape();
  for (let i = 0; i < pts.length; i++) g.vertex(pts[i][0], pts[i][1] + dy);
  if (closed) g.endShape(g.CLOSE);
  else g.endShape();
}

function glowPath(g, pts, opt = {}) {
  const closed = !!opt.closed;
  const w = opt.w == null ? 2.0 : opt.w;
  const a = opt.a == null ? 1 : opt.a;
  const hot = opt.hot || 0;
  const trail = opt.trail == null ? 1 : opt.trail;
  if (a <= 0.005) return;
  g.push();
  g.noFill();
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  // 余辉拖尾：同形向下偏移 12 / 8 / 4
  if (trail > 0) {
    const offs = [[12, 0.10], [8, 0.20], [4, 0.35]];
    for (let k = 0; k < 3; k++) {
      g.stroke(51, 255, 102, 255 * offs[k][1] * a * trail);
      g.strokeWeight(w + 1.1);
      pathAt(g, pts, closed, offs[k][0]);
    }
  }
  // 三层递减 alpha 同形描边
  for (let i = 3; i >= 1; i--) {
    g.stroke(51, 255, 102, Math.min(255, 30 * i * a * (1 + hot * 0.85)));
    g.strokeWeight(w + i * 2.2 * (1 + hot * 0.30));
    pathAt(g, pts, closed, 0);
  }
  // 亮芯
  g.stroke(200, 255, 220, Math.min(255, 240 * a * (1 + hot * 0.22)));
  g.strokeWeight(1.4 + hot * 0.5);
  pathAt(g, pts, closed, 0);
  g.pop();
}

function circlePts(cx, cy, r, n = 40) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return o;
}

// ============================================================
// 时间与状态
// ============================================================
// 抖动：local 0~0.6 承接上一格的 3.5，0.6~1.2 衰减到 2.2，崩坏时加大
function shakeAmp(local) {
  let a = 2.2;
  if (local < 0.6) a = 3.5;
  else if (local < 1.2) a = 3.5 + (2.2 - 3.5) * smooth(0.6, 1.2, local);
  a += 1.7 * breakEnv(local);
  return a;
}

// 10fps 阶跃抖动（x 方向）
function jitterX(local, amp) {
  const s = Math.floor(local * 10);
  const r = mulberry32(s * 7919 + 13)();
  return (r * 2 - 1) * amp;
}

// 崩坏包络：2.62 起崩 → 2.68 全崩 → 3.10 起弹回 → 3.22 复原（0.12s 阻尼）
function breakEnv(local) {
  const on = smooth(2.62, 2.68, local);
  const off = 1 - smooth(3.10, 3.22, local);
  return Math.min(on, off);
}

// 第 3 拍李萨如频率比跳档：3:2 → 5:4 → 7:5 → 回到 3:2
function ratioAt(local) {
  if (local >= 1.0 && local < 1.9) {
    const k = Math.floor((local - 1.0) / 0.24);
    return [[3, 2], [5, 4], [7, 5], [3, 2]][Math.min(3, k)];
  }
  return [3, 2];
}

// ============================================================
// 屏内：底色 / 刻度网格 / 扫描亮线 / 玻璃反光
// ============================================================
function screenBg(g, hum) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#050805';
  ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  const gr = ctx.createRadialGradient(CX, CY, 16, CX, CY, R * 1.02);
  gr.addColorStop(0, 'rgba(20,58,30,0.34)');
  gr.addColorStop(0.55, 'rgba(10,32,17,0.18)');
  gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = gr;
  ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  // 极淡的荧光线栅 + 底噪（同样夹在圆内）
  g.push();
  g.noStroke();
  g.fill(51, 255, 102, 6 * hum);
  g.rect(CX - R, CY - R, R * 2, R * 2);
  g.stroke(51, 255, 102, 7);
  g.strokeWeight(1);
  for (let y = CY - R; y < CY + R; y += 6) g.line(CX - R, y, CX + R, y);
  g.pop();
  ctx.restore();
}

function drawGraticule(g, a) {
  if (a <= 0.005) return;
  g.push();
  g.noFill();
  for (let r = 80; r <= 400; r += 80) {
    g.stroke(51, 255, 102, 18 * a);
    g.strokeWeight(r % 160 === 0 ? 1.5 : 1);
    g.circle(CX, CY, r * 2);
  }
  g.stroke(51, 255, 102, 20 * a);
  g.strokeWeight(1.2);
  g.line(CX - R, CY, CX + R, CY);
  g.line(CX, CY - R, CX, CY + R);
  g.stroke(51, 255, 102, 22 * a);
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const px = CX + i * 80, py = CY + i * 80;
    g.line(px, CY - 5, px, CY + 5);
    g.line(CX - 5, py, CX + 5, py);
  }
  g.pop();
}

// 每 0.25 秒一条横向亮线从屏顶扫到屏底（一拍扫两轮，与拍同步）
function drawScan(g, local, dense) {
  for (let k = 0; k < dense; k++) {
    const ph = (((local % 0.25) / 0.25) + k / dense) % 1;
    const y = CY - R + 8 + ph * (R * 2 - 16);
    const hw = Math.sqrt(Math.max(0, R * R - (y - CY) * (y - CY)));
    if (hw < 6) continue;
    g.push();
    // 束尾（向上渐隐）
    for (let i = 0; i < 3; i++) {
      g.stroke(51, 255, 102, 20 - i * 6);
      g.strokeWeight(2 + i * 4);
      g.line(CX - hw * 0.9, y - 5 - i * 6, CX + hw * 0.9, y - 5 - i * 6);
    }
    for (let i = 3; i >= 1; i--) {
      g.stroke(51, 255, 102, 9 * i);
      g.strokeWeight(1 + i * 2.2);
      g.line(CX - hw, y, CX + hw, y);
    }
    g.stroke(200, 255, 220, 110);
    g.strokeWeight(1.2);
    g.line(CX - hw, y, CX + hw, y);
    g.pop();
  }
}

// 屏面玻璃：左上 → 右下 的极淡斜向反光
function drawGlass(g) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.clip();
  ctx.translate(CX, CY);
  ctx.rotate(-0.62);
  const band = (y0, h, a0) => {
    const gr = ctx.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, 'rgba(206,232,216,0)');
    gr.addColorStop(0.42, `rgba(206,232,216,${a0})`);
    gr.addColorStop(0.62, `rgba(206,232,216,${a0 * 0.55})`);
    gr.addColorStop(1, 'rgba(206,232,216,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-700, y0, 1400, h);
  };
  band(-290, 150, 0.030);
  band(-120, 70, 0.020);
  ctx.restore();
}

function screenInnerShadow(g) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.clip();
  const gr = ctx.createRadialGradient(CX, CY, R * 0.80, CX, CY, R);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = gr;
  ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  ctx.restore();
}

// ============================================================
// 屏外：面板 / 铭牌 / 旋钮 / 拨杆 / 散热孔
// ============================================================
function drawBezel(g, a) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R + BEZEL, 0, TAU);
  const gr = ctx.createRadialGradient(CX, CY, R, CX, CY, R + BEZEL);
  gr.addColorStop(0, `rgba(10,12,10,${a})`);
  gr.addColorStop(0.30, `rgba(104,108,98,${a})`);
  gr.addColorStop(0.72, `rgba(58,60,54,${a})`);
  gr.addColorStop(1, `rgba(26,28,24,${a})`);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.restore();
  // 屏沿磷光边
  g.push();
  g.noFill();
  g.stroke(51, 255, 102, 46 * a);
  g.strokeWeight(2.4);
  g.circle(CX, CY, R * 2 - 1);
  // 圈上的螺钉
  g.noStroke();
  for (let i = 0; i < 4; i++) {
    const an = -Math.PI / 4 + (i / 4) * TAU;
    const sx = CX + Math.cos(an) * (R + BEZEL * 0.5);
    const sy = CY + Math.sin(an) * (R + BEZEL * 0.5);
    g.fill(18, 20, 18, 210 * a);
    g.circle(sx, sy, 9);
    g.fill(128, 134, 124, 190 * a);
    g.circle(sx, sy, 5.5);
  }
  g.pop();
}

function drawNameplate(g, a) {
  g.push();
  g.noStroke();
  g.fill(22, 25, 23, 232 * a);
  rrFill(g, 40, 40, 210, 68, 6);
  g.noFill();
  g.stroke(146, 156, 146, 95 * a);
  g.strokeWeight(1.6);
  rrStroke(g, 40, 40, 210, 68, 6);
  g.noStroke();
  g.fill(184, 196, 184, 238 * a);
  g.textFont(EN);
  g.textAlign(g.LEFT, g.TOP);
  g.textSize(24);
  g.text('MODEL TC-7', 56, 50);
  g.fill(150, 162, 150, 214 * a);
  g.textSize(14);
  g.text('TIME BASE / VECTOR', 56, 82);
  g.fill(120, 128, 118, 170 * a);
  g.circle(48, 98, 6);
  g.circle(242, 98, 6);
  // 铭牌下一行小字（1950s 仪器的刻印规格）
  g.fill(132, 142, 132, 150 * a);
  g.textSize(11.5);
  g.text('HOR 0.5 S/DIV    VERT 2 V/DIV', 40, 120);
  g.pop();
}

function drawKnob(g, k, a, ang) {
  g.push();
  // 外圈刻度点
  g.noStroke();
  for (let i = 0; i < 12; i++) {
    const an = (i / 12) * TAU - Math.PI / 2;
    g.fill(168, 176, 166, 150 * a);
    g.circle(k.x + Math.cos(an) * (k.r + 10), k.y + Math.sin(an) * (k.r + 10), 3.2);
  }
  g.fill(0, 0, 0, 95 * a);
  g.circle(k.x, k.y + 3, k.r * 2 + 3);
  // 旋钮体（渐变走原生 ctx，避免被 p5 fill 覆盖）
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(k.x, k.y, k.r, 0, TAU);
  const gr = ctx.createRadialGradient(
    k.x - k.r * 0.42, k.y - k.r * 0.5, k.r * 0.12, k.x, k.y, k.r * 1.12
  );
  gr.addColorStop(0, `rgba(150,152,140,${a})`);
  gr.addColorStop(0.62, `rgba(90,92,84,${a})`);
  gr.addColorStop(1, `rgba(44,46,42,${a})`);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.restore();
  // 同心圆
  g.noFill();
  g.stroke(28, 30, 28, 210 * a);
  g.strokeWeight(1.6);
  g.circle(k.x, k.y, k.r * 2);
  g.stroke(126, 130, 120, 115 * a);
  g.strokeWeight(1.1);
  g.circle(k.x, k.y, k.r * 1.34);
  g.circle(k.x, k.y, k.r * 0.60);
  // 指示线
  g.stroke(228, 234, 224, 238 * a);
  g.strokeWeight(2.4);
  g.strokeCap(g.ROUND);
  g.line(k.x, k.y, k.x + Math.cos(ang) * k.r * 0.85, k.y + Math.sin(ang) * k.r * 0.85);
  g.pop();
}

function drawToggle(g, x, y, up, a) {
  g.push();
  g.noStroke();
  g.fill(18, 20, 18, 226 * a);
  rrFill(g, x - 9, y - 19, 18, 38, 5);
  g.noFill();
  g.stroke(112, 118, 110, 140 * a);
  g.strokeWeight(1.4);
  rrStroke(g, x - 9, y - 19, 18, 38, 5);
  const dir = up ? -1 : 1;
  g.stroke(178, 186, 176, 226 * a);
  g.strokeWeight(4);
  g.strokeCap(g.ROUND);
  g.line(x, y, x, y + dir * 13);
  g.noStroke();
  g.fill(204, 212, 202, 226 * a);
  g.circle(x, y + dir * 13, 7);
  g.pop();
}

// 面板散热孔 + 下沿阴影（只在圆屏之外绘制）
function drawPanelDetails(g, a) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 1000, 1000);
  ctx.arc(CX, CY, R + BEZEL, 0, TAU, true);   // 挖掉圆屏
  ctx.clip();
  const lg = ctx.createLinearGradient(0, 690, 0, 770);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(1, `rgba(0,0,0,${0.5 * a})`);
  ctx.fillStyle = lg;
  ctx.fillRect(0, 690, 1000, 80);
  ctx.fillStyle = `rgba(150,156,146,${0.16 * a})`;
  ctx.fillRect(0, 765, 1000, 3);
  g.push();
  g.noStroke();
  // 左下散热孔
  for (let i = 0; i < 7; i++) {
    g.fill(16, 18, 16, 200 * a);
    rrFill(g, 62 + i * 18, 716, 9, 34, 4);
    g.fill(100, 106, 98, 60 * a);
    rrFill(g, 62 + i * 18, 716, 9, 3, 2);
  }
  // 右上散热孔
  for (let i = 0; i < 6; i++) {
    g.fill(16, 18, 16, 200 * a);
    rrFill(g, 890 + i * 14, 126, 8, 56, 4);
  }
  g.pop();
  ctx.restore();
}

// 屏光溢到面板上的一圈绿雾
function drawScreenSpill(g, a) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R + BEZEL + 80, 0, TAU);
  ctx.arc(CX, CY, R + BEZEL, 0, TAU, true);
  ctx.clip();
  const gr = ctx.createRadialGradient(CX, CY, R + BEZEL, CX, CY, R + BEZEL + 80);
  gr.addColorStop(0, `rgba(51,255,102,${0.13 * a})`);
  gr.addColorStop(1, 'rgba(51,255,102,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(CX - R - 130, CY - R - 130, (R + 130) * 2, (R + 130) * 2);
  ctx.restore();
}

// ============================================================
// render：屏 + 面板 + 全屏亮度事件
// ============================================================
export function render(g, meta, local, index) {
  const idx = index == null ? 14 : index;
  const gt = 5 + 6 * idx + local;                  // 全局时间（只用于连续相位）
  const fade = smooth(0.6, 1.2, local);             // 面板 / 刻度网格淡入
  const hum = 0.85 + 0.15 * Math.sin(gt * 1.7) + 0.06 * Math.sin(gt * 21);
  const overload = local >= 2.0 ? Math.exp(-Math.pow((local - 2.0) / 0.2, 2)) : 0;
  const d = Math.min(local, 6 - local);
  const cross = Math.exp(-Math.pow(d / 0.22, 2));   // 过框：全屏绿色亮一次
  const snapFlash = local >= 3.10 ? 0.08 * Math.exp(-(local - 3.10) / 0.07) : 0;

  g.push();

  // 1) 底：近黑
  g.noStroke();
  g.fill(7, 9, 7);
  g.rect(0, 0, 1000, 1000);

  // 2) 面板（含拉丝纹理）
  if (fade > 0.01) {
    g.push();
    g.tint(255, 255 * fade);
    g.image(panelTexture(g), 0, 0, 1000, 1000);
    g.pop();
    g.noTint();
    drawScreenSpill(g, fade * (0.7 + 0.5 * overload + 0.7 * breakEnv(local)));
    drawBezel(g, fade);
    drawPanelDetails(g, fade);
    drawNameplate(g, fade);
    for (let i = 0; i < TOGGLES.length; i++) {
      drawToggle(g, TOGGLES[i].x, TOGGLES[i].y, TOGGLES[i].up, fade);
    }
    // 右起第一只旋钮被转错：2.45~2.68 转动，之后停在被拧歪的角度
    const turnA = smooth(2.45, 2.68, local);
    const ang2 = KNOBS[TURN_KNOB].ang + 1.45 * turnA;
    for (let i = 0; i < KNOBS.length; i++) {
      const ang = i === TURN_KNOB ? ang2 : KNOBS[i].ang;
      drawKnob(g, KNOBS[i], fade, ang);
    }
  }

  // 3) 屏内：底色 → 网格 + 扫描线（带抖动）
  screenBg(g, hum);
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.clip();
  g.push();
  g.translate(jitterX(local, shakeAmp(local)), 0);
  drawGraticule(g, fade);
  const dense = local < 0.6 ? 3 : (local < 1.2 ? 2 : 1);
  drawScan(g, local, dense);
  g.pop();
  ctx.restore();

  // 4) 玻璃反光 + 屏内暗角
  drawGlass(g);
  screenInnerShadow(g);

  // 5) 全屏亮度事件
  g.noStroke();
  if (overload > 0.01) { g.fill(200, 255, 220, 20 * overload); g.rect(0, 0, 1000, 1000); }
  if (snapFlash > 0.002) { g.fill(214, 255, 228, 255 * snapFlash); g.rect(0, 0, 1000, 1000); }
  if (cross > 0.01) { g.fill(120, 255, 170, 20 * cross); g.rect(0, 0, 1000, 1000); }

  g.pop();
}

// ============================================================
// drawVehicle：时空舱 = 发光线条构成的矢量图形
// 崩坏时整体变成一团全屏李萨如，随后 0.12s 阻尼弹回
// 手画在这里，才能压在公路之上（读作伸进画面）
// ============================================================
export function drawVehicle(g, { x = 500, y = 890, local = 0, t = 0, wave = false } = {}) {
  const u = clamp01(x / 1000);
  const s = 1.20;
  const cx = 320 + u * 360;
  const base = 738 + hoverY(local);
  const bEnv = breakEnv(local);
  const ctx = g.drawingContext;

  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.clip();
  g.push();
  g.translate(jitterX(local, shakeAmp(local)), 0);

  if (bEnv > 0.01) drawBreakLissajous(g, local, t, bEnv, cx, base);
  if (bEnv < 0.995) {
    // 弹回时的阻尼抖动
    const dt = local - 3.10;
    const damp = dt > 0 && dt < 0.9 ? Math.exp(-dt * 4.2) * Math.sin(dt * 38) : 0;
    g.push();
    g.translate(cx, base);
    g.scale(1 + damp * 0.05, 1 + damp * 0.05);
    g.translate(-cx, -base + damp * 7);
    drawCapsuleLines(g, cx, base, s, 1 - bEnv, local, t);
    g.pop();
  }

  g.pop();
  ctx.restore();

  // 梗：手（在公路之上）
  drawHand(g, local);
}

// 崩坏态：x = cx + A·sin(5θ+δ)，y = cy + B·sin(4θ)，δ 快变、辉光过载
// 弹回时向舱体中心塌缩
function drawBreakLissajous(g, local, t, env, tcx, tbase) {
  const k = env;
  const ccx = CX + (tcx - CX) * (1 - k) * 0.55;
  const ccy = -40 + CY + (tbase - 150 - (CY - 40)) * (1 - k) * 0.55;
  const A = 340 * (0.38 + 0.62 * k);
  const B = 320 * (0.38 + 0.62 * k);
  const d0 = t * 9.0;
  const al = Math.pow(k, 1.35);
  for (let pass = 0; pass < 2; pass++) {
    const dlt = d0 + pass * 0.85;
    const N = 190;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU;
      pts.push([ccx + A * Math.sin(5 * th + dlt), ccy + B * Math.sin(4 * th)]);
    }
    glowPath(g, pts, {
      closed: true,
      w: 2.6,
      a: al * (pass === 0 ? 1 : 0.45),
      hot: 1.15 * k,
    });
  }
}

// ============================================================
// 梗：线条简笔手（8 条线）从右下伸进来捏住右起第一只旋钮
// ============================================================
// 手：一条手形轮廓 + 几条关节线（相对被拧旋钮的圆心）
const HAND_OUTLINE = [
  [-30, 300], [-27, 200], [-26, 152], [-38, 118], [-44, 80],
  [-40, 46], [-33, 14], [-27, -6], [-20, -10], [-15, 2], [-12, 40],
  [-4, 60],
  [7, 28], [13, 2], [20, -6], [27, 10], [33, 44],
  [41, 80], [45, 118], [30, 148], [32, 200], [34, 300],
];
const HAND_DETAIL = [
  [[-33, 14], [-20, 40], [-22, 66]],     // 食指关节
  [[16, 62], [24, 88]],                  // 拇指根
  [[-10, 104], [10, 112], [28, 104]],    // 掌纹
  [[-26, 152], [30, 148]],               // 腕
  [[-27, 212], [-4, 218], [20, 214], [33, 208]], // 袖口
];

function drawHand(g, local) {
  const inA = smooth(1.85, 2.35, local);          // 伸入
  const outA = 1 - smooth(4.50, 5.10, local);     // 收回
  const present = Math.min(inA, outA);
  if (present <= 0.01) return;
  const slide = (1 - smooth(1.85, 2.45, local)) * 330 + (1 - outA) * 340;
  const turn = smooth(2.45, 2.68, local);         // 拧动
  const rel = smooth(3.10, 3.30, local);           // 松手抬指

  const k = KNOBS[TURN_KNOB];
  g.push();
  g.translate(k.x, k.y + slide + 12 * rel);
  g.rotate(0.20 * turn - 0.10 * rel);
  glowPath(g, HAND_OUTLINE, { closed: true, w: 2.6, a: present * 0.95, hot: 0.18 });
  for (let i = 0; i < HAND_DETAIL.length; i++) {
    glowPath(g, HAND_DETAIL[i], { w: 2.0, a: present * 0.85, hot: 0.12 });
  }
  g.pop();
}

// ============================================================
// 舱体：只画轮廓，内部全空（露出屏底黑）
// ============================================================
// 灯笼里的时间漩涡：小李萨如 x=sin(pθ), y=sin(qθ+δ)
function drawLanternSwirl(g, x, y, r, a, local, t) {
  const [p, q] = ratioAt(local);
  const th0 = swirlAngle(t);
  const dlt = t * 0.35;
  const N = 110;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const th = th0 + (i / N) * TAU;
    pts.push([x + r * Math.sin(p * th), y + r * Math.sin(q * th + dlt)]);
  }
  glowPath(g, pts, { closed: true, w: 1.8, a: a * 0.95, hot: 0.35 });
}

function drawCapsuleLines(g, x, baseY, s, a, local, t) {
  const W = 178 * s, H = 196 * s;
  const topY = baseY - H;
  const eaveW = W + 26 * s, eaveH = 22 * s, ridgeW = W * 0.46;
  const lampY = topY - (eaveH + 30 * s), lampR = 19 * s;
  const O = { a, w: 2.0 };

  // 舱身（方形）
  glowPath(g, [
    [x - W / 2, topY], [x + W / 2, topY], [x + W / 2, baseY], [x - W / 2, baseY],
  ], { ...O, closed: true });

  // 四坡短檐（折线）
  glowPath(g, [
    [x - eaveW / 2, topY], [x - ridgeW / 2, topY - eaveH],
    [x + ridgeW / 2, topY - eaveH], [x + eaveW / 2, topY],
  ], { ...O, closed: true });

  // 吊杆
  glowPath(g, [[x, topY - eaveH], [x, lampY + lampR]], O);

  // 六角灯笼
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const an = (i / 6) * TAU - Math.PI / 2;
    hex.push([x + Math.cos(an) * lampR, lampY + Math.sin(an) * lampR]);
  }
  glowPath(g, hex, { ...O, closed: true });

  // 窗格 3×2（只画框）
  const padX = 16 * s;
  const winX0 = x - W / 2 + padX;
  const winW = W - padX * 2;
  const winTop = topY + 18 * s;
  const winH = 92 * s;
  const gap = 5 * s;
  const cw = (winW - gap * 2) / 3;
  const ch = (winH - gap) / 2;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = winX0 + c * (cw + gap);
      const wy = winTop + r * (ch + gap);
      glowPath(g, [
        [wx, wy], [wx + cw, wy], [wx + cw, wy + ch], [wx, wy + ch],
      ], { ...O, closed: true, w: 1.7 });
    }
  }

  // 刻度盘：圆 + 12 道刻度 + 指针
  const dx = x + W * 0.20, dy = topY + 152 * s, dr = 17 * s;
  glowPath(g, circlePts(dx, dy, dr, 30), { ...O, closed: true, w: 1.7 });
  const needle = swirlAngle(t) - Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const an = (i / 12) * TAU;
    glowPath(g, [
      [dx + Math.cos(an) * dr * 0.74, dy + Math.sin(an) * dr * 0.74],
      [dx + Math.cos(an) * dr * 0.96, dy + Math.sin(an) * dr * 0.96],
    ], { a: a * 0.8, w: 1.2, trail: 0 });
  }
  glowPath(g, [
    [dx, dy], [dx + Math.cos(needle) * dr * 0.70, dy + Math.sin(needle) * dr * 0.70],
  ], { ...O, w: 1.8 });

  // 宽底座
  glowPath(g, [
    [x - (W / 2 + 10 * s), baseY], [x + (W / 2 + 10 * s), baseY],
  ], { ...O, w: 2.2 });
  glowPath(g, [
    [x - (W / 2 + 10 * s), baseY], [x - (W / 2 + 10 * s), baseY - 9 * s],
  ], { ...O, w: 1.5 });
  glowPath(g, [
    [x + (W / 2 + 10 * s), baseY], [x + (W / 2 + 10 * s), baseY - 9 * s],
  ], { ...O, w: 1.5 });

  // 灯笼内的时间漩涡
  drawLanternSwirl(g, x, lampY, lampR * 0.62, a, local, t);
}
