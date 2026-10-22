// ============================================================
// probe.js — 抓页面报错 + 单帧耗时
// 用法：
//   node tools/probe.js 5.5 8.2 20.0                    默认 index.html?still=1
//   node tools/probe.js --url http://127.0.0.1:8846/     只等 3s，报告报错与就绪状态
// ============================================================

import puppeteer from 'puppeteer-core';

const a = process.argv.slice(2);
const ui = a.indexOf('--url');
const url = ui >= 0 ? a[ui + 1] : 'http://127.0.0.1:8846/index.html?still=1';
const rest = a.filter((x, i) => i !== ui && i !== ui + 1);
const times = rest.map(Number).filter((n) => !isNaN(n));

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1920, height: 1080 },
});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) console.log('CONSOLE:', m.text()); });
await p.goto(url, { waitUntil: 'networkidle0' });

if (times.length === 0) {
  await new Promise((r) => setTimeout(r, 3000));
  const st = await p.evaluate(() => ({
    status: document.getElementById('audio-status')?.textContent || '',
    time: document.getElementById('time')?.textContent || '',
    seekable: typeof window.__seek === 'function',
  }));
  console.log('ready:', JSON.stringify(st));
} else {
  await p.waitForFunction('typeof window.__seek === "function"', { timeout: 10000 }).catch(() => {});
  for (const t of times) {
    const t0 = Date.now();
    const out = await p.evaluate((tt) => {
      try { window.__seek(tt); return 'ok'; } catch (e) { return 'ERR ' + e.stack; }
    }, t);
    console.log('t=', t, out, Date.now() - t0, 'ms');
  }
}
await b.close();
