import { defineConfig } from 'vite';

// base './' để thư mục dist/ chạy được khi đặt ở bất kỳ đường dẫn nào (bản web tĩnh cho Release).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
