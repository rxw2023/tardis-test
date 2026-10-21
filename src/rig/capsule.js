// ============================================================
// capsule.js — 参数化时空舱（原创设计，非蓝色警亭）
// 青瓷色立式舱体 + 黄铜包边 + 圆形跑马顶灯（内含时间漩涡）
// 所有参数可被各版块覆盖以换风格；姿态由 beats 模块驱动
// ============================================================

import { TAU, swirlAngle, hoverY } from '../beat/beats.js';
import { rrFill, rrStroke } from '../kit/kit.js';

export const DEFAULT_CAPSULE = {
  w: 150, h: 215,
  body: '#1f8a94',      // 青瓷
  bodyDark: '#14606a',
  trim: '#c9973f',      // 黄铜
  lamp: '#ffd97a',      // 暖黄灯
  glass: '#0e3a42',     // 窗玻璃
  windowCols: 2,
  windowRows: 3,
};

/**
 * 在 (x, y=贴地点) 画舱体；s 为缩放（单位空间内 1）
 * opts: { capsule, hoverLocal, t, driverPose }
 */
export function drawCapsule(g, x, y, s = 1, opts = {}) {
  const cap = { ...DEFAULT_CAPSULE, ...(opts.capsule || {}) };
  const W = cap.w, H = cap.h;
  const hover = opts.hoverLocal != null ? hoverY(opts.hoverLocal) : 0;
  const topY = y + hover * s - H * s;

  g.push();
  g.noStroke();

  // 投影
  const lift = (hover + 10) / 24; // 0..1 越高影子越散
  g.fill(0, 0, 0, 60 * (1 - lift * 0.5));
  g.ellipse(x, y + 6 * s, W * (1.0 + lift * 0.25) * s, 20 * s);

  // 舱体
  g.fill(cap.body);
  rrFill(g, x - W / 2 * s, topY, W * s, H * s, 12 * s);
  // 左侧暗面
  g.fill(0, 0, 0, 46);
  rrFill(g, x - W / 2 * s, topY, W * 0.2 * s, H * s, 12 * s);

  // 黄铜包边
  g.noFill();
  g.stroke(cap.trim);
  g.strokeWeight(4.5 * s);
  rrStroke(g, x - W / 2 * s, topY, W * s, H * s, 12 * s);

  // 顶板
  g.noStroke();
  g.fill(cap.bodyDark);
  rrFill(g, x - (W / 2 + 9) * s, topY - 13 * s, (W + 18) * s, 16 * s, 6 * s);

  // 灯柱 + 圆形跑马顶灯（内含时间漩涡）
  g.fill(cap.trim);
  g.rect(x - 3.5 * s, topY - 40 * s, 7 * s, 28 * s);
  const lampY = topY - 58 * s;
  // 光晕
  for (let i = 3; i >= 1; i--) {
    g.fill(255, 217, 122, 26 * i);
    g.circle(x, lampY, (44 + i * 14) * s);
  }
  g.fill(cap.lamp);
  g.circle(x, lampY, 40 * s);
  // 漩涡：两段弧线随 swirlAngle 旋转
  g.noFill();
  g.stroke(140, 90, 20, 220);
  g.strokeWeight(3 * s);
  const a = swirlAngle(opts.t ?? 0);
  g.arc(x, lampY, 30 * s, 30 * s, a, a + 1.9);
  g.arc(x, lampY, 18 * s, 18 * s, a + Math.PI, a + Math.PI + 1.9);
  // 灯罩圈
  g.noFill();
  g.stroke(cap.trim);
  g.strokeWeight(3.5 * s);
  g.circle(x, lampY, 42 * s);

  // 窗格
  const winTop = topY + 24 * s;
  const winH = 96 * s;
  const gw = (W - 34 * s) / cap.windowCols;
  const gh = winH / cap.windowRows;
  for (let r = 0; r < cap.windowRows; r++) {
    for (let c = 0; c < cap.windowCols; c++) {
      const wx = x - (W - 34 * s) / 2 + c * (gw + 6 * s) + 0 * s;
      const wy = winTop + r * (gh + 5 * s);
      g.noStroke();
      g.fill(cap.glass);
      rrFill(g, wx, wy, gw, gh, 4 * s);
      // 玻璃反光
      g.fill(255, 255, 255, 26);
      g.push();
      g.translate(wx + gw * 0.5, wy + gh * 0.5);
      g.rotate(-0.5);
      g.rect(-gw * 0.32, -gh, gw * 0.14, gh * 2);
      g.pop();
    }
  }

  // 驾驶员（画在上排窗户内）
  if (opts.driverPose) {
    drawDriverInWindow(g, x - (W - 34 * s) / 2 + 3 * s + gw * 0.5, winTop + gh * 0.62, s * 0.9, opts.driverPose);
  }

  // 门：下半段，中缝 + 把手
  const doorTop = topY + 132 * s;
  g.noFill();
  g.stroke(0, 0, 0, 70);
  g.strokeWeight(2.4 * s);
  g.line(x, doorTop, x, topY + H * s - 12 * s);
  g.stroke(cap.trim);
  g.strokeWeight(3 * s);
  g.line(x + 9 * s, doorTop + 40 * s, x + 9 * s, doorTop + 58 * s);

  // 底座
  g.noStroke();
  g.fill(cap.bodyDark);
  rrFill(g, x - (W / 2 + 6) * s, y + hover * s - 12 * s, (W + 12) * s, 14 * s, 4 * s);

  g.pop();
}

// ============================================================
// driver.js 内容内联在这里（骨架阶段简单剪影；后续骨骼木偶独立成文件）
// ============================================================
function drawDriverInWindow(g, cx, cy, s, pose) {
  g.push();
  g.noStroke();
  g.fill(12, 30, 36, 235);
  // 头 + 肩
  g.circle(cx, cy - 9 * s, 15 * s);
  g.ellipse(cx, cy + 5 * s, 22 * s, 13 * s);
  // 手臂：wave 时举起，否则向前握"操纵杆"
  g.stroke(12, 30, 36, 235);
  g.strokeWeight(5 * s);
  g.strokeCap(g.ROUND);
  if (pose && pose.wave) {
    const wig = Math.sin((pose.t || 0) * 9) * 0.25;
    g.line(cx + 6 * s, cy + 2 * s, cx + 17 * s, cy - 20 * s + wig * 8 * s);
  } else {
    g.line(cx + 6 * s, cy + 2 * s, cx + 16 * s, cy + 8 * s);
  }
  g.pop();
}
