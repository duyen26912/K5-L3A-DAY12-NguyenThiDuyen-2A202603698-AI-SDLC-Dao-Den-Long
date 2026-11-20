#!/usr/bin/env node
// bench_cmd (Ticket-04 mục 1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Mở Chromium cửa sổ 1280×720 (không toàn màn hình), tắt vsync + giới hạn khung hình, chạy cảnh benchmark chuẩn
// (dist/index.html?bench=1), đợi 3 s khởi động + đo đúng --duration giây, ghi bench.json rồi thoát mã 0.
// Trình duyệt: ưu tiên Chrome/Edge đã cài trên máy; không có thì tự tải Chromium của Playwright (lần đầu).
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { chromium } from 'playwright';
import { loadStore, startServer } from './static-server.mjs';

const processStart = Date.now() - process.uptime() * 1000; // lúc tiến trình bắt đầu
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const seed = Number(opt('seed', '42'));
const duration = Number(opt('duration', '30'));
const out = opt('out', 'bench.json');
if (!Number.isFinite(seed) || !(duration > 0)) {
  console.error('Cách dùng: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json');
  process.exit(2);
}

const ARGS = [
  '--window-size=1280,720', '--window-position=40,40',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // tắt vsync và giới hạn khung hình
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
];
const headless = process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY; // máy Linux không có màn hình

async function launch() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, headless, args: ARGS });
    } catch { /* thử trình duyệt kế tiếp */ }
  }
  console.log('Không tìm thấy Chrome/Edge — tải Chromium của Playwright (chỉ lần đầu)…');
  spawnSync(process.execPath, [new URL('../node_modules/playwright/cli.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), 'install', 'chromium'], { stdio: 'inherit' });
  return chromium.launch({ headless, args: ARGS });
}

const store = await loadStore();
const { server, url } = await startServer(store, 0);
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`${url}?bench=1&seed=${seed}&duration=${duration}`);
  await page.waitForFunction(() => window.__benchResult, null, { timeout: (duration + 60) * 1000, polling: 500 });
  const r = await page.evaluate(() => ({ ...window.__benchResult, firstFrame: window.__benchFirstFrame }));
  const result = {
    contract_version: '1.3',
    avg_fps: r.avg_fps,
    p1_low_fps: r.p1_low_fps,
    frame_ms_p95: r.frame_ms_p95,
    frames: r.frames,
    load_ms: Math.round(r.firstFrame - processStart),
    // Bản web: RSS của tiến trình trình duyệt không đo được từ trang → null (xem README). Tham khảo: JS heap đỉnh của trang.
    peak_mem_mb: null,
    js_heap_peak_mb: r.js_heap_peak_mb,
    vsync_off: true,
    renderer: `${r.renderer}; ${browser.browserType().name()} ${browser.version()}${headless ? ' (headless)' : ''}`,
    os: `${os.type()} ${os.release()} ${os.arch()}; CPU ${os.cpus()[0]?.model ?? '?'}; RAM ${Math.round(os.totalmem() / 1073741824)} GB`,
    scene: { seed, duration_s: duration, warmup_s: 3, window: "1280x720", shades: r.shades, motes: r.motes },
    slowest_ms: r.slowest_ms,
  };
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  server.close();
}
process.exit(0);
