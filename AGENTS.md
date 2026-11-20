# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js, chạy trên trình duyệt) + chế độ headless (Node) theo **Test Contract v1.3** (Ticket-02 + Ticket-03 "Đèn cạn dầu" + Ticket-04 phát hành v1.0.0, 3 Đêm). Spec: `docs/notes/spec-phase-2.md`, `docs/lab/TICKET-03.md`, `docs/lab/TICKET-04.md`; quyết định thiết kế: `docs/notes/adr-*.md`.

## Lệnh
- Cài: `npm ci` · Build: `npm run build` (headless → `dist-headless/`, web → `dist/`)
- Chạy game: `npm run dev` (dev) hoặc `npm start` = `node scripts/run.mjs` (bản build + API bảng xếp hạng; `--export-leaderboard out.json`)
- Typecheck: `npm run typecheck` · Test: `npm test` · Kiểm chứng + bằng chứng: `npm run build && npm run verify -- phase-N`
- Headless: `node dist-headless/headless.mjs --seed <n> --night <1|2|3> [--scenario f] [--inputs f] --ticks <n> --out <f.jsonl> [--snapshot-every n]`
- Bench (mở Chrome 1280×720, ~40 s): `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` · Soak: `node --expose-gc --max-semi-space-size=1 --no-opt dist-headless/soak.mjs --seed 7 --nights 10 --out soak.json`

## Kiến trúc (bắt buộc giữ)
- `src/core/` = luật chơi thuần, **không import three / DOM**. Chỉ RNG theo seed (`core/rng.ts`), không `Math.random()`, không thời gian thực → tất định.
- `src/render/` chỉ đọc trạng thái core để vẽ. Thêm hiệu ứng/sáng tạo ở đây thì không được đổi output headless.
- Số chuẩn: có khóa tuning → `game.contract.json`; không có khóa → hằng trong `core/config.ts`. Bản đồ chuẩn 3 Đêm → `core/maps.ts`. Không hard-code số ở chỗ khác.
- Thứ tự một tick (bắt buộc, Ticket-02): pause → bộ đếm → di chuyển Mây (nhảy, lướt, bục, gió) + rơi → nhặt đom đóm/bùa → nạp đèn → vùng an toàn → Tỏa Sáng → Bóng Mực + Gió Lạc → chạm (Gió Lạc trước, Bóng Mực theo id) → sinh theo lịch → thắng/thua → snapshot.
- Khi đang pause: `tick` tăng, `sim_tick` và mọi bộ đếm đứng yên.
- Ticket-03: dầu đèn lưu bằng **đơn vị nguyên 1/60** (`fuelU`), trừ dầu ở bước 2 (hao + hút), đèn `fuel ≤ 0` tắt ngay sau bước 2; vùng an toàn chỉ khi `fuel ≥ 30` (`hasSafeZone`); không thắng sớm — thắng/thua chỉ xét ở bình minh (trừ `no_flames`).
- Tên trạng thái Bóng Mực đúng v1.2: spawning, wander, chase, recoil, stunned, drain. Gió Lạc: idle, chase, flee, removed.
- Màu các thành phần chuẩn lấy từ `render/palette.ts`.
- Ticket-04: cảnh bench chuẩn ở `core/bench.ts` (cờ `world.mode` tắt sinh/sát thương/nhặt/hao dầu/kết thúc — mặc định tắt hết cờ, không được ảnh hưởng chơi thường). Trong bench tắt trang trí sáng tạo, HUD; không cấp phát mảng/đối tượng mới mỗi tick trong `step()` khi tránh được. Bảng xếp hạng: logic `core/leaderboard.ts`, lưu đĩa `src/leaderboard-store.ts`; đổi phím: `core/keybinds.ts` (thuần, có test).
- Giao diện: mọi chữ ≥ 18 px ở 1280×720 (`calc(… * var(--k))`), cảnh báo mới phải có phụ đề (tắt được), hiệu ứng chớp/nhấp nháy mới phải tắt theo "Giảm chuyển động" (`settings.calm`).

## Quy tắc
- Bám đúng chữ trong PRD/ticket/Test Contract; chỗ chưa quy định → ghi giả định vào `docs/notes/assumptions.md`, không tự bịa thành "yêu cầu".
- Chỉ dùng lệnh chạy được trên macOS/Linux (không .bat/.ps1, không đường dẫn `\`). Tên file import đúng hoa/thường.
- Yêu cầu mới → viết test (`tests/*.test.ts`) **và** ít nhất 1 scenario headless (`tests/scenarios/` + mục trong `scripts/verify.mjs`) trước, rồi code. Test cũ bị luật mới thay → sửa/bỏ kèm lý do (ghi chú `Phase N:` ngay tại test + CHANGELOG breaking changes), không skip âm thầm. Thay đổi mô hình lớn → viết ADR trong `docs/notes/`.
- Không sửa tay output, không viết test luôn đạt. Xong việc phải chạy `npm test` + `npm run verify` và dẫn output làm bằng chứng.
- Không commit `.env`, key, token.
- Commit: dạng `feat(phase-N): …`, `fix(phase-N): …`, `test(phase-N): …`, `docs(phase-N): …`; không thêm dòng Co-Authored-By.
