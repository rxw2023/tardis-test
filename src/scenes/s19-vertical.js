// ============================================================
// s19-vertical.js — 第 19 版块：竖屏短视频（2020s）
//
// 美术口径：
//   版式：画面收窄成 9:16 竖屏（单位空间 x 219..781），两侧压成近黑
//        竖屏内是一段"路人手机拍的"黄昏街景：紫橙渐变天、远景楼群剪影、
//        月亮、时间公路、悬浮的时空舱
//   界面：全部虚构——不在任何真实平台上存在的 App「闪拍」
//        顶部状态栏与「关注 / 推荐」、右侧头像+点赞+评论+分享、
//        底部作者与文案、最下方一条进度条（走完正好过画框）
//   梗：第 2 小节弹幕密集刷过（"这特效得五毛吧"），点赞数在强拍上跳涨，
//       心形图标猛放大回弹；进度条在强拍处抖一下
//   节奏：点赞飘心与弹幕速度与拍点对齐；进度条 6 秒走满
//
// 分层：render 画竖屏内的画面（天空/楼群/月），主调度随后画公路，
//      drawVehicle 负责两侧黑边 + 舱体 + App 界面（界面永远在最上层）
// ============================================================

import { TAU, BEAT, BAR, SCENE_LEN, routeU, hoverY, smooth } from '../beat/beats.js';
import { mulberry32, rrFill } from '../kit/kit.js';
import { drawCapsule } from '../rig/capsule.js';

const VX0 = 218.75;          // 竖屏左边界
const VW = 562.5;            // 竖屏宽（9:16 → 高 1000）
const VX1 = VX0 + VW;
const CAP_BASE = 830;        // 舱体在竖屏里的贴地线（让出底部文案区）
const CAP_S = 0.58;          // 舱体缩放
const SANS = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif';

const ACCENT = [254, 44, 85];

// ---- 固定构图的楼群（手排，避免每帧抖动）----
const CITY = [
  { x: 226, w: 30, h: 62 }, { x: 260, w: 22, h: 96 }, { x: 286, w: 34, h: 74 },
  { x: 324, w: 26, h: 118 }, { x: 354, w: 38, h: 88 }, { x: 396, w: 24, h: 132 },
  { x: 424, w: 30, h: 96 }, { x: 458, w: 34, h: 150 }, { x: 496, w: 22, h: 104 },
  { x: 522, w: 36, h: 124 }, { x: 562, w: 26, h: 86 }, { x: 592, w: 32, h: 112 },
  { x: 628, w: 24, h: 70 }, { x: 656, w: 34, h: 96 }, { x: 694, w: 26, h: 78 },
  { x: 724, w: 32, h: 108 }, { x: 758, w: 24, h: 66 },
];

// ---- 弹幕文案（虚构评论区）----
const DANMAKU = [
  { t: 0.20, text: '？？？', x: 300, period: 7.2 },
  { t: 0.90, text: '这特效得五毛吧', x: 392, period: 8.0 },
  { t: 1.60, text: '第 47 遍了', x: 268, period: 7.6 },
  { t: 2.10, text: '我奶奶说这是在拍电影', x: 360, period: 8.4 },
  { t: 2.35, text: '盒子精', x: 470, period: 7.0 },
  { t: 2.55, text: '进度条走得比我人生快', x: 300, period: 8.8 },
  { t: 3.10, text: '求坐标', x: 420, period: 7.4 },
  { t: 3.55, text: '这条路通向哪', x: 340, period: 8.2 },
  { t: 4.20, text: '已三连', x: 480, period: 7.8 },
  { t: 4.80, text: '下一格见', x: 310, period: 8.6 },
];

// ---- 右侧工具列 ----
const RAIL_X = 748;
const RAIL = [
  { y: 492, kind: 'heart', label: '128.4万' },
  { y: 600, kind: 'comment', label: '3.2万' },
  { y: 700, kind: 'share', label: '分享' },
];

let skyG = null;

