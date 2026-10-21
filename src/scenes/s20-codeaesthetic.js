// ============================================================
// s20-codeaesthetic.js — 第 20 格 · 代码美学（2020s）
// 美术简报：briefs/s20-codeaesthetic.md
//
// 一个填满画面的深色编辑器：左侧行号栏 + 逐行写出来的 SVG 源码，
// 右侧一块预览面板，代码写到哪一笔，舱体就长到哪一笔。
// 最后一行 animateTransform 落笔 → 漩涡转起来 → 灯笼亮一下（着陆铃）。
//
// 版面说明（与简报的唯一出入，见交付汇报）：
//   实际公路带是 y 770..940（见 src/kit/road.js），简报修正稿按 900..1000 计算。
//   因此状态栏改到 y 738..770（紧贴公路上沿），并在最后 1 秒让代码区
//   平滑上移 104 单位，保证 22 行 + 状态栏全部可见。
// ============================================================

import { BEAT, swirlAngle } from '../beat/beats.js';
import { rrFill, rrStroke, vignette } from '../kit/kit.js';

const MONO = '"Consolas","Courier New",monospace';

// ---- 编辑器调色 ----
const ED_BG = [13, 17, 23];        // #0d1117 代码区
const ED_CHROME = [22, 27, 34];    // #161b22 标签栏 / 状态栏
const ED_ACTIVE = [31, 41, 55];    // #1f2937 活动行
const ED_LINE = [48, 54, 61];      // #30363d 分隔线 / 面板边框
const ED_INDENT = [33, 38, 45];    // #21262d 缩进参考线
const ED_GUTTER = [110, 118, 129]; // #6e7681 行号
const ED_TEXT = [201, 209, 217];   // #c9d1d9

// ---- 语法高亮 ----
const C_TAG = [255, 123, 114];     // #ff7b72
const C_ATT = [121, 192, 255];     // #79c0ff
const C_VAL = [165, 214, 255];     // #a5d6ff
const C_COM = [139, 148, 158];     // #8b949e
const C_PUN = [201, 209, 217];     // #c9d1d9 标点
const C_TAB = [247, 129, 102];     // #f78166 活动标签高亮
const C_OK = [126, 231, 135];      // #7ee787 完成闪光

// ---- 舱体用色（与 DEFAULT_CAPSULE 一致，写死以避免耦合）----
const K_BODY = [31, 138, 148];     // #1f8a94
const K_DARK = [20, 96, 106];      // #14606a
const K_TRIM = [201, 151, 63];     // #c9973f
const K_LAMP = [255, 217, 122];    // #ffd97a
const K_GLASS = [13, 57, 64];      // #0d3940

// ---- 版面几何 ----
const TAB_H = 64;                  // 标签栏
const GUTTER_W = 78;               // 行号栏宽
const DIV_X = 81;                  // 竖分隔线
const CODE_X = 96;                 // 代码左边距
const CODE_Y0 = 96;                // 第 0 行顶部
const LINE_H = 34;                 // 行高
const FS = 24;                     // 代码字号
const CLIP_R = 656;                // 代码右裁切（预览面板左沿）
const SB_Y = 738;                  // 状态栏顶（紧贴公路上沿 770）
const SB_H = 32;
const PANEL = { x: 660, y: 130, w: 300, h: 570 }; // 预览面板
const SVG_OX = 672.5;              // SVG 原点（面板内）
const SVG_OY = 224;
const SVG_K = 1.25;                // SVG → 面板 缩放

// ---- 时间轴 ----
const N_LINES = 22;
const HALF = BEAT / 2;             // 0.25s：写一行
const TYPE = 0.15;                 // 一行打完用 0.15s，剩下 0.1s 停顿
const AUTO_FROM = 4.75;            // 自动补全：起
const AUTO_TO = 5.25;              // 回车确认
const DONE = 5.5;                  // 全部写完
const PULSE_AT = 5.75;             // 灯笼脉冲中心

