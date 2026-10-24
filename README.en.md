# TARDIS Test · 《塔迪斯测试》

[简体中文](README.md) · **English**

> A 137-second code-animated short. An original time capsule drives along a single roadway that runs through the whole film, passing through 20 sections of era, region and art style. Every frame crossing switches the visual language. 120 BPM, one bar is 2 seconds, and every crossing lands on the downbeat.

![All 20 sections](docs/img/cover.jpg)

**No image assets. No audio samples. No AI-generated pictures.**
All 8,220 frames and the entire score are computed by code, then muxed with ffmpeg. Total runtime npm dependencies: one.

| Metric | Value |
|---|---|
| Duration | 137s (60 bars) @ 120 BPM |
| Frames | 8,220 @ 60fps |
| Sections | 20, 3 bars / 6 seconds each |
| Source | 61 files / 22,398 lines |
| Tooling | 14 files / 964 lines |
| Runtime deps | `puppeteer-core` (the only one) |

Watch: [`out/film-60fps.mp4`](out/film-60fps.mp4) (60 MB · 1920×1080 · 60fps · with full audio)

## Stack

| Layer | What is actually used | npm package? |
|---|---|---|
| Drawing | p5.js 2.0.3 (Canvas 2D renderer) + p5.brush, vendored in `public/vendor/` and loaded with a plain `<script>` tag | No |
| Frame capture | puppeteer-core ^24.43.1 driving the local Chrome install | Yes, the only one |
| Audio | Native Web Audio API, rendered offline in an `OfflineAudioContext` | No |
| Encoding | System `ffmpeg` binary, spawned from Node | No |
| Serving | Hand-written static server, `tools/serve.js` | No |

No Remotion, no Three.js, no WebGL, no PixiJS, no GSAP, no React, no bundler, no ffmpeg npm wrapper.

## A one-way pipeline

Visual branch:

```
src/scenes/sNN-*.js       one pure render function per scene: render(g, meta, local)
  ↓  src/main/main.js     renderFrame(g, t) — give it a time, it gives you pixels
  ↓  index.html?still=1   noLoop(); renderFrame exposed as window.__seek(t)
  ↓  tools/render.js      Puppeteer loop: __seek → wait __FRAME_READY → canvas.screenshot
  ↓  frames/film60/       frame_0000.png … frame_8219.png
```

Audio branch:

```
src/audio/engine.js       one melody, fed to 20 different "instrument skins"
  ↓  OfflineAudioContext  whole 137s score rendered offline in headless Chrome (~3 min)
  ↓  tools/render-audio.js  PCM streamed back in 1MB base64 chunks, 44-byte RIFF header hand-written
  ↓  audio/film.wav       48kHz / 16bit
```

Mux:

```bash
npm run audio                 # -> audio/film.wav
npm run render -- --fps 60    # -> frames/film60/*.png
npm run mux -- --frames frames/film60 --fps 60 --audio audio/film.wav --out out/film.mp4
npm run film                  # all three in one shot
```

`tools/render-parallel.js` splits the timeline into 12 segments and runs 12 Chrome instances concurrently, staggered 2.5s apart so they don't all boot in the same second. A full 60fps render takes about an hour.

## The picture

Each section draws inside a 1000×1000 unit space, mapped onto the central 1080×1080 square with a 420px margin on each side. The road, the door frames and the title card are drawn by the main scheduler; a scene only owns what sits above the ground.

<table>
<tr>
<td width="33%"><img src="docs/img/01-sahara.jpg" alt="Sahara rock art"><br><sub><b>Sahara Rock Art</b> c. 4000 BC<br>Ochre wall and pictograph strokes; the capsule is drawn in the same coarse line</sub></td>
<td width="33%"><img src="docs/img/02-egypt.jpg" alt="Egyptian tomb painting"><br><sub><b>Egyptian Tomb Painting</b> c. 1300 BC<br>Frontalism, mineral colour blocks and column divisions</sub></td>
<td width="33%"><img src="docs/img/03-hanrubbing.jpg" alt="Han stone rubbing"><br><sub><b>Han Stone Rubbing</b> c. 100 AD<br>Inverted ink-rubbing: white line on black, grain from a seeded PRNG</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/img/11-ukiyoe.jpg" alt="Ukiyo-e"><br><sub><b>Ukiyo-e</b> 1830s<br>Prussian blue, rain lines and striped fields, a snow-capped peak beyond</sub></td>
<td width="33%"><img src="docs/img/12-starrynight.jpg" alt="The Starry Night"><br><sub><b>The Starry Night</b> 1889<br>Short swirling strokes; the capsule becomes a flat icon floating above them</sub></td>
<td width="33%"><img src="docs/img/16-8bit.jpg" alt="8-bit pixel game"><br><sub><b>8-bit Pixel Game</b> 1980s<br>Hard grid and a limited palette; the capsule becomes a tile sprite</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/img/18-vaporwave.jpg" alt="Vaporwave"><br><sub><b>Vaporwave</b> 2010s<br>Gradient sun, wireframe horizon and palms; the only tape-style section</sub></td>
<td width="33%"><img src="docs/img/20-codeaesthetic.jpg" alt="Code aesthetic"><br><sub><b>Code Aesthetic</b> 2020s<br>Monospace, syntax colour and terminal green — back to "this is all code"</sub></td>
<td width="33%"><img src="docs/img/06-qingming.jpg" alt="Along the River"><br><sub><b>Along the River</b> c. 1100<br>Pale silk-tone colour, handscroll-like horizontal spread</sub></td>
</tr>
</table>

