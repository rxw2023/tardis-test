// ============================================================
// s03-hanrubbing.js — 第 03 汉画像石拓片 版块（占位，待实现）
// 美术简报：briefs/s03-hanrubbing.md
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