// ============================================================
// 源码：22 行 SVG
// ============================================================
const LINES = [
  '<svg viewBox="0 0 220 306">',
  '  <rect class="body" x="21" y="98" width="178" height="196"/>',
  '  <polygon class="eave" points="8,98 69,76 151,76 212,98"/>',
  '  <circle class="lamp" cx="110" cy="46" r="19"/>',
  '  <rect class="win" x="37" y="116" width="45" height="43"/>',
  '  <rect class="win" x="87" y="116" width="45" height="43"/>',
  '  <!-- 第 07 版的漩涡还是有点抖，先记着 -->',
  '  <rect class="win" x="138" y="116" width="45" height="43"/>',
  '  <rect class="win" x="37" y="164" width="45" height="43"/>',
  '  <rect class="win" x="87" y="164" width="45" height="43"/>',
  '  <rect class="win" x="138" y="164" width="45" height="43"/>',
  '  <rect class="door" x="21" y="216" width="178" height="64"/>',
  '  <circle class="dial" cx="149" cy="245" r="15"/>',
  '  <rect class="louver" x="41" y="226" width="50" height="5"/>',
  '  <rect class="louver" x="41" y="237" width="50" height="5"/>',
  '  <rect class="louver" x="41" y="248" width="50" height="5"/>',
  '  <rect class="base" x="14" y="282" width="192" height="12"/>',
  '  <!-- 檐上那道小鳍，别漏了 -->',
  '  <line class="fin" x1="110" y1="76" x2="110" y2="64"/>',
  '  <animateTransform type="rotate" dur="1s"/>',
  '  <!-- 20 份答卷，这一份是写给代码的 -->',
  '</svg>',
];

// 倒数第 3 行 = 索引 19：先打出前缀，再由自动补全补齐
const PARTIAL = '  <animate';

// ============================================================
// 预览元素：行号 i ↔ 一个图形（u = 0..1 描边淡入，先描边后填色）
// ============================================================
function fade(u) {
  const s = Math.min(1, Math.max(0, u / 0.55));
  const f = Math.min(1, Math.max(0, (u - 0.45) / 0.55));
  return { sa: s * s * (3 - 2 * s), fa: f * f * (3 - 2 * f) };
}

