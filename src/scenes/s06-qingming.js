// ============================================================
// s06-qingming.js — 第 06 清明上河图 版块（占位，待实现）
// 美术简报：briefs/s06-qingming.md
// ============================================================

export function render(g, meta) {
  g.push();
  g.noStroke();
  g.fill(meta.bg);
  g.rect(0, 0, 1000, 1000);
  g.fill(meta.ink);
  g.textAlign(g.CENTER, g.CENTER);
  g.textSize(40);
  g.text(meta.zh, 500, 500);
  g.pop();
}
