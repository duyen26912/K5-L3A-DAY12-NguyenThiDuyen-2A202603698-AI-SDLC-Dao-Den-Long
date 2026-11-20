# Bằng chứng Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3)

Tái lập ở tag `phase-4`:

```bash
npm ci && npm run build
```

```bash
npm test && npm run verify -- phase-4
```

```bash
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
```

| File | Nội dung |
|---|---|
| [../../../bench.json](../../../bench.json) | Benchmark chính thức 30 s (Windows 10, Ryzen 5 5600H, GPU tích hợp AMD Radeon, Chrome) |
| [../../../soak.json](../../../soak.json) | Soak chính thức 10 Đêm, seed 7 |
| [headless-verify.md](headless-verify.md) | 27 scenario headless (26 cũ + `p4-stress`), mỗi cái 2 lần so tất định; so byte-by-byte với `docs/proof/phase-3/`; `soak_cmd`; lệnh xuất bảng xếp hạng (sinh tự động) |
| `*.jsonl` | Output headless thật của từng scenario |
| [linux-docker.log](linux-docker.log) | Linux (Docker `node:20`): build, **83/83 test**, **27/27 scenario**, 26/26 giống phase-3, soak ×1.04 (3 lần), export, sha256 output trùng Windows |
| [leaderboard-export.json](leaderboard-export.json) | Kết quả `node scripts/run.mjs --export-leaderboard` sau khi chụp ảnh ui-3, ui-4 (dữ liệu thử ở thư mục tạm, đã xóa) |
| [ui-0](ui-0-menu-chinh.jpg) | Menu chính (ảnh đầu README) |
| ui-1 … ui-6 | Ảnh 1280×720 chụp bằng Chromium headless (Playwright) từ bản build |

## Kết quả đo

| Lệnh | Kết quả | Ngưỡng | |
|---|---|---|---|
| `bench_cmd --seed 42 --duration 30` | avg **186.3 FPS**, p1_low **84.7 FPS**, p95 9.2 ms, 5590 khung, load **1181 ms**, `vsync_off: true`, `peak_mem_mb: null` (bản web), JS heap đỉnh 19.2 MB | avg ≥ 60, p1_low ≥ 30, load ≤ 10000 | Đạt (máy tự đo) |
| `soak_cmd --seed 7 --nights 10` | crashes 0; Windows 56.3 → 59.9 MB (×1.06); Linux 41.4 → 43.1–43.2 MB (×1.04) | crashes = 0, ×1.2 | Đạt |

### Vì sao `soak_cmd` có `--max-semi-space-size=1 --no-opt`

Lần đầu chạy trên Linux (Docker) với `node --expose-gc` thì **chưa đạt** (×1.25–1.57, dao động giữa các lần). Đo thêm để tìm nguyên nhân (probe gọi GC rồi đọc `process.memoryUsage()` mỗi 50 Đêm):

| Linux, `node:20` | RSS Đêm 0 → 100 → 200 → 400 | JS heap đang dùng | soak 10 Đêm (3 lần) |
|---|---|---|---|
| mặc định | 40.5 → 69.2 → 74.9 → 74.6 MB | 3.0 → 3.6 → 3.6 → 3.7 MB | ×1.38, ×1.57, ×1.29 |
| `--max-semi-space-size=1` | 40.8 → 62.7 → 62.5 → 62.4 MB | 3.0 → 3.6 → 3.6 → 3.7 MB | ×1.43, ×1.23, ×1.27 |
| `--max-semi-space-size=1 --no-opt` | 40.8 → 43.7 → 43.8 → 43.8 MB | 3.0 → 3.4 → 3.4 → 3.4 MB | ×1.04, ×1.04, ×1.04 |

- **JS heap đang dùng đứng yên** qua 400 Đêm → logic game không giữ lại dữ liệu giữa các Đêm (không rò rỉ).
- RSS tăng vì (1) V8 nới vùng nhớ thế hệ trẻ khi game cấp phát nhiều đối tượng ngắn hạn mỗi tick (`heapTotal` 5.5 → 20 MB) và (2) bộ nhớ của trình biên dịch tối ưu TurboFan mà glibc không trả lại hệ điều hành. Cả hai đều chững lại, không tăng theo số Đêm.
- Hai cờ giới hạn đúng hai nguồn đó; logic, kết quả và thời gian chạy (0.4 s) không đổi. Ghi ở giả định D13.

## Truy vết yêu cầu → bằng chứng

