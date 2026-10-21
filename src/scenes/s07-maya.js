// ============================================================
// s07-maya.js — 第 07 玛雅抄本（Maya Codex / 约1200）
//
// 构图：一张摊开的树皮纸折页。中央竖直折痕 + 红色粗外框 + 内黑细线。
//   左页：方形字格里套着舱体的极简符号（由 drawVehicle 画，8fps 阶跃）
//         下半部是侧身执笔的抄写员（高羽饰、耳饰、玉串珠）
//   右页：上半部是自创的抽象"历法神"（背包裹、拄杖、头后计数环）
//         下半部是玛雅点横数字栏（点=1 横杠=5 贝壳=0，仅作计数）
//   梗：抄写员补数字补到页边格子不够，最后两个点被挤到红色框线外面 + 小箭头
//
// 版权：所有字格内符号均为自创抽象符号；点横数字只用于计数，
//       不组合成任何真实历法日期；神祇形象自创，不复制任何真实神祇。
// ============================================================

import { mulberry32, rrFill, rrStroke, grain, vignette } from '../kit/kit.js';
import { paper } from '../kit/ink.js';
import { BEAT, TAU, routeU, hoverY, swirlAngle } from '../beat/beats.js';

const ZH = '"KaiTi","STKaiti","SimSun",serif';

// ---- 版面几何 ----
const X0 = 44, Y0 = 40, X1 = 956, Y1 = 766;   // 折页外框（红粗框走这条线）
const CX = 500;                                // 折痕
const CW = X1 - X0, CH = Y1 - Y0;

const LP0 = 66, LP1 = 474;                     // 左页内区
const RP0 = 522, RP1 = 934;                    // 右页内区
const RT = 78, RB = 470;                       // 上半格（画面格）
const LT = 490, LB = 746;                      // 下半格（人物 / 数字栏）

// ---- 调色 ----
const INK = [42, 26, 16];
const RED = [176, 58, 46];
const BLUE = [43, 106, 122];
const YEL = [224, 176, 64];
const WHT = [240, 230, 210];
const SKIN = [176, 116, 54];

// ---- 虫蛀小孔（固定）----
const HOLES = [
  [112, 502, 12], [356, 112, 10], [452, 452, 14],
  [596, 428, 11], [904, 132, 12], [128, 724, 9],
];

// ---- 故意"填出界"的错位（固定 6 处）----
const MIS = [[4, -3], [-5, 3], [3, 4], [-3, -4], [5, 2], [-4, -2]];

// ---- 时间小工具 ----
function beatIdx(local) { return Math.floor(local / BEAT); }
function beatPulse(local) {
  const ph = (local % BEAT) / BEAT;
  return Math.exp(-Math.pow(ph / 0.15, 2));
}
// 过框：距本版块首尾的时间距离 → 0..1
function crossK(local) {
  const d = Math.min(local, 6 - local);
  return Math.exp(-Math.pow(d / 0.30, 2));
}

// ============================================================
// render
// ============================================================
export function render(g, meta, local, index) {
  drawBackdrop(g);
  drawCodexShadow(g);
  drawPaper(g);
  drawFold(g);

  drawRegisterFrame(g, LP0, RT, LP1 - LP0, RB - RT);
  drawLeftCaption(g);                     // 左页画面格下方的注解字格
  drawDraftCells(g);                      // 左页左下的草稿字格
  drawRegisterFrame(g, RP0, RT, RP1 - RP0, RB - RT);
  drawGodRegisterDecor(g);                // 右页画面格内的注解字格 / 水纹

  drawGod(g, local);                      // 右页：自创历法神
  drawScribe(g, local);                   // 左页：侧身执笔的抄写员

  drawOuterFrame(g, local);               // 红色粗外框（过框时加深一次）

  drawNumeralColumn(g, local);            // 右页下半：点横数字栏 + 溢出两点 + 箭头

  drawWormHoles(g);
  drawFibers(g);
  grain(g, X0, Y0, CW, CH, 7, 15);
  vignette(g, 0, 0, 1000, 1000, 118);
}

// ============================================================
// 底：折页摊在暗色台面上
// ============================================================
function drawBackdrop(g) {
  const ctx = g.drawingContext;
  g.push();
  g.noStroke();
  g.fill(34, 25, 18);
  g.rect(0, 0, 1000, 1000);
  const grad = ctx.createLinearGradient(0, 0, 0, 1000);
  grad.addColorStop(0.0, 'rgba(74,54,36,1)');
  grad.addColorStop(0.42, 'rgba(38,27,19,1)');
  grad.addColorStop(0.78, 'rgba(22,16,12,1)');
  grad.addColorStop(1.0, 'rgba(12,9,8,1)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(0, 0, 1000, 1000);
  ctx.fill();
  ctx.restore();
  g.pop();
}

function drawCodexShadow(g) {
  const ctx = g.drawingContext;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.62)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 7;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = 'rgba(201,143,78,1)';
  ctx.beginPath();
  ctx.rect(X0, Y0, CW, CH);
  ctx.fill();
  ctx.restore();
}

