// ============================================================
// beats.js — 全片唯一时间源
// 120 BPM，4/4 拍，一小节 = 2 秒
// Intro 2.5 小节(5s) + 20 版块 × 3 小节(6s) + Outro 6 小节(12s) = 137s ≈ 2:17
// ============================================================

export const BPM = 120;
export const BEAT = 60 / BPM;            // 0.5s
export const BAR = 4 * BEAT;             // 2s
export const TAU = Math.PI * 2;

export const INTRO_BARS = 2.5;
export const SCENE_BARS = 3;
export const OUTRO_BARS = 6;

export const INTRO_LEN = INTRO_BARS * BAR;   // 5
export const SCENE_LEN = SCENE_BARS * BAR;   // 6
export const OUTRO_LEN = OUTRO_BARS * BAR;   // 12

export const N_SCENES = 20;
export const SCENES_START = INTRO_LEN;                        // 5
export const OUTRO_START = SCENES_START + N_SCENES * SCENE_LEN; // 125
export const TOTAL = OUTRO_START + OUTRO_LEN;                 // 137

export function clamp01(x) { return Math.min(1, Math.max(0, x)); }

export function smooth(a, b, x) {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
}

// 全局时间 t → 当前区段
export function sectionOf(t) {
  if (t < SCENES_START) {
    return { id: 'intro', local: t };
  }
  if (t < OUTRO_START) {
    const raw = t - SCENES_START;
    const index = Math.floor(raw / SCENE_LEN);
    const local = raw - index * SCENE_LEN;
    return {
      id: 'scene',
      index,
      local,                                   // 版块内局部时间 0..6
      bar: Math.floor(local / BAR),            // 0,1,2
      beat: Math.floor(local / BEAT) % 4,      // 0..3
      beatPhase: (local % BEAT) / BEAT,        // 拍内相位 0..1
    };
  }
  return { id: 'outro', local: t - OUTRO_START };
}

// 所有"过画框"的时刻（强拍）
export function crossings() {
  const cs = [];
  for (let i = 0; i <= N_SCENES; i++) cs.push(SCENES_START + i * SCENE_LEN);
  return cs; // 5, 11, 17 ... 125
}

// 距最近一次过框的时间距离（秒，绝对值）
export function nearestCrossingDist(t) {
  const raw = t - SCENES_START;
  const m = ((raw % SCENE_LEN) + SCENE_LEN) % SCENE_LEN;
  return Math.min(m, SCENE_LEN - m);
}

// 时间漩涡：一圈 = 两拍
export function swirlAngle(t) {
  return (t / (2 * BEAT)) * TAU;
}

// 版块内时间 → 路线进度 u（0=左画框，1=右画框）
// 第 1 小节进场，第 2 小节减速高光，第 3 小节驶出
export function routeU(local) {
  if (local < BAR) return 0.02 + 0.40 * smooth(0, BAR, local);
  if (local < 2 * BAR) return 0.42 + 0.08 * smooth(0, BAR, local - BAR);
  return 0.50 + 0.52 * smooth(0, BAR, local - 2 * BAR);
}

// 悬浮起伏（周期 = 两拍）+ 强拍后的轻微下落
export function hoverY(local) {
  const ph = (local / (2 * BEAT)) % 1;
  const bob = -10 * Math.sin(ph * TAU);
  const dip = -14 * Math.exp(-Math.pow((local % BAR) / 0.18, 2));
  return bob + dip;
}

// 秒 → mm:ss
export function fmt(t) {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
