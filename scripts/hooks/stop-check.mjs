// Hook "Stop" của Claude Code: chặn agent kết thúc lượt khi typecheck hoặc test đang đỏ.
// Exit 2 + stderr → Claude Code yêu cầu agent sửa tiếp. Chạy được trên Windows/macOS/Linux.
import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    if (JSON.parse(input || '{}').stop_hook_active) process.exit(0); // tránh lặp vô hạn
  } catch { /* bỏ qua */ }
  for (const script of ['typecheck', 'test']) {
    const r = spawnSync('npm', ['run', '--silent', script], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status !== 0) {
      process.stderr.write(`npm run ${script} đang ĐỎ — chưa được kết thúc. Sửa lỗi rồi chạy lại.\n${(r.stdout + r.stderr).slice(-3000)}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
