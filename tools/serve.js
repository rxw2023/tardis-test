// 极简静态服务器：node tools/serve.js [port]
// 用途：ES 模块无法在 file:// 下运行，预览与逐帧导出都走 http://127.0.0.1
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

export function startServer(port = 8846) {
  return new Promise((resolve, reject) => {
    const s = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (path === '/') path = '/index.html';
        const file = normalize(join(ROOT, path));
        if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('not found');
      }
    });
    s.on('error', reject);
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

// 直接运行时启动（作为模块被 import 时不启动）
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/tools/serve.js')) {
  const PORT = Number(process.argv[2]) || 8846;
  startServer(PORT).then(() => console.log(`preview: http://127.0.0.1:${PORT}/`));
}
