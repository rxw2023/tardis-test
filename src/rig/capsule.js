// ============================================================
// capsule.js — 参数化时空舱（原创设计）
//
// 与《神秘博士》蓝色警亭刻意拉开距离的五个视觉口径：
//   1 颜色：青瓷绿松石 + 黄铜，不用深蓝，无任何文字头牌
//   2 顶部：四坡短檐 + 檐下六角灯笼（内含时间漩涡），不用圆柱白灯/尖塔
//   3 窗格：3 列 × 2 行横长窗，不是 2 列 × 3 行竖长窗
//   4 门板：左板三道铜百叶 + 右板圆形时间刻度盘（指针随漩涡转），无说明牌/徽章
//   5 比例：178×196 宽扁，底座带四个悬浮喷口
//
// 所有参数可被各版块覆盖；姿态由 beats 模块驱动
// ============================================================

import { TAU, swirlAngle, hoverY } from '../beat/beats.js';
import { rrFill, rrStroke } from '../kit/kit.js';

export const DEFAULT_CAPSULE = {
  w: 178, h: 196,
  body: '#1f8a94',      // 青瓷
  bodyDark: '#14606a',
  trim: '#c9973f',      // 黄铜
  lamp: '#ffd97a',      // 暖黄灯
  glass: '#0d3940',     // 窗玻璃
  windowCols: 3,
  windowRows: 2,
};

/**
 * 在 (x, y=贴地点) 画舱体；s 为缩放（单位空间内 1）
 * opts: { capsule, hoverLocal, t, driverPose }
 */