function drawPaper(g) {
  const pg = paper(g, { base: [201, 143, 78], fiber: 2.2, mottle: 0.5, seed: 21 });
  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(X0, Y0, CW, CH);
  g.drawingContext.clip();
  g.image(pg, 0, 0, 1000, 1000);
  g.drawingContext.restore();
  g.pop();
}

// 中央竖直折痕：26 宽暗带 + 两侧亮边
function drawFold(g) {
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(480, 0, 520, 0);
  grad.addColorStop(0.0, 'rgba(92,60,26,0.00)');
  grad.addColorStop(0.5, 'rgba(84,54,22,0.46)');
  grad.addColorStop(1.0, 'rgba(92,60,26,0.00)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(476, Y0, 48, CH);
  ctx.fill();
  ctx.restore();

  g.push();
  g.noStroke();
  g.fill(250, 230, 190, 96);
  g.rect(483, Y0 + 3, 3, CH - 6);
  g.rect(514, Y0 + 3, 3, CH - 6);
  g.fill(66, 42, 18, 130);
  g.rect(499, Y0 + 3, 2, CH - 6);
  g.pop();
}

// ============================================================
// 框
// ============================================================
function drawOuterFrame(g, local) {
  const k = crossK(local);                       // 过框：红框整体加深一次
  const r = RED[0] - 34 * k, gg = RED[1] - 16 * k, b = RED[2] - 14 * k;
  g.push();
  g.noFill();
  g.stroke(r, gg, b);
  g.strokeWeight(5 + 2.4 * k);
  g.rect(X0, Y0, CW, CH);
  g.stroke(INK[0], INK[1], INK[2], 210);
  g.strokeWeight(1.8);
  g.rect(X0 + 11, Y0 + 11, CW - 22, CH - 22);
  g.pop();
}

// 画面格：黑粗框 + 红细内框
function drawRegisterFrame(g, x, y, w, h) {
  g.push();
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.6);
  g.rect(x, y, w, h);
  g.stroke(RED[0], RED[1], RED[2]);
  g.strokeWeight(1.7);
  g.rect(x + 7, y + 7, w - 14, h - 14);
  g.pop();
}

// ============================================================
// 自创抽象符号：字格（glyph block）里的填物
// kind: 0 点阵 / 1 双横 / 2 螺旋 / 3 阶梯 / 4 十字 / 5 贝壳
// ============================================================
function drawAbstractGlyph(g, x, y, s, kind, seed) {
  const rnd = mulberry32(seed);
  g.push();
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.2);
  g.rect(x + 2, y + 2, s - 4, s - 4, 3);
  g.strokeWeight(1.9);
  const cx = x + s / 2, cy = y + s / 2;
  if (kind === 0) {
    g.fill(INK[0], INK[1], INK[2]);
    for (let i = 0; i < 3; i++) g.circle(cx + (i - 1) * s * 0.22, cy - s * 0.16, s * 0.11);
    g.noFill();
    rrStroke(g, cx - s * 0.28, cy + s * 0.06, s * 0.56, s * 0.11, 2);
  } else if (kind === 1) {
    g.line(cx - s * 0.3, cy - s * 0.1, cx + s * 0.3, cy - s * 0.1);
    g.line(cx - s * 0.3, cy + s * 0.12, cx + s * 0.3, cy + s * 0.12);
    g.fill(RED[0], RED[1], RED[2]);
    g.noStroke();
    g.circle(cx, cy + s * 0.26, s * 0.1);
  } else if (kind === 2) {
    g.noFill();
    g.beginShape();
    for (let i = 0; i <= 34; i++) {
      const a = (i / 34) * TAU * 1.6;
      const r = s * 0.08 + (i / 34) * s * 0.27;
      g.vertex(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92);
    }
    g.endShape();
  } else if (kind === 3) {
    g.beginShape();
    g.vertex(cx - s * 0.32, cy + s * 0.28);
    g.vertex(cx - s * 0.32, cy + s * 0.04);
    g.vertex(cx - s * 0.08, cy + s * 0.04);
    g.vertex(cx - s * 0.08, cy - s * 0.18);
    g.vertex(cx + s * 0.18, cy - s * 0.18);
    g.vertex(cx + s * 0.18, cy - s * 0.34);
    g.endShape();
    g.fill(BLUE[0], BLUE[1], BLUE[2]);
    g.noStroke();
    g.circle(cx + s * 0.1, cy + s * 0.22, s * 0.12);
  } else if (kind === 4) {
    g.line(cx - s * 0.26, cy - s * 0.26, cx + s * 0.26, cy + s * 0.26);
    g.line(cx - s * 0.26, cy + s * 0.26, cx + s * 0.26, cy - s * 0.26);
    g.fill(YEL[0], YEL[1], YEL[2]);
    g.noStroke();
    g.circle(cx, cy, s * 0.16);
  } else {
    g.fill(236, 220, 188);
    g.strokeWeight(1.8);
    g.ellipse(cx, cy, s * 0.56, s * 0.4);
    g.noFill();
    g.arc(cx, cy + s * 0.03, s * 0.34, s * 0.26, 0, Math.PI);
  }
  // 填出界的错位（部分格子）
  if (rnd() < 0.34) {
    const m = MIS[seed % 6];
    g.noStroke();
    g.fill(BLUE[0], BLUE[1], BLUE[2], 140);
    g.rect(x + s * 0.12 + m[0] * 0.5, y + s * 0.62 + m[1] * 0.5, s * 0.32, s * 0.18);
  }
  g.pop();
}

