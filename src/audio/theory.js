// ============================================================
// theory.js — 音高 / 音阶 / 和声
// 全片固定在 A 小调骨架上：主题以「相对 A4 的半音数」存储，
// 每个版块可换一套音阶做「就近映射」，于是同一条旋律在不同
// 时代听感不同，但轮廓仍然是同一条。
// ============================================================

export const ROOT_MIDI = 69; // A4

// midi → Hz
export function mtof(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// 半音数（相对主题主音）→ Hz
export function stof(semis, octave = 0) {
  return mtof(ROOT_MIDI + semis + octave * 12);
}

// ------------------------------------------------------------
// 音阶库：INSTEP 为「自然小调」参照，元素为相对主音的半音
// ------------------------------------------------------------
export const SCALES = {
  minor:        [0, 2, 3, 5, 7, 8, 10],   // 默认（A 自然小调）
  dorian:       [0, 2, 3, 5, 7, 9, 10],
  harmonic:     [0, 2, 3, 5, 7, 8, 11],
  majorPent:    [0, 2, 4, 7, 9],          // 五声宫调（中国/凯尔特/民谣）
  minorPent:    [0, 3, 5, 7, 10],         // 五声羽调
  hijaz:        [0, 1, 4, 5, 7, 8, 10],   // 中东 / 埃及
  inScale:      [0, 1, 5, 7, 8],          // 日本都节
  bhairav:      [0, 1, 4, 5, 7, 8, 11],   // 印度（莫卧儿）
  lydian:       [0, 2, 4, 6, 7, 9, 11],   // 印象派 / 漂浮
  wholeTone:    [0, 2, 4, 6, 8, 10],      // 全音阶（表现主义 / 呐喊）
  blues:        [0, 3, 5, 6, 7, 10],
  chromatic:    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  slendro:      [0, 2, 5, 7, 9],          // 甘美兰五声（近似）
  pelog:        [0, 1, 3, 7, 8],          // 甘美兰七声取五（爪哇皮影）
  mixolydian:   [0, 2, 3, 5, 7, 9, 10],
};

// 把「自然小调半音」吸附到目标音阶上（就近取音，保持旋律轮廓）
// scale 为 null / 'minor' 时原样返回
export function snapToScale(semis, scaleName) {
  if (!scaleName || scaleName === 'minor') return semis;
  const sc = SCALES[scaleName] || SCALES.minor;
  const oct = Math.floor(semis / 12);
  let r = ((semis % 12) + 12) % 12;
  let best = sc[0], bestD = 99;
  for (const s of sc) {
    const d = Math.abs(s - r);
    // 距离相同取上方音（更明亮），但 11→12 这种要允许进位
    if (d < bestD || (d === bestD && s > best)) { bestD = d; best = s; }
  }
  return oct * 12 + best;
}

// 主题半音 + 音阶 → 频率
export function themeFreq(semis, scaleName, octave = 0) {
  return stof(snapToScale(semis, scaleName), octave);
}

// ------------------------------------------------------------
// 和弦：以根音半音（相对 A）+ 品质表示
// ------------------------------------------------------------
export const CHORD_SHAPES = {
  m:      [0, 3, 7],
  M:      [0, 4, 7],
  m7:     [0, 3, 7, 10],
  M7:     [0, 4, 7, 11],
  dom7:   [0, 4, 7, 10],
  sus4:   [0, 5, 7],
  sus2:   [0, 2, 7],
  dim:    [0, 3, 6],
  aug:    [0, 4, 8],
  fifth:  [0, 7],          // 纯五度（只有根+五，适合鼓风/中世纪）
  fourth: [0, 5],          // 纯四度（甘美兰/中世纪）
  power:  [0, 7, 12],
};

export function chordTones(rootSemis, quality, scaleName) {
  const shape = CHORD_SHAPES[quality] || CHORD_SHAPES.m;
  return shape.map((i) => snapToScale(rootSemis + i, scaleName === undefined ? 'minor' : scaleName));
}

// 拍 / 小节 → 秒（120BPM：一拍 0.5s，一小节 2s）
export const BEAT_SEC = 0.5;
export const BAR_SEC = 2.0;

export function barBeatToSec(bar, beat = 0) {
  return bar * BAR_SEC + beat * BEAT_SEC;
}
