import puppeteer from 'puppeteer-core';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080 },
});
const p = await b.newPage();
await p.goto('http://127.0.0.1:8846/index.html?still=1', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 700));
await p.evaluate((t) => window.__seek(t), Number(process.argv[2] || 115.5));

const out = await p.evaluate(() => {
  const c = document.querySelector('#stage canvas');
  const ctx = c.getContext('2d');
  const pts = [
    ['左内 路', 528, 961], ['中 路', 960, 961], ['右内 路', 1392, 961],
    ['左内 天', 528, 324], ['右内 天', 1392, 324],
    ['square左缘', 425, 324], ['phone左', 660, 324], ['phone右', 1260, 324],
  ];
  return pts.map(([n, x, y]) => {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return `${n} (${x},${y}) = rgb(${d[0]},${d[1]},${d[2]})`;
  }).join('\n');
});
console.log(out);
await b.close();