function smooth01(a, b, x) {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

// p5 2.x 的 fill/stroke 状态不一定立刻同步到 ctx，这里两边一起给，保证走原生路径也正确
function fillA(g, c, a) {
  g.fill(c[0], c[1], c[2], 255 * a);
  g.drawingContext.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function strokeA(g, c, a) {
  g.stroke(c[0], c[1], c[2], 255 * a);
  g.drawingContext.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// ---- 等宽字宽度：p5 2.x 的 textWidth 在字体栈下不可靠，
//      直接用原生 ctx 设同一套 font 来量，量什么就用什么画 ----
let MET = null;
function metric(g) {
  if (MET) return MET;
  const ctx = g.drawingContext;
  ctx.save();
  ctx.font = `${FS}px ${MONO}`;
  const m = ctx.measureText('MMMMMMMMMM').width;
  const cjk = ctx.measureText('答').width;
  ctx.restore();
  MET = { adv: m > 4 ? m / 10 : FS * 0.55, cjk: cjk > 4 ? cjk : FS };
  return MET;
}
function widthOf(s) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    w += s.charCodeAt(i) > 0x2e7f ? MET.cjk : MET.adv;
  }
  return w;
}
// 原生 ctx 写字：字形尺寸与步进完全一致，不受 p5 text() 影响
function put(g, s, x, yTop, col, a, align, size) {
  const ctx = g.drawingContext;
  const fs = size || FS;
  ctx.font = `${fs}px ${MONO}`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
  ctx.fillText(s, x, yTop + fs);
}

// 六个窗（3 列 × 2 行横长窗）
const WINS = [
  [37, 116], [87, 116], [138, 116],
  [37, 164], [87, 164], [138, 164],
];

const ELEMENTS = [
  {
    line: 0,
    draw: (g, u) => {                                  // 画布框
      const { sa } = fade(u);
      const ctx = g.drawingContext;
      ctx.save();
      ctx.setLineDash([9, 9]);
      strokeA(g, ED_INDENT, 0.9 * sa);
      g.strokeWeight(1.6);
      g.noFill();
      ctx.beginPath();
      ctx.rect(0, 0, 220, 306);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    line: 1,
    draw: (g, u) => {                                  // 舱身
      const { sa, fa } = fade(u);
      g.noStroke();
      fillA(g, K_BODY, fa);
      rrFill(g, 21, 98, 178, 196, 10);
      if (sa > 0.01) {
        g.noFill();
        strokeA(g, K_TRIM, sa);
        g.strokeWeight(4);
        rrStroke(g, 21, 98, 178, 196, 10);
      }
    },
  },
  {
    line: 2,
    draw: (g, u) => {                                  // 四坡短檐
      const { sa, fa } = fade(u);
      g.noStroke();
      fillA(g, K_DARK, fa);
      g.beginShape();
      g.vertex(8, 98); g.vertex(69, 76);
      g.vertex(151, 76); g.vertex(212, 98);
      g.endShape(g.CLOSE);
      if (sa > 0.01) {
        strokeA(g, K_TRIM, sa);
        g.strokeWeight(3);
        g.line(8, 98, 212, 98);
      }
    },
  },
  {
    line: 3,
    draw: (g, u, st) => {                              // 六角灯笼（含漩涡）
      const { sa, fa } = fade(u);
      // 光晕（收紧，别糊成一团）
      g.noStroke();
      for (let i = 3; i >= 1; i--) {
        fillA(g, K_LAMP, 0.05 * i * fa * (1 + 1.1 * st.pulse));
        g.circle(110, 46, 28 + i * 8 + st.pulse * 30);
      }
      // 吊杆
      fillA(g, K_TRIM, fa);
      g.rect(107.5, 62, 5, 16);
      // 灯体
      const hex = () => {
        g.beginShape();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          g.vertex(110 + Math.cos(a) * 19, 46 + Math.sin(a) * 19);
        }
        g.endShape(g.CLOSE);
      };
      g.noStroke();
      fillA(g, K_LAMP, fa);
      hex();
      // 着陆铃：整盏灯往白里提一下
      if (st.pulse > 0.01) {
        fillA(g, [255, 252, 236], 0.62 * st.pulse * fa);
        hex();
      }
      // 灯内漩涡：写完最后一行才转
      g.noFill();
      strokeA(g, [150, 96, 22], sa * (0.45 + 0.55 * st.spinK));
      g.strokeWeight(2.6);
      const a0 = st.spin ? swirlAngle(st.t) : 0;
      g.arc(110, 46, 25.6, 25.6, a0, a0 + 2.0);
      g.arc(110, 46, 14.2, 14.2, a0 + Math.PI, a0 + Math.PI + 2.0);
      // 六角铜边
      strokeA(g, K_TRIM, sa);
      hex();
      // 确认补齐时的一圈涟漪
      if (st.ripple > 0.01) {
        g.noFill();
        strokeA(g, K_LAMP, 0.75 * st.ripple);
        g.strokeWeight(2.4);
        g.circle(110, 46, 40 + (1 - st.ripple) * 90);
      }
    },
  },
  {
    line: 4, draw: (g, u) => win(g, u, 0),
  },
  {
    line: 5, draw: (g, u) => win(g, u, 1),
  },
  {
    line: 7, draw: (g, u) => win(g, u, 2),
  },
  {
    line: 8, draw: (g, u) => win(g, u, 3),
  },
  {
    line: 9, draw: (g, u) => win(g, u, 4),
  },
  {
    line: 10, draw: (g, u) => win(g, u, 5),
  },
  {
    line: 11,
    draw: (g, u) => {                                  // 门板：中缝 + 铜把手
      const { sa } = fade(u);
      strokeA(g, [10, 60, 68], 0.9 * sa);
      g.strokeWeight(2.4);
      g.line(110, 216, 110, 280);
      strokeA(g, K_TRIM, sa);
      g.strokeWeight(3);
      g.line(117, 243, 117, 258);
    },
  },
  {
    line: 12,
    draw: (g, u, st) => {                              // 时间刻度盘
      const { sa, fa } = fade(u);
      g.noStroke();
      fillA(g, K_DARK, fa);
      g.circle(149, 245, 30);
      g.noFill();
      strokeA(g, K_TRIM, sa);
      g.strokeWeight(1.6);
      g.circle(149, 245, 30);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.line(
          149 + Math.cos(a) * 10.8, 245 + Math.sin(a) * 10.8,
          149 + Math.cos(a) * 14.1, 245 + Math.sin(a) * 14.1
        );
      }
      strokeA(g, [255, 235, 190], sa);
      g.strokeWeight(2);
      const na = swirlAngle(st.t) - Math.PI / 2;
      g.line(149, 245, 149 + Math.cos(na) * 9.9, 245 + Math.sin(na) * 9.9);
    },
  },
  { line: 13, draw: (g, u) => louver(g, u, 226) },
  { line: 14, draw: (g, u) => louver(g, u, 237) },
  { line: 15, draw: (g, u) => louver(g, u, 248) },
  {
    line: 16,
    draw: (g, u) => {                                  // 宽底座 + 悬浮喷口
      const { sa, fa } = fade(u);
      g.noStroke();
      for (let i = 0; i < 4; i++) {
        fillA(g, [150, 240, 255], 0.13 * fa);
        g.ellipse(i < 2 ? 53 : 167, 300, 26, 9);
      }
      fillA(g, K_DARK, fa);
      rrFill(g, 14, 282, 192, 12, 3);
      if (sa > 0.01) {
        strokeA(g, K_TRIM, sa);
        g.strokeWeight(2);
        g.line(14, 282, 206, 282);
      }
    },
  },
  {
    line: 18,
    draw: (g, u) => {                                  // 屋脊小鳍
      const { sa } = fade(u);
      strokeA(g, K_TRIM, sa);
      g.strokeWeight(3.4);
      g.line(110, 76, 110, 64);
    },
  },
];

