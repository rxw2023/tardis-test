// ============================================================
// cover.js — 视频封面：把 20 个版块的「真实渲染」铺成 5×4 网格
//
// 构图口径：
//   1 每一格都是真场景模块画出来的，不是色块也不是图标 —— 撒哈拉就是
//     牛群岩画，星月夜就是漩涡星空，示波器就是正弦波。要具体，就别抽象。
//   2 格内等比缩放（scale = 384/1000），纵向裁掉 y<260 的天空，
//     把路（770~940）和舱体留在画面底部，各格构图因此对齐。
//   3 每格左下角标死三件事：序号 / 中文名 / 年代。
//   4 中央压一张片名卡：主标题 + 时空舱 + 一条 20 站时间轴刻度，
//     刻度点用各版块的 accent 色，首尾标「约前 4000 → 2020s」。
// ============================================================

import { SCENES } from '../scenes/meta.js';
import { moduleFor } from '../scenes/index.js';
import { drawCapsule } from '../rig/capsule.js';
import { drawRoadUnit } from '../kit/road.js';
import { routeU, SCENES_START, SCENE_LEN } from '../beat/beats.js';
import { rrFill, rrStroke, grain, vignette } from '../kit/kit.js';

const ZH = '"KaiTi","STKaiti","SimSun",serif';
const EN = 'Georgia,"Times New Roman",serif';

// ---- 网格 ----
const COLS = 5, ROWS = 4;
const CW = 1920 / COLS;              // 384
const CH = 1080 / ROWS;              // 270
const S = CW / 1000;                 // 单位 → 像素，0.384
const CROP_TOP = 260;                // 单位空间：裁掉顶部 260 的天空
const RIDE_Y = 890;                  // 舱体贴地点（单位空间，与 main.js 一致）
const HILITE = 2.6;                  // 版块内高光时刻：第 2 小节中，场景全展开 + 挥手

// ---- 片名卡 ----
const CARD_W = 1180, CARD_H = 210;
const CARD_X = (1920 - CARD_W) / 2;
const CARD_Y = (1080 - CARD_H) / 2;

// hex '#rrggbb' → [r,g,b]
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 原生 canvas 文字：p5.text 的字号状态在 p5.brush 补丁下不可靠，
// 封面这种一次性排版全部走 fillText，字号/颜色/对齐即写即生效。
function textNative(g, str, x, y, font, fill, align = 'center') {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.restore();
}

// ------------------------------------------------------------
// 一格：一个真实版块
// ------------------------------------------------------------
function drawCell(g, i) {
  const meta = SCENES[i];
  const c = i % COLS, r = (i / COLS) | 0;
  const gx = c * CW, gy = r * CH;
  const local = HILITE;
  const t = SCENES_START + i * SCENE_LEN + local;
  const mod = moduleFor(i);

  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(gx, gy, CW, CH);
  g.drawingContext.clip();

  // 兜底底色：模块没铺满时不至于露出画布底色
  g.noStroke();
  g.fill(meta.bg);
  g.rect(gx, gy, CW, CH);

  // 进入 1000 单位空间（纵向裁掉顶部）
  g.translate(gx, gy - CROP_TOP * S);
  g.scale(S);

  if (mod && mod.camera) {
    const cam = mod.camera(local);
    if (cam && cam.z && cam.z !== 1) {
      const fx = cam.fx ?? 500, fy = cam.fy ?? 500;
      g.translate(fx, fy); g.scale(cam.z); g.translate(-fx, -fy);
    }
  }
  if (mod) mod.render(g, meta, local, i);

  drawRoadUnit(g, t);

  // 时空舱 / 本版块自己的载具
  const x = routeU(local) * 1000;
  const wave = local >= 2.0 && local < 4.0;
  if (mod && mod.drawVehicle) {
    mod.drawVehicle(g, { x, y: RIDE_Y, local, t, wave });
  } else {
    drawCapsule(g, x, RIDE_Y, 1, { t, hoverLocal: local, driverPose: { t, wave } });
  }

  g.drawingContext.restore();

  // ---- 左下角标注：序号 / 中文名 / 年代 ----
  labelCell(g, i, meta, gx, gy);
  g.pop();
}

