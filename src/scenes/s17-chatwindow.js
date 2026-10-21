// ============================================================
// s17-chatwindow.js — 第 17 格：早期聊天窗口（2000s 桌面 IM）
// 美术简报 briefs/17-chatwindow.md ／ 技术契约 briefs/API.md
// 全部虚构：界面布局、配色、图标、昵称均自绘自撰，无任何真实软件元素
// 重点：动图区 256 色量化 + 4×4 Bayer 有序抖动 + 5 帧 8fps 循环
// ============================================================

import { mulberry32 } from '../kit/kit.js';

const UI = '"Microsoft YaHei","PingFang SC","Tahoma",sans-serif';

// ---------------- 版面（单位空间 1000×1000） ----------------
// 公路带 y 770..940 会被主调度盖住，窗口下沿收在 768，保证内容完整可见
const WX = 90, WY = 96, WW = 820, WH = 672;            // 窗口 x90..910 / y96..768
const TB_H = 46;                                        // 标题栏高
const LIST = { x: 100, y: 150, w: 200, h: 510 };        // 好友列表 y150..660
const CHAT = { x: 308, y: 150, w: 592, h: 510 };        // 消息区
const INPUT = { x: 100, y: 670, w: 642, h: 60 };        // 输入框
const BTN_SEND = { x: 750, y: 670, w: 88, h: 60 };
const BTN_CLOSE = { x: 846, y: 670, w: 54, h: 60 };
const GIFA = { x: 340, y: 300, w: 360, h: 260 };         // 动图区域（本格重点）

// ---------------- 配色 ----------------
const C_SYS = '#cfe0ee';   // 系统灰
const C_WHITE = '#ffffff';
const C_DARK = '#808080';  // 暗边
const C_INK = '#223344';
const C_INK2 = '#6b7885';
const C_ME = '#d8f0c8';    // 我方气泡
const C_YOU = '#e8f0f8';  // 对方气泡
const C_AVGRAY = '#9aa0a6';
const C_STRIP = '#eef4fa';

const FRIENDS = [
  { n: '小满', c: '#7a9ab0' },
  { n: '阿砚', c: '#8aa88a' },
  { n: '老周', c: '#b09a7a' },
  { n: '铜壶', c: '#9a8ab0' },
  { n: '灯塔守', c: '#7aa8a0' },
  { n: '慢递员', c: '#b08a9a' },
  { n: '夜班司机', c: '#8a94a8' },
  { n: '测绘员', c: '#a8a07a' },
];

// ---------------- 动图缓冲（4 单位一格 → 90×65） ----------------
const GW = 90, GH = 65, CELL = 4;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const HORIZON = 44;
const ROAD_Y = 51;
const BY = 51;                     // 舱体底座贴地行
let gbuf = null;                   // 模块级缓存（只建一次）

const STARS = (() => {
  const r = mulberry32(1701), a = [];
  for (let i = 0; i < 20; i++) {
    a.push([Math.floor(r() * (GW - 2)), Math.floor(r() * 36)]);
  }
  return a;
})();

const P_BODY = [31, 138, 148], P_DARK = [20, 96, 106], P_TRIM = [201, 151, 63];
const P_LAMP = [255, 217, 122], P_HI = [255, 246, 214], P_GLASS = [13, 57, 64];
const P_JET = [132, 220, 236];
const BYSTANDERS = [
  { x: 6, c: [150, 116, 90] },
  { x: 31, c: [104, 124, 146] },
  { x: 77, c: [124, 142, 108] },
];

