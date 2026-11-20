# Credits

- **Nhân vật, bối cảnh, tên gọi** (Mây, Đèn Lồng Lớn, Bóng Mực, Đảo Bến): bản gốc của lab Day 12 AI SDLC.
- **Mô hình 3D**: tự dựng bằng hình khối cơ bản của Three.js trong code (`src/render/main.ts`, `src/render/lantern.ts`, `src/render/bushes.ts`, `src/render/decor.ts`, `src/render/actors.ts`, `src/render/flame.ts`), không dùng asset ngoài. Hình dáng Đèn Lồng Lớn (cột đèn: chân đế loe, thân cột, đầu đèn kính chia ô, mái chóp) dựng lại bằng hình khối theo ảnh tham khảo người làm bài cung cấp; bụi cỏ lá, cây thông, cây hoa anh đào, cây cau, cầu gỗ có trụ đèn, ngọn lửa và nhân vật (dáng áo choàng + gậy lửa theo ảnh pháp sư, nón lá, màu áo/khăn theo bảng màu chuẩn) cũng dựng theo ảnh tham khảo người làm bài cung cấp. Không dùng các file ảnh đó trong game.
- **Âm thanh**: tự tạo bằng WebAudio oscillator trong code (`src/render/sfx.ts`), không dùng file âm thanh ngoài.
- **Thư viện**: [three.js](https://threejs.org) (MIT), [Vite](https://vite.dev) (MIT), [esbuild](https://esbuild.github.io) (MIT), [tsx](https://tsx.is) (MIT), TypeScript (Apache-2.0), [Playwright](https://playwright.dev) (Apache-2.0, chỉ dùng cho `bench_cmd` để mở Chromium).
- **Phông chữ, biểu tượng**: phông hệ thống (`system-ui`) và emoji của hệ điều hành (🔥 🍃 ⏳ 🏮 👁 ⚠); không kèm file phông.
- **Ảnh chụp màn hình** trong README và `docs/proof/`: chụp từ chính game.
- **Công cụ AI**: Claude Code (model Claude Opus 5.5) hỗ trợ viết code (gồm mã dựng mô hình 3D và âm thanh nói trên), test và tài liệu; không dùng AI tạo ảnh, âm thanh hay mô hình dạng file. Xem `docs/notes/ai-log.md`.
- **Video demo**: do người làm bài tự quay.