// 左页下半：抄写员左边的草稿字格
function drawDraftCells(g) {
  const s = 44, gap = 8;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      drawAbstractGlyph(g, 70 + i * (s + gap), 506 + j * (s + gap), s, (i * 4 + j * 5) % 6, 401 + i * 3 + j * 7);
    }
  }
}

// 左页画面格下方的注解字格
function drawLeftCaption(g) {
  const s = 40, gap = 6, n = 5, x0 = 158;
  for (let i = 0; i < n; i++) {
    drawAbstractGlyph(g, x0 + i * (s + gap), 402, s, (i * 2 + 1) % 6, 101 + i * 7);
  }
  g.push();
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2]);
  for (const tx of [x0 - 14, x0 + n * (s + gap) + 2]) {
    g.beginShape();
    g.vertex(tx, 414);
    g.vertex(tx + 12, 422);
    g.vertex(tx, 430);
    g.endShape(g.CLOSE);
  }
  g.pop();
}

// 右页画面格内的注解字格 + 水纹
function drawGodRegisterDecor(g) {
  const s = 34, gap = 6;
  for (let i = 0; i < 3; i++) {
    drawAbstractGlyph(g, 824 + i * (s + gap), 92, s, (i * 3 + 2) % 6, 211 + i * 11);
  }
  g.push();
  g.noFill();
  g.stroke(BLUE[0], BLUE[1], BLUE[2]);
  g.strokeWeight(2.6);
  for (let i = 0; i < 3; i++) {
    g.beginShape();
    for (let j = 0; j <= 12; j++) {
      g.vertex(536 + j * 5.2, 108 + i * 13 + Math.sin(j * 0.9 + i) * 3.4);
    }
    g.endShape();
  }
  g.pop();
}

// ============================================================
// 玛雅点横数字（点=1 横杠=5 贝壳=0）—— 只作计数
// ============================================================
function tierHeight(v, sc) {
  if (v === 0) return 30 * sc;
  const bars = Math.floor(v / 5), dots = v % 5;
  const bh = 10 * sc, bgap = 7 * sc, dr = 13 * sc;
  let h = 0;
  if (bars > 0) h += bars * (bh + bgap) - bgap;
  if (dots > 0) h += (bars > 0 ? 5 * sc : 0) + dr;
  return h;
}

function drawShell(g, cx, cy, sc) {
  const w = 38 * sc, h = 27 * sc;
  g.push();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.4 * sc);
  g.fill(236, 220, 188);
  g.ellipse(cx, cy, w, h);
  g.noFill();
  g.strokeWeight(1.8 * sc);
  g.arc(cx, cy + 1 * sc, w * 0.62, h * 0.66, 0, Math.PI);
  g.strokeWeight(1.5 * sc);
  for (let i = -1; i <= 1; i++) {
    g.line(cx + i * 8.5 * sc, cy - h * 0.36, cx + i * 8.5 * sc, cy - h * 0.06);
  }
  g.pop();
}

// 一位（0..19）：横杠在下、圆点在上
function drawTier(g, cx, yBot, v, sc) {
  if (v === 0) { drawShell(g, cx, yBot - 15 * sc, sc); return; }
  const bars = Math.floor(v / 5), dots = v % 5;
  const bw = 38 * sc, bh = 10 * sc, bgap = 7 * sc;
  const dr = 13 * sc, dpx = 19 * sc;
  let y = yBot;
  g.push();
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2]);
  for (let i = 0; i < bars; i++) {
    rrFill(g, cx - bw / 2, y - bh, bw, bh, 2.5 * sc);
    y -= (bh + bgap);
  }
  const barsTop = bars > 0 ? y + bgap : yBot;
  if (dots > 0) {
    const cy = barsTop - (bars > 0 ? 5 * sc : 0) - dr / 2;
    for (let i = 0; i < dots; i++) {
      g.circle(cx + (i - (dots - 1) / 2) * dpx, cy, dr);
    }
  }
  g.pop();
}

// 二十进制：低位在下、高位在上（高位略小）
function drawValue(g, cx, yBot, v, sc) {
  if (v < 20) { drawTier(g, cx, yBot, v, sc); return; }
  const hi = Math.floor(v / 20), lo = v % 20;
  const loH = tierHeight(lo, sc);
  drawTier(g, cx, yBot, lo, sc);
  drawTier(g, cx, yBot - loH - 11 * sc, hi, sc * 0.78);
}