## Detail

One skeleton, three completely different mark-making systems. These are **1:1 crops** of the 1080p frames. No scaling, no filters.

<table>
<tr>
<td width="33%"><img src="docs/img/detail-brush.jpg" alt="Brushwork detail"><br><sub><b>Brushwork</b><br>Each oil stroke is a short polygon with seeded jitter — not a texture map</sub></td>
<td width="33%"><img src="docs/img/detail-grain.jpg" alt="Grain detail"><br><sub><b>Grain</b><br>Rubbing grain comes from mulberry32, cached once as a small tiling noise image</sub></td>
<td width="33%"><img src="docs/img/detail-pixel.jpg" alt="Pixel grid detail"><br><sub><b>Pixel grid</b><br>The pixel section draws on a 5px grid with anti-aliasing fully off</sub></td>
</tr>
</table>

## Why not Remotion or Three.js

Remotion describes a timeline with React components, which brings React, a bundler, and a runtime that mounts and unmounts every frame. This project inverts that: each frame is a **pure function** `renderFrame(g, t)`. Time in, pixels out, no hidden state. That buys three kinds of decoupling:

1. Twenty sections can be built by twenty sub-agents in parallel, each owning exactly one file
2. Frame capture can be sharded into 12 parallel processes that share no state
3. Any bad frame reproduces with a single `--times 5.5` screenshot instead of a full render

## Three determinism rules

During frame export, **every frame is an independent process call**. Any hidden state turns into flicker, so these are hard rules:

1. Textures may only be built once at module scope with `g.createGraphics`. Rebuilding per frame makes export unusably slow
2. Randomness must come from a seeded `mulberry32`. `Math.random()` and `Date.now()` are banned
3. Every frame must be re-entrant: no counters accumulated inside `render`, no dependence on the previous frame

## Contract-driven: how the prompt is structured

There is no single big prompt. **The constraints live in the repo, and the file system acts as the prompt.** Four layers:

| Layer | File | What it pins down |
|---|---|---|
| Global spec | `src/beat/beats.js` (92 lines) | The single source of time. 137s, 120BPM, 6s per section, crossings on the downbeat |
| Technical contract | `briefs/API.md`, `briefs/AUDIO_API.md` | Function signatures, the 1000×1000 unit space, road band y 770..940, a list of known traps, copyright red lines |
| Per-section art brief | `briefs/NN-slug.md` ×17 | Fixed fields: style anchor, composition, brushwork, palette in exact hex, capsule form, the gag, downbeat action, forbidden elements |
| Delivery loop | `tools/probe.js` + `tools/render.js` | Six contact-sheet stills, look at them, iterate |

The isolation rule matters just as much: **a sub-agent may only create one `src/scenes/sNN-*.js`** and may not touch `index.js`, `kit/`, `rig/`, `beat/` or `meta.js`. If it thinks the shared kit is missing something, it reports it and the main agent adds it. That is what keeps twenty concurrent writers from colliding.

## Layout

```
src/beat/beats.js        timeline (single source): 120BPM, section switching, crossings, route progress
src/kit/                 shared drawing kit: grain / vignette / title card / sketch strokes, the road
src/rig/capsule.js       parametric time capsule (+ driver silhouette); pose driven by beats
src/scenes/meta.js       metadata and palette for the 20 sections
src/scenes/sNN-*.js      20 sections + intro + outro
src/main/main.js         main scheduler: camera / margins / door frames / title cards / preview UI

src/audio/theory.js      scale library and variant mapping (same melody, different scale = different era)
src/audio/melody.js      the film's only melody (12 bars, A minor skeleton) + harmony
src/audio/synth.js       Web Audio primitives (zero samples: pluck / FM / winds / bowed / drums / reverb)
src/audio/engine.js      bus + full arrangement: feeds one melody to every section's instrument
src/audio/sections/      20 "instrument skins" a01…a20 plus intro and outro

tools/serve.js           local static server (ES modules need http://)
tools/render.js          Puppeteer frame export
tools/render-parallel.js 12-way parallel frame capture
tools/render-audio.js    headless Chrome runs OfflineAudioContext → WAV
tools/mux.js             frame sequence + WAV → MP4
tools/cover.js           1920×1080 video cover
tools/probe.js           page errors + per-frame cost
briefs/                  art briefs and technical contracts
public/vendor/           p5.js 2.0.3 (LGPL-2.1), p5.brush (MIT)
```

