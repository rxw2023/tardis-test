// ============================================================
// render-audio.js — 用无头 Chrome 跑 OfflineAudioContext，导出 WAV
// 用法：
//   node tools/render-audio.js                      整片 -> audio/film.wav
//   node tools/render-audio.js --scene 19           单版块 -> audio/scene19.wav
//   node tools/render-audio.js --out audio/x.wav --sr 48000
//   node tools/render-audio.js --port 8851          指定临时端口
// ============================================================

import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { startServer } from './serve.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
  return {
    scene: get('scene', ''),
    out: get('out', ''),
    sr: parseInt(get('sr', '48000'), 10),
    port: parseInt(get('port', String(8850 + Math.floor(Math.random() * 60))), 10),
  };
}

function wavHeader(dataBytes, sampleRate, channels, bits = 16) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);                                  // PCM
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * channels * bits / 8, 28);    // byte rate
  b.writeUInt16LE(channels * bits / 8, 32);                 // block align
  b.writeUInt16LE(bits, 34);
  b.write('data', 36);
  b.writeUInt32LE(dataBytes, 40);
  return b;
}

const { scene, out, sr, port } = parseArgs();
const outFile = resolve(out || (scene ? `audio/scene${String(scene).padStart(2, '0')}.wav` : 'audio/film.wav'));
await mkdir(dirname(outFile), { recursive: true });

// 端口被别的进程占用时自动往后找一个（多个子代理并行渲染时会遇到）
let server = null, usedPort = port;
for (let k = 0; k < 40 && !server; k++) {
  try { server = await startServer(usedPort); } catch { usedPort++; }
}
if (!server) throw new Error('no free port');
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // 整片 137s 的 OfflineAudioContext 渲染要 3 分钟以上，默认 180s 协议超时会直接崩
  protocolTimeout: 900000,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/audio.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('typeof window.__render === "object"');

  const t0 = Date.now();
  const dur = scene
    ? await page.evaluate((i, s) => window.__render.scene(i - 1, s), parseInt(scene, 10), sr)
    : await page.evaluate((s) => window.__render.film(s), sr);
  console.log(`rendered ${dur.toFixed(2)}s in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const info = await page.evaluate(() => window.__prepareWav());
  if (!info) throw new Error('no buffer');
  console.log(`pcm ${info.n} frames / ${info.ch}ch / ${(info.bytes / 1048576).toFixed(1)} MB`);

  const CHUNK = 1 << 20;
  const parts = [];
  for (let off = 0; off < info.bytes; off += CHUNK) {
    const len = Math.min(CHUNK, info.bytes - off);
    const b64 = await page.evaluate((s, l) => window.__chunkB64(s, l), off, len);
    parts.push(Buffer.from(b64, 'base64'));
    if (parts.length % 8 === 0) process.stdout.write(`  ${(off / 1048576).toFixed(0)}MB\r`);
  }
  const pcm = Buffer.concat(parts);
  await writeFile(outFile, Buffer.concat([wavHeader(pcm.length, info.sampleRate, info.ch), pcm]));
  console.log(`\nwrote ${outFile} (${(pcm.length / 1048576).toFixed(2)} MB PCM)`);
} finally {
  await browser.close();
  server.close();
}