// ============================================================
// 右页下半：点横数字栏（三行）
// ============================================================
function drawNumeralColumn(g, local) {
  const bi = beatIdx(local);
  const pulse = beatPulse(local);

  const trips = local >= 5.75 ? 32 : 19 + Math.ceil(local / BEAT);   // 过框进位成 32
  const years = 21 + Math.floor(bi / 2);
  const since = 2 + Math.floor(bi / 3);

  const rows = [
    { y: 496, h: 90, label: '穿越次数', v: trips },
    { y: 598, h: 54, label: '累计年代', v: years },
    { y: 660, h: 54, label: '距上次校准', v: since },
  ];

  g.push();
  g.textFont(ZH);
  g.textAlign(g.LEFT, g.CENTER);
  g.textSize(25);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cy = r.y + r.h / 2;
    g.noStroke();
    g.fill(RED[0], RED[1], RED[2]);
    g.rect(524, cy - 5, 11, 11, 2);
    g.fill(INK[0], INK[1], INK[2]);
    g.text(r.label, 542, cy);
    if (i > 0) {
      g.fill(RED[0], RED[1], RED[2], 130);
      g.rect(524, r.y - 6, 412, 1.6);
    }
  }
  g.pop();

  // ---- 第一、二行：数字装在小框里 ----
  for (let i = 0; i < 2; i++) {
    const r = rows[i];
    const bx = 700, bw = 104;
    g.push();
    g.noFill();
    g.stroke(INK[0], INK[1], INK[2]);
    g.strokeWeight(2.4);
    g.rect(bx, r.y, bw, r.h);
    g.stroke(RED[0], RED[1], RED[2], 190);
    g.strokeWeight(1.4);
    g.rect(bx + 4.5, r.y + 4.5, bw - 9, r.h - 9);
    g.pop();
    drawValue(g, bx + bw / 2, r.y + r.h - 10, r.v, i === 0 ? 1 : 0.86);
    const gs = i === 0 ? 60 : 44;
    const gy = r.y + (r.h - gs) / 2;
    for (let j = 0; j < 2; j++) {
      drawAbstractGlyph(g, 824 + j * (gs + 10), gy, gs, (i * 3 + j * 2) % 6, 301 + i * 13 + j * 5);
    }
  }

  // ---- 第三行：一行小格（抄写员在补），格子到页边不够了 ----
  drawTallyRow(g, rows[2], rows[2].v, pulse);
}

// 第三行：5 个填满的小格 + 挤到红框外的最后两个点 + 小箭头
function drawTallyRow(g, row, v, pulse) {
  const s = 42, gap = 6, n = 5;
  const x0 = 706;
  const y = row.y + (row.h - s) / 2;

  // 前面的小格（自创抽象填满）
  const marks = [0, 1, 5, 1, 0];
  for (let i = 0; i < n; i++) {
    const cxCell = x0 + i * (s + gap);
    g.push();
    g.noFill();
    g.stroke(INK[0], INK[1], INK[2]);
    g.strokeWeight(2.3);
    g.rect(cxCell, y, s, s);
    g.pop();
    const mx = cxCell + s / 2, my = y + s - 8;
    g.push();
    g.noStroke();
    g.fill(INK[0], INK[1], INK[2]);
    if (marks[i] === 0) {
      for (let k = 0; k < 3; k++) g.circle(mx + (k - 1) * 9, my - 22, 6.5);
    } else if (marks[i] === 1) {
      rrFill(g, mx - 12, my - 15, 24, 6, 2);
      g.circle(mx, my - 25, 6.5);
    } else {
      g.pop();
      drawShell(g, mx, my - 12, 0.52);
      g.push();
      g.noStroke();
      g.fill(INK[0], INK[1], INK[2]);
    }
    g.pop();
  }

  // 正在补的那一位（小格已经排到页边，只能挤出去）
  const oy = y + s / 2;
  const ox = [954, 968];
  g.push();
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2], 55 + 130 * pulse);
  g.circle(ox[0], oy, 14 + 11 * pulse);
  g.circle(ox[1], oy, 14 + 11 * pulse);
  g.fill(INK[0], INK[1], INK[2]);
  g.circle(ox[0], oy, 13);
  g.circle(ox[1], oy, 13);
  g.pop();

  // 小箭头指向框外
  g.push();
  g.noFill();
  g.stroke(RED[0], RED[1], RED[2]);
  g.strokeWeight(2.6);
  g.strokeCap(g.ROUND);
  g.line(916, y - 15, 946, y - 4);
  g.line(946, y - 4, 935, y - 7);
  g.line(946, y - 4, 939, y - 14);
  g.pop();

  // 行尾未干的墨痕
  g.push();
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2], 70);
  rrFill(g, x0 + n * (s + gap) - 3, oy + 8, 12, 3, 1.5);
  g.pop();
}

