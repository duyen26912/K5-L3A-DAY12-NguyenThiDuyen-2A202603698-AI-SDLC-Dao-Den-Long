# Credits

- **Nhân vật, bối cảnh, tên gọi** (Mây, Đèn Lồng Lớn, Bóng Mực, Đảo Bến): bản gốc của lab Day 12 AI SDLC.
- **Mô hình 3D**: tự dựng bằng hình khối cơ bản của Three.js trong code (`src/render/main.ts`, `src/render/lantern.ts`), không dùng asset ngoài. Hình dáng Đèn Lồng Lớn (cột đèn: chân đế loe, thân cột, đầu đèn kính chia ô, mái chóp) dựng lại bằng hình khối theo ảnh tham khảo người làm bài cung cấp; không dùng file ảnh đó trong game.
- **Âm thanh**: tự tạo bằng WebAudio oscillator trong code (`src/render/sfx.ts`), không dùng file âm thanh ngoài.
- **Thư viện**: [three.js](https://threejs.org) (MIT), [Vite](https://vite.dev) (MIT), [esbuild](https://esbuild.github.io) (MIT), [tsx](https://tsx.is) (MIT), TypeScript (Apache-2.0).
- **Công cụ AI**: Claude Code (model Claude Opus 5.5) hỗ trợ viết code, test và tài liệu; xem `docs/notes/ai-log.md`.