## Quick start

```bash
npm install                       # installs puppeteer-core only
npm run serve                     # http://127.0.0.1:8846/ (space to play, ←/→ to jump 5s)
npm run render -- --from 5 --to 11 --fps 30 --out frames/run
npm run sheet -- frames/run       # contact sheet HTML
npm run cover                     # 1920×1080 cover -> out/cover.png
npm run film                      # audio + frames + MP4 in one shot (60fps, ~1 hour)
```

Just want to look at the picture, without installing anything:

```bash
python -m http.server 8846        # then open http://127.0.0.1:8846/
```

The capture scripts already point at `127.0.0.1:8846`, so this is equivalent to `npm run serve`.

> **All three HTML pages need http; double-clicking them will not work.** They are ES Module pages, and under `file://` the browser reports `origin 'null'` and refuses to load the modules (`Access to script ... has been blocked by CORS policy`). You get a blank page.

Single-frame debugging:

```bash
node --check src/scenes/sNN-slug.js                                  # syntax
node tools/probe.js 12.5                                             # page errors + per-frame cost
node tools/render.js --scene 12 --times 0.5,2.2,3.2,4.2,5.2,5.9 \
     --out frames/starrynight                                        # six stills
```

Audio can also be auditioned in the browser: start the server and open `/audio.html` to render the whole film or a single section.

## Timeline

| Segment | Length | Content |
|---|---|---|
| Intro | 2.5 bars = 5s | Paper texture, documentary subtitles, the capsule drives in |
| 20 sections | 3 bars = 6s each | Bar 1 arrival / bar 2 highlight / bar 3 crossing |
| Outro | 6 bars = 12s | Press conference, a 7×3 wall of frames pushing toward slot 21 |

137s total, 60 bars.

## Music

There is exactly **one** melody in the film (12 bars, A minor skeleton). Each of the 20 sections takes 3 bars, and five loops cover all 60 bars. A section only decides *which instrument and which scale* performs it:

1. The melody is stored as semitone offsets from the tonic and snapped to each era's scale (Egyptian Hijaz yields the augmented second, Japanese in-scale, gamelan pelog, whole-tone…). The contour never changes; the character always does
2. Everything is synthesised with Web Audio, zero samples: plucks by additive synthesis with per-partial decay, bells and gongs by non-integer-ratio FM, winds as triangle plus breath noise, and the reverb impulse response is computed at runtime
3. The crossing sound (21 times) is the rhythmic anchor of the whole film: wind + metallic pluck + low-end push
4. Section 18, vaporwave, is the only tape-style one: material is generated at 151.2 BPM and pitched up 4 semitones, then played back on the main timeline at `playbackRate 0.7937` to land back on 120 BPM and the home key. It slows into the frame, speeds out of it, repeats every note twice in bar 2 for a skip, then stacks a large reverb, a 4kHz low-pass, 0.5Hz wow and tape hiss

## p5.js 2.x traps

| Symptom | Workaround |
|---|---|
| `beginShape()` + `bezierVertex()` throws | Use standalone `g.bezier()`, or seed it with a `vertex()` first |
| `ctx.filter = 'blur()'` mixed with p5 shape calls makes the whole drawing vanish | Go all-ctx or all-p5, never both |
| A gradient set via `ctx.fillStyle` gets clobbered by `g.rect()` | Draw gradients with `ctx.beginPath(); ctx.rect(); ctx.fill()` |
| Chaining `line()` calls into a brush stroke looks like beads on a string | Fill a variable-width polygon instead, or use `inkStroke` in `src/kit/ink.js` |
| `p5.text` sizing is unreliable under the p5.brush patch | Draw text with native `ctx.fillText` |

One more: `protocolTimeout: 900000` in `render-audio.js` is not optional. A full-length `OfflineAudioContext` render needs over three minutes, and the default 180s protocol timeout kills it with an error that never mentions timeouts.

## Dependencies and licensing

The only runtime npm dependency is `puppeteer-core`. p5.js (LGPL-2.1) and p5.brush (MIT) ship vendored in the repo. ffmpeg is invoked externally and never bundled. See [NOTICE.md](NOTICE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This project's own code and the finished film are released under the **MIT License**; see [LICENSE](LICENSE). Third-party components keep their own terms and are not relicensed by this.

Every section references **public-domain** styles and works only. No recognisable composition is traced, and no real brand, logo or UI element appears; chat apps, short-video apps, games and editors all use fictional names and hand-drawn icons.

> "TARDIS" and *Doctor Who* are protected BBC IP. This film uses them only as an internal spark; the finished film features an original capsule and an original driver design, and reproduces no blue police box, no lamp-box lettering, no logo and no sound effects. The directory name is an internal codename.
