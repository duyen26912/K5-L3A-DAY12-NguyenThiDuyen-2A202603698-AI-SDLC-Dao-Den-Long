---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của một phase (typecheck, test, scenario headless, tất định, Linux qua Docker) và lưu bằng chứng vào docs/proof/<phase>/. Dùng trước khi gắn tag phase-N hoặc khi được hỏi "đã chạy đúng chưa".
---

# Kiểm chứng một phase

1. `npm run typecheck` và `npm test` — phải xanh hết.
2. `npm run build && npm run verify -- phase-N` (mặc định phase-4; các case nằm trong `scripts/verify.mjs`, mỗi case có `--night`; từ phase-4 còn so output với `docs/proof/phase-3/`, chạy `soak_cmd` và lệnh xuất bảng xếp hạng)
   - Chạy mọi scenario trong `scripts/verify.mjs` bằng đúng `headless_cmd` của `game.contract.json`, mỗi cái 2 lần để so tất định.
   - Ghi `docs/proof/phase-N/*.jsonl` và `docs/proof/phase-N/headless-verify.md` (không sửa tay).
3. Kiểm tra trên Linux (giảng viên dùng macOS/Linux):
   ```bash
   docker run --rm -v "<repo>:/src:ro" node:20 sh -c "mkdir /app && cd /src && tar --exclude=./node_modules --exclude=./.git -cf - . | (cd /app && tar xf -) && cd /app && npm ci && npm run build && npm test && node scripts/verify.mjs linux-check && cd docs/proof/linux-check && sha256sum *.jsonl"
   ```
   So sha256 với file trên máy mình; lưu log vào `docs/proof/phase-N/linux-docker.log`.
4. Với yêu cầu mới của phase (bắt buộc ≥ 1 scenario headless cho mỗi tính năng mới): thêm scenario vào `tests/scenarios/` + một mục trong `cases` của `scripts/verify.mjs` (ghi rõ yêu cầu nào, mong đợi gì).
5. Cập nhật bảng truy vết `docs/proof/phase-N/README.md`: yêu cầu → cách kiểm chứng → bằng chứng → kết quả. Chưa đạt thì ghi "chưa đạt" + lý do.
6. Giao diện: chạy `npm run dev`, mở `?fps=1` (hoặc F3) ở cửa sổ 1280×720 để đo FPS (yêu cầu ≥ 30 trung bình), chụp ảnh HUD/menu làm bằng chứng.
7. Phase 4 trở đi: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` (mở Chrome ~40 s; thử nhanh dùng `--duration 10 --out out/b.json`) và `soak_cmd --seed 7 --nights 10 --out soak.json`; soak phải đạt cả trên Linux (Docker), không chỉ Windows.
