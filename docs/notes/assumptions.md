# Giả định & tiêu chí nghiệm thu

## Phase 1 — PRD-0 + Test Contract v1.0

### Bắt buộc chính xác (lấy nguyên từ Test Contract)
- `game.contract.json` ở gốc repo; `tuning` khai đúng số game dùng → game **đọc thẳng** file này (`src/core/config.ts`), nên không thể lệch.
- Headless: `--seed --night 1 [--scenario] [--inputs] --ticks --out [--snapshot-every=10]`; 60 tick/s; dừng khi đủ tick hoặc hết game; thoát 0; lỗi định dạng file → 2; lỗi khác → khác 0, báo stderr.
- Tick model: snapshot tick 0 = sau dựng scenario, trước input; bước k đọc input tick k → trạng thái k+1, sự kiện ghi `tick = k+1`; `time_left_s = thời lượng − số bước / 60`.
- Inputs: mặc định `move [0,0]`, `cam_yaw_deg 0`, nút false; frame chỉ đổi trường có mặt; tick tăng nghiêm ngặt; move mỗi thành phần ∈ [−1, 1], chuẩn hóa nếu dài > 1; công thức xoay theo θ; nút kích hoạt khi false → true.
- Scenario: `lanterns` cập nhật theo id; `motes`, `shades` thay danh sách; `random_*: false` tắt tự sinh; dựng scenario không phát sự kiện, không cộng điểm.
- Output: snapshot / event / end; tọa độ làm tròn 3 chữ số; tất định theo seed.

### Giả định cho chỗ PRD-0 chưa nói (số đã khai trong `game.contract.json`)

| # | Chỗ mơ hồ | Giả định của bài |
|---|---|---|
| A1 | Kích thước đảo, vị trí đèn | Đảo tròn bán kính 40 m. 5 đèn L1…L5 cách đều trên vòng tròn bán kính 25 m, Lk tại góc a = (k−1)·72°, vị trí (25·sin a, 0, 25·cos a): L1 = (0, 0, 25), L2 ≈ (23.776, 0, 7.725)…. Người chơi xuất phát (0, 0, 0). |
| A2 | Rơi khỏi đảo | Không rơi được: người chơi bị giữ trong bán kính đảo → `fall_enabled: false`, không bao giờ có `player_hit` với `by: "fall"`. |
| A3 | Nhặt đom đóm | Tự động khi khoảng cách XZ ≤ `pickup_radius` (1.5 m) và còn chỗ (`carry_capacity` 5). Đom đóm trên mặt đất (y = 0). Mỗi con +`per_mote` (10) điểm khi nhặt. |
| A4 | Nạp đèn | Nhấn interact khi cách đèn **chưa thắp** gần nhất ≤ `interact_radius` (3 m): nạp `min(đang mang, còn thiếu)`. Đủ `lantern_cost` (5) → thắp, +`per_lantern` (100). Đèn đã thắp không nhận thêm. |
| A5 | Tỏa sáng tốn gì | Tốn `pulse_cost` = 1 đom đóm đang mang ("tốn ánh sáng"). Không đủ đom đóm hoặc đang hồi chiêu (`pulse_cooldown_s` 2 s) → không có gì xảy ra, không phát sự kiện. |
| A6 | Hiệu ứng tỏa sáng | Mọi Bóng Mực có khoảng cách XZ ≤ `pulse_radius` (6 m) bị choáng `pulse_stun_s` (3 s), bị đẩy ra xa `pulse_push_m` (4 m) theo hướng từ người chơi, +`per_stun` (20)/con. Sự kiện `pulse` luôn phát khi tỏa sáng thành công, kể cả `stunned_ids` rỗng. |
| A7 | Bóng Mực | Ban đầu 2 con (S1, S2) ở mép đảo (r = 36 m), cao 1 m (tâm). Luôn đuổi thẳng tới người chơi với `shade_speed` 4 m/s (chậm hơn người chơi 6 m/s). Thêm 1 con mỗi 45 s (tối đa 5) → `shade_spawned`. Trạng thái: `chase`, `stunned`. |
| A8 | "Bóng Mực sợ đèn" | Không vào được vùng `safe_radius` (6 m) quanh đèn **đã thắp**; đèn chưa thắp không bảo vệ. |
| A9 | Bị chạm | Bóng Mực không choáng cách ≤ `shade_hit_radius` (1 m): −1 flame, rơi `floor(carried × hit_drop_ratio)` (0.5) đom đóm xuống đất quanh người chơi, cách 3 m; bất tử `invuln_s` (2 s). |
| A10 | Thắng / thua | Thắp đủ 5 đèn → `won` / `all_lit`. Hết flames → `lost` / `no_flames`. Hết thời gian đêm (`night1_duration_s` 300 s) → `lost` / `dawn`. |
| A11 | Điểm khi thắng | Cộng thêm `per_second_left × floor(time_left_s)` + `per_flame_left × flames` (1 và 50) tại lúc thắng. Thua thì không cộng thưởng. |
| A12 | Đom đóm ngẫu nhiên | Ban đầu 24 con rải đều trên đảo (r 4…38 m); cứ 3 s sinh thêm 1 con nếu đang < 24. |
| A13 | Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s². Nhảy không ảnh hưởng va chạm (mọi khoảng cách đo theo mặt phẳng XZ như contract). |
| A14 | `dash` | Phase 1 không có dash; trường `dash` trong inputs được chấp nhận nhưng không có tác dụng. |
| A15 | id | Đèn `L1…L5`; Bóng Mực `S1, S2…`; đom đóm `M1, M2…`. Thực thể trong scenario không có id được đặt id theo thứ tự từ 1; thực thể sinh sau tiếp tục đánh số. |
| A16 | Scenario `lit: true` không kèm `deposited` | Coi như `deposited = lantern_cost`. |
| A17 | Snapshot | Ngoài trường bắt buộc, có thêm mảng `motes` (`id`, `pos`) như contract khuyến nghị. Không thêm snapshot cuối ngoài lịch `--snapshot-every`. |

### Tiêu chí nghiệm thu (mỗi dòng có test/scenario tương ứng, xem `docs/proof/phase-1/README.md`)
1. Chạy `node dist-headless/headless.mjs ...` theo đúng contract → file JSONL hợp lệ, dòng cuối `end`, thoát 0.
2. File đầu vào sai định dạng → thoát 2.
3. Cùng seed + scenario + inputs → output giống hệt (kể cả giữa Windows và Linux).
4. Đi theo `move` + `cam_yaw_deg` đúng công thức và đúng `player_speed`.
5. Nhặt / nạp / thắp / tỏa sáng / bị chạm / thắng / thua phát đúng sự kiện và đúng điểm theo `tuning`.
6. Game có giao diện: chơi được từ đầu đến thắng hoặc thua, có HUD, nhấn R chơi lại.
