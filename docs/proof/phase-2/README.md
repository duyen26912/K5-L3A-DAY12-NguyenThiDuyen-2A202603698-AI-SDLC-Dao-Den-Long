# Bằng chứng Phase 2 (Ticket-02 + Test Contract v1.1)

Tái lập ở tag `phase-2`:

```bash
npm ci && npm run build
```

```bash
npm test && npm run verify -- phase-2
```

| File | Nội dung |
|---|---|
| [headless-verify.md](headless-verify.md) | 18 scenario headless (4 regression Phase 1 + 14 Phase 2), mỗi cái chạy 2 lần so tất định — sinh tự động |
| `*.jsonl` | Output headless thật của từng scenario |
| [linux-docker.log](linux-docker.log) | Linux (Docker `node:20`): build, **53/53 test**, **18/18 scenario**, sha256 output trùng Windows |
| `ui-1` … `ui-6` | Ảnh giao diện chạy thật trong trình duyệt (1280×720): menu, giới thiệu Đêm, HUD, tạm dừng, bản đồ Đêm 2, bản đồ Đêm 3 |

Acceptance criteria đầy đủ: [docs/notes/spec-phase-2.md](../../notes/spec-phase-2.md).

## Truy vết yêu cầu → bằng chứng

| Yêu cầu Ticket-02 | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Số chuẩn Phần 1, contract v1.1 | Test `contract v1.1` + mọi test luật | `tests/core.test.ts`, `game.contract.json` | Đạt |
| Regression Phase 1 với số chuẩn | 25 test Đêm 1 + 4 scenario `p1-*` | `tests/core.test.ts`, [p1-*.jsonl](headless-verify.md) | Đạt (test cũ bị luật mới thay đã sửa có lý do — `docs/notes/assumptions.md` Phase 2) |
| Thứ tự 12 bước trong một tick | Đọc mã + test thời điểm sự kiện | `src/core/world.ts` `step()` | Đạt |
| Lướt | 3 test + scenario | [p2-dash.jsonl](p2-dash.jsonl) | Đạt |
| Tạm dừng (tick vs sim_tick, state paused) | test + scenario + giao diện | [p2-pause.jsonl](p2-pause.jsonl), [ui-4-pause.jpg](ui-4-pause.jpg) | Đạt |
| Rơi khỏi đảo | 2 test + scenario | [p2-fall.jsonl](p2-fall.jsonl) | Đạt |
| Đêm 2: cầu tre, bục nhảy | test + 2 scenario | [p2-n2-bridge.jsonl](p2-n2-bridge.jsonl), [p2-n2-pad.jsonl](p2-n2-pad.jsonl), [ui-5-dem2.jpg](ui-5-dem2.jpg) | Đạt |
| Đêm 3: tầng, vách, dốc, bục, tháp | 4 test + 2 scenario | [p2-n3-ramp.jsonl](p2-n3-ramp.jsonl), [p2-n3-pad.jsonl](p2-n3-pad.jsonl), [ui-6-dem3.jpg](ui-6-dem3.jpg) | Đạt |
| Đêm 3: gió mạnh | test + scenario | [p2-n3-wind.jsonl](p2-n3-wind.jsonl) | Đạt (logic); lá bay/âm báo trước chỉ kiểm bằng mắt |
| Gió Lạc | 4 test + 2 scenario | [p2-drifter-steal.jsonl](p2-drifter-steal.jsonl), [p2-drifter-drop.jsonl](p2-drifter-drop.jsonl) | Đạt |
| Bùa Gió | 2 test + scenario | [p2-charm.jsonl](p2-charm.jsonl) | Đạt |
| Vùng an toàn: đẩy ra ≤ 30 tick | test + scenario | [p2-safe-evict.jsonl](p2-safe-evict.jsonl) | Đạt |
| Lịch sinh Bóng Mực / đom đóm, tối đa theo Đêm | test + 2 scenario Đêm đầy đủ | [p2-n2-random-full.jsonl](p2-n2-random-full.jsonl), [p2-n3-random-full.jsonl](p2-n3-random-full.jsonl) | Đạt |
| Headless 1 Đêm đầy đủ ≤ 30 s | test `hiệu năng` + đo thời gian verify | [headless-verify.md](headless-verify.md) (~0.1 s / Đêm) | Đạt |
| Chuỗi 3 Đêm: menu → giới thiệu → chơi → kết quả → Đêm kế; Bình Minh; chơi lại khi thua | Chạy giao diện | [ui-1-menu.jpg](ui-1-menu.jpg), [ui-2-intro-dem1.jpg](ui-2-intro-dem1.jpg) | Đạt một phần: đã xem menu, giới thiệu, chơi; màn kết quả/Bình Minh chỉ kiểm qua mã, chưa chơi tay tới cuối |
| Cài đặt (âm lượng, độ nhạy, lưu giữa các lần mở) | Mã `main.ts` (localStorage) | — | Chưa kiểm bằng mắt |
| Âm thanh (nhạc nền + 10 hiệu ứng) | Mã `src/render/sfx.ts` | — | Chưa nghe thử (khung trình duyệt của công cụ không phát âm thanh) |
| HUD đầy đủ | Ảnh chụp | [ui-3-hud-dem1.jpg](ui-3-hud-dem1.jpg) | Đạt |
| Bảng màu chuẩn, ánh sáng môi trường 0.15 + 0.55 × tiến độ | Mã `src/render/palette.ts`, `main.ts` | — | Đạt (theo mã) |
| ≥ 30 FPS ở 1280×720 | Bộ đếm FPS (F3 / `?fps=1`) | — | **Chưa đo**: khung trình duyệt của công cụ bị ẩn nên dừng vẽ; cần đo trên máy thật |
| Chơi trọn Đêm tới thắng | Bot chơi trên core → file inputs → headless phát lại | [p1-bot-win-n1-seed5.jsonl](p1-bot-win-n1-seed5.jsonl) (Đêm 1 thắng) | Đạt Đêm 1; **Đêm 2–3 bot chưa thắng** được với số chuẩn (bị Bóng Mực hạ) |

## Ghi chú trung thực
- Ảnh `ui-5-dem2.jpg` và `ui-6-dem3.jpg` chụp sau khi đặt tạm vị trí Mây qua console (để camera nhìn thấy bục nhảy/các tầng). Chỉ dùng để xem hình, không phải bằng chứng gameplay; gameplay Đêm 2–3 được kiểm bằng test và scenario headless.
- Ảnh giao diện được chụp trước các chỉnh sửa trang trí sau đó (mô hình đèn, cây, cầu gỗ, nhân vật nón lá, đom đóm hình ngọn lửa, bảng điều khiển); bố cục menu, HUD và luật hiển thị không đổi. Các thay đổi trang trí chỉ ở `src/render/`, không làm đổi output headless (sha256 18 file `.jsonl` trùng trước và sau).