// ---------------- 小工具 ----------------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, u) { return a + (b - a) * u; }

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(h, k) {
  const [r, g, b] = hexRgb(h);
  const f = (v) => clamp(Math.round(v * (1 + k)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// 凸起 3D 边框：外亮 1.5 + 内暗 1.5
function bevel(g, x, y, w, h, outer, inner) {
  g.noFill();
  g.stroke(outer); g.strokeWeight(1.5);
  g.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  g.stroke(inner); g.strokeWeight(1.5);
  g.rect(x + 2.25, y + 2.25, w - 4.5, h - 4.5);
  g.noStroke();
}

// 内凹边框：外暗 + 内亮（白底上用浅灰代替纯白，才读得出来）
function sunken(g, x, y, w, h, edge) {
  g.noFill();
  g.stroke(C_DARK); g.strokeWeight(1.5);
  g.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  g.stroke(edge || '#c2ccd6'); g.strokeWeight(1.5);
  g.rect(x + 2.25, y + 2.25, w - 4.5, h - 4.5);
  g.noStroke();
}

function label(g, s, x, y, size, col, align) {
  g.textFont(UI);
  g.textSize(size);
  g.textAlign(align || g.LEFT, g.BASELINE);
  g.noStroke();
  g.fill(col);
  g.text(s, x, y);
}

// ============================================================
// 主入口
// ============================================================
export function render(g, meta, local, index) {
  const step = Math.floor(local * 8);                 // 8fps 量化步长
  const q = step / 8;
  const gifFrame = step % 5;                          // 5 帧循环
  const dotStep = step % 4;                            // 输入中三点（每拍一轮）
  const grayN = clamp(Math.floor((local - 0.5) / 1.0), 0, 6);
  const online = 8 - grayN;
  const cross = Math.min(local, 6 - local);
  const glow = Math.exp(-Math.pow(cross / 0.16, 2));   // 过框激活闪边
  const sh = shakeOffset(local);                       // 强拍窗口抖动（不量化）

  drawDesktop(g);
  drawDesktopIcons(g);

  // 窗口投影（硬边，无模糊）
  g.push();
  g.noStroke();
  g.fill(12, 28, 48, 70);
  g.rect(WX + 10, WY + 10, WW, WH);
  g.pop();

  g.push();
  g.translate(sh, sh);                                 // 整个窗口一起抖
  drawWindow(g, { q, gifFrame, dotStep, grayN, online, glow });
  g.pop();
}

// 强拍抖动：8fps 阶跃，先 +4 再 -4 再回 0（共 0.25s）
function shakeOffset(local) {
  const b = Math.floor(local / 0.5);
  const dt = local - b * 0.5;
  if (dt >= 0.25) return 0;
  return Math.floor(dt / 0.125) === 0 ? 4 : -4;
}

// ---------------- 桌面 ----------------
function drawDesktop(g) {
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(0, 0, 0, 1000);
  grad.addColorStop(0, '#4a7ab0');
  grad.addColorStop(1, '#2a5a8a');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1000, 1000);
  ctx.restore();

  // 极淡斜向网格
  g.push();
  g.stroke(255, 255, 255, 13);
  g.strokeWeight(1.5);
  for (let x0 = -1000; x0 <= 2000; x0 += 50) {
    g.line(x0, 0, x0 - 1000, 1000);
  }
  g.pop();
}

// 左侧三个自绘桌面图标（抽象几何，无品牌）
function drawDesktopIcons(g) {
  const items = [
    { y: 250, kind: 0, t: '信箱' },
    { y: 344, kind: 1, t: '图库' },
    { y: 438, kind: 2, t: '设置' },
  ];
  for (const it of items) {
    const x = 46, s = 34;
    g.push();
    g.noStroke();
    g.fill(230, 238, 246, 40);
    g.rect(x - 4, it.y - 4, s + 8, s + 8);
    g.fill('#dfe8f0');
    g.rect(x, it.y, s, s);
    g.noFill();
    g.stroke('#5a7ba0');
    g.strokeWeight(2);
    if (it.kind === 0) {                    // 信封
      g.rect(x + 6, it.y + 9, s - 12, s - 18);
      g.line(x + 6, it.y + 9, x + s / 2, it.y + s / 2 + 1);
      g.line(x + s - 6, it.y + 9, x + s / 2, it.y + s / 2 + 1);
    } else if (it.kind === 1) {             // 照片（山形）
      g.rect(x + 5, it.y + 7, s - 10, s - 14);
      g.line(x + 8, it.y + s - 9, x + s / 2 - 2, it.y + 15);
      g.line(x + s / 2 - 2, it.y + 15, x + s - 8, it.y + s - 9);
    } else {                                // 设置（六角 + 中心孔）
      g.push();
      g.translate(x + s / 2, it.y + s / 2);
      g.beginShape();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        g.vertex(Math.cos(a) * 11, Math.sin(a) * 11);
      }
      g.endShape(g.CLOSE);
      g.pop();
      g.noStroke();
      g.fill('#5a7ba0');
      g.rect(x + s / 2 - 3, it.y + s / 2 - 3, 6, 6);
    }
    g.pop();
    g.push();
    g.noStroke();
    g.fill(255, 255, 255, 225);
    g.textFont(UI);
    g.textSize(12);
    g.textAlign(g.CENTER, g.BASELINE);
    g.text(it.t, x + s / 2, it.y + s + 16);
    g.pop();
  }
}

// ---------------- 窗口 ----------------
function drawWindow(g, st) {
  // 外亮 + 内暗 + 系统灰填充
  g.push();
  g.noStroke();
  g.fill(C_SYS);
  g.rect(WX, WY, WW, WH);
  bevel(g, WX, WY, WW, WH, st.glow > 0.02 ? '#fff6d8' : C_WHITE, C_DARK);
  if (st.glow > 0.02) {                       // 过框：亮边闪一次
    g.noFill();
    g.stroke(255, 246, 216, 230 * st.glow);
    g.strokeWeight(3);
    g.rect(WX - 1.5, WY - 1.5, WW + 3, WH + 3);
    g.noStroke();
  }
  g.pop();

  drawTitleBar(g);
  drawFriendList(g, st.grayN, st.online);
  drawChatArea(g, st);
  drawInputArea(g, st);
}

// ---------------- 标题栏 ----------------
function drawTitleBar(g) {
  const ctx = g.drawingContext;
  const grad = ctx.createLinearGradient(0, WY, 0, WY + TB_H);
  grad.addColorStop(0, '#4a7ab0');
  grad.addColorStop(1, '#2a5a8a');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(WX + 3, WY + 3, WW - 6, TB_H - 6);
  ctx.restore();

  // 自绘对话气泡图标 16×16（抽象几何）
  const ix = 104, iy = WY + 15;
  g.push();
  g.noStroke();
  g.fill(235, 244, 252);
  g.rect(ix, iy, 16, 12);
  g.beginShape();
  g.vertex(ix + 3, iy + 12);
  g.vertex(ix + 7, iy + 16);
  g.vertex(ix + 7, iy + 12);
  g.endShape(g.CLOSE);
  g.fill('#2a5a8a');
  g.rect(ix + 3, iy + 3, 10, 2);
  g.rect(ix + 3, iy + 7, 7, 2);
  g.pop();

  label(g, '时空驾驶员 - 聊天', ix + 24, WY + 31, 18, '#ffffff');

  // 三个自绘按钮：最小化 / 最大化 / 关闭
  const bs = [
    { x: 826, k: 0 }, { x: 852, k: 1 }, { x: 878, k: 2 },
  ];
  for (const b of bs) {
    const bx = b.x, by = WY + 12, bw = 24, bh = 22;
    g.push();
    g.noStroke();
    g.fill(C_SYS);
    g.rect(bx, by, bw, bh);
    bevel(g, bx, by, bw, bh, C_WHITE, C_DARK);
    g.noFill();
    g.stroke(C_INK);
    g.strokeWeight(2);
    if (b.k === 0) g.line(bx + 7, by + 15, bx + 17, by + 15);
    else if (b.k === 1) g.rect(bx + 7, by + 6, 10, 9);
    else { g.line(bx + 7, by + 6, bx + 17, by + 16); g.line(bx + 17, by + 6, bx + 7, by + 16); }
    g.pop();
  }
}

// ---------------- 好友列表 ----------------
function drawFriendList(g, grayN, online) {
  // 面板（内凹白底）
  g.push();
  g.noStroke();
  g.fill(C_WHITE);
  g.rect(LIST.x, LIST.y, LIST.w, LIST.h);
  sunken(g, LIST.x, LIST.y, LIST.w, LIST.h);
  g.pop();

  // 分组头
  g.push();
  g.noStroke();
  g.fill(C_STRIP);
  g.rect(LIST.x + 3, LIST.y + 3, LIST.w - 6, 28);
  g.fill('#b9c6d2');
  g.rect(LIST.x + 3, LIST.y + 30, LIST.w - 6, 1.5);
  g.pop();
  // 自绘小三角（展开态）
  g.push();
  g.noStroke();
  g.fill(C_INK2);
  g.beginShape();
  g.vertex(110, LIST.y + 11);
  g.vertex(118, LIST.y + 11);
  g.vertex(114, LIST.y + 19);
  g.endShape(g.CLOSE);
  g.pop();
  label(g, `我的好友（${online}/8）`, 124, LIST.y + 23, 14, C_INK);

  // 8 行：头像 + 昵称（后 6 个按拍逐个变灰）
  const rowH = (LIST.h - 34) / 8;
  for (let i = 0; i < 8; i++) {
    const y = LIST.y + 34 + i * rowH;
    const cy = y + rowH / 2;
    const gray = i >= 2 && (i - 2) < grayN;
    if (i === 0) {                       // 正在聊的那一行高亮
      g.push();
      g.noStroke();
      g.fill(74, 122, 176, 55);
      g.rect(LIST.x + 3, y + 2, LIST.w - 6, rowH - 4);
      g.pop();
    }
    drawAvatar(g, 110, cy - 17, 34, FRIENDS[i].c, gray);
    label(g, FRIENDS[i].n, 152, cy + 6, 16, gray ? '#8d939a' : C_INK);
  }
}

// 自绘头像：色块 + 抽象几何记号（无任何卡通形象）
function drawAvatar(g, x, y, s, col, gray) {
  const base = gray ? C_AVGRAY : col;
  const mark = gray ? '#767c82' : shade(col, -0.34);
  g.push();
  g.noStroke();
  g.fill(base);
  g.rect(x, y, s, s);
  g.fill(mark);
  const k = Math.round((x + y) / 34) % 4;
  if (k === 0) g.rect(x + 6, y + 14, s - 12, 7);
  else if (k === 1) g.rect(x + 11, y + 11, 12, 12);
  else if (k === 2) { g.rect(x + 6, y + 8, 9, 9); g.rect(x + 19, y + 17, 9, 9); }
  else g.rect(x + 14, y + 6, 7, s - 12);
  g.noFill();
  g.stroke(gray ? '#6d7379' : shade(col, -0.5));
  g.strokeWeight(1.5);
  g.rect(x + 0.75, y + 0.75, s - 1.5, s - 1.5);
  g.pop();
}

// ---------------- 消息区 ----------------
function drawChatArea(g, st) {
  g.push();
  g.noStroke();
  g.fill(C_WHITE);
  g.rect(CHAT.x, CHAT.y, CHAT.w, CHAT.h);
  sunken(g, CHAT.x, CHAT.y, CHAT.w, CHAT.h);
  g.pop();

  // 顶部状态条：对方正在输入…
  g.push();
  g.noStroke();
  g.fill(C_STRIP);
  g.rect(CHAT.x + 3, CHAT.y + 3, CHAT.w - 6, 28);
  g.fill('#b9c6d2');
  g.rect(CHAT.x + 3, CHAT.y + 30, CHAT.w - 6, 1.5);
  g.pop();
  label(g, '对方正在输入', 318, CHAT.y + 23, 15, C_INK2);
  const tw = (() => { g.textFont(UI); g.textSize(15); return g.textWidth('对方正在输入'); })();
  for (let i = 0; i < 3; i++) {
    const on = st.dotStep % 3 === i;
    g.push();
    g.noStroke();
    g.fill(on ? C_INK : '#aab6c2');
    g.rect(322 + tw + i * 9, CHAT.y + 16, 5, 5);
    g.pop();
  }

  // 消息 1（我）
  bubble(g, '在吗？我这边时间对不上', C_ME, '#9dc085', 876, 184, 'me');
  // 消息 2（对方）
  bubble(g, '刚录了一段，你看', C_YOU, '#a9bccd', 318, 236, 'you');

  // 消息 3（对方）：时空舱穿越动图 —— 从 0.6 倍弹入带回弹
  const u = clamp((st.q - 1.5) / 0.4, 0, 1);
  const e = 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
  const sc = 0.6 + 0.4 * e;
  const bx = 318, by = 288, bw = 404, bh = 308;
  g.push();
  g.translate(bx + bw / 2, by + bh / 2);
  g.scale(sc, sc);
  g.translate(-(bx + bw / 2), -(by + bh / 2));
  drawGifBubble(g, st.gifFrame);
  g.pop();

  // 竖向滚动条
  g.push();
  g.noStroke();
  g.fill('#e4eaf0');
  g.rect(880, CHAT.y + 3, 16, CHAT.h - 6);
  sunken(g, 880, CHAT.y + 3, 16, CHAT.h - 6, '#cfd8e0');
  g.fill(C_SYS);
  g.rect(882, 320, 12, 120);
  bevel(g, 882, 320, 12, 120, C_WHITE, C_DARK);
  g.pop();
}

function bubble(g, txt, fillc, edge, ax, y, side) {
  g.textFont(UI);
  g.textSize(16);
  const w = g.textWidth(txt) + 28;
  const h = 44;
  const x = side === 'me' ? ax - w : ax;
  g.push();
  g.noStroke();
  g.fill(fillc);
  g.rect(x, y, w, h);
  // 尖角
  g.beginShape();
  if (side === 'me') {
    g.vertex(x + w, y + h - 14);
    g.vertex(x + w + 9, y + h - 4);
    g.vertex(x + w, y + h - 2);
  } else {
    g.vertex(x, y + h - 14);
    g.vertex(x - 9, y + h - 4);
    g.vertex(x, y + h - 2);
  }
  g.endShape(g.CLOSE);
  g.noFill();
  g.stroke(edge);
  g.strokeWeight(1.5);
  g.rect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  g.pop();
  label(g, txt, x + 14, y + 29, 16, C_INK);
}

// ---------------- 动图气泡 ----------------
function drawGifBubble(g, frame) {
  g.push();
  g.noStroke();
  g.fill(C_YOU);
  g.rect(318, 288, 404, 308);
  g.noFill();
  g.stroke('#a9bccd');
  g.strokeWeight(1.5);
  g.rect(318.75, 288.75, 402.5, 306.5);
  // 尖角
  g.noStroke();
  g.fill(C_YOU);
  g.beginShape();
  g.vertex(318, 582);
  g.vertex(309, 592);
  g.vertex(318, 594);
  g.endShape(g.CLOSE);
  g.pop();

  // 动图本体
  drawGif(g, frame);

  // 图片暗边（读作图片边框）
  g.push();
  g.noFill();
  g.stroke(C_DARK);
  g.strokeWeight(1.5);
  g.rect(GIFA.x - 0.75, GIFA.y - 0.75, GIFA.w + 1.5, GIFA.h + 1.5);
  g.pop();

  // 右下角点阵 "GIF" 角标
  drawGifBadge(g);

  label(g, '穿越瞬间.gif · 256 色', GIFA.x, 580, 13, C_INK2);
}

// ============================================================
// 动图：90×65 像素缓冲 → 4×4 Bayer 有序抖动 → 最近邻放大 4 倍
// ============================================================
function gifBuffer(g) {
  if (!gbuf) {
    gbuf = g.createGraphics(GW, GH);
    gbuf.pixelDensity(1);
  }
  return gbuf;
}

function fillRect(P, x, y, w, h, r, gg, b) {
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(GW, (x + w) | 0), y1 = Math.min(GH, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * GW + x0) * 4;
    for (let xx = x0; xx < x1; xx++) {
      P[i] = r; P[i + 1] = gg; P[i + 2] = b; P[i + 3] = 255;
      i += 4;
    }
  }
}