// ============================================================
// 左页下半：侧身执笔的抄写员
// ============================================================
function drawScribe(g, local) {
  const pulse = beatPulse(local);
  g.push();
  g.translate(240, 700);
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);

  // ---- 坐垫 ----
  g.push();
  g.noStroke();
  g.fill(120, 78, 40, 130);
  rrFill(g, -76, 6, 210, 16, 8);
  g.pop();

  // ---- 腿（折叠坐姿）----
  limb(g, [[4, 2], [88, 16], [58, 42]], 25, SKIN);
  g.push();
  g.fill(SKIN[0], SKIN[1], SKIN[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3);
  g.beginShape();
  g.vertex(52, 34); g.vertex(96, 40); g.vertex(98, 50); g.vertex(46, 48);
  g.endShape(g.CLOSE);
  g.pop();

  // ---- 躯干（平涂 + 故意错位）----
  g.push();
  g.noStroke();
  g.fill(SKIN[0], SKIN[1], SKIN[2]);
  g.beginShape();
  g.vertex(-6 + MIS[0][0], -4 + MIS[0][1]);
  g.vertex(36 + MIS[0][0], -94 + MIS[0][1]);
  g.vertex(74 + MIS[0][0], -82 + MIS[0][1]);
  g.vertex(46 + MIS[0][0], -2 + MIS[0][1]);
  g.vertex(6 + MIS[0][0], 10 + MIS[0][1]);
  g.endShape(g.CLOSE);
  g.pop();
  g.push();
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.4);
  g.beginShape();
  g.vertex(-6, -4); g.vertex(36, -94); g.vertex(74, -82); g.vertex(46, -2); g.vertex(6, 10);
  g.endShape(g.CLOSE);
  g.pop();

  // ---- 腰布 ----
  g.push();
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2]);
  g.beginShape();
  g.vertex(-2, -8); g.vertex(48, -14); g.vertex(52, 8); g.vertex(0, 6);
  g.endShape(g.CLOSE);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2);
  g.line(-2, 0, 51, -4);
  g.pop();

  // ---- 玉串珠 ----
  g.push();
  g.noStroke();
  for (let i = 0; i < 6; i++) {
    const a = -0.55 + i * 0.23;
    g.fill(BLUE[0], BLUE[1], BLUE[2]);
    g.circle(44 + Math.cos(a) * 31, -70 + Math.sin(a) * 27, 9.5);
    g.fill(WHT[0], WHT[1], WHT[2], 150);
    g.circle(42 + Math.cos(a) * 31, -72 + Math.sin(a) * 27, 3.4);
  }
  g.pop();

  // ---- 后臂（搭在膝上）----
  limb(g, [[38, -76], [66, -52], [56, -44]], 18, SKIN);

  // ---- 前臂 + 手（执笔）----
  limb(g, [[56, -80], [108, -66], [150, -84]], 18, SKIN);
  g.push();
  g.fill(SKIN[0], SKIN[1], SKIN[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.8);
  g.ellipse(152, -84, 22, 17);
  g.pop();

  // ---- 头（侧脸朝右）----
  drawHead(g, 66, -110, 1.0, SKIN, true);

  // ---- 高羽饰 ----
  drawFeathers(g, [[62, -142], [-36, -206], [4, -216], [44, -208]]);
  g.push();
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2]);
  g.beginShape();
  g.vertex(40, -132); g.vertex(92, -140); g.vertex(94, -124); g.vertex(42, -118);
  g.endShape(g.CLOSE);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.2);
  g.line(40, -132, 92, -140);
  g.pop();
  g.push();
  g.fill(YEL[0], YEL[1], YEL[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.4);
  g.circle(94, -152, 17);
  g.pop();

  // ---- 笔 ----
  g.push();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(5);
  g.line(158, -86, 214, -52);
  g.strokeWeight(2.2);
  g.stroke(YEL[0], YEL[1], YEL[2]);
  g.line(160, -85, 196, -63);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(6.5);
  g.line(206, -58, 222, -48);
  g.pop();

  // ---- 强拍：笔尖点一下 ----
  g.push();
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2], 95 * pulse);
  g.circle(224, -46, 18 + 10 * pulse);
  g.fill(INK[0], INK[1], INK[2], 90 + 150 * pulse);
  g.circle(224, -46, 7 + 7 * pulse);
  g.pop();

  // ---- 墨钵 ----
  g.push();
  g.fill(60, 40, 24);
  g.stroke(RED[0], RED[1], RED[2]);
  g.strokeWeight(3);
  g.ellipse(-108, 6, 34, 22);
  g.noStroke();
  g.fill(20, 14, 10);
  g.ellipse(-108, 2, 24, 13);
  g.pop();

  g.pop();
}

// 一段肢体：先粗黑描边再上色 → 得到"黑轮廓 + 平涂"
function limb(g, pts, w, col) {
  g.push();
  g.noFill();
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  for (let pass = 0; pass < 2; pass++) {
    g.stroke(pass === 0 ? INK[0] : col[0], pass === 0 ? INK[1] : col[1], pass === 0 ? INK[2] : col[2]);
    g.strokeWeight(pass === 0 ? w + 6 : w);
    g.beginShape();
    for (const p of pts) g.vertex(p[0], p[1]);
    g.endShape();
  }
  g.pop();
}

// 侧脸头（朝右）；自创抽象轮廓
function drawHead(g, hx, hy, sc, col, withEar) {
  const P = [
    [-26, -28], [-16, -38], [2, -40], [14, -34], [22, -20],
    [26, -8], [36, 2], [26, 8], [30, 18], [18, 30],
    [2, 32], [-14, 26], [-24, 10], [-28, -10],
  ];
  g.push();
  g.translate(hx, hy);
  g.scale(sc);
  // 平涂（带一点错位）
  g.noStroke();
  g.fill(col[0], col[1], col[2]);
  g.beginShape();
  for (const p of P) g.vertex(p[0] + MIS[1][0], p[1] + MIS[1][1]);
  g.endShape(g.CLOSE);
  // 轮廓
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.2);
  g.beginShape();
  for (const p of P) g.vertex(p[0], p[1]);
  g.endShape(g.CLOSE);
  // 眼
  g.noStroke();
  g.fill(INK[0], INK[1], INK[2]);
  g.ellipse(12, -12, 9, 6);
  g.fill(WHT[0], WHT[1], WHT[2]);
  g.circle(14, -13, 3);
  // 嘴
  g.noStroke();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.2);
  g.line(20, 12, 28, 12);
  // 耳饰
  if (withEar) {
    g.noStroke();
    g.fill(YEL[0], YEL[1], YEL[2]);
    g.stroke(INK[0], INK[1], INK[2]);
    g.strokeWeight(2.2);
    g.circle(-14, 4, 15);
    g.noFill();
    g.strokeWeight(2);
    g.line(-14, 11, -14, 22);
    g.line(-20, 24, -8, 24);
  }
  g.pop();
}

