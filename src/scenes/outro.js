// ============================================================
// outro.js — 新闻发布会（12 秒，6 小节）
// 7×3 展墙：前 20 格 = 20 份答卷，第 21 格 = 空的新闻发布席位
// 顺序：全景 → 推向第 21 格（闪光灯略，阶段 4 接音乐踩点）
//   → 字幕二 → 最后一拍时空舱一闪而过
// 全屏绘制（屏幕坐标系）
// ============================================================

import { smooth, TAU } from '../beat/beats.js';
import { drawCapsule } from '../rig/capsule.js';
import { SCENES } from './meta.js';

const ZH_SERIF = '"KaiTi","STKaiti","SimSun",serif';

// 展墙几何
const COLS = 7, ROWS = 3, CELL = 232, GAP = 14;
const X0 = (1920 - (COLS * CELL + (COLS - 1) * GAP)) / 2;  // ≈106
const Y0 = 120;
const CELL_STEP = CELL + GAP;

// 第 21 格中心（col 6, row 2）
const FOCUS = { x: X0 + 6 * CELL_STEP + CELL / 2, y: Y0 + 2 * CELL_STEP + CELL / 2 };

export function renderOutro(g, local) {
  const W = g.width, H = g.height;

  // 展墙背景
  g.noStroke();
  g.fill(16, 14, 18);
  g.rect(0, 0, W, H);

  // 镜头推近：local 3.5 → 7.5，从 1.0 推到 2.6；镜头中心同步从画面中心移到第 21 格
  const push = smooth(3.5, 7.5, local);
  const z = 1 + push * 1.6;
  const camX = W / 2 + (FOCUS.x - W / 2) * push;
  const camY = H / 2 + (FOCUS.y - H / 2) * push;
  g.push();
  g.translate(W / 2, H / 2);
  g.scale(z);
  g.translate(-camX, -camY);

  // 20 份答卷
  for (let i = 0; i < 20; i++) {
    const c = i % COLS, r = Math.floor(i / COLS);
    drawCell(g, X0 + c * CELL_STEP, Y0 + r * CELL_STEP, SCENES[i], i);
  }
  // 第 21 格：空席位
  drawPressCell(g, X0 + 6 * CELL_STEP, Y0 + 2 * CELL_STEP, local, push);

  g.pop();

  // ---- 字幕（带半透明衬底，避免与推镜后的格子冲突）----
  g.textFont(ZH_SERIF);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(44);

  const drawCaption = (txt, a) => {
    if (a <= 0.01) return;
    g.noStroke();
    g.fill(8, 8, 12, 150 * a);
    g.rect(0, H - 165, W, 120);
    g.fill(232, 228, 220, 255 * a);
    g.text(txt, W / 2, H - 105);
  };
  drawCaption('截至目前，人类共提交了 20 份答卷。',
    smooth(0.6, 1.2, local) * (1 - smooth(7.6, 8.1, local)));
  drawCaption('时空驾驶员本人对此尚未发表评论。', smooth(8.2, 8.7, local));

  // ---- 最后一拍：时空舱从席位后方一闪而过 ----
  const flash = smooth(10.55, 10.62, local) * (1 - smooth(10.95, 11.05, local));
  if (flash > 0.01) {
    const fx = W - (local - 10.55) * 5200;
    g.push();
    g.scale(1.2);
    g.tint && g.noTint();
    drawCapsule(g, fx / 1.2, (Y0 + 2 * CELL_STEP - 20) / 1.2, 1, { t: local });
    g.pop();
  }
}

// ---- 一格答卷 ----
function drawCell(g, x, y, meta, i) {
  g.push();
  // 底
  g.noStroke();
  const n = parseInt(meta.bg.slice(1), 16);
  g.fill((n >> 16) & 255, (n >> 8) & 255, n & 255);
  g.rect(x, y, CELL, CELL);
  // 迷你时空舱
  g.push();
  g.translate(x + CELL / 2, y + CELL * 0.72);
  g.scale(0.42);
  g.strokeWeight(2.5);
  drawCapsule(g, 0, 0, 1, { t: i * 0.7 });
  g.pop();
  // 编号 + 名字（深底格子自动改用浅色文字）
  const lum = cellLuma(meta.bg);
  g.noStroke();
  if (lum > 0.5) {
    const inkN = parseInt(meta.ink.slice(1), 16);
    g.fill(inkN >> 16 & 255, inkN >> 8 & 255, inkN & 255, 170);
  } else {
    g.fill(226, 222, 214, 200);
  }
  g.textAlign(g.LEFT, g.TOP);
  g.textSize(22);
  g.text(String(i + 1).padStart(2, '0'), x + 10, y + 8);
  g.textAlign(g.CENTER, g.BOTTOM);
  g.textSize(20);
  g.text(meta.zh, x + CELL / 2, y + CELL - 8);
  // 框
  g.noFill();
  g.stroke(0, 0, 0, 90);
  g.strokeWeight(6);
  g.rect(x - 3, y - 3, CELL + 6, CELL + 6);
  g.pop();
}

// ---- 第 21 格：空的新闻发布会席位 ----
function drawPressCell(g, x, y, local, push) {
  g.push();
  // 席位底
  g.noStroke();
  g.fill(22, 20, 26);
  g.rect(x, y, CELL, CELL);
  g.noFill();
  g.stroke(60, 56, 66);
  g.strokeWeight(6);
  g.rect(x - 3, y - 3, CELL + 6, CELL + 6);

  // 长桌
  g.noStroke();
  g.fill(46, 40, 44);
  g.rect(x + 20, y + CELL * 0.62, CELL - 40, 26, 6);
  // 一排麦克风（无任何真实媒体标志）
  g.stroke(180, 174, 168);
  g.strokeWeight(3);
  for (let i = 0; i < 4; i++) {
    const mx = x + 52 + i * 40;
    g.line(mx, y + CELL * 0.62, mx + 6, y + CELL * 0.44);
    g.noStroke();
    g.fill(180, 174, 168);
    g.circle(mx + 6, y + CELL * 0.42, 9);
    g.stroke(180, 174, 168);
    g.strokeWeight(3);
  }
  // 席卡
  g.noStroke();
  g.fill(226, 220, 208);
  g.rect(x + CELL / 2 - 60, y + CELL * 0.44, 120, 26, 4);
  g.fill(40, 36, 34);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(12);
  g.textFont(ZH_SERIF);
  g.text('时空驾驶员（本人）', x + CELL / 2, y + CELL * 0.44 + 13);
  // 空椅子
  g.noFill();
  g.stroke(120, 112, 110);
  g.strokeWeight(5);
  g.arc(x + CELL / 2, y + CELL * 0.92, 60, 70, Math.PI, TAU);

  // 闪光灯位置占位（阶段 4 接音乐强拍咔嚓）
  g.pop();
}

// 背景色亮度（0..1），用于格子文字自动选深浅
function cellLuma(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