// 舱体（5 帧循环：进 → 中 → 出 → 回 → 中）
function capsuleRects(cx) {
  const R = [];
  const add = (dx, dy, w, h, c) => R.push([cx + dx, BY + dy, w, h, c]);
  add(-11, 0, 4, 1, P_JET);          // 悬浮喷口
  add(7, 0, 4, 1, P_JET);
  add(-13, -3, 26, 3, P_DARK);       // 宽底座
  add(-13, -3, 26, 1, P_TRIM);
  add(-11, -21, 22, 18, P_BODY);     // 机身（宽扁）
  add(4, -21, 7, 18, P_DARK);        // 右暗面
  add(-14, -23, 28, 2, P_DARK);      // 四坡短檐
  add(-11, -25, 22, 2, P_DARK);
  add(-7, -27, 14, 2, P_DARK);
  add(-14, -23, 28, 1, P_TRIM);
  add(-1, -31, 2, 4, P_TRIM);        // 吊杆
  add(-3, -36, 6, 5, P_LAMP);        // 六角灯笼（简化为方块）
  add(-2, -37, 4, 1, P_HI);
  for (let r = 0; r < 2; r++) {      // 3 列 × 2 行横窗
    for (let c = 0; c < 3; c++) add(-9 + c * 6, -19 + r * 6, 5, 5, P_GLASS);
  }
  add(0, -7, 1, 4, P_DARK);          // 门缝
  return R;
}