// ============================================================
// 竖屏内的画面
// ============================================================
export function render(g, meta, local) {
  // 竖屏外先用纯黑垫底（公路随后会覆盖，由 drawVehicle 再压一次）
  g.push();
  g.noStroke();
  g.fill(8, 7, 10);
  g.rect(0, 0, 1000, 1000);
  g.pop();

  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(VX0, 0, VW, 1000);
  g.drawingContext.clip();

  drawSky(g);
  drawStars(g);
  drawMoon(g, local);
  drawHorizonGlow(g);
  drawCity(g);
  drawGround(g);
  drawPhoneLook(g, local);

  g.drawingContext.restore();
  g.pop();
}

export function camera() {
  return { z: 1 };
}

// 两个钩子都在这一格里用：舱体在竖屏里跑，界面压在最上层
export function drawVehicle(g, { local, t, wave }) {
  // 1 两侧黑边（把整幅画面收成 9:16）
  g.push();
  g.noStroke();
  g.fill(8, 7, 10);
  g.rect(0, 0, VX0, 1000);
  g.rect(VX1, 0, 1000 - VX1, 1000);
  // 边线：一道极细的亮边，读作"屏幕边框"
  g.fill(58, 52, 66, 120);
  g.rect(VX0 - 1.6, 0, 1.6, 1000);
  g.rect(VX1, 0, 1.6, 1000);
  g.pop();

  // 2 舱体：在竖屏里从左画框驶向右画框
  const local6 = local;
  const x = -140 + routeU(local6) * 1280;
  const bob = hoverY(local6) * 0.58;
  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(VX0, 0, VW, 1000);
  g.drawingContext.clip();

  // 湿路面反光：把舱体"坐"在路面上
  g.push();
  g.noStroke();
  for (let i = 3; i >= 1; i--) {
    g.fill(255, 168, 108, 9 * i);
    g.ellipse(x, 906, 74 * i, 9 * i);
  }
  g.fill(255, 226, 160, 26);
  g.rect(x - 26, 900, 52, 42, 10);
  g.pop();

  drawCapsule(g, x, CAP_BASE + bob, CAP_S, {
    t, hoverLocal: local6, driverPose: { t, wave },
  });
  g.drawingContext.restore();
  g.pop();

  // 3 界面
  g.push();
  drawStatusBar(g);
  drawTabs(g, local);
  drawRail(g, local);
  drawCaption(g);
  drawDanmaku(g, local);
  drawHearts(g, local);
  drawProgress(g, local);
  drawPhoneLookTop(g, local);
  g.pop();
}

// ------------------------------------------------------------
function drawSky(g) {
  if (!skyG) {
    const ctx = g.drawingContext;
    const gd = ctx.createLinearGradient(0, 0, 0, 720);
    gd.addColorStop(0.00, '#160f2a');
    gd.addColorStop(0.32, '#2c1a44');
    gd.addColorStop(0.60, '#5b3059');
    gd.addColorStop(0.82, '#a05a5e');
    gd.addColorStop(1.00, '#d99163');
    skyG = gd;
  }
  const ctx = g.drawingContext;
  ctx.save();
  ctx.fillStyle = skyG;
  ctx.fillRect(VX0, 0, VW, 720);
  ctx.restore();

  // 几道横云
  g.push();
  g.noStroke();
  const rnd = mulberry32(771);
  for (let i = 0; i < 7; i++) {
    g.fill(255, 190, 150, 10 + rnd() * 14);
    g.ellipse(VX0 + rnd() * VW, 380 + rnd() * 260, 180 + rnd() * 260, 10 + rnd() * 16);
  }
  g.pop();
}

function drawMoon(g, local) {
  const mx = 318, my = 196, r = 25;
  g.push();
  g.noStroke();
  g.fill(255, 235, 200, 10);
  g.circle(mx, my, r * 2 + 44);
  g.fill(255, 242, 214, 235);
  g.circle(mx, my, r * 2);
  g.fill(238, 222, 196, 55);
  g.circle(mx - 7, my - 5, 8);
  g.circle(mx + 6, my + 7, 5);
  g.pop();
}

