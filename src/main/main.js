// ============================================================
// main.js — 主调度：镜头 / 转场 / 边区 / 画框 / 时空舱路线 / 预览 UI
// 每个 t 只有一帧，renderFrame 是纯渲染函数（可被逐帧导出复用）
// ============================================================

import {
  TOTAL, SCENE_LEN, SCENES_START, N_SCENES,
  sectionOf, nearestCrossingDist, routeU, smooth, fmt, TAU,
} from '../beat/beats.js';
import { SCENES } from '../scenes/meta.js';
import { renderPlaceholder } from '../scenes/placeholder.js';
import { moduleFor } from '../scenes/index.js';
import { renderIntro } from '../scenes/intro.js';
import { renderOutro } from '../scenes/outro.js';
import { drawCapsule } from '../rig/capsule.js';
import { drawRoadUnit, drawRoadPixel } from '../kit/road.js';
import { grain, titleCard } from '../kit/kit.js';

// 画面几何：1920×1080，中央 1080×1080 为场景正方形，两侧各 420px 边区
const SQ = { x: 420, s: 1080 };           // 单位空间 0..1000 → 像素 [420,1500]
const UNIT = SQ.s / 1000;                 // 1.08
const RIDE_Y = 890;                       // 舱体贴地点（单位空间）
const ZH_SERIF = '"KaiTi","STKaiti","SimSun",serif';
const EN_SERIF = 'Georgia,"Times New Roman",serif';

// ------------------------------------------------------------
// 渲染一帧（任何 t）
// ------------------------------------------------------------
export function renderFrame(g, t) {
  g.push();
  g.noStroke();
  g.fill(12, 11, 14);
  g.rect(0, 0, g.width, g.height);

  // 镜头：过画框强拍上轻微推近
  const dist = nearestCrossingDist(t);
  const zoom = 1 + 0.05 * Math.exp(-Math.pow(dist / 0.35, 2));
  const cx = g.width / 2, cy = g.height / 2;
  g.translate(cx, cy);
  g.scale(zoom);
  g.translate(-cx, -cy);

  const sec = sectionOf(t);
  if (sec.id === 'intro') {
    renderIntro(g, sec.local);
  } else if (sec.id === 'outro') {
    renderOutro(g, sec.local);
  } else {
    renderSceneSection(g, sec, t);
  }

  g.pop();
}

// ------------------------------------------------------------
// 版块区段：边区 + 场景 + 公路 + 时空舱 + 画框 + 标题卡
// ------------------------------------------------------------
function renderSceneSection(g, sec, t) {
  const { index, local } = sec;
  const meta = SCENES[index];
  const dist = nearestCrossingDist(t); // 距最近一次过框的秒数

  // 1) 边区（左右 420px 的深色幕布 + 公路延伸段）
  drawMargins(g, t);

  // 2) 场景正方形（裁剪到 1000 单位空间）
  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(SQ.x, 0, SQ.s, SQ.s);
  g.drawingContext.clip();
  g.translate(SQ.x, 0);
  g.scale(UNIT, UNIT);          // 进入 1000×1000 单位空间

  const mod = moduleFor(index);

  // 版块内相机：可选的 camera(local) → { z, fx, fy }
  // 用于"镜头推近才找到那个小点"一类构图；舱体与公路共用同一变换，不会被落下
  if (mod && mod.camera) {
    const cam = mod.camera(local);
    if (cam && cam.z && cam.z !== 1) {
      const fx = cam.fx ?? 500, fy = cam.fy ?? 500;
      g.translate(fx, fy);
      g.scale(cam.z);
      g.translate(-fx, -fy);
    }
  }

  if (mod) mod.render(g, meta, local, index);
  else renderPlaceholder(g, meta, index, local);
  drawRoadUnit(g, t);

  // 时空舱：沿公路从左画框驶向右画框；版块可覆盖绘制（水墨/皮影/示教器等）
  const u = routeU(local);
  const x = u * 1000;
  const wave = local >= 2.0 && local < 4.0; // 第 2 小节高光：驾驶员挥手
  if (mod && mod.drawVehicle) {
    mod.drawVehicle(g, { x, y: RIDE_Y, local, t, wave });
  } else {
    drawCapsule(g, x, RIDE_Y, 1, {
      t,
      hoverLocal: local,
      driverPose: { t, wave },
    });
  }

  g.drawingContext.restore();
  g.pop();

  // 3) 画框（左右门柱，颜色随版块；过框瞬间发光）
  drawFrameJambs(g, meta, dist);

  // 4) 标题卡（右边区，出入各淡入淡出 0.5s）
  const alpha = smooth(0, 0.5, local) * (1 - smooth(SCENE_LEN - 0.5, SCENE_LEN, local));
  titleCard(g, meta, 1710, 720, alpha, ZH_SERIF, EN_SERIF);
}

