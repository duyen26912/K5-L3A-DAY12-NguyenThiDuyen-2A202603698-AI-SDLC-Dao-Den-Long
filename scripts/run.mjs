#!/usr/bin/env node
// run_cmd của Test Contract: chạy bản web đã build (dist/) bằng server Node nhỏ và mở trình duyệt.
//   node scripts/run.mjs                               → chơi game (http://localhost:4173)
//   node scripts/run.mjs --export-leaderboard out.json → xuất bảng xếp hạng {"entries": [...]} rồi thoát
//   node scripts/run.mjs --no-open --port 5000         → không tự mở trình duyệt / đổi cổng
// Cần chạy `npm run build` trước (tạo dist/ và dist-headless/leaderboard.mjs).
import { spawn } from 'node:child_process';
import { loadStore, startServer } from './static-server.mjs';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const store = await loadStore();

const exportPath = opt('export-leaderboard');
if (exportPath) {
  store.exportTo(exportPath);
  console.log(`Đã xuất bảng xếp hạng ra ${exportPath} (nguồn: ${store.dataFile()})`);
  process.exit(0);
}

const { url } = await startServer(store, Number(opt('port') ?? process.env.PORT ?? 4173));
console.log(`Đảo Đèn Lồng đang chạy tại ${url} (Ctrl+C để dừng). Bảng xếp hạng lưu ở ${store.dataFile()}`);
if (!argv.includes('--no-open')) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* tự mở link */ }
}
