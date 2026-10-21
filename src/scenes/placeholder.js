// ============================================================
// placeholder.js — 阶段 1 的 20 个标名占位场景
// 在 1000×1000 单位空间内作画；只负责"场景本身"，
// 公路、时空舱、画框、标题卡由主调度统一绘制
// ============================================================

import { TAU, smooth } from '../beat/beats.js';

// #rrggbb + alpha → p5 颜色
function col(g, hex, a = 255) {
  const n = parseInt(hex.slice(1), 16);
  return g.color((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}
function fillHex(g, hex, a = 255) { g.fill(col(g, hex, a)); }
function strokeHex(g, hex, a = 255) { g.stroke(col(g, hex, a)); }

export function renderPlaceholder(g, meta, index, local) {
  // 底色
  g.noStroke();
  fillHex(g, meta.bg);
  g.rect(0, 0, 1000, 1000);

  // 极简的"年代氛围"占位笔触（随 index 变化，仅示意，阶段 2/3 逐格替换）
  drawMotif(g, index, meta);

  // 大编号（淡水印）
  g.textAlign(g.LEFT, g.TOP);
  g.textSize(300);
  g.textStyle(g.BOLD);
  fillHex(g, meta.ink, 40);
  g.text(String(index + 1).padStart(2, '0'), 60, 40);

  // 版块名
  g.textAlign(g.CENTER, g.CENTER);
  g.textStyle(g.NORMAL);
  g.textSize(84);
  fillHex(g, meta.ink, 235);
  g.text(meta.zh, 500, 300);
  g.textSize(34);
  g.text(`${meta.en} · ${meta.era}`, 500, 380);

  // 高光小节提示框（第 2 小节短暂出现，示意"梗"的位置）
  const glow = smooth(2.0, 2.4, local) * (1 - smooth(3.6, 4.0, local));
  if (glow > 0.01) {
    g.push();
    g.noFill();
    strokeHex(g, meta.accent, 200 * glow);
    g.strokeWeight(6);
    g.rect(120, 200, 760, 220, 18);
    g.pop();
  }
}

// 每个版块一点几何差异（占位；正式版由各场景文件彻底重写）
function drawMotif(g, index, meta) {
  g.push();
  g.noFill();
  strokeHex(g, meta.accent, 120);
  g.strokeWeight(5);
  const kind = index % 4;
  if (kind === 0) {
    for (let i = 0; i < 4; i++) {
      g.arc(760, 720, 180 + i * 60, 180 + i * 60, Math.PI, TAU);
    }
  } else if (kind === 1) {
    for (let i = 0; i < 7; i++) {
      g.line(700 + i * 34, 560, 700 + i * 34, 760 + (i % 3) * 30);
    }
  } else if (kind === 2) {
    g.noStroke();
    fillHex(g, meta.accent, 120);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        g.circle(700 + c * 40, 620 + r * 46, 14);
      }
  } else {
    g.beginShape();
    g.vertex(660, 760);
    g.vertex(740, 600);
    g.vertex(810, 700);
    g.vertex(880, 560);
    g.vertex(950, 760);
    g.endShape();
  }
  g.pop();
}
