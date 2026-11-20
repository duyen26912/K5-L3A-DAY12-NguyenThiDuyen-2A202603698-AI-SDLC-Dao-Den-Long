import { defineConfig, type Plugin } from 'vite';
import { handleApi } from './src/leaderboard-store';

// API bảng xếp hạng cho `npm run dev` (giống server của scripts/run.mjs): lưu ra đĩa cục bộ.
const leaderboardApi = (): Plugin => ({
  name: 'leaderboard-api',
  configureServer(server) {
    server.middlewares.use('/api/leaderboard', (req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const r = handleApi(req.method ?? 'GET', body);
        res.statusCode = r.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(r.json));
      });
    });
  },
});

// base './' để thư mục dist/ chạy được khi đặt ở bất kỳ đường dẫn nào (bản web tĩnh cho Release).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [leaderboardApi()],
});