function win(g, u, idx) {
  const { sa, fa } = fade(u);
  const x = WINS[idx][0], y = WINS[idx][1];
  g.noStroke();
  fillA(g, K_GLASS, fa);
  rrFill(g, x, y, 45, 43, 3);
  if (fa > 0.02) {                                     // 玻璃反光斜条（四点收在窗内）
    fillA(g, [255, 255, 255], 0.075 * fa);
    g.beginShape();
    g.vertex(x + 6, y + 43);
    g.vertex(x + 15, y + 43);
    g.vertex(x + 29, y);
    g.vertex(x + 20, y);
    g.endShape(g.CLOSE);
  }
  if (sa > 0.01) {
    g.noFill();
    strokeA(g, K_DARK, 0.85 * sa);
    g.strokeWeight(2);
    rrStroke(g, x, y, 45, 43, 3);
    strokeA(g, [20, 90, 98], 0.7 * sa);
    g.strokeWeight(2);
    g.line(x + 22.5, y, x + 22.5, y + 43);
  }
}

function louver(g, u, y) {
  const { sa, fa } = fade(u);
  g.noStroke();
  fillA(g, K_DARK, fa);
  rrFill(g, 41, y, 50, 5, 2);
  if (sa > 0.01) {
    g.noFill();
    strokeA(g, K_TRIM, 0.5 * sa);
    g.strokeWeight(1.4);
    rrStroke(g, 41, y, 50, 5, 2);
  }
}

