// ============================================================
// intro.js — 片头：一本正经地胡说（约 5 秒，2.5 小节）
// 纸张质感 + 衬线字体 + 纪录片式字幕；最后 1 秒时空舱驶入第 1 版块
// 全屏绘制（不经过 1000 单位空间）
// ============================================================

import { smooth, BEAT, BAR } from '../beat/beats.js';
import { grain, vignette, sketchCapsule } from '../kit/kit.js';
import { drawCapsule } from '../rig/capsule.js';

const ZH_SERIF = '"KaiTi","STKaiti","SimSun",serif';

export function renderIntro(g, local) {
  const W = g.width, H = g.height;

  // 纸张底色
  g.noStroke();
  g.fill(236, 228, 208);
  g.rect(0, 0, W, H);
  grain(g, 0, 0, W, H, 11, 22);
  vignette(g, 0, 0, W, H, 70);

  // ---- 左下素描插图 + 图注 ----
  const bx = 150, by = 620, bw = 360, bh = 300;
  g.push();
  g.noFill();
  g.stroke(74, 59, 40, 200);
  g.strokeWeight(2);
  g.rect(bx, by, bw, bh);
  sketchCapsule(g, bx + bw / 2, by + bh - 60, 1.5);
  // 漩涡笔触
  g.noFill();
  g.arc(bx + bw / 2, by + 90, 90, 90, 0.4, 3.6);
  g.arc(bx + bw / 2, by + 90, 50, 50, 2.2, 5.4);
  g.pop();
  g.noStroke();
  g.fill(74, 59, 40, 220);
  g.textFont(ZH_SERIF);
  g.textAlign(g.LEFT, g.TOP);
  g.textSize(24);
  g.text('图一　时空舱穿越图（摹本）', bx, by + bh + 14);

  // ---- 出处小字 ----
  const a0 = smooth(1.0, 1.6, local);
  g.fill(74, 59, 40, 170 * a0);
  g.textSize(22);
  g.text('——《时空舱穿越艺术通史》，卷一', bx, by + bh + 56);

  // ---- 字幕两行（居中，落下方） ----
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(52);

  const a1 = smooth(0.3, 0.8, local) * (1 - smooth(1.9, 2.3, local));
  if (a1 > 0.01) {
    g.fill(40, 32, 22, 255 * a1);
    g.text('人类自古以来就痴迷于画时空舱穿越。', W / 2, H - 170);
  }

  // 第二条落在强拍（t=4.0，即第 3 小节头）
  const a2 = smooth(BEAT * 8 - 0.08, BEAT * 8 + 0.15, local);
  if (a2 > 0.01) {
    g.fill(40, 32, 22, 255 * a2);
    g.text('——早在时空旅行被发明之前。', W / 2, H - 170);
  }

  // ---- 末尾：公路浮现，时空舱驶入 ----
  const drive = smooth(3.8, 4.0, local); // 公路淡入
  if (drive > 0.01) {
    g.push();
    g.noStroke();
    g.fill(24, 22, 26, 255 * drive);
    g.rect(0, H - 150, W, 150);
    g.fill(225, 215, 180, 200 * drive);
    const off = (local * 260) % 140;
    for (let x = -140 + off; x < W + 140; x += 140) {
      g.rect(x, H - 82, 72, 8, 4);
    }
    g.pop();
  }
  const go = smooth(4.0, 5.0, local); // 0→1 驶过
  if (go > 0.001) {
    const x = -200 + go * (W + 500);
    g.push();
    g.scale(1.55);
    drawCapsule(g, x / 1.55, (H - 96) / 1.55, 1, {
      t: local, hoverLocal: local, driverPose: { t: local },
    });
    g.pop();
  }
}
