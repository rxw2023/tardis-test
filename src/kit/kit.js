// ============================================================
// kit.js — 共用绘图工具包：颗粒纹理、圆角矩形、文字卡、晕影
// 所有函数只往传入的 g（p5 实例）上画，不持有全局状态
// ============================================================

const grainCache = new Map();

// 可复现伪随机
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 圆角矩形（走原生 2D 上下文，避免 p5 版本差异）
export function rr(g, x, y, w, h, r) {
  g.drawingContext.beginPath();
  g.drawingContext.roundRect(x, y, w, h, r);
}

export function rrFill(g, x, y, w, h, r) {
  rr(g, x, y, w, h, r);
  g.drawingContext.fill();
}

export function rrStroke(g, x, y, w, h, r) {
  rr(g, x, y, w, h, r);
  g.drawingContext.stroke();
}

// 纸张/画布颗粒：按 (w,h,seed) 缓存一张小噪声图，drawImage 平铺
export function grain(g, x, y, w, h, seed = 7, strength = 18) {
  const key = `${seed}`;
  let img = grainCache.get(key);
  if (!img) {
    const rnd = mulberry32(seed * 1013 + 77);
    const S = 256;
    img = g.createImage(S, S);
    img.loadPixels();
    for (let i = 0; i < S * S; i++) {
      const v = 128 + (rnd() - 0.5) * 255;
      img.pixels[i * 4 + 0] = v;
      img.pixels[i * 4 + 1] = v;
      img.pixels[i * 4 + 2] = v;
      img.pixels[i * 4 + 3] = 255;
    }
    img.updatePixels();
    grainCache.set(key, img);
  }
  g.push();
  g.blendMode(g.OVERLAY);
  g.tint(255, strength);
  for (let yy = y; yy < y + h; yy += 256) {
    for (let xx = x; xx < x + w; xx += 256) {
      g.image(img, xx, yy);
    }
  }
  g.pop();
}

// 四边晕影（径向渐变，柔和）
export function vignette(g, x, y, w, h, strength = 90) {
  const ctx = g.drawingContext;
  const cx = x + w / 2, cy = y + h / 2;
  const grad = ctx.createRadialGradient(
    cx, cy, Math.min(w, h) * 0.36,
    cx, cy, Math.max(w, h) * 0.74
  );
  grad.addColorStop(0, 'rgba(10,8,6,0)');
  grad.addColorStop(1, `rgba(10,8,6,${(strength / 255).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// 中英混排的标题卡（画在边区，屏幕坐标系）
// meta: { zh, en, era, accent, ink }
export function titleCard(g, meta, cx, cy, alpha, zhFont, enFont) {
  if (alpha <= 0.003) return;
  g.push();
  g.noStroke();
  g.fill(255, 255, 255, 255 * alpha);
  g.textFont(zhFont);
  g.textSize(46);
  g.textAlign(g.CENTER, g.BASELINE);
  g.text(meta.zh, cx, cy);
  g.textSize(20);
  g.textFont(enFont);
  g.text(meta.en.toUpperCase(), cx, cy + 34);
  g.textSize(18);
  g.textFont(zhFont);
  g.fill(255, 255, 255, 190 * alpha);
  g.text(meta.era, cx, cy + 62);
  // 上方一道小饰线
  g.stroke(255, 255, 255, 160 * alpha);
  g.strokeWeight(2);
  g.line(cx - 40, cy - 58, cx + 40, cy - 58);
  g.pop();
}

// ============================================================
// 几何工具（山水/白描等版块共用）
// ============================================================

// Catmull-Rom 平滑采样：手排几个转折点，得到顺滑的点列
export function catmull(pts, perSeg = 12) {
  const n = pts.length;
  if (n < 2) return pts.slice();
  const at = (i) => pts[Math.min(n - 1, Math.max(0, i))];
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t
          + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
          + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t
          + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
          + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

// 射线法：点是否在多边形内
export function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// 线性插值
export function lerp(a, b, u) { return a + (b - a) * u; }

// 线描风格的小胶囊（用于 Intro 素描插图）
export function sketchCapsule(g, x, y, s) {
  g.push();
  g.noFill();
  g.strokeWeight(2.4 * s);
  // 机身
  g.rect(x - 34 * s, y - 96 * s, 68 * s, 96 * s);
  // 顶灯
  g.line(x, y - 96 * s, x, y - 112 * s);
  g.circle(x, y - 122 * s, 16 * s);
  // 窗（2×2）
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      g.rect(x - 26 * s + c * 32 * s, y - 88 * s + r * 26 * s, 24 * s, 18 * s);
  // 门缝
  g.line(x, y - 30 * s, x, y);
  g.pop();
}