// ============================================================
// 语法着色：把一行切成 token
// ============================================================
function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      let j = i; while (j < s.length && s[j] === ' ') j++;
      out.push([s.slice(i, j), null]); i = j; continue;
    }
    if (s.startsWith('<!--', i)) {
      const e = s.indexOf('-->', i);
      const j = e < 0 ? s.length : e + 3;
      out.push([s.slice(i, j), C_COM]); i = j; continue;
    }
    if (c === '<' && (s[i + 1] === '/' || /[a-zA-Z]/.test(s[i + 1] || ''))) {
      let k = i + (s[i + 1] === '/' ? 2 : 1);
      while (k < s.length && /[a-zA-Z0-9_-]/.test(s[k])) k++;
      out.push([s.slice(i, k), C_TAG]); i = k; continue;
    }
    if (c === '/' && s[i + 1] === '>') { out.push(['/>', C_PUN]); i += 2; continue; }
    if (c === '>') { out.push(['>', C_PUN]); i++; continue; }
    const m = /^([a-zA-Z][\w:-]*)(=)("[^"]*")/.exec(s.slice(i));
    if (m) {
      out.push([m[1], C_ATT]); out.push([m[2], C_PUN]); out.push([m[3], C_VAL]);
      i += m[0].length; continue;
    }
    let k = i; while (k < s.length && !/[\s<>/="]/.test(s[k])) k++;
    if (k === i) k = i + 1;
    out.push([s.slice(i, k), C_ATT]); i = k;
  }
  return out;
}
const TOKENS = LINES.map(tokenize);

// ============================================================
// 主渲染
// ============================================================
export function render(g, meta, local, index) {
  const t = 5 + 6 * (index == null ? 19 : index) + local;   // 全局时间
  const n = Math.min(N_LINES, Math.floor(local / HALF));     // 已写完的行数
  const spin = local >= AUTO_TO;                             // 漩涡开转
  const scroll = scrollOf(local);
  const st = {
    t,
    spin,
    spinK: Math.min(1, Math.max(0, (local - (AUTO_TO - 0.12)) / 0.24)),
    ripple: ringOf(local),
    pulse: pulseOf(local),
  };

  g.push();
  g.noStroke();
  fillA(g, ED_BG, 1);
  g.rect(0, 0, 1000, 1000);

  drawIndentGuides(g);
  drawActiveRow(g, local, n, scroll);
  drawGutter(g, local, n, scroll);
  drawCode(g, local, n, scroll);
  drawDivider(g);
  drawFadeEdge(g);
  drawAutocomplete(g, local, scroll);
  drawTabBar(g);
  drawStatusBar(g);
  drawPreview(g, local, st);
  drawBottom(g);

  vignette(g, 0, 0, 1000, 1000, 44);
  g.pop();
}

// 公路以下的收尾：把编辑区压暗，让画框底部不空
function drawBottom(g) {
  const ctx = g.drawingContext;
  const grd = ctx.createLinearGradient(0, 930, 0, 1000);
  grd.addColorStop(0, 'rgba(8,10,14,0)');
  grd.addColorStop(1, 'rgba(8,10,14,0.95)');
  ctx.save();
  ctx.fillStyle = grd;
  ctx.fillRect(0, 930, 1000, 70);
  ctx.restore();
}

// ---- 版面辅助 ----
function scrollOf(local) {
  // 光标行接近状态栏时，整块代码平滑上移，最多 104 单位（编辑器正常滚动）
  const head = CODE_Y0 + (local / HALF) * LINE_H;
  return Math.min(104, Math.max(0, head - 706));
}

function ringOf(local) {
  const u = (local - AUTO_TO) / 0.42;
  return u < 0 || u > 1 ? 0 : Math.sin(Math.PI * u) * 0.9;
}

