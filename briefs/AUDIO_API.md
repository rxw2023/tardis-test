# 音频版块开发契约（阶段 4 · 音乐）

全片 **137 秒 / 120BPM / 4/4**，一小节 2 秒。时间轴唯一来源是 `src/beat/beats.js`。
主旋律只有一条（12 小节，A 小调骨架），由 `src/audio/engine.js` 统一喂给每个版块；
**版块只决定「用什么乐器、什么节奏」来演奏它**，不允许自己写另一条旋律。

## 1. 一个版块模块长什么样

新建 `src/audio/sections/aNN-名字.js`，默认导出一个对象：

```js
import S, { prand } from '../synth.js';

export default {
  gain: 1.0,        // 整体音量系数（可选）
  legato: 0.9,      // 主题时值系数：<1 更短促，>1 更连（可选）
  bassLen: 0.9,     // 低音时值系数（可选）
  chordOct: -1,     // 和声八度（相对 A4，默认 -1 → A3 一带）

  // 主旋律：每个音符调用一次（必做）
  lead(ctx, io, t, freq, dur, vel, bar, semis) { ... },

  // 低音：每小节一次，freq 已是最终频率（默认低两个八度）
  bass(ctx, io, t, freq, dur, vel) { ... },

  // 和声：每小节一次，freqs 是和弦音数组
  chord(ctx, io, t, freqs, dur, vel) { ... },

  // 打击：每小节一次，t 是该小节起点，bar = 0/1/2
  perc(ctx, io, t, bar, vel, info) { ... },   // info.root = 该小节根音频率

  // 版块特色（环境音、UI 音效、特色装饰），整段只调用一次
  flavor(ctx, io, t0, index) { ... },
};
```

- `ctx`：`OfflineAudioContext`
- `io.out`：**唯一的声音入口**（干声）。空间感由 `src/audio/sections/index.js` 里的 `PRESET[i].sends` 统一配置，不要在版块里自己做混响。
- `t`：该事件在 ctx 时间轴上的**绝对秒**。
- `bar` 0/1/2 分别对应「进场 / 高光 / 驶出」，请让三小节有层次（`vel` 已经带了这个包络，但节奏密度也要变化）。

音阶、八度、混响发送量已在 `index.js` 的 `PRESET` 中按版块配好（例如第 11 格浮世绘用日本都节音阶）。
**不要**在版块里 import 并改写 PRESET。

## 2. synth.js 原语（全部程序合成，禁止采样）

```js
S.tone(ctx, dest, t, { freq, dur, type:'sine|triangle|sawtooth|square', gain, a,d,s,r,
                       filter:{type,freq,q}, detune, vib:{rate,depth}, glideFrom, slideTo })
S.noise(ctx, dest, t, { dur, gain, filter:{type,freq,q}, sweepTo, a, curve })
S.pluck(ctx, dest, t, { freq, dur, gain, partials, bright, damp, bend, noiseAtk, body })  // 古琴/琵琶/三味线/竖琴
S.fm(ctx, dest, t, { freq, dur, gain, ratio, index, decay, bright })                       // 钟/锣/甘美兰/铃
S.reed(ctx, dest, t, { freq, dur, gain, wave, breath, bite, a,s,r, vib })                  // 笛/箫/埙/尺八/管乐
S.bow(ctx, dest, t, { freq, dur, gain, wave, bright, scratch, a,s,r, vib })                // 弦乐/管风琴
S.drum(ctx, dest, t, { kind, gain, dur, from, to, freq, body, bright })
//   kind: kick | snare | brush | hat | openhat | tom | clap | rim | click | shaker | woodblock | gong
S.blip(ctx, dest, t, { freq, dur, gain, wave:'square|sawtooth|triangle', duty })           // 8-bit / 电子
S.sub(ctx, dest, t, { freq, dur, gain, wave, bright })                                     // 低音
S.whoosh(ctx, dest, t, { dur, gain, up, from, to, q })                                     // 转场风声
S.env / S.decayEnv / S.gainNode / S.noiseBuffer / S.prand(seed)
```

`S.prand(seed)` 是确定性随机数（0..1）。**禁止使用 `Math.random()`**，否则每次渲染结果不同。

## 3. 自检流程（必须做，至少两轮）

```bash
# 1) 语法
node --check src/audio/sections/aNN-x.js

# 2) 渲染该版块（6 秒 + 前后留白）
node tools/render-audio.js --scene NN --out audio/sceneNN.wav

# 3) 有没有声音 / 有没有过响
node tools/audio-stats.js audio/sceneNN.wav 0.5
#    目标：peak 0.6~0.95，整段 rms 0.10~0.20，silent segs = 0

# 4) 主旋律音高对不对（最重要）
node tools/audio-spec.js audio/sceneNN.wav --at 0.55,1.05,1.55,2.05 --k 4
#    最强峰应当就是该版块音阶下的主题音；低八度/高八度的泛音不应压过基频
```

版块内时间 → wav 时间：`wav_t = 局部时间 + 0.4`（渲染时留了 0.4s 前置量，用于过框风声）。
主题每小节起点：局部 0.0 / 2.0 / 4.0 秒；每拍 0.5 秒。
**期望音高以 `src/audio/melody.js` 的 `THEME` 为准，注意 THEME 里的 bar 是 0 基索引**
（"第 9 小节"= 数组里的 bar 8）。

第 1 格（撒哈拉，`a01-sahara.js`）和第 19 格（竖屏，`a19-vertical.js`）是参考实现，照着写。

### 关于单版块自检的"尾巴静音"

单版块渲染长度 = 0.4s 前置 + 6s 版块 + 1.4s 尾巴。版块结束后尾巴本来就该安静，
`silent segs` 出现 1~2 是正常的。**不要为了让 silent segs 归零而把底噪铺到 6 秒之外**——
成片里 20 个版块首尾相接，溢出的声音会渗进下一格（每一格应该是独立的世界）。
判据：版块内（wav 0.4~6.4s）不能有静音段；6.4s 之后允许安静。
所有 `env()` 类包络的实际长度是 `dur + r`，排到版块末尾时要把 `r` 也算进去。

## 4. 红线

- 不准引入任何音频素材 / 采样 / 版权旋律，全部靠 `synth.js` 合成。
- 不准改 `beats.js`、`melody.js`、`theory.js`、`synth.js`、`engine.js`；只改自己的 `aNN-*.js`
  （确实需要新原语时，在 `synth.js` 里加，并在回报里说明）。
- 每个版块必须能让主旋律听清：不要用密度过高的织体把主题埋掉。
- 不要改动 `src/audio/sections/index.js` 的 PRESET，注册由主代理统一做。

## 5. 交付

改完自己的文件后，回复：版块名 / 用了哪些乐器与节奏型 / 两次自检的 stats 与 spec 关键数值 / 有无需要新增的原语。
