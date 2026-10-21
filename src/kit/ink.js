// ============================================================
// ink.js — 水墨共用工具包（版块 3 拓片 / 4 白描 / 5 山水 / 6 界画 / 9 写意）
//
// 五个水墨版块共用同一套纸、墨、笔法，但各用不同的落笔方式：
//   3 拓片：黑底白线（paper 用深色，笔色用纸白）
//   4 白描：纯墨线，粗细均匀、无晕染
//   5 山水：多层淡墨渲染 + 雨点皴 + 云气留白
//   6 界画：墨线界尺 + 淡彩
//   9 写意：寥寥数笔、飞白、大片留白
//
// 所有函数只往传入的 g（p5 实例）上画，不持有播放状态
// ============================================================

import { mulberry32 } from './kit.js';

const paperCache = new Map();

// ------------------------------------------------------------
// 宣纸底：米黄底 + 纤维 + 云斑，按 (尺寸, 种子, 底色) 缓存
// 返回 p5.Graphics，绘制时用 g.image(pg, 0, 0, w, h)
// ------------------------------------------------------------
export function paper(g, opt = {}) {
  const {
    w = 1000, h = 1000, scale = 2, seed = 5,
    base = [233, 225, 206], fiber = 1, mottle = 1,
  } = opt;
  const key = `${w}x${h}x${scale}x${seed}x${base.join('_')}x${fiber}x${mottle}`;
  if (paperCache.has(key)) return paperCache.get(key);

  const pg = g.createGraphics(Math.round(w * scale), Math.round(h * scale));
  pg.pixelDensity(1);
  pg.scale(scale);
  paperInto(pg, w, h, opt);

  paperCache.set(key, pg);
  return pg;
}

// 在已有画布上铺纸底（画布需已设好 scale，坐标系为 w×h 单位空间）
// 版块若要在纸底上继续画山体，用这个而不走缓存
export function paperInto(pg, w, h, opt = {}) {
  const {
    seed = 5, base = [233, 225, 206], fiber = 1, mottle = 1,
  } = opt;
  const rnd = mulberry32(seed * 7919 + 13);

  pg.background(base[0], base[1], base[2]);

  // 纤维：短而淡的斜线
  if (fiber > 0) {
    for (let i = 0; i < 1500 * fiber; i++) {
      const x = rnd() * w, y = rnd() * h;
      const len = 10 + rnd() * 84;
      const a = rnd() * Math.PI;
      pg.stroke(
        base[0] - 14 + rnd() * 12,
        base[1] - 16 + rnd() * 12,
        base[2] - 22 + rnd() * 12,
        14 + rnd() * 20
      );
      pg.strokeWeight(0.4 + rnd() * 0.9);
      pg.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
  }

  // 云斑：大而极淡的色块起伏
  if (mottle > 0) {
    pg.noStroke();
    for (let i = 0; i < 44 * mottle; i++) {
      pg.fill(base[0] - 10, base[1] - 10, base[2] - 8, 8 + rnd() * 14);
      pg.ellipse(rnd() * w, rnd() * h, 90 + rnd() * 320, 60 + rnd() * 240);
    }
  }
}

// ------------------------------------------------------------
// 毛笔线：沿点列分段画，两端收笔、粗细随压感变化，可加飞白
//   pts     [[x,y], ...]
//   rgb     墨色
//   alpha   0..1
//   weight  最粗处线宽（单位空间）
//   taper   收笔强度 0..1（0=等粗，0.9=两端极细）
//   dry     飞白概率 0..1（每段跳过或减淡）
//   wobble  抖动幅度（单位空间）
// ------------------------------------------------------------
export function inkStroke(g, pts, opt = {}) {
  const {
    rgb = [32, 30, 27], alpha = 0.9, weight = 5,
    taper = 0.55, dry = 0, wobble = 0, seed = 3,
  } = opt;
  if (!pts || pts.length < 2) return;
  const rnd = mulberry32(seed);

  // 累计长度确定每段在整条线里的位置（用于收笔）
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d); total += d;
  }
  if (total <= 0) return;

  g.push();
  g.noFill();
  g.strokeCap(g.ROUND);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const d = segs[i - 1];
    const mid = (acc + d / 2) / total;
    acc += d;

    if (dry > 0 && rnd() < dry) continue;
    const shape = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, mid))), 0.45);
    const w = weight * (1 - taper + taper * shape);
    const a = alpha * (0.82 + rnd() * 0.34);
    const ox = wobble ? (rnd() - 0.5) * wobble : 0;
    const oy = wobble ? (rnd() - 0.5) * wobble * 0.6 : 0;
    g.stroke(rgb[0], rgb[1], rgb[2], Math.min(255, 255 * a));
    g.strokeWeight(Math.max(0.35, w));
    g.line(p[0] + ox, p[1] + oy, q[0] + ox, q[1] + oy);
  }
  g.pop();
}