function pulseOf(local) {
  const u = (local - (PULSE_AT - 0.1)) / 0.2;
  return u < 0 || u > 1 ? 0 : Math.sin(Math.PI * u);
}

// ============================================================
// 缩进参考线 / 活动行 / 行号 / 代码
// ============================================================
function drawIndentGuides(g) {
  g.noStroke();
  fillA(g, ED_INDENT, 1);
  // 本格源码统一两空格缩进：只画一条块级参考线
  g.rect(CODE_X + 26, TAB_H, 1, SB_Y - TAB_H);
}

function drawDivider(g) {
  g.noStroke();
  fillA(g, ED_LINE, 1);
  g.rect(DIV_X, TAB_H, 2, SB_Y - TAB_H);
}

function rowY(i, scroll) { return CODE_Y0 + i * LINE_H - scroll; }

function caretRowOf(local, n) {
  if (local >= AUTO_FROM && local < AUTO_TO) return 19;
  return Math.min(N_LINES - 1, n);
}

function drawActiveRow(g, local, n, scroll) {
  const r = caretRowOf(local, n);
  const y = rowY(r, scroll);
  if (y + LINE_H < TAB_H || y > SB_Y) return;
  g.noStroke();
  fillA(g, ED_ACTIVE, 0.6);
  g.rect(0, y, 1000, LINE_H);
}

function drawGutter(g, local, n, scroll) {
  metric(g);
  const act = caretRowOf(local, n);
  for (let i = 0; i < n; i++) {
    const y = rowY(i, scroll);
    if (y + LINE_H < TAB_H || y > SB_Y) continue;
    const on = i === act;
    put(g, String(i + 1), 62, y, on ? ED_TEXT : ED_GUTTER, on ? 1 : 0.92, 'right');
  }
}

function drawCode(g, local, n, scroll) {
  metric(g);
  g.noStroke();

  for (let i = 0; i < n; i++) {
    if (i === 19 && local >= AUTO_FROM && local < AUTO_TO) continue; // 这一行交给补全框
    const y = rowY(i, scroll);
    if (y + LINE_H < TAB_H || y > SB_Y) continue;
    // 正在打的一行：逐字显示（0.15s 打完，剩下 0.1s 停顿）
    const rv = Math.min(1, (local - i * HALF) / TYPE);
    const cut = Math.round(rv * LINES[i].length);
    let w = 0;
    let pos = 0;
    for (const [txt, col] of TOKENS[i]) {
      const avail = cut - pos;
      pos += txt.length;
      if (avail <= 0) break;
      const piece = avail >= txt.length ? txt : txt.slice(0, avail);
      if (col) put(g, piece, CODE_X + w, y, col, 1);
      w += widthOf(piece);
      if (avail < txt.length) break;
    }
  }

  // 倒数第 3 行：正在输入 + 自动补全下拉框
  if (local >= AUTO_FROM && local < AUTO_TO) {
    const y = rowY(19, scroll);
    const rv = Math.min(1, (local - AUTO_FROM) / TYPE);
    const shown = PARTIAL.slice(0, Math.round(rv * PARTIAL.length));
    put(g, shown, CODE_X, y, C_TAG, 1);
  }

  // 光标：2×26，每拍闪一次（前半拍亮）
  if (local % BEAT < BEAT / 2) {
    const r = caretRowOf(local, n);
    const y = rowY(r, scroll);
    let cx = CODE_X;
    if (local >= AUTO_FROM && local < AUTO_TO) {
      const rv = Math.min(1, (local - AUTO_FROM) / TYPE);
      cx += widthOf(PARTIAL.slice(0, Math.round(rv * PARTIAL.length)));
    } else {
      const rv = Math.min(1, (local - r * HALF) / TYPE);
      cx += widthOf(LINES[r].slice(0, Math.round(rv * LINES[r].length)));
    }
    fillA(g, ED_TEXT, 0.95);
    g.rect(cx, y + 4, 2, 25);
  }
}