| Yêu cầu Ticket-04 | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| 1. `bench_cmd` mở cửa sổ 1280×720, không toàn màn hình, tắt vsync | Mã `scripts/bench.mjs` (`--window-size`, viewport, `--disable-gpu-vsync --disable-frame-rate-limit`) | [bench.json](../../../bench.json) | Đạt |
| 1. Đêm 1 đủ hiệu ứng/ánh sáng; 200 Bóng Mực `wander` rải đều (seed 42); 100 đom đóm; L1–L3 sáng fuel 100 | Test `bench: …` (đếm, trạng thái, bán kính, 4 góc phần tư, tất định theo seed) | `tests/phase4.test.ts`; `bench.json` ghi `shades: 200, motes: 100` | Đạt |
| 1. Tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc; Bóng Mực vẫn wander | Test chạy 3600 tick không có `shade_spawned/player_hit/mote_picked/lantern_out/game_over`, > 150 con di chuyển | `tests/phase4.test.ts` | Đạt |
| 1. Không input, Mây (0,0,0); camera bán kính 30, Y 15, nhìn (0,0,0), bắt đầu (30,15,0), ngược chiều kim đồng hồ nhìn từ trên, 15 s/vòng | Mã `benchFrame` trong `src/render/main.ts` | — | Đạt theo mã |
| 1. 3 s khởi động, đo đúng `--duration`, tự thoát 0; công thức avg / p1_low / p95 / load | Mã + chạy thật | [bench.json](../../../bench.json) (`frames` 5590 trong 30 s) | Đạt |
| 1. Ngưỡng avg ≥ 60, p1_low ≥ 30, load ≤ 10000 | Chạy thật trên máy mình (tham khảo) | 186.3 / 84.7 / 1181 | Đạt trên máy tự đo; máy chấm do giảng viên đo |
| 2. Soak 10 Đêm một tiến trình, xoay 1→2→3, seed 7 + i, input ngẫu nhiên theo tỉ lệ ticket | Test `soak` + `verify` + Docker | [soak.json](../../../soak.json), [headless-verify.md](headless-verify.md), [linux-docker.log](linux-docker.log) | Đạt |
| 2. crashes = 0, mem_end ≤ 1.2 × mem_start | Windows + Linux | ×1.06 / ×1.04 | Đạt (sau khi thêm cờ V8, xem trên) |
| 3. Nhập tên sau Bình Minh hoặc khi thua; tên 3–12 `[A-Za-z0-9_]`, tiếng Việt (điểm cộng) | Test `validateName`; chạy thật trên giao diện | [ui-3](ui-3-nhap-ten.jpg) | Đạt |
| 3. Mục: name, score, nights_won, achieved_at ISO có múi giờ, seed; top 10; điểm giảm dần, bằng điểm ai trước đứng trên | Test sắp xếp/top 10/ISO | [leaderboard-export.json](leaderboard-export.json) (655: Ông_Đăng trước player_2) | Đạt |
| 3. Lưu đĩa, còn sau khi tắt/mở lại; màn hình Bảng xếp hạng ở menu | Test ghi → đọc lại từ file; ảnh | [ui-4](ui-4-bang-xep-hang.jpg) | Đạt |
| 3. `<run_cmd> --export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự | Test + `verify` + Docker | [headless-verify.md](headless-verify.md) | Đạt |
| 4. Đổi phím mọi hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), báo trùng, khôi phục mặc định, lưu | Test `core/keybinds.ts`; chạy thật (đổi Nhảy → J, Space mất tác dụng, J nhảy; tải lại trang vẫn giữ) | [ui-6](ui-6-doi-phim-trung.jpg) | Đạt |
| 4. Phụ đề/chỉ báo: Bóng Mực xuất hiện + mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn fuel < 30 | Chạy thật cả 4 loại (gió: Đêm 3 tick 1683) | [ui-1](ui-1-hud-phu-de.jpg), [ui-2](ui-2-chu-lon-10-giay-cuoi.jpg) | Đạt |
| 4. Giảm chuyển động: tắt rung camera và chớp màn hình | Mã (`settings.calm`, CSS `html.calm`) | [ui-5](ui-5-cai-dat.jpg) | Đạt theo mã (game không có rung camera) |
| 4. Chữ ≥ 18 px ở 1280×720; tùy chọn ×1.25 | Script đọc `getComputedStyle` mọi phần tử có chữ: không còn chữ < 18 px; chữ lớn: đồng hồ 37.5 px, bảng phím 22.5 px | [ui-2](ui-2-chu-lon-10-giay-cuoi.jpg) | Đạt |
| 5. Clone sạch → ≤ 3 lệnh → chơi | `git clone`, `npm ci && npm run build`, `npm start`; Docker chạy từ mã sạch | README, [linux-docker.log](linux-docker.log) | Đạt (giảng viên thử trên máy sạch) |
| 5. README, CHANGELOG 4 phase, CREDITS, LICENSE | — | [README](../../../README.md), [CHANGELOG](../../../CHANGELOG.md), [CREDITS](../../../CREDITS.md), [LICENSE](../../../LICENSE) | Đạt |
| 6. Contract v1.3: `contract_version`, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | Test contract; 26/26 output headless giống hệt phase-3 | [headless-verify.md](headless-verify.md) | Đạt |
| 7. Retro 1–2 trang | — | [retro.md](../../notes/retro.md) | Đạt |
| 7. Video demo .mp4 < 5 phút | Người làm bài tự quay, tải lên YouTube (file gốc .mp4 > 100 MB nên không để trong repo) | [YouTube](https://www.youtube.com/watch?v=RZ1pihMqPAE) | Đạt |

## Chưa đạt / ghi chú trung thực
- Số bench là của máy mình; ngưỡng chính thức đo trên máy chấm. Chưa chạy bench trên macOS/Linux có màn hình.
- `peak_mem_mb` là `null` vì là bản web (giải thích trong README).
- Ảnh ui-1, ui-2 chụp sau khi đặt tạm trạng thái qua console (nhảy tới tick 280 để Bóng Mực xuất hiện ngay, đèn L2 dầu 24, nhảy tới 10 s cuối); ui-4 có 3 mục dữ liệu thử thêm qua API.
- "Giảm chuyển động" và phụ đề chưa được người dùng có nhu cầu tiếp cận thử.
