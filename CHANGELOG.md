# Changelog

## v1.0.0 / phase-4 — Ticket-04 "Bình minh: phát hành v1.0.0", Test Contract v1.3

Luật chơi **không đổi**: đầu ra headless của 26 scenario Phase 1–3 giống hệt từng byte so với tag `phase-3`.

### Thay đổi contract (v1.2 → v1.3)
| Trước (v1.2) | Sau (v1.3) |
|---|---|
| `contract_version: "1.2"` | `"1.3"` |
| `run_cmd`: `npm run preview -- --open` | `node scripts/run.mjs` (server Node: bản web `dist/` + API bảng xếp hạng; `--export-leaderboard out.json`) |
| — | `bench_cmd`: `node scripts/bench.mjs` (`--seed --duration --out` → `bench.json`) |
| — | `soak_cmd`: `node --expose-gc --max-semi-space-size=1 --no-opt dist-headless/soak.mjs` (`--seed --nights --out` → `soak.json`) |
| Cài đặt: `npm ci && npm run build` rồi `npm run preview -- --open` | `npm ci && npm run build` rồi `npm start` |

### Thêm
- **Benchmark** (Playwright + Chromium, cửa sổ 1280×720, tắt vsync): cảnh chuẩn 200 Bóng Mực + 100 đom đóm (`src/core/bench.ts`), camera bay vòng, 3 s khởi động, đo avg/p1_low/p95/load. Bóng Mực và đom đóm vẽ hàng loạt bằng InstancedMesh (`src/render/crowds.ts`), biên dịch shader trước khi đo.
- **Soak test** 10 Đêm trong một tiến trình (`src/soak.ts`), input ngẫu nhiên theo seed.
- **Bảng xếp hạng** top 10 lưu trên đĩa (`src/core/leaderboard.ts`, `src/leaderboard-store.ts`): nhập tên sau Bình Minh hoặc khi thua (hỗ trợ tiếng Việt có dấu), màn hình Bảng xếp hạng ở menu, lệnh xuất JSON.
- **Dễ tiếp cận:** đổi phím mọi hành động (2 phím/hành động, báo trùng, khôi phục mặc định, lưu); phụ đề + mũi tên chỉ Bóng Mực, cảnh báo gió, 10 giây cuối, đèn dầu < 30; giảm chuyển động; mọi chữ ≥ 18 px, tùy chọn chữ lớn ×1.25.
- Giao diện (chỉ hiển thị): menu chính 3 phần (cách chơi + nút bắt đầu · tên game + đèn lồng · Mây 3D); nút Lướt/Tỏa sáng tròn với hồi chiêu quét + đếm giây; bản đồ nhỏ (đảo, đèn, đom đóm, Bóng Mực, hướng nhìn); cụm đá có rêu trên cả 3 Đêm; màn Cài đặt đóng khung với công tắc gạt; màn Bình Minh có trời sáng dần, mặt trời, đèn trời bay và bảng điểm từng Đêm.
- Scenario `p4-stress` (Đêm 3 trọn 300 s, 60 Bóng Mực); `verify -- phase-4` so đầu ra với phase-3, chạy `soak_cmd` và lệnh xuất bảng xếp hạng. 83 test.
- README đầy đủ (yêu cầu hệ thống, 3 lệnh cài, bench/soak), retro 4 phase, bản web chạy được đính kèm Release v1.0.0.

### Sửa
- Bỏ cấp phát mảng mỗi tick trong logic chọn đèn của Bóng Mực `wander` (cùng kết quả, ít rác hơn).
- Cảnh bench vẽ ở pixel ratio 1 (trước đó nhân theo tỉ lệ màn hình → vẽ nhiều điểm ảnh hơn 1280×720).

## phase-3 — Ticket-03 "Đèn cạn dầu", Test Contract v1.2