// 面板左沿的一道软边，让被遮住的长行读起来像横向滚动
function drawFadeEdge(g) {
  const ctx = g.drawingContext;
  const grd = ctx.createLinearGradient(CLIP_R - 38, 0, CLIP_R, 0);
  grd.addColorStop(0, 'rgba(13,17,23,0)');
  grd.addColorStop(1, 'rgba(13,17,23,1)');
  ctx.save();
  ctx.fillStyle = grd;
  ctx.fillRect(CLIP_R - 38, TAB_H, 38, SB_Y - TAB_H);
  ctx.restore();
}

// ============================================================
// 标签栏 / 状态栏
// ============================================================
function drawTabBar(g) {
  g.noStroke();
  fillA(g, ED_CHROME, 1);
  g.rect(0, 0, 1000, TAB_H);
  fillA(g, ED_LINE, 1);
  g.rect(0, TAB_H - 2, 1000, 2);

  // 活动标签
  fillA(g, ED_BG, 1);
  g.rect(24, 8, 300, TAB_H - 10);
  g.push();
  g.noFill();
  strokeA(g, ED_GUTTER, 0.75);
  g.strokeWeight(2);
  g.rect(44, 22, 13, 18, 2);
  strokeA(g, ED_GUTTER, 0.75);
  g.line(48, 27, 53, 27);
  g.line(48, 32, 53, 32);
  g.line(48, 37, 51, 37);
  g.pop();
  g.noStroke();
  put(g, 'time-capsule.svg', 72, 21, ED_TEXT, 1, 'left', 21);
  fillA(g, C_TAB, 1);
  g.rect(24, TAB_H - 5, 300, 3);

  // 暗标签
  fillA(g, ED_CHROME, 1);
  g.rect(336, 8, 210, TAB_H - 10);
  g.push();
  g.noFill();
  strokeA(g, ED_GUTTER, 0.55);
  g.strokeWeight(2);
  g.rect(356, 22, 13, 18, 2);
  strokeA(g, ED_GUTTER, 0.55);
  g.line(360, 27, 365, 27);
  g.line(360, 32, 365, 32);
  g.pop();
  put(g, 'notes.md', 384, 21, ED_GUTTER, 0.9, 'left', 21);

  // 标签栏右侧：一点点 UI 呼吸（三个小方块）
  g.noStroke();
  for (let i = 0; i < 3; i++) {
    fillA(g, ED_GUTTER, 0.34);
    g.rect(852 + i * 30, 28, 16, 6, 3);
  }
}

function drawStatusBar(g) {
  g.noStroke();
  fillA(g, ED_CHROME, 1);
  g.rect(0, SB_Y, 1000, SB_H);
  fillA(g, ED_LINE, 1);
  g.rect(0, SB_Y, 1000, 2);

  put(g, 'Ln 24, Col 1', 24, SB_Y + 6, ED_GUTTER, 0.95, 'left', 20);
  put(g, 'UTF-8  LF', 500, SB_Y + 6, ED_GUTTER, 0.85, 'center', 20);
  put(g, 'SVG', 976, SB_Y + 6, C_OK, 0.85, 'right', 20);
}
// ============================================================
// 自动补全下拉框
// ============================================================
const CAND = ['animateTransform', 'animateMotion', 'animate'];

