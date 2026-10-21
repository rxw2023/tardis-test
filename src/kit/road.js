// ============================================================
// road.js — 时间公路：贯穿全片的唯一恒定元素
// 版块内以 1000 单位坐标绘制（y 770..940 为路面带），边区以像素坐标绘制
// ============================================================

export const ROAD_TOP = 770;    // 单位空间：路带顶
export const ROAD_BOT = 940;    // 路带底
export const ROAD_LINE = 902;   // 车道中线（时空舱贴地参考线附近）

// 版块内（单位空间 0..1000）的路面
export function drawRoadUnit(g, t) {
  g.push();
  g.noStroke();
  g.fill(24, 22, 26);                       // 沥青
  g.rect(0, ROAD_TOP, 1000, ROAD_BOT - ROAD_TOP);
  g.fill(20, 18, 22);
  g.rect(0, ROAD_BOT - 10, 1000, 10);       // 路缘阴影
  // 路缘石
  g.fill(190, 180, 160, 120);
  g.rect(0, ROAD_TOP, 1000, 5);
  // 中线虚线：随时间向左滚动（舱体向右行驶）
  const off = (t * 130) % 120;
  g.fill(225, 215, 180, 200);
  for (let x = -120 + off; x < 1020; x += 120) {
    g.rect(x, ROAD_LINE, 62, 7, 3);
  }
  g.pop();
}

// 边区（像素坐标）的路面延伸段
export function drawRoadPixel(g, x0, x1, t) {
  const s = 1080 / 1000; // 单位→像素
  const top = ROAD_TOP * s, bot = ROAD_BOT * s, line = ROAD_LINE * s;
  g.push();
  g.noStroke();
  g.fill(24, 22, 26);
  g.rect(x0, top, x1 - x0, bot - top);
  g.fill(20, 18, 22);
  g.rect(x0, bot - 10, x1 - x0, 10);
  g.fill(190, 180, 160, 120);
  g.rect(x0, top, x1 - x0, 5);
  const off = (t * 130) % 120;
  g.fill(225, 215, 180, 200);
  for (let x = x0 - 120 + off; x < x1 + 120; x += 120) {
    if (x + 62 < x0) continue;
    g.rect(x, line, 62, 7, 3);
  }
  g.pop();
}