function drawCapsulePixels(P, cx, mode, dy) {
  const rects = capsuleRects(cx);
  const off = dy || 0;
  for (const [x, y, w, h, c] of rects) {
    const dim = mode === 'ghost' ? 0.58 : mode === 'scan' ? 0.8 : 1;
    const r = c[0] * dim, gg = c[1] * dim, b = c[2] * dim;
    for (let yy = y; yy < y + h; yy++) {
      if (mode === 'ghost' && yy % 2 === 1) continue;     // 隔行扫描 → 半透明幽灵
      if (mode === 'scan' && (yy + 1) % 3 === 2) continue; // 实体化中的缺行
      fillRect(P, x, yy + off, w, 1, r, gg, b);
    }
  }
}

function drawGif(g, frame) {
  const b = gifBuffer(g);
  b.loadPixels();
  const P = b.pixels;

  // 天空渐变（抖动的主要舞台）
  for (let y = 0; y < HORIZON; y++) {
    const u = y / (HORIZON - 1);
    fillRect(P, 0, y, GW, 1,
      lerp(46, 196, u), lerp(64, 144, u), lerp(106, 106, u));
  }
  // 地面
  for (let y = HORIZON; y < GH; y++) {
    const u = (y - HORIZON) / (GH - HORIZON - 1);
    fillRect(P, 0, y, GW, 1,
      lerp(88, 30, u), lerp(72, 28, u), lerp(58, 34, u));
  }
  // 星点
  for (const [sx, sy] of STARS) {
    fillRect(P, sx, sy, 1, 1, 236, 240, 250);
  }

  // 一条横线：时间公路的极简版（虚线按帧推进 → 读得出低帧数）
  fillRect(P, 0, ROAD_Y, GW, 2, 208, 202, 188);
  const shift = (frame * 3) % 16;
  for (let x = -16; x < GW; x += 16) {
    fillRect(P, x + shift, ROAD_Y, 8, 2, 250, 244, 222);
  }

  // 三个静止方块围观者
  for (const bs of BYSTANDERS) {
    fillRect(P, bs.x, 45, 3, 6, bs.c[0], bs.c[1], bs.c[2]);
    fillRect(P, bs.x, 45, 3, 1, bs.c[0] + 40, bs.c[1] + 40, bs.c[2] + 40);
  }

  // 舱体 5 帧：进 → 中 → 出 → 回 → 中（第 5 帧带 1 格起伏，和第一帧的中区分开）
  const FX = [18, 44, 70, 28, 44];
  const FM = ['scan', 'solid', 'ghost', 'scan', 'solid'];
  drawCapsulePixels(P, FX[frame], FM[frame], frame === 4 ? -1 : 0);

  // 4×4 Bayer 有序抖动 + 6 级通道量化（256 色）
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = (y * GW + x) * 4;
      const th = BAYER[(y % 4) * 4 + (x % 4)] / 16;
      for (let k = 0; k < 3; k++) {
        const v = P[i + k];
        const q = Math.min(5, Math.floor(v / 51 + th));
        P[i + k] = q * 51;
      }
      P[i + 3] = 255;
    }
  }
  b.updatePixels();

  const ctx = g.drawingContext;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  g.image(b, GIFA.x, GIFA.y, GIFA.w, GIFA.h);
  ctx.restore();
}

