# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu" + Test Contract v1.2)

Tái lập ở tag `phase-3`:

```bash
npm ci && npm run build
```

```bash
npm test && npm run verify -- phase-3
```

| File | Nội dung |
|---|---|
| [headless-verify.md](headless-verify.md) | 26 scenario headless: 3 regression Phase 1, 14 Phase 2, 9 Phase 3 — mỗi cái chạy 2 lần so tất định (sinh tự động) |
| `*.jsonl` | Output headless thật của từng scenario |
| [linux-docker.log](linux-docker.log) | Linux (Docker `node:20`): build, **66/66 test**, **26/26 scenario**, sha256 output trùng Windows |
| [ui-1-hud-suc-chua-den-tat.jpg](ui-1-hud-suc-chua-den-tat.jpg) | HUD Phase 3: đồng hồ 04:00 (240 s), "Đèn sáng 2/5", sức chứa `6 / 14`, thanh 14 ô, đèn tắt ở giữa (xẹp), đèn đang sáng có thanh dầu |

Quyết định thiết kế: [ADR-001](../../notes/adr-001-den-can-dau.md). Breaking changes: [CHANGELOG.md](../../../CHANGELOG.md). Ticket: [TICKET-03.md](../../lab/TICKET-03.md).

## Truy vết yêu cầu → bằng chứng

| Yêu cầu Ticket-03 | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Contract v1.2: tuning mới, thời lượng 240/270/300 | Test `contract v1.2`, test bản đồ 3 Đêm | `tests/core.test.ts`, `tests/phase2.test.ts` | Đạt |
| 1. Dầu: vừa thắp = 100, hao 1/giây, snapshot 1 chữ số | Test | `tests/phase3.test.ts` | Đạt |
| 1. Hết dầu → tắt, `deposited = 0`, `lantern_out`, nhớ `ever_lit` | Test + scenario | [p3-fuel-out.jsonl](p3-fuel-out.jsonl) | Đạt |
| 1. Châm dầu (công thức `used`, tối đa 100, `refuel`) | Test + scenario | [p3-refuel.jsonl](p3-refuel.jsonl) | Đạt |
| 1. Thắp lại chỉ cần 5, `relight: true`, `relit_count` | Test + scenario | [p3-relight.jsonl](p3-relight.jsonl) | Đạt |
| 1. Thanh dầu, nhấp nháy 1 Hz khi < 30 | Mã `main.ts`, `lantern.ts` + ảnh | [ui-1](ui-1-hud-suc-chua-den-tat.jpg) | Đạt theo mã; nhấp nháy chỉ kiểm bằng mắt |
| 2. Dầu < 30 mất vùng an toàn (30 vẫn còn) | Test | `tests/phase3.test.ts` | Đạt |
| 2. Wander → đèn yếu gần nhất, `drain` ≤ 2 m, hút 5/giây cộng dồn, `fuel_drain` mỗi 60 tick | Test + scenario | [p3-drain.jsonl](p3-drain.jsonl) | Đạt |
| 2. Thoát `drain`: chase (Mây ≤ 6 m), stunned (Tỏa Sáng), wander (đèn tắt / châm ≥ 30 / xa > 2 m) | Test + scenario | [p3-drain-pulse.jsonl](p3-drain-pulse.jsonl) | Đạt |
| 2. Châm lên ≥ 30 → đẩy Bóng Mực ra mép ≤ 30 tick, không sát thương | Test | `tests/phase3.test.ts` | Đạt |
| 3. Không thắng sớm | Test + scenario | [p3-no-early-win.jsonl](p3-no-early-win.jsonl) | Đạt |
| 3. Bình minh: còn sống + ≥ ceil(0.6 × tổng) → `dawn_survived`; thiếu → `dawn` | Test (3 Đêm) + 2 scenario | [p3-dawn-win.jsonl](p3-dawn-win.jsonl), [p3-dawn-lose.jsonl](p3-dawn-lose.jsonl) | Đạt |
| 3. Hết Ngọn Lửa ở tick bình minh → `no_flames` trước | Test | `tests/phase3.test.ts` | Đạt |
| 4. Sức chứa 10 + 2 × successful_lights (≤ 20), HUD `mang / sức chứa` | Test + scenario + ảnh | [p3-capacity.jsonl](p3-capacity.jsonl), [ui-1](ui-1-hud-suc-chua-den-tat.jpg) | Đạt |
| 5. Điểm mới (+5, +100, +40, +5/+15, bình minh 50 + floor(fuel), +50/lửa, bỏ thưởng thời gian) | Test + scenario | [p3-dawn-win.jsonl](p3-dawn-win.jsonl) (594 = 3×(50+98)+150), [p3-relight.jsonl](p3-relight.jsonl) (65), [p3-drain-pulse.jsonl](p3-drain-pulse.jsonl) (15) | Đạt |
| 6. Chế độ mù màu (Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + ⚠, đèn tắt xẹp 20% + rách) | Mã `main.ts`, `actors.ts`, `lantern.ts` | — | Đạt theo mã; **chưa chụp ảnh chế độ mù màu** |
| Regression Phase 1–2 (luật không bị thay) | 14 scenario Phase 2 + test | [headless-verify.md](headless-verify.md) | Đạt |
| Test cũ bị thay: sửa có lý do, không skip | Ghi chú `Phase 3:` trong test + CHANGELOG | `tests/core.test.ts` | Đạt |

## Chưa đạt / ghi chú trung thực
- **Bot chưa thắng một Đêm** với luật Phase 3 (6 Bóng Mực hút dầu khiến bot châm dầu mãi một đèn). Không có bằng chứng "chơi trọn Đêm tới thắng" cho Phase 3; thắng/thua bình minh được kiểm bằng scenario dựng sẵn.
- Ảnh `ui-1` chụp sau khi đặt tạm trạng thái đèn (L1 sáng 80, L2 sáng 25, L5 đã từng sáng) và sức chứa qua console để dễ nhìn; chụp trước khi đổi vết rách sang màu sáng.
- Chưa đo FPS trên máy thật (khung trình duyệt của công cụ bị ẩn).