// 羽饰：从基点发散的三片羽毛
function drawFeathers(g, pts) {
  const [base, ...tips] = pts;
  g.push();
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);
  for (let i = 0; i < tips.length; i++) {
    const [tx, ty] = tips[i];
    const dx = tx - base[0], dy = ty - base[1];
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const w = 9;
    // 黑描边
    g.stroke(INK[0], INK[1], INK[2]);
    g.strokeWeight(w + 5);
    g.line(base[0], base[1], tx, ty);
    // 羽面（蓝 / 白 / 蓝）
    g.stroke(i === 1 ? WHT[0] : BLUE[0], i === 1 ? WHT[1] : BLUE[1], i === 1 ? WHT[2] : BLUE[2]);
    g.strokeWeight(w);
    g.line(base[0], base[1], tx, ty);
    // 羽枝
    g.strokeWeight(1.8);
    g.stroke(INK[0], INK[1], INK[2], 170);
    for (let k = 1; k <= 3; k++) {
      const u = 0.32 + k * 0.2;
      const px = base[0] + dx * u, py = base[1] + dy * u;
      g.line(px, py, px + nx * 9, py + ny * 9);
      g.line(px, py, px - nx * 9, py - ny * 9);
    }
  }
  g.pop();
}

// ============================================================
// 右页上半：自创抽象"历法神"（背包裹、拄杖、头后计数环）
// ============================================================
function drawGod(g, local) {
  const bi = beatIdx(local);
  // 第 5 拍之后：包裹里的东西顶出来一块，并持续轻微抖动
  const out = Math.min(1, Math.max(0, (local - 2.5) / 0.4));
  const jit = out > 0 ? Math.sin(local * 21) * 3.2 * out : 0;

  g.push();
  g.translate(700, 450);
  g.strokeJoin(g.ROUND);
  g.strokeCap(g.ROUND);

  // ---- 头后计数环（自创抽象：一圈刻度）----
  g.push();
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2], 220);
  g.strokeWeight(2.6);
  g.circle(0, -280, 112);
  g.strokeWeight(2.2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.line(Math.cos(a) * 56, -280 + Math.sin(a) * 56,
      Math.cos(a) * 70, -280 + Math.sin(a) * 70);
  }
  g.pop();
  g.push();
  g.noStroke();
  g.fill(YEL[0], YEL[1], YEL[2], 40);
  g.circle(0, -280, 108);
  g.pop();

  // ---- 背上的包裹 ----
  g.push();
  g.translate(jit * 0.35, 0);
  g.fill(RED[0], RED[1], RED[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.4);
  rrFill(g, -104, -252, 96, 90, 14);
  rrStroke(g, -104, -252, 96, 90, 14);
  // 捆绳
  g.strokeWeight(2.6);
  g.line(-104, -212, -8, -212);
  g.line(-56, -252, -56, -162);
  // 白布结
  g.noStroke();
  g.fill(WHT[0], WHT[1], WHT[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.4);
  g.ellipse(-56, -212, 30, 22);
  g.pop();
  // 顶出来的那一块
  if (out > 0.02) {
    g.push();
    g.translate(-56 + jit, -262 - 14 * out);
    g.fill(YEL[0], YEL[1], YEL[2]);
    g.stroke(INK[0], INK[1], INK[2]);
    g.strokeWeight(3);
    g.beginShape();
    g.vertex(-22, 12); g.vertex(-16, -14 * out); g.vertex(0, -22 * out);
    g.vertex(16, -12 * out); g.vertex(22, 12);
    g.endShape(g.CLOSE);
    g.noFill();
    g.strokeWeight(2);
    g.line(-8, -10 * out, -4, 6);
    g.line(6, -12 * out, 10, 6);
    g.pop();
  }

  // ---- 腿（行走）----
  limb(g, [[-16, -108], [-44, -56], [-52, -8]], 24, YEL);
  limb(g, [[4, -108], [30, -56], [38, -10]], 24, YEL);
  // 脚
  g.push();
  g.fill(INK[0], INK[1], INK[2]);
  g.noStroke();
  rrFill(g, -70, -12, 34, 13, 5);
  rrFill(g, 26, -14, 36, 13, 5);
  g.pop();

  // ---- 裙 / 腰布 ----
  g.push();
  g.fill(WHT[0], WHT[1], WHT[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.2);
  g.beginShape();
  g.vertex(-38, -132); g.vertex(40, -132); g.vertex(48, -46); g.vertex(-34, -46);
  g.endShape(g.CLOSE);
  g.noFill();
  g.stroke(RED[0], RED[1], RED[2]);
  g.strokeWeight(6);
  g.line(-36, -104, 42, -104);
  g.line(-35, -72, 45, -72);
  g.pop();

  // ---- 躯干 ----
  g.push();
  g.noStroke();
  g.fill(YEL[0], YEL[1], YEL[2]);
  g.beginShape();
  g.vertex(-32 + MIS[2][0], -118 + MIS[2][1]);
  g.vertex(-28 + MIS[2][0], -214 + MIS[2][1]);
  g.vertex(22 + MIS[2][0], -218 + MIS[2][1]);
  g.vertex(34 + MIS[2][0], -116 + MIS[2][1]);
  g.endShape(g.CLOSE);
  g.pop();
  g.push();
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.4);
  g.beginShape();
  g.vertex(-32, -118); g.vertex(-28, -214); g.vertex(22, -218); g.vertex(34, -116);
  g.endShape(g.CLOSE);
  g.pop();

  // ---- 后臂（抓额带）----
  limb(g, [[-20, -206], [-48, -178], [-58, -240]], 18, YEL);

  // ---- 前臂（拄杖）----
  limb(g, [[16, -206], [48, -186], [66, -196]], 18, YEL);

  // ---- 额带（从包裹绕过头顶连到额头；头随后画，盖住中段）----
  g.push();
  g.noFill();
  g.stroke(RED[0], RED[1], RED[2]);
  g.strokeWeight(4.2);
  g.line(-58, -246, 12, -317);
  g.pop();

  // ---- 杖 ----
  g.push();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(8);
  g.line(70, -262, 86, -8);
  g.noStroke();
  g.fill(YEL[0], YEL[1], YEL[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3);
  rrFill(g, 58, -284, 34, 26, 6);
  rrStroke(g, 58, -284, 34, 26, 6);
  g.noFill();
  g.strokeWeight(2.4);
  g.line(66, -278, 66, -266);
  g.line(76, -278, 76, -266);
  // 手
  g.fill(YEL[0], YEL[1], YEL[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.8);
  g.ellipse(70, -196, 22, 18);
  g.pop();

  // ---- 头（侧脸朝右）----
  drawHead(g, 0, -280, 1.02, YEL, true);

  // ---- 头饰：羽 + 前额黄牌 ----
  drawFeathers(g, [[-6, -322], [-92, -356], [-48, -368], [-6, -360]]);
  g.push();
  g.fill(YEL[0], YEL[1], YEL[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.6);
  g.circle(30, -312, 19);
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2]);
  g.circle(30, -312, 8);
  g.pop();

  // ---- 玉串珠 ----
  g.push();
  g.noStroke();
  for (let i = 0; i < 5; i++) {
    const a = -0.4 + i * 0.26;
    g.fill(BLUE[0], BLUE[1], BLUE[2]);
    g.circle(2 + Math.cos(a) * 26, -216 + Math.sin(a) * 24, 10);
  }
  g.pop();

  g.pop();
}

// ============================================================
// 虫蛀小孔 + 树皮纸粗纤维
// ============================================================
function drawWormHoles(g) {
  for (let i = 0; i < HOLES.length; i++) {
    const [hx, hy, hr] = HOLES[i];
    const rnd = mulberry32(3301 + i * 977);
    g.push();
    g.noStroke();
    // 洞壁（更暗的一层纸）
    g.fill(102, 70, 34, 130);
    blob(g, hx, hy, hr * 1.3, 11, 0.26, rnd);
    // 洞
    g.fill(38, 26, 14, 235);
    blob(g, hx, hy, hr, 11, 0.22, rnd);
    g.fill(16, 11, 7, 255);
    blob(g, hx, hy, hr * 0.6, 9, 0.2, rnd);
    // 下缘亮边（纸的厚度）
    g.noFill();
    g.stroke(244, 218, 172, 72);
    g.strokeWeight(1.8);
    g.arc(hx, hy, hr * 1.7, hr * 1.7, 0.3, 2.1);
    g.pop();
  }
}

function blob(g, cx, cy, r, n, jitter, rnd) {
  g.beginShape();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr2 = r * (1 - jitter / 2 + rnd() * jitter);
    g.vertex(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
  }
  g.endShape(g.CLOSE);
}

function drawFibers(g) {
  const rnd = mulberry32(4242);
  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(X0, Y0, CW, CH);
  g.drawingContext.clip();
  g.noFill();
  for (let i = 0; i < 230; i++) {
    const x = X0 + rnd() * CW, y = Y0 + rnd() * CH;
    const horiz = rnd() < 0.62;
    const len = 30 + rnd() * 165;
    const dark = rnd() < 0.48;
    g.stroke(dark ? 118 : 234, dark ? 84 : 208, dark ? 42 : 162, 16 + rnd() * 26);
    g.strokeWeight(0.6 + rnd() * 1.5);
    if (horiz) g.line(x, y, x + len, y + (rnd() - 0.5) * 3);
    else g.line(x, y, x + (rnd() - 0.5) * 3, y + len * 0.62);
  }
  g.drawingContext.restore();
  g.pop();
}

// ============================================================
// 时空舱：一个巨大的方形字格（glyph block）里的极简符号
// 移动量化到 8fps 阶跃，每个阶跃轻微旋转 2 度再回正
// ============================================================
export function drawVehicle(g, { x, y, local, t, wave }) {
  const step = Math.floor(local * 8);
  const q = step / 8;
  const u = routeU(q);                       // 量化后的路线进度
  const gx = 190 + ((u - 0.02) / 1.0) * 160; // 在左页画面格内横向阶跃
  const gy = 275 + hoverY(q) * 0.55;
  const frac = local - q;
  const kick = Math.exp(-frac / 0.045);
  const b3 = Math.exp(-Math.pow((local - 1.05) / 0.13, 2));   // 第 3 拍额外一记
  const rot = (step % 2 ? 1 : -1) * 0.036 * kick + 0.05 * b3;

  g.push();
  g.translate(gx, gy);
  g.rotate(rot);
  drawGlyphBlock(g, 240, t, wave);
  g.pop();
}

function drawGlyphBlock(g, S, t, wave) {
  const h = S / 2;
  g.push();
  g.strokeJoin(g.ROUND);

  // ---- 字格：圆角方框，黑粗框 + 红细内框 ----
  g.noStroke();
  g.fill(226, 178, 112, 130);
  rrFill(g, -h, -h, S, S, 16);
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(4.6);
  rrStroke(g, -h, -h, S, S, 16);
  g.stroke(RED[0], RED[1], RED[2]);
  g.strokeWeight(2.2);
  rrStroke(g, -h + 10, -h + 10, S - 20, S - 20, 10);

  // 四角小点
  g.noStroke();
  g.fill(RED[0], RED[1], RED[2]);
  for (const [dx, dy] of [[-h + 18, -h + 18], [h - 18, -h + 18], [-h + 18, h - 18], [h - 18, h - 18]]) {
    g.circle(dx, dy, 8);
  }

  // ---- 舱体极简符号 ----
  // 机身：一个方形
  g.fill(BLUE[0], BLUE[1], BLUE[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(3.6);
  rrFill(g, -66, -46, 132, 108, 7);
  rrStroke(g, -66, -46, 132, 108, 7);
  // 顶部黄铜檐带
  g.noStroke();
  g.fill(YEL[0], YEL[1], YEL[2]);
  rrFill(g, -66, -46, 132, 13, 5);
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(1.8);
  g.line(-66, -33, 66, -33);

  // 3×2 六个小方格（窗）
  const wx0 = -54, wy0 = -26, ww = 108, wh = 76, gp = 5;
  const cw = (ww - gp * 2) / 3, chh = (wh - gp) / 2;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const wx = wx0 + c * (cw + gp);
      const wy = wy0 + r * (chh + gp);
      g.noStroke();
      g.fill(WHT[0], WHT[1], WHT[2]);
      rrFill(g, wx, wy, cw, chh, 3);
      g.noFill();
      g.stroke(INK[0], INK[1], INK[2]);
      g.strokeWeight(2.2);
      rrStroke(g, wx, wy, cw, chh, 3);
      // 中间那格：驾驶员侧脸剪影
      if (r === 0 && c === 1) {
        const dx = wx + cw / 2, dy = wy + chh / 2;
        g.push();
        g.noStroke();
        g.fill(INK[0], INK[1], INK[2]);
        // 头 + 肩
        g.circle(dx, dy - 3, 15);
        g.beginShape();
        g.vertex(dx - 12, dy + 14);
        g.vertex(dx - 9, dy + 2);
        g.vertex(dx + 9, dy + 2);
        g.vertex(dx + 12, dy + 14);
        g.endShape(g.CLOSE);
        // 挥手（第 2 小节高光）
        g.stroke(INK[0], INK[1], INK[2]);
        g.strokeWeight(3.4);
        g.strokeCap(g.ROUND);
        if (wave) {
          const wg = Math.sin(t * 9) * 0.4;
          g.line(dx + 7, dy + 6, dx + 13, dy - 4 + wg * 8);
        } else {
          g.line(dx + 7, dy + 6, dx + 12, dy + 10);
        }
        g.pop();
      }
    }
  }

  // 顶上一个圆点（灯笼）：内含时间漩涡
  const lampY = -72;
  g.noStroke();
  g.fill(YEL[0], YEL[1], YEL[2]);
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.8);
  g.circle(0, lampY, 27);
  g.noFill();
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(2.6);
  const a0 = swirlAngle(t || 0);
  g.arc(0, lampY, 16, 16, a0, a0 + 2.1);
  g.arc(0, lampY, 9, 9, a0 + Math.PI, a0 + Math.PI + 2.1);
  // 吊杆
  g.strokeWeight(3.4);
  g.line(0, lampY + 13, 0, -46);

  // 底部四道短横（喷口）
  for (let i = 0; i < 4; i++) {
    const bx = -45 + i * 30;
    g.noStroke();
    g.fill(RED[0], RED[1], RED[2]);
    rrFill(g, bx - 11, 66, 22, 9, 2.5);
    g.noFill();
    g.stroke(INK[0], INK[1], INK[2]);
    g.strokeWeight(1.8);
    rrStroke(g, bx - 11, 66, 22, 9, 2.5);
  }

  g.pop();
}