// 点阵自绘 "GIF" 角标（不用 text()）
function drawGifBadge(g) {
  const G = ['111', '100', '101', '101', '111'];
  const I = ['111', '010', '010', '010', '111'];
  const F = ['111', '100', '111', '100', '100'];
  const bx = 668, by = 538;
  g.push();
  g.noStroke();
  g.fill(34, 51, 68, 165);
  g.rect(bx, by, 28, 16);
  g.fill(255, 255, 255, 240);
  const letters = [G, I, F];
  for (let l = 0; l < 3; l++) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (letters[l][r][c] === '1') {
          g.rect(bx + 4 + l * 8 + c * 2, by + 2 + r * 2, 2, 2);
        }
      }
    }
  }
  g.pop();
}

// ---------------- 底部输入区 ----------------
function drawInputArea(g, st) {
  // 输入框（内凹白底）
  g.push();
  g.noStroke();
  g.fill(C_WHITE);
  g.rect(INPUT.x, INPUT.y, INPUT.w, INPUT.h);
  sunken(g, INPUT.x, INPUT.y, INPUT.w, INPUT.h);
  g.pop();
  label(g, '这次是第 20 次了…', INPUT.x + 14, INPUT.y + 39, 18, C_INK);
  // 光标（8fps 闪）
  if (Math.floor(st.q * 8) % 2 === 0) {
    const tw = (() => { g.textFont(UI); g.textSize(18); return g.textWidth('这次是第 20 次了…'); })();
    g.push();
    g.noStroke();
    g.fill(C_INK);
    g.rect(INPUT.x + 16 + tw, INPUT.y + 20, 2, 22);
    g.pop();
  }

  // 发送 / 关闭
  pushButton(g, BTN_SEND, '发送', 15);
  pushButton(g, BTN_CLOSE, '关闭', 15);

  // 工具栏三个抽象图标按钮
  const tb = [
    { x: 100, y: 738, w: 32, h: 26, k: 0 },
    { x: 136, y: 738, w: 32, h: 26, k: 1 },
    { x: 172, y: 738, w: 32, h: 26, k: 2 },
  ];
  for (const b of tb) {
    g.push();
    g.noStroke();
    g.fill(C_SYS);
    g.rect(b.x, b.y, b.w, b.h);
    bevel(g, b.x, b.y, b.w, b.h, C_WHITE, C_DARK);
    g.noFill();
    g.stroke(C_INK);
    g.strokeWeight(1.5);
    if (b.k === 0) {                 // 三条横线
      g.line(b.x + 8, b.y + 8, b.x + b.w - 8, b.y + 8);
      g.line(b.x + 8, b.y + 13, b.x + b.w - 8, b.y + 13);
      g.line(b.x + 8, b.y + 18, b.x + b.w - 12, b.y + 18);
    } else if (b.k === 1) {          // 图片：方框 + 山形
      g.rect(b.x + 7, b.y + 6, b.w - 14, b.h - 12);
      g.line(b.x + 9, b.y + 18, b.x + 14, b.y + 11);
      g.line(b.x + 14, b.y + 11, b.x + b.w - 9, b.y + 18);
    } else {                         // 文件：折角
      g.beginShape();
      g.vertex(b.x + 7, b.y + 6);
      g.vertex(b.x + 18, b.y + 6);
      g.vertex(b.x + b.w - 7, b.y + 13);
      g.vertex(b.x + b.w - 7, b.y + 20);
      g.vertex(b.x + 7, b.y + 20);
      g.endShape(g.CLOSE);
    }
    g.pop();
  }
}

function pushButton(g, b, txt, size) {
  g.push();
  g.noStroke();
  g.fill(C_SYS);
  g.rect(b.x, b.y, b.w, b.h);
  bevel(g, b.x, b.y, b.w, b.h, C_WHITE, C_DARK);
  g.pop();
  g.textFont(UI);
  g.textSize(size);
  label(g, txt, b.x + b.w / 2, b.y + b.h / 2 + 6, size, C_INK, g.CENTER);
}

// ============================================================
// 本格不画窗口外的舱体 —— 它只存在于那张动图里
// ============================================================
export function drawVehicle(g, opts) {
  // 刻意留空：舱体只在动图内出现（见 drawGif / drawCapsulePixels）
}