// 星点：极淡，铺在天顶
function drawStars(g) {
  const rnd = mulberry32(5151);
  g.push();
  g.noStroke();
  for (let i = 0; i < 46; i++) {
    g.fill(255, 248, 235, 40 + rnd() * 90);
    g.circle(VX0 + rnd() * VW, 20 + rnd() * 300, 1 + rnd() * 1.8);
  }
  g.pop();
}

// 地平线暖光：城市背后的一层橙雾
function drawHorizonGlow(g) {
  const ctx = g.drawingContext;
  ctx.save();
  const gd = ctx.createLinearGradient(0, 520, 0, 730);
  gd.addColorStop(0, 'rgba(226,140,96,0)');
  gd.addColorStop(1, 'rgba(236,152,100,0.42)');
  ctx.fillStyle = gd;
  ctx.fillRect(VX0, 520, VW, 210);
  ctx.restore();
}

function drawCity(g) {
  const rnd = mulberry32(3311);
  g.push();
  g.noStroke();
  // 远景更淡的一层
  for (let i = 0; i < 14; i++) {
    const w = 26 + rnd() * 30;
    const h = 40 + rnd() * 60;
    g.fill(60, 42, 66, 120);
    g.rect(VX0 - 10 + i * 42, 712 - h, w, h);
  }
  // 近景楼群
  for (const b of CITY) {
    g.fill(28, 20, 36, 235);
    g.rect(b.x, 712 - b.h, b.w, b.h);
    // 几扇亮着的窗
    const n = Math.floor(b.h / 26);
    for (let k = 0; k < n; k++) {
      if (rnd() > 0.42) continue;
      g.fill(255, 214, 150, 150 + rnd() * 80);
      g.rect(b.x + 5 + (rnd() > 0.5 ? 8 : 0), 712 - b.h + 10 + k * 24, 5, 7);
    }
  }
  g.pop();
}

function drawGround(g) {
  g.push();
  g.noStroke();
  // 路肩与地面：竖屏里看不出公路延伸，只留一条暗带
  g.fill(20, 16, 24);
  g.rect(VX0, 712, VW, 60);
  g.fill(16, 13, 20);
  g.rect(VX0, 940, VW, 60);
  g.pop();
}

// 手机拍摄质感：暗角 + 颗粒
function drawPhoneLook(g, local) {
  const ctx = g.drawingContext;
  ctx.save();
  const grad = ctx.createRadialGradient(500, 480, 220, 500, 480, 620);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(VX0, 0, VW, 1000);
  ctx.restore();

  // 颗粒（固定种子，不逐帧闪）
  const rnd = mulberry32(9182);
  g.push();
  g.noStroke();
  for (let i = 0; i < 260; i++) {
    const a = 8 + rnd() * 14;
    g.fill(255, 255, 255, a);
    g.rect(VX0 + rnd() * VW, rnd() * 1000, 1.4, 1.4);
  }
  g.pop();
}

function drawPhoneLookTop(g, local) {
  // 界面层的轻微暗角，让白字压得住
  const ctx = g.drawingContext;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 760, 0, 1000);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(VX0, 760, VW, 240);
  const top = ctx.createLinearGradient(0, 0, 0, 130);
  top.addColorStop(0, 'rgba(0,0,0,0.5)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(VX0, 0, VW, 130);
  ctx.restore();
}

// ============================================================
// App 界面（全部虚构）
// ============================================================
function drawStatusBar(g) {
  g.push();
  g.noStroke();
  g.fill(255, 255, 255, 235);
  g.textFont(SANS);
  g.textAlign(g.LEFT, g.CENTER);
  g.textSize(20);
  g.text('9:41', VX0 + 22, 30);

  // 信号：四根渐高的竖条
  for (let i = 0; i < 4; i++) {
    g.fill(255, 255, 255, 180 + i * 20);
    g.rect(VX0 + VW - 116 + i * 9, 34 - i * 4, 5, 8 + i * 4, 1.2);
  }
  // 电量：圆角框 + 内条 + 小凸点
  g.noFill();
  g.stroke(255, 255, 255, 200);
  g.strokeWeight(1.6);
  g.rect(VX0 + VW - 62, 22, 26, 13, 3);
  g.noStroke();
  g.fill(255, 255, 255, 220);
  g.rect(VX0 + VW - 59, 25, 15, 7, 1.5);
  g.rect(VX0 + VW - 34, 26.5, 2.4, 4, 1);
  g.pop();
}

