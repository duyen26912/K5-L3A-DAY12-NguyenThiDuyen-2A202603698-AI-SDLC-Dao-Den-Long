// Server tĩnh nhỏ cho thư mục dist/ + API bảng xếp hạng. Dùng chung cho scripts/run.mjs và scripts/bench.mjs.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export async function loadStore() {
  try {
    return await import(new URL('../dist-headless/leaderboard.mjs', import.meta.url));
  } catch {
    console.error('Thiếu dist-headless/leaderboard.mjs — hãy chạy `npm run build` trước.');
    process.exit(1);
  }
}

/** Khởi động server; trả về { server, url }. port = 0 → chọn cổng trống. */
export function startServer(store, port) {
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('Chưa có dist/ — hãy chạy `npm run build` trước.');
    process.exit(1);
  }
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/leaderboard') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        const r = store.handleApi(req.method ?? 'GET', body);
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r.json));
      });
      return;
    }
    let file = normalize(join(dist, decodeURIComponent(url.pathname)));
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://localhost:${server.address().port}/` }));
  });
}