function drawAutocomplete(g, local, scroll) {
  if (local < AUTO_FROM || local >= AUTO_TO) return;
  const w = 250, rh = 30, h = 3 * rh + 10;
  const y0 = rowY(19, scroll) + LINE_H - 2;
  const y = y0 + h > SB_Y - 4 ? rowY(19, scroll) - 8 - h : y0;
  const x = CODE_X + 2;

  g.noStroke();
  // 投影：让补全框从代码里浮起来
  fillA(g, [0, 0, 0], 0.22);
  rrFill(g, x + 2, y + 4, w, h, 8);
  fillA(g, [22, 27, 34], 1);
  rrFill(g, x, y, w, h, 6);
  g.noFill();
  strokeA(g, ED_LINE, 1);
  g.strokeWeight(1.5);
  rrStroke(g, x, y, w, h, 6);

  for (let i = 0; i < CAND.length; i++) {
    const ry = y + 5 + i * rh;
    if (i === 0) {
      g.noStroke();
      fillA(g, [40, 48, 58], 1);
      g.rect(x + 4, ry, w - 8, rh, 4);
    }
    put(g, CAND[i], x + 12, ry + 5, i === 0 ? C_ATT : ED_GUTTER, i === 0 ? 1 : 0.85, 'left', 20);
    if (i === 0) {
      put(g, 'Tab', x + w - 12, ry + 5, ED_GUTTER, 0.8, 'right', 17);
    }
  }
}

// ============================================================
// 预览面板
// ============================================================
function drawPreview(g, local, st) {
  const { x, y, w, h } = PANEL;

  // 面板底：与代码区同色，用来盖住长行
  g.noStroke();
  fillA(g, ED_BG, 1);
  rrFill(g, x, y, w, h, 8);

  // 边框：完成时闪一次绿（外圈先亮，内描边跟着）
  const flash = local < DONE ? 0 : Math.exp(-(local - DONE) / 0.19);
  g.noFill();
  if (flash > 0.02) {
    g.noFill();
    strokeA(g, C_OK, 0.5 * flash);
    g.strokeWeight(7);
    rrStroke(g, x - 2, y - 2, w + 4, h + 4, 10);
    strokeA(g, C_OK, flash);
    g.strokeWeight(2);
    rrStroke(g, x - 1, y - 1, w + 2, h + 2, 9);
  }
  strokeA(g, ED_LINE, 1);
  g.strokeWeight(1.5);
  rrStroke(g, x, y, w, h, 8);

  // 左上小字 + 右上缩放
  g.noStroke();
  put(g, 'preview', x + 16, y + 12, ED_GUTTER, 0.95, 'left', 17);
  put(g, '100%', x + w - 16, y + 12, ED_GUTTER, 0.6, 'right', 17);
  // 文件写完之后，标题栏亮一个小小的对勾
  const ok = smooth01(DONE, DONE + 0.16, local);
  if (ok > 0.01) {
    g.noFill();
    strokeA(g, C_OK, 0.95 * ok);
    g.strokeWeight(2);
    g.line(x + w - 62, y + 21, x + w - 57, y + 26);
    g.line(x + w - 57, y + 26, x + w - 48, y + 15);
  }
  fillA(g, ED_LINE, 0.9);
  g.rect(x + 16, y + 38, w - 32, 1);

  // 底部画布尺寸（预览面板的常规信息）
  put(g, '220 × 306', x + w / 2, y + h - 30, ED_GUTTER, 0.5, 'center', 16);

  // 舱体：按行号逐笔成形；写完时轻轻一涨，像松了一口气
  const bump = local < DONE ? 0 : Math.sin(Math.PI * Math.min(1, (local - DONE) / 0.36));
  g.push();
  g.translate(SVG_OX + 110 * SVG_K, SVG_OY + 160 * SVG_K);
  g.scale(SVG_K * (1 + 0.018 * bump));
  g.translate(-110, -160);
  for (const el of ELEMENTS) {
    const u = Math.min(1, Math.max(0, (local - el.line * HALF) / HALF));
    if (u <= 0) continue;
    g.push();
    el.draw(g, u, st);
    g.pop();
  }
  g.pop();
}

// ============================================================
// 本格不画公路上的舱体：它只存在于右侧预览面板里，由代码一笔笔画出来。
// 过框的仪式感交给「预览面板边框闪一次 + 灯笼亮一下」。
// ============================================================
export function drawVehicle(g, opts) {
  void g;
  void opts;
}