// 单笔短画（皴、点叶、飞白）：一笔就是一笔，不做平滑
export function dryLine(g, x1, y1, x2, y2, opt = {}) {
  const {
    rgb = [32, 30, 27], alpha = 0.45, weight = 1.8, dry = 0.3, seed = 11,
  } = opt;
  const rnd = mulberry32(seed);
  g.push();
  g.strokeCap(g.ROUND);
  const k = dry > 0 ? 3 : 1;
  for (let i = 0; i < k; i++) {
    if (dry > 0 && rnd() > dry) continue;
    const u0 = dry > 0 ? rnd() * 0.4 : 0;
    const u1 = dry > 0 ? 1 - rnd() * 0.3 : 1;
    g.stroke(rgb[0], rgb[1], rgb[2], 255 * alpha * (0.7 + rnd() * 0.5));
    g.strokeWeight(weight * (0.6 + rnd() * 0.7));
    g.line(
      x1 + (x2 - x1) * u0, y1 + (y2 - y1) * u0,
      x1 + (x2 - x1) * u1, y1 + (y2 - y1) * u1
    );
  }
  g.pop();
}

// 晕染点：多层低透明度同心圆，边缘自然
export function blot(g, x, y, r, opt = {}) {
  const { rgb = [40, 38, 34], alpha = 0.16, layers = 5, seed = 7 } = opt;
  const rnd = mulberry32(seed);
  g.push();
  g.noStroke();
  for (let i = layers; i >= 1; i--) {
    const k = i / layers;
    g.fill(rgb[0], rgb[1], rgb[2], 255 * alpha * (0.55 + rnd() * 0.5) / layers * 1.8);
    g.ellipse(
      x + (rnd() - 0.5) * r * 0.16,
      y + (rnd() - 0.5) * r * 0.16,
      r * 2 * k * (0.92 + rnd() * 0.16),
      r * 2 * k * (0.86 + rnd() * 0.2)
    );
  }
  g.pop();
}

// 云气带：竖直渐变 + 若干柔化椭圆，边缘不硬
export function mistBand(g, x, y, w, h, alpha = 0.9, seed = 9) {
  const ctx = g.drawingContext;
  ctx.save();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, 'rgba(240,236,226,0)');
  grad.addColorStop(0.34, `rgba(242,238,229,${alpha})`);
  grad.addColorStop(0.66, `rgba(242,238,229,${alpha})`);
  grad.addColorStop(1, 'rgba(240,236,226,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.restore();

  // 边缘补几团柔化椭圆，把渐变的直线边打散
  const rnd = mulberry32(seed);
  g.push();
  g.noStroke();
  for (let i = 0; i < 16; i++) {
    g.fill(243, 239, 230, 255 * alpha * 0.5);
    g.ellipse(
      x + rnd() * w,
      y + rnd() * h,
      120 + rnd() * 260,
      30 + rnd() * 46
    );
  }
  g.pop();
}

// 朱红印章（单字），落款用
export function seal(g, x, y, s, text = '摹', opt = {}) {
  const { rgb = [176, 52, 42] } = opt;
  g.push();
  g.noFill();
  g.stroke(rgb[0], rgb[1], rgb[2], 210);
  g.strokeWeight(2.2 * s);
  g.rect(x, y, 34 * s, 34 * s, 2.5 * s);
  // 内框（印章常见的双框）
  g.strokeWeight(0.9 * s);
  g.stroke(rgb[0], rgb[1], rgb[2], 130);
  g.rect(x + 3 * s, y + 3 * s, 28 * s, 28 * s, 1.5 * s);
  g.noStroke();
  g.fill(rgb[0], rgb[1], rgb[2], 225);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(19 * s);
  g.text(text, x + 17 * s, y + 17.5 * s);
  g.pop();
}

// 纸面上的浅色高光（留白处补光，避免整片灰）
export function highlight(g, x, y, w, h, alpha = 0.5) {
  const ctx = g.drawingContext;
  const cx = x + w / 2, cy = y + h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
  grad.addColorStop(0, `rgba(255,252,244,${alpha})`);
  grad.addColorStop(1, 'rgba(255,252,244,0)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
