// ============================================================
// cover.js — 渲染视频封面并导出 PNG
// 用法：node tools/cover.js [--out out/cover.png] [--w 1920] [--h 1080]
// ============================================================

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const CHROME =
  process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const out = resolve(get('out', 'out/cover.png'));
const W = parseInt(get('w', '1920'), 10);
const H = parseInt(get('h', '1080'), 10);
const port = parseInt(get('port', '8851'), 10);

await mkdir(dirname(out), { recursive: true });

const server = await startServer(port);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [page error]', m.text());
  });
  page.on('pageerror', (e) => console.log('  [page throw]', e.message));
  page.setDefaultTimeout(120000);
  await page.goto(`http://127.0.0.1:${port}/cover.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__FRAME_READY === true');
  await new Promise((r) => setTimeout(r, 600)); // 等字体与 p5.brush 落定
  const canvas = await page.$('#stage canvas');
  await canvas.screenshot({ path: out });
  console.log(`cover -> ${out}`);
} finally {
  await browser.close();
  server.close();
}
