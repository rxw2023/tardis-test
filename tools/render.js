// ============================================================
// render.js — Puppeteer 逐帧导出
// 用法：node tools/render.js --from 5 --to 11 --fps 30 --out frames/x
// 依赖：puppeteer-core + 本机 Chrome（CHROME_PATH 可覆盖路径）
// ============================================================

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k, d) => {
    const i = a.indexOf('--' + k);
    return i >= 0 ? a[i + 1] : d;
  };
  return {
    from: parseFloat(get('from', '0')),
    to: parseFloat(get('to', '137')),
    fps: parseInt(get('fps', '30')),
    out: get('out', 'frames/run'),
    url: get('url', 'http://127.0.0.1:8846/index.html?still=1'),
    times: get('times', ''),   // 逗号分隔的时间点：--times 5.5,7.2,8.2
    scene: get('scene', ''),   // 版块序号 1..20：把 --times 当成版块内局部时间 0..6
    // 帧号补零位数。分段并行时必须显式传全局位数，否则各段按自己的终点
    // 算位数（段 0 只有个位），ffmpeg image2 会认不全。
    digits: parseInt(get('digits', '0'), 10),
  };
}

const { from, to, fps, out, url, times, scene, digits: digitsArg } = parseArgs();
// --scene N（1..20）：把 --times 的局部时间换算成全局时间（版块 i 起点 = 5 + 6*i）
const SCENE_BASE = scene === '' ? 0 : 5 + 6 * (parseInt(scene, 10) - 1);
const outDir = resolve(out);
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    // 并行渲染时一台机器上会同时跑 N 个 Chrome，下面的参数用来压掉
    // 各自为政的后台开销（共享内存 / 后台节流 / 插件），避免抢资源。
    '--disable-dev-shm-usage',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
// networkidle0 在并发场景下容易等不到（任一请求挂住就一直等），
// 改成 domcontentloaded + 显式等 p5 setup 暴露 __seek。
page.setDefaultNavigationTimeout(180000);
page.setDefaultTimeout(180000);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('typeof window.__seek === "function"');

const canvas = await page.$('#stage canvas');

// 模式 A：指定时间点
if (times) {
  const list = times.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  let i = 0;
  for (const tt of list) {
    const t = tt + SCENE_BASE;
    await page.evaluate((x) => window.__seek(x), t);
    await page.waitForFunction('window.__FRAME_READY === true');
    const name = SCENE_BASE
      ? `shot_${String(i).padStart(2, '0')}_L${tt.toFixed(2)}.png`
      : `shot_${String(i).padStart(2, '0')}_t${t.toFixed(2)}.png`;
    await canvas.screenshot({ path: `${outDir}/${name}` });
    console.log(`  ${name}`);
    i++;
  }
  await browser.close();
  console.log(`done: ${i} stills -> ${outDir}`);
  process.exit(0);
}

// 模式 B：逐帧区间
const n0 = Math.round(from * fps);
const n1 = Math.round(to * fps);
const digits = digitsArg > 0 ? digitsArg : String(n1).length;
let count = 0;
for (let n = n0; n < n1; n++) {
  const t = n / fps;
  await page.evaluate((tt) => window.__seek(tt), t);
  await page.waitForFunction('window.__FRAME_READY === true');
  const name = `frame_${String(n).padStart(digits, '0')}.png`;
  await canvas.screenshot({ path: `${outDir}/${name}` });
  count++;
  if (count % 30 === 0) console.log(`  ${count} frames ... (t=${t.toFixed(2)}s)`);
}

await browser.close();
console.log(`done: ${count} frames -> ${outDir} (${from}s~${to}s @ ${fps}fps)`);