export function drawCapsule(g, x, y, s = 1, opts = {}) {
  const cap = { ...DEFAULT_CAPSULE, ...(opts.capsule || {}) };
  const W = cap.w, H = cap.h;
  const hover = opts.hoverLocal != null ? hoverY(opts.hoverLocal) : 0;
  const baseY = y + hover * s;         // 底座贴地线（含悬浮偏移）
  const topY = baseY - H * s;          // 舱体顶
  const t = opts.t ?? 0;

  g.push();
  g.noStroke();

  // ---- 地面投影 ----
  const lift = (hover + 10) / 24;
  g.fill(0, 0, 0, 60 * (1 - lift * 0.5));
  g.ellipse(x, y + 5 * s, W * (1.0 + lift * 0.22) * s, 18 * s);

  // ---- 悬浮喷口（四团微光，说明它不靠轮子）----
  for (let i = 0; i < 4; i++) {
    const jx = x + (i % 2 === 0 ? -1 : 1) * W * 0.32 * s;
    const jy = baseY + 6 * s;
    g.fill(150, 240, 255, 34);
    g.ellipse(jx, jy, 26 * s, 9 * s);
  }

  // ---- 舱体 ----
  g.fill(cap.body);
  rrFill(g, x - W / 2 * s, topY, W * s, H * s, 10 * s);
  g.fill(0, 0, 0, 44);
  rrFill(g, x - W / 2 * s, topY, W * 0.16 * s, H * s, 10 * s);
  // 黄铜包边
  g.noFill();
  g.stroke(cap.trim);
  g.strokeWeight(4 * s);
  rrStroke(g, x - W / 2 * s, topY, W * s, H * s, 10 * s);

  // ---- 四坡短檐 ----
  const eaveW = W + 26, eaveH = 22, ridgeW = W * 0.46;
  g.noStroke();
  g.fill(cap.bodyDark);
  g.beginShape();
  g.vertex(x - eaveW / 2 * s, topY);
  g.vertex(x - ridgeW / 2 * s, topY - eaveH * s);
  g.vertex(x + ridgeW / 2 * s, topY - eaveH * s);
  g.vertex(x + eaveW / 2 * s, topY);
  g.endShape(g.CLOSE);
  // 檐口黄铜线
  g.stroke(cap.trim);
  g.strokeWeight(3 * s);
  g.line(x - eaveW / 2 * s, topY, x + eaveW / 2 * s, topY);
  // 屋脊小鳍
  g.line(x, topY - eaveH * s, x, topY - (eaveH + 12) * s);
  g.noStroke();

  // ---- 檐下六角灯笼（含时间漩涡）----
  const lampY = topY - (eaveH + 30) * s;
  const lampR = 19 * s;
  for (let i = 3; i >= 1; i--) {
    g.fill(255, 217, 122, 24 * i);
    g.circle(x, lampY, lampR * 2 + i * 15 * s);
  }
  // 吊杆
  g.fill(cap.trim);
  g.rect(x - 2.5 * s, topY - (eaveH + 16) * s, 5 * s, 16 * s);
  // 六角灯体
  g.fill(cap.lamp);
  g.beginShape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    g.vertex(x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR);
  }
  g.endShape(g.CLOSE);
  // 灯内漩涡
  g.noFill();
  g.stroke(150, 96, 22, 220);
  g.strokeWeight(2.6 * s);
  const a0 = swirlAngle(t);
  g.arc(x, lampY, lampR * 1.35, lampR * 1.35, a0, a0 + 2.0);
  g.arc(x, lampY, lampR * 0.75, lampR * 0.75, a0 + Math.PI, a0 + Math.PI + 2.0);
  // 六角铜边
  g.stroke(cap.trim);
  g.strokeWeight(2.6 * s);
  g.beginShape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    g.vertex(x + Math.cos(a) * lampR, lampY + Math.sin(a) * lampR);
  }
  g.endShape(g.CLOSE);

  // ---- 窗格：3 列 × 2 行横长窗 ----
  const padX = 16 * s;
  const winX0 = x - W / 2 * s + padX;
  const winW = (W * s - padX * 2);
  const winTop = topY + 18 * s;
  const winH = 92 * s;
  const gap = 5 * s;
  const cw = (winW - gap * (cap.windowCols - 1)) / cap.windowCols;
  const ch = (winH - gap * (cap.windowRows - 1)) / cap.windowRows;
  let driverSlot = null;
  for (let r = 0; r < cap.windowRows; r++) {
    for (let c = 0; c < cap.windowCols; c++) {
      const wx = winX0 + c * (cw + gap);
      const wy = winTop + r * (ch + gap);
      g.noStroke();
      g.fill(cap.glass);
      rrFill(g, wx, wy, cw, ch, 3 * s);
      // 玻璃反光斜条
      g.fill(255, 255, 255, 22);
      g.push();
      g.translate(wx + cw / 2, wy + ch / 2);
      g.rotate(-0.45);
      g.rect(-cw * 0.28, -ch, cw * 0.13, ch * 2);
      g.pop();
      // 中挺
      g.stroke(20, 90, 98, 150);
      g.strokeWeight(2 * s);
      g.line(wx + cw / 2, wy, wx + cw / 2, wy + ch);
      if (r === 0 && c === 1) driverSlot = { x: wx + cw / 2, y: wy + ch * 0.64, w: cw };
    }
  }

  // ---- 驾驶员（中间上排窗内）----
  if (opts.driverPose && driverSlot) {
    drawDriverInWindow(g, driverSlot.x, driverSlot.y, s * 0.95, opts.driverPose);
  }

  // ---- 下半部门板 ----
  const doorTop = winTop + winH + 8 * s;
  const doorH = baseY - 14 * s - doorTop;
  // 中缝
  g.stroke(10, 60, 68, 180);
  g.strokeWeight(2.4 * s);
  g.line(x, doorTop, x, doorTop + doorH);
  // 黄铜把手
  g.stroke(cap.trim);
  g.strokeWeight(3 * s);
  g.line(x + 7 * s, doorTop + doorH * 0.42, x + 7 * s, doorTop + doorH * 0.62);

  // 左板：三道铜百叶
  g.noStroke();
  for (let i = 0; i < 3; i++) {
    g.fill(cap.bodyDark);
    rrFill(g, x - W / 2 * s + 20 * s, doorTop + 10 * s + i * 11 * s, W * 0.28 * s, 5 * s, 2 * s);
  }

  // 右板：圆形时间刻度盘（指针随漩涡转，全片恒定机械细节）
  const dx = x + W * 0.22 * s, dy = doorTop + doorH * 0.46;
  const dr = 15 * s;
  g.fill(cap.bodyDark);
  g.circle(dx, dy, dr * 2);
  g.stroke(cap.trim);
  g.strokeWeight(1.6 * s);
  g.circle(dx, dy, dr * 2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.line(
      dx + Math.cos(a) * dr * 0.72, dy + Math.sin(a) * dr * 0.72,
      dx + Math.cos(a) * dr * 0.94, dy + Math.sin(a) * dr * 0.94
    );
  }
  g.stroke(255, 235, 190, 230);
  g.strokeWeight(2 * s);
  const na = swirlAngle(t) - Math.PI / 2;
  g.line(dx, dy, dx + Math.cos(na) * dr * 0.66, dy + Math.sin(na) * dr * 0.66);

  // ---- 宽底座 ----
  g.noStroke();
  g.fill(cap.bodyDark);
  rrFill(g, x - (W / 2 + 7) * s, baseY - 12 * s, (W + 14) * s, 12 * s, 3 * s);
  g.stroke(cap.trim);
  g.strokeWeight(2 * s);
  g.line(x - (W / 2 + 7) * s, baseY - 12 * s, x + (W / 2 + 7) * s, baseY - 12 * s);

  g.pop();
}

// ============================================================
// 驾驶员剪影（骨架阶段；后续拆成独立骨骼木偶文件）
// ============================================================
function drawDriverInWindow(g, cx, cy, s, pose) {
  g.push();
  g.noStroke();
  g.fill(10, 28, 34, 240);
  g.circle(cx, cy - 8 * s, 14 * s);
  g.ellipse(cx, cy + 5 * s, 21 * s, 12 * s);
  g.stroke(10, 28, 34, 240);
  g.strokeWeight(4.5 * s);
  g.strokeCap(g.ROUND);
  if (pose && pose.wave) {
    const wig = Math.sin((pose.t || 0) * 9) * 0.3;
    g.line(cx + 5 * s, cy + 2 * s, cx + 15 * s, cy - 19 * s + wig * 7 * s);
  } else {
    g.line(cx + 5 * s, cy + 2 * s, cx + 14 * s, cy + 7 * s);
  }
  g.pop();
}
