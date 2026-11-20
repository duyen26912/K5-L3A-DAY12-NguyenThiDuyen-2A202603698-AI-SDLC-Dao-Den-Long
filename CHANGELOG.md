# Changelog

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