function drawTabs(g, local) {
  g.push();
  g.noStroke();
  g.textFont(SANS);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(22);
  g.fill(255, 255, 255, 130);
  g.text('关注', 420, 82);
  const hot = 0.86 + 0.14 * Math.exp(-Math.pow(((local % BAR) / BAR) * 4, 2));
  g.fill(255, 255, 255, 240 * hot);
  g.textSize(23);
  g.text('推荐', 500, 82);
  // 选中下划线
  g.fill(255, 255, 255, 230);
  g.rect(482, 100, 36, 3.4, 1.7);
  // 右侧搜索
  g.noFill();
  g.stroke(255, 255, 255, 210);
  g.strokeWeight(2);
  g.circle(VX0 + VW - 34, 80, 15);
  g.line(VX0 + VW - 24, 90, VX0 + VW - 17, 97);
  g.pop();
}

function drawRail(g, local) {
  const pulse = Math.exp(-Math.pow(((local % BAR) / 0.34), 2));

  for (const item of RAIL) {
    g.push();
    g.translate(RAIL_X, item.y);
    if (item.kind === 'heart') {
      const k = 1 + pulse * 0.34;
      g.scale(k);
      drawHeart(g, 0, 0, 26, 255, 255, 255);
      g.pop();
      g.push();
      g.translate(RAIL_X, item.y);
      g.noStroke();
      g.fill(255, 255, 255, 235);
      g.textFont(SANS);
      g.textAlign(g.CENTER, g.TOP);
      g.textSize(18);
      const num = (128.4 + Math.floor(local / BAR) * 0.1).toFixed(1);
      g.text(`${num}万`, 0, 36);
      g.pop();
    } else if (item.kind === 'comment') {
      g.noFill();
      g.stroke(255, 255, 255, 240);
      g.strokeWeight(3);
      g.rect(-24, -20, 48, 34, 9);
      g.line(-12, 14, -18, 24);
      g.line(-12, 14, -2, 14);
      g.pop();
      g.push();
      g.translate(RAIL_X, item.y);
      g.noStroke();
      g.fill(255, 255, 255, 235);
      g.textFont(SANS);
      g.textAlign(g.CENTER, g.TOP);
      g.textSize(18);
      g.text(item.label, 0, 36);
      g.pop();
    } else {
      g.noFill();
      g.stroke(255, 255, 255, 240);
      g.strokeWeight(3);
      // 分享箭头
      g.line(-18, 6, 14, -16);
      g.line(-18, 6, 8, 16);
      g.line(6, -18, 16, -16);
      g.line(6, 18, 16, 16);
      g.pop();
      g.push();
      g.translate(RAIL_X, item.y);
      g.noStroke();
      g.fill(255, 255, 255, 235);
      g.textFont(SANS);
      g.textAlign(g.CENTER, g.TOP);
      g.textSize(18);
      g.text(item.label, 0, 36);
      g.pop();
    }
  }

  // 头像：虚构的几何标记
  g.push();
  g.translate(RAIL_X, 404);
  g.noStroke();
  g.fill(255, 255, 255, 60);
  g.circle(0, 0, 62);
  g.fill(22, 18, 28);
  g.circle(0, 0, 52);
  g.fill(120, 220, 210);
  g.circle(0, -2, 22);
  g.fill(190, 160, 90);
  g.rect(-9, 12, 18, 6, 2);
  // 关注的加号
  g.fill(ACCENT[0], ACCENT[1], ACCENT[2]);
  g.circle(0, 30, 22);
  g.fill(255);
  g.rect(-1.6, 24, 3.2, 12, 1.4);
  g.rect(-6, 28.4, 12, 3.2, 1.4);
  g.pop();
}