// ------------------------------------------------------------
function drawMargins(g, t) {
  // 深色幕布
  g.noStroke();
  g.fill(18, 16, 20);
  g.rect(0, 0, SQ.x, g.height);
  g.rect(SQ.x + SQ.s, 0, SQ.x, g.height);
  // 微颗粒
  grain(g, 0, 0, SQ.x, g.height, 21, 14);
  grain(g, SQ.x + SQ.s, 0, SQ.x, g.height, 21, 14);
  // 公路延伸段
  drawRoadPixel(g, 0, SQ.x, t);
  drawRoadPixel(g, SQ.x + SQ.s, g.width, t);
}

// ------------------------------------------------------------
function drawFrameJambs(g, meta, dist) {
  const glow = Math.exp(-Math.pow(dist / 0.16, 2)); // 过框瞬间
  const n = parseInt(meta.accent.slice(1), 16);
  const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;

  g.push();
  g.noStroke();
  // 门柱本体
  g.fill(r, gg, b, 255);
  g.rect(SQ.x - 26, 0, 26, g.height);
  g.rect(SQ.x + SQ.s, 0, 26, g.height);
  // 过框发光
  if (glow > 0.02) {
    g.fill(255, 244, 200, 200 * glow);
    g.rect(SQ.x - 26, 0, 26, g.height);
    g.rect(SQ.x + SQ.s, 0, 26, g.height);
    g.fill(255, 244, 200, 120 * glow);
    g.rect(SQ.x - 44, 0, 18, g.height);
    g.rect(SQ.x + SQ.s + 26, 0, 18, g.height);
  }
  g.pop();
}

// ============================================================
// p5 实例 + 预览 UI
// ============================================================
const state = { t: 0, playing: false, loop: true };
let ui = {};

const sketch = (p) => {
  p.setup = () => {
    const c = p.createCanvas(1920, 1080);
    c.parent('stage');
    p.pixelDensity(1);
    p.noLoop();
    bindUI(p);
    // 逐帧导出模式：?still=1
    const q = new URLSearchParams(location.search);
    if (q.get('still') === '1') {
      document.documentElement.classList.add('still');
      window.__seek = (t) => {
        window.__FRAME_READY = false;
        state.t = t;
        renderFrame(p, t);
        window.__FRAME_READY = true;
      };
      window.__seek(0);
    } else {
      renderFrame(p, 0);
    }
  };

  p.draw = () => {
    if (state.playing) {
      state.t += p.deltaTime / 1000;
      if (state.t >= TOTAL) {
        if (state.loop) { state.t = 0; }
        else { state.t = TOTAL; setPlaying(false); }
      }
    }
    renderFrame(p, state.t);
    updateUI();
  };
};

function bindUI(p) {
  ui = {
    btn: document.getElementById('btn-play'),
    slider: document.getElementById('seek'),
    time: document.getElementById('time'),
    section: document.getElementById('section'),
    loop: document.getElementById('loop'),
  };
  ui.btn.addEventListener('click', () => setPlaying(!state.playing, p));
  ui.slider.addEventListener('input', () => {
    state.t = parseFloat(ui.slider.value);
    if (!state.playing) { renderFrame(p, state.t); updateUI(); }
  });
  ui.loop.addEventListener('change', () => { state.loop = ui.loop.checked; });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing, p); }
    if (e.code === 'ArrowRight') { state.t = Math.min(TOTAL, state.t + 5); if (!state.playing) { renderFrame(p, state.t); updateUI(); } }
    if (e.code === 'ArrowLeft') { state.t = Math.max(0, state.t - 5); if (!state.playing) { renderFrame(p, state.t); updateUI(); } }
  });
  updateUI();
}

function setPlaying(v, p) {
  state.playing = v;
  if (p) v ? p.loop() : p.noLoop();
  updateUI();
}

function updateUI() {
  if (!ui.btn) return;
  ui.btn.textContent = state.playing ? '⏸' : '▶';
  if (document.activeElement !== ui.slider) {
    ui.slider.value = state.t;
  }
  ui.slider.max = TOTAL;
  ui.time.textContent = `${fmt(state.t)} / ${fmt(TOTAL)}`;
  const sec = sectionOf(state.t);
  if (sec.id === 'intro') ui.section.textContent = '片头 · 一本正经地胡说';
  else if (sec.id === 'outro') ui.section.textContent = '片尾 · 新闻发布会';
  else ui.section.textContent = `第 ${sec.index + 1} 版块 · ${SCENES[sec.index].zh}（${SCENES[sec.index].era}）`;
}

new p5(sketch);
