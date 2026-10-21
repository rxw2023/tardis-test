import puppeteer from 'puppeteer-core';

const times = process.argv.slice(2).map(Number);
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080 },
});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await p.goto('http://127.0.0.1:8846/index.html?still=1', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));

for (const t of times) {
  const t0 = Date.now();
  const out = await p.evaluate((tt) => {
    try { window.__seek(tt); return 'ok'; } catch (e) { return 'ERR ' + e.stack; }
  }, t);
  console.log('t=', t, out, Date.now() - t0, 'ms');
}
await b.close();