### ⚠ Breaking changes (phá vỡ tương thích với Phase 2)
| Trước (v1.1) | Sau (v1.2) |
|---|---|
| `contract_version: "1.1"` | `"1.2"`; tuning thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max` |
| Đêm 1 / 2 / 3 dài 300 / 330 / 360 s | **240 / 270 / 300 s** |
| Thắng ngay khi tất cả đèn sáng, `reason: "all_lit"` | **Không thắng sớm**; thắng ở bình minh khi còn sống và ≥ ceil(0.6 × tổng) đèn sáng, `reason: "dawn_survived"`; `all_lit` bỏ |
| Đèn đã sáng không nhận đom đóm, sáng mãi | Đèn có dầu 100, hao 1/giây, hết dầu tắt (`lantern_out`); bấm E ở đèn sáng = châm dầu (`refuel`); thắp lại chỉ cần 5 |
| Vùng an toàn luôn có khi đèn sáng | Chỉ khi `fuel ≥ 30` |
| Bóng Mực 5 trạng thái | Thêm `drain` (đứng yên hút 5 dầu/giây) |
| Điểm: +10/đom đóm nạp, +100/đèn, +5/Tỏa Sáng, thắng +2×giây + 50×lửa | +5/đom đóm nạp (cả châm dầu), +100 thắp lần đầu, +40 thắp lại, Tỏa Sáng +5 (+15 nếu đang `drain`), bình minh +50 + floor(fuel)/đèn sáng + 50/lửa, **bỏ thưởng thời gian** |
| Sức chứa cố định 10 | `10 + 2 × successful_lights`, tối đa 20 |
| Snapshot đèn `{id, pos, lit, deposited}` | thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity` |
| `lantern_lit {lantern_id}` | `lantern_lit {lantern_id, relight}`; sự kiện mới `refuel`, `lantern_out`, `fuel_drain` |
| Scenario đèn `{id, pos, lit, deposited}` | thêm `fuel`, `ever_lit` (`lit: true` không có `fuel` → 100); `player.successful_lights`; `shades[].target_lantern_id` |

### Khác
- Giao diện: thanh dầu trên đèn sáng, đèn và thanh nhấp nháy 1 Hz khi dầu < 30, đèn tắt xẹp 20% + vết rách, vòng vùng an toàn ẩn khi dầu < 30, HUD `đang mang / sức chứa`, gợi ý "E — Châm dầu", màn giới thiệu nêu số đèn cần giữ.
- Cài đặt "Bảng màu dễ phân biệt" (lưu localStorage): Bóng Mực `#00B3FF`, cảnh báo UI `#FFFFFF` + ⚠.
- 66 test, 26 scenario headless (`npm run verify -- phase-3`). Quyết định thiết kế: `docs/notes/adr-001-den-can-dau.md`.

## phase-2 — Ticket-02 "Ba hòn đảo", Test Contract v1.1
- Số liệu chuẩn thay số tự chọn; thứ tự xử lý tick 12 bước; điểm chuẩn hóa.
- 3 Đêm: Đảo Bến (chuẩn hóa), Đảo Cau (2 đảo, cầu tre, bục nhảy), Đảo Chuông (3 tầng, dốc, bục, tháp chuông, gió mạnh).
- Lướt, Tạm dừng, Rơi khỏi đảo, Gió Lạc, Bùa Gió; trạng thái Bóng Mực spawning/wander/chase/recoil/stunned.
- Giao diện: menu → giới thiệu → chơi → kết quả → Đêm kế, Bình Minh; menu tạm dừng; cài đặt lưu localStorage; nhạc nền + hiệu ứng; HUD đầy đủ; bảng màu chuẩn; bộ đếm FPS (F3).
- 53 test, 18 scenario headless (`npm run verify -- phase-2`).

## phase-1 — PRD-0, Test Contract v1.0
- Màn Đêm 1 – Đảo Bến: đảo tròn 5 Đèn Lồng Lớn, đom đóm, Bóng Mực, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless theo Test Contract v1.0 (`game.contract.json`, JSONL snapshot/event/end, tất định theo seed).
- Test đơn vị + scenario headless, script kiểm chứng, CI (Ubuntu + macOS), hook Stop chặn khi test đỏ.
