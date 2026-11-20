# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js, chạy trên trình duyệt) + chế độ headless (Node) theo Test Contract trong `docs/lab/` và lab board.

## Lệnh
- Cài: `npm ci` · Build: `npm run build` (headless → `dist-headless/`, web → `dist/`)
- Chạy game: `npm run dev` (dev) hoặc `npm run preview` (bản build)
- Typecheck: `npm run typecheck` · Test: `npm test` · Kiểm chứng + bằng chứng: `npm run build:headless && npm run verify -- phase-N`
- Headless: `node dist-headless/headless.mjs --seed <n> --night 1 [--scenario f] [--inputs f] --ticks <n> --out <f.jsonl> [--snapshot-every n]`

## Kiến trúc (bắt buộc giữ)
- `src/core/` = luật chơi thuần, **không import three / DOM**. Chỉ RNG theo seed (`core/rng.ts`), không `Math.random()`, không thời gian thực → tất định.
- `src/render/` chỉ đọc trạng thái core để vẽ. Thêm hiệu ứng/sáng tạo ở đây thì không được đổi output headless.
- Mọi số gameplay đọc từ `game.contract.json` (`core/config.ts`). Đổi số → đổi ở file contract, không hard-code.
- Thứ tự một bước: di chuyển → nhảy → nhặt → nạp đèn → tỏa sáng → Bóng Mực → bị chạm → sinh thêm → kết thúc.

## Quy tắc
- Bám đúng chữ trong PRD/ticket/Test Contract; chỗ chưa quy định → ghi giả định vào `docs/notes/assumptions.md`, không tự bịa thành "yêu cầu".
- Chỉ dùng lệnh chạy được trên macOS/Linux (không .bat/.ps1, không đường dẫn `\`). Tên file import đúng hoa/thường.
- Yêu cầu mới → viết test/scenario trước, rồi code. Test cũ bị luật mới thay → sửa/bỏ kèm lý do trong ghi chú, không tắt âm thầm.
- Không sửa tay output, không viết test luôn đạt. Xong việc phải chạy `npm test` + `npm run verify` và dẫn output làm bằng chứng.
- Không commit `.env`, key, token.