function drawCaption(g) {
  g.push();
  g.noStroke();
  g.textFont(SANS);
  g.textAlign(g.LEFT, g.BASELINE);

  g.fill(255, 255, 255, 250);
  g.textSize(25);
  g.text('@时间驾驶员', VX0 + 24, 858);

  g.fill(255, 255, 255, 235);
  g.textSize(21);
  g.text('又是这个方盒子…第 47 次了', VX0 + 24, 892);

  // 音乐条
  g.fill(255, 255, 255, 210);
  g.textSize(18);
  g.text('♪ 原创配乐 · 时空驾驶', VX0 + 44, 924);
  g.noFill();
  g.stroke(255, 255, 255, 210);
  g.strokeWeight(2);
  g.circle(VX0 + 30, 918, 15);
  g.noStroke();
  g.fill(255, 255, 255, 210);
  g.beginShape();
  g.vertex(VX0 + 27, 912);
  g.vertex(VX0 + 34, 918);
  g.vertex(VX0 + 27, 924);
  g.endShape(g.CLOSE);
  g.pop();
}

function drawDanmaku(g, local) {
  g.push();
  g.textFont(SANS);
  g.textSize(18);
  g.textAlign(g.LEFT, g.CENTER);
  for (const d of DANMAKU) {
    const ph = ((local - d.t) / d.period + 4) % 1;
    if (local < d.t) continue;
    const y = 690 - ph * 600;
    // 上下两端淡出
    const a = smooth(0, 0.08, ph) * (1 - smooth(0.86, 1, ph));
    if (a <= 0.02) continue;
    const w = g.textWidth(d.text) + 26;
    g.noStroke();
    g.fill(12, 10, 16, 130 * a);
    rrFill(g, d.x - 13, y - 15, w, 30, 15);
    g.fill(255, 255, 255, 235 * a);
    g.text(d.text, d.x, y);
  }
  g.pop();
}

// 点赞飘心：从点赞按钮升起
function drawHearts(g, local) {
  g.push();
  for (let i = 0; i < 12; i++) {
    const period = 2.0 + (i % 3) * 0.4;
    const ph = ((local + i * 0.37) / period) % 1;
    if (local < 0.6) continue;
    const x = RAIL_X - 6 + Math.sin(ph * TAU + i) * 22;
    const y = 560 - ph * 260;
    const a = (1 - ph) * 0.75;
    const s = 0.7 + (i % 4) * 0.22;
    drawHeart(g, x, y, 13 * s, ACCENT[0], ACCENT[1], ACCENT[2], a);
  }
  g.pop();
}

function drawHeart(g, x, y, r, cr, cg, cb, alpha = 1) {
  g.push();
  g.translate(x, y);
  g.noStroke();
  g.fill(cr, cg, cb, 255 * alpha);
  g.beginShape();
  g.vertex(0, r * 0.85);
  g.vertex(-r, r * 0.05);
  g.vertex(-r * 0.92, -r * 0.55);
  g.vertex(-r * 0.42, -r * 0.95);
  g.vertex(0, -r * 0.5);
  g.vertex(r * 0.42, -r * 0.95);
  g.vertex(r * 0.92, -r * 0.55);
  g.vertex(r, r * 0.05);
  g.endShape(g.CLOSE);
  g.pop();
}

function drawProgress(g, local) {
  const u = Math.min(1, local / SCENE_LEN);
  const y = 986;
  const x0 = VX0 + 16, x1 = VX1 - 16;
  g.push();
  g.noStroke();
  g.fill(255, 255, 255, 70);
  g.rect(x0, y, x1 - x0, 3, 1.5);
  // 强拍处抖一下
  const jolt = 3 * Math.exp(-Math.pow(((local % BEAT) / 0.12), 2));
  g.fill(255, 255, 255, 235);
  g.rect(x0, y - jolt * 0.3, (x1 - x0) * u, 3 + jolt * 0.3, 1.5);
  g.fill(255, 255, 255, 250);
  g.circle(x0 + (x1 - x0) * u, y + 1.5, 8);
  g.pop();
}