function labelCell(g, i, meta, gx, gy) {
  const ctx = g.drawingContext;
  const H = 78;
  const grad = ctx.createLinearGradient(0, gy + CH - H, 0, gy + CH);
  grad.addColorStop(0, 'rgba(6,6,8,0)');
  grad.addColorStop(0.55, 'rgba(6,6,8,0.72)');
  grad.addColorStop(1, 'rgba(6,6,8,0.92)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(gx, gy + CH - H, CW, H);
  ctx.restore();

  // 序号徽章（用版块 accent 色）
  const [ar, ag, ab] = rgb(meta.accent);
  g.push();
  g.noStroke();
  g.fill(ar, ag, ab, 235);
  g.rect(gx + 16, gy + CH - 66, 30, 22, 4);
  g.pop();
  textNative(g, String(i + 1).padStart(2, '0'), gx + 31, gy + CH - 47,
    `600 15px ${EN}`, '#0c0b0e');
  textNative(g, meta.zh, gx + 54, gy + CH - 44,
    `23px ${ZH}`, '#fffdf7', 'left');
  textNative(g, `${meta.era}  ·  ${meta.en.toUpperCase()}`, gx + 54, gy + CH - 22,
    `13px ${EN}`, '#cac5ba', 'left');
}

// ------------------------------------------------------------
// 中央片名卡
// ------------------------------------------------------------
function drawTitleCard(g) {
  // 卡片本体
  g.push();
  g.noStroke();
  g.fill(10, 9, 12, 228);
  rrFill(g, CARD_X, CARD_Y, CARD_W, CARD_H, 22);
  g.noFill();
  g.stroke(31, 138, 148, 210);
  g.strokeWeight(2);
  rrStroke(g, CARD_X, CARD_Y, CARD_W, CARD_H, 22);

  // 眉标
  textNative(g, '2 0   S T A T I O N S   ·   1 3 7 s   ·   1 2 0   B P M',
    960, CARD_Y + 34, `14px ${EN}`, '#96928a');

  // 主标题
  textNative(g, '《塔迪斯测试》', 960, CARD_Y + 116, `76px ${ZH}`, '#fffdf7');

  // 副标题
  textNative(g, 'TARDIS TEST — A RIDE THROUGH ART HISTORY',
    960, CARD_Y + 146, `18px ${EN}`, '#b2ada4');

  drawTimeline(g);
  g.pop();
}

// 20 站时间轴：刻度点用各版块 accent 色
function drawTimeline(g) {
  const ax = CARD_X + 64, aw = CARD_W - 128;
  const ay = CARD_Y + CARD_H - 44;

  g.push();
  g.stroke(96, 92, 86);
  g.strokeWeight(1.5);
  g.line(ax, ay, ax + aw, ay);

  g.noStroke();
  for (let i = 0; i < 20; i++) {
    const px = ax + (aw * i) / 19;
    const [r, gg, b] = rgb(SCENES[i].accent);
    g.fill(r, gg, b, 240);
    g.circle(px, ay, 7.5);
  }
  g.pop();

  // 首尾年代
  textNative(g, '约前 4000', ax, ay + 26, `13px ${ZH}`, '#bab5ac', 'left');
  textNative(g, '2020s', ax + aw, ay + 26, `13px ${ZH}`, '#bab5ac', 'right');
}

// ------------------------------------------------------------
// 整张封面
// ------------------------------------------------------------
export function renderCover(g) {
  // 底
  g.push();
  g.noStroke();
  g.fill(12, 11, 14);
  g.rect(0, 0, g.width, g.height);

  for (let i = 0; i < 20; i++) drawCell(g, i);

  // 格缝：接触印相式的细分隔线
  g.stroke(9, 8, 11);
  g.strokeWeight(3);
  for (let c = 1; c < COLS; c++) g.line(c * CW, 0, c * CW, g.height);
  for (let r = 1; r < ROWS; r++) g.line(0, r * CH, g.width, r * CH);

  // 中央：时空舱悬在卡片上方
  g.push();
  g.translate(960, CARD_Y - 6);
  g.scale(0.60);
  drawCapsule(g, 0, 0, 1, { t: 0, hoverLocal: 0, driverPose: { t: 0, wave: true } });
  g.pop();

  drawTitleCard(g);

  // 收尾：颗粒 + 晕影，跟正片同一套质感
  grain(g, 0, 0, g.width, g.height, 21, 10);
  vignette(g, 0, 0, g.width, g.height, 70);

  // 外框
  g.noFill();
  g.stroke(24, 22, 28);
  g.strokeWeight(6);
  g.rect(0, 0, g.width, g.height);
  g.pop();
}

// ------------------------------------------------------------
// p5 实例
// ------------------------------------------------------------
const sketch = (p) => {
  p.setup = () => {
    const c = p.createCanvas(1920, 1080);
    c.parent('stage');
    p.pixelDensity(1);
    p.noLoop();
    renderCover(p);
    // 供 Puppeteer 截图握手
    window.__seek = () => { window.__FRAME_READY = true; };
    window.__FRAME_READY = true;
  };
  p.draw = () => { renderCover(p); };
};

new p5(sketch);
