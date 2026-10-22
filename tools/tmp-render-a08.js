// 临时：渲染第 8 格（a08-mughal）到 WAV，绕过尚未自动生成的 index.js 注册表
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { startServer } from './serve.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outFile = resolve('audio/scene08.wav');
await mkdir(dirname(outFile), { recursive: true });

let server = null, usedPort = 8930;
for (let k = 0; k < 40 && !server; k++) {
  try { server = await startServer(usedPort); } catch { usedPort++; }
}
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${usedPort}/tmp-a08.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true');
  const dur = await page.evaluate(() => window.__render.scene(7, 48000));
  console.log(`rendered ${dur.toFixed(2)}s`);
  const info = await page.evaluate(() => window.__prepareWav());
  const parts = [];
  const CHUNK = 1 << 20;
  for (let off = 0; off < info.bytes; off += CHUNK) {
    const len = Math.min(CHUNK, info.bytes - off);
    parts.push(Buffer.from(await page.evaluate((s, l) => window.__chunkB64(s, l), off, len), 'base64'));
  }
  const pcm = Buffer.concat(parts);
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(info.ch, 22);
  b.writeUInt32LE(info.sampleRate, 24);
  b.writeUInt32LE(info.sampleRate * info.ch * 2, 28);
  b.writeUInt16LE(info.ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(pcm.length, 40);
  await writeFile(outFile, Buffer.concat([b, pcm]));
  console.log(`wrote ${outFile}`);
} finally { await browser.close(); server.close(); }
